-- =====================================================================================================================
-- Phase 35: AI credit ledger, real AI cost tracking, trial credits 10 -> 50 (PREPARED, NOT APPLIED).
--
-- ORDER: apply this FIRST, then deploy ai-assistant and generate-legal-document (they pass p_feature / p_request_id and
-- call record_ai_usage, which only exist after this), then publish the frontend. Until the functions are redeployed the
-- old two-argument calls keep working (the new parameters are defaulted), so applying this alone breaks nothing.
--
-- What it does (one transaction; every check failing changes nothing):
--   1. public.phase35_function_backup and public.phase35_guard_log_backup: the exact definitions, privileges and Phase 25
--      guard log rows of the three functions changed below, read in this transaction, so rollback.sql restores them
--      byte for byte. Service role only.
--   2. public.ai_credit_ledger (append-only history of every credit movement and every AI call's token cost; it never
--      holds prompts, answers or document text) and public.ai_model_prices (USD per million tokens; changed by hand
--      with SQL when OpenAI changes prices). RLS on, no policy for anon/authenticated, the Phase 25 RESTRICTIVE
--      "require_aal2_if_enrolled" policy (same statement as docs/phase25), REVOKE ALL from anon/authenticated.
--      Admins read through public.admin_ai_ledger_summary; the Edge Functions write as service_role.
--   3. public.check_and_deduct_ai_credit(uuid, integer, text, uuid): + p_feature, p_request_id. Writes a 'reserve'
--      row with the deduction, a 'grant' row when it creates the missing subscribers row (now 50 / 50, was 10 / 10)
--      and a 'reset' row when it performs the monthly reset, all in the same transaction. The old two-argument
--      function is DROPPED in this transaction (no ambiguous overload) and the new one gets exactly its privileges.
--   4. public.get_ai_credits_info(uuid): the "no subscribers row" answer is 50 / 50 (was 10 / 10). Nothing else.
--   5. public.refund_ai_credit(uuid, integer, text, uuid): + p_feature, p_request_id; writes a 'refund' row with the
--      amount actually refunded; a second refund for the same user and request_id changes nothing and answers
--      refunded 0 (so a retry can never refund twice). Same cap, same service-role-only rule, old function dropped.
--   6. public.record_ai_usage(...): service role only; one 'usage' row with tokens and our cost in micro-dollars.
--   7. public.admin_ai_ledger_summary(_days): super admins (aal2), the data Phase 36 will chart.
--   8. Phase 25 guard log: the replaced/changed user functions and the new admin function are recorded exactly like the
--      others (fn, kind, old_md5 = body without the guard line, new_md5 = body), so docs/phase25/rollback.sql still
--      works after this phase.
--
-- Production facts this was written against (read-only, 2 Nov 2026):
--   md5(prosrc): check_and_deduct_ai_credit(uuid,integer) be23bdba849254ef8dda291c9beee2e5,
--                get_ai_credits_info(uuid) 2cac6615542d149b7ae9b126b1388280, refund_ai_credit(uuid,integer)
--                95d05a5b34ea3acaeffd955c43eb67c0. Any other body: refused.
--   proacl: check_and_deduct_ai_credit {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
--           refund_ai_credit           {postgres=X/postgres,service_role=X/postgres}
--           get_ai_credits_info        {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres} (unchanged:
--                                       CREATE OR REPLACE keeps it)
--
-- Prices seeded (USD per 1M tokens): gpt-4.1 2.00 / 8.00 (owner, 2 Nov 2026); gpt-4o-mini 0.15 / 0.60 (OpenAI list
-- price as reported by pricing aggregators, e.g. pricepertoken.com and cloudprice.net, 2 Nov 2026; openai.com was not
-- reachable from the build session). Check https://openai.com/api/pricing and update with:
--   UPDATE public.ai_model_prices SET input_usd_per_million = .., output_usd_per_million = .., updated_at = now() WHERE model = '..';
--
-- Retention: keep ledger rows for 25 months (two full yearly comparisons plus a month). A purge job is NOT part of this
-- phase. The table is append-only (trigger); a future purge sets `SET LOCAL app.ai_ledger_purge = 'on'` in its own
-- transaction before DELETE ... WHERE created_at < now() - interval '25 months'.
--
-- Rollback: docs/phase35/rollback.sql. Tests: docs/phase35/run-test.sh (disposable local Postgres).
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ai_credit_ledger') IS NOT NULL OR to_regclass('public.phase35_function_backup') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 35 already exists (applied twice?)';
  END IF;
  IF to_regprocedure('public.require_aal2_if_enrolled()') IS NULL OR to_regprocedure('public.require_aal2_admin()') IS NULL
     OR to_regprocedure('public.mfa_ok()') IS NULL OR to_regclass('public.phase25_mfa_guard_log') IS NULL THEN
    RAISE EXCEPTION 'Phase 25 is not applied';
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer)')) IS DISTINCT FROM 'be23bdba849254ef8dda291c9beee2e5'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.get_ai_credits_info(uuid)')) IS DISTINCT FROM '2cac6615542d149b7ae9b126b1388280'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.refund_ai_credit(uuid,integer)')) IS DISTINCT FROM '95d05a5b34ea3acaeffd955c43eb67c0' THEN
    RAISE EXCEPTION 'A credit function differs from the one this proposal was written against (2 Nov 2026); re-read it first';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('check_and_deduct_ai_credit', 'refund_ai_credit', 'get_ai_credits_info',
                                                   'record_ai_usage', 'admin_ai_ledger_summary')) <> 3 THEN
    RAISE EXCEPTION 'Unexpected overloads or names already taken';
  END IF;
  IF (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.check_and_deduct_ai_credit(uuid,integer)') IS DISTINCT FROM 'be23bdba849254ef8dda291c9beee2e5'
     OR (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.get_ai_credits_info(uuid)') IS DISTINCT FROM '2cac6615542d149b7ae9b126b1388280' THEN
    RAISE EXCEPTION 'The Phase 25 guard log does not match the live functions';
  END IF;
END $$;

-- 1. Backup of what this replaces (rollback.sql reads it).
CREATE TABLE public.phase35_function_backup (
  fn text PRIMARY KEY, def text NOT NULL, src_md5 text NOT NULL, acl text, saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phase35_function_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase35_function_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase35_function_backup TO service_role;
INSERT INTO public.phase35_function_backup (fn, def, src_md5, acl)
SELECT p.oid::regprocedure::text, pg_get_functiondef(p.oid), md5(p.prosrc), p.proacl::text
  FROM pg_proc p
 WHERE p.oid IN (to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer)'),
                 to_regprocedure('public.get_ai_credits_info(uuid)'),
                 to_regprocedure('public.refund_ai_credit(uuid,integer)'));
CREATE TABLE public.phase35_guard_log_backup AS
  SELECT * FROM public.phase25_mfa_guard_log
   WHERE fn IN ('public.check_and_deduct_ai_credit(uuid,integer)', 'public.get_ai_credits_info(uuid)');
ALTER TABLE public.phase35_guard_log_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase35_guard_log_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase35_guard_log_backup TO service_role;
-- The privileges this proposal copies below must be the ones read here.
DO $$
BEGIN
  -- Compared as sets (the order of the entries depends only on the order of past GRANTs).
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT acl FROM public.phase35_function_backup WHERE fn = 'check_and_deduct_ai_credit(uuid,integer)')::text[]) x)
       IS DISTINCT FROM ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']
     OR (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT acl FROM public.phase35_function_backup WHERE fn = 'refund_ai_credit(uuid,integer)')::text[]) x)
       IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres'] THEN
    RAISE EXCEPTION 'Function privileges differ from 2 Nov 2026; update the GRANTs in this proposal first';
  END IF;
