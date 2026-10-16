-- Ticketing onboarding package — PREPARED, NOT APPLIED. Target when approved: gvftvswyrevummbvyhxa.
-- Depends on: support ticketing (applied 2026-10-15) and the existing organization_invitations table (0 rows, read 2026-10-15).
-- One transaction: any failure leaves nothing behind.
-- Adds: staff invitation create/revoke/extend/accept RPCs with role + seat checks; invitation email queue (server-only);
-- customer invitation emails; ticket status notifications; per-company email opt-out; optional closure feedback.
-- Does NOT change plans, prices, Stripe, subscriptions, existing members or existing customer invitations.
-- Revision 4 (2026-10-16): explicit billing owner table (not inferred from roles); one guard trigger enforces seats, billing owner
-- and customer separation on every route that adds/re-activates staff; companies without a billing owner cannot expand;
-- caps stay off; only the one known stale ticket email is cancelled, by id.
-- Revision 3 (2026-10-16): one seat allowance per paying owner across the companies it bills (unique staff counted once);
-- staff/customer email links carry the company and ticket. Still no limit is activated.
-- Revision 2 (2026-10-16): staff are notified of customer replies on unassigned tickets and of customer reopens; no duplicate
-- "status changed" notice on the first staff reply; direct member inserts closed (invitations are the only way in);
-- ticket emails queued before sending was approved are cancelled, never sent.
BEGIN;

-- 1. Staff invitations: revocation + accepting account, one live invitation per email per company ----------------
ALTER TABLE public.organization_invitations ADD COLUMN revoked_at timestamptz, ADD COLUMN accepted_by uuid;
UPDATE public.organization_invitations SET email = lower(btrim(email));
CREATE UNIQUE INDEX organization_invitations_one_live ON public.organization_invitations (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Writes only through the RPCs below (they enforce role limits, seats and duplicates). Admins keep read access; token stays hidden.
DROP POLICY IF EXISTS "Organization admins can manage invitations" ON public.organization_invitations;
REVOKE INSERT, UPDATE, DELETE ON public.organization_invitations FROM anon, authenticated;
REVOKE ALL ON public.organization_invitations FROM anon;
-- Column REVOKE alone does not hide a column while a table-wide SELECT grant exists; replace it with column grants.
REVOKE SELECT ON public.organization_invitations FROM authenticated;
GRANT SELECT (id, organization_id, email, role, invited_by, expires_at, accepted_at, created_at, revoked_at, accepted_by)
  ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;
CREATE POLICY "Company owners and admins can view invitations" ON public.organization_invitations FOR SELECT TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));

-- New members join only through org_accept_invitation (or server-side company creation). Live granted INSERT to anon and
-- authenticated, so owners/admins could add any account id with no invitation, verification, seat or customer check.
-- No app screen inserts members; role changes (UPDATE) and removals (DELETE) are unchanged.
REVOKE INSERT ON public.organization_members FROM anon, authenticated;

-- Revoked invitations are no longer returned by the existing token lookup.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE(id uuid, organization_id uuid, email text, role text, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, organization_id, email, role, expires_at, accepted_at FROM public.organization_invitations
   WHERE p_token IS NOT NULL AND token = p_token AND (expires_at IS NULL OR expires_at > now())
     AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1;
$$;

-- 2. Invitation email queue (server-only, same rules as the ticket queue) --------------------------------------
CREATE TABLE public.onboarding_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('staff_invitation','customer_invitation')),
  invitation_id uuid NOT NULL,           -- organization_invitations.id or support_customers.id
  recipient_email text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted_by_provider','failed','uncertain','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  last_error text, next_attempt_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz,
  provider_reply text, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.onboarding_email_outbox FROM anon, authenticated;
GRANT ALL ON public.onboarding_email_outbox TO service_role;
ALTER TABLE public.onboarding_email_outbox ENABLE ROW LEVEL SECURITY; -- no policies on purpose: server-only

