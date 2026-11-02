-- Phase 31 tests (DISPOSABLE local Postgres only). Run by docs/phase31/run-test.sh after the shim and fixtures.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql

-- People. a subscriber (owns company O1), b trial, c trial ended, d suspended subscriber, e member of O1 (paid by a),
-- f subscriber owning company O2, g subscriber with two-step set up, h subscriber (summary maths).
INSERT INTO auth.users (id, email) SELECT ('a1000000-0000-4000-8000-00000000000' || x)::uuid, 'user' || x || '@example.test' FROM unnest(ARRAY['1','2','3','4','5','6','7','8']) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'user1@example.test', 'A', null, true),
  ('a1000000-0000-4000-8000-000000000002', 'user2@example.test', 'B', now() + interval '7 days', true),
  ('a1000000-0000-4000-8000-000000000003', 'user3@example.test', 'C', now() - interval '1 day', true),
  ('a1000000-0000-4000-8000-000000000004', 'user4@example.test', 'D', null, false),
  ('a1000000-0000-4000-8000-000000000005', 'user5@example.test', 'E', null, true),
  ('a1000000-0000-4000-8000-000000000006', 'user6@example.test', 'F', null, true),
  ('a1000000-0000-4000-8000-000000000007', 'user7@example.test', 'G', null, true),
  ('a1000000-0000-4000-8000-000000000008', 'user8@example.test', 'H', null, true);
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'user1@example.test', true, 'active', 'professional'),
  ('a1000000-0000-4000-8000-000000000004', 'user4@example.test', true, 'active', 'starter'),
  ('a1000000-0000-4000-8000-000000000006', 'user6@example.test', true, 'active', 'professional'),
  ('a1000000-0000-4000-8000-000000000007', 'user7@example.test', true, 'active', 'starter'),
  ('a1000000-0000-4000-8000-000000000008', 'user8@example.test', true, 'active', 'starter');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('a1000000-0000-4000-8000-000000000007', 'verified');
INSERT INTO public.organizations (id, name, created_by) VALUES
  ('0a100000-0000-4000-8000-000000000001', 'O1 Ltd', 'a1000000-0000-4000-8000-000000000001'),
  ('0a100000-0000-4000-8000-000000000002', 'O2 Ltd', 'a1000000-0000-4000-8000-000000000006');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('0a100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('0a100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'member'),
  ('0a100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006', 'owner');
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0a100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('0a100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000006');
INSERT INTO public.projects (id, user_id, name, organization_id) VALUES
  ('0b100000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'A personal', null),
  ('0b100000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'O1 website', '0a100000-0000-4000-8000-000000000001'),
  ('0b100000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000006', 'F private', null),
  ('0b100000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000008', 'H client work', null);

\echo '== apply'
\i docs/phase31/proposal.sql
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.time_tracker_access_ok()', 'public.time_start(uuid,text,boolean,integer,uuid)', 'public.time_pause()', 'public.time_resume()',
                           'public.time_stop(boolean,timestamp with time zone)', 'public.time_summary(timestamp with time zone,timestamp with time zone)'] LOOP
    PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = f::regprocedure)) x)
      = ARRAY['authenticated=X/postgres','postgres=X/postgres'], f || ': authenticated only (not anon)');
    PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = f::regprocedure), f || ': SECURITY DEFINER, search_path pinned');
  END LOOP;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log g JOIN pg_proc p ON p.oid = to_regprocedure(g.fn)
                       WHERE g.fn ~ 'time_' AND g.kind = 'user' AND md5(p.prosrc) = g.new_md5
                         AND md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')) = g.old_md5) = 6,
                     'guard log: 6 rows, new_md5 and old_md5 right');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.project_time_entries', 'SELECT') AND NOT has_table_privilege('anon', 'public.time_tracker_settings', 'SELECT'),
                     'anon: no access to entries or settings');
  PERFORM pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.time_tracker_settings'::regclass), 'RLS on time_tracker_settings');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('project_time_entries', 'time_tracker_settings')
                       AND policyname = 'require_aal2_if_enrolled' AND permissive = 'RESTRICTIVE') = 2, 'restrictive aal2 policy on both tables');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('project_time_entries', 'time_tracker_settings')
                       AND policyname = 'time_tracker_access' AND permissive = 'RESTRICTIVE') = 2, 'restrictive access policy on both tables');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_time_entries'
                                  AND policyname IN ('Users can manage time entries in their organization projects', 'Project owners can manage their time entries')),
                     'the old company-wide write policies are gone');
END $$;

-- Helpers to act as someone.
CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text) TO PUBLIC;

