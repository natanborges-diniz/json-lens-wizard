/**
 * Availability Resolver
 * 
 * Evaluates FOT (Frame-Optimized Thickness) constraints, supplier availability,
 * material/index limitations, and family availability by combination.
 * 
 * Operates on engine-format data (FamilyExtended + Price) after the supplier bridge
 * has converted DB data.
 */

import type { Price, Prescription, FrameMeasurements, FamilyExtended } from '@/types/lens';
import { calcRequiredDiameter, type PupillaryData } from '@/lib/clinical/calcRequiredDiameter';
import type { ConsultationConstraints } from './consultationSchema';

// ============================================
// TYPES
// ============================================

export interface FotCheckResult {
  passed: boolean;
  requiredDiameterMm: number;
  maxAvailableDiameterMm: number | null;
  marginMm: number | null;
  heightCheck: {
    passed: boolean;
    requiredHeight: number | null;
    availableMinHeight: number | null;
  };
  dnpMethod: 'monocular' | 'binocular_half' | 'fallback_no_pd';
}

export interface MaterialAvailability {
  index: string;
  indexValue: number;
  available: boolean;
  priceCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  lensStates: string[];
  fotCompatible: boolean;
}

export interface FamilyAvailabilitySummary {
  familyId: string;
  familyName: string;
  supplier: string;
  /** Total active prices for this family */
  totalPrices: number;
  /** Prices compatible with the current Rx */
  rxCompatiblePrices: number;
  /** Prices compatible with Rx + frame (FOT) */
  fotCompatiblePrices: number;
  /** Available materials/indices */
  materials: MaterialAvailability[];
  /** Available lens states */
  lensStates: string[];
  /** Available treatment combos */
  treatmentCombos: string[][];
  /** Starting price (min compatible) */
  startingPrice: number | null;
  /** Is this family available for recommendation? */
  isAvailable: boolean;
  /** Reason if not available */
  unavailableReason?: string;
}

export interface AvailabilityReport {
  /** Per-family availability */
  families: FamilyAvailabilitySummary[];
  /** Families that passed all availability checks */
  availableFamilies: FamilyAvailabilitySummary[];
  /** Families excluded and why */
  excludedFamilies: Array<{ familyId: string; reason: string }>;
  /** Summary stats */
  stats: {
    totalFamiliesChecked: number;
    totalAvailable: number;
    totalExcludedByConstraints: number;
    totalExcludedByFot: number;
    totalExcludedByRx: number;
    totalExcludedByNoPrice: number;
  };
}

// ============================================
// FOT CHECK
// ============================================

/**
 * Performs FOT (Frame-Optimized Thickness) check for a single SKU.
 * Returns whether the lens can be cut for the given frame.
 */
export function checkFot(
  sku: Price,
  frame: FrameMeasurements
): FotCheckResult {
  const pd: PupillaryData = {
    dnpOD: frame.dnpOD,
    dnpOE: frame.dnpOE,
    dp: frame.dp,
  };

  const diamCalc = calcRequiredDiameter(
    {
      horizontalSize: frame.horizontalSize,
      verticalSize: frame.verticalSize,
      bridge: frame.bridge,
    },
    pd
  );

  const skuDiamMax = sku.specs?.diameter_max_mm ?? null;
  const diameterPassed = skuDiamMax === null || skuDiamMax === 0 || skuDiamMax >= diamCalc.maxRequired;
  const marginMm = skuDiamMax && skuDiamMax > 0 ? skuDiamMax - diamCalc.maxRequired : null;

  // Height check for progressive/occupational
  const alturaMin = sku.specs?.altura_min_mm ?? null;
  const heightPassed = !alturaMin || alturaMin <= 0 || !frame.altura || frame.altura >= alturaMin;

  return {
    passed: diameterPassed && heightPassed,
    requiredDiameterMm: diamCalc.maxRequired,
    maxAvailableDiameterMm: skuDiamMax,
    marginMm,
    heightCheck: {
      passed: heightPassed,
      requiredHeight: frame.altura || null,
      availableMinHeight: alturaMin,
    },
    dnpMethod: diamCalc.debug.methodUsed,
  };
}

// ============================================
// FAMILY AVAILABILITY RESOLUTION
// ============================================

