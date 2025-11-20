-- Fix overly permissive profiles RLS policy
-- Drop policy that allows ANY authenticated user to view ALL profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Add admin-only policy for legitimate administrative access
CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role)
);

-- Note: The following safe policies remain in place:
-- 1. "users_view_own_profile" - Users can view their own complete profile
-- 2. get_user_display_info() function - Returns only safe fields for collaboration
-- 3. public_profiles view - Exposes only: display_name, avatar_url, headline, bio, industry, skills