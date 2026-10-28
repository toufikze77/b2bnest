-- Phase 12b: master-access switch — PREPARED, NOT APPLIED.
-- Target when approved: production gvftvswyrevummbvyhxa, in ONE transaction (this file), AFTER Phase 12 (live since PR #35).
-- Then data-step.sql (seeds the two owner accounts). Rollback: rollback.sql.
--
-- Owner decision (28 Oct 2026): after the 14-day trial every account chooses a plan and pays, with no extensions. The only
-- exception is a "master account", switched on and off by hand by a super admin in the Admin portal. A master account
-- gets state 'owner' from my_access_state() (never sees the paywall) WITHOUT getting a platform role, so it does not
-- open the Admin portal.
--
-- 1. public.master_access: one row per master account. RLS on, no policies, no access for PUBLIC / anon /
--    authenticated: read and written only through the two functions below (and by service_role).
-- 2. public.set_master_access(user, on/off, note): super admins only (is_super_admin(auth.uid())); writes an audit row
--    to public.admin_audit_logs (the table the Admin portal already writes to); refuses to remove the last master
--    account. It touches only master_access, never user_roles, so it cannot lock a super admin out of the portal.
-- 3. public.list_master_access(): super admins only; user id, email, display name, granted_at, note.
-- 4. public._access_state_for(uuid): Phase 12 definition kept exactly, plus ONE rule after the owner-role rule.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.master_access') IS NOT NULL OR to_regprocedure('public.set_master_access(uuid,boolean,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'master_access already exists (applied twice?)';
  END IF;
  -- Phase 12 must be live and unchanged: this file replaces _access_state_for with Phase 12's body plus one rule.
  IF to_regprocedure('public._access_state_for(uuid)') IS NULL OR to_regprocedure('public.my_access_state()') IS NULL THEN
    RAISE EXCEPTION 'Phase 12 (my_access_state) is not applied; apply docs/phase12/proposal.sql first';
  END IF;
  -- Body (prosrc) and result type as read on 2026-10-28 (Postgres 17; prosrc is the same text on every version).
  IF (SELECT md5(prosrc) <> 'f8c1f091832a8f06837f4928ce0bf91c' OR md5(pg_get_function_result(oid)) <> '2b10abc13bcb9b7198c8a6142c7cd9a6'
             OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] OR NOT prosecdef
        FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) THEN
    RAISE EXCEPTION '_access_state_for differs from the Phase 12 version read on 2026-10-28; re-read it before applying';
  END IF;
  IF to_regclass('public.admin_audit_logs') IS NULL OR to_regprocedure('public.is_super_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'admin_audit_logs or is_super_admin() missing';
  END IF;
END $$;

-- 1. The switch
CREATE TABLE public.master_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR length(note) <= 300)
);
ALTER TABLE public.master_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.master_access FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_access TO service_role;

-- 2. Switch on / off (super admins only). Returns what happened.
CREATE FUNCTION public.set_master_access(_user_id uuid, _enabled boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _caller uuid := auth.uid(); _changed boolean := false; _note_clean text := nullif(btrim(_note), '');
BEGIN
  IF _caller IS NULL OR NOT public.is_super_admin(_caller) THEN
    RAISE EXCEPTION 'only a super admin can change master accounts' USING errcode = '42501';
  END IF;
  IF _user_id IS NULL OR _enabled IS NULL THEN
    RAISE EXCEPTION 'user and on/off are required' USING errcode = '22004';
  END IF;
  IF _note_clean IS NOT NULL AND length(_note_clean) > 300 THEN
    RAISE EXCEPTION 'the note can be at most 300 characters' USING errcode = '22001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'no such user' USING errcode = 'P0002';
  END IF;
  -- One change at a time, so two super admins can't each remove one of the last two master accounts.
  LOCK TABLE public.master_access IN SHARE ROW EXCLUSIVE MODE;
  IF _enabled THEN
    INSERT INTO public.master_access(user_id, granted_by, note) VALUES (_user_id, _caller, _note_clean)
    ON CONFLICT (user_id) DO NOTHING;
    _changed := FOUND;
  ELSE
    IF EXISTS (SELECT 1 FROM public.master_access WHERE user_id = _user_id)
       AND (SELECT count(*) FROM public.master_access) <= 1 THEN
      RAISE EXCEPTION 'last_master_account: you can''t remove the last master account' USING errcode = 'P0001';
    END IF;
    DELETE FROM public.master_access WHERE user_id = _user_id;
    _changed := FOUND;
  END IF;
  IF _changed THEN
    INSERT INTO public.admin_audit_logs(admin_id, admin_email, action, target_type, target_id, details, status)
    VALUES (_caller, (SELECT p.email FROM public.profiles p WHERE p.id = _caller),
            CASE WHEN _enabled THEN 'master_access.on' ELSE 'master_access.off' END, 'user', _user_id::text,
            jsonb_build_object('note', _note_clean), 'success');
  END IF;
  RETURN jsonb_build_object('user_id', _user_id, 'enabled', _enabled, 'changed', _changed);
END $function$;

-- 3. The list for the Admin portal (super admins only). Only these five fields.
CREATE FUNCTION public.list_master_access()
RETURNS TABLE(user_id uuid, email text, display_name text, granted_at timestamptz, note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'only a super admin can list master accounts' USING errcode = '42501';
  END IF;
  RETURN QUERY
    SELECT m.user_id, u.email::text, coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.full_name), ''))::text, m.granted_at, m.note
      FROM public.master_access m JOIN auth.users u ON u.id = m.user_id LEFT JOIN public.profiles p ON p.id = m.user_id
     ORDER BY m.granted_at;
END $function$;

REVOKE ALL ON FUNCTION public.set_master_access(uuid, boolean, text), public.list_master_access() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_master_access(uuid, boolean, text), public.list_master_access() TO authenticated, service_role;

-- 4. Access rules: production's Phase 12 _access_state_for (body byte-for-byte as live; the live copy has no comment line
--    where docs/phase12/proposal.sql had one), unchanged except the master-account rule after the owner-role rule.
--    CREATE OR REPLACE keeps its grants (service_role only) and its SET search_path = ''.
CREATE OR REPLACE FUNCTION public._access_state_for(_uid uuid)
RETURNS TABLE(state text, trial_ends_at timestamptz, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  _own_end timestamptz; _co_end timestamptz; _plan text; _status text; _via text; _name text; _member_elsewhere boolean;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
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
