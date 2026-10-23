-- Phase 11b: plan user and admin limits — PREPARED, NOT APPLIED.
-- Target when approved: production gvftvswyrevummbvyhxa. Apply in ONE transaction (this file is one), after review.
-- Caps stay OFF: _seat_caps_enabled() is not touched here and keeps returning false. Turning caps on is the separate
-- enable-caps.sql, approved separately. Rollback: rollback.sql (restores the live definitions read on 2026-10-23).
--
-- What it does
--  1. platform_plans: new column admin_limit (owners and admins counted together; NULL = no admin limit configured).
--  2. Five plan rows: starter (Solo 1/1), professional (Business 50/5), enterprise (Scale 100/10), and the earlier prices
--     still paid by existing subscribers: professional_legacy (Business £35, 5 users, 5 admins) and enterprise_legacy
--     (Scale £85, 25 users, 10 admins). Keys match subscribers.plan_key and the admin screens' tier join.
--  3. platform_plan_prices: Stripe price id -> plan row, so a subscriber on an EARLIER price gets that price's limits.
--     Empty here; filled by data-step.sql (separately approved) with the existing legacy subscribers' price ids.
--  4. _seat_plan(): the billing owner's plan row (price mapping first, then subscribers.plan_key).
--  5. _seat_pool(): same signature and rules as live; now reads the plan through _seat_plan().
--  6. _seat_pool_admins() / _admin_seat_needs_new(): owners+admins in the pool, pending admin invitations, admin limit.
--  7. organization_members_guard(): same rules as live, plus the admin limit when caps are on: a new or re-activated
--     owner/admin, or a member PROMOTED to admin, needs a free admin seat. Demotions, deactivations and other role or
--     detail changes are never blocked. Nobody is ever removed.
--  8. org_invite_member(): same as live, plus: inviting an admin needs a free admin seat (pending admin invitations
--     reserve one) when caps are on.
--  9. org_seat_summary(): same as live plus admin_used, admin_pending, admin_limit (DROP + CREATE: new columns).
-- Support customers never count (they are not organization_members). A pool without an active paid plan keeps today's
-- free fallback (the 'free' row if one exists; there is none, so no limit applies to free pools).
BEGIN;

DO $$ BEGIN
  IF public._seat_caps_enabled() THEN RAISE EXCEPTION 'seat caps are already on; this proposal expects them off'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_plans' AND column_name='admin_limit') THEN
    RAISE EXCEPTION 'platform_plans.admin_limit already exists (applied twice?)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_plans WHERE key IN ('starter','professional','enterprise','professional_legacy','enterprise_legacy')) THEN
    RAISE EXCEPTION 'plan rows already exist';
  END IF;
END $$;

-- 1. Admin limit
ALTER TABLE public.platform_plans ADD COLUMN admin_limit integer;
ALTER TABLE public.platform_plans ADD CONSTRAINT platform_plans_admin_limit_check
  CHECK (admin_limit IS NULL OR (admin_limit >= 1 AND admin_limit <= member_limit));

-- 2. Plan rows (prices in GBP, as on the Pricing page; legacy rows describe what existing subscribers pay)
INSERT INTO public.platform_plans(key, name, description, monthly_price, annual_price, currency, ai_credit_limit, member_limit, admin_limit, is_active, is_featured)
VALUES
  ('starter',             'Solo',                     'One user, who is the admin',                         19, 190, 'GBP',  250,   1,  1, true, false),
  ('professional',        'Business',                 '50 users, up to 5 admins',                           59, 590, 'GBP', 1000,  50,  5, true, true),
  ('enterprise',          'Scale',                    '100 users, up to 10 admins',                         89, 890, 'GBP', 5000, 100, 10, true, false),
  ('professional_legacy', 'Business (earlier price)', 'Existing subscribers only: 5 users, up to 5 admins', 35, 350, 'GBP', 1000,   5,  5, true, false),
  ('enterprise_legacy',   'Scale (earlier price)',    'Existing subscribers only: 25 users, up to 10 admins', 85, 850, 'GBP', 5000, 25, 10, true, false);

