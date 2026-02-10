-- Phase 1.1: Add store_id to budgets for multi-store support (PLAN 3 §8.2)
ALTER TABLE public.budgets 
ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- Update RLS policies to account for store_id (no behavior change, just future-proofing)
COMMENT ON COLUMN public.budgets.store_id IS 'Optional store reference for multi-store reporting. Nullable for backward compatibility.';