-- =====================================================================================================================
-- Phase 37: AI credit top-up packs (PREPARED, NOT APPLIED).
--
-- ORDER: 1. apply this; 2. deploy create-ai-topup-checkout and the updated stripe-webhook; 3. publish the frontend;
--        4. the owner sets AI_TOPUPS_ENABLED=true only after the real Solo purchase test (docs/phase37/README.md).
-- Until step 4 nobody can buy. Applying this alone changes nothing a user can see except two extra fields
-- (topup_credits, monthly_remaining) in the credit functions' answers; with no lots both equal today's numbers.
--
-- Owner decisions (2 Nov 2026): packs 100 credits £5, 300 £12, 1,000 £35 (one-off). Purchased credits last 12 months and
-- are used after the monthly allowance. Monthly credits don't roll over (unchanged). Only paying subscribers buy (their own
-- subscription, not a company's), plus owner / master accounts for testing. Trials keep 50 credits and nothing else.
--
-- What it does (one transaction; any check failing changes nothing):
--   1. public.phase37_function_backup / public.phase37_guard_log_backup: exact definitions, privileges and Phase 25 guard
--      log rows of the three functions replaced below (rollback.sql restores them byte for byte).
--   2. public.ai_topup_packs (the catalogue: the only source of credits and prices), public.ai_credit_lots (one row per
--      purchase; users may read their own), public.ai_topup_checkouts (checkouts started but maybe not paid; used for the
--      cap and the rate limit). public.ai_credit_ledger gains two nullable columns: topup_credits, topup_lots.
--   3. check_and_deduct_ai_credit / refund_ai_credit / get_ai_credits_info: same signatures, privileges and answer keys,
--      plus monthly_remaining and topup_credits (and topup_next_expiry for get_ai_credits_info). credits_remaining is now
--      monthly + unexpired top-up credits. The monthly logic (reset, limit, no roll-over, 50 for a missing row) is unchanged.
--   4. New, service role only: begin_ai_topup_checkout, attach_ai_topup_session, grant_ai_topup, void_ai_topup.
--      New, super admin: admin_ai_topup_summary. Every new SECURITY DEFINER function has the Phase 25 guard line and a
--      guard log row; the two replaced user functions' guard log rows are updated.
--
-- Production facts this was written against (read-only, 2 Nov 2026): md5(prosrc) check_and_deduct_ai_credit(uuid,integer,
-- text,uuid) 659fcdfaeb9073f49f1661316465e459, get_ai_credits_info(uuid) f6869e2ac74c56c9439f34e670508a79,
-- refund_ai_credit(uuid,integer,text,uuid) 538c31c2514b2cad8aa83e1dc205517f, ai_credit_ledger_append_only()
-- a54399ea2a9c9459257cfd3cacd02480 (all exactly the Phase 35 bodies). Any other body: refused.
--
-- Design notes (see README for the full list of failure cases):
--   * Ledger split: the reserve row itself carries topup_credits and topup_lots ([{"lot": uuid, "credits": n}]). One row
--     per request keeps every Phase 35 / 36 count (requests = reserve rows) correct and gives the refund the exact lots.
--   * Spending order: monthly first, then lots by soonest expiry. All or nothing, under a per-user advisory lock and the
--     subscriber row lock.
--   * Refund: idempotent per (user, request id) as before; gives back to the bucket the credits came from (top-up part
--     first, then monthly, never above what was taken). Monthly part never above the monthly limit; a lot that has expired
--     or been voided since does not take credits back: that part is lost (and shown in the refund row's topup_lots).
--   * Expiry is a date check everywhere; no cron. The monthly reset never touches lots.
--   * Cap 5,000 unexpired top-up credits per user, counting checkouts opened in the last 35 minutes (Stripe sessions are
--     created to expire after 30), so a paid checkout can never be refused at grant time by a second open checkout.
--     grant_ai_topup checks again; if it ever refused, the webhook records it as needs_refund (never silently dropped).
-- Rollback: docs/phase37/rollback.sql (refuses while customers hold purchased credits). Tests: docs/phase37/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ai_credit_lots') IS NOT NULL OR to_regclass('public.phase37_function_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 37 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.ai_credit_ledger') IS NULL OR to_regclass('public.phase25_mfa_guard_log') IS NULL THEN
    RAISE EXCEPTION 'Phase 35 / Phase 25 are not applied';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)')) IS DISTINCT FROM '659fcdfaeb9073f49f1661316465e459'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.get_ai_credits_info(uuid)')) IS DISTINCT FROM 'f6869e2ac74c56c9439f34e670508a79'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.refund_ai_credit(uuid,integer,text,uuid)')) IS DISTINCT FROM '538c31c2514b2cad8aa83e1dc205517f'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.ai_credit_ledger_append_only()')) IS DISTINCT FROM 'a54399ea2a9c9459257cfd3cacd02480' THEN
    RAISE EXCEPTION 'A credit function differs from the Phase 35 body this proposal was written against (2 Nov 2026); re-read it first';
  END IF;
  IF (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)') IS DISTINCT FROM '659fcdfaeb9073f49f1661316465e459'
     OR (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.get_ai_credits_info(uuid)') IS DISTINCT FROM 'f6869e2ac74c56c9439f34e670508a79' THEN
    RAISE EXCEPTION 'The Phase 25 guard log does not match the live functions';
  END IF;
  IF to_regprocedure('public._access_state_for(uuid)') IS NULL OR to_regprocedure('public._access_entitled(text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Phase 12 access functions are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
              AND p.proname IN ('grant_ai_topup', 'void_ai_topup', 'begin_ai_topup_checkout', 'attach_ai_topup_session',
                                'admin_ai_topup_summary', '_ai_topup_balance')) THEN
    RAISE EXCEPTION 'A Phase 37 function name is already taken';
  END IF;
END $$;

-- 1. Backups (rollback.sql reads them).
CREATE TABLE public.phase37_function_backup (
  fn text PRIMARY KEY, def text NOT NULL, src_md5 text NOT NULL, acl text, saved_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.phase37_function_backup (fn, def, src_md5, acl)
SELECT p.oid::regprocedure::text, pg_get_functiondef(p.oid), md5(p.prosrc), p.proacl::text
  FROM pg_proc p
 WHERE p.oid IN (to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)'),
                 to_regprocedure('public.get_ai_credits_info(uuid)'),
                 to_regprocedure('public.refund_ai_credit(uuid,integer,text,uuid)'));
CREATE TABLE public.phase37_guard_log_backup AS
  SELECT * FROM public.phase25_mfa_guard_log
   WHERE fn IN ('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'public.get_ai_credits_info(uuid)');
ALTER TABLE public.phase37_function_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase37_guard_log_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase37_function_backup, public.phase37_guard_log_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase37_function_backup, public.phase37_guard_log_backup TO service_role;

-- 2. Tables.
CREATE TABLE public.ai_topup_packs (
  id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{0,39}$'),
  credits integer NOT NULL CHECK (credits BETWEEN 1 AND 5000),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  currency text NOT NULL DEFAULT 'gbp' CHECK (currency = 'gbp'),
  active boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE public.ai_topup_packs IS 'Phase 37: the top-up catalogue. The only source of credits and prices; never taken from the client.';
INSERT INTO public.ai_topup_packs (id, credits, amount_pence) VALUES
  ('credits_100', 100, 500),
  ('credits_300', 300, 1200),
  ('credits_1000', 1000, 3500);

CREATE TABLE public.ai_credit_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credits_purchased integer NOT NULL CHECK (credits_purchased > 0),
  credits_remaining integer NOT NULL,
  credits_voided integer NOT NULL DEFAULT 0 CHECK (credits_voided >= 0),
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  pack_id text NOT NULL REFERENCES public.ai_topup_packs(id),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  currency text NOT NULL CHECK (currency = 'gbp'),
  stripe_checkout_session_id text NOT NULL UNIQUE CHECK (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  stripe_payment_intent_id text CHECK (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]{1,250}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
  voided_at timestamptz,
  CHECK (credits_remaining BETWEEN 0 AND credits_purchased),
  CHECK (credits_remaining + credits_voided <= credits_purchased)
);
COMMENT ON TABLE public.ai_credit_lots IS 'Phase 37: one row per AI credit top-up purchase. Credits last 12 months and are used after the monthly allowance.';
CREATE INDEX ai_credit_lots_user_expiry_idx ON public.ai_credit_lots (user_id, expires_at);
CREATE INDEX ai_credit_lots_payment_intent_idx ON public.ai_credit_lots (stripe_payment_intent_id);
CREATE INDEX ai_credit_lots_purchased_idx ON public.ai_credit_lots (purchased_at);

CREATE TABLE public.ai_topup_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pack_id text NOT NULL REFERENCES public.ai_topup_packs(id),
  credits integer NOT NULL CHECK (credits > 0),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'failed', 'needs_refund')),
  stripe_checkout_session_id text UNIQUE CHECK (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_topup_checkouts IS 'Phase 37: top-up checkouts started (paid or not). Used for the 5,000 cap and the one-a-minute limit.';
CREATE INDEX ai_topup_checkouts_user_created_idx ON public.ai_topup_checkouts (user_id, created_at);

-- The ledger split (one reserve row per request; see the header).
ALTER TABLE public.ai_credit_ledger
  ADD COLUMN topup_credits integer CHECK (topup_credits >= 0),
  ADD COLUMN topup_lots jsonb CHECK (topup_lots IS NULL OR jsonb_typeof(topup_lots) = 'array');

ALTER TABLE public.ai_topup_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_topup_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_topup_packs, public.ai_credit_lots, public.ai_topup_checkouts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_topup_packs, public.ai_credit_lots, public.ai_topup_checkouts TO service_role;
-- Users may read their own lots (the balance display); nobody but the functions below writes.
GRANT SELECT ON public.ai_credit_lots TO authenticated;
CREATE POLICY own_lots_read ON public.ai_credit_lots FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- Phase 25 convention for new tables.
CREATE POLICY require_aal2_if_enrolled ON public.ai_topup_packs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_credit_lots AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_topup_checkouts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- Unexpired, active top-up credits and the next expiry. Internal helper (not SECURITY DEFINER), service role only.
CREATE FUNCTION public._ai_topup_balance(p_user_id uuid)
 RETURNS TABLE (credits integer, next_expiry timestamptz)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT COALESCE(sum(l.credits_remaining), 0)::integer, min(l.expires_at) FILTER (WHERE l.credits_remaining > 0)
    FROM public.ai_credit_lots l
   WHERE l.user_id = p_user_id AND l.status = 'active' AND l.expires_at > now()
$function$;
REVOKE ALL ON FUNCTION public._ai_topup_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ai_topup_balance(uuid) TO service_role;

-- 3a. check_and_deduct_ai_credit: monthly first, then lots by soonest expiry; all or nothing.
CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1,
                                                              p_feature text DEFAULT 'ai_assistant', p_request_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_before integer;
  v_monthly integer;
  v_topup integer;
  v_from_monthly integer;
  v_from_topup integer;
  v_left integer;
  v_take integer;
  v_lot RECORD;
  v_lots jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF NOT (
    auth.uid() = p_user_id
    OR COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_credits_to_deduct IS NULL OR p_credits_to_deduct < 1 OR p_credits_to_deduct > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;
  IF p_feature IS NULL OR p_feature !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Invalid feature';
  END IF;

  -- One credit operation per user at a time (deduct, refund, grant, void).
  PERFORM pg_advisory_xact_lock(hashtextextended('ai_credits:' || p_user_id::text, 0));
  SELECT * INTO v_subscriber FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    -- Phase 35: trial / no-plan accounts start with 50 credits.
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id), false, 'free', 50, 50)
    RETURNING * INTO v_subscriber;
    INSERT INTO public.ai_credit_ledger (user_id, event, credits, balance_after, request_id, plan_key)
    VALUES (p_user_id, 'grant', 50, 50, p_request_id, v_subscriber.plan_key);
  END IF;

  -- The monthly reset touches the monthly counter only, never the lots.
  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    v_before := COALESCE(v_subscriber.ai_credits_remaining, 0);
    UPDATE public.subscribers
    SET ai_credits_remaining = ai_credits_limit,
        ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
    INSERT INTO public.ai_credit_ledger (user_id, event, credits, balance_after, request_id, plan_key)
    VALUES (p_user_id, 'reset', COALESCE(v_subscriber.ai_credits_remaining, 0) - v_before,
            v_subscriber.ai_credits_remaining, p_request_id, v_subscriber.plan_key);
  END IF;

  v_monthly := GREATEST(COALESCE(v_subscriber.ai_credits_remaining, 0), 0);
  SELECT b.credits INTO v_topup FROM public._ai_topup_balance(p_user_id) b;

  IF v_monthly + v_topup < p_credits_to_deduct THEN
    RETURN json_build_object(
      'success', false, 'error', 'insufficient_credits',
      'credits_remaining', v_monthly + v_topup,
      'credits_limit', v_subscriber.ai_credits_limit,
      'reset_date', v_subscriber.ai_credits_reset_date,
      'subscription_tier', v_subscriber.subscription_tier,
      'monthly_remaining', v_monthly,
      'topup_credits', v_topup);
  END IF;

  v_from_monthly := LEAST(v_monthly, p_credits_to_deduct);
  v_from_topup := p_credits_to_deduct - v_from_monthly;
  IF v_from_monthly > 0 THEN
    UPDATE public.subscribers
    SET ai_credits_remaining = ai_credits_remaining - v_from_monthly
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
  END IF;

  v_left := v_from_topup;
  IF v_left > 0 THEN
    FOR v_lot IN
      SELECT l.id, l.credits_remaining FROM public.ai_credit_lots l
       WHERE l.user_id = p_user_id AND l.status = 'active' AND l.expires_at > now() AND l.credits_remaining > 0
       ORDER BY l.expires_at, l.purchased_at, l.id
       FOR UPDATE
    LOOP
      EXIT WHEN v_left = 0;
      v_take := LEAST(v_left, v_lot.credits_remaining);
      UPDATE public.ai_credit_lots SET credits_remaining = credits_remaining - v_take WHERE id = v_lot.id;
      v_lots := v_lots || jsonb_build_array(jsonb_build_object('lot', v_lot.id, 'credits', v_take));
      v_left := v_left - v_take;
    END LOOP;
    IF v_left <> 0 THEN RAISE EXCEPTION 'top-up balance changed during the deduction'; END IF;
  END IF;
  v_topup := v_topup - v_from_topup;
  v_monthly := COALESCE(v_subscriber.ai_credits_remaining, 0);

  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, request_id, plan_key, topup_credits, topup_lots)
  VALUES (p_user_id, 'reserve', p_feature, -p_credits_to_deduct, v_monthly + v_topup, p_request_id, v_subscriber.plan_key,
          v_from_topup, CASE WHEN v_from_topup > 0 THEN v_lots END);

  RETURN json_build_object(
    'success', true,
    'credits_remaining', v_monthly + v_topup,
    'credits_limit', v_subscriber.ai_credits_limit,
    'reset_date', v_subscriber.ai_credits_reset_date,
    'subscription_tier', v_subscriber.subscription_tier,
    'monthly_remaining', v_monthly,
    'topup_credits', v_topup);
