-- Phase 20: give back an AI credit when the AI call fails (PREPARED, not applied). One transaction.
--
-- Why: ai-assistant takes a credit (public.check_and_deduct_ai_credit) BEFORE calling OpenAI, so an OpenAI error, an
-- empty answer or a timeout still costs the user a credit. Phase 20 keeps that order on purpose (the deduct locks the
-- subscriber row FOR UPDATE, so concurrent requests can never take the balance below zero or past the monthly limit)
-- and adds the second half: the function returns the credit when the answer is not delivered.
--
-- public.refund_ai_credit(p_user_id, p_credits):
--  * service role (and postgres) only: a signed-in user can never give themselves credits. EXECUTE is revoked from
--    PUBLIC, anon and authenticated, and the body refuses any other caller as well.
--  * never raises the balance above ai_credits_limit (a refund after the monthly reset, or a stray second refund,
--    can't create credits out of nothing).
--  * locks the row FOR UPDATE, like the deduct, so a refund and a deduct for the same user never interleave.
--  * returns how many credits were actually given back (0 when already at the limit or no subscriber row).
-- check_and_deduct_ai_credit is NOT changed. The guard below refuses to apply if its live body differs from the one
-- this was written and tested against (md5 of pg_get_functiondef, read from production on 29 Oct 2026).
BEGIN;

DO $$
DECLARE h text;
BEGIN
  IF to_regprocedure('public.check_and_deduct_ai_credit(uuid, integer)') IS NULL THEN
    RAISE EXCEPTION 'Phase 20: public.check_and_deduct_ai_credit(uuid, integer) is missing; nothing applied';
  END IF;
  SELECT md5(pg_get_functiondef('public.check_and_deduct_ai_credit(uuid, integer)'::regprocedure)) INTO h;
  IF h <> 'c19946704eca6184e29581d8fb5bb26e' THEN
    RAISE EXCEPTION 'Phase 20: check_and_deduct_ai_credit has changed since this was prepared (md5 %); nothing applied', h;
  END IF;
  IF to_regprocedure('public.refund_ai_credit(uuid, integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 20: public.refund_ai_credit already exists (applied twice?)';
  END IF;
END $$;

CREATE FUNCTION public.refund_ai_credit(p_user_id uuid, p_credits integer DEFAULT 1)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_limit integer;
  v_reset timestamptz;
BEGIN
  IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_user_id IS NULL OR p_credits IS NULL OR p_credits < 1 OR p_credits > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT ai_credits_remaining, ai_credits_limit INTO v_before, v_limit
    FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'no_subscriber', 'refunded', 0);
  END IF;

  UPDATE public.subscribers
     -- Up to the limit, never above it; and never LOWER than now (a balance already above the limit is left alone).
     SET ai_credits_remaining = GREATEST(COALESCE(ai_credits_remaining, 0),
                                         LEAST(COALESCE(ai_credits_limit, 0), COALESCE(ai_credits_remaining, 0) + p_credits))
   WHERE user_id = p_user_id
  RETURNING ai_credits_remaining, ai_credits_reset_date INTO v_after, v_reset;

  RETURN json_build_object(
    'success', true,
    'refunded', GREATEST(0, v_after - COALESCE(v_before, 0)),
    'credits_remaining', v_after,
    'credits_limit', v_limit,
    'reset_date', v_reset);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ai_credit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credit(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.refund_ai_credit(uuid, integer) IS
  'Phase 20: gives back AI credits taken by check_and_deduct_ai_credit when the AI answer was not delivered. Service role only; never above the monthly limit.';

COMMIT;
