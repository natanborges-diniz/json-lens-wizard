/**
 * Treatment Compatibility Resolver
 * 
 * Resolves which treatments are compatible with which materials/families.
 * Bridges supplier_treatments data with the recommendation pipeline.
 * 
 * Responsibilities:
 * - Load treatment data from DB
 * - Check material-treatment compatibility
 * - Resolve available treatment combos per family + material
 * - Provide treatment metadata for narrative/justification
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface TreatmentRecord {
  id: string;
  supplierCode: string;
  originalName: string;
  displayName: string;
  treatmentType: string;
  description: string | null;
  keyBenefit: string | null;
  performanceLevel: number | null;
  /** Material compatibility */
  compatibleMaterials: string[] | null;
  /** Photochromic-specific */
  photochromicSpeed: string | null;
  photochromicDarkeningPercent: number | null;
  /** Performance metrics */
  blueFilterPercent: number | null;
  uvFilterPercent: number | null;
  scratchResistanceLevel: number | null;
  antiReflectiveLevel: number | null;
  easyCleanLevel: number | null;
}

export interface TreatmentCompatibility {
  treatmentId: string;
  treatmentName: string;
  treatmentType: string;
  isCompatible: boolean;
  incompatibilityReason?: string;
}

export interface FamilyTreatmentReport {
  familyId: string;
  materialIndex: string;
  supplierCode: string;
  /** All treatments for this supplier */
  allTreatments: TreatmentRecord[];
  /** Treatments compatible with this material */
  compatibleTreatments: TreatmentRecord[];
  /** Incompatible treatments with reasons */
  incompatibilities: TreatmentCompatibility[];
  /** Grouped by type for UI display */
  byType: Record<string, TreatmentRecord[]>;
}

// ============================================
// LOADER
// ============================================

/**
 * Loads all active treatments for given suppliers from DB.
 */
export async function loadTreatments(
  supplierCodes?: string[]
): Promise<TreatmentRecord[]> {
  let query = supabase
    .from('supplier_treatments')
    .select('*')
    .eq('active', true);

  if (supplierCodes?.length) {
    query = query.in('supplier_code', supplierCodes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[TreatmentResolver] Failed to load treatments:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    supplierCode: row.supplier_code,
    originalName: row.original_name,
    displayName: row.display_name || row.original_name,
    treatmentType: row.treatment_type,
    description: row.description,
    keyBenefit: row.key_benefit,
    performanceLevel: row.performance_level,
    compatibleMaterials: row.compatible_materials,
    photochromicSpeed: row.photochromic_speed,
    photochromicDarkeningPercent: row.photochromic_darkening_percent,
    blueFilterPercent: row.blue_light_filter_percent,
    uvFilterPercent: row.uv_filter_percent,
    scratchResistanceLevel: row.scratch_resistance_level,
    antiReflectiveLevel: row.anti_reflective_level,
    easyCleanLevel: row.easy_clean_level,
  }));
}

// ============================================
// COMPATIBILITY CHECK
// ============================================

/**
 * Checks if a treatment is compatible with a given material index.
 */
export function isTreatmentCompatibleWithMaterial(
  treatment: TreatmentRecord,
  materialIndex: string
): TreatmentCompatibility {
  // If no material restrictions, treatment is compatible with everything
  if (!treatment.compatibleMaterials || treatment.compatibleMaterials.length === 0) {
    return {
      treatmentId: treatment.id,
      treatmentName: treatment.displayName,
      treatmentType: treatment.treatmentType,
      isCompatible: true,
    };
  }

  // Check if the material index is in the compatible list
  const normalizedIndex = materialIndex.replace(',', '.');
  const isCompatible = treatment.compatibleMaterials.some(mat => {
    const normalizedMat = mat.replace(',', '.').trim().toLowerCase();
    return normalizedMat === normalizedIndex.toLowerCase() ||
           normalizedMat.includes(normalizedIndex) ||
           normalizedIndex.includes(normalizedMat);
  });

  return {
    treatmentId: treatment.id,
    treatmentName: treatment.displayName,
    treatmentType: treatment.treatmentType,
    isCompatible,
    incompatibilityReason: isCompatible
      ? undefined
      : `${treatment.displayName} não compatível com índice ${materialIndex}`,
  };
}

/**
 * Resolves all compatible treatments for a family + material combination.
 */
export function resolveFamilyTreatments(
  familyId: string,
  familyTreatmentIds: string[],
  materialIndex: string,
  supplierCode: string,
  allTreatments: TreatmentRecord[]
): FamilyTreatmentReport {
  // Filter treatments for this supplier
  const supplierTreatments = allTreatments.filter(t => t.supplierCode === supplierCode);

  // If the family has explicit treatment_ids, use those; otherwise use all supplier treatments
  const relevantTreatments = familyTreatmentIds.length > 0
    ? supplierTreatments.filter(t => familyTreatmentIds.includes(t.id))
    : supplierTreatments;

  const compatibleTreatments: TreatmentRecord[] = [];
  const incompatibilities: TreatmentCompatibility[] = [];

  for (const treatment of relevantTreatments) {
    const check = isTreatmentCompatibleWithMaterial(treatment, materialIndex);
    if (check.isCompatible) {
      compatibleTreatments.push(treatment);
    } else {
      incompatibilities.push(check);
    }
  }

  // Group compatible treatments by type
  const byType: Record<string, TreatmentRecord[]> = {};
  for (const t of compatibleTreatments) {
    if (!byType[t.treatmentType]) byType[t.treatmentType] = [];
    byType[t.treatmentType].push(t);
  }

  return {
    familyId,
    materialIndex,
    supplierCode,
    allTreatments: relevantTreatments,
    compatibleTreatments,
    incompatibilities,
    byType,
  };
}

// ============================================
// CONSTRAINT FILTER
// ============================================

/**
 * Filters treatments based on consultation constraints.
 * E.g., if the customer wants photochromic, only include photochromic treatments.
 */
export function filterTreatmentsByConstraints(
  treatments: TreatmentRecord[],
  requiredTypes?: string[],
  lensStatePreference?: string
): TreatmentRecord[] {
  let filtered = [...treatments];

  // If specific treatment types are required, filter to those
  if (requiredTypes?.length) {
    filtered = filtered.filter(t =>
      requiredTypes.some(req => t.treatmentType.toLowerCase().includes(req.toLowerCase()))
    );
  }

  // If lens state preference implies a treatment type
  if (lensStatePreference === 'photochromic') {
    // Must include at least one photochromic treatment
    const hasPhotochromic = filtered.some(t =>
      t.treatmentType.toLowerCase().includes('fotocromatico') ||
      t.treatmentType.toLowerCase().includes('photochromic') ||
      t.treatmentType.toLowerCase().includes('transitions')
    );
    if (!hasPhotochromic) {
      // No photochromic available — return empty to signal constraint failure
      return [];
    }
  }

  return filtered;
}
