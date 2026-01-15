-- Create stores table
CREATE TABLE public.stores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    cnpj TEXT,
    whatsapp TEXT,
    instagram TEXT,
    facebook TEXT,
    slogan TEXT,
    footer_text TEXT,
    budget_terms TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stores
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view active stores
CREATE POLICY "Authenticated users can view stores"
ON public.stores
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can manage stores
CREATE POLICY "Admins can manage stores"
ON public.stores
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create user_store_access table for store permissions
CREATE TABLE public.user_store_access (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    has_access_to_all BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, store_id)
);

-- Enable RLS on user_store_access
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;

-- Users can view their own access
CREATE POLICY "Users can view their own store access"
ON public.user_store_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can manage all access
CREATE POLICY "Admins can manage store access"
ON public.user_store_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow public to view logos
CREATE POLICY "Public can view logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'logos');

-- Helper function to check if user has access to a store
CREATE OR REPLACE FUNCTION public.user_has_store_access(_user_id UUID, _store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_store_access
    WHERE user_id = _user_id 
    AND (store_id = _store_id OR has_access_to_all = true)
  ) OR has_role(_user_id, 'admin'::app_role)
$$;

-- Create trigger for updated_at on stores
CREATE TRIGGER update_stores_updated_at
BEFORE UPDATE ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();