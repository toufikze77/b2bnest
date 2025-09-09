-- Fix Security Definer View issue by recreating public_profiles view
-- This ensures the view respects the querying user's RLS policies instead of the creator's

-- Drop the existing view
DROP VIEW IF EXISTS public.public_profiles;

-- Recreate the view without SECURITY DEFINER (default is SECURITY INVOKER)
-- This ensures the view uses the permissions of the querying user, not the view creator
CREATE VIEW public.public_profiles AS
SELECT 
    id,
    display_name,
    headline,
    bio,
    skills,
    industry,
    experience_years,
    created_at,
    avatar_url,
    connection_count
FROM public.profiles
WHERE is_public = true AND is_active = true;

-- Grant appropriate permissions to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;