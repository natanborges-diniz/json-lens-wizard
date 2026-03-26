/**
 * Tipos para a arquitetura em camadas de fornecedores
 * L1: Documentos Fonte | L2: Estrutura por Fornecedor | L3: Canônico Multi-Fornecedor
 */

// ============================================
// ENUMS
// ============================================

export type DataConfidence = 'explicit' | 'inferred' | 'manual' | 'ai_extracted';
export type DataReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';
export type DocumentType = 'price_table' | 'technical_sheet' | 'catalog' | 'brochure';
export type ParseStatus = 'pending' | 'parsing' | 'parsed' | 'error';

export type ClinicalCategory = 'MONOFOCAL' | 'PROGRESSIVA' | 'OCUPACIONAL' | 'BIFOCAL';
export type CommercialCategory = 'entry' | 'standard' | 'premium' | 'luxury';
export type TierPosition = 'essential' | 'comfort' | 'advanced' | 'top';

export type TreatmentType =
  | 'ar_coating'
  | 'blue_filter'
  | 'photochromic'
  | 'polarized'
  | 'scratch_resistant'
  | 'easy_clean'
  | 'uv_filter';

export type MaterialType = 'organic' | 'polycarbonate' | 'trivex' | 'high_index';
export type TechGroup = 'design' | 'surfacing' | 'coating' | 'digital' | 'personalization';
export type BenefitCategory =
  | 'visual_comfort'
  | 'adaptation'
  | 'aesthetics'
  | 'durability'
  | 'digital_protection'
  | 'outdoor'
  | 'driving';

export type EquivalenceConfidence = 'low' | 'medium' | 'high';

// ============================================
// EIXOS DE VALOR (central para comparação)
// ============================================

export interface ValueAxes {
  comfort: number;           // 1-5: Conforto visual
  sharpness: number;         // 1-5: Nitidez
  field_of_view: number;     // 1-5: Campo de visão
  digital_protection: number; // 1-5: Proteção digital
  personalization: number;   // 1-5: Personalização
  durability: number;        // 1-5: Durabilidade/resistência
}

export const VALUE_AXES_LABELS: Record<keyof ValueAxes, string> = {
  comfort: 'Conforto Visual',
  sharpness: 'Nitidez',
  field_of_view: 'Campo de Visão',
  digital_protection: 'Proteção Digital',
  personalization: 'Personalização',
  durability: 'Durabilidade',
};

export const VALUE_AXES_ICONS: Record<keyof ValueAxes, string> = {
  comfort: 'Eye',
  sharpness: 'Focus',
  field_of_view: 'Maximize2',
  digital_protection: 'Monitor',
  personalization: 'UserCog',
  durability: 'Shield',
};

// ============================================
// L1: DOCUMENTOS FONTE
// ============================================

export interface SupplierSourceDocument {
  id: string;
  supplier_code: string;
  document_type: DocumentType;
  file_name: string;
  file_url: string | null;
  file_hash: string | null;
  version_label: string | null;
  parsed_at: string | null;
  parsed_by: string | null;
  parse_status: ParseStatus;
  parse_result: Record<string, unknown> | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// L2: ESTRUTURA POR FORNECEDOR
// ============================================

export interface SupplierFamily {
  id: string;
  supplier_code: string;
  original_name: string;
  display_name: string | null;
  clinical_type: ClinicalCategory;
  commercial_category: CommercialCategory | null;
  tier_position: TierPosition | null;
  description: string | null;
  key_differentiator: string | null;
  target_audience: string | null;
  value_axes: Partial<ValueAxes>;
  technology_ids: string[];
  benefit_ids: string[];
  material_ids: string[];
  treatment_ids: string[];
  source_document_id: string | null;
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierMaterial {
  id: string;
  supplier_code: string;
  original_name: string;
  material_type: MaterialType;
  refractive_index: number | null;
  abbe_number: number | null;
  density: number | null;
  uv_protection_percent: number | null;
  thickness_reduction_percent: number | null;
  impact_resistance: string | null;
  description: string | null;
  aesthetic_score: number | null;
  source_document_id: string | null;
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierTreatment {
  id: string;
  supplier_code: string;
  original_name: string;
  treatment_type: TreatmentType;
  display_name: string | null;
  description: string | null;
  key_benefit: string | null;
  performance_level: number | null;
  blue_light_filter_percent: number | null;
  uv_filter_percent: number | null;
  scratch_resistance_level: number | null;
  easy_clean_level: number | null;
  anti_reflective_level: number | null;
  photochromic_darkening_percent: number | null;
  photochromic_speed: string | null;
  compatible_materials: string[];
  source_document_id: string | null;
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierTechnology {
  id: string;
  supplier_code: string;
  original_name: string;
  display_name: string | null;
  tech_group: TechGroup | null;
  description_short: string | null;
  description_long: string | null;
  benefits: string[];
  icon: string | null;
  impact_axes: Partial<ValueAxes>;
  source_document_id: string | null;
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierBenefit {
  id: string;
  supplier_code: string;
  original_text: string;
  benefit_category: BenefitCategory;
  short_argument: string | null;
  perceived_value: string | null;
  applicable_to: string[];
  source_document_id: string | null;
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// L3: CANÔNICO MULTI-FORNECEDOR
// ============================================

export interface CanonicalFamily {
  id: string;
  canonical_name: string;
  clinical_type: ClinicalCategory;
  commercial_tier: TierPosition;
  description: string | null;
  value_axes: Partial<ValueAxes>;
  comparable_attributes: string[];
  confidence: DataConfidence;
  review_status: DataReviewStatus;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CanonicalMaterial {
  id: string;
  canonical_name: string;
  refractive_index: number;
  description: string | null;
  aesthetic_score: number | null;
  thickness_category: string | null;
  active: boolean;
  created_at: string;
}

export interface CanonicalTreatment {
  id: string;
  canonical_name: string;
  treatment_type: TreatmentType;
  description: string | null;
  performance_level: number | null;
  active: boolean;
  created_at: string;
}

// ============================================
// EQUIVALÊNCIAS
// ============================================

export interface FamilyEquivalence {
  id: string;
  canonical_family_id: string;
  supplier_family_id: string;
  equivalence_confidence: EquivalenceConfidence;
  equivalence_notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================
// VIEWS COMPOSTAS (para a interface)
// ============================================

/** Família do fornecedor com tecnologias e benefícios resolvidos */
export interface SupplierFamilyWithDetails extends SupplierFamily {
  technologies?: SupplierTechnology[];
  treatments?: SupplierTreatment[];
  materials?: SupplierMaterial[];
  benefits?: SupplierBenefit[];
}

/** Grupo de comparação: famílias equivalentes de diferentes fornecedores */
export interface ComparisonGroup {
  canonical: CanonicalFamily;
  suppliers: Record<string, SupplierFamilyWithDetails>; // keyed by supplier_code
}

/** Constantes de fornecedores suportados */
export const SUPPORTED_SUPPLIERS = [
  { code: 'ESSILOR', name: 'Essilor', color: '#1B3A5C' },
  { code: 'HOYA', name: 'Hoya', color: '#C41E3A' },
  { code: 'ZEISS', name: 'ZEISS', color: '#00205B' },
] as const;

export type SupplierCode = typeof SUPPORTED_SUPPLIERS[number]['code'];
