-- Phase 13: READ-ONLY. Counts only (no names, no emails). Run before (and again just before switching on) proposal.sql.
-- Answers: if the switch were on today, how many people would get each email, and how many are skipped and why.
-- Uses the default timings (48–72 h before the end; ended up to 7 days ago) and public._access_state_for for access.
-- "follow_up" is never due on the first day: it needs an "ended" email queued at least 48 hours earlier.
WITH due AS (
  SELECT p.id, 'ending_soon'::text AS kind, NULL::text AS pre FROM public.profiles p
   WHERE p.trial_ends_at > now() + interval '48 hours' AND p.trial_ends_at <= now() + interval '72 hours'
  UNION ALL
  SELECT p.id, 'ended', CASE WHEN p.trial_ends_at < now() - interval '7 days' THEN 'ended_too_long_ago' END FROM public.profiles p
   WHERE p.trial_ends_at <= now()),
judged AS (
  SELECT d.kind, coalesce(d.pre, (
    SELECT CASE
      WHEN u.email IS NULL OR btrim(u.email) = '' OR u.email_confirmed_at IS NULL THEN 'no_verified_email'
      WHEN s.state IS NULL THEN 'no_profile'
      WHEN s.state = 'owner' THEN 'owner_or_master'
      WHEN s.state = 'subscribed' THEN 'subscribed'
      WHEN s.state = 'suspended' THEN 'suspended'
      WHEN s.via IS DISTINCT FROM 'self' THEN 'company_member'
      WHEN EXISTS (SELECT 1 FROM public.support_customers c WHERE c.user_id = d.id) THEN 'support_customer'
      WHEN d.kind = 'ending_soon' AND s.state <> 'trial' THEN 'state_changed'
      WHEN d.kind = 'ended' AND s.state <> 'trial_ended' THEN 'state_changed'
    END
    FROM auth.users u LEFT JOIN LATERAL public._access_state_for(u.id) s ON true WHERE u.id = d.id)) AS outcome
  FROM due d)
SELECT kind, coalesce(outcome, 'WOULD BE QUEUED') AS outcome, count(*) AS accounts
  FROM judged GROUP BY kind, outcome ORDER BY kind, outcome;
