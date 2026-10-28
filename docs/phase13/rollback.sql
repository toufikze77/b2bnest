-- Phase 13 rollback — PREPARED, NOT APPLIED. Undoes proposal.sql in one transaction.
-- Run schedule-rollback.sql FIRST if the jobs were scheduled. Emails already handed to Microsoft 365 have gone; this only
-- removes the queue, the log, the opt-outs and the settings. The unsubscribe page then answers as before (it reveals
-- nothing either way), but links in emails already sent no longer record anything.
BEGIN;
DROP FUNCTION public.email_unsubscribe(text);
DROP FUNCTION public.trial_email_finish(uuid, text, text);
DROP FUNCTION public.trial_email_claim(integer);
DROP FUNCTION public.queue_trial_emails();
DROP FUNCTION public._trial_email_candidates();
DROP FUNCTION public._trial_email_skip_reason(uuid, text);
DROP TABLE public.trial_email_log;
DROP TABLE public.trial_email_outbox;
DROP TABLE public.email_optouts;
DROP TABLE public.trial_email_settings;
COMMIT;
