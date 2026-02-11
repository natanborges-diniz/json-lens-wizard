
-- Create recommendation_audit_logs table for persistent engine logging
CREATE TABLE public.recommendation_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  seller_id uuid NOT NULL,
  store_id uuid,
  service_id uuid,
  clinical_type text NOT NULL,
  catalog_version text,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  fallbacks jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_recommendation_id text,
  top_recommendation_name text,
  families_analyzed integer NOT NULL DEFAULT 0,
  families_eligible integer NOT NULL DEFAULT 0,
  execution_time_ms integer
);

-- Enable RLS
ALTER TABLE public.recommendation_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin can see all logs
CREATE POLICY "Admins can view all recommendation logs"
  ON public.recommendation_audit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Managers can view logs for their stores
CREATE POLICY "Managers can view store recommendation logs"
  ON public.recommendation_audit_logs
  FOR SELECT
  USING (
    is_admin_or_manager(auth.uid()) AND (
      store_id IS NULL OR
      user_has_store_access(auth.uid(), store_id)
    )
  );

-- Sellers can view their own logs
CREATE POLICY "Sellers can view own recommendation logs"
  ON public.recommendation_audit_logs
  FOR SELECT
  USING (auth.uid() = seller_id);

-- Authenticated users can insert their own logs
CREATE POLICY "Users can insert own recommendation logs"
  ON public.recommendation_audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Add index for common queries
CREATE INDEX idx_rec_audit_logs_seller ON public.recommendation_audit_logs(seller_id);
CREATE INDEX idx_rec_audit_logs_store ON public.recommendation_audit_logs(store_id);
CREATE INDEX idx_rec_audit_logs_created ON public.recommendation_audit_logs(created_at DESC);
CREATE INDEX idx_rec_audit_logs_clinical ON public.recommendation_audit_logs(clinical_type);
