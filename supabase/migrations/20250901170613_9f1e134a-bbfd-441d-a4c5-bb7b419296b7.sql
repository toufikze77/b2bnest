-- Fix infinite recursion in organization_members policies
-- First, create a security definer function to safely check organization membership

CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_organization_admin(org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.role IN ('owner', 'admin')
      AND om.is_active = true
  );
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Organization admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

-- Create new policies using security definer functions
CREATE POLICY "Users can view organization members" 
ON organization_members FOR SELECT 
USING (public.user_is_organization_member(organization_id));

CREATE POLICY "Organization admins can manage all organization data" 
ON organization_members FOR ALL 
USING (public.user_is_organization_admin(organization_id))
WITH CHECK (public.user_is_organization_admin(organization_id));

-- Also fix todos and projects policies to use the same pattern
DROP POLICY IF EXISTS "Organization members can view todos" ON todos;
DROP POLICY IF EXISTS "Organization members can manage todos" ON todos;

CREATE POLICY "Organization members can view todos" 
ON todos FOR SELECT 
USING (public.user_is_organization_member(organization_id));

CREATE POLICY "Organization members can manage todos" 
ON todos FOR ALL 
USING (public.user_is_organization_member(organization_id))
WITH CHECK (public.user_is_organization_member(organization_id));

-- Fix projects policies
DROP POLICY IF EXISTS "Organization members can view projects" ON projects;
DROP POLICY IF EXISTS "Organization members can manage projects" ON projects;

CREATE POLICY "Organization members can view projects" 
ON projects FOR SELECT 
USING (public.user_is_organization_member(organization_id));

CREATE POLICY "Organization members can manage projects" 
ON projects FOR ALL 
USING (public.user_is_organization_member(organization_id))
WITH CHECK (public.user_is_organization_member(organization_id));

-- Clean up duplicate organizations (keep the one with data)
DELETE FROM organizations 
WHERE created_by = '3eac00c6-b29d-4dff-aef6-d9b1159e5c17' 
  AND id NOT IN (
    SELECT DISTINCT organization_id 
    FROM todos 
    WHERE organization_id IS NOT NULL 
      AND user_id = '3eac00c6-b29d-4dff-aef6-d9b1159e5c17'
  );