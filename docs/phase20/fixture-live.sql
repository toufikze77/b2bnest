-- Phase 20 test fixture: the parts of production that refund_ai_credit touches, as they are live on 29 Oct 2026.
-- public.check_and_deduct_ai_credit is copied VERBATIM from pg_get_functiondef in production (md5 of that text:
-- c19946704eca6184e29581d8fb5bb26e), so proposal.sql's body-hash guard is tested against the real definition.
-- public.subscribers has only the columns these functions read or write (the live table has more).
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'role','') $$;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

CREATE TABLE public.subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE,
  email text,
  subscribed boolean DEFAULT false NOT NULL,
  subscription_tier text,
  ai_credits_limit integer DEFAULT 10,
  ai_credits_remaining integer DEFAULT 10,
  ai_credits_reset_date timestamptz DEFAULT (now() + interval '1 month'),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_result JSON;
BEGIN
  IF NOT (
    auth.uid() = p_user_id
    OR COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_credits_to_deduct IS NULL OR p_credits_to_deduct < 1 OR p_credits_to_deduct > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT * INTO v_subscriber FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id), false, 'free', 10, 10)
    RETURNING * INTO v_subscriber;
  END IF;

  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    UPDATE public.subscribers
    SET ai_credits_remaining = ai_credits_limit,
        ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
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

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) TO authenticated, service_role;