/**
 * Evaluates availability for a single family given Rx, frame, and constraints.
 */
export function resolveFamilyAvailability(
  family: FamilyExtended,
  allPrices: Price[],
  rx: Partial<Prescription>,
  frame?: FrameMeasurements | null,
  constraints?: ConsultationConstraints
): FamilyAvailabilitySummary {
  // Filter prices for this family
  const familyPrices = allPrices.filter(p =>
    p.family_id === family.id && p.active && !p.blocked && p.price_sale_half_pair > 0
  );

  if (familyPrices.length === 0) {
    return {
      familyId: family.id,
      familyName: family.display_name || family.name_original,
      supplier: family.supplier,
      totalPrices: 0,
      rxCompatiblePrices: 0,
      fotCompatiblePrices: 0,
      materials: [],
      lensStates: [],
      treatmentCombos: [],
      startingPrice: null,
      isAvailable: false,
      unavailableReason: 'Sem SKUs com preço ativo',
    };
  }

  // Check Rx compatibility
  const rxCompatible = familyPrices.filter(p => isRxCompatible(p, rx));

  // Check FOT compatibility
  const fotCompatible = frame
    ? rxCompatible.filter(p => checkFot(p, frame).passed)
    : rxCompatible; // No frame = skip FOT

  // Check constraints
  let constraintFiltered = fotCompatible;
  if (constraints?.lensStatePreference && constraints.lensStatePreference !== 'any') {
    const stateMap: Record<string, string[]> = {
      'clear': ['clear'],
      'photochromic': ['photochromic', 'transitions'],
      'polarized': ['polarized'],
    };
    const allowedStates = stateMap[constraints.lensStatePreference] || [];
    if (allowedStates.length > 0) {
      const stateFiltered = constraintFiltered.filter(p => {
        const desc = p.description?.toLowerCase() || '';
        return allowedStates.some(s => desc.includes(s));
      });
      if (stateFiltered.length > 0) constraintFiltered = stateFiltered;
    }
  }

  if (constraints?.requiredMaterialIndex) {
    const idxFiltered = constraintFiltered.filter(p => p.index === constraints.requiredMaterialIndex);
    if (idxFiltered.length > 0) constraintFiltered = idxFiltered;
  }

  // Build material availability
  const materialMap = new Map<string, Price[]>();
  for (const p of constraintFiltered) {
    const idx = p.index || '1.50';
    if (!materialMap.has(idx)) materialMap.set(idx, []);
    materialMap.get(idx)!.push(p);
  }

  const materials: MaterialAvailability[] = [];
  materialMap.forEach((prices, idx) => {
    const fotPrices = frame ? prices.filter(p => checkFot(p, frame).passed) : prices;
    materials.push({
      index: idx,
      indexValue: parseFloat(idx) || 1.5,
      available: fotPrices.length > 0,
      priceCount: fotPrices.length,
      minPrice: fotPrices.length > 0 ? Math.min(...fotPrices.map(p => p.price_sale_half_pair)) : null,
      maxPrice: fotPrices.length > 0 ? Math.max(...fotPrices.map(p => p.price_sale_half_pair)) : null,
      lensStates: [...new Set(fotPrices.map(p => (p as any).lens_state || 'clear'))],
      fotCompatible: fotPrices.length > 0,
    });
  });

  materials.sort((a, b) => a.indexValue - b.indexValue);

  // Lens states and treatment combos
  const lensStates = [...new Set(constraintFiltered.map(p => (p as any).lens_state || 'clear'))];
  const treatmentCombos = constraintFiltered
    .map(p => p.addons_detected || [])
    .filter(combo => combo.length > 0);
  const uniqueCombos = Array.from(
    new Map(treatmentCombos.map(c => [c.sort().join('|'), c])).values()
  );

  // Starting price
  const startingPrice = constraintFiltered.length > 0
    ? Math.min(...constraintFiltered.map(p => p.price_sale_half_pair)) * 2
    : null;

  const isAvailable = constraintFiltered.length > 0;

  return {
    familyId: family.id,
    familyName: family.display_name || family.name_original,
    supplier: family.supplier,
    totalPrices: familyPrices.length,
    rxCompatiblePrices: rxCompatible.length,
    fotCompatiblePrices: fotCompatible.length,
    materials,
    lensStates,
    treatmentCombos: uniqueCombos,
    startingPrice,
    isAvailable,
    unavailableReason: isAvailable ? undefined : determineUnavailableReason(familyPrices.length, rxCompatible.length, fotCompatible.length),
  };
}