-- 3. Billing owner + seats.
--  Live (2026-10-16) has NO company -> subscription link: subscribers is keyed by user only and organizations.subscription_tier
--  is 'free' on all 10 companies. So the paying owner is recorded EXPLICITLY here instead of being inferred from roles:
--   * seeded only where the company's creator (organizations.created_by, never changes) is still its active owner (6 of 10);
--   * a new company gets it when its creator is inserted as the first member (every creation path does this);
--   * otherwise only a platform super admin can set it (platform_set_billing_owner). Ownership transfers never change it.
--  Seats: one allowance per billing owner across all companies billed to them; unique staff counted once; one reservation per
--  pending email; support customers never count. Caps stay OFF (_seat_caps_enabled() = false) until plan limits and the
--  complimentary-access decision exist. A company with no billing owner keeps its current members but cannot add or
--  re-activate staff or invite until an authorised repair.
CREATE TABLE public.organization_billing (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  billing_user_id uuid NOT NULL REFERENCES auth.users(id),
  source text NOT NULL CHECK (source IN ('seeded_creator_owner','company_created','platform_admin')),
  set_by uuid, set_at timestamptz NOT NULL DEFAULT now(), note text CHECK (note IS NULL OR length(note) <= 300));
REVOKE ALL ON public.organization_billing FROM anon, authenticated;
GRANT SELECT ON public.organization_billing TO authenticated;
GRANT ALL ON public.organization_billing TO service_role;
ALTER TABLE public.organization_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owners and admins can see the billing owner" ON public.organization_billing FOR SELECT TO authenticated
  USING (public.user_is_organization_admin(organization_id, auth.uid()));
INSERT INTO public.organization_billing(organization_id, billing_user_id, source)
SELECT o.id, o.created_by, 'seeded_creator_owner' FROM public.organizations o
 WHERE o.created_by IS NOT NULL AND EXISTS (SELECT 1 FROM public.organization_members m
       WHERE m.organization_id=o.id AND m.user_id=o.created_by AND m.role='owner' AND m.is_active);

CREATE FUNCTION public._seat_caps_enabled() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$; -- switched on only by a later approved migration

