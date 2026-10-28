-- Unschedules the two Phase 13 jobs by name (safe to re-run: missing jobs are skipped).
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('b2bnest-trial-emails-queue', 'b2bnest-trial-email-sender');