/**
 * Resolves availability for all families and produces a full report.
 */
export function resolveFullAvailability(
  families: FamilyExtended[],
  prices: Price[],
  rx: Partial<Prescription>,
  frame?: FrameMeasurements | null,
  constraints?: ConsultationConstraints
): AvailabilityReport {
  const familySummaries: FamilyAvailabilitySummary[] = [];
  const excluded: Array<{ familyId: string; reason: string }> = [];
  let excludedByConstraints = 0;
  let excludedByFot = 0;
  let excludedByRx = 0;
  let excludedByNoPrice = 0;

  for (const family of families) {
    // Pre-filter by supplier constraints
    if (constraints?.allowedSuppliers?.length &&
        !constraints.allowedSuppliers.includes(family.supplier)) {
      excluded.push({ familyId: family.id, reason: `Fornecedor ${family.supplier} não permitido` });
      excludedByConstraints++;
      continue;
    }
    if (constraints?.excludedSuppliers?.includes(family.supplier)) {
      excluded.push({ familyId: family.id, reason: `Fornecedor ${family.supplier} excluído` });
      excludedByConstraints++;
      continue;
    }
    if (constraints?.excludedFamilyIds?.includes(family.id)) {
      excluded.push({ familyId: family.id, reason: 'Família excluída manualmente' });
      excludedByConstraints++;
      continue;
    }

    const summary = resolveFamilyAvailability(family, prices, rx, frame, constraints);
    familySummaries.push(summary);

    if (!summary.isAvailable) {
      excluded.push({ familyId: family.id, reason: summary.unavailableReason || 'Indisponível' });
      if (summary.totalPrices === 0) excludedByNoPrice++;
      else if (summary.rxCompatiblePrices === 0) excludedByRx++;
      else if (summary.fotCompatiblePrices === 0) excludedByFot++;
    }
  }

  const available = familySummaries.filter(s => s.isAvailable);

  return {
    families: familySummaries,
    availableFamilies: available,
    excludedFamilies: excluded,
    stats: {
      totalFamiliesChecked: families.length,
      totalAvailable: available.length,
      totalExcludedByConstraints: excludedByConstraints,
      totalExcludedByFot: excludedByFot,
      totalExcludedByRx: excludedByRx,
      totalExcludedByNoPrice: excludedByNoPrice,
    },
  };
}

// ============================================
// HELPERS
// ============================================

function isRxCompatible(sku: Price, rx: Partial<Prescription>): boolean {
  const specs = sku.specs;
  if (!specs || (specs.sphere_min === 0 && specs.sphere_max === 0)) return true; // No specs = permissive

  const sphereOD = rx.rightSphere ?? 0;
  const sphereOE = rx.leftSphere ?? 0;
  if (specs.sphere_min != null && specs.sphere_max != null) {
    if (sphereOD < specs.sphere_min || sphereOD > specs.sphere_max) return false;
    if (sphereOE < specs.sphere_min || sphereOE > specs.sphere_max) return false;
  }

  const cylOD = Math.abs(rx.rightCylinder ?? 0);
  const cylOE = Math.abs(rx.leftCylinder ?? 0);
  if (specs.cyl_min != null) {
    const cylLimit = Math.abs(specs.cyl_min);
    if (cylOD > cylLimit || cylOE > cylLimit) return false;
  }

  const maxAdd = Math.max(rx.rightAddition ?? 0, rx.leftAddition ?? 0);
  if (maxAdd > 0 && specs.add_min != null && specs.add_max != null) {
    if (maxAdd < specs.add_min || maxAdd > specs.add_max) return false;
  }

  return true;
}

function determineUnavailableReason(
  totalPrices: number,
  rxCompatible: number,
  fotCompatible: number
): string {
  if (totalPrices === 0) return 'Sem SKUs com preço ativo';
  if (rxCompatible === 0) return 'Nenhum SKU compatível com a receita';
  if (fotCompatible === 0) return 'Nenhum SKU compatível com a armação (FOT)';
  return 'Restrições de filtro excluíram todas as opções';
}
