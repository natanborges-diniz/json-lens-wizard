/**
 * SKU-first Eligibility Pipeline (Phase 4 + Plan 7)
 * 
 * Canonical function isSkuEligibleForRx filters SKUs BEFORE family ranking.
 * Gates: active/blocked → price → no_specs → sphere → cylinder → addition → product_kind → diameter → height
 */

import type { Price, Prescription, FrameMeasurements, FamilyExtended } from '@/types/lens';
import { calcRequiredDiameter, type PupillaryData } from '@/lib/clinical/calcRequiredDiameter';
import { resolveProductKind } from '@/lib/clinical/resolveProductKind';

// ============================================
// TYPES
// ============================================

export interface SkuEligibilityResult {
  eligible: boolean;
  failedGate: string | null;
  /** True when SKU has zeroed grade data (sphere 0/0) — eligible but penalized */
  usingSafeDefaults?: boolean;
  debug?: {
    requiredDiameterMm?: number;
    skuDiameterMaxMm?: number;
    productKind?: string;
    productKindSource?: string;
  };
}

export interface EligibilityFunnel {
  totalSkus: number;
  passedActive: number;
  passedNoGrade: number;
  passedSphere: number;
  passedCylinder: number;
  passedAddition: number;
  passedProductKind: number;
  passedDiameter: number;
  passedHeight: number;
  finalEligible: number;
}

export interface EligibilityOutput {
  eligibleSkus: Price[];
  eligibleFamilies: Map<string, Price[]>;
  funnelCounts: EligibilityFunnel;
}

// ============================================
// HELPERS
// ============================================

