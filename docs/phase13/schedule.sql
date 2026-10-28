-- PREPARED, NOT APPLIED. Rollout step 4 (docs/phase13/README.md). Needs the owner's approval.
-- Two pg_cron jobs (pg_cron 1.6 and pg_net 0.14.0 are installed in production):
--   * b2bnest-trial-emails-queue  daily at 09:07 UTC: SELECT public.queue_trial_emails(); (plain SQL, no HTTP)
--   * b2bnest-trial-email-sender  every 10 minutes: calls the trial-email-sender Edge Function through pg_net with the
--     service-role key from Vault (the same 'email_senders_service_role_key' secret as docs/phase10-email-senders).
-- While public.trial_email_settings.enabled is false, both are no-ops (queue returns 0; claim returns nothing).
-- Safe to re-run: cron.schedule with an existing job name replaces that job.
SELECT cron.schedule('b2bnest-trial-emails-queue', '7 9 * * *', $job$ SELECT public.queue_trial_emails(); $job$);

SELECT cron.schedule(
  'b2bnest-trial-email-sender',
  '4-59/10 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/trial-email-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_senders_service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
  $job$);