END $$;

-- 2. Tables.
CREATE TABLE public.ai_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- ON DELETE SET NULL: history survives account deletion without the person.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN ('reserve', 'refund', 'usage', 'reset', 'grant', 'topup', 'adjust')),
  feature text CHECK (feature ~ '^[a-z][a-z0-9_]{0,39}$'),
  doc_type text CHECK (doc_type ~ '^[a-z][a-z0-9_]{0,59}$'),
  credits integer NOT NULL,
  balance_after integer,
  request_id uuid,
  model text CHECK (length(model) BETWEEN 1 AND 100),
  prompt_tokens integer CHECK (prompt_tokens BETWEEN 0 AND 2000000),
  completion_tokens integer CHECK (completion_tokens BETWEEN 0 AND 2000000),
  cost_usd_micros bigint CHECK (cost_usd_micros >= 0),
  plan_key text CHECK (length(plan_key) <= 60)
);
COMMENT ON TABLE public.ai_credit_ledger IS
  'Phase 35: append-only AI credit history (reserve -, refund +, usage 0 with tokens/cost, reset/grant/topup +, adjust +/-). Never prompts, answers or document text. Keep 25 months.';
CREATE INDEX ai_credit_ledger_created_at_idx ON public.ai_credit_ledger (created_at);
CREATE INDEX ai_credit_ledger_user_created_idx ON public.ai_credit_ledger (user_id, created_at);
CREATE INDEX ai_credit_ledger_feature_created_idx ON public.ai_credit_ledger (feature, created_at);
CREATE INDEX ai_credit_ledger_request_idx ON public.ai_credit_ledger (request_id);

