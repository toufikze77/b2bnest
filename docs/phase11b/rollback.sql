-- Phase 11b rollback — PREPARED, NOT APPLIED. Undoes proposal.sql in one transaction and restores the live definitions
-- read on 2026-10-23. If enable-caps.sql was applied, run enable-caps-rollback.sql FIRST (this file refuses otherwise).
-- If data-step.sql was applied, its rows go with the table. Nobody's membership, invitation or subscription changes.
BEGIN;
DO $$ BEGIN
  IF public._seat_caps_enabled() THEN RAISE EXCEPTION 'seat caps are on: run enable-caps-rollback.sql first'; END IF;
END $$;

-- org_seat_summary gained columns, so it is dropped and re-created below with the live definition.
DROP FUNCTION public.org_seat_summary(uuid);

-- Live definitions (verbatim copy of live-functions-2026-10-23.sql; run-test.sh checks they match)
CREATE OR REPLACE FUNCTION public._seat_caps_enabled()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT false $function$;

CREATE OR REPLACE FUNCTION public._seat_pool(_org uuid)
 RETURNS TABLE(billing_owner uuid, used integer, pending integer, seat_limit integer, pooled_companies integer, basis text, enforced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _bo uuid := public._org_billing_owner(_org); _lim int; _basis text;
BEGIN
  IF _bo IS NULL THEN _basis := 'no_billing_owner';
  ELSE
    SELECT p.member_limit, 'subscription:' || p.key INTO _lim, _basis FROM public.subscribers s
      JOIN public.platform_plans p ON p.key=s.plan_key AND p.is_active
     WHERE s.user_id=_bo AND s.subscribed LIMIT 1;
    IF _basis IS NULL THEN
      SELECT p.member_limit, 'free' INTO _lim, _basis FROM public.platform_plans p WHERE p.key='free' AND p.is_active LIMIT 1;
    END IF;
    IF _lim IS NULL THEN _basis := coalesce(_basis, 'no_plan') || ':no_limit_configured'; END IF;
  END IF;
  RETURN QUERY
  WITH pool AS (SELECT public._seat_pool_orgs(_org) AS id),
  staff AS (SELECT DISTINCT m.user_id FROM public.organization_members m JOIN pool ON pool.id=m.organization_id WHERE m.is_active),
  staff_emails AS (SELECT lower(u.email) AS e FROM auth.users u JOIN staff ON staff.user_id=u.id WHERE u.email IS NOT NULL),
  pend AS (SELECT DISTINCT lower(i.email) AS e FROM public.organization_invitations i JOIN pool ON pool.id=i.organization_id
            WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
              AND lower(i.email) NOT IN (SELECT e FROM staff_emails))
  SELECT _bo, (SELECT count(*)::int FROM staff), (SELECT count(*)::int FROM pend), _lim, (SELECT count(*)::int FROM pool), _basis,
         (_bo IS NOT NULL AND _lim IS NOT NULL AND public._seat_caps_enabled());
END $function$;

CREATE OR REPLACE FUNCTION public.organization_members_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s record; _email text; _creator uuid;
BEGIN
  IF NOT coalesce(NEW.is_active, true) THEN RETURN NEW; END IF; -- deactivation / inactive rows never need a seat
  IF TG_OP = 'UPDATE' AND OLD.is_active AND OLD.user_id = NEW.user_id AND OLD.organization_id = NEW.organization_id THEN
    RETURN NEW; -- role or detail changes of an already active member
  END IF;
  PERFORM public._seat_pool_lock(NEW.organization_id);
  -- Company creation: its creator as the first member records the billing owner (create_team_with_owner, sign-up, etc.).
  SELECT o.created_by INTO _creator FROM public.organizations o WHERE o.id = NEW.organization_id;
  IF NEW.user_id = _creator AND NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=NEW.organization_id
        AND m.is_active AND m.id IS DISTINCT FROM NEW.id) THEN
    INSERT INTO public.organization_billing(organization_id, billing_user_id, source)
    VALUES (NEW.organization_id, NEW.user_id, 'company_created') ON CONFLICT (organization_id) DO NOTHING;
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.support_customers c WHERE c.organization_id=NEW.organization_id AND c.user_id=NEW.user_id AND c.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'this account is a support customer of this company; remove customer access first' USING errcode='42501';
  END IF;
  SELECT * INTO s FROM public._seat_pool(NEW.organization_id);
  IF s.billing_owner IS NULL THEN
    RAISE EXCEPTION 'this company has no billing owner on record, so members cannot be added or re-activated; ask B2BNEST support to repair it'
      USING errcode='42501';
  END IF;
  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = NEW.user_id;
  -- Someone with a live invitation in the pool uses its reservation (first come, first served if a later limit over-books the pool);
  -- anyone else (direct adds, re-activations) must fit beside every reservation.
  IF s.enforced AND public._seat_needs_new(NEW.organization_id, NEW.user_id, _email) AND
     (CASE WHEN EXISTS (SELECT 1 FROM public.organization_invitations i
              WHERE lower(i.email)=_email AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
                AND i.organization_id IN (SELECT public._seat_pool_orgs(NEW.organization_id)))
           THEN s.used >= s.seat_limit ELSE s.used + s.pending >= s.seat_limit END) THEN
    RAISE EXCEPTION 'this company has no free seats; ask the owner' USING errcode='42501';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.org_invite_member(_org uuid, _email text, _role text)
 RETURNS TABLE(invitation_id uuid, token text, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE _me uuid := auth.uid(); _my text; _e text := lower(btrim(coalesce(_email,''))); _inv public.organization_invitations; s record;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT m.role INTO _my FROM public.organization_members m WHERE m.organization_id=_org AND m.user_id=_me AND m.is_active;
  IF _my IS NULL OR _my NOT IN ('owner','admin') THEN RAISE EXCEPTION 'only company owners and admins can invite members'; END IF;
  IF _role IS NULL OR _role NOT IN ('admin','manager','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF _role='admin' AND _my<>'owner' THEN RAISE EXCEPTION 'only owners can invite admins'; END IF;
  IF _e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_e) > 254 THEN RAISE EXCEPTION 'invalid email address'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('org_invite:' || _org::text, 0));
  IF EXISTS (SELECT 1 FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
             WHERE m.organization_id=_org AND m.is_active AND lower(u.email)=_e) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, 'already_member'; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.support_customers c WHERE c.organization_id=_org AND lower(c.email)=_e AND c.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'this email is a support customer of this company; remove their customer access first';
  END IF;
  UPDATE public.organization_invitations i SET revoked_at=now()
   WHERE i.organization_id=_org AND lower(i.email)=_e AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at <= now();
  SELECT * INTO _inv FROM public.organization_invitations i
   WHERE i.organization_id=_org AND lower(i.email)=_e AND i.accepted_at IS NULL AND i.revoked_at IS NULL;
  IF FOUND THEN RETURN QUERY SELECT _inv.id, _inv.token, 'already_pending'; RETURN; END IF;
  PERFORM public._seat_pool_lock(_org);
  SELECT * INTO s FROM public._seat_pool(_org);
  IF s.billing_owner IS NULL THEN
    RAISE EXCEPTION 'this company has no billing owner on record, so new members cannot be invited; ask B2BNEST support to repair it';
  END IF;
  -- Inviting someone already counted (staff in the pool) or already reserved (pending in the pool) needs no new seat.
  IF s.enforced AND public._seat_needs_new(_org, NULL, _e) AND NOT EXISTS (SELECT 1 FROM public.organization_invitations i
       WHERE lower(i.email)=_e AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
         AND i.organization_id IN (SELECT public._seat_pool_orgs(_org)))
     AND s.used + s.pending >= s.seat_limit THEN
    RAISE EXCEPTION 'seat limit reached: % of % seats used or invited across % companies', s.used + s.pending, s.seat_limit, s.pooled_companies;
  END IF;
  INSERT INTO public.organization_invitations(organization_id, email, role, invited_by, token, expires_at)
  VALUES (_org, _e, _role, _me, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), now() + interval '7 days')
  RETURNING * INTO _inv;
  INSERT INTO public.onboarding_email_outbox(organization_id, kind, invitation_id, recipient_email, dedupe_key)
  VALUES (_org, 'staff_invitation', _inv.id, _e, 'staff_invitation:' || _inv.id);
  RETURN QUERY SELECT _inv.id, _inv.token, 'created';
END $function$;

CREATE OR REPLACE FUNCTION public.org_seat_summary(_org uuid)
 RETURNS TABLE(used integer, pending integer, seat_limit integer, pooled_companies integer, basis text, enforced boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.user_is_organization_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'only company owners and admins can see seats'; END IF;
  RETURN QUERY SELECT p.used, p.pending, p.seat_limit, p.pooled_companies, p.basis, p.enforced FROM public._seat_pool(_org) p;
END $function$;

REVOKE ALL ON FUNCTION public.org_seat_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_seat_summary(uuid) TO authenticated, service_role; -- live ACL

DROP FUNCTION public._admin_seat_needs_new(uuid, uuid, text);
DROP FUNCTION public._seat_pool_admins(uuid);
DROP FUNCTION public._seat_plan(uuid);
DROP TABLE public.platform_plan_prices;
DELETE FROM public.platform_plans WHERE key IN ('starter','professional','enterprise','professional_legacy','enterprise_legacy');
ALTER TABLE public.platform_plans DROP CONSTRAINT platform_plans_admin_limit_check;
ALTER TABLE public.platform_plans DROP COLUMN admin_limit;
COMMIT;
