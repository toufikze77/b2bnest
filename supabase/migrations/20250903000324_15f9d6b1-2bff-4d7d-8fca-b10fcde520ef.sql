-- Fix critical security issue: Restrict public profile access to safe fields only
-- Drop the overly permissive policy that exposes all profile data
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles;

-- Create a function to check if a field should be publicly visible
CREATE OR REPLACE FUNCTION public.is_safe_profile_field(field_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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

-- Create a secure view for public profiles that only exposes safe fields
CREATE OR REPLACE VIEW public.public_profiles AS
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
  -- Don't expose sensitive fields like email, full_name, linkedin_url, twitter_url, location, etc.
  connection_count  -- This is also safe to show
FROM public.profiles 
WHERE is_public = true AND is_active = true;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Create a new restrictive policy for public profile viewing
-- Users can only view limited safe fields of public profiles through the view
CREATE POLICY "Authenticated users can view limited public profile data" 
ON public.profiles 
FOR SELECT 
USING (
  -- Allow users to see their own complete profile
  auth.uid() = id 
  OR
  -- Allow admins/owners to see complete profiles
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
  -- Note: Public profile access now happens through the public_profiles view only
);

-- Update the profiles table to ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add a comment explaining the security model
COMMENT ON VIEW public.public_profiles IS 
'Secure view that only exposes safe, non-sensitive profile fields for public viewing. Sensitive data like emails, social URLs, and location remain private to profile owners and admins only.';