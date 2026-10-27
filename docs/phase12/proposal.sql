-- Phase 12: trial fields locked + server truth for "what can this person do" — PREPARED, NOT APPLIED.
-- Target when approved: production gvftvswyrevummbvyhxa, in ONE transaction (this file). Rollback: rollback.sql.
--
-- 1. Closes the trial hole: today the `authenticated` role has TABLE-level INSERT/UPDATE on public.profiles and the
--    policy users_update_own_profile only checks auth.uid() = id, so any signed-in user can run
--    `update profiles set trial_ends_at = '2099-01-01' where id = auth.uid()` from the browser. Table-level INSERT/UPDATE
--    is revoked from `authenticated` and granted back column by column for every column EXCEPT the four trial columns
--    (trial_started_at, trial_ends_at, is_trial_active, trial_expired). SELECT is unchanged. Sign-up is unchanged: the
--    profile is created by handle_new_user() (SECURITY DEFINER, owner postgres) and the column defaults still set a
--    14-day trial. The service role (Edge Functions) keeps full access.
-- 2. public.my_access_state(): one row for the signed-in caller (see the rules on _access_state_for below).
-- Nothing here changes any row. The stale trial flags are tidied by the separate data-step.sql.
BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public.my_access_state()') IS NOT NULL THEN RAISE EXCEPTION 'my_access_state() already exists (applied twice?)'; END IF;
  -- Expected live state (read 2026-10-27): authenticated has table-level INSERT and UPDATE on profiles.
  IF NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE') OR NOT has_table_privilege('authenticated', 'public.profiles', 'INSERT') THEN
    RAISE EXCEPTION 'profiles grants differ from the 2026-10-27 reading; re-read them before applying';
  END IF;
  -- Every profiles column this file grants back must exist, and no unknown column may be left without a grant.
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles') <> 32 THEN
    RAISE EXCEPTION 'profiles has a different number of columns than on 2026-10-27 (32); update the column lists first';
  END IF;
END $$;

-- 1. Lock the trial columns
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
REVOKE INSERT (trial_started_at, trial_ends_at, is_trial_active, trial_expired),
       UPDATE (trial_started_at, trial_ends_at, is_trial_active, trial_expired) ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (id, email, full_name, avatar_url, created_at, updated_at, headline, location, industry, experience_years, company, position,
              bio, skills, website, linkedin_url, twitter_url, is_public, connection_count, currency_code, timezone, country_code,
              language_code, date_format, time_format, display_name, is_active, theme) ON public.profiles TO authenticated;
GRANT UPDATE (id, email, full_name, avatar_url, created_at, updated_at, headline, location, industry, experience_years, company, position,
              bio, skills, website, linkedin_url, twitter_url, is_public, connection_count, currency_code, timezone, country_code,
              language_code, date_format, time_format, display_name, is_active, theme) ON public.profiles TO authenticated;

