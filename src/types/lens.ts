// Core types for the lens system - based on unified JSON schema v1.1

export interface Scale {
  [key: string]: string;
}

export interface AttributeDef {
  id: string;
  group: string;
  name_common: string;
  scale: string;
}

// Clinical type - official classification per Prompt Canônico V1
export type ClinicalType = 'MONOFOCAL' | 'PROGRESSIVA' | 'OCUPACIONAL' | 'BIFOCAL';

// Process type - manufacturing process
export type ProcessType = 'PRONTA' | 'SURFACADA';

// Legacy lens category type (deprecated - use ClinicalType)
export type LensCategory = ClinicalType;

export interface Macro {
  id: string;
  category: LensCategory;
  name_client: string;
  description_client: string;
}

export interface Family {
  id: string;
  supplier: string;
  name_original: string;
  category: LensCategory; // Legacy field
  clinical_type?: ClinicalType; // New official field per Prompt Canônico V1
  macro: string;
  attributes_base: Record<string, number | boolean>;
  attributes_display_base: string[];
  active: boolean;
}

export interface Addon {
  id: string;
  name_common: string;
  description_client: string;
  impact: Record<string, number>;
  name_commercial: Record<string, string>;
  rules: {
    categories: string[];
    only_if?: string;
  };
  active: boolean;
}

export interface PriceSpec {
  diameter_min_mm: number;
  diameter_max_mm: number;
  altura_min_mm: number;
  altura_max_mm: number;
  sphere_min: number;
  sphere_max: number;
  cyl_min: number;
  cyl_max: number;
  add_min?: number;
  add_max?: number;
}

export interface Price {
  family_id: string;
  erp_code: string;
  description: string;
  supplier: string;
  lens_category_raw: string; // Legacy field
  clinical_type?: ClinicalType; // New official field per Prompt Canônico V1
  manufacturing_type: string; // Legacy field (LS, SF, PRONTA)
  process?: ProcessType; // New official field per Prompt Canônico V1
  index: string;
  index_value?: number; // v3.6.2.2: formal refractive index (1.5, 1.59, 1.6, 1.67, 1.74)
  price_purchase_half_pair: number;
  price_sale_half_pair: number;
  active: boolean;
  blocked: boolean;
  specs: PriceSpec;
  treatments_raw?: Record<string, string>;
  addons_detected?: string[]; // v3.6.2.2: formal addon IDs (ADDON_BLUE, ADDON_AR_PREMIUM, etc.)
  attribute_overrides?: Record<string, number>;
  flags?: Record<string, boolean>;
  // ERP code for internal system integration (visible to seller, hidden from client)
  erp_integration_code?: string;
}

// v3.6.2.2: Family options - what toggles to show per family
export interface FamilyOptions {
  indexes_available: number[];
  addons_available: string[];
}

// v3.6.2.2: Addon library entry
export interface CatalogAddon {
  id: string;
  name?: string;
  name_common?: string;
  label_short?: string;
  description_client?: string;
  group?: string;
  attribute_impacts?: { attribute_id: string; delta: number }[];
  impact?: Record<string, number>;
  name_commercial?: Record<string, string>;
  rules?: { categories: string[]; only_if?: string };
  active: boolean;
}

// Extended macro with display configuration (optional, from JSON)
export interface MacroExtended extends Macro {
  tier_key?: 'essential' | 'comfort' | 'advanced' | 'top';
  display?: {
    icon: string;
    color_class: string;
    bg_header_class: string;
    border_class: string;
    dot_color_class: string;
  };
}

// Extended family with technology references (optional, from JSON)
export interface FamilyExtended extends Family {
  technology_refs?: string[];
  availability_status?: string; // e.g. "SEM_SKU_NO_ERP" for auto-disabled families
  tier_target?: 'essential' | 'comfort' | 'advanced' | 'top'; // Direct tier from catalog
  tier_confidence?: 'high' | 'medium' | 'low'; // Confidence level of tier assignment
  // v3.6.2.2 fields
  display_name?: string;
  display_name_short?: string;
  display_name_long?: string;
  display_subtitle?: string;
  options?: FamilyOptions;
  knowledge_refs?: string[];
  family_name_commercial?: string;
  family_name_erp?: string;
  family_short_name?: string;
  comparison_tags?: string[];
}

// Technology Library types
export interface Technology {
  id: string;
  name_common: string;
  name_commercial?: Record<string, string>;
  description_short: string;
  description_long?: string;
  benefits?: string[];
  icon?: string;
  group?: string; // e.g., "Base", "Digital", "Coating" - used for deduplication
}

export interface TechnologyLibrary {
  items: Record<string, Technology>;
}

// Benefit Rules types
export interface BenefitRule {
  attribute_id: string;
  scale_labels: Record<string, string>;
  priority: number;
}

export interface BenefitRules {
  rules: BenefitRule[];
  priority_order: string[];
}

// Quote Explainer types
export interface QuoteCondition {
  field: string;
  operator: 'equals' | 'in' | 'greater_than' | 'less_than';
  value: string | string[] | number | boolean;
}

export interface QuoteRule {
  id: string;
  conditions: QuoteCondition[];
  template: string;
  priority: number;
}

export interface QuoteExplainer {
  rules: QuoteRule[];
  intro_templates: string[];
  closing_templates: string[];
}