END;
$function$;

-- 3b. get_ai_credits_info: monthly (as before) + unexpired top-up credits and the next expiry.
CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id uuid DEFAULT auth.uid())
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_subscriber record; v_topup integer; v_expiry timestamptz;
begin
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  perform public.assert_self(p_user_id);
  select b.credits, b.next_expiry into v_topup, v_expiry from public._ai_topup_balance(p_user_id) b;
  select * into v_subscriber from public.subscribers where user_id = p_user_id;
  if not found then
    return json_build_object('credits_remaining',50 + v_topup,'credits_limit',50,
                             'reset_date', now() + interval '1 month','subscription_tier','free',
                             'monthly_remaining', 50, 'topup_credits', v_topup, 'topup_next_expiry', v_expiry);
  end if;
  if v_subscriber.ai_credits_reset_date <= now() then
    update public.subscribers set ai_credits_remaining = ai_credits_limit,
      ai_credits_reset_date = now() + interval '1 month'
    where user_id = p_user_id returning * into v_subscriber;
  end if;
  return json_build_object('credits_remaining', coalesce(v_subscriber.ai_credits_remaining, 0) + v_topup,
    'credits_limit', v_subscriber.ai_credits_limit, 'reset_date', v_subscriber.ai_credits_reset_date,
    'subscription_tier', v_subscriber.subscription_tier,
    'monthly_remaining', v_subscriber.ai_credits_remaining, 'topup_credits', v_topup, 'topup_next_expiry', v_expiry);