CREATE FUNCTION public._org_billing_owner(_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT b.billing_user_id FROM public.organization_billing b WHERE b.organization_id=_org $$;

CREATE FUNCTION public._seat_pool_orgs(_org uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT _org WHERE public._org_billing_owner(_org) IS NULL
  UNION
  SELECT b.organization_id FROM public.organization_billing b WHERE b.billing_user_id = public._org_billing_owner(_org) $$;

CREATE FUNCTION public._seat_pool(_org uuid)
RETURNS TABLE(billing_owner uuid, used int, pending int, seat_limit int, pooled_companies int, basis text, enforced boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
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
END $$;

-- Serialises every seat decision in one pool (invites, acceptances, direct inserts and re-activations in any of its companies).
CREATE FUNCTION public._seat_pool_lock(_org uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('seat_pool:' || coalesce(public._org_billing_owner(_org), _org)::text, 0)) $$;

-- Would giving this person (account or email) staff access need a NEW seat? False when they already hold or reserve one in the pool.
CREATE FUNCTION public._seat_needs_new(_org uuid, _user uuid, _email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.organization_members m LEFT JOIN auth.users u ON u.id=m.user_id
                      WHERE m.is_active AND m.organization_id IN (SELECT public._seat_pool_orgs(_org))
                        AND (m.user_id=_user OR (_email IS NOT NULL AND lower(u.email)=lower(_email)))) $$;

-- THE enforcement point: every route that adds or re-activates staff (RPCs, triggers, direct API, service role) passes here.
CREATE FUNCTION public.organization_members_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
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
END $$;
CREATE TRIGGER organization_members_guard BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.organization_members_guard();

-- Authorised repair / change of billing owner: platform super admins only, explicit, recorded. Target must be an active member.
CREATE FUNCTION public.platform_set_billing_owner(_org uuid, _user uuid, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'platform super admins only' USING errcode='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=_org AND m.user_id=_user AND m.is_active) THEN
    RAISE EXCEPTION 'billing owner must be an active member of the company'; END IF;
  IF _note IS NULL OR length(btrim(_note)) = 0 THEN RAISE EXCEPTION 'a reason is required'; END IF;
  INSERT INTO public.organization_billing(organization_id, billing_user_id, source, set_by, note)
  VALUES (_org, _user, 'platform_admin', auth.uid(), left(btrim(_note), 300))
  ON CONFLICT (organization_id) DO UPDATE SET billing_user_id=excluded.billing_user_id, source='platform_admin',
    set_by=excluded.set_by, set_at=now(), note=excluded.note;
END $$;

REVOKE ALL ON FUNCTION public._seat_caps_enabled(), public._org_billing_owner(uuid), public._seat_pool_orgs(uuid), public._seat_pool(uuid),
  public._seat_pool_lock(uuid), public._seat_needs_new(uuid,uuid,text), public.organization_members_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_set_billing_owner(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_set_billing_owner(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.org_seat_summary(_org uuid)
RETURNS TABLE(used int, pending int, seat_limit int, pooled_companies int, basis text, enforced boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.user_is_organization_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'only company owners and admins can see seats'; END IF;
  RETURN QUERY SELECT p.used, p.pending, p.seat_limit, p.pooled_companies, p.basis, p.enforced FROM public._seat_pool(_org) p;
END $$;
REVOKE ALL ON FUNCTION public.org_seat_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_seat_summary(uuid) TO authenticated;

-- 4. Invite a colleague. Owners: admin/manager/member. Admins: manager/member. Never owner.
CREATE FUNCTION public.org_invite_member(_org uuid, _email text, _role text)
RETURNS TABLE(invitation_id uuid, token text, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
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
END $$;

-- Copy link for a pending invitation (owner/admin of that company only; admins only for non-admin invitations).
CREATE FUNCTION public.org_invitation_token(_invitation uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE i public.organization_invitations;
BEGIN
  SELECT * INTO i FROM public.organization_invitations WHERE id=_invitation;
  IF NOT FOUND OR NOT public.user_is_organization_admin(i.organization_id, auth.uid())
     OR (i.role='admin' AND NOT public.user_is_organization_owner(i.organization_id, auth.uid())) THEN
    RAISE EXCEPTION 'invitation not found'; END IF;
  IF i.accepted_at IS NOT NULL OR i.revoked_at IS NOT NULL OR i.expires_at <= now() THEN RAISE EXCEPTION 'invitation is no longer pending'; END IF;
  RETURN i.token;
END $$;

CREATE FUNCTION public.org_manage_invitation(_invitation uuid, _action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE i public.organization_invitations;
BEGIN
  SELECT * INTO i FROM public.organization_invitations WHERE id=_invitation FOR UPDATE;
  IF NOT FOUND OR NOT public.user_is_organization_admin(i.organization_id, auth.uid())
     OR (i.role='admin' AND NOT public.user_is_organization_owner(i.organization_id, auth.uid())) THEN
    RAISE EXCEPTION 'invitation not found'; END IF;
  IF i.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already accepted'; END IF;
  IF _action='revoke' THEN
    UPDATE public.organization_invitations SET revoked_at=now() WHERE id=_invitation AND revoked_at IS NULL;
    UPDATE public.onboarding_email_outbox SET status='cancelled', updated_at=now()
     WHERE invitation_id=_invitation AND status IN ('pending','failed');
  ELSIF _action='extend' THEN
    IF i.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'revoked invitations cannot be extended; invite again'; END IF;
    UPDATE public.organization_invitations SET expires_at=now() + interval '7 days' WHERE id=_invitation;
  ELSE RAISE EXCEPTION 'invalid action'; END IF;
END $$;

-- What the invitee sees before accepting: company, role, masked email, whether it matches the signed-in verified email.
CREATE FUNCTION public.org_invitation_preview(_token text)
RETURNS TABLE(company text, role text, masked_email text, state text, email_matches boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE i public.organization_invitations; _e text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT * INTO i FROM public.organization_invitations WHERE _token IS NOT NULL AND token=_token;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, 'invalid', false; RETURN; END IF;
  SELECT lower(u.email) INTO _e FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL;
  RETURN QUERY SELECT o.name, i.role,
    left(i.email, 1) || '***@' || split_part(i.email, '@', 2),
    CASE WHEN i.revoked_at IS NOT NULL THEN 'revoked' WHEN i.accepted_at IS NOT NULL THEN 'accepted'
         WHEN i.expires_at <= now() THEN 'expired' WHEN _e IS NULL THEN 'email_unverified' ELSE 'pending' END,
    coalesce(_e = lower(i.email), false)
  FROM public.organizations o WHERE o.id=i.organization_id;
END $$;

-- Accept: matching VERIFIED email only, single use, not expired/revoked, seat re-checked, never as owner.
CREATE FUNCTION public.org_accept_invitation(_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _me uuid := auth.uid(); _e text; i public.organization_invitations; s record;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  SELECT lower(u.email) INTO _e FROM auth.users u WHERE u.id=_me AND u.email_confirmed_at IS NOT NULL;
  IF _e IS NULL THEN RAISE EXCEPTION 'verify your email address first'; END IF;
  SELECT * INTO i FROM public.organization_invitations WHERE _token IS NOT NULL AND token=_token FOR UPDATE;
  IF NOT FOUND OR i.revoked_at IS NOT NULL OR i.expires_at <= now() THEN RAISE EXCEPTION 'this invitation is no longer valid'; END IF;
  IF i.accepted_at IS NOT NULL THEN
    IF i.accepted_by = _me THEN RETURN i.organization_id; END IF;
    RAISE EXCEPTION 'this invitation is no longer valid';
  END IF;
  IF lower(i.email) <> _e THEN RAISE EXCEPTION 'this invitation was sent to a different email address'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_customers c WHERE c.organization_id=i.organization_id AND c.user_id=_me AND c.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'this account is a support customer of this company; ask the company to remove customer access first';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('org_invite:' || i.organization_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.organization_id=i.organization_id AND m.user_id=_me AND m.is_active) THEN
    -- Seat, billing-owner and customer checks run in organization_members_guard for this and every other route.
    UPDATE public.organization_members SET is_active=true, role=i.role, invited_by=i.invited_by, joined_at=now(), updated_at=now()
     WHERE organization_id=i.organization_id AND user_id=_me;
    IF NOT FOUND THEN
      INSERT INTO public.organization_members(organization_id, user_id, role, invited_by) VALUES (i.organization_id, _me, i.role, i.invited_by);
    END IF;
  END IF;
  UPDATE public.organization_invitations SET accepted_at=now(), accepted_by=_me WHERE id=i.id;
  UPDATE public.onboarding_email_outbox SET status='cancelled', updated_at=now() WHERE invitation_id=i.id AND status IN ('pending','failed');
  RETURN i.organization_id;
END $$;

REVOKE ALL ON FUNCTION public.org_invite_member(uuid,text,text), public.org_invitation_token(uuid), public.org_manage_invitation(uuid,text),
  public.org_invitation_preview(text), public.org_accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_invite_member(uuid,text,text), public.org_invitation_token(uuid), public.org_manage_invitation(uuid,text),
  public.org_invitation_preview(text), public.org_accept_invitation(text) TO authenticated;

-- 5. Customer invitation email: one queued email per new customer invitation (customers never become members/seats).
CREATE FUNCTION public.support_queue_customer_invitation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.onboarding_email_outbox(organization_id, kind, invitation_id, recipient_email, dedupe_key)
  VALUES (NEW.organization_id, 'customer_invitation', NEW.id, lower(NEW.email), 'customer_invitation:' || NEW.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_queue_customer_invitation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_customers_queue_invitation AFTER INSERT ON public.support_customers
  FOR EACH ROW EXECUTE FUNCTION public.support_queue_customer_invitation();

-- Email status for the invitation lists (owner/admin only). accepted_by_provider is NOT inbox delivery.
CREATE FUNCTION public.onboarding_email_status(_org uuid)
RETURNS TABLE(invitation_id uuid, kind text, status text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT public.user_is_organization_admin(_org, auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  RETURN QUERY SELECT o.invitation_id, o.kind, o.status, o.updated_at FROM public.onboarding_email_outbox o WHERE o.organization_id=_org;
END $$;
REVOKE ALL ON FUNCTION public.onboarding_email_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_email_status(uuid) TO authenticated;

-- Sender-only claim/finish. Invitations revoked/accepted/expired by send time are cancelled, never sent.
CREATE FUNCTION public.onboarding_outbox_claim(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, recipient_email text, company text, role text, organization_id uuid, token text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.onboarding_email_outbox o SET status='uncertain', last_error='sender stopped mid-send; provider outcome unknown', updated_at=now()
   WHERE o.status='sending' AND o.locked_until < now();
  UPDATE public.onboarding_email_outbox o SET status='cancelled', last_error='invitation no longer pending', updated_at=now()
   WHERE o.status IN ('pending','failed') AND (
     (o.kind='staff_invitation' AND NOT EXISTS (SELECT 1 FROM public.organization_invitations i WHERE i.id=o.invitation_id
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()))
     OR (o.kind='customer_invitation' AND NOT EXISTS (SELECT 1 FROM public.support_customers c WHERE c.id=o.invitation_id
        AND c.user_id IS NULL AND c.revoked_at IS NULL AND c.expires_at > now())));
  RETURN QUERY
  WITH due AS (SELECT o.id FROM public.onboarding_email_outbox o
     WHERE o.status IN ('pending','failed') AND o.attempts < 5 AND o.next_attempt_at <= now()
     ORDER BY o.created_at LIMIT least(greatest(_limit,1),50) FOR UPDATE SKIP LOCKED),
  upd AS (UPDATE public.onboarding_email_outbox o SET status='sending', attempts=o.attempts+1, locked_until=now()+interval '5 minutes', updated_at=now()
     FROM due WHERE o.id=due.id RETURNING o.*)
  SELECT u.id, u.kind, u.recipient_email,
         coalesce(s.support_name, org.name), i.role, u.organization_id, i.token, u.attempts
    FROM upd u JOIN public.organizations org ON org.id=u.organization_id
    LEFT JOIN public.support_settings s ON s.organization_id=u.organization_id AND u.kind='customer_invitation'
    LEFT JOIN public.organization_invitations i ON i.id=u.invitation_id AND u.kind='staff_invitation';
END $$;
CREATE FUNCTION public.onboarding_outbox_finish(_id uuid, _outcome text, _reply text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF _outcome NOT IN ('accepted_by_provider','failed','uncertain','cancelled') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  UPDATE public.onboarding_email_outbox SET status=_outcome, locked_until=NULL, updated_at=now(),
    provider_reply=CASE WHEN _outcome='accepted_by_provider' THEN left(_reply,300) ELSE provider_reply END,
    last_error=CASE WHEN _outcome<>'accepted_by_provider' THEN left(_reply,300) ELSE last_error END,
    accepted_at=CASE WHEN _outcome='accepted_by_provider' THEN now() ELSE accepted_at END,
    next_attempt_at=CASE WHEN _outcome='failed' THEN now() + (interval '5 minutes' * power(3, attempts-1)) ELSE next_attempt_at END
  WHERE id=_id AND status='sending';
END $$;
REVOKE ALL ON FUNCTION public.onboarding_outbox_claim(integer), public.onboarding_outbox_finish(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_outbox_claim(integer), public.onboarding_outbox_finish(uuid,text,text) TO service_role;

-- 6. Ticket notifications: per-company email opt-out; status changes notify the customer (no message text) ----------
CREATE TABLE public.support_notification_prefs (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id));
GRANT SELECT, INSERT, UPDATE ON public.support_notification_prefs TO authenticated;
GRANT ALL ON public.support_notification_prefs TO service_role;
ALTER TABLE public.support_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own support notification settings" ON public.support_notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (public.support_is_agent(organization_id) OR public.support_is_customer(organization_id)));

ALTER TABLE public.support_email_outbox DROP CONSTRAINT support_email_outbox_kind_check;
ALTER TABLE public.support_email_outbox ADD CONSTRAINT support_email_outbox_kind_check
  CHECK (kind IN ('acknowledgement','public_reply','status_change'));

-- Staff to tell about customer activity: the assignee if there is one, otherwise every support agent plus owners/admins.
CREATE FUNCTION public._support_notify_staff(_org uuid, _assignee uuid, _title text, _msg text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _u uuid;
BEGIN
  FOR _u IN SELECT DISTINCT x.u FROM (
      SELECT _assignee AS u WHERE _assignee IS NOT NULL
      UNION SELECT a.user_id FROM public.support_agents a WHERE _assignee IS NULL AND a.organization_id=_org
      UNION SELECT om.user_id FROM public.organization_members om
       WHERE _assignee IS NULL AND om.organization_id=_org AND om.is_active AND om.role IN ('owner','admin')) x
    WHERE x.u IS DISTINCT FROM auth.uid() LOOP
    PERFORM public.support_notify(_u, _title, _msg);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._support_notify_staff(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;

-- Customer public reply on an UNASSIGNED ticket: support_add_message only told the assignee, so nobody heard about it.
CREATE FUNCTION public.support_message_notify_staff() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.support_tickets;
BEGIN
  IF NEW.is_internal OR public.support_is_agent(NEW.organization_id) THEN RETURN NEW; END IF;
  PERFORM set_config('support.customer_reply', NEW.ticket_id::text, true); -- the reopen notice below is then redundant
  SELECT * INTO t FROM public.support_tickets WHERE id=NEW.ticket_id;
  IF t.assignee_id IS NULL THEN
    PERFORM public._support_notify_staff(t.organization_id, NULL, 'Customer replied on ' || t.reference, t.subject);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_message_notify_staff() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_messages_notify_staff AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_message_notify_staff();

-- Status changes: staff-made changes notify the customer (status only, no message text). The automatic New -> Open on the
-- first staff reply is skipped because the reply notice already went out. A customer reopening tells the staff.
CREATE FUNCTION public.support_ticket_status_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.requester_id IS DISTINCT FROM auth.uid() THEN
    IF OLD.status = 'new' AND NEW.status = 'open' THEN RETURN NEW; END IF;
    PERFORM public.support_notify(NEW.requester_id, 'Status update on ' || NEW.reference, NEW.subject);
    INSERT INTO public.support_email_outbox(organization_id, ticket_id, kind, recipient_user_id, dedupe_key)
    VALUES (NEW.organization_id, NEW.id, 'status_change', NEW.requester_id,
            'status:' || NEW.id || ':' || NEW.status || ':' || extract(epoch from now())::text)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF NEW.status = 'open' AND OLD.status IN ('resolved','closed')
        AND current_setting('support.customer_reply', true) IS DISTINCT FROM NEW.id::text THEN
    PERFORM public._support_notify_staff(NEW.organization_id, NEW.assignee_id, 'Customer reopened ' || NEW.reference, NEW.subject);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_status_notify() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER support_tickets_status_notify AFTER UPDATE OF status ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_status_notify();

-- The ONE ticket email queued before sending was approved (read 2026-10-16): id a0ff58dd-c038-49ca-a212-e58bed67923e,
-- 'acknowledgement' for Dev Team ticket T-00001 (a staff test raised by Dev Team's owner on 2026-10-15 01:32 UTC, to that same
-- owner). Sending it now would be a stale "we received your ticket" for a resolved test. Only this row, only while still pending,
-- is cancelled; any other queued email is left exactly as it is for the sender-approval step.
UPDATE public.support_email_outbox SET status='cancelled', last_error='stale test acknowledgement queued before sending was approved', updated_at=now()
 WHERE id='a0ff58dd-c038-49ca-a212-e58bed67923e' AND status='pending' AND kind='acknowledgement';

-- Ticket queue claim now also returns the ticket status and skips recipients who switched email off for that company.
DROP FUNCTION public.support_outbox_claim(integer);
CREATE FUNCTION public.support_outbox_claim(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, recipient_user_id uuid, attempts integer, support_name text, reference text, subject text, reply_body text, ticket_status text, feedback_enabled boolean, organization_id uuid, ticket_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  UPDATE public.support_email_outbox o SET status='uncertain', last_error='sender stopped mid-send; provider outcome unknown', updated_at=now()
   WHERE o.status='sending' AND o.locked_until < now();
  UPDATE public.support_email_outbox o SET status='cancelled', last_error='recipient turned email off', updated_at=now()
   WHERE o.status IN ('pending','failed') AND EXISTS (SELECT 1 FROM public.support_notification_prefs p
     WHERE p.organization_id=o.organization_id AND p.user_id=o.recipient_user_id AND NOT p.email_enabled);
  RETURN QUERY
  WITH due AS (
    SELECT o.id FROM public.support_email_outbox o
     WHERE o.status IN ('pending','failed') AND o.attempts < 5 AND o.next_attempt_at <= now()
     ORDER BY o.created_at LIMIT least(greatest(_limit,1),50) FOR UPDATE SKIP LOCKED),
  upd AS (
    UPDATE public.support_email_outbox o SET status='sending', attempts=o.attempts+1, locked_until=now()+interval '5 minutes', updated_at=now()
     FROM due WHERE o.id=due.id RETURNING o.*)
  SELECT u.id, u.kind, u.recipient_user_id, u.attempts, s.support_name, t.reference, t.subject,
         CASE WHEN m.is_internal THEN NULL ELSE m.body END, -- private notes never leave the database
         t.status, s.feedback_enabled, u.organization_id, u.ticket_id
    FROM upd u JOIN public.support_tickets t ON t.id=u.ticket_id
    JOIN public.support_settings s ON s.organization_id=u.organization_id
    LEFT JOIN public.support_messages m ON m.id=u.message_id;
END $$;
REVOKE ALL ON FUNCTION public.support_outbox_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_outbox_claim(integer) TO service_role;

-- 7. Optional closure feedback: 1–5 + comment, one per closed ticket, only its customer submits, only staff read ----
ALTER TABLE public.support_settings ADD COLUMN feedback_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.support_ticket_feedback (
  ticket_id uuid PRIMARY KEY REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 2000),
  submitted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON public.support_ticket_feedback FROM anon;
GRANT SELECT ON public.support_ticket_feedback TO authenticated;
GRANT ALL ON public.support_ticket_feedback TO service_role;
ALTER TABLE public.support_ticket_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Support staff read feedback" ON public.support_ticket_feedback FOR SELECT TO authenticated
  USING (public.support_is_agent(organization_id));

CREATE FUNCTION public.support_submit_feedback(_ticket uuid, _rating integer, _comment text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE t public.support_tickets;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id=_ticket;
  IF NOT FOUND OR t.requester_id IS DISTINCT FROM auth.uid() OR NOT public.support_is_customer(t.organization_id) THEN
    RAISE EXCEPTION 'ticket not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.support_settings s WHERE s.organization_id=t.organization_id AND s.feedback_enabled) THEN
    RAISE EXCEPTION 'feedback is not switched on'; END IF;
  IF t.status <> 'closed' THEN RAISE EXCEPTION 'feedback opens when the ticket is closed'; END IF;
  IF _rating IS NULL OR _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'rating must be 1 to 5'; END IF;
  INSERT INTO public.support_ticket_feedback(ticket_id, organization_id, rating, comment, submitted_by)
  VALUES (_ticket, t.organization_id, _rating, nullif(left(btrim(coalesce(_comment,'')), 2000), ''), auth.uid())
  ON CONFLICT (ticket_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'feedback already submitted'; END IF;
END $$;
CREATE FUNCTION public.support_feedback_submitted(_ticket uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.support_ticket_feedback f WHERE f.ticket_id=_ticket AND f.submitted_by=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.support_submit_feedback(uuid,integer,text), public.support_feedback_submitted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_submit_feedback(uuid,integer,text), public.support_feedback_submitted(uuid) TO authenticated;

COMMIT;
