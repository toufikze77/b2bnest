-- Phase 13: trial-ending emails — PREPARED, NOT APPLIED. Nothing is sent by this file.
-- Target when approved: production gvftvswyrevummbvyhxa, in ONE transaction (this file), after Phases 12, 12b, 12c.
-- Rollback: rollback.sql. Rollout: README.md (switch stays OFF until the owner turns it on).
--
-- Same outbox pattern as the Phase 10 senders (onboarding_email_outbox / support_email_outbox): the database decides
-- WHO gets WHICH email and writes outbox rows; the trial-email-sender Edge Function claims a bounded batch, sends through
-- the Microsoft 365 SMTP_* settings, and reports the outcome. A failure before DATA is retried with backoff; anything
-- during or after DATA is "uncertain" and never resent automatically.
--
-- Who gets what (all decided from public._access_state_for, the single source of truth for access):
--   ending_soon  "Your trial ends in 3 days"      state 'trial', via 'self', trial ends 48–72 hours from now
--   ended        "Your trial has ended"            state 'trial_ended', via 'self', ended up to catchup_max_days ago
--   follow_up    "Your information is still here"  state 'trial_ended', via 'self', ended >= 72 hours ago (and up to
--                                                  catchup_max_days), at least 48 hours after "ended" was queued
-- Never: owners and master accounts (state 'owner'), subscribers, suspended accounts, company members whose access
-- follows another person's account (via 'company'), support customers, unverified emails, people who opted out.
-- Each (person, email, trial end) at most once, ever. Timings, daily cap and the kill switch live in ONE row:
-- public.trial_email_settings (default: switched OFF).
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.trial_email_settings') IS NOT NULL THEN RAISE EXCEPTION 'trial_email_settings already exists (applied twice?)'; END IF;
  IF to_regprocedure('public._access_state_for(uuid)') IS NULL OR to_regprocedure('public._suspension_protected(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Phases 12 / 12c are not applied (_access_state_for, _suspension_protected)';
  END IF;
  IF to_regclass('public.support_customers') IS NULL THEN RAISE EXCEPTION 'support_customers missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_confirmed_at') THEN
    RAISE EXCEPTION 'auth.users.email_confirmed_at missing';
  END IF;
END $$;

-- 1. Settings: one row, the only place to change timings, the daily cap and the kill switch.
CREATE TABLE public.trial_email_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),         -- exactly one row
  enabled boolean NOT NULL DEFAULT false,                 -- kill switch: nothing is queued or claimed while false
  daily_cap integer NOT NULL DEFAULT 50 CHECK (daily_cap BETWEEN 0 AND 1000),  -- emails queued per UTC day, all kinds
  reminder_from_hours integer NOT NULL DEFAULT 48,        -- "ends in 3 days": trial ends more than this many hours away…
  reminder_to_hours integer NOT NULL DEFAULT 72,          -- …and at most this many
  followup_after_hours integer NOT NULL DEFAULT 72,       -- "still here": at least this long after the trial ended…
  followup_gap_hours integer NOT NULL DEFAULT 48,         -- …and this long after "ended" was queued
  catchup_max_days integer NOT NULL DEFAULT 7,            -- never email about a trial that ended longer ago than this
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reminder_from_hours < reminder_to_hours AND followup_after_hours > 0 AND followup_gap_hours >= 0 AND catchup_max_days >= 1));
INSERT INTO public.trial_email_settings DEFAULT VALUES;
ALTER TABLE public.trial_email_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_email_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.trial_email_settings TO service_role;

-- 2. Opt-outs (written by the one-click unsubscribe link; no login needed). Existing preference tables are for task
--    and in-app notifications and are user-editable under RLS, so this is its own small, server-only table.
CREATE TABLE public.email_optouts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('trial_emails')),
  source text NOT NULL DEFAULT 'email_link' CHECK (source IN ('email_link', 'support')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope));
ALTER TABLE public.email_optouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_optouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.email_optouts TO service_role;

-- 3. Outbox (same states and backoff as onboarding_email_outbox) and the never-twice log.
CREATE TABLE public.trial_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ending_soon', 'ended', 'follow_up')),
  trial_ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted_by_provider','failed','uncertain','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  last_error text, next_attempt_at timestamptz NOT NULL DEFAULT now(), locked_until timestamptz,
  provider_reply text, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, trial_ends_at));
ALTER TABLE public.trial_email_outbox ENABLE ROW LEVEL SECURITY; -- no policies: server-only
REVOKE ALL ON public.trial_email_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_email_outbox TO service_role;

CREATE TABLE public.trial_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ending_soon', 'ended', 'follow_up')),
  trial_ends_at timestamptz NOT NULL,
  outbox_id uuid REFERENCES public.trial_email_outbox(id) ON DELETE SET NULL,
  -- The unsubscribe link's secret: 256 random bits (two v4 UUIDs, 244 random bits), unguessable, server-side only.
  unsubscribe_token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  queued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, trial_ends_at));
ALTER TABLE public.trial_email_log ENABLE ROW LEVEL SECURITY; -- no policies: server-only
REVOKE ALL ON public.trial_email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trial_email_log TO service_role;