end;
$function$;

-- 3c. refund_ai_credit: back to the bucket the credits came from; idempotent per (user, request id).
CREATE OR REPLACE FUNCTION public.refund_ai_credit(p_user_id uuid, p_credits integer DEFAULT 1,
                                                    p_feature text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_before integer;
  v_after integer;
  v_limit integer;
  v_reset timestamptz;
  v_plan text;
  v_res_credits integer;
  v_res_topup integer := 0;
  v_res_lots jsonb;
  v_cap integer;
  v_topup_part integer := 0;
  v_monthly_part integer;
  v_need integer;
  v_n integer;
  v_lot_before integer;
  v_lot_after integer;
  v_given integer := 0;
  v_given_lots jsonb := '[]'::jsonb;
  v_e jsonb;
  v_topup integer;
BEGIN
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL OR p_credits IS NULL OR p_credits < 1 OR p_credits > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;
  IF p_feature IS NOT NULL AND p_feature !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Invalid feature';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai_credits:' || p_user_id::text, 0));
  SELECT ai_credits_remaining, ai_credits_limit, ai_credits_reset_date, plan_key INTO v_before, v_limit, v_reset, v_plan
    FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'no_subscriber', 'refunded', 0);
  END IF;

  -- Idempotent: this request was already refunded for this user. Nothing changes.
  IF p_request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ai_credit_ledger l
     WHERE l.request_id = p_request_id AND l.user_id = p_user_id AND l.event = 'refund'
  ) THEN
    SELECT b.credits INTO v_topup FROM public._ai_topup_balance(p_user_id) b;
    RETURN json_build_object(
      'success', true,
      'refunded', 0,
      'credits_remaining', COALESCE(v_before, 0) + v_topup,
      'credits_limit', v_limit,
      'reset_date', v_reset,
      'monthly_remaining', v_before,
      'topup_credits', v_topup);
  END IF;

  -- What the request took, and from where (Phase 37 reserve rows carry the split).
  IF p_request_id IS NOT NULL THEN
    SELECT l.credits, COALESCE(l.topup_credits, 0), l.topup_lots INTO v_res_credits, v_res_topup, v_res_lots
      FROM public.ai_credit_ledger l
     WHERE l.request_id = p_request_id AND l.user_id = p_user_id AND l.event = 'reserve'
     ORDER BY l.created_at DESC LIMIT 1;
  END IF;
  IF v_res_credits IS NOT NULL THEN
    v_cap := LEAST(p_credits, -v_res_credits);                  -- never more than was taken
    v_topup_part := LEAST(v_cap, COALESCE(v_res_topup, 0));      -- purchased credits first
    v_monthly_part := v_cap - v_topup_part;
  ELSE
    v_monthly_part := p_credits;                                 -- no reserve row (older callers): as before
  END IF;

  UPDATE public.subscribers
     SET ai_credits_remaining = GREATEST(COALESCE(ai_credits_remaining, 0),
                                         LEAST(COALESCE(ai_credits_limit, 0), COALESCE(ai_credits_remaining, 0) + v_monthly_part))
   WHERE user_id = p_user_id
  RETURNING ai_credits_remaining, ai_credits_reset_date INTO v_after, v_reset;

  -- Top-up part back to the same lots while they are active and unexpired; otherwise that part is lost.
  v_need := v_topup_part;
  IF v_need > 0 AND v_res_lots IS NOT NULL THEN
    FOR v_e IN SELECT * FROM jsonb_array_elements(v_res_lots) LOOP
      EXIT WHEN v_need = 0;
      v_n := LEAST(v_need, (v_e ->> 'credits')::integer);
      v_need := v_need - v_n;
      SELECT credits_remaining INTO v_lot_before FROM public.ai_credit_lots
       WHERE id = (v_e ->> 'lot')::uuid AND user_id = p_user_id AND status = 'active' AND expires_at > now() FOR UPDATE;
      IF FOUND THEN
        UPDATE public.ai_credit_lots SET credits_remaining = LEAST(credits_purchased - credits_voided, credits_remaining + v_n)
         WHERE id = (v_e ->> 'lot')::uuid RETURNING credits_remaining INTO v_lot_after;
        v_given := v_given + (v_lot_after - v_lot_before);
        v_given_lots := v_given_lots || jsonb_build_array(jsonb_build_object('lot', v_e ->> 'lot', 'credits', v_lot_after - v_lot_before));
      ELSE
        v_given_lots := v_given_lots || jsonb_build_array(jsonb_build_object('lot', v_e ->> 'lot', 'credits', 0, 'lost', v_n));
      END IF;
    END LOOP;
  END IF;
  SELECT b.credits INTO v_topup FROM public._ai_topup_balance(p_user_id) b;

  -- Always written (even when nothing came back), so a retry of this request is recognised.
  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, request_id, plan_key, topup_credits, topup_lots)
  VALUES (p_user_id, 'refund', p_feature, GREATEST(0, v_after - COALESCE(v_before, 0)) + v_given, COALESCE(v_after, 0) + v_topup,
          p_request_id, v_plan, v_given, CASE WHEN v_topup_part > 0 THEN v_given_lots END);

  RETURN json_build_object(
    'success', true,
    'refunded', GREATEST(0, v_after - COALESCE(v_before, 0)) + v_given,
    'credits_remaining', COALESCE(v_after, 0) + v_topup,
    'credits_limit', v_limit,
    'reset_date', v_reset,
    'monthly_remaining', v_after,
    'topup_credits', v_topup);
