
-- Tabela 1: supplier_family_map
CREATE TABLE public.supplier_family_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  erp_family_name TEXT NOT NULL,
  catalog_family_id TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'manual' CHECK (rule_type IN ('exact','regex','manual')),
  confidence TEXT NOT NULL DEFAULT 'manual' CHECK (confidence IN ('auto','manual','reviewed')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(supplier, erp_family_name)
);

ALTER TABLE public.supplier_family_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage supplier family map"
  ON public.supplier_family_map FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view supplier family map"
  ON public.supplier_family_map FOR SELECT
  TO authenticated
  USING (true);

-- Tabela 2: catalog_validation_runs
CREATE TABLE public.catalog_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_conflicts INTEGER NOT NULL DEFAULT 0,
  critical_conflicts INTEGER NOT NULL DEFAULT 0,
  warning_conflicts INTEGER NOT NULL DEFAULT 0,
  conflicts_detail JSONB DEFAULT '[]',
  user_id UUID,
  catalog_version_id UUID,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_validation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage validation runs"
  ON public.catalog_validation_runs FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view validation runs"
  ON public.catalog_validation_runs FOR SELECT
  TO authenticated
  USING (true);

-- Trigger de bloqueio absoluto
CREATE OR REPLACE FUNCTION public.validate_publication_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.published = true AND NEW.critical_conflicts > 0 THEN
    RAISE EXCEPTION 'Cannot publish with critical conflicts (found %)', NEW.critical_conflicts;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_publication
  BEFORE INSERT OR UPDATE ON public.catalog_validation_runs
  FOR EACH ROW EXECUTE FUNCTION public.validate_publication_gate();
