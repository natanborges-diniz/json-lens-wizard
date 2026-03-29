
CREATE TABLE public.supplier_final_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  family_id text NOT NULL,
  erp_code text,
  description text,
  material_index text NOT NULL DEFAULT 'unknown',
  lens_state text NOT NULL DEFAULT 'clear',
  treatment_combo text[] DEFAULT '{}'::text[],
  price_value numeric,
  availability jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sync_run_id uuid,
  source text NOT NULL DEFAULT 'erp-sync',
  confidence text NOT NULL DEFAULT 'explicit',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_code, erp_code)
);

ALTER TABLE public.supplier_final_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage final prices"
  ON public.supplier_final_prices FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Sellers can view final prices"
  ON public.supplier_final_prices FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_final_prices_family ON public.supplier_final_prices (family_id);
CREATE INDEX idx_final_prices_supplier ON public.supplier_final_prices (supplier_code);
CREATE INDEX idx_final_prices_erp ON public.supplier_final_prices (erp_code);