END;
$function$;

-- 4a. begin_ai_topup_checkout: who may buy, the cap, the rate limit. Called by create-ai-topup-checkout BEFORE Stripe.
CREATE FUNCTION public.begin_ai_topup_checkout(p_user_id uuid, p_pack_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_pack RECORD;
  v_state RECORD;
  v_topup integer;
  v_pending integer;
  v_id uuid;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  SELECT * INTO v_pack FROM public.ai_topup_packs WHERE id = p_pack_id AND active;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'unknown_pack'); END IF;

  -- Buyers: their own paid subscription (not a company's), or owner / master accounts (testing).
  SELECT * INTO v_state FROM public._access_state_for(p_user_id) LIMIT 1;
  IF NOT FOUND OR NOT ((v_state.state = 'subscribed' AND v_state.via = 'self') OR v_state.state = 'owner') THEN
    RETURN json_build_object('success', false, 'error', 'not_subscriber',
                             'state', COALESCE(v_state.state, 'none'), 'via', v_state.via);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai_credits:' || p_user_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.ai_topup_checkouts c WHERE c.user_id = p_user_id AND c.created_at > now() - interval '60 seconds') THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;
  SELECT b.credits INTO v_topup FROM public._ai_topup_balance(p_user_id) b;
  SELECT COALESCE(sum(c.credits), 0) INTO v_pending FROM public.ai_topup_checkouts c
   WHERE c.user_id = p_user_id AND c.status = 'open' AND c.created_at > now() - interval '35 minutes';
  IF v_topup + v_pending + v_pack.credits > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'topup_cap_exceeded', 'topup_credits', v_topup, 'pending_credits', v_pending, 'cap', 5000);
  END IF;

  INSERT INTO public.ai_topup_checkouts (user_id, pack_id, credits, amount_pence)
  VALUES (p_user_id, v_pack.id, v_pack.credits, v_pack.amount_pence) RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'checkout_id', v_id, 'pack_id', v_pack.id, 'credits', v_pack.credits,
                           'amount_pence', v_pack.amount_pence, 'currency', v_pack.currency);
