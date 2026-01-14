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

export interface Macro {
  id: string;
  category: 'PROGRESSIVA' | 'MONOFOCAL';
  name_client: string;
  description_client: string;
}

export interface Family {
  id: string;
  supplier: string;
  name_original: string;
  category: 'PROGRESSIVA' | 'MONOFOCAL';
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
}

export interface Price {
  family_id: string;
  erp_code: string;
  description: string;
  supplier: string;
  lens_category_raw: string;
  manufacturing_type: string;
  index: string;
  price_purchase_half_pair: number;
  price_sale_half_pair: number;
  active: boolean;
  blocked: boolean;
  specs: PriceSpec;
  treatments_raw?: Record<string, string>;
  addons_detected?: string[];
  attribute_overrides?: Record<string, number>;
  flags?: Record<string, boolean>;
}

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
  macros: Macro[];
  families: Family[];
  addons: Addon[];
  products_avulsos: any[];
  prices: Price[];
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
};

export type Tier = 'essential' | 'comfort' | 'advanced' | 'top';

export type ImportMode = 'increment' | 'replace';

// Recommendation with selected SKU
export interface LensRecommendation {
  family: Family;
  selectedPrice: Price;
  addonsIncluded: Addon[];
  totalPrice: number;
  tier: Tier;
}
