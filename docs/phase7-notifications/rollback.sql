-- Rollback for docs/phase7-notifications/proposal.sql. Safe to re-run. Removes exactly what the proposal added and nothing else.
-- Effect: the bell keeps working (the app falls back to the old columns); notifications already created stay as ordinary rows,
-- but lose their link and de-duplication key. Per-type preferences are deleted with their table.
-- Optional, before running this: to also remove the notifications this feature created, run (separate decision):
--   DELETE FROM public.notifications WHERE dedupe_key LIKE 'invoice_overdue:%' OR dedupe_key LIKE 'invoice_paid:%'
--     OR dedupe_key LIKE 'quote_update:%' OR dedupe_key LIKE 'note_reminder:%';
BEGIN;

-- Scheduled jobs, by name (only if pg_cron is installed and the job exists).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(j.jobid) FROM cron.job j
     WHERE j.jobname IN ('b2bnest-generate-due-notifications', 'b2bnest-notifications-retention');
  END IF;
END $$;

DROP TRIGGER IF EXISTS invoices_notify_paid ON public.invoices;
DROP TRIGGER IF EXISTS quotes_notify_update ON public.quotes;
DROP FUNCTION IF EXISTS public.notify_invoice_paid();
DROP FUNCTION IF EXISTS public.notify_quote_update();
DROP FUNCTION IF EXISTS public.generate_due_notifications(integer);
DROP FUNCTION IF EXISTS public._notify(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._notification_today(uuid);
DROP FUNCTION IF EXISTS public._notification_wanted(uuid, text);
DROP FUNCTION IF EXISTS public._notification_money(numeric, text);

DROP TABLE IF EXISTS public.notification_type_prefs;

DROP INDEX IF EXISTS public.notifications_user_dedupe_key;
DROP INDEX IF EXISTS public.notifications_user_read_created;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_link_in_app;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_dedupe_key_len;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS link;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS dedupe_key;

COMMIT;