\echo '== timer: start, one running per user'
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, '   ')$$, 'TIME_PROJECT_OR_DESCRIPTION_REQUIRED', 'start needs a project or a description');
SELECT pg_temp.fails($$SELECT public.time_start(NULL, repeat('x', 501))$$, 'TIME_DESCRIPTION_TOO_LONG', 'description capped at 500');
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x', true, 1000001)$$, 'TIME_RATE_OUT_OF_RANGE', 'rate capped at £10,000 an hour');
SELECT pg_temp.fails($$SELECT public.time_start('0b100000-0000-4000-8000-000000000003', NULL)$$, 'TIME_PROJECT_NOT_FOUND', 'someone else''s project refused');
DO $$
DECLARE j json;
BEGIN
  j := public.time_start(NULL, '  Client call  ', true, 6000);
  PERFORM pg_temp.ok(j ->> 'end_time' IS NULL AND j ->> 'description' = 'Client call' AND (j ->> 'hourly_rate_pence')::int = 6000
                     AND (j ->> 'hourly_rate')::numeric = 60 AND (j ->> 'start_time')::timestamptz = now(), 'start: running, trimmed, server time, pounds kept in step');
END $$;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'second')$$, 'TIMER_ALREADY_RUNNING', 'a second running timer is refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time) VALUES (auth.uid(), 'sneaky', now())$$,
                     'TIME_RUNNING_VIA_TIMER_ONLY', 'a running entry cannot be inserted directly');
RESET ROLE;
SELECT pg_temp.fails($$SET LOCAL app.time_rpc = 'on'; INSERT INTO public.project_time_entries (user_id, description, start_time) VALUES ('a1000000-0000-4000-8000-000000000001', 'x', now())$$,
                     'pte_one_running_per_user', 'the database itself allows one running entry per user (unique index)');

\echo '== pause maths'
-- (as postgres, with the timer flag) move the clock back: started an hour ago.
SET app.time_rpc = 'on';
UPDATE public.project_time_entries SET start_time = now() - interval '3600 seconds' WHERE user_id = 'a1000000-0000-4000-8000-000000000001' AND end_time IS NULL;
RESET app.time_rpc;
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_resume()$$, 'TIMER_NOT_PAUSED', 'resume when not paused refused');
DO $$ BEGIN PERFORM pg_temp.ok((public.time_pause() ->> 'paused_at')::timestamptz = now(), 'pause: paused_at = server time'); END $$;
SELECT pg_temp.fails($$SELECT public.time_pause()$$, 'TIMER_ALREADY_PAUSED', 'pause twice refused');
SELECT pg_temp.fails($$UPDATE public.project_time_entries SET start_time = start_time - interval '1 hour' WHERE end_time IS NULL$$,
                     'TIME_RUNNING_VIA_TIMER_ONLY', 'a running entry''s times cannot be edited directly');
RESET ROLE;
SET app.time_rpc = 'on';
UPDATE public.project_time_entries SET paused_at = now() - interval '600 seconds' WHERE user_id = 'a1000000-0000-4000-8000-000000000001' AND end_time IS NULL;
RESET app.time_rpc;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.time_resume();
  PERFORM pg_temp.ok((j ->> 'paused_seconds')::int = 600 AND j ->> 'paused_at' IS NULL, 'resume: 10 minutes paused recorded exactly');
  j := public.time_stop();
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j -> 'entry' ->> 'duration_minutes')::int = 50 AND (j -> 'entry' ->> 'end_time')::timestamptz = now(),
                     'stop: 60 minutes less 10 paused = 50 worked; end = server time');
END $$;
SELECT pg_temp.fails($$SELECT public.time_stop()$$, 'NO_RUNNING_TIMER', 'stop with nothing running refused');

\echo '== stop while paused; short stop asks first'
SELECT public.time_start('0b100000-0000-4000-8000-000000000001', NULL, false) IS NOT NULL AS started;
RESET ROLE;
SET app.time_rpc = 'on';
UPDATE public.project_time_entries SET start_time = now() - interval '2 hours', paused_at = now() - interval '30 minutes'
 WHERE user_id = 'a1000000-0000-4000-8000-000000000001' AND end_time IS NULL;
