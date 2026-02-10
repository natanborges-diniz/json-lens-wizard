
-- Add supplier_priorities column to company_settings
-- Stores an ordered array of supplier names for recommendation prioritization
-- Format: ["ZEISS", "Essilor", "HOYA"] where position = priority (first = highest)
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS supplier_priorities jsonb DEFAULT '[]'::jsonb;

-- Add a comment for documentation
COMMENT ON COLUMN public.company_settings.supplier_priorities IS 'Ordered array of supplier names for recommendation prioritization. First = highest priority.';
