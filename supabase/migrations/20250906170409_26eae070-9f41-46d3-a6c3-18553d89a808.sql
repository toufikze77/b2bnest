-- Fix infinite recursion in projects RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Create new safe policies using security definer functions
CREATE OR REPLACE FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects p
    WHERE p.id = project_id 
      AND p.user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM projects p
    LEFT JOIN organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_id 
      AND (p.user_id = check_user_id OR (om.user_id = check_user_id AND om.is_active = true))
  );
$$;

-- Create new policies using the functions
CREATE POLICY "Users can view projects they own or are organization members of" 
ON public.projects 
FOR SELECT 
USING (public.user_can_access_project(id));

CREATE POLICY "Users can create their own projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update projects they own" 
ON public.projects 
FOR UPDATE 
USING (public.user_owns_project(id));

CREATE POLICY "Users can delete projects they own" 
ON public.projects 
FOR DELETE 
USING (public.user_owns_project(id));