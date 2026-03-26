
-- ============================================
-- BLOCO 1: FUNDAMENTO DE DADOS
-- Camada L1 (Documentos Fonte) + L2 (Estrutura por Fornecedor) + L3 (Canônico)
-- ============================================

-- Enum para confiança dos dados
CREATE TYPE public.data_confidence AS ENUM ('explicit', 'inferred', 'manual', 'ai_extracted');

-- Enum para status de revisão
CREATE TYPE public.data_review_status AS ENUM ('draft', 'reviewed', 'approved', 'rejected');

-- ============================================
-- L1: DOCUMENTOS FONTE (imutáveis, versionados)
-- ============================================

CREATE TABLE public.supplier_source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  document_type text NOT NULL, -- 'price_table', 'technical_sheet', 'catalog', 'brochure'
  file_name text NOT NULL,
  file_url text, -- storage path
  file_hash text, -- SHA256 for dedup
  version_label text, -- e.g. "Abr/2025"
  parsed_at timestamptz,
  parsed_by uuid REFERENCES auth.users(id),
  parse_status text NOT NULL DEFAULT 'pending', -- 'pending', 'parsing', 'parsed', 'error'
  parse_result jsonb, -- structured extraction result
  notes text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage source documents"
  ON public.supplier_source_documents FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view source documents"
  ON public.supplier_source_documents FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- L2: ESTRUTURA POR FORNECEDOR
-- ============================================

-- Famílias por fornecedor (preserva nome original)
CREATE TABLE public.supplier_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  original_name text NOT NULL, -- nome exato do fornecedor
  display_name text, -- nome comercial limpo
  clinical_type text NOT NULL, -- MONOFOCAL, PROGRESSIVA, OCUPACIONAL, BIFOCAL
  commercial_category text, -- entry, standard, premium, luxury
  tier_position text, -- essential, comfort, advanced, top
  description text,
  key_differentiator text, -- frase curta do diferencial principal
  target_audience text, -- perfil de cliente ideal
  value_axes jsonb DEFAULT '{}', -- {comfort:1-5, sharpness:1-5, field_of_view:1-5, digital_protection:1-5, personalization:1-5, durability:1-5}
  technology_ids uuid[] DEFAULT '{}',
  benefit_ids uuid[] DEFAULT '{}',
  material_ids uuid[] DEFAULT '{}',
  treatment_ids uuid[] DEFAULT '{}',
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier families"
  ON public.supplier_families FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier families"
  ON public.supplier_families FOR SELECT
  TO authenticated
  USING (true);

-- Materiais/Índices por fornecedor
CREATE TABLE public.supplier_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  original_name text NOT NULL,
  material_type text NOT NULL, -- 'organic', 'polycarbonate', 'trivex', 'high_index'
  refractive_index numeric, -- 1.50, 1.56, 1.59, 1.60, 1.67, 1.74
  abbe_number numeric,
  density numeric,
  uv_protection_percent numeric,
  thickness_reduction_percent numeric, -- vs 1.50 baseline
  impact_resistance text, -- 'low', 'medium', 'high', 'very_high'
  description text,
  aesthetic_score integer, -- 1-5
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier materials"
  ON public.supplier_materials FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier materials"
  ON public.supplier_materials FOR SELECT
  TO authenticated
  USING (true);

-- Tratamentos por fornecedor
CREATE TABLE public.supplier_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  original_name text NOT NULL,
  treatment_type text NOT NULL, -- 'ar_coating', 'blue_filter', 'photochromic', 'polarized', 'scratch_resistant', 'easy_clean', 'uv_filter'
  display_name text,
  description text,
  key_benefit text, -- benefício principal em 1 frase
  performance_level integer, -- 1-5 dentro da categoria
  blue_light_filter_percent numeric,
  uv_filter_percent numeric,
  scratch_resistance_level integer, -- 1-5
  easy_clean_level integer, -- 1-5
  anti_reflective_level integer, -- 1-5
  photochromic_darkening_percent numeric,
  photochromic_speed text, -- 'slow', 'medium', 'fast', 'very_fast'
  compatible_materials text[], -- material IDs compatíveis
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier treatments"
  ON public.supplier_treatments FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier treatments"
  ON public.supplier_treatments FOR SELECT
  TO authenticated
  USING (true);