-- 3. Stripe price -> plan row (legacy prices). New table: explicit grants (Supabase stops auto-granting on 30 Oct 2026).
CREATE TABLE public.platform_plan_prices (
  stripe_price_id text PRIMARY KEY CHECK (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  plan_key text NOT NULL REFERENCES public.platform_plans(key) ON UPDATE CASCADE,
  note text CHECK (note IS NULL OR length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_plan_prices ENABLE ROW LEVEL SECURITY; -- no policies: only the service role and definer functions read it
REVOKE ALL ON public.platform_plan_prices FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_plan_prices TO service_role;

-- 4. The billing owner's effective plan row
CREATE FUNCTION public._seat_plan(_bo uuid)
RETURNS TABLE(plan_key text, member_limit int, admin_limit int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.key, p.member_limit, p.admin_limit
    FROM public.subscribers s
    JOIN public.platform_plans p
      ON p.key = coalesce((SELECT pp.plan_key FROM public.platform_plan_prices pp WHERE pp.stripe_price_id = s.stripe_price_id), s.plan_key)
     AND p.is_active
   WHERE s.user_id = _bo AND s.subscribed
   LIMIT 1 $$;

-- 5. Seat pool (members): live definition, plan read through _seat_plan()
CREATE OR REPLACE FUNCTION public._seat_pool(_org uuid)
RETURNS TABLE(billing_owner uuid, used integer, pending integer, seat_limit integer, pooled_companies integer, basis text, enforced boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _bo uuid := public._org_billing_owner(_org); _lim int; _basis text;
BEGIN
  IF _bo IS NULL THEN _basis := 'no_billing_owner';
  ELSE
    SELECT sp.member_limit, 'subscription:' || sp.plan_key INTO _lim, _basis FROM public._seat_plan(_bo) sp;
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

-- 6. Admin seats: active owners/admins in the pool (unique people), pending admin invitations, the plan's admin limit
CREATE FUNCTION public._seat_pool_admins(_org uuid)
RETURNS TABLE(admin_used integer, admin_pending integer, admin_limit integer, enforced boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _bo uuid := public._org_billing_owner(_org); _alim int; _found boolean := false;
BEGIN
  IF _bo IS NOT NULL THEN
    SELECT sp.admin_limit, true INTO _alim, _found FROM public._seat_plan(_bo) sp;
    IF NOT coalesce(_found, false) THEN
      SELECT p.admin_limit INTO _alim FROM public.platform_plans p WHERE p.key='free' AND p.is_active LIMIT 1;
    END IF;
  END IF;
  RETURN QUERY
  WITH pool AS (SELECT public._seat_pool_orgs(_org) AS id),
  adm AS (SELECT DISTINCT m.user_id FROM public.organization_members m JOIN pool ON pool.id=m.organization_id
           WHERE m.is_active AND m.role IN ('owner','admin')),
  adm_emails AS (SELECT lower(u.email) AS e FROM auth.users u JOIN adm ON adm.user_id=u.id WHERE u.email IS NOT NULL),
  pend AS (SELECT DISTINCT lower(i.email) AS e FROM public.organization_invitations i JOIN pool ON pool.id=i.organization_id
            WHERE i.role = 'admin' AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
              AND lower(i.email) NOT IN (SELECT e FROM adm_emails))
  SELECT (SELECT count(*)::int FROM adm), (SELECT count(*)::int FROM pend), _alim,
         (_bo IS NOT NULL AND _alim IS NOT NULL AND public._seat_caps_enabled());
END $function$;

-- Is this person NOT already an active owner/admin somewhere in the pool? (then they need a new admin seat)
CREATE FUNCTION public._admin_seat_needs_new(_org uuid, _user uuid, _email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.organization_members m LEFT JOIN auth.users u ON u.id=m.user_id
                      WHERE m.is_active AND m.role IN ('owner','admin') AND m.organization_id IN (SELECT public._seat_pool_orgs(_org))
                        AND (m.user_id=_user OR (_email IS NOT NULL AND lower(u.email)=lower(_email)))) $$;

-- 7. Guard: live rules unchanged, plus the admin limit when caps are on
CREATE OR REPLACE FUNCTION public.organization_members_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE s record; a record; _email text; _creator uuid; _to_admin boolean := NEW.role IN ('owner','admin');
BEGIN
  IF NOT coalesce(NEW.is_active, true) THEN RETURN NEW; END IF; -- deactivation / inactive rows never need a seat
  IF TG_OP = 'UPDATE' AND OLD.is_active AND OLD.user_id = NEW.user_id AND OLD.organization_id = NEW.organization_id THEN
    -- Role or detail changes of an already active member are never blocked, EXCEPT a promotion to owner/admin,
    -- which needs a free admin seat while caps are on (pending admin invitations keep their reservations).
    IF NOT _to_admin OR OLD.role IN ('owner','admin') THEN RETURN NEW; END IF;
    PERFORM public._seat_pool_lock(NEW.organization_id);
    SELECT * INTO a FROM public._seat_pool_admins(NEW.organization_id);
    SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = NEW.user_id;
    IF a.enforced AND public._admin_seat_needs_new(NEW.organization_id, NEW.user_id, _email)
       AND a.admin_used + a.admin_pending >= a.admin_limit THEN
      RAISE EXCEPTION 'this company has no free admin seats (% of % used or invited); ask the owner', a.admin_used + a.admin_pending, a.admin_limit
        USING errcode='42501';
    END IF;
    RETURN NEW;
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
  -- Admin seats: same reservation rule, counting only owners/admins and admin invitations.
  IF _to_admin THEN
    SELECT * INTO a FROM public._seat_pool_admins(NEW.organization_id);
    IF a.enforced AND public._admin_seat_needs_new(NEW.organization_id, NEW.user_id, _email) AND
       (CASE WHEN EXISTS (SELECT 1 FROM public.organization_invitations i
                WHERE lower(i.email)=_email AND i.role='admin' AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
                  AND i.organization_id IN (SELECT public._seat_pool_orgs(NEW.organization_id)))
             THEN a.admin_used >= a.admin_limit ELSE a.admin_used + a.admin_pending >= a.admin_limit END) THEN
      RAISE EXCEPTION 'this company has no free admin seats (% of % used or invited); ask the owner', a.admin_used + a.admin_pending, a.admin_limit
        USING errcode='42501';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 8. Invitations: live definition, plus an admin seat check for admin invitations
CREATE OR REPLACE FUNCTION public.org_invite_member(_org uuid, _email text, _role text)
RETURNS TABLE(invitation_id uuid, token text, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _me uuid := auth.uid(); _my text; _e text := lower(btrim(coalesce(_email,''))); _inv public.organization_invitations; s record; a record;
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
  -- An admin invitation reserves an admin seat; someone already an admin in the pool (or already invited as admin) needs no new one.
  IF _role = 'admin' THEN
    SELECT * INTO a FROM public._seat_pool_admins(_org);
    IF a.enforced AND public._admin_seat_needs_new(_org, NULL, _e) AND NOT EXISTS (SELECT 1 FROM public.organization_invitations i
         WHERE lower(i.email)=_e AND i.role='admin' AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
           AND i.organization_id IN (SELECT public._seat_pool_orgs(_org)))
       AND a.admin_used + a.admin_pending >= a.admin_limit THEN
      RAISE EXCEPTION 'admin limit reached: % of % admin seats used or invited across % companies', a.admin_used + a.admin_pending, a.admin_limit, s.pooled_companies;
    END IF;
  END IF;
  INSERT INTO public.organization_invitations(organization_id, email, role, invited_by, token, expires_at)
  VALUES (_org, _e, _role, _me, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), now() + interval '7 days')
  RETURNING * INTO _inv;
  INSERT INTO public.onboarding_email_outbox(organization_id, kind, invitation_id, recipient_email, dedupe_key)
  VALUES (_org, 'staff_invitation', _inv.id, _e, 'staff_invitation:' || _inv.id);
  RETURN QUERY SELECT _inv.id, _inv.token, 'created';
END $function$;

-- 9. Seat summary for owners/admins: live columns plus the admin figures (new columns, so DROP + CREATE + re-grant)
DROP FUNCTION public.org_seat_summary(uuid);
CREATE FUNCTION public.org_seat_summary(_org uuid)
RETURNS TABLE(used int, pending int, seat_limit int, pooled_companies int, basis text, enforced boolean,
              admin_used int, admin_pending int, admin_limit int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NOT public.user_is_organization_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'only company owners and admins can see seats'; END IF;
  RETURN QUERY SELECT p.used, p.pending, p.seat_limit, p.pooled_companies, p.basis, p.enforced, a.admin_used, a.admin_pending, a.admin_limit
    FROM public._seat_pool(_org) p CROSS JOIN public._seat_pool_admins(_org) a;
END $function$;
REVOKE ALL ON FUNCTION public.org_seat_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_seat_summary(uuid) TO authenticated, service_role; -- live ACL: postgres, authenticated, service_role

-- Internal helpers: not callable through the API; service_role only (same ACL as the live helpers)
REVOKE ALL ON FUNCTION public._seat_plan(uuid), public._seat_pool_admins(uuid), public._admin_seat_needs_new(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._seat_plan(uuid), public._seat_pool_admins(uuid), public._admin_seat_needs_new(uuid,uuid,text) TO service_role;

COMMIT;