RESET app.time_rpc;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  j := public.time_stop();
  PERFORM pg_temp.ok((j -> 'entry' ->> 'paused_seconds')::int = 1800 AND (j -> 'entry' ->> 'duration_minutes')::int = 90 AND j -> 'entry' ->> 'paused_at' IS NULL,
                     'stop while paused: the open pause counts (2h - 30m = 90m)');
  PERFORM public.time_start(NULL, 'quick one');
  j := public.time_stop();
  PERFORM pg_temp.ok(NOT (j ->> 'success')::boolean AND (j ->> 'needs_confirmation')::boolean AND (j ->> 'worked_seconds')::int < 60
                     AND EXISTS (SELECT 1 FROM public.project_time_entries WHERE end_time IS NULL), 'under a minute: asks first, keeps running');
  j := public.time_stop(true);
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j -> 'entry' ->> 'duration_minutes')::int = 0, 'confirmed: saved');
END $$;

\echo '== a timer left running for more than 24 hours'
SELECT public.time_start(NULL, 'forgot to stop') IS NOT NULL AS started;
RESET ROLE;
SET app.time_rpc = 'on';
UPDATE public.project_time_entries SET start_time = now() - interval '25 hours' WHERE user_id = 'a1000000-0000-4000-8000-000000000001' AND end_time IS NULL;
RESET app.time_rpc;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$
DECLARE j json; s timestamptz;
BEGIN
  j := public.time_stop(true);
  PERFORM pg_temp.ok(j ->> 'error' = 'over_24_hours' AND EXISTS (SELECT 1 FROM public.project_time_entries WHERE end_time IS NULL), 'over 24 hours: not saved, asks for the end time');
  s := (j ->> 'start_time')::timestamptz;
  j := public.time_stop(true, s + interval '8 hours');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j -> 'entry' ->> 'duration_minutes')::int = 480, 'stopped with the time the user gives (8 hours)');
END $$;
SELECT public.time_start(NULL, 'again') IS NOT NULL AS started;
SELECT pg_temp.fails($$SELECT public.time_stop(true, now() + interval '1 hour')$$, 'TIME_IN_FUTURE', 'end time in the future refused');
SELECT pg_temp.fails($$SELECT public.time_stop(true, now() - interval '1 hour')$$, 'TIME_END_BEFORE_START', 'end time before the start refused');
DELETE FROM public.project_time_entries WHERE end_time IS NULL;  -- "Discard": the user deletes the running entry
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE end_time IS NULL), 'discard: a running entry can be deleted'); END $$;

\echo '== manual entries and edits'
DO $$
DECLARE r public.project_time_entries;
BEGIN
  INSERT INTO public.project_time_entries (user_id, project_id, description, start_time, end_time, is_billable, hourly_rate_pence)
  VALUES (auth.uid(), '0b100000-0000-4000-8000-000000000002', 'Homepage', now() - interval '3 hours', now() - interval '1 hour 55 minutes', true, 4550)
  RETURNING * INTO r;
  PERFORM pg_temp.ok(r.duration_minutes = 65 AND r.hourly_rate = 45.5 AND r.company_id = '0a100000-0000-4000-8000-000000000001',
                     'manual: 1h 05m, pounds in step, a company project''s entry belongs to the company');
  INSERT INTO public.project_time_entries (user_id, description, start_time, end_time)
  VALUES (auth.uid(), 'Overlapping', now() - interval '2 hours 30 minutes', now() - interval '2 hours');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.project_time_entries WHERE end_time IS NOT NULL AND start_time > now() - interval '4 hours') >= 2,
                     'overlapping entries are allowed (the app flags them)');
  UPDATE public.project_time_entries SET end_time = start_time + interval '2 hours', description = 'Homepage and nav' WHERE id = r.id RETURNING * INTO r;
  PERFORM pg_temp.ok(r.duration_minutes = 120 AND r.description = 'Homepage and nav', 'edit: times and description; minutes recomputed');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES (auth.uid(), 'x', now() - interval '1 hour', now() + interval '10 minutes')$$,
                     'TIME_IN_FUTURE', 'manual: end in the future refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES (auth.uid(), 'x', now() - interval '26 hours', now() - interval '1 hour')$$,
                     'pte_at_most_24_hours', 'manual: more than 24 hours refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES (auth.uid(), 'x', now() - interval '1 hour', now() - interval '2 hours')$$,
                     'pte_end_after_start', 'manual: end before start refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES (auth.uid(), '  ', now() - interval '2 hours', now() - interval '1 hour')$$,
                     'pte_project_or_description', 'manual: needs a project or a description');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time, hourly_rate_pence) VALUES (auth.uid(), 'x', now() - interval '2 hours', now() - interval '1 hour', -1)$$,
                     'pte_rate_range', 'manual: negative rate refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time, paused_seconds) VALUES (auth.uid(), 'x', now() - interval '2 hours', now() - interval '1 hour', 7200)$$,
                     'pte_paused_within', 'manual: paused longer than the entry refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, project_id, start_time, end_time) VALUES (auth.uid(), '0b100000-0000-4000-8000-000000000003', now() - interval '2 hours', now() - interval '1 hour')$$,
                     'row-level security', 'manual: someone else''s project refused (RLS)');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES ('a1000000-0000-4000-8000-000000000006', 'x', now() - interval '2 hours', now() - interval '1 hour')$$,
                     'row-level security', 'manual: an entry for someone else refused (RLS)');