// Index Display type
export interface IndexDisplay {
  value: string;
  name: string;
  description: string;
  aesthetic_score: number;
}

// Main LensData interface - PRESERVES ALL ROOT KEYS
export interface LensData {
  meta: {
    schema_version: string;
    dataset_name: string;
    generated_at: string;
    counts: {
      families: number;
      addons: number;
      skus_prices: number;
    };
    notes: string[];
  };
  scales: Record<string, Scale>;
  attribute_defs: AttributeDef[];
  macros: MacroExtended[];
  families: FamilyExtended[];
  addons: Addon[];
  products_avulsos: any[];
  prices: Price[];
  // Extended catalog fields (MANDATORY for schema v1.2+)
  technology_library?: TechnologyLibrary;
  benefit_rules?: BenefitRules;
  quote_explainer?: QuoteExplainer;
  index_display?: IndexDisplay[];
  benefit_priority_order?: string[];
  // Allow any additional root-level keys
  [key: string]: any;
}

export interface SupplierPriority {
  macroId: string;
  suppliers: string[];
}

export interface Prescription {
  rightSphere: number;
  rightCylinder: number;
  rightAxis: number;
  rightAddition?: number;
  leftSphere: number;
  leftCylinder: number;
  leftAxis: number;
  leftAddition?: number;
}

export interface FrameMeasurements {
  horizontalSize: number;
  verticalSize: number;
  bridge: number;
  dp: number;
  altura?: number;
}

// Anamnesis Types - based on ophthalmologic anamnesis flow
export type PrimaryUse = 'reading' | 'computer' | 'work' | 'driving' | 'outdoor' | 'mixed';
export type ScreenHours = '0-2' | '3-5' | '6-8' | '8+';
export type NightDriving = 'frequent' | 'sometimes' | 'no';
export type VisualComplaint = 'eye_fatigue' | 'headache' | 'near_focus' | 'end_day_fatigue' | 'light_sensitivity' | 'none';
export type OutdoorPreference = 'yes' | 'no';
export type ClearLensPreference = 'yes' | 'no' | 'indifferent';
export type AestheticPriority = 'high' | 'medium' | 'low';

export interface AnamnesisData {
  // Profile
  primaryUse: PrimaryUse;
  screenHours: ScreenHours;
  nightDriving: NightDriving;
  // Visual Complaints
  visualComplaints: VisualComplaint[];
  // Lifestyle
  outdoorTime: OutdoorPreference;
  clearLensPreference: ClearLensPreference;
  aestheticPriority: AestheticPriority;
}

export interface CustomerProfile {
  name: string;
  age?: number;
  occupation?: string;
  anamnesis: AnamnesisData;
}

// Tier mapping based on macro IDs
export type MacroTier = 'BASICO' | 'ENTRADA' | 'CONFORTO' | 'INTER' | 'AVANCADO' | 'TOP';

export const MACRO_TO_TIER: Record<string, 'essential' | 'comfort' | 'advanced' | 'top'> = {
  'PROG_BASICO': 'essential',
  'PROG_CONFORTO': 'comfort',
  'PROG_AVANCADO': 'advanced',
  'PROG_TOP': 'top',
  'MONO_BASICO': 'essential',
  'MONO_ENTRADA': 'comfort',
  'MONO_INTER': 'advanced',
  'MONO_TOP': 'top',
  // Ocupacional macros
  'OC_BASICO': 'essential',
  'OC_CONFORTO': 'comfort',
  'OC_AVANCADO': 'advanced',
};

export type Tier = 'essential' | 'comfort' | 'advanced' | 'top';

export type ImportMode = 'increment' | 'replace';

// Individual addon options for selection
export interface AddonOption {
  id: string;
  type: 'treatment' | 'index' | 'photochromic' | 'polarized';
  name: string;
  description: string;
  priceAdd: number; // Additional price for this addon
  commercialName?: string; // Supplier-specific name
}

// Index options with prices
export interface IndexOption {
  value: string; // "1.50", "1.60", "1.67", "1.74"
  name: string;
  priceAdd: number;
  recommended?: boolean;
}

// Selected configuration for a lens
export interface LensConfiguration {
  familyId: string;
  selectedPriceErpCode: string;
  selectedIndex: string;
  selectedTreatments: string[]; // addon IDs
  basePrice: number;
  totalPrice: number;
}

// Recommendation with selected SKU
export interface LensRecommendation {
  family: Family;
  selectedPrice: Price;
  addonsIncluded: Addon[];
  totalPrice: number;
  tier: Tier;
}

// Budget/Quote types
export interface BudgetItem {
  family: Family;
  price: Price;
  selectedAddons: string[];
  configuration: LensConfiguration;
  finalPrice: number;
}

export interface Budget {
  id: string;
  customerName: string;
  items: BudgetItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  paymentMethod: string;
  secondPair?: {
    enabled: boolean;
    price: number;
    description: string;
  };
  createdAt: Date;
  notes?: string;
}

// Payment methods
export type PaymentMethod = 
  | 'cash' 
  | 'credit_1x' 
  | 'credit_2x' 
  | 'credit_3x' 
  | 'credit_4x' 
  | 'credit_5x' 
  | 'credit_6x'
  | 'credit_10x'
  | 'credit_12x'
  | 'debit' 
  | 'pix' 
  | 'installment';
