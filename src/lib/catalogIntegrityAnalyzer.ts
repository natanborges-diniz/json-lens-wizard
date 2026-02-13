/**
 * catalogIntegrityAnalyzer.ts - Clinical integrity analysis for SKUs
 * 
 * Classifies each SKU into: COMPLETO | LEGACY | PARCIAL | DEFAULTED
 * based on availability/specs data completeness.
 */

import type { Price, FamilyExtended, ClinicalType } from '@/types/lens';

export type SKUClassification = 'COMPLETO' | 'LEGACY' | 'PARCIAL' | 'DEFAULTED';

export interface SKUIntegrityMetric {
  erp_code: string;
  family_id: string;
  supplier: string;
  clinical_type: ClinicalType;
  classification: SKUClassification;
  issues: string[];
}

export interface ClassificationCounts {
  COMPLETO: number;
  LEGACY: number;
  PARCIAL: number;
  DEFAULTED: number;
}

export interface BreakdownMetric {
  total: number;
  classifications: ClassificationCounts;
}

export interface FamilyDefaultedEntry {
  family_id: string;
  family_name: string;
  supplier: string;
  clinical_type: ClinicalType;
  defaulted_count: number;
  partial_count: number;
  total_skus: number;
}

export interface SupplierDefaultedEntry {
  supplier: string;
  defaulted_count: number;
  partial_count: number;
  total_skus: number;
}

export interface ClinicalIntegrityReport {
  total_skus: number;
  classifications: ClassificationCounts;
  by_supplier: Record<string, BreakdownMetric>;
  by_clinical_type: Record<string, BreakdownMetric>;
  families_most_affected: FamilyDefaultedEntry[];
  suppliers_most_affected: SupplierDefaultedEntry[];
  problem_count: number; // PARCIAL + DEFAULTED
  skus: SKUIntegrityMetric[];
}

/**
 * Classify a single SKU based on its availability/specs data
 */
function classifySKU(
  price: Price,
  family: FamilyExtended | undefined
): SKUIntegrityMetric {
  const clinicalType: ClinicalType = price.clinical_type || family?.clinical_type || family?.category || 'MONOFOCAL';
  const supplier = price.supplier || family?.supplier || 'DESCONHECIDO';
  const issues: string[] = [];

  const existingAvailability = (price as any).availability;
  
  // Check V3.6.x availability format
  if (existingAvailability?.sphere) {
    const hasSphere = existingAvailability.sphere.min != null && existingAvailability.sphere.max != null;
    const hasCylinder = existingAvailability.cylinder?.min != null && existingAvailability.cylinder?.max != null;
    
    const needsAddition = clinicalType === 'PROGRESSIVA' || clinicalType === 'OCUPACIONAL' || clinicalType === 'BIFOCAL';
    const hasAddition = existingAvailability.addition?.min != null && existingAvailability.addition?.max != null;

    if (!hasSphere) issues.push('missing_sphere');
    if (!hasCylinder) issues.push('missing_cylinder');
    if (needsAddition && !hasAddition) issues.push('missing_addition');

    if (issues.length === 0) {
      return { erp_code: price.erp_code, family_id: price.family_id, supplier, clinical_type: clinicalType, classification: 'COMPLETO', issues };
    }
    return { erp_code: price.erp_code, family_id: price.family_id, supplier, clinical_type: clinicalType, classification: 'PARCIAL', issues };
  }

  // Check legacy specs format
  const specs = price.specs;
  if (specs && specs.sphere_min !== undefined) {
    const hasSphere = specs.sphere_min !== undefined && specs.sphere_max !== undefined;
    const hasCylinder = specs.cyl_min !== undefined && specs.cyl_max !== undefined;
    const needsAddition = clinicalType === 'PROGRESSIVA' || clinicalType === 'OCUPACIONAL' || clinicalType === 'BIFOCAL';
    const hasAddition = specs.add_min !== undefined && specs.add_max !== undefined;

    if (!hasSphere) issues.push('missing_sphere');
    if (!hasCylinder) issues.push('missing_cylinder');
    if (needsAddition && !hasAddition) issues.push('missing_addition');

    if (issues.length === 0) {
      return { erp_code: price.erp_code, family_id: price.family_id, supplier, clinical_type: clinicalType, classification: 'LEGACY', issues };
    }
    return { erp_code: price.erp_code, family_id: price.family_id, supplier, clinical_type: clinicalType, classification: 'PARCIAL', issues };
  }

  // No specs at all → DEFAULTED (uses safe defaults)
  return {
    erp_code: price.erp_code,
    family_id: price.family_id,
    supplier,
    clinical_type: clinicalType,
    classification: 'DEFAULTED',
    issues: ['no_specs_data'],
  };
}

