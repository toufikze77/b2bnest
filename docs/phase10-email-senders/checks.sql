-- READ-ONLY checks for the email senders. Safe on production at any time. Run before and after every rollout step.

-- 1. Queue contents by kind and status (expected today: onboarding empty; support 1 cancelled row).
SELECT 'onboarding' AS queue, kind, status, count(*) AS rows, min(created_at) AS oldest, max(updated_at) AS last_change
FROM public.onboarding_email_outbox GROUP BY kind, status
UNION ALL
SELECT 'support', kind, status, count(*), min(created_at), max(updated_at)
FROM public.support_email_outbox GROUP BY kind, status
ORDER BY 1, 2, 3;

-- 2. What would be sent the moment a sender is switched on (rows due now). Must be EMPTY before step (b) apart from
--    the one test invitation, and reviewed before step (d).
SELECT 'onboarding' AS queue, id, kind, recipient_email AS recipient, status, attempts, created_at
FROM public.onboarding_email_outbox WHERE status IN ('pending','failed') AND attempts < 5 AND next_attempt_at <= now()
UNION ALL
SELECT 'support', id, kind, recipient_user_id::text, status, attempts, created_at
FROM public.support_email_outbox WHERE status IN ('pending','failed') AND attempts < 5 AND next_attempt_at <= now()
ORDER BY created_at;

-- 3. Rows needing a human (provider may or may not have accepted them; never resent automatically).
SELECT 'onboarding' AS queue, id, kind, attempts, last_error, updated_at FROM public.onboarding_email_outbox WHERE status = 'uncertain'
UNION ALL
SELECT 'support', id, kind, attempts, last_error, updated_at FROM public.support_email_outbox WHERE status = 'uncertain'
ORDER BY updated_at DESC;

-- 4. Scheduled jobs for the senders (expected before step (c): no rows).
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'b2bnest-%-email-sender' ORDER BY jobname;

-- 5. Recent runs of those jobs (after step (c)).
SELECT j.jobname, d.status, d.return_message, d.start_time
FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.jobname LIKE 'b2bnest-%-email-sender' ORDER BY d.start_time DESC LIMIT 20;

-- 6. Recent HTTP responses from the senders (pg_net keeps them for a short time; after step (c)).
SELECT id, status_code, left(content::text, 200) AS body, created FROM net._http_response ORDER BY created DESC LIMIT 20;
