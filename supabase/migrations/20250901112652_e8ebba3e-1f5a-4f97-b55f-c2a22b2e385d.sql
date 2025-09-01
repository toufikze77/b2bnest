-- Fix infinite recursion in organization_members RLS policy
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;

-- Create a corrected policy that doesn't cause infinite recursion
CREATE POLICY "Organization admins can manage members" ON organization_members
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM organization_members om_check 
    WHERE om_check.organization_id = organization_members.organization_id 
    AND om_check.user_id = auth.uid()
    AND om_check.role IN ('owner', 'admin')
    AND om_check.is_active = true
    AND om_check.id != organization_members.id  -- Prevent self-reference
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members om_check 
    WHERE om_check.organization_id = organization_members.organization_id 
    AND om_check.user_id = auth.uid()
    AND om_check.role IN ('owner', 'admin')
    AND om_check.is_active = true
    AND om_check.id != organization_members.id  -- Prevent self-reference
  )
);

-- Also ensure the other policy doesn't cause issues
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

CREATE POLICY "Users can view members of their organizations" ON organization_members
FOR SELECT
USING (
  organization_id IN (
    SELECT om2.organization_id 
    FROM organization_members om2 
    WHERE om2.user_id = auth.uid() 
    AND om2.is_active = true
  )
);