-- Append-only: no UPDATE or DELETE, except the FK's own ON DELETE SET NULL (only user_id becomes NULL) and an explicit
-- purge transaction (SET LOCAL app.ai_ledger_purge = 'on').
CREATE FUNCTION public.ai_credit_ledger_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.user_id is null and old.user_id is not null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  if tg_op = 'DELETE' and coalesce(current_setting('app.ai_ledger_purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'ai_credit_ledger is append-only' using errcode = '42501';
end;
$function$;
REVOKE ALL ON FUNCTION public.ai_credit_ledger_append_only() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ai_credit_ledger_append_only BEFORE UPDATE OR DELETE ON public.ai_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ai_credit_ledger_append_only();

CREATE TABLE public.ai_model_prices (
  model text PRIMARY KEY CHECK (length(model) BETWEEN 1 AND 100),
  input_usd_per_million numeric NOT NULL CHECK (input_usd_per_million >= 0),
  output_usd_per_million numeric NOT NULL CHECK (output_usd_per_million >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_model_prices (model, input_usd_per_million, output_usd_per_million) VALUES
  ('gpt-4.1', 2.00, 8.00),
  ('gpt-4o-mini', 0.15, 0.60);

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_credit_ledger, public.ai_model_prices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_credit_ledger, public.ai_model_prices TO service_role;
-- Phase 25 convention for new tables (same statement as docs/phase25/proposal.sql step 3). With no permissive policy
-- for anon/authenticated nobody can read or write them through the API anyway; this keeps the convention.
CREATE POLICY require_aal2_if_enrolled ON public.ai_credit_ledger AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_model_prices AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- 3. check_and_deduct_ai_credit: same body, plus the ledger rows and 50 / 50 for a missing row.
DROP FUNCTION public.check_and_deduct_ai_credit(uuid, integer);
CREATE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1,
                                                   p_feature text DEFAULT 'ai_assistant', p_request_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_result JSON;
  v_before integer;
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

  SELECT * INTO v_subscriber FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    -- Phase 35: trial / no-plan accounts start with 50 credits (was 10).
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id), false, 'free', 50, 50)
    RETURNING * INTO v_subscriber;
    INSERT INTO public.ai_credit_ledger (user_id, event, credits, balance_after, request_id, plan_key)
    VALUES (p_user_id, 'grant', 50, 50, p_request_id, v_subscriber.plan_key);
  END IF;

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

  IF v_subscriber.ai_credits_remaining < p_credits_to_deduct THEN
    RETURN json_build_object(
      'success', false, 'error', 'insufficient_credits',
      'credits_remaining', v_subscriber.ai_credits_remaining,
      'credits_limit', v_subscriber.ai_credits_limit,
      'reset_date', v_subscriber.ai_credits_reset_date,
      'subscription_tier', v_subscriber.subscription_tier);
  END IF;

  UPDATE public.subscribers
  SET ai_credits_remaining = ai_credits_remaining - p_credits_to_deduct
  WHERE user_id = p_user_id
  RETURNING json_build_object(
    'success', true,
    'credits_remaining', ai_credits_remaining,
    'credits_limit', ai_credits_limit,
    'reset_date', ai_credits_reset_date,
    'subscription_tier', subscription_tier) INTO v_result;

  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, request_id, plan_key)
  VALUES (p_user_id, 'reserve', p_feature, -p_credits_to_deduct, (v_result ->> 'credits_remaining')::integer,
          p_request_id, v_subscriber.plan_key);

  RETURN v_result;
END;
$function$;
-- Exactly the old privileges: {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}.
REVOKE ALL ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer, text, uuid) TO service_role, authenticated;

