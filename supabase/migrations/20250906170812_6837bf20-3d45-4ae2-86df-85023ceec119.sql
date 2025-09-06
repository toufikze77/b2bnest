-- Fix security definer functions to have proper search path
-- Update user_owns_project function
CREATE OR REPLACE FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.projects p
    WHERE p.id = project_id 
      AND p.user_id = check_user_id
  );
$$;

-- Update user_can_access_project function  
CREATE OR REPLACE FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.projects p
    LEFT JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE p.id = project_id 
      AND (p.user_id = check_user_id OR (om.user_id = check_user_id AND om.is_active = true))
  );
$$;

-- Update other security definer functions to have proper search path
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;