-- Tecnologias por fornecedor
CREATE TABLE public.supplier_technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  original_name text NOT NULL,
  display_name text,
  tech_group text, -- 'design', 'surfacing', 'coating', 'digital', 'personalization'
  description_short text,
  description_long text,
  benefits text[],
  icon text, -- lucide icon name
  impact_axes jsonb DEFAULT '{}', -- quais eixos de valor essa tech impacta: {comfort: +1, sharpness: +2}
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_technologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier technologies"
  ON public.supplier_technologies FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier technologies"
  ON public.supplier_technologies FOR SELECT
  TO authenticated
  USING (true);

-- Benefícios explícitos por fornecedor
CREATE TABLE public.supplier_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  original_text text NOT NULL, -- texto exato do fornecedor
  benefit_category text NOT NULL, -- 'visual_comfort', 'adaptation', 'aesthetics', 'durability', 'digital_protection', 'outdoor', 'driving'
  short_argument text, -- argumento comercial curto (1 frase)
  perceived_value text, -- 'high', 'medium', 'low' — o quanto o cliente percebe
  applicable_to text[], -- family IDs onde se aplica
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier benefits"
  ON public.supplier_benefits FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier benefits"
  ON public.supplier_benefits FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- L3: CAMADA CANÔNICA MULTI-FORNECEDOR
-- ============================================

-- Famílias canônicas (agrupamento cross-supplier)
CREATE TABLE public.canonical_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  clinical_type text NOT NULL,
  commercial_tier text NOT NULL, -- essential, comfort, advanced, top
  description text,
  value_axes jsonb DEFAULT '{}', -- eixos de valor normalizados (média ponderada dos suppliers)
  comparable_attributes text[], -- quais atributos são comparáveis neste grupo
  confidence data_confidence NOT NULL DEFAULT 'manual',
  review_status data_review_status NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canonical_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage canonical families"
  ON public.canonical_families FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view canonical families"
  ON public.canonical_families FOR SELECT
  TO authenticated
  USING (true);

-- Materiais canônicos
CREATE TABLE public.canonical_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL, -- e.g. "Índice 1.67"
  refractive_index numeric NOT NULL,
  description text,
  aesthetic_score integer, -- 1-5
  thickness_category text, -- 'standard', 'thin', 'ultra_thin', 'extra_thin'
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canonical_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage canonical materials"
  ON public.canonical_materials FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view canonical materials"
  ON public.canonical_materials FOR SELECT
  TO authenticated
  USING (true);

-- Tratamentos canônicos
CREATE TABLE public.canonical_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL, -- e.g. "Antirreflexo Premium"
  treatment_type text NOT NULL,
  description text,
  performance_level integer, -- 1-5
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canonical_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage canonical treatments"
  ON public.canonical_treatments FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view canonical treatments"
  ON public.canonical_treatments FOR SELECT
  TO authenticated
  USING (true);

-- Equivalências entre fornecedores (links de comparação)
CREATE TABLE public.family_equivalences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_family_id uuid REFERENCES public.canonical_families(id) ON DELETE CASCADE,
  supplier_family_id uuid REFERENCES public.supplier_families(id) ON DELETE CASCADE,
  equivalence_confidence text NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high'
  equivalence_notes text, -- por que são comparáveis
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_family_id, supplier_family_id)
);

ALTER TABLE public.family_equivalences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage equivalences"
  ON public.family_equivalences FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view equivalences"
  ON public.family_equivalences FOR SELECT
  TO authenticated
  USING (true);

-- Equivalências de materiais
CREATE TABLE public.material_equivalences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_material_id uuid REFERENCES public.canonical_materials(id) ON DELETE CASCADE,
  supplier_material_id uuid REFERENCES public.supplier_materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_material_id, supplier_material_id)
);

ALTER TABLE public.material_equivalences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage material equivalences"
  ON public.material_equivalences FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view material equivalences"
  ON public.material_equivalences FOR SELECT
  TO authenticated
  USING (true);

-- Equivalências de tratamentos
CREATE TABLE public.treatment_equivalences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_treatment_id uuid REFERENCES public.canonical_treatments(id) ON DELETE CASCADE,
  supplier_treatment_id uuid REFERENCES public.supplier_treatments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_treatment_id, supplier_treatment_id)
);

ALTER TABLE public.treatment_equivalences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage treatment equivalences"
  ON public.treatment_equivalences FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view treatment equivalences"
  ON public.treatment_equivalences FOR SELECT
  TO authenticated
  USING (true);

-- Bucket para documentos fonte
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-documents', 'supplier-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload supplier documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'supplier-documents' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Authenticated users can view supplier documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'supplier-documents');

CREATE POLICY "Admins can delete supplier documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'supplier-documents' AND is_admin_or_manager(auth.uid()));
