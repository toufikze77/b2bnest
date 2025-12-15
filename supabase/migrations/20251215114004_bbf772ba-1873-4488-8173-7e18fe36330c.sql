-- Add RLS policy allowing organization members to view each other's profiles
-- This maintains multi-tenant security while allowing team collaboration
CREATE POLICY "Organization members can view team profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
    AND om2.user_id = profiles.id
    AND om1.is_active = true
    AND om2.is_active = true
  )
);