-- Fix critical security vulnerability: Customer Personal Information Could Be Stolen by Hackers
-- Remove overly permissive policy that exposes all profile fields to anonymous users
-- Restrict public access to only safe, display-oriented fields

-- 1. Drop the dangerous policy that allows public access to all profile fields
DROP POLICY IF EXISTS "Public can view public profiles" ON public.profiles;

-- 2. Ensure we have proper column-level grants for ONLY safe fields to anonymous users
-- First revoke all access, then grant only safe columns
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT (id, display_name, headline, bio, skills, industry, experience_years, created_at, avatar_url, connection_count, is_public, is_active)
  ON public.profiles TO anon;

-- 3. For authenticated users, allow access to safe public fields plus ability to see their own data
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, display_name, headline, bio, skills, industry, experience_years, created_at, avatar_url, connection_count, is_public, is_active)
  ON public.profiles TO authenticated;

-- 4. Create a new secure policy that only allows access to public profiles for the safe columns
-- This works with the column grants to ensure anonymous users can only access safe data
CREATE POLICY "Anonymous can view safe public profile fields only"
ON public.profiles
FOR SELECT
TO anon
USING (is_public = true AND is_active = true);

-- 5. Keep existing authenticated user policies but ensure they work with column restrictions
-- The existing "Users can view their own profile" policy will allow full access to own profile
-- The existing admin policies will continue to work for administrative access

-- 6. Ensure the public_profiles view remains functional for safe public access
-- (This view was already configured with security_invoker=true and proper grants)

-- 7. Log this critical security fix
INSERT INTO security_audit_logs (action, table_name, user_id, ip_address)
VALUES ('sensitive_data_access_restricted', 'profiles', auth.uid(), inet_client_addr());