function getSkuLimits(sku: Price): {
  sphereMin: number | null; sphereMax: number | null;
  cylMin: number | null; cylMax: number | null;
  addMin: number | null; addMax: number | null;
  diameterMaxMm: number | null;
  alturaMinMm: number | null;
} {
  const avail = (sku as any).availability;
  const specs = sku.specs;

  if (avail?.sphere?.min != null && avail?.sphere?.max != null) {
    return {
      sphereMin: avail.sphere.min,
      sphereMax: avail.sphere.max,
      cylMin: avail.cylinder?.min ?? null,
      cylMax: avail.cylinder?.max ?? null,
      addMin: avail.addition?.min ?? null,
      addMax: avail.addition?.max ?? null,
      diameterMaxMm: avail.diameter_max_mm ?? null,
      alturaMinMm: avail.altura_min_mm ?? null,
    };
  }

  if (specs && specs.sphere_min !== undefined && specs.sphere_max !== undefined) {
    return {
      sphereMin: specs.sphere_min,
      sphereMax: specs.sphere_max,
      cylMin: specs.cyl_min ?? null,
      cylMax: specs.cyl_max ?? null,
      addMin: specs.add_min ?? null,
      addMax: specs.add_max ?? null,
      diameterMaxMm: specs.diameter_max_mm ?? null,
      alturaMinMm: specs.altura_min_mm ?? null,
    };
  }

  return {
    sphereMin: null, sphereMax: null,
    cylMin: null, cylMax: null,
    addMin: null, addMax: null,
    diameterMaxMm: null, alturaMinMm: null,
  };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Canonical SKU eligibility check with sequential gates.
 * Gate order: active → price → no_specs → sphere → cyl → add → product_kind → diameter → height
 */
export function isSkuEligibleForRx(
  sku: Price,
  rx: Partial<Prescription>,
  frame?: FrameMeasurements | null,
  familyMap?: Map<string, FamilyExtended>
): SkuEligibilityResult {
  // Gate 1: Active & not blocked
  if (sku.active === false || sku.blocked) {
    return { eligible: false, failedGate: 'active' };
  }

  // Gate 1b: Must have positive price
  if (!sku.price_sale_half_pair || sku.price_sale_half_pair <= 0) {
    return { eligible: false, failedGate: 'price' };
  }

  const limits = getSkuLimits(sku);

  // Gate 2: No specs at all → cannot validate → reject
  if (limits.sphereMin === null || limits.sphereMax === null) {
    return { eligible: false, failedGate: 'no_specs' };
  }

  // Gate 2b: Zeroed grade (ERP sends 0/0 when no real data)
  // Hybrid mode: eligible but flagged with usingSafeDefaults for scoring penalty
  const isZeroedGrade = limits.sphereMin === 0 && limits.sphereMax === 0;

  // Gate 2: Sphere OD/OE (skip sphere check for zeroed grades — they pass with penalty)
  if (!isZeroedGrade) {
    const sphereOD = rx.rightSphere ?? 0;
    const sphereOE = rx.leftSphere ?? 0;
    if (sphereOD < limits.sphereMin || sphereOD > limits.sphereMax) {
      return { eligible: false, failedGate: 'sphere' };
    }
    if (sphereOE < limits.sphereMin || sphereOE > limits.sphereMax) {
      return { eligible: false, failedGate: 'sphere' };
    }
  }

  // Gate 3: Cylinder OD/OE
  if (limits.cylMin !== null) {
    const cylOD = rx.rightCylinder ?? 0;
    const cylOE = rx.leftCylinder ?? 0;
    const cylAbsMax = Math.abs(limits.cylMin);
    if (Math.abs(cylOD) > cylAbsMax) {
      return { eligible: false, failedGate: 'cylinder' };
    }
    if (Math.abs(cylOE) > cylAbsMax) {
      return { eligible: false, failedGate: 'cylinder' };
    }
  }

  // Gate 4: Addition (only if Rx has addition > 0)
  const maxAdd = Math.max(rx.rightAddition ?? 0, rx.leftAddition ?? 0);
  if (maxAdd > 0) {
    if (limits.addMin != null && limits.addMax != null) {
      if (maxAdd < limits.addMin || maxAdd > limits.addMax) {
        return { eligible: false, failedGate: 'addition' };
      }
    }
    if (limits.addMin == null && limits.addMax == null) {
      return { eligible: false, failedGate: 'addition' };
    }
  }

  // Gate 4b: ProductKind coherence
  const family = familyMap?.get(sku.family_id);
  const pkResult = resolveProductKind(sku, family);
  const hasAddition = maxAdd > 0;

  if (hasAddition && (pkResult.kind === 'LP' || pkResult.kind === 'VS')) {
    return { 
      eligible: false, 
      failedGate: 'product_kind',
      debug: { productKind: pkResult.kind, productKindSource: pkResult.source },
    };
  }
  if (!hasAddition && (pkResult.kind === 'PR' || pkResult.kind === 'OC')) {
    return { 
      eligible: false, 
      failedGate: 'product_kind',
      debug: { productKind: pkResult.kind, productKindSource: pkResult.source },
    };
  }

  // Gate 5: Diameter (using canonical MBS calculation)
  if (frame && frame.horizontalSize > 0 && frame.bridge > 0) {
    const pd: PupillaryData = {
      dnpOD: frame.dnpOD,
      dnpOE: frame.dnpOE,
      dp: frame.dp,
    };
    const diamCalc = calcRequiredDiameter(
      { horizontalSize: frame.horizontalSize, verticalSize: frame.verticalSize, bridge: frame.bridge },
      pd
    );
    if (limits.diameterMaxMm !== null && limits.diameterMaxMm > 0) {
      if (limits.diameterMaxMm < diamCalc.maxRequired) {
        return { 
          eligible: false, 
          failedGate: 'diameter',
          debug: {
            requiredDiameterMm: diamCalc.maxRequired,
            skuDiameterMaxMm: limits.diameterMaxMm,
            productKind: pkResult.kind,
            productKindSource: pkResult.source,
          },
        };
      }
    }
  }

  // Gate 6: Minimum height (when available, for PR/OC)
  if (frame && frame.altura && frame.altura > 0 && limits.alturaMinMm !== null && limits.alturaMinMm > 0) {
    if (frame.altura < limits.alturaMinMm) {
      return { eligible: false, failedGate: 'height' };
    }
  }

  return { 
    eligible: true, 
    failedGate: null,
    debug: {
      productKind: pkResult.kind,
      productKindSource: pkResult.source,
    },
  };
}

/**
 * Filters all SKUs and groups into eligible families.
 * A family is eligible only if it has ≥1 eligible SKU.
 */
export function getEligibleSkusAndFamilies(
  prices: Price[],
  families: FamilyExtended[],
  rx: Partial<Prescription>,
  frame?: FrameMeasurements | null,
  clinicalType?: string
): EligibilityOutput {
  const funnel: EligibilityFunnel = {
    totalSkus: 0,
    passedActive: 0,
    passedNoGrade: 0,
    passedSphere: 0,
    passedCylinder: 0,
    passedAddition: 0,
    passedProductKind: 0,
    passedDiameter: 0,
    passedHeight: 0,
    finalEligible: 0,
  };

  // Build family lookup for clinical type filtering
  const familyMap = new Map<string, FamilyExtended>();
  families.forEach(f => {
    if (f.active !== false) familyMap.set(f.id, f);
  });

  // Filter by clinical type if specified
  const relevantFamilyIds = new Set<string>();
  familyMap.forEach((f, id) => {
    if (!clinicalType) {
      relevantFamilyIds.add(id);
    } else {
      const ct = f.clinical_type || f.category;
      if (ct === clinicalType) relevantFamilyIds.add(id);
    }
  });

  const eligibleSkus: Price[] = [];
  const eligibleFamiliesMap = new Map<string, Price[]>();

  for (const sku of prices) {
    if (!relevantFamilyIds.has(sku.family_id)) continue;

    funnel.totalSkus++;

    const result = isSkuEligibleForRx(sku, rx, frame, familyMap);

    if (!result.eligible) {
      if (result.failedGate === 'active' || result.failedGate === 'price') continue;
      if (result.failedGate === 'no_specs') continue;
      funnel.passedActive++;
      if (result.failedGate === 'no_grade') continue;
      funnel.passedNoGrade++;
      if (result.failedGate === 'sphere') continue;
      funnel.passedSphere++;
      if (result.failedGate === 'cylinder') continue;
      funnel.passedCylinder++;
      if (result.failedGate === 'addition') continue;
      funnel.passedAddition++;
      if (result.failedGate === 'product_kind') continue;
      funnel.passedProductKind++;
      if (result.failedGate === 'diameter') continue;
      funnel.passedDiameter++;
      if (result.failedGate === 'height') continue;
      funnel.passedHeight++;
      continue;
    }

    // Passed all gates
    funnel.passedActive++;
    funnel.passedNoGrade++;
    funnel.passedSphere++;
    funnel.passedCylinder++;
    funnel.passedAddition++;
    funnel.passedProductKind++;
    funnel.passedDiameter++;
    funnel.passedHeight++;
    funnel.finalEligible++;

    eligibleSkus.push(sku);

    const existing = eligibleFamiliesMap.get(sku.family_id);
    if (existing) {
      existing.push(sku);
    } else {
      eligibleFamiliesMap.set(sku.family_id, [sku]);
    }
  }

  return {
    eligibleSkus,
    eligibleFamilies: eligibleFamiliesMap,
    funnelCounts: funnel,
  };
}
