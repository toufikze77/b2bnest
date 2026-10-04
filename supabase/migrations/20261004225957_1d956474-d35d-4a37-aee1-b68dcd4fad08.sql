-- Stripe webhook retry safety. Owner-approved for production 2026-10-04.
-- Additive only: existing event rows become 'completed' (they were already processed).

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS claim_token uuid;

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS stripe_state_at bigint;

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(p_event_id text, p_event_type text, p_lease_seconds integer DEFAULT 120)
RETURNS TABLE(result text, token uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.stripe_webhook_events%ROWTYPE; v_token uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.stripe_webhook_events (event_id, event_type, status, attempts, locked_until, claim_token)
  VALUES (p_event_id, p_event_type, 'processing', 1, now() + make_interval(secs => p_lease_seconds), v_token)
  ON CONFLICT (event_id) DO NOTHING;
  IF FOUND THEN RETURN QUERY SELECT 'claimed'::text, v_token; RETURN; END IF;

  SELECT * INTO r FROM public.stripe_webhook_events e WHERE e.event_id = p_event_id FOR UPDATE;
  IF r.status = 'completed' THEN RETURN QUERY SELECT 'completed'::text, NULL::uuid; RETURN; END IF;
  IF r.status = 'processing' AND r.locked_until > now() THEN RETURN QUERY SELECT 'busy'::text, NULL::uuid; RETURN; END IF;
  UPDATE public.stripe_webhook_events e
     SET status = 'processing', attempts = e.attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds), claim_token = v_token
   WHERE e.event_id = p_event_id;
  RETURN QUERY SELECT 'claimed'::text, v_token;
END $$;

CREATE OR REPLACE FUNCTION public.assert_stripe_claim(p_event_id text, p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM 1 FROM public.stripe_webhook_events
   WHERE event_id = p_event_id AND claim_token = p_token AND status = 'processing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim_lost' USING ERRCODE = 'P0001'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(p_event_id text, p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.assert_stripe_claim(p_event_id, p_token);
  UPDATE public.stripe_webhook_events
     SET status = 'completed', completed_at = now(), processed_at = now(), locked_until = NULL, last_error = NULL, claim_token = NULL
   WHERE event_id = p_event_id;
END $$;

CREATE OR REPLACE FUNCTION public.release_stripe_webhook_event(p_event_id text, p_token uuid, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  UPDATE public.stripe_webhook_events
     SET status = 'failed', locked_until = NULL, claim_token = NULL, last_error = left(p_error, 500)
   WHERE event_id = p_event_id AND claim_token = p_token AND status = 'processing';
$$;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscriber_state(p_event_id text, p_token uuid, p_row jsonb, p_event_created bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_email text := p_row->>'email'; v_at bigint;
BEGIN
  PERFORM public.assert_stripe_claim(p_event_id, p_token);
  IF v_email IS NULL THEN RAISE EXCEPTION 'email required'; END IF;
  INSERT INTO public.subscribers (email) VALUES (v_email) ON CONFLICT (email) DO NOTHING;
  SELECT stripe_state_at INTO v_at FROM public.subscribers WHERE email = v_email FOR UPDATE;
  IF v_at IS NOT NULL AND v_at > p_event_created THEN RETURN 'stale'; END IF;
  UPDATE public.subscribers SET
    user_id = COALESCE((p_row->>'user_id')::uuid, user_id),
    stripe_customer_id = p_row->>'stripe_customer_id',
    stripe_subscription_id = p_row->>'stripe_subscription_id',
    stripe_price_id = p_row->>'stripe_price_id',
    plan_key = p_row->>'plan_key',
    billing_interval = p_row->>'billing_interval',
    subscription_status = p_row->>'subscription_status',
    cancel_at_period_end = COALESCE((p_row->>'cancel_at_period_end')::boolean, false),
    canceled_at = (p_row->>'canceled_at')::timestamptz,
    current_period_start = (p_row->>'current_period_start')::timestamptz,
    current_period_end = (p_row->>'current_period_end')::timestamptz,
    subscribed = COALESCE((p_row->>'subscribed')::boolean, false),
    subscription_tier = p_row->>'subscription_tier',
    subscription_end = (p_row->>'subscription_end')::timestamptz,
    ai_credits_limit = COALESCE((p_row->>'ai_credits_limit')::integer, ai_credits_limit),
    stripe_state_at = p_event_created,
    updated_at = now()
  WHERE email = v_email;
  RETURN 'applied';
END $$;

CREATE OR REPLACE FUNCTION public.apply_stripe_payment_status(p_event_id text, p_token uuid, p_status text,
  p_stripe_session_id text, p_stripe_payment_intent_id text, p_payment_method text, p_metadata jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.assert_stripe_claim(p_event_id, p_token);
  RETURN public.update_payment_status(p_status, p_stripe_session_id, p_stripe_payment_intent_id, p_payment_method, p_metadata);
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.claim_stripe_webhook_event(text, text, integer)', 'public.assert_stripe_claim(text, uuid)',
    'public.complete_stripe_webhook_event(text, uuid)', 'public.release_stripe_webhook_event(text, uuid, text)',
    'public.apply_stripe_subscriber_state(text, uuid, jsonb, bigint)',
    'public.apply_stripe_payment_status(text, uuid, text, text, text, text, jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;