SELECT pg_temp.fails($$UPDATE public.project_time_entries SET user_id = 'a1000000-0000-4000-8000-000000000006'$$, 'TIME_OWNER_FIXED', 'an entry cannot be given to someone else');
RESET ROLE;

\echo '== companies'
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x', true, NULL, '0a100000-0000-4000-8000-000000000002')$$, 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'start for a company you are not in refused');
DO $$
DECLARE j json;
BEGIN
  j := public.time_start(NULL, 'Member task', true, NULL, '0a100000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok(j ->> 'company_id' = '0a100000-0000-4000-8000-000000000001', 'a company member (paid by the owner) can use the tracker for that company');
  PERFORM public.time_stop(true);
  PERFORM pg_temp.ok((SELECT count(*) FROM public.project_time_entries) = 1, 'a member sees only their own entries');
  UPDATE public.project_time_entries SET description = 'hijack' WHERE user_id = 'a1000000-0000-4000-8000-000000000001';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries WHERE description = 'hijack'), 'a member cannot change the owner''s entries');
END $$;
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE n int;
BEGIN
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.project_time_entries WHERE user_id = 'a1000000-0000-4000-8000-000000000005'),
                     'the company owner can read members'' company entries (todos / rota pattern)');
  UPDATE public.project_time_entries SET description = 'owner edit' WHERE user_id = 'a1000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, '...but cannot change them');
  DELETE FROM public.project_time_entries WHERE user_id = 'a1000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.ok(n = 0, '...or delete them');
END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries), 'another company''s owner sees nothing of O1 or A'); END $$;
RESET ROLE;

\echo '== access: trial yes; trial ended, suspended, anon no; two-step'
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ BEGIN PERFORM public.time_start(NULL, 'trial work'); PERFORM pg_temp.ok((public.time_stop(true) ->> 'success')::boolean, 'trial account: can use the tracker'); END $$;
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.project_time_entries) = 1, 'RLS: the trial user sees only their own entry'); END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x')$$, 'TIME_TRACKER_ACCESS_REQUIRED', 'trial ended: start refused');
SELECT pg_temp.fails($$INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES (auth.uid(), 'x', now() - interval '2 hours', now() - interval '1 hour')$$,
                     'row-level security', 'trial ended: manual entry refused by the policy');
SELECT pg_temp.fails($$INSERT INTO public.time_tracker_settings (user_id, default_rate_pence) VALUES (auth.uid(), 5000)$$, 'row-level security', 'trial ended: settings refused');
RESET ROLE;
-- (as postgres) give the trial-ended user an old entry: the policy hides it.
INSERT INTO public.project_time_entries (user_id, description, start_time, end_time) VALUES ('a1000000-0000-4000-8000-000000000003', 'old', now() - interval '3 days', now() - interval '3 days' + interval '1 hour');
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries), 'trial ended: own entries not readable until they choose a plan'); END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x')$$, 'TIME_TRACKER_ACCESS_REQUIRED', 'suspended: start refused');
SELECT pg_temp.fails($$SELECT public.time_summary(now() - interval '1 day', now())$$, 'TIME_TRACKER_ACCESS_REQUIRED', 'suspended: summary refused');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.project_time_entries$$, 'permission denied', 'anon: cannot read entries');
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x')$$, 'permission denied', 'anon: cannot start a timer');
RESET ROLE;
SELECT pg_temp.who(7); SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x')$$, 'MFA_REQUIRED', 'two-step set up but code not entered: start refused');
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.project_time_entries), 'two-step set up but code not entered: nothing readable (aal2 policy)'); END $$;
RESET ROLE;
SELECT pg_temp.who(7, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM public.time_start(NULL, 'with code'); PERFORM pg_temp.ok((public.time_stop(true) ->> 'success')::boolean, 'with the code entered (aal2): works'); END $$;
RESET ROLE;
SELECT pg_temp.fails($$SELECT public.time_start(NULL, 'x')$$, 'AUTHENTICATION_REQUIRED', 'no user (postgres without a JWT): refused') FROM (SELECT set_config('request.jwt.claims', '', false)) s;

\echo '== settings'
SELECT pg_temp.who(8); SET ROLE authenticated;
INSERT INTO public.time_tracker_settings (user_id, default_rate_pence, default_billable) VALUES (auth.uid(), 4500, true);
SELECT pg_temp.fails($$INSERT INTO public.time_tracker_settings (user_id, default_rate_pence) VALUES (auth.uid(), 2000000)$$, 'check', 'settings: rate capped');
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.time_tracker_settings), 'settings: another user''s defaults are not readable'); END $$;
RESET ROLE;

