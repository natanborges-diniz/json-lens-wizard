CREATE TABLE public.supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code text NOT NULL,
  family_id uuid REFERENCES public.supplier_families(id) ON DELETE CASCADE,
  material_index text NOT NULL,
  treatment_combo text[] DEFAULT '{}',
  lens_state text NOT NULL DEFAULT 'clear',
  price_value numeric NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source_document_id uuid REFERENCES public.supplier_source_documents(id),
  confidence data_confidence NOT NULL DEFAULT 'manual',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and managers can manage supplier prices" ON public.supplier_prices FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Sellers can view supplier prices" ON public.supplier_prices FOR SELECT TO authenticated USING (true);
CREATE TRIGGER update_supplier_prices_updated_at BEFORE UPDATE ON public.supplier_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();