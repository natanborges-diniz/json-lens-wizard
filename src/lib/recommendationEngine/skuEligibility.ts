/**
 * SKU-first Eligibility Pipeline (E1)
 * 
 * Canonical function isSkuEligibleForRx filters SKUs BEFORE family ranking.
 * Gates: active/blocked → sphere → cylinder → addition → diameter → height
 */

import type { Price, Prescription, FrameMeasurements, FamilyExtended } from '@/types/lens';

// ============================================
// TYPES
// ============================================

export interface SkuEligibilityResult {
  eligible: boolean;
  failedGate: string | null;
}

export interface EligibilityFunnel {
  totalSkus: number;
  passedActive: number;
  passedSphere: number;
  passedCylinder: number;
  passedAddition: number;
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

/**
 * Calculate required lens diameter from frame measurements and DNP.
 * Formula: max of (A + DBL - DNP, DNP) + safety margin
 */
function calculateRequiredDiameter(frame: FrameMeasurements): number {
  const A = frame.horizontalSize;
  const DBL = frame.bridge;
  const DNP = frame.dp; // interpupillary distance per eye
  const nasal = (A + DBL) / 2 - DNP;
  const temporal = A - nasal;
  const halfVertical = frame.verticalSize / 2;
  // Required = 2 * max(temporal, nasal, halfVertical) + 2mm safety
  const maxHalf = Math.max(temporal, nasal, halfVertical);
  return Math.ceil(maxHalf * 2) + 2;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Canonical SKU eligibility check with sequential gates.
 */
export function isSkuEligibleForRx(
  sku: Price,
  rx: Partial<Prescription>,
  frame?: FrameMeasurements | null
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

  // Gate 2: Sphere OD/OE
  const sphereOD = rx.rightSphere ?? 0;
  const sphereOE = rx.leftSphere ?? 0;
  if (sphereOD < limits.sphereMin || sphereOD > limits.sphereMax) {
    return { eligible: false, failedGate: 'sphere' };
  }
  if (sphereOE < limits.sphereMin || sphereOE > limits.sphereMax) {
    return { eligible: false, failedGate: 'sphere' };
  }

  // Gate 3: Cylinder OD/OE
  if (limits.cylMin !== null) {
    const cylOD = rx.rightCylinder ?? 0;
    const cylOE = rx.leftCylinder ?? 0;
    const cylAbsMax = Math.abs(limits.cylMin); // cylMin is typically negative
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
    // If SKU has no addition limits but Rx requires addition, reject
    if (limits.addMin == null && limits.addMax == null) {
      return { eligible: false, failedGate: 'addition' };
    }
  }

  // Gate 5: Diameter (if frame provided)
  if (frame && frame.horizontalSize > 0 && frame.bridge > 0 && frame.dp > 0) {
    const requiredDiameter = calculateRequiredDiameter(frame);
    if (limits.diameterMaxMm !== null && limits.diameterMaxMm > 0) {
      if (limits.diameterMaxMm < requiredDiameter) {
        return { eligible: false, failedGate: 'diameter' };
      }
    }
  }

  // Gate 6: Minimum height (when available)
  if (frame && frame.altura && frame.altura > 0 && limits.alturaMinMm !== null && limits.alturaMinMm > 0) {
    if (frame.altura < limits.alturaMinMm) {
      return { eligible: false, failedGate: 'height' };
    }
  }

  return { eligible: true, failedGate: null };
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
    passedSphere: 0,
    passedCylinder: 0,
    passedAddition: 0,
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
    // Skip if family not in relevant set
    if (!relevantFamilyIds.has(sku.family_id)) continue;

    funnel.totalSkus++;

    const result = isSkuEligibleForRx(sku, rx, frame);

    if (!result.eligible) {
      // Track funnel - increment based on how far it got
      if (result.failedGate === 'active' || result.failedGate === 'price') continue;
      if (result.failedGate === 'no_specs') continue;
      funnel.passedActive++;
      if (result.failedGate === 'sphere') continue;
      funnel.passedSphere++;
      if (result.failedGate === 'cylinder') continue;
      funnel.passedCylinder++;
      if (result.failedGate === 'addition') continue;
      funnel.passedAddition++;
      if (result.failedGate === 'diameter') continue;
      funnel.passedDiameter++;
      if (result.failedGate === 'height') continue;
      funnel.passedHeight++;
      continue;
    }

    // Passed all gates
    funnel.passedActive++;
    funnel.passedSphere++;
    funnel.passedCylinder++;
    funnel.passedAddition++;
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
