-- Fix the security definer view warning by removing SECURITY DEFINER
-- and ensuring the view works properly without it

-- Drop and recreate the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_profiles;

-- Create the view without SECURITY DEFINER (this is safer)
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

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Also grant to anon users (read-only access to public profile data is safe)
GRANT SELECT ON public.public_profiles TO anon;

-- Add RLS to the view itself for extra security
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Update comment to reflect the security model
COMMENT ON VIEW public.public_profiles IS 
'Secure view that only exposes safe, non-sensitive profile fields for public viewing. Sensitive data like emails, social URLs, and location remain private to profile owners and admins only. This view has security barriers enabled.';