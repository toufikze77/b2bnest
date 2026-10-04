-- Stripe webhook retry safety (FOR REVIEW — not applied).
-- Additive only: existing event rows become 'completed' (they were already processed).

ALTER TABLE public.stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS stripe_state_at bigint;

-- Claim an event: 'claimed' (caller must process), 'completed' (skip), 'busy' (another delivery holds a live lease).
CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(p_event_id text, p_event_type text, p_lease_seconds integer DEFAULT 120)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE r public.stripe_webhook_events%ROWTYPE;
BEGIN
  INSERT INTO public.stripe_webhook_events (event_id, event_type, status, attempts, locked_until)
  VALUES (p_event_id, p_event_type, 'processing', 1, now() + make_interval(secs => p_lease_seconds))
  ON CONFLICT (event_id) DO NOTHING;
  IF FOUND THEN RETURN 'claimed'; END IF;

  SELECT * INTO r FROM public.stripe_webhook_events WHERE event_id = p_event_id FOR UPDATE;
  IF r.status = 'completed' THEN RETURN 'completed'; END IF;
  IF r.status = 'processing' AND r.locked_until > now() THEN RETURN 'busy'; END IF;
  -- failed, or processing whose lease expired (processing stopped partway): take over.
  UPDATE public.stripe_webhook_events
     SET status = 'processing', attempts = attempts + 1, locked_until = now() + make_interval(secs => p_lease_seconds)
   WHERE event_id = p_event_id;
  RETURN 'claimed';
END $$;

CREATE OR REPLACE FUNCTION public.complete_stripe_webhook_event(p_event_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  UPDATE public.stripe_webhook_events
     SET status = 'completed', completed_at = now(), processed_at = now(), locked_until = NULL, last_error = NULL
   WHERE event_id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.release_stripe_webhook_event(p_event_id text, p_error text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  UPDATE public.stripe_webhook_events
     SET status = 'failed', locked_until = NULL, last_error = left(p_error, 500)
   WHERE event_id = p_event_id AND status = 'processing';
$$;

-- Writes subscriber state unless state from a later Stripe event is already stored. Returns 'applied' or 'stale'.
CREATE OR REPLACE FUNCTION public.apply_stripe_subscriber_state(p_row jsonb, p_event_created bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_email text := p_row->>'email'; v_at bigint;
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'email required'; END IF;
  INSERT INTO public.subscribers (email, stripe_state_at) VALUES (v_email, NULL) ON CONFLICT (email) DO NOTHING;
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

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_webhook_event(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_stripe_webhook_event(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_stripe_subscriber_state(jsonb, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_webhook_event(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stripe_webhook_event(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscriber_state(jsonb, bigint) TO service_role;
