-- Create catalog_versions table for tracking import history
CREATE TABLE public.catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  dataset_name TEXT,
  import_mode TEXT NOT NULL CHECK (import_mode IN ('increment', 'replace')),
  imported_by UUID REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Statistics
  families_count INTEGER DEFAULT 0,
  prices_count INTEGER DEFAULT 0,
  addons_count INTEGER DEFAULT 0,
  technologies_count INTEGER DEFAULT 0,
  
  -- Details
  changes_summary JSONB,
  notes TEXT[],
  file_size_bytes BIGINT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.catalog_versions ENABLE ROW LEVEL SECURITY;

-- Users can view all catalog versions
CREATE POLICY "Users can view catalog versions"
  ON public.catalog_versions FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert catalog versions (their own)
CREATE POLICY "Users can insert catalog versions"
  ON public.catalog_versions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = imported_by);

-- Index for faster queries
CREATE INDEX idx_catalog_versions_imported_at ON public.catalog_versions(imported_at DESC);