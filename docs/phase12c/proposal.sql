-- Phase 12c: Suspend really blocks an account — PREPARED, NOT APPLIED.
-- Target when approved: production gvftvswyrevummbvyhxa, in ONE transaction (this file), after Phase 12 and 12b (live).
-- Run precheck.sql first (read-only). Rollback: rollback.sql. Then deploy admin-set-user-ban, then the frontend.
--
-- Before: Admin → Users → Suspend only set profiles.is_active = false. Nothing read the flag: a suspended person could
-- still sign in and use everything, and (through the column grant Phase 12 left) switch themselves back to Active.
-- This file:
-- 1. Locks the flag: no INSERT / UPDATE on profiles.is_active for PUBLIC, anon or authenticated. Every other column
--    grant stays exactly as Phase 12 left it. Sign-up (handle_new_user, SECURITY DEFINER) still sets is_active = true.
-- 2. public._suspension_protected(uuid): super admins, admin/owner-role users and master accounts. service_role only.
-- 3. public.admin_set_user_status(uuid, boolean): same signature, same behaviour (super admins only, never your own
--    account, audit row via admin_log_action, returns true), plus: refuses to suspend a super admin, an admin/owner-role
--    user or a master account, and refuses a missing user. Now SET search_path = '' (live: 'public'; every name in the
--    body is schema-qualified). Grants unchanged: authenticated and service_role.
-- 4. public._access_state_for(uuid): the live 12b body plus ONE rule, first after the null check: a suspended,
--    unprotected account gets state 'suspended'. my_access_state() is unchanged (state is text).
BEGIN;

DO $$ BEGIN
  IF to_regprocedure('public._suspension_protected(uuid)') IS NOT NULL THEN RAISE EXCEPTION '_suspension_protected already exists (applied twice?)'; END IF;
  IF to_regclass('public.master_access') IS NULL THEN RAISE EXCEPTION 'Phase 12b (master_access) is not applied'; END IF;
  -- Live bodies (md5 of prosrc, read 2026-10-28 on Postgres 17; prosrc is the same text on every version).
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) IS DISTINCT FROM '07c21748745fb10e84459577f5c3129b' THEN
    RAISE EXCEPTION '_access_state_for differs from the 12b version read on 2026-10-28; re-read it before applying';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_user_status(uuid,boolean)'::regprocedure) IS DISTINCT FROM '1877bf0d05437954004bbc6ab8d57ce3' THEN
    RAISE EXCEPTION 'admin_set_user_status differs from the version read on 2026-10-28; re-read it before applying';
  END IF;
  IF to_regprocedure('public.admin_log_action(text,text,text,jsonb,text)') IS NULL OR to_regprocedure('public.is_super_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'admin_log_action() or is_super_admin() missing';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE') THEN
    RAISE EXCEPTION 'profiles.is_active grants differ from the 2026-10-28 reading (authenticated=arw); re-read them first';
  END IF;
END $$;

-- 1. Lock the flag (column level; Phase 12 left authenticated with column-level INSERT/UPDATE grants only)
REVOKE INSERT (is_active), UPDATE (is_active) ON public.profiles FROM PUBLIC, anon, authenticated;

-- 2. Who can never be suspended
CREATE FUNCTION public._suspension_protected(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('super_admin','admin','owner'))
      OR EXISTS (SELECT 1 FROM public.master_access m WHERE m.user_id = _uid) $function$;
REVOKE ALL ON FUNCTION public._suspension_protected(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._suspension_protected(uuid) TO service_role;

-- 3. Suspend / reactivate (super admins only)
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT public.is_super_admin(_caller) THEN RAISE EXCEPTION 'Not authorized' USING errcode = '42501'; END IF;
  IF _user_id IS NULL OR _active IS NULL THEN RAISE EXCEPTION 'user and active are required' USING errcode = '22004'; END IF;
  IF _user_id = _caller THEN RAISE EXCEPTION 'You cannot change your own status' USING errcode = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id) THEN RAISE EXCEPTION 'no such user' USING errcode = 'P0002'; END IF;
  IF NOT _active THEN
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role::text = 'super_admin') THEN
      RAISE EXCEPTION 'cannot_suspend_super_admin: a super admin can''t be suspended' USING errcode = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role::text IN ('admin','owner')) THEN
      RAISE EXCEPTION 'cannot_suspend_admin: remove the admin role first' USING errcode = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.master_access m WHERE m.user_id = _user_id) THEN
      RAISE EXCEPTION 'cannot_suspend_master: switch off unlimited access first' USING errcode = 'P0001';
    END IF;
  END IF;
  UPDATE public.profiles SET is_active = _active, updated_at = now() WHERE id = _user_id;
  PERFORM public.admin_log_action(CASE WHEN _active THEN 'user.reactivated' ELSE 'user.suspended' END, 'user', _user_id::text, '{}'::jsonb, 'success');
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean) TO authenticated, service_role;

-- 4. Access rules: the live 12b body (verbatim) plus the suspended rule first. CREATE OR REPLACE keeps its grants
--    (service_role only) and SET search_path = ''.
CREATE OR REPLACE FUNCTION public._access_state_for(_uid uuid)
RETURNS TABLE(state text, trial_ends_at timestamptz, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  _own_end timestamptz; _co_end timestamptz; _plan text; _status text; _via text; _name text; _member_elsewhere boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  -- Phase 12c: a suspended account (Admin → Users → Suspend) gets nothing, whatever its plan, trial or company.
  -- Super admins, admin/owner-role users and master accounts can never be suspended (see _suspension_protected).
  IF EXISTS (SELECT 1 FROM public.profiles sp WHERE sp.id = _uid AND sp.is_active = false) AND NOT public._suspension_protected(_uid) THEN
    RETURN QUERY SELECT 'suspended'::text, NULL::timestamptz, 0, NULL::text, NULL::text, 'self'::text, NULL::text;
    RETURN;
  END IF;
  SELECT p.trial_ends_at INTO _own_end FROM public.profiles p WHERE p.id = _uid;

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

  -- Phase 12b: a master account (switched on by a super admin in the Admin portal) is treated exactly like an owner.
  IF EXISTS (SELECT 1 FROM public.master_access ma WHERE ma.user_id = _uid) THEN
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

COMMIT;
