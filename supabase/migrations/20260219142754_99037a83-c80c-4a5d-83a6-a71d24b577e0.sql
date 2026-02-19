
-- Table: supplier_profiles
CREATE TABLE public.supplier_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  family_dictionary jsonb NOT NULL DEFAULT '[]'::jsonb,
  index_parsing jsonb DEFAULT '{"regex": "1\\.\\d{2}"}'::jsonb,
  keywords_photo text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier profiles"
  ON public.supplier_profiles FOR ALL
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can view supplier profiles"
  ON public.supplier_profiles FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

CREATE TRIGGER update_supplier_profiles_updated_at
  BEFORE UPDATE ON public.supplier_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: catalog_sync_runs
CREATE TABLE public.catalog_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL REFERENCES public.supplier_profiles(supplier_code),
  run_type text NOT NULL CHECK (run_type IN ('dry_run', 'apply')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  rows_read integer DEFAULT 0,
  rows_matched integer DEFAULT 0,
  rows_updated integer DEFAULT 0,
  rows_created integer DEFAULT 0,
  rows_not_found integer DEFAULT 0,
  pending_skus_count integer DEFAULT 0,
  report jsonb,
  file_name text,
  executed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage sync runs"
  ON public.catalog_sync_runs FOR ALL
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can view sync runs"
  ON public.catalog_sync_runs FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

-- Table: catalog_pending_skus
CREATE TABLE public.catalog_pending_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES public.catalog_sync_runs(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  erp_code text NOT NULL,
  description text,
  raw_data jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'ignored')),
  resolved_family_id text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_pending_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage pending skus"
  ON public.catalog_pending_skus FOR ALL
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can view pending skus"
  ON public.catalog_pending_skus FOR SELECT
  USING (is_admin_or_manager(auth.uid()));

-- Index for faster lookups
CREATE INDEX idx_pending_skus_status ON public.catalog_pending_skus(supplier_code, status);
CREATE INDEX idx_sync_runs_supplier ON public.catalog_sync_runs(supplier_code, created_at DESC);
