-- =====================================================================================================================
-- Google Calendar sync rollback (docs/google-calendar-sync/proposal.sql). Removes the catch-up job if it is scheduled,
-- then drops calendar_event_links. The links are only a cache of which event belongs to which task: events in people's
-- Google calendars are NOT touched, and they carry the task id in a private property, so a later sync reuses them
-- instead of creating duplicates. Deploy the previous google-calendar-sync first, or it will answer errors.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.calendar_event_links') IS NULL THEN RAISE EXCEPTION 'calendar_event_links does not exist (not applied?)'; END IF;
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'b2bnest-google-calendar-sync';
  END IF;
END $$;
DROP TABLE public.calendar_event_links;
COMMIT;