-- 2. Access state
-- Subscription statuses that keep paid access (same list as stripe-webhook / check-subscription ENTITLED_STATUSES).
-- A row written before subscription_status existed counts only if it is marked subscribed and has no status.
CREATE FUNCTION public._access_entitled(_status text, _subscribed boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN _status IS NULL THEN coalesce(_subscribed, false)
              ELSE _status IN ('active','trialing','past_due','unpaid') END $$;

-- Rules, in order:
--   owner       platform role super_admin, admin or owner in public.user_roles (only super admins can grant roles,
--               and never super_admin or to themselves). Covers the two owner accounts (both have `admin`).
--   subscribed  an entitled subscription of the caller (via 'self') or of the billing owner of any company where the
--               caller is an active member (via 'company').
--   trial       the caller's own trial, or a billing owner's trial, is still running: trial_ends_at > now(), computed
--               from the timestamp, never from is_trial_active / trial_expired.
--   trial_ended otherwise. via = 'company' when the caller is an active member of a company billed by someone else
--               (they see "ask the account owner", no payment buttons), else 'self'.
-- days_left = whole days left, rounded up, never negative.
CREATE FUNCTION public._access_state_for(_uid uuid)
RETURNS TABLE(state text, trial_ends_at timestamptz, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  _own_end timestamptz; _co_end timestamptz; _plan text; _status text; _via text; _name text; _member_elsewhere boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  SELECT p.trial_ends_at INTO _own_end FROM public.profiles p WHERE p.id = _uid;

  -- Companies where the caller is an active member and someone else is the billing owner
  SELECT EXISTS (SELECT 1 FROM public.organization_members m JOIN public.organization_billing b ON b.organization_id = m.organization_id
                  WHERE m.user_id = _uid AND m.is_active AND b.billing_user_id <> _uid) INTO _member_elsewhere;
  SELECT coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.full_name), '')) INTO _name
    FROM public.organization_members m JOIN public.organization_billing b ON b.organization_id = m.organization_id
    JOIN public.profiles p ON p.id = b.billing_user_id
   WHERE m.user_id = _uid AND m.is_active AND b.billing_user_id <> _uid
   ORDER BY m.joined_at NULLS LAST LIMIT 1;

  IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('super_admin','admin','owner')) THEN
    RETURN QUERY SELECT 'owner'::text, _own_end, greatest(0, ceil(extract(epoch FROM (_own_end - now())) / 86400))::int, NULL::text, NULL::text, 'self'::text, NULL::text;
    RETURN;
  END IF;

  SELECT s.plan_key, s.subscription_status INTO _plan, _status FROM public.subscribers s
   WHERE s.user_id = _uid AND public._access_entitled(s.subscription_status, s.subscribed)
   ORDER BY s.updated_at DESC NULLS LAST LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 'subscribed'::text, _own_end, 0, _plan, _status, 'self'::text, NULL::text;
    RETURN;
  END IF;

  SELECT s.plan_key, s.subscription_status INTO _plan, _status
    FROM public.organization_members m JOIN public.organization_billing b ON b.organization_id = m.organization_id
    JOIN public.subscribers s ON s.user_id = b.billing_user_id
   WHERE m.user_id = _uid AND m.is_active AND b.billing_user_id <> _uid AND public._access_entitled(s.subscription_status, s.subscribed)
   ORDER BY s.updated_at DESC NULLS LAST LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 'subscribed'::text, _own_end, 0, _plan, _status, 'company'::text, _name;
    RETURN;
  END IF;

  SELECT max(p.trial_ends_at) INTO _co_end
    FROM public.organization_members m JOIN public.organization_billing b ON b.organization_id = m.organization_id
    JOIN public.profiles p ON p.id = b.billing_user_id
   WHERE m.user_id = _uid AND m.is_active AND b.billing_user_id <> _uid;

  IF _own_end > now() AND (_co_end IS NULL OR _own_end >= _co_end) THEN
    RETURN QUERY SELECT 'trial'::text, _own_end, greatest(0, ceil(extract(epoch FROM (_own_end - now())) / 86400))::int, NULL::text, NULL::text, 'self'::text, NULL::text;
  ELSIF _co_end > now() THEN
    RETURN QUERY SELECT 'trial'::text, _co_end, greatest(0, ceil(extract(epoch FROM (_co_end - now())) / 86400))::int, NULL::text, NULL::text, 'company'::text, _name;
  ELSE
    _via := CASE WHEN _member_elsewhere THEN 'company' ELSE 'self' END;
    RETURN QUERY SELECT 'trial_ended'::text, coalesce(CASE WHEN _via = 'company' THEN _co_end END, _own_end), 0, NULL::text, NULL::text, _via,
                        CASE WHEN _via = 'company' THEN _name END;
  END IF;
END $function$;

-- The caller's own access state. The app and the money-spending Edge Functions call this with the user's JWT.
CREATE FUNCTION public.my_access_state()
RETURNS TABLE(state text, trial_ends_at timestamptz, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required' USING errcode = '42501'; END IF;
  RETURN QUERY SELECT * FROM public._access_state_for(auth.uid());
END $function$;

REVOKE ALL ON FUNCTION public._access_entitled(text, boolean), public._access_state_for(uuid), public.my_access_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_access_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._access_state_for(uuid), public._access_entitled(text, boolean) TO service_role;

COMMIT;
