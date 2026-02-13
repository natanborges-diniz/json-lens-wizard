
-- Add clinical_eligibility_mode to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS clinical_eligibility_mode text NOT NULL DEFAULT 'permissive';

-- Add check constraint
ALTER TABLE public.company_settings 
ADD CONSTRAINT chk_clinical_eligibility_mode 
CHECK (clinical_eligibility_mode IN ('permissive', 'strict'));
