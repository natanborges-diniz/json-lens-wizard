-- Drop overly permissive policies for customers
DROP POLICY IF EXISTS "Authenticated users can create customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;

-- Create more restrictive policies for customers
-- Only allow creating customers if the user is the one creating
CREATE POLICY "Authenticated users can create customers" ON public.customers
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Only allow updating customers that the user created, or if admin/manager
CREATE POLICY "Users can update their created customers or admin/manager" ON public.customers
  FOR UPDATE TO authenticated 
  USING (auth.uid() = created_by OR public.is_admin_or_manager(auth.uid()));