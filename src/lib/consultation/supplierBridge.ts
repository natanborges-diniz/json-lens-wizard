/**
 * Supplier Bridge
 * 
 * Converts DB-backed multi-supplier data (supplier_families, supplier_prices,
 * catalog_variant_grades) into the engine-compatible FamilyExtended[] + Price[]
 * format used by the recommendation engine.
 * 
 * This is the critical adapter between the persistent multi-supplier DB layer
 * and the in-memory recommendation pipeline.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  FamilyExtended,
  Price,
  PriceSpec,
  Technology,
  ClinicalType,
} from '@/types/lens';

// ============================================
// TYPES
// ============================================

/** Raw supplier family row from DB */
interface SupplierFamilyRow {
  id: string;
  supplier_code: string;
  original_name: string;
  display_name: string | null;
  clinical_type: string;
  commercial_category: string | null;
  tier_position: string | null;
  description: string | null;
  key_differentiator: string | null;
  target_audience: string | null;
  technology_ids: string[] | null;
  benefit_ids: string[] | null;
  material_ids: string[] | null;
  treatment_ids: string[] | null;
  value_axes: Record<string, number> | null;
  active: boolean;
  confidence: string;
  review_status: string;
}

/** Raw supplier price row from DB */
interface SupplierPriceRow {
  id: string;
  supplier_code: string;
  family_id: string;
  material_index: string;
  treatment_combo: string[] | null;
  lens_state: string;
  price_value: number;
  currency: string;
  effective_date: string;
  confidence: string;
  active: boolean;
}

/** Raw variant grade row from DB */
interface VariantGradeRow {
  id: string;
  family_id: string;
  index: string;
  lens_state: string;
  sphere_min: number | null;
  sphere_max: number | null;
  cylinder_min: number | null;
  cylinder_max: number | null;
  addition_min: number | null;
  addition_max: number | null;
  diameters_mm: number[] | null;
}

/** Raw technology row from DB */
interface SupplierTechnologyRow {
  id: string;
  supplier_code: string;
  original_name: string;
  display_name: string | null;
  tech_group: string | null;
  description_short: string | null;
  description_long: string | null;
  benefits: string[] | null;
  icon: string | null;
}

/** Raw benefit row from DB */
interface SupplierBenefitRow {
  id: string;
  supplier_code: string;
  original_text: string;
  benefit_category: string;
  short_argument: string | null;
  perceived_value: string | null;
  applicable_to: string[] | null;
}

/** Benefit record for engine consumption */
export interface BenefitRecord {
  id: string;
  supplierCode: string;
  text: string;
  category: string;
  shortArgument: string | null;
  perceivedValue: string | null;
  applicableTo: string[] | null;
}

/** Bridge output: engine-ready data */
export interface SupplierBridgeOutput {
  families: FamilyExtended[];
  prices: Price[];
  technologyLibrary: Record<string, Technology>;
  benefits: BenefitRecord[];
  meta: {
    familiesLoaded: number;
    pricesLoaded: number;
    gradesLoaded: number;
    technologiesLoaded: number;
    benefitsLoaded: number;
    suppliers: string[];
  };
}

// ============================================
// MAIN BRIDGE FUNCTION
// ============================================

/**
 * Loads all supplier data from DB and converts to engine format.
 * Filters by clinical type if provided.
 */
