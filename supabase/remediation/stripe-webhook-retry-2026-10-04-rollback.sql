-- Rollback for stripe-webhook-retry-2026-10-04.sql. Redeploy the previous stripe-webhook code FIRST,
-- because the new code calls these functions. Column drops discard only retry bookkeeping.
DROP FUNCTION IF EXISTS public.apply_stripe_payment_status(text, uuid, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.apply_stripe_subscriber_state(text, uuid, jsonb, bigint);
DROP FUNCTION IF EXISTS public.release_stripe_webhook_event(text, uuid, text);
DROP FUNCTION IF EXISTS public.complete_stripe_webhook_event(text, uuid);
DROP FUNCTION IF EXISTS public.assert_stripe_claim(text, uuid);
DROP FUNCTION IF EXISTS public.claim_stripe_webhook_event(text, text, integer);
ALTER TABLE public.subscribers DROP COLUMN IF EXISTS stripe_state_at;
-- Events left 'failed'/'processing' were never completed; delete them so the old code lets Stripe retries through.
DELETE FROM public.stripe_webhook_events WHERE status <> 'completed';
ALTER TABLE public.stripe_webhook_events
  DROP COLUMN IF EXISTS claim_token,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS attempts,
  DROP COLUMN IF EXISTS status;
