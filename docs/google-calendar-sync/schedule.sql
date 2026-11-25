-- PREPARED, NOT APPLIED. The 15-minute catch-up for Google Calendar (docs/google-calendar-sync/README.md).
-- Apply AFTER proposal.sql, after google-calendar-sync is deployed, and after the secret is set in BOTH places:
--   * Edge Function secret CALENDAR_SYNC_CRON_SECRET (owner: npx.cmd supabase secrets set ...; at least 32 characters);
--   * the same value in Vault under the name 'calendar_sync_cron_secret' (Project Settings -> Vault, or
--     SELECT vault.create_secret('<the value>', 'calendar_sync_cron_secret');). This file never contains it.
-- pg_cron 1.6.4 and pg_net 0.20.4 are installed in production (read 25 Nov 2026).
-- The function refuses action sync_all without the right x-calendar-sync-secret header (constant-time comparison), and
-- never accepts a person's sign-in for it. No Authorization header is sent: verify_jwt is false for this function.
-- Safe to re-run: cron.schedule with an existing job name replaces that job. Remove: rollback.sql, or
--   SELECT cron.unschedule('b2bnest-google-calendar-sync');
SELECT cron.schedule(
  'b2bnest-google-calendar-sync',
  '7-59/15 * * * *', -- every 15 minutes, off the hour (minutes 7, 22, 37, 52)
  $job$
  SELECT net.http_post(
    url := 'https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-calendar-sync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'calendar_sync_cron_secret')),
    body := '{"action": "sync_all"}'::jsonb,
    timeout_milliseconds := 120000);
  $job$);
