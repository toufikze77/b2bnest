-- Phase 12b rollback — PREPARED, NOT APPLIED. Undoes proposal.sql (and data-step.sql) in one transaction.
-- Restores _access_state_for to the exact production definition read on 2026-10-28 (body md5 f8c1f091…, which is
-- docs/phase12/proposal.sql without its one comment line) and drops the switch.
-- WARNING: every master account loses its owner access at once (accounts with the admin/owner/super_admin role keep it).
-- The audit rows already written to public.admin_audit_logs are kept (they are history).
BEGIN;
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

DROP FUNCTION public.set_master_access(uuid, boolean, text);
DROP FUNCTION public.list_master_access();
DROP TABLE public.master_access;
COMMIT;
