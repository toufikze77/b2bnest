-- 1) Create trigger so new users automatically get a personal org, membership, profile, etc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 2) Backfill for existing users that don't have a profile
INSERT INTO public.profiles (
  id, email, full_name, display_name,
  currency_code, timezone, country_code, language_code,
  date_format, time_format, is_active
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  'USD','UTC','US','en','MM/DD/YYYY','12h', true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3) Backfill organizations + memberships for users with no active membership
WITH users_without_membership AS (
  SELECT u.id as user_id,
         COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)) AS fname,
         u.email
  FROM auth.users u
  LEFT JOIN public.organization_members om 
    ON om.user_id = u.id AND om.is_active = true
  WHERE om.user_id IS NULL
), created_orgs AS (
  INSERT INTO public.organizations (name, slug, created_by)
  SELECT 
    fname || '''s Organization' AS name,
    lower(replace(fname,' ','-')) || '-org-' || floor(extract(epoch from now()))::text || '-' || substr(user_id::text, 1, 8) AS slug,
    user_id AS created_by
  FROM users_without_membership
  RETURNING id, created_by
)
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT o.id, o.created_by, 'owner', true
FROM created_orgs o
ON CONFLICT DO NOTHING;

-- 4) Safety RPC: ensure current user has an org; may be called from client if needed
CREATE OR REPLACE FUNCTION public.ensure_user_has_org(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  org_id uuid;
  fname text;
BEGIN
  -- If already a member of any org, return it
  SELECT om.organization_id INTO org_id
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.is_active = true
  LIMIT 1;

  IF org_id IS NOT NULL THEN
    RETURN org_id;
  END IF;

  -- Determine a friendly name
  SELECT COALESCE(pr.display_name, pr.full_name, split_part(pr.email,'@',1)) INTO fname
  FROM public.profiles pr
  WHERE pr.id = p_user_id;

  IF fname IS NULL THEN
    SELECT split_part(u.email,'@',1) INTO fname
    FROM auth.users u 
    WHERE u.id = p_user_id;
  END IF;

  -- Create org
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (
    fname || '''s Organization',
    lower(replace(fname,' ','-')) || '-org-' || floor(extract(epoch from now()))::text || '-' || substr(p_user_id::text, 1, 8),
    p_user_id
  ) RETURNING id INTO org_id;

  -- Add membership as owner
  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (org_id, p_user_id, 'owner', true);

  RETURN org_id;
END;
$$;