-- 4. The rules, in one place. Why (person, email) must NOT be sent now, or NULL if it may be.
CREATE FUNCTION public._trial_email_skip_reason(_uid uuid, _kind text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _state text; _via text; _email text; _confirmed timestamptz;
BEGIN
  SELECT u.email, u.email_confirmed_at INTO _email, _confirmed FROM auth.users u WHERE u.id = _uid;
  IF _email IS NULL OR btrim(_email) = '' OR _confirmed IS NULL THEN RETURN 'no_verified_email'; END IF;
  SELECT s.state, s.via INTO _state, _via FROM public._access_state_for(_uid) s;
  IF _state IS NULL THEN RETURN 'no_profile'; END IF;
  IF _state = 'owner' THEN RETURN 'owner_or_master'; END IF;
  IF _state = 'subscribed' THEN RETURN 'subscribed'; END IF;
  IF _state = 'suspended' THEN RETURN 'suspended'; END IF;
  IF _via IS DISTINCT FROM 'self' THEN RETURN 'company_member'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_customers c WHERE c.user_id = _uid) THEN RETURN 'support_customer'; END IF;
  IF EXISTS (SELECT 1 FROM public.email_optouts o WHERE o.user_id = _uid AND o.scope = 'trial_emails') THEN RETURN 'opted_out'; END IF;
  IF _kind = 'ending_soon' AND _state <> 'trial' THEN RETURN 'state_changed'; END IF;
  IF _kind IN ('ended', 'follow_up') AND _state <> 'trial_ended' THEN RETURN 'state_changed'; END IF;
  RETURN NULL;
END $function$;

-- Every email that is DUE today by the trial dates, with the reason it is skipped (NULL = will be queued).
-- 'ended_too_long_ago' marks trials that ended before the catch-up window (never emailed).
CREATE FUNCTION public._trial_email_candidates()
RETURNS TABLE(user_id uuid, kind text, trial_ends_at timestamptz, skip_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  WITH s AS (SELECT * FROM public.trial_email_settings WHERE id),
  due AS (
    SELECT p.id AS user_id, 'ending_soon'::text AS kind, p.trial_ends_at, NULL::text AS pre
      FROM public.profiles p, s
     WHERE p.trial_ends_at > now() + make_interval(hours => s.reminder_from_hours)
       AND p.trial_ends_at <= now() + make_interval(hours => s.reminder_to_hours)
    UNION ALL
    SELECT p.id, 'ended', p.trial_ends_at,
           CASE WHEN p.trial_ends_at < now() - make_interval(days => s.catchup_max_days) THEN 'ended_too_long_ago' END
      FROM public.profiles p, s
     WHERE p.trial_ends_at <= now()
    UNION ALL
    SELECT p.id, 'follow_up', p.trial_ends_at, NULL
      FROM public.profiles p, s
     WHERE p.trial_ends_at <= now() - make_interval(hours => s.followup_after_hours)
       AND p.trial_ends_at >= now() - make_interval(days => s.catchup_max_days)
       AND EXISTS (SELECT 1 FROM public.trial_email_log l WHERE l.user_id = p.id AND l.kind = 'ended' AND l.trial_ends_at = p.trial_ends_at
                    AND l.queued_at <= now() - make_interval(hours => s.followup_gap_hours)))
  SELECT d.user_id, d.kind, d.trial_ends_at, coalesce(d.pre, public._trial_email_skip_reason(d.user_id, d.kind))
    FROM due d
   WHERE NOT EXISTS (SELECT 1 FROM public.trial_email_log l WHERE l.user_id = d.user_id AND l.kind = d.kind AND l.trial_ends_at = d.trial_ends_at)
$function$;

-- 5. Queue (run daily). Kill switch off: does nothing, returns 0. Otherwise queues up to the rest of today's cap, in
--    one transaction, and returns how many. Running it again queues nothing new (unique keys + the log).
CREATE FUNCTION public.queue_trial_emails()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _on boolean; _cap integer; _left integer; _n integer := 0;
BEGIN
  SELECT s.enabled, s.daily_cap INTO _on, _cap FROM public.trial_email_settings s WHERE s.id;
  IF NOT coalesce(_on, false) THEN RETURN 0; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('public.queue_trial_emails')); -- one run at a time
  _left := greatest(0, _cap - (SELECT count(*) FROM public.trial_email_log l WHERE l.queued_at >= date_trunc('day', now())));
  IF _left = 0 THEN RETURN 0; END IF;
  WITH pick AS (
    SELECT c.user_id, c.kind, c.trial_ends_at FROM public._trial_email_candidates() c
     WHERE c.skip_reason IS NULL
     ORDER BY CASE c.kind WHEN 'ending_soon' THEN 0 WHEN 'ended' THEN 1 ELSE 2 END, c.trial_ends_at, c.user_id
     LIMIT _left),
  ob AS (
    INSERT INTO public.trial_email_outbox(user_id, kind, trial_ends_at) SELECT pick.user_id, pick.kind, pick.trial_ends_at FROM pick
    ON CONFLICT (user_id, kind, trial_ends_at) DO NOTHING
    RETURNING id, user_id, kind, trial_ends_at)
  INSERT INTO public.trial_email_log(user_id, kind, trial_ends_at, outbox_id)
  SELECT ob.user_id, ob.kind, ob.trial_ends_at, ob.id FROM ob
  ON CONFLICT (user_id, kind, trial_ends_at) DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $function$;