function emptyClassificationCounts(): ClassificationCounts {
  return { COMPLETO: 0, LEGACY: 0, PARCIAL: 0, DEFAULTED: 0 };
}

/**
 * Calculate full clinical integrity report for all SKUs
 */
export function calculateClinicalIntegrityReport(
  prices: Price[],
  families: FamilyExtended[]
): ClinicalIntegrityReport {
  const familiesMap = new Map<string, FamilyExtended>();
  families.forEach(f => familiesMap.set(f.id, f));

  // Classify all SKUs
  const skus = prices.map(p => classifySKU(p, familiesMap.get(p.family_id)));

  // Overall counts
  const classifications = emptyClassificationCounts();
  skus.forEach(s => classifications[s.classification]++);

  // By supplier
  const bySupplier: Record<string, BreakdownMetric> = {};
  skus.forEach(s => {
    if (!bySupplier[s.supplier]) bySupplier[s.supplier] = { total: 0, classifications: emptyClassificationCounts() };
    bySupplier[s.supplier].total++;
    bySupplier[s.supplier].classifications[s.classification]++;
  });

  // By clinical type
  const byClinicalType: Record<string, BreakdownMetric> = {};
  skus.forEach(s => {
    if (!byClinicalType[s.clinical_type]) byClinicalType[s.clinical_type] = { total: 0, classifications: emptyClassificationCounts() };
    byClinicalType[s.clinical_type].total++;
    byClinicalType[s.clinical_type].classifications[s.classification]++;
  });

  // Top families with most DEFAULTED + PARCIAL
  const familyAgg: Record<string, { defaulted: number; partial: number; total: number }> = {};
  skus.forEach(s => {
    if (!familyAgg[s.family_id]) familyAgg[s.family_id] = { defaulted: 0, partial: 0, total: 0 };
    familyAgg[s.family_id].total++;
    if (s.classification === 'DEFAULTED') familyAgg[s.family_id].defaulted++;
    if (s.classification === 'PARCIAL') familyAgg[s.family_id].partial++;
  });

  const familiesMostAffected: FamilyDefaultedEntry[] = Object.entries(familyAgg)
    .filter(([, v]) => v.defaulted + v.partial > 0)
    .map(([familyId, v]) => {
      const fam = familiesMap.get(familyId);
      return {
        family_id: familyId,
        family_name: fam?.name_original || familyId,
        supplier: fam?.supplier || 'DESCONHECIDO',
        clinical_type: (fam?.clinical_type || fam?.category || 'MONOFOCAL') as ClinicalType,
        defaulted_count: v.defaulted,
        partial_count: v.partial,
        total_skus: v.total,
      };
    })
    .sort((a, b) => (b.defaulted_count + b.partial_count) - (a.defaulted_count + a.partial_count))
    .slice(0, 20);

  // Top suppliers
  const suppliersMostAffected: SupplierDefaultedEntry[] = Object.entries(bySupplier)
    .filter(([, v]) => v.classifications.DEFAULTED + v.classifications.PARCIAL > 0)
    .map(([supplier, v]) => ({
      supplier,
      defaulted_count: v.classifications.DEFAULTED,
      partial_count: v.classifications.PARCIAL,
      total_skus: v.total,
    }))
    .sort((a, b) => (b.defaulted_count + b.partial_count) - (a.defaulted_count + a.partial_count))
    .slice(0, 20);

  const problemCount = classifications.PARCIAL + classifications.DEFAULTED;

  return {
    total_skus: skus.length,
    classifications,
    by_supplier: bySupplier,
    by_clinical_type: byClinicalType,
    families_most_affected: familiesMostAffected,
    suppliers_most_affected: suppliersMostAffected,
    problem_count: problemCount,
    skus,
  };
}
