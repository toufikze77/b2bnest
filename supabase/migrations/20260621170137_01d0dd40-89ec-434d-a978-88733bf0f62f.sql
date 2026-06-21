CREATE OR REPLACE FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = check_user_id
      AND om.role = 'owner'
      AND om.is_active = true
  );
$$;

DROP POLICY IF EXISTS "Organization owners can manage all members" ON public.organization_members;

CREATE POLICY "Organization owners can manage all members"
ON public.organization_members
FOR ALL
USING (public.user_is_organization_owner(organization_id))
WITH CHECK (public.user_is_organization_owner(organization_id));