-- 6. Sender-only claim / finish (same contract as onboarding_outbox_claim / _finish). The rules are checked AGAIN at
--    claim time: anyone who subscribed, became a master account, was suspended or opted out since queueing is
--    cancelled, never sent. Kill switch off: nothing is claimed.
CREATE FUNCTION public.trial_email_claim(_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, kind text, recipient_email text, first_name text, trial_ends_at timestamptz, days_left integer,
              unsubscribe_token text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF NOT coalesce((SELECT s.enabled FROM public.trial_email_settings s WHERE s.id), false) THEN RETURN; END IF;
  UPDATE public.trial_email_outbox o SET status = 'uncertain', last_error = 'sender stopped mid-send; provider outcome unknown', updated_at = now()
   WHERE o.status = 'sending' AND o.locked_until < now();
  UPDATE public.trial_email_outbox o SET status = 'cancelled', last_error = 'no longer eligible: ' || r.reason, updated_at = now()
    FROM (SELECT x.id AS oid, public._trial_email_skip_reason(x.user_id, x.kind) AS reason
            FROM public.trial_email_outbox x WHERE x.status IN ('pending', 'failed')) r
   WHERE o.id = r.oid AND r.reason IS NOT NULL;
  RETURN QUERY
  WITH due AS (SELECT o.id FROM public.trial_email_outbox o
     WHERE o.status IN ('pending', 'failed') AND o.attempts < 5 AND o.next_attempt_at <= now()
     ORDER BY o.created_at LIMIT least(greatest(_limit, 1), 50) FOR UPDATE SKIP LOCKED),
  upd AS (UPDATE public.trial_email_outbox o SET status = 'sending', attempts = o.attempts + 1, locked_until = now() + interval '5 minutes', updated_at = now()
     FROM due WHERE o.id = due.id RETURNING o.*)
  SELECT u.id, u.kind, au.email::text,
         nullif(split_part(btrim(coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.full_name), ''), '')), ' ', 1), ''),
         u.trial_ends_at, greatest(0, ceil(extract(epoch FROM (u.trial_ends_at - now())) / 86400))::int,
         l.unsubscribe_token, u.attempts
    FROM upd u JOIN auth.users au ON au.id = u.user_id
    LEFT JOIN public.profiles p ON p.id = u.user_id
    JOIN public.trial_email_log l ON l.outbox_id = u.id;
END $function$;

CREATE FUNCTION public.trial_email_finish(_id uuid, _outcome text, _reply text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF _outcome NOT IN ('accepted_by_provider', 'failed', 'uncertain', 'cancelled') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  UPDATE public.trial_email_outbox SET status = _outcome, locked_until = NULL, updated_at = now(),
    provider_reply = CASE WHEN _outcome = 'accepted_by_provider' THEN left(_reply, 300) ELSE provider_reply END,
    last_error = CASE WHEN _outcome <> 'accepted_by_provider' THEN left(_reply, 300) ELSE last_error END,
    accepted_at = CASE WHEN _outcome = 'accepted_by_provider' THEN now() ELSE accepted_at END,
    next_attempt_at = CASE WHEN _outcome = 'failed' THEN now() + (interval '5 minutes' * power(3, attempts - 1)) ELSE next_attempt_at END
  WHERE id = _id AND status = 'sending';
END $function$;

-- 7. One-click unsubscribe (public page, no login). Same answer for valid, invalid and repeated tokens: it returns
--    nothing and reveals nothing (no email, no "not found"). A valid token records the opt-out and cancels anything
--    still queued for that person.
CREATE FUNCTION public.email_unsubscribe(_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE _uid uuid;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
  SELECT l.user_id INTO _uid FROM public.trial_email_log l WHERE l.unsubscribe_token = _token;
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.email_optouts(user_id, scope, source) VALUES (_uid, 'trial_emails', 'email_link') ON CONFLICT (user_id, scope) DO NOTHING;
  UPDATE public.trial_email_outbox SET status = 'cancelled', last_error = 'no longer eligible: opted_out', updated_at = now()
   WHERE user_id = _uid AND status IN ('pending', 'failed');
END $function$;

REVOKE ALL ON FUNCTION public._trial_email_skip_reason(uuid, text), public._trial_email_candidates(), public.queue_trial_emails(),
  public.trial_email_claim(integer), public.trial_email_finish(uuid, text, text), public.email_unsubscribe(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._trial_email_skip_reason(uuid, text), public._trial_email_candidates(), public.queue_trial_emails(),
  public.trial_email_claim(integer), public.trial_email_finish(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_unsubscribe(text) TO anon, authenticated, service_role;

COMMIT;