export async function loadSupplierDataForEngine(
  clinicalType?: ClinicalType,
  supplierCodes?: string[]
): Promise<SupplierBridgeOutput> {
  // Parallel DB queries
  const [familiesResult, pricesResult, gradesResult, techResult, benefitsResult] = await Promise.all([
    loadFamilies(clinicalType, supplierCodes),
    loadPrices(supplierCodes),
    loadGrades(),
    loadTechnologies(supplierCodes),
    loadBenefits(supplierCodes),
  ]);

  // Build lookup maps
  const gradesByFamilyIndex = buildGradeMap(gradesResult);
  const techMap = buildTechnologyLibrary(techResult);
  const benefits = convertBenefits(benefitsResult);

  // Convert families
  const families = familiesResult.map(row => 
    convertFamilyToExtended(row, techResult)
  );

  // Convert prices with grade data
  const prices = pricesResult.map(row =>
    convertPriceToLegacy(row, gradesByFamilyIndex)
  );

  const suppliers = [...new Set(familiesResult.map(f => f.supplier_code))];

  return {
    families,
    prices,
    technologyLibrary: techMap,
    benefits,
    meta: {
      familiesLoaded: families.length,
      pricesLoaded: prices.length,
      gradesLoaded: gradesResult.length,
      technologiesLoaded: techResult.length,
      benefitsLoaded: benefits.length,
      suppliers,
    },
}

// ============================================
// DB LOADERS
// ============================================

async function loadFamilies(
  clinicalType?: ClinicalType,
  supplierCodes?: string[]
): Promise<SupplierFamilyRow[]> {
  let query = supabase
    .from('supplier_families')
    .select('*')
    .eq('active', true);

  if (clinicalType) {
    query = query.eq('clinical_type', clinicalType.toLowerCase());
  }
  if (supplierCodes?.length) {
    query = query.in('supplier_code', supplierCodes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[SupplierBridge] Failed to load families:', error);
    return [];
  }
  return (data || []) as unknown as SupplierFamilyRow[];
}

async function loadPrices(supplierCodes?: string[]): Promise<SupplierPriceRow[]> {
  let query = supabase
    .from('supplier_prices')
    .select('*')
    .eq('active', true);

  if (supplierCodes?.length) {
    query = query.in('supplier_code', supplierCodes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[SupplierBridge] Failed to load prices:', error);
    return [];
  }
  return (data || []) as unknown as SupplierPriceRow[];
}

async function loadGrades(): Promise<VariantGradeRow[]> {
  const { data, error } = await supabase
    .from('catalog_variant_grades')
    .select('*');

  if (error) {
    console.error('[SupplierBridge] Failed to load grades:', error);
    return [];
  }
  return (data || []) as unknown as VariantGradeRow[];
}

async function loadBenefits(supplierCodes?: string[]): Promise<SupplierBenefitRow[]> {
  let query = supabase
    .from('supplier_benefits')
    .select('*')
    .eq('active', true);

  if (supplierCodes?.length) {
    query = query.in('supplier_code', supplierCodes);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[SupplierBridge] Failed to load benefits:', error);
    return [];
  }
  return (data || []) as unknown as SupplierBenefitRow[];
}

function convertBenefits(rows: SupplierBenefitRow[]): BenefitRecord[] {
  return rows.map(row => ({
    id: row.id,
    supplierCode: row.supplier_code,
    text: row.original_text,
    category: row.benefit_category,
    shortArgument: row.short_argument,
    perceivedValue: row.perceived_value,
    applicableTo: row.applicable_to,
  }));
}

// ============================================
// CONVERTERS
// ============================================

function buildGradeMap(grades: VariantGradeRow[]): Map<string, VariantGradeRow> {
  const map = new Map<string, VariantGradeRow>();
  for (const g of grades) {
    const key = `${g.family_id}::${g.index}::${g.lens_state}`;
    map.set(key, g);
  }
  return map;
}

function buildTechnologyLibrary(techs: SupplierTechnologyRow[]): Record<string, Technology> {
  const lib: Record<string, Technology> = {};
  for (const t of techs) {
    lib[t.id] = {
      id: t.id,
      name_common: t.display_name || t.original_name,
      description_short: t.description_short || '',
      description_long: t.description_long || undefined,
      benefits: t.benefits || undefined,
      icon: t.icon || undefined,
      group: t.tech_group || undefined,
    };
  }
  return lib;
}

/**
 * Converts a supplier_families DB row into engine-compatible FamilyExtended.
 */
function convertFamilyToExtended(
  row: SupplierFamilyRow,
  technologies: SupplierTechnologyRow[]
): FamilyExtended {
  // Map clinical_type string to ClinicalType enum
  const clinicalTypeMap: Record<string, ClinicalType> = {
    'progressiva': 'PROGRESSIVA',
    'visao-simples': 'MONOFOCAL',
    'monofocal': 'MONOFOCAL',
    'ocupacional': 'OCUPACIONAL',
    'bifocal': 'BIFOCAL',
    'controle-miopia': 'MONOFOCAL', // Myopia control is single vision
  };

  const resolvedClinicalType = clinicalTypeMap[row.clinical_type.toLowerCase()] || 'MONOFOCAL';

  // Map tier_position to tier_target
  const tierMap: Record<string, FamilyExtended['tier_target']> = {
    'entrada': 'essential',
    'essential': 'essential',
    'basico': 'essential',
    'intermediario': 'comfort',
    'comfort': 'comfort',
    'conforto': 'comfort',
    'intermediario-premium': 'advanced',
    'premium-intermediario': 'advanced',
    'advanced': 'advanced',
    'avancado': 'advanced',
    'premium': 'top',
    'top': 'top',
    'clinico-especializado': 'advanced',
    'ocupacional-especializado': 'comfort',
    'entrada-intermediario': 'comfort',
  };

  // Resolve technology refs
  const techRefs = (row.technology_ids || []).filter(id => 
    technologies.some(t => t.id === id)
  );

  // Build attributes_base from value_axes
  const attributesBase: Record<string, number | boolean> = {};
  if (row.value_axes) {
    Object.entries(row.value_axes).forEach(([key, val]) => {
      if (typeof val === 'number') attributesBase[key] = val;
    });
  }

  return {
    id: row.id,
    supplier: row.supplier_code,
    name_original: row.original_name,
    category: resolvedClinicalType,
    clinical_type: resolvedClinicalType,
    macro: `${resolvedClinicalType}_${(row.tier_position || 'essential').toUpperCase()}`,
    attributes_base: attributesBase,
    attributes_display_base: [],
    active: row.active,
    display_name: row.display_name || row.original_name,
    tier_target: tierMap[row.tier_position?.toLowerCase() || ''] || 'essential',
    tier_confidence: row.confidence === 'explicit' ? 'high' : row.confidence === 'inferred' ? 'medium' : 'low',
    technology_refs: techRefs,
    comparison_tags: row.key_differentiator ? [row.key_differentiator] : [],
  };
}

/**
 * Converts a supplier_prices DB row into engine-compatible Price,
 * merging grade data from catalog_variant_grades.
 */
function convertPriceToLegacy(
  row: SupplierPriceRow,
  gradeMap: Map<string, VariantGradeRow>
): Price {
  // Look up grade for this family+index+lens_state combination
  const gradeKey = `${row.family_id}::${row.material_index}::${row.lens_state}`;
  const grade = gradeMap.get(gradeKey);

  // Build specs from grade data
  const specs: PriceSpec = {
    diameter_min_mm: 0,
    diameter_max_mm: grade?.diameters_mm?.length ? Math.max(...grade.diameters_mm) : 0,
    altura_min_mm: 0,
    altura_max_mm: 0,
    sphere_min: grade?.sphere_min ?? 0,
    sphere_max: grade?.sphere_max ?? 0,
    cyl_min: grade?.cylinder_min ?? 0,
    cyl_max: grade?.cylinder_max ?? 0,
    add_min: grade?.addition_min ?? undefined,
    add_max: grade?.addition_max ?? undefined,
  };

  // Determine manufacturing type from lens_state
  const isPhotochromic = row.lens_state !== 'clear';

  return {
    family_id: row.family_id,
    erp_code: row.id, // Use DB id as ERP code
    description: `${row.supplier_code} ${row.material_index} ${row.treatment_combo?.join(' + ') || ''}`.trim(),
    supplier: row.supplier_code,
    lens_category_raw: '',
    manufacturing_type: '',
    index: row.material_index,
    index_value: parseFloat(row.material_index) || undefined,
    price_purchase_half_pair: 0, // Not exposed
    price_sale_half_pair: row.price_value,
    active: row.active,
    blocked: false,
    specs,
    addons_detected: row.treatment_combo || [],
  };
}