-- 4. get_ai_credits_info: the "no row" answer is 50 / 50 (what check_and_deduct_ai_credit will create). Nothing else.
CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id uuid DEFAULT auth.uid())
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_subscriber record;
begin
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  perform public.assert_self(p_user_id);
  select * into v_subscriber from public.subscribers where user_id = p_user_id;
  if not found then
    return json_build_object('credits_remaining',50,'credits_limit',50,
                             'reset_date', now() + interval '1 month','subscription_tier','free');
  end if;
  if v_subscriber.ai_credits_reset_date <= now() then
    update public.subscribers set ai_credits_remaining = ai_credits_limit,
      ai_credits_reset_date = now() + interval '1 month'
    where user_id = p_user_id returning * into v_subscriber;
  end if;
  return json_build_object('credits_remaining', v_subscriber.ai_credits_remaining,
    'credits_limit', v_subscriber.ai_credits_limit, 'reset_date', v_subscriber.ai_credits_reset_date,
    'subscription_tier', v_subscriber.subscription_tier);
end;
$function$;

-- 5. refund_ai_credit: same cap and rule, plus the ledger row and idempotence per (user, request_id).
DROP FUNCTION public.refund_ai_credit(uuid, integer);
CREATE FUNCTION public.refund_ai_credit(p_user_id uuid, p_credits integer DEFAULT 1,
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

  -- The row lock comes first, so two retries of the same refund run one after the other.
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
    RETURN json_build_object(
      'success', true,
      'refunded', 0,
      'credits_remaining', v_before,
      'credits_limit', v_limit,
      'reset_date', v_reset);
  END IF;

  UPDATE public.subscribers
     SET ai_credits_remaining = GREATEST(COALESCE(ai_credits_remaining, 0),
                                         LEAST(COALESCE(ai_credits_limit, 0), COALESCE(ai_credits_remaining, 0) + p_credits))
   WHERE user_id = p_user_id
  RETURNING ai_credits_remaining, ai_credits_reset_date INTO v_after, v_reset;

  -- Always written (even when the cap made it 0), so a retry of this request is recognised.
  INSERT INTO public.ai_credit_ledger (user_id, event, feature, credits, balance_after, request_id, plan_key)
  VALUES (p_user_id, 'refund', p_feature, GREATEST(0, v_after - COALESCE(v_before, 0)), v_after, p_request_id, v_plan);

  RETURN json_build_object(
    'success', true,
    'refunded', GREATEST(0, v_after - COALESCE(v_before, 0)),
    'credits_remaining', v_after,
    'credits_limit', v_limit,
    'reset_date', v_reset);
END;
$function$;
-- Exactly the old privileges: {postgres=X/postgres,service_role=X/postgres}.
REVOKE ALL ON FUNCTION public.refund_ai_credit(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(uuid, integer, text, uuid) TO service_role;

-- 6. record_ai_usage: one 'usage' row per AI call with tokens and our cost. Service role only.
CREATE FUNCTION public.record_ai_usage(p_user_id uuid, p_request_id uuid, p_feature text, p_doc_type text,
                                       p_model text, p_prompt_tokens integer, p_completion_tokens integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_in numeric;
  v_out numeric;
  v_cost bigint;
  v_plan text;
BEGIN
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_feature IS NULL OR p_feature !~ '^[a-z][a-z0-9_]{0,39}$' THEN RAISE EXCEPTION 'Invalid feature'; END IF;
  IF p_doc_type IS NOT NULL AND p_doc_type !~ '^[a-z][a-z0-9_]{0,59}$' THEN RAISE EXCEPTION 'Invalid doc_type'; END IF;
  IF p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid model'; END IF;
  IF p_prompt_tokens IS NULL OR p_prompt_tokens NOT BETWEEN 0 AND 2000000
     OR p_completion_tokens IS NULL OR p_completion_tokens NOT BETWEEN 0 AND 2000000 THEN
    RAISE EXCEPTION 'Invalid token count';
  END IF;

  SELECT m.input_usd_per_million, m.output_usd_per_million INTO v_in, v_out
    FROM public.ai_model_prices m WHERE m.model = p_model;
  IF FOUND THEN
    -- tokens x (USD per million tokens) = millionths of a dollar. round() on numeric rounds half away from zero, which
    -- is half up for these non-negative values.
    v_cost := round(p_prompt_tokens * v_in + p_completion_tokens * v_out)::bigint;
  END IF; -- no price row: cost stays NULL, never an error

  SELECT s.plan_key INTO v_plan FROM public.subscribers s WHERE s.user_id = p_user_id;

  INSERT INTO public.ai_credit_ledger (user_id, event, feature, doc_type, credits, request_id, model,
                                       prompt_tokens, completion_tokens, cost_usd_micros, plan_key)
  VALUES (p_user_id, 'usage', p_feature, p_doc_type, 0, p_request_id, p_model,
          p_prompt_tokens, p_completion_tokens, v_cost, v_plan);

  RETURN json_build_object('success', true, 'cost_usd_micros', v_cost);
END;
$function$;
REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, uuid, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, uuid, text, text, text, integer, integer) TO service_role;

-- 7. admin_ai_ledger_summary: guarded exactly like admin_ai_stats (require_aal2_admin + is_super_admin).
CREATE FUNCTION public.admin_ai_ledger_summary(_days integer DEFAULT 30)
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

  RETURN (
    WITH w AS (SELECT * FROM public.ai_credit_ledger l WHERE l.created_at >= v_from),
    refunded_requests AS (SELECT DISTINCT request_id, user_id FROM w WHERE event = 'refund' AND credits > 0 AND request_id IS NOT NULL),
    totals AS (
      SELECT COALESCE(sum(-credits) FILTER (WHERE event = 'reserve'), 0) AS spent,
             COALESCE(sum(credits) FILTER (WHERE event = 'refund'), 0) AS refunded,
             count(*) FILTER (WHERE event = 'reserve') AS requests,
             count(*) FILTER (WHERE event = 'refund' AND credits > 0) AS refunds,
             COALESCE(sum(cost_usd_micros) FILTER (WHERE event = 'usage'), 0) AS cost_micros,
             count(*) FILTER (WHERE event = 'usage' AND cost_usd_micros IS NULL) AS unpriced_calls
        FROM w
    )
    SELECT jsonb_build_object(
      'days', v_days,
      'from', v_from,
      'to', now(),
      'credits_spent', t.spent,
      'credits_refunded', t.refunded,
      'net_credits', t.spent - t.refunded,
      'requests', t.requests,
      'cost_usd', round(t.cost_micros / 1000000.0, 6),
      'unpriced_calls', t.unpriced_calls,
      'refund_rate', CASE WHEN t.requests > 0 THEN round(t.refunds::numeric / t.requests, 4) END,
      'by_feature', (SELECT COALESCE(jsonb_agg(f ORDER BY f.credits DESC), '[]'::jsonb) FROM (
          SELECT COALESCE(feature, 'other') AS feature,
                 count(*) FILTER (WHERE event = 'reserve') AS requests,
                 COALESCE(sum(-credits) FILTER (WHERE event = 'reserve'), 0)
                   - COALESCE(sum(credits) FILTER (WHERE event = 'refund'), 0) AS credits,
                 COALESCE(sum(credits) FILTER (WHERE event = 'refund'), 0) AS refunded,
                 round(COALESCE(sum(cost_usd_micros) FILTER (WHERE event = 'usage'), 0) / 1000000.0, 6) AS cost_usd
            FROM w WHERE event IN ('reserve', 'refund', 'usage') GROUP BY 1) f),
      'by_day', (SELECT COALESCE(jsonb_agg(d ORDER BY d.day), '[]'::jsonb) FROM (
          SELECT to_char(g.day, 'YYYY-MM-DD') AS day,
                 COALESCE((SELECT sum(-w.credits) FROM w WHERE w.event = 'reserve' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0)
                   - COALESCE((SELECT sum(w.credits) FROM w WHERE w.event = 'refund' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0) AS credits,
                 round(COALESCE((SELECT sum(w.cost_usd_micros) FROM w WHERE w.event = 'usage' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0) / 1000000.0, 6) AS cost_usd,
                 (SELECT count(*) FROM w WHERE w.event = 'reserve' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day') AS requests
            FROM generate_series(v_from, date_trunc('day', now()), interval '1 day') AS g(day)) d),
      'top_users', (SELECT COALESCE(jsonb_agg(u ORDER BY u.credits DESC), '[]'::jsonb) FROM (
          SELECT w.user_id,
                 CASE WHEN w.user_id IS NULL THEN 'Deleted account'
                      ELSE (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = w.user_id) END AS user_name,
                 COALESCE(sum(-w.credits) FILTER (WHERE w.event = 'reserve'), 0)
                   - COALESCE(sum(w.credits) FILTER (WHERE w.event = 'refund'), 0) AS credits,
                 count(*) FILTER (WHERE w.event = 'reserve') AS requests,
                 round(COALESCE(sum(w.cost_usd_micros) FILTER (WHERE w.event = 'usage'), 0) / 1000000.0, 6) AS cost_usd
            FROM w WHERE w.event IN ('reserve', 'refund', 'usage')
           GROUP BY w.user_id ORDER BY 3 DESC LIMIT 10) u),
      -- Delivered documents: a legal_document usage row whose request was not refunded.
      'documents_by_type', (SELECT COALESCE(jsonb_agg(x ORDER BY x.documents DESC), '[]'::jsonb) FROM (
          SELECT w.doc_type, count(*) AS documents
            FROM w
           WHERE w.event = 'usage' AND w.feature = 'legal_document' AND w.doc_type IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM refunded_requests r WHERE r.request_id = w.request_id AND r.user_id IS NOT DISTINCT FROM w.user_id)
           GROUP BY w.doc_type) x)
    )
    FROM totals t
  );
END;
$function$;
-- Same privileges as admin_ai_stats: {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}.
REVOKE ALL ON FUNCTION public.admin_ai_ledger_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ai_ledger_summary(integer) TO authenticated, service_role;

-- 8. Phase 25 guard log, recorded the same way as the others (docs/phase25/rollback.sql strips exactly this line).
DO $$
DECLARE
  user_snip constant text := E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard';
  admin_snip constant text := E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard';
  src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)');
  IF position(user_snip in src) = 0 THEN RAISE EXCEPTION 'check_and_deduct_ai_credit lost its guard line'; END IF;
  UPDATE public.phase25_mfa_guard_log
     SET fn = 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', old_md5 = md5(replace(src, user_snip, '')), new_md5 = md5(src)
   WHERE fn = 'public.check_and_deduct_ai_credit(uuid,integer)';
  IF NOT FOUND THEN RAISE EXCEPTION 'guard log row for check_and_deduct_ai_credit missing'; END IF;

  SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure('public.get_ai_credits_info(uuid)');
  IF position(user_snip in src) = 0 THEN RAISE EXCEPTION 'get_ai_credits_info lost its guard line'; END IF;
  UPDATE public.phase25_mfa_guard_log SET old_md5 = md5(replace(src, user_snip, '')), new_md5 = md5(src)
   WHERE fn = 'public.get_ai_credits_info(uuid)';
  IF NOT FOUND THEN RAISE EXCEPTION 'guard log row for get_ai_credits_info missing'; END IF;

  SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure('public.admin_ai_ledger_summary(integer)');
  IF position(admin_snip in src) = 0 THEN RAISE EXCEPTION 'admin_ai_ledger_summary has no guard line'; END IF;
  INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5)
  VALUES ('public.admin_ai_ledger_summary(integer)', 'admin', md5(replace(src, admin_snip, '')), md5(src));
END $$;

-- 9. Final checks: no old overloads, the exact privileges, every new SECURITY DEFINER function pinned to search_path ''.
DO $$
BEGIN
  IF to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer)') IS NOT NULL
     OR to_regprocedure('public.refund_ai_credit(uuid,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'an old overload survived';
  END IF;
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)'))) x)
       IS DISTINCT FROM ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']
     OR (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure('public.refund_ai_credit(uuid,integer,text,uuid)'))) x)
       IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres'] THEN
    RAISE EXCEPTION 'check_and_deduct_ai_credit privileges differ from the old function';
  END IF;
  IF has_function_privilege('anon', 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.refund_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.refund_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.record_ai_usage(uuid,uuid,text,text,text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.record_ai_usage(uuid,uuid,text,text,text,integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_ai_ledger_summary(integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.refund_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.record_ai_usage(uuid,uuid,text,text,text,integer,integer)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'function privileges are not as intended';
  END IF;
  IF has_table_privilege('authenticated', 'public.ai_credit_ledger', 'SELECT') OR has_table_privilege('anon', 'public.ai_credit_ledger', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ai_model_prices', 'SELECT') OR has_table_privilege('anon', 'public.ai_model_prices', 'SELECT') THEN
    RAISE EXCEPTION 'ledger tables are readable through the API';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN (
       to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)'), to_regprocedure('public.refund_ai_credit(uuid,integer,text,uuid)'),
       to_regprocedure('public.record_ai_usage(uuid,uuid,text,text,text,integer,integer)'), to_regprocedure('public.admin_ai_ledger_summary(integer)'),
       to_regprocedure('public.get_ai_credits_info(uuid)'))
     AND NOT (p.proconfig @> ARRAY['search_path=""'])) THEN
    RAISE EXCEPTION 'a function is not pinned to search_path ''''';
  END IF;
END $$;

COMMIT;

-- =====================================================================================================================
-- OPTIONAL, NOT PART OF THE TRANSACTION ABOVE, OWNER DECIDES: raise existing free 10-credit rows to 50.
-- Read first how many rows it would touch (on 2 Nov 2026: 0. The 7 non-subscribed rows have tier NULL and limits
-- 250 / 1,000 / 5,000, i.e. plan-sized trial rows, not free 10-credit rows):
--   SELECT count(*) FROM public.subscribers WHERE subscribed IS NOT TRUE AND subscription_tier = 'free' AND ai_credits_limit = 10;
--   SELECT subscription_tier, ai_credits_limit, count(*) FROM public.subscribers WHERE subscribed IS NOT TRUE GROUP BY 1, 2 ORDER BY 1, 2;
-- Then, only if the owner approves (and add a ledger 'grant' row per user so the history explains the jump):
--   BEGIN;
--   WITH up AS (
--     UPDATE public.subscribers SET ai_credits_limit = 50, ai_credits_remaining = ai_credits_remaining + 40
--      WHERE subscribed IS NOT TRUE AND subscription_tier = 'free' AND ai_credits_limit = 10
--     RETURNING user_id, ai_credits_remaining, plan_key)
--   INSERT INTO public.ai_credit_ledger (user_id, event, credits, balance_after, plan_key)
--   SELECT user_id, 'grant', 40, ai_credits_remaining, plan_key FROM up;
--   COMMIT;
-- =====================================================================================================================

-- =====================================================================================================================
-- CHECKS AFTER APPLYING (read-only; run in the SQL editor as postgres):
--   SELECT p.oid::regprocedure, p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname IN ('check_and_deduct_ai_credit','refund_ai_credit','get_ai_credits_info','record_ai_usage','admin_ai_ledger_summary');
--   SELECT * FROM public.ai_model_prices;
--   SELECT fn, kind, old_md5, new_md5 FROM public.phase25_mfa_guard_log WHERE fn LIKE '%credit%' OR fn LIKE '%ledger%';
--   -- After a few AI requests (counts and costs only):
--   SELECT event, feature, doc_type, credits, balance_after, model, prompt_tokens, completion_tokens, cost_usd_micros, created_at
--     FROM public.ai_credit_ledger ORDER BY created_at DESC LIMIT 20;
--   -- The admin summary, as a super admin: run it as that user's JWT, or as postgres it skips the aal2/super-admin
--   -- check only if you set request.jwt.claims; simplest is from the app once Phase 36 calls it. As postgres:
--   --   SET LOCAL request.jwt.claims = '{"sub":"<super admin uuid>","role":"authenticated","aal":"aal2"}';
--   --   SET LOCAL role authenticated; SELECT public.admin_ai_ledger_summary(30); RESET role;
-- =====================================================================================================================
