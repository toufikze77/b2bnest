-- Rollback for schedule.sql: removes both jobs by name. Safe to re-run (does nothing if they are already gone).
-- Does not touch the Vault secret, the queues or the functions.
SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('b2bnest-onboarding-email-sender', 'b2bnest-support-email-sender');
