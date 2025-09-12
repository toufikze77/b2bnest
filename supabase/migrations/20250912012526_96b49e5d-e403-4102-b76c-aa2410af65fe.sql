-- Fix linter issue: Security Definer View on public.public_profiles
-- Set view to run with SECURITY INVOKER semantics and ensure safe public access via RLS and column privileges

-- 1) Ensure the view runs with the privileges of the querying user
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- 2) Grant access to the view itself
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3) Restrict direct access to the base table to ONLY safe columns used by the view
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, headline, bio, skills, industry, experience_years, created_at, avatar_url, connection_count)
  ON public.profiles TO anon, authenticated;

-- 4) RLS: Allow selecting public profiles (rows) for everyone (anon and authenticated)
--    This preserves existing behavior while keeping sensitive rows protected
DROP POLICY IF EXISTS "Public can view public profiles" ON public.profiles;
CREATE POLICY "Public can view public profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (is_public = true AND is_active = true);

-- Optional: keep existing policies for users/admins as-is (no changes)

-- 5) Audit (optional): record security change
INSERT INTO security_audit_logs (action, table_name, user_id, ip_address)
VALUES ('security_view_set_invoker', 'profiles/public_profiles', auth.uid(), inet_client_addr());