END;
$function$;

-- 4b. attach_ai_topup_session: the Stripe session id for a started checkout (NULL = Stripe failed: the checkout is closed).
CREATE FUNCTION public.attach_ai_topup_session(p_checkout_id uuid, p_session_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.ai_topup_checkouts
     SET stripe_checkout_session_id = p_session_id, status = CASE WHEN p_session_id IS NULL THEN 'failed' ELSE status END, updated_at = now()
   WHERE id = p_checkout_id AND status = 'open' AND stripe_checkout_session_id IS NULL;
  RETURN json_build_object('success', FOUND);
END;
$function$;

-- 4c. grant_ai_topup: ONLY after Stripe confirmed payment (stripe-webhook). Idempotent on the checkout session id.
CREATE FUNCTION public.grant_ai_topup(p_user_id uuid, p_pack_id text, p_checkout_session_id text,
                                      p_payment_intent_id text, p_amount_pence integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_pack RECORD;
  v_lot RECORD;
  v_topup integer;
  v_monthly integer;
  v_plan text;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL OR p_checkout_session_id IS NULL OR p_checkout_session_id !~ '^cs_[A-Za-z0-9_]{1,250}$' THEN
    RETURN json_build_object('success', false, 'error', 'invalid_request');
  END IF;

  -- A repeat delivery returns the same lot and grants nothing.
  SELECT * INTO v_lot FROM public.ai_credit_lots WHERE stripe_checkout_session_id = p_checkout_session_id;
  IF FOUND THEN
    IF v_lot.user_id IS DISTINCT FROM p_user_id THEN
      RETURN json_build_object('success', false, 'error', 'session_user_mismatch');
    END IF;
    RETURN json_build_object('success', true, 'duplicate', true, 'granted', 0, 'lot_id', v_lot.id,
                             'credits', v_lot.credits_purchased, 'expires_at', v_lot.expires_at);
  END IF;

  SELECT * INTO v_pack FROM public.ai_topup_packs WHERE id = p_pack_id;   -- a pack switched off after payment still grants
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'unknown_pack'); END IF;
  IF p_amount_pence IS DISTINCT FROM v_pack.amount_pence THEN
    RETURN json_build_object('success', false, 'error', 'amount_mismatch', 'expected', v_pack.amount_pence, 'received', p_amount_pence);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'unknown_user');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai_credits:' || p_user_id::text, 0));
  SELECT b.credits INTO v_topup FROM public._ai_topup_balance(p_user_id) b;
  IF v_topup + v_pack.credits > 5000 THEN
    -- Should not happen (begin_ai_topup_checkout counts open checkouts). Never silently dropped: marked for a refund.
    UPDATE public.ai_topup_checkouts SET status = 'needs_refund', updated_at = now() WHERE stripe_checkout_session_id = p_checkout_session_id;
    RETURN json_build_object('success', false, 'error', 'topup_cap_exceeded', 'topup_credits', v_topup, 'cap', 5000);
  END IF;

  INSERT INTO public.ai_credit_lots (user_id, credits_purchased, credits_remaining, purchased_at, expires_at, pack_id,
                                     amount_pence, currency, stripe_checkout_session_id, stripe_payment_intent_id)
  VALUES (p_user_id, v_pack.credits, v_pack.credits, now(), now() + interval '12 months', v_pack.id,
          p_amount_pence, v_pack.currency, p_checkout_session_id, p_payment_intent_id)
  RETURNING * INTO v_lot;
  UPDATE public.ai_topup_checkouts SET status = 'paid', updated_at = now() WHERE stripe_checkout_session_id = p_checkout_session_id;

  SELECT s.ai_credits_remaining, s.plan_key INTO v_monthly, v_plan FROM public.subscribers s WHERE s.user_id = p_user_id;
  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, plan_key, topup_credits, topup_lots)
  VALUES (p_user_id, 'topup', 'topup', v_pack.credits, COALESCE(v_monthly, 0) + v_topup + v_pack.credits, v_plan, v_pack.credits,
          jsonb_build_array(jsonb_build_object('lot', v_lot.id, 'credits', v_pack.credits)));

  RETURN json_build_object('success', true, 'duplicate', false, 'granted', v_pack.credits, 'lot_id', v_lot.id,
                           'credits', v_pack.credits, 'expires_at', v_lot.expires_at);
