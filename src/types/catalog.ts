// Catalog types - Extended schema for dynamic UI rendering
// All display text comes from JSON, no hardcoded strings in views

// Technology Library - Centralized technology definitions
export interface Technology {
  id: string;
  name_common: string;
  name_commercial: Record<string, string>; // Per supplier
  description_short: string;
  description_long: string;
  benefits: string[];
  icon?: string;
}

export interface TechnologyLibrary {
  items: Record<string, Technology>;
}

// Benefit Rules - Maps attribute values to human-readable labels
export interface BenefitRule {
  attribute_id: string;
  scale_labels: Record<string, string>; // "0" -> "Básico", "1" -> "Leve", etc.
  priority: number; // For ordering in comparisons
}

export interface BenefitRules {
  rules: BenefitRule[];
  priority_order: string[]; // Attribute IDs in display order
}

// Quote Explainer - Rules for generating explanatory text based on anamnesis
export interface QuoteRule {
  id: string;
  conditions: QuoteCondition[];
  template: string; // Template with placeholders like {product_name}
  priority: number;
}

export interface QuoteCondition {
  field: string; // e.g., "screenHours", "nightDriving"
  operator: 'equals' | 'in' | 'greater_than' | 'less_than';
  value: string | string[] | number;
}

export interface QuoteExplainer {
  rules: QuoteRule[];
  intro_templates: string[];
  closing_templates: string[];
}

// Extended Macro with display configuration
export interface MacroDisplay {
  id: string;
  category: 'PROGRESSIVA' | 'MONOFOCAL';
  name_client: string;
  alias_client?: string;
  description_client: string;
  tier_key: 'essential' | 'comfort' | 'advanced' | 'top';
  display: {
    icon: string;
    color_class: string;
    bg_header_class: string;
    border_class: string;
    dot_color_class: string;
  };
}

// Extended Family with technology references
export interface FamilyExtended {
  id: string;
  supplier: string;
  name_original: string;
  category: 'PROGRESSIVA' | 'MONOFOCAL';
  macro: string;
  attributes_base: Record<string, number | boolean>;
  attributes_display_base: string[];
  technology_refs?: string[]; // References to technology_library items
  active: boolean;
}

// Index display configuration from JSON
export interface IndexDisplay {
  value: string;
  name: string;
  description: string;
  aesthetic_score: number;
}

// Complete extended lens data schema
export interface LensDataExtended {
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
  scales: Record<string, Record<string, string>>;
  attribute_defs: Array<{
    id: string;
    group: string;
    name_common: string;
    scale: string;
  }>;
  macros: MacroDisplay[];
  families: FamilyExtended[];
  addons: Array<{
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
  }>;
  products_avulsos: any[];
  prices: any[];
  // New extended fields
  technology_library?: TechnologyLibrary;
  benefit_rules?: BenefitRules;
  quote_explainer?: QuoteExplainer;
  index_display?: IndexDisplay[];
}

// Resolved display data for a family
export interface ResolvedFamilyDisplay {
  family: FamilyExtended;
  macro: MacroDisplay;
  technologies: Technology[];
  attributeLabels: Array<{
    id: string;
    name: string;
    value: number;
    label: string;
    stars: number;
  }>;
  tierConfig: {
    label: string;
    icon: string;
    colorClass: string;
    bgHeaderClass: string;
    borderClass: string;
    dotColorClass: string;
    selectedBorderClass: string;
  };
}

// Catalog events for cache invalidation
export type CatalogEventType = 'data_loaded' | 'schema_updated' | 'catalog_updated';

export interface CatalogEvent {
  type: CatalogEventType;
  timestamp: number;
  payload?: any;
}
