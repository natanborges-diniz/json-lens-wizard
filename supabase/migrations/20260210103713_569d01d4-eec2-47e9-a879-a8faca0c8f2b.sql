
-- Fix 1: Restrict profiles - users see own profile, admins/managers see all
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_admin_or_manager(auth.uid())
);

-- Fix 2: Restrict customers - only creator or admin/manager can see
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

CREATE POLICY "Users can view own customers or admin access"
ON public.customers
FOR SELECT
USING (
  auth.uid() = created_by
  OR public.is_admin_or_manager(auth.uid())
);

-- Fix 3: Restrict catalog_versions to admin/manager only
DROP POLICY IF EXISTS "Users can view catalog versions" ON public.catalog_versions;

CREATE POLICY "Admins and managers can view catalog versions"
ON public.catalog_versions
FOR SELECT
USING (
  public.is_admin_or_manager(auth.uid())
);
