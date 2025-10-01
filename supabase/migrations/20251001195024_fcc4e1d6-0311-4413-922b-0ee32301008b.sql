-- Fix: Customer Profile Data Could Be Harvested by Competitors
-- Remove public access to public_profiles view and require authentication

-- 1. Revoke anonymous access to the view
REVOKE SELECT ON public.public_profiles FROM anon;

-- 2. Ensure only authenticated users can view public profiles
GRANT SELECT ON public.public_profiles TO authenticated;

-- 3. Update the view comment to reflect authentication requirement
COMMENT ON VIEW public.public_profiles IS 
'Secure view that exposes safe profile fields (display_name, bio, skills, etc.) to authenticated users only. Anonymous access has been revoked to prevent data harvesting by competitors. Profile owners and admins can view full profile data through direct table access with proper RLS policies.';