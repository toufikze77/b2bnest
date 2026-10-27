-- Phase 12 test fixture: live shapes read from production gvftvswyrevummbvyhxa on 2026-10-27 (read-only). Loaded by
-- run-test.sh on top of the support + onboarding harness fixtures. Definitions below are verbatim from pg_get_functiondef;
-- the profiles columns, defaults, grants, column grants and policies mirror live. Never run this on production.
-- Columns the live sign-up trigger writes that the older harness tables don't have
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true, ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'role','') $$;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('owner','admin','moderator','user','manager','super_admin');
CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, role public.app_role DEFAULT 'user'::public.app_role,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_roles TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  )
$function$;
CREATE POLICY "Super admins can insert customer roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND (role <> 'super_admin'::public.app_role) AND (user_id <> auth.uid()));
CREATE POLICY "Super admins can update customer roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND (role <> 'super_admin'::public.app_role) AND (user_id <> auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()) AND (role <> 'super_admin'::public.app_role) AND (user_id <> auth.uid()));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.assert_self(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- server/service paths keep working
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return;
  end if;
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Access denied' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- profiles: live columns and defaults (2026-10-27)
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text, full_name text, avatar_url text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), headline text, location text, industry text,
  experience_years integer, company text, position text, bio text, skills text[], website text, linkedin_url text, twitter_url text,
  is_public boolean DEFAULT true, connection_count integer DEFAULT 0, currency_code text DEFAULT 'USD', timezone text DEFAULT 'UTC',
  country_code text DEFAULT 'US', language_code text DEFAULT 'en', date_format text DEFAULT 'MM/DD/YYYY', time_format text DEFAULT '12h',
  trial_started_at timestamptz DEFAULT now(), trial_ends_at timestamptz DEFAULT (now() + '14 days'::interval),
  is_trial_active boolean DEFAULT true, trial_expired boolean DEFAULT false, display_name text, is_active boolean DEFAULT true,
  theme text DEFAULT 'light');
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER handle_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
-- Live ACL: {postgres=arwdDxtm, service_role=arwdDxtm, authenticated=arw}; column SELECT for anon/authenticated on public columns.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT INSERT, SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT (id, avatar_url, created_at, headline, industry, experience_years, bio, skills, is_public, connection_count, display_name, is_active)
  ON public.profiles TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.users_share_organization(_a uuid, _b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m1
    JOIN public.organization_members m2
      ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = _a AND m2.user_id = _b
      AND COALESCE(m1.is_active, true) AND COALESCE(m2.is_active, true)
  );
$function$;
CREATE POLICY "Members can view profiles in their organizations" ON public.profiles FOR SELECT USING (public.users_share_organization(auth.uid(), id));
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_insert_own_profile ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update_own_profile ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY users_view_own_profile ON public.profiles FOR SELECT USING (auth.uid() = id);

-- Live check_trial_status (flips the flags lazily, only when called)
CREATE OR REPLACE FUNCTION public.check_trial_status(user_id_param uuid)
 RETURNS TABLE(is_trial_active boolean, trial_expired boolean, days_remaining integer, trial_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  profile_record record;
  days_left integer;
begin
  perform public.assert_self(user_id_param);

  select * into profile_record from public.profiles where id = user_id_param;
  if not found then
    return;
  end if;

  days_left := extract(day from (profile_record.trial_ends_at - now()));

  if now() > profile_record.trial_ends_at and profile_record.is_trial_active then
    update public.profiles set is_trial_active = false, trial_expired = true where id = user_id_param;
    profile_record.is_trial_active := false;
    profile_record.trial_expired := true;
  end if;

  return query select
    profile_record.is_trial_active,
    profile_record.trial_expired,
    greatest(0, days_left),
    profile_record.trial_ends_at;
end;
$function$;
REVOKE ALL ON FUNCTION public.check_trial_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_trial_status(uuid) TO authenticated, service_role;

-- subscribers: the live columns the access rules read
ALTER TABLE public.subscribers ADD COLUMN subscription_status text, ADD COLUMN stripe_price_id text, ADD COLUMN subscription_tier text,
  ADD COLUMN billing_interval text, ADD COLUMN updated_at timestamptz DEFAULT now();

-- Live sign-up trigger (handle_new_user, verbatim) on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  new_org_id uuid;
  user_display_name text;
BEGIN
  -- Determine display name
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Create profile for new user
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    display_name,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', user_display_name),
    user_display_name,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name, EXCLUDED.email),
    updated_at = NOW();

  -- Create organization if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE user_id = NEW.id
  ) THEN
    INSERT INTO public.organizations (
      name,
      slug,
      created_by,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      user_display_name || '''s Organization',
      'org-' || SUBSTRING(NEW.id::text, 1, 8),
      NEW.id,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_org_id;

    -- Add user as admin
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role,
      is_active,
      joined_at,
      created_at,
      updated_at
    )
    VALUES (
      new_org_id,
      NEW.id,
      'admin',
      true,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
