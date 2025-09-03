-- Fix remaining security definer functions by adding proper search_path
-- This addresses both the security definer view issue and function search path warnings

-- Update the is_safe_profile_field function to have proper search_path
CREATE OR REPLACE FUNCTION public.is_safe_profile_field(field_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'  -- Fixed: set explicit search_path
AS $$
  -- Only allow these safe fields to be publicly visible
  SELECT field_name = ANY(ARRAY[
    'id',
    'display_name', 
    'headline',
    'bio',
    'skills',
    'industry',
    'experience_years',
    'created_at',
    'avatar_url'
  ]);
$$;

-- Also fix other functions that might be missing search_path
-- Update the has_role function to have explicit search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'  -- Fixed: set explicit search_path
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update the is_admin_or_owner function to have explicit search_path
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'  -- Fixed: set explicit search_path
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Update user organization functions to have explicit search_path
CREATE OR REPLACE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'  -- Fixed: set explicit search_path
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members om
    WHERE om.organization_id = org_id 
      AND om.user_id = check_user_id 
      AND om.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'  -- Fixed: set explicit search_path
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