END;
$function$;

-- 4d. void_ai_topup: on a refund or dispute. Unused credits are removed; credits already spent stay spent.
CREATE FUNCTION public.void_ai_topup(p_checkout_session_id text, p_payment_intent_id text, p_reason text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_lot RECORD;
  v_removed integer;
  v_topup integer;
  v_monthly integer;
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_lot FROM public.ai_credit_lots
   WHERE (p_checkout_session_id IS NOT NULL AND stripe_checkout_session_id = p_checkout_session_id)
      OR (p_checkout_session_id IS NULL AND p_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_payment_intent_id)
   ORDER BY purchased_at LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'not_found'); END IF;   -- not a top-up payment
  IF v_lot.user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('ai_credits:' || v_lot.user_id::text, 0));
  END IF;
  SELECT * INTO v_lot FROM public.ai_credit_lots WHERE id = v_lot.id FOR UPDATE;
  IF v_lot.status = 'voided' THEN
    RETURN json_build_object('success', true, 'duplicate', true, 'removed', 0, 'lot_id', v_lot.id);
  END IF;

  v_removed := v_lot.credits_remaining;
  UPDATE public.ai_credit_lots
     SET status = 'voided', credits_voided = credits_voided + credits_remaining, credits_remaining = 0, voided_at = now()
   WHERE id = v_lot.id;
  SELECT b.credits INTO v_topup FROM public._ai_topup_balance(v_lot.user_id) b;
  SELECT s.ai_credits_remaining INTO v_monthly FROM public.subscribers s WHERE s.user_id = v_lot.user_id;
  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, topup_credits, topup_lots)
  VALUES (v_lot.user_id, 'adjust', 'topup', -v_removed, COALESCE(v_monthly, 0) + v_topup, 0,
          jsonb_build_array(jsonb_build_object('lot', v_lot.id, 'credits', -v_removed,
                                               'reason', left(COALESCE(p_reason, 'refund'), 40))));
  RETURN json_build_object('success', true, 'duplicate', false, 'removed', v_removed, 'lot_id', v_lot.id);
END;
$function$;

-- 4e. admin_ai_topup_summary: guarded like admin_ai_stats.
CREATE FUNCTION public.admin_ai_topup_summary(_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(_days, 30), 1), 800);
  v_from timestamptz;
BEGIN
  PERFORM public.require_aal2_admin(); -- phase25 mfa guard
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_from := date_trunc('day', now()) - ((v_days - 1) || ' days')::interval;
  RETURN jsonb_build_object(
    'days', v_days,
    'packs_sold', (SELECT count(*) FROM public.ai_credit_lots l WHERE l.purchased_at >= v_from),
    'revenue_pence', (SELECT COALESCE(sum(l.amount_pence), 0) FROM public.ai_credit_lots l WHERE l.purchased_at >= v_from AND l.status = 'active'),
    'refunded_pence', (SELECT COALESCE(sum(l.amount_pence), 0) FROM public.ai_credit_lots l WHERE l.purchased_at >= v_from AND l.status = 'voided'),
    'by_pack', (SELECT COALESCE(jsonb_agg(x ORDER BY x.credits), '[]'::jsonb) FROM (
        SELECT p.id AS pack_id, p.credits, p.amount_pence,
               (SELECT count(*) FROM public.ai_credit_lots l WHERE l.pack_id = p.id AND l.purchased_at >= v_from) AS sold,
               (SELECT count(*) FROM public.ai_credit_lots l WHERE l.pack_id = p.id AND l.purchased_at >= v_from AND l.status = 'voided') AS voided
          FROM public.ai_topup_packs p) x),
    -- All lots, whatever the window (balances are not per period).
    'credits_sold', (SELECT COALESCE(sum(l.credits_purchased), 0) FROM public.ai_credit_lots l),
    'credits_used', (SELECT COALESCE(sum(l.credits_purchased - l.credits_remaining - l.credits_voided), 0) FROM public.ai_credit_lots l),
    'credits_unused', (SELECT COALESCE(sum(l.credits_remaining), 0) FROM public.ai_credit_lots l WHERE l.status = 'active' AND l.expires_at > now()),
    'credits_expired', (SELECT COALESCE(sum(l.credits_remaining), 0) FROM public.ai_credit_lots l WHERE l.status = 'active' AND l.expires_at <= now()),
    'credits_voided', (SELECT COALESCE(sum(l.credits_voided), 0) FROM public.ai_credit_lots l),
    'needs_refund', (SELECT count(*) FROM public.ai_topup_checkouts c WHERE c.status = 'needs_refund')
  );
