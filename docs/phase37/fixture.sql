-- Phase 37 test fixture (DISPOSABLE local Postgres only). Runs after the Phase 35 and 36 fixtures and proposals
-- (docs/phase37/run-test.sh), which reproduce the production credit functions byte for byte (hash-checked).
-- Adds what public._access_state_for reads, with the production columns, and _suspension_protected / _access_state_for
-- copied VERBATIM from production (2 Nov 2026).
ALTER TABLE public.profiles ADD COLUMN is_active boolean DEFAULT true;
CREATE TABLE public.master_access (user_id uuid PRIMARY KEY, granted_by uuid, granted_at timestamptz DEFAULT now(), note text);
CREATE TABLE public.organization_billing (organization_id uuid PRIMARY KEY, billing_user_id uuid NOT NULL, source text, set_by uuid, set_at timestamptz DEFAULT now(), note text);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id uuid NOT NULL, role text, permissions jsonb,
  invited_by uuid, joined_at timestamptz DEFAULT now(), is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public._suspension_protected(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role::text IN ('super_admin','admin','owner'))
      OR EXISTS (SELECT 1 FROM public.master_access m WHERE m.user_id = _uid) $function$;

CREATE OR REPLACE FUNCTION public._access_state_for(_uid uuid)
 RETURNS TABLE(state text, trial_ends_at timestamp with time zone, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
REVOKE ALL ON FUNCTION public._access_state_for(uuid), public._suspension_protected(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._access_state_for(uuid), public._suspension_protected(uuid) TO service_role;