\echo '== summary maths (UK days, value per entry rounded to the penny, never guessed)'
-- (as postgres) H's fixed entries, early October 2026 (British Summer Time, UTC+1).
INSERT INTO public.project_time_entries (user_id, project_id, description, start_time, end_time, is_billable, hourly_rate_pence, paused_seconds) VALUES
  ('a1000000-0000-4000-8000-000000000008', NULL, 'Design', '2026-10-05 09:00+00', '2026-10-05 10:05+00', true, 3000, 0),               -- 1h 05m x £30 = £32.50
  ('a1000000-0000-4000-8000-000000000008', NULL, 'Emails', '2026-10-05 11:00+00', '2026-10-05 11:20+00', true, NULL, 0),               -- billable, no rate
  ('a1000000-0000-4000-8000-000000000008', NULL, 'Admin', '2026-10-06 08:00+00', '2026-10-06 08:30+00', false, 5000, 0),               -- not billable
  ('a1000000-0000-4000-8000-000000000008', '0b100000-0000-4000-8000-000000000008', NULL, '2026-10-06 23:30+00', '2026-10-07 00:40+00', true, 1234, 600); -- 00:30 BST on 7 Oct; 1h10 - 10m = 1h x £12.34
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$
DECLARE j jsonb; d jsonb; p jsonb;
BEGIN
  j := public.time_summary('2026-10-04 23:00+00', '2026-10-07 23:00+00');   -- 5, 6 and 7 October, UK days
  PERFORM pg_temp.ok((j ->> 'entries')::int = 4 AND (j ->> 'total_seconds')::int = 3900 + 1200 + 1800 + 3600, 'totals: 4 entries, worked seconds (pauses excluded)');
  PERFORM pg_temp.ok((j ->> 'billable_seconds')::int = 3900 + 1200 + 3600, 'billable seconds');
  PERFORM pg_temp.ok((j ->> 'billable_value_pence')::int = 3250 + 1234, 'value: £32.50 + £12.34; no rate = no value (not guessed); not billable = 0');
  PERFORM pg_temp.ok((j ->> 'unrated_billable_seconds')::int = 1200, 'billable time without a rate is reported, not valued');
  PERFORM pg_temp.ok(jsonb_array_length(j -> 'by_day') = 3, 'by day: every day in the range, even empty ones');
  SELECT x INTO d FROM jsonb_array_elements(j -> 'by_day') x WHERE x ->> 'day' = '2026-10-07';
  PERFORM pg_temp.ok((d ->> 'seconds')::int = 3600 AND (d ->> 'value_pence')::int = 1234, 'by day: 23:30 UTC on 6 Oct is 7 Oct in the UK');
  SELECT x INTO p FROM jsonb_array_elements(j -> 'by_project') x WHERE x ->> 'project_id' = '0b100000-0000-4000-8000-000000000008';
  PERFORM pg_temp.ok(p ->> 'project_name' = 'H client work' AND (p ->> 'seconds')::int = 3600, 'by project: name and time');
  SELECT x INTO p FROM jsonb_array_elements(j -> 'by_project') x WHERE x ->> 'project_id' IS NULL;
  PERFORM pg_temp.ok((p ->> 'entries')::int = 3, 'by project: "No project" groups the rest');
  j := public.time_summary('2026-09-01 00:00+00', '2026-09-02 00:00+00');
  PERFORM pg_temp.ok((j ->> 'total_seconds')::int = 0 AND (j ->> 'billable_value_pence')::int = 0 AND j -> 'by_project' = '[]'::jsonb, 'empty range: zeros, never null');
END $$;
SELECT pg_temp.fails($$SELECT public.time_summary(now(), now() - interval '1 day')$$, 'TIME_RANGE_INVALID', 'summary: a range that ends before it starts refused');
SELECT pg_temp.fails($$SELECT public.time_summary(now() - interval '500 days', now())$$, 'TIME_RANGE_INVALID', 'summary: more than 400 days refused');
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok((public.time_summary('2026-10-04 23:00+00', '2026-10-07 23:00+00') ->> 'entries')::int = 0, 'summary: only your own entries'); END $$;
RESET ROLE; RESET request.jwt.claims;
