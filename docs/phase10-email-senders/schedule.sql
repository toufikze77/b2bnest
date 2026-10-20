-- PREPARED, NOT APPLIED. Step (c) of docs/phase10-email-senders/README.md. Needs the owner's approval.
-- Schedules the two senders with pg_cron + pg_net (both installed in production: pg_cron 1.6, pg_net 0.14.0).
--
-- Before running:
--   * Both functions are deployed (step a) and the bounded test (step b) has passed.
--   * The service-role key is stored in Vault under the name 'email_senders_service_role_key' (owner, in the dashboard:
--     Project Settings -> Vault, or: SELECT vault.create_secret('<service role key>', 'email_senders_service_role_key');).
--     This file never contains the key.
--
-- Frequency and batch: every 5 minutes; each run claims at most 20 rows (fixed in the handlers), so at most 240 emails an
-- hour per sender. A failed send (before DATA) is retried with backoff 5, 15, 45, 135 minutes (max 5 attempts, set in the
-- database); "uncertain" is never retried. While ONBOARDING_EMAIL_ENABLED / SUPPORT_EMAIL_ENABLED are not exactly
-- "true", each run returns {"status":"disabled"} and claims nothing, so this can be applied before step (d).
-- Safe to re-run: cron.schedule with an existing job name replaces that job.

SELECT cron.schedule(
  'b2bnest-onboarding-email-sender',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/onboarding-email-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_senders_service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
  $job$);

SELECT cron.schedule(
  'b2bnest-support-email-sender',
  '2-59/5 * * * *', -- offset by 2 minutes so the two senders never run at the same moment
  $job$
  SELECT net.http_post(
    url := 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/support-email-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_senders_service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
  $job$);
