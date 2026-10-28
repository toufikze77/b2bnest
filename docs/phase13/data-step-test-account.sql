-- Phase 13, rollout step 3 — PREPARED, NOT APPLIED. A bounded test with ONE account the owner controls.
-- Replace <test email> (an address the owner reads, already signed up and verified, NOT a master account, NOT an
-- admin, no subscription). Its trial dates are moved by this file — only ever on this test account.
-- Run each block separately and read the result before the next.

-- (a) Check the account: must show state 'trial' or 'trial_ended', via 'self', a confirmed email, and nothing else
--     queued for anyone (the second query must return 0 rows, or every listed row would be sent too).
SELECT u.id, u.email_confirmed_at IS NOT NULL AS verified, s.state, s.via
  FROM auth.users u CROSS JOIN LATERAL public._access_state_for(u.id) s WHERE lower(u.email) = lower('<test email>');
SELECT count(*) AS other_queued FROM public.trial_email_outbox WHERE status IN ('pending', 'failed', 'sending');

-- (b) Make the test account's trial end in 2.5 days (inside the "ends in 3 days" window), cap the day at ONE email and
--     switch on. Everyone else: nothing is due for them only if (a)'s second query was 0 AND precheck.sql shows
--     0 "WOULD BE QUEUED" rows. If precheck shows other people, STOP: lower the window or wait — do not switch on.
BEGIN;
UPDATE public.profiles SET trial_ends_at = now() + interval '60 hours' WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('<test email>'));
UPDATE public.trial_email_settings SET daily_cap = 1, enabled = true, updated_at = now() WHERE id;
SELECT public.queue_trial_emails() AS queued;  -- expect 1
SELECT o.kind, o.status, u.email FROM public.trial_email_outbox o JOIN auth.users u ON u.id = o.user_id; -- expect only the test account
COMMIT;

-- (c) Call the sender once by hand (README step 3), then read the result:
SELECT kind, status, attempts, provider_reply, last_error, accepted_at FROM public.trial_email_outbox ORDER BY created_at DESC LIMIT 5;

-- (d) Switch off again and restore the cap (the test account keeps its moved trial date; set it back if wanted).
UPDATE public.trial_email_settings SET enabled = false, daily_cap = 50, updated_at = now() WHERE id;
