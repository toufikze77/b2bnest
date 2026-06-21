-- Replace the broad admin policy with role-aware variants so admins cannot write role='owner'.
DROP POLICY IF EXISTS "Organization admins can manage all organization data" ON public.organization_members;

-- Owners can do anything (including managing other owners)
CREATE POLICY "Organization owners can manage all members"
ON public.organization_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.is_active = true
  )
);

-- Admins can manage members but cannot create or promote anyone to 'owner'
CREATE POLICY "Organization admins can manage non-owner members"
ON public.organization_members
FOR ALL
USING (
  public.user_is_organization_admin(organization_id)
  AND role <> 'owner'
)
WITH CHECK (
  public.user_is_organization_admin(organization_id)
  AND role <> 'owner'
);