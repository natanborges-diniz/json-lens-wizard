
-- Table for external variant grades
CREATE TABLE public.catalog_variant_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  family_id TEXT NOT NULL,
  index TEXT NOT NULL,
  lens_state TEXT NOT NULL DEFAULT 'clear',
  sphere_min NUMERIC,
  sphere_max NUMERIC,
  cylinder_min NUMERIC,
  cylinder_max NUMERIC,
  addition_min NUMERIC,
  addition_max NUMERIC,
  diameters_mm NUMERIC[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT uq_variant_grade UNIQUE (company_id, family_id, index, lens_state)
);

-- Enable RLS
ALTER TABLE public.catalog_variant_grades ENABLE ROW LEVEL SECURITY;

-- Admin/Manager can do everything
CREATE POLICY "Admins and managers can manage grades"
ON public.catalog_variant_grades
FOR ALL
USING (is_admin_or_manager(auth.uid()));

-- Sellers can read
CREATE POLICY "Sellers can view grades"
ON public.catalog_variant_grades
FOR SELECT
USING (true);

-- Timestamp trigger
CREATE TRIGGER update_catalog_variant_grades_updated_at
BEFORE UPDATE ON public.catalog_variant_grades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