END;
$function$;

-- Privileges. Replaced functions keep theirs (CREATE OR REPLACE). New ones: service role only, except the admin summary.
REVOKE ALL ON FUNCTION public.begin_ai_topup_checkout(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_ai_topup_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_ai_topup(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.void_ai_topup(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_ai_topup_checkout(uuid, text), public.attach_ai_topup_session(uuid, text),
  public.grant_ai_topup(uuid, text, text, text, integer), public.void_ai_topup(text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_ai_topup_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ai_topup_summary(integer) TO service_role, authenticated;

-- 5. Phase 25 guard log (docs/phase25/rollback.sql strips exactly these lines).
DO $$
DECLARE
  user_snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  admin_snip constant text := E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard';
  r record; src text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'user', false),
      ('public.get_ai_credits_info(uuid)', 'user', false),
      ('public.begin_ai_topup_checkout(uuid,text)', 'user', true),
      ('public.attach_ai_topup_session(uuid,text)', 'user', true),
      ('public.grant_ai_topup(uuid,text,text,text,integer)', 'user', true),
      ('public.void_ai_topup(text,text,text)', 'user', true),
      ('public.admin_ai_topup_summary(integer)', 'admin', true)) AS t(fn, kind, is_new) LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(r.fn);
    IF position(CASE r.kind WHEN 'admin' THEN admin_snip ELSE user_snip END in src) = 0 THEN
      RAISE EXCEPTION '% has no guard line', r.fn;
    END IF;
    IF r.is_new THEN
      INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5)
      VALUES (r.fn, r.kind, md5(replace(src, CASE r.kind WHEN 'admin' THEN admin_snip ELSE user_snip END, '')), md5(src));
    ELSE
      UPDATE public.phase25_mfa_guard_log SET old_md5 = md5(replace(src, user_snip, '')), new_md5 = md5(src) WHERE fn = r.fn;
      IF NOT FOUND THEN RAISE EXCEPTION 'guard log row % missing', r.fn; END IF;
    END IF;
  END LOOP;
END $$;

-- 6. Final checks.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.begin_ai_topup_checkout(uuid,text)', 'public.attach_ai_topup_session(uuid,text)',
                           'public.grant_ai_topup(uuid,text,text,text,integer)', 'public.void_ai_topup(text,text,text)',
                           'public._ai_topup_balance(uuid)', 'public.refund_ai_credit(uuid,integer,text,uuid)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE')
       OR NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% must be service role only', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'public.get_ai_credits_info(uuid)', 'public.admin_ai_topup_summary(integer)'] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '% privileges are not as intended', f;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.phase37_function_backup b
              WHERE (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure('public.' || b.fn))) x)
                    IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(b.acl::text[]) x)) THEN
    RAISE EXCEPTION 'a replaced function lost its privileges';
  END IF;
  IF has_table_privilege('anon', 'public.ai_credit_lots', 'SELECT') OR has_table_privilege('authenticated', 'public.ai_credit_lots', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ai_credit_lots', 'UPDATE') OR has_table_privilege('authenticated', 'public.ai_credit_lots', 'DELETE')
     OR has_table_privilege('authenticated', 'public.ai_topup_packs', 'SELECT') OR has_table_privilege('authenticated', 'public.ai_topup_checkouts', 'SELECT') THEN
    RAISE EXCEPTION 'top-up tables are writable or readable beyond what is intended';
  END IF;
END $$;

COMMIT;

-- =====================================================================================================================
-- CHECKS AFTER APPLYING (read-only):
--   SELECT * FROM public.ai_topup_packs ORDER BY credits;
--   SELECT p.oid::regprocedure, p.proacl FROM pg_proc p WHERE p.proname IN ('check_and_deduct_ai_credit','refund_ai_credit',
--     'get_ai_credits_info','begin_ai_topup_checkout','attach_ai_topup_session','grant_ai_topup','void_ai_topup','admin_ai_topup_summary');
--   SELECT fn, kind FROM public.phase25_mfa_guard_log WHERE fn ~ 'topup|credit';
-- =====================================================================================================================
