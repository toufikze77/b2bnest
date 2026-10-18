-- Phase 7 test. Runs inside ONE transaction that is ROLLED BACK at the end: fixtures are created here and vanish afterwards.
-- Needs proposal.sql applied first. Run on a local throwaway database (run-test.sh) or a Supabase branch, NOT on production:
-- even rolled back, the test briefly locks notifications/invoices/quotes/notes and adds then drops a test constraint.
-- Prints one line per check: PASS/FAIL | name | detail, then a summary line.
\set ON_ERROR_STOP 1
\o /dev/null
BEGIN;
CREATE TEMP TABLE t_results (n serial, name text, ok boolean, detail text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.ok(_name text, _cond boolean, _detail text DEFAULT '') RETURNS void LANGUAGE sql AS
  $$ INSERT INTO t_results (name, ok, detail) VALUES (_name, coalesce(_cond, false), coalesce(_detail, '')) $$;
-- Runs one statement as a role (and signed-in user), returns its single value as text, or 'ERROR <message>'.
CREATE FUNCTION pg_temp.run_as(_role text, _sub uuid, _sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text;
BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN _sub IS NULL THEN '' ELSE json_build_object('sub', _sub, 'role', _role)::text END, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(_sub::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', _role);
  BEGIN EXECUTE _sql INTO r; EXCEPTION WHEN OTHERS THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true); PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN r;
END $$;
CREATE FUNCTION pg_temp.n(_user uuid, _prefix text) RETURNS bigint LANGUAGE sql AS
  $$ SELECT count(*) FROM public.notifications WHERE user_id = _user AND dedupe_key LIKE _prefix || '%' $$;
CREATE FUNCTION pg_temp.try(_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE _sql; RETURN 'OK'; EXCEPTION WHEN OTHERS THEN RETURN 'ERROR ' || SQLERRM; END $$;

-- Fixtures: two owners (A in UTC, B with an invalid zone name -> Europe/London fallback).
\set A '''7a000000-0000-4000-8000-0000000000a1'''
\set B '''7b000000-0000-4000-8000-0000000000b2'''
INSERT INTO auth.users (id, email) VALUES (:A, 'phase7-a@owner.test'), (:B, 'phase7-b@owner.test') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, timezone) VALUES (:A, 'UTC'), (:B, 'Not/AZone')
  ON CONFLICT (id) DO UPDATE SET timezone = EXCLUDED.timezone;
CREATE TEMP TABLE t_today ON COMMIT DROP AS SELECT (now() AT TIME ZONE 'UTC')::date AS a, (now() AT TIME ZONE 'Europe/London')::date AS b;
INSERT INTO public.invoices (id, user_id, invoice_number, client_name, total_amount, currency, due_date, status, archived_at) VALUES
  ('7a000000-0000-4000-8000-00000000a001', :A, 'T-OVERDUE', 'Acme Ltd', 1250, 'gbp', (SELECT a FROM t_today) - 3, 'sent', NULL),
  ('7a000000-0000-4000-8000-00000000a002', :A, 'T-PAID', 'Acme Ltd', 99, 'GBP', (SELECT a FROM t_today) - 3, 'paid', NULL),
  ('7a000000-0000-4000-8000-00000000a003', :A, 'T-ARCHIVED', 'Acme Ltd', 10, 'GBP', (SELECT a FROM t_today) - 3, 'sent', now()),
  ('7a000000-0000-4000-8000-00000000a004', :A, 'T-DRAFT', 'Acme Ltd', 10, 'GBP', (SELECT a FROM t_today) - 3, 'draft', NULL),
  ('7a000000-0000-4000-8000-00000000a005', :A, 'T-CANCELLED', 'Acme Ltd', 10, 'GBP', (SELECT a FROM t_today) - 3, 'Cancelled', NULL),
  ('7a000000-0000-4000-8000-00000000a006', :A, 'T-DUE-TODAY', 'Acme Ltd', 10, 'GBP', (SELECT a FROM t_today), 'sent', NULL),
  ('7a000000-0000-4000-8000-00000000a007', :A, 'T-NO-DUE', 'Acme Ltd', 10, 'GBP', NULL, 'sent', NULL),
  ('7a000000-0000-4000-8000-00000000a008', :A, 'T-TO-PAY', 'Beta plc', 500, 'EUR', (SELECT a FROM t_today) + 10, 'sent', NULL),
  ('7b000000-0000-4000-8000-00000000b001', :B, 'T-B-OVERDUE', NULL, 75.5, 'usd', (SELECT b FROM t_today) - 1, 'pending', NULL);
INSERT INTO public.quotes (id, user_id, quote_number, client_name, total_amount, currency, status, archived_at) VALUES
  ('7a000000-0000-4000-8000-00000000c001', :A, 'Q-LIVE', 'Acme Ltd', 300, 'GBP', 'draft', NULL),
  ('7a000000-0000-4000-8000-00000000c002', :A, 'Q-ARCHIVED', 'Acme Ltd', 300, 'GBP', 'draft', now());
INSERT INTO public.notes (id, user_id, title, reminder_date, is_archived, is_template) VALUES
  ('7a000000-0000-4000-8000-00000000d001', :A, 'Call the bank', now() - interval '5 minutes', false, false),
  ('7a000000-0000-4000-8000-00000000d002', :A, 'Future thing', now() + interval '1 hour', false, false),
  ('7a000000-0000-4000-8000-00000000d003', :A, 'Archived note', now() - interval '5 minutes', true, false),
  ('7a000000-0000-4000-8000-00000000d004', :A, 'Template note', now() - interval '5 minutes', false, true),
  ('7a000000-0000-4000-8000-00000000d005', :A, 'No reminder', NULL, false, false),
  ('7b000000-0000-4000-8000-00000000d101', :B, '   ', now() - interval '1 day', false, false);

-- Run 1 (as the server would: service_role through pg_cron / postgres).
CREATE TEMP TABLE t_run ON COMMIT DROP AS SELECT 1 AS run, public.generate_due_notifications() AS out;
SELECT pg_temp.ok('Run 1 creates 2 overdue-invoice and 2 reminder notifications for the fixtures',
  (SELECT pg_temp.n(:A, 'invoice_overdue:') + pg_temp.n(:B, 'invoice_overdue:')) = 2
  AND (SELECT pg_temp.n(:A, 'note_reminder:') + pg_temp.n(:B, 'note_reminder:')) = 2,
  (SELECT out::text FROM t_run WHERE run = 1));
SELECT pg_temp.ok('Overdue: the sent invoice due 3 days ago notifies, with its own amount and currency (GBP, not converted)',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :A AND dedupe_key = 'invoice_overdue:7a000000-0000-4000-8000-00000000a001'
          AND type = 'invoice_overdue' AND title = 'Invoice T-OVERDUE (1,250.00 GBP) is overdue' AND read = false
          AND link = '/business-tools?tool=business-finance-assistant&tab=invoices'),
  (SELECT title || ' | ' || message FROM public.notifications WHERE dedupe_key = 'invoice_overdue:7a000000-0000-4000-8000-00000000a001'));
SELECT pg_temp.ok('Overdue: paid invoice skipped', pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a002') = 0);
SELECT pg_temp.ok('Overdue: archived invoice skipped', pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a003') = 0);
SELECT pg_temp.ok('Overdue: draft and cancelled invoices skipped',
  pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a004') + pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a005') = 0);
SELECT pg_temp.ok('Overdue: invoice due today, or with no due date, skipped',
  pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a006') + pg_temp.n(:A, 'invoice_overdue:7a000000-0000-4000-8000-00000000a007') = 0);
SELECT pg_temp.ok('Overdue: invalid profile time zone falls back to Europe/London (status "pending" counts as unpaid)',
  pg_temp.n(:B, 'invoice_overdue:7b000000-0000-4000-8000-00000000b001') = 1,
  (SELECT title FROM public.notifications WHERE dedupe_key = 'invoice_overdue:7b000000-0000-4000-8000-00000000b001'));
SELECT pg_temp.ok('Reminder: a reminder in the past fires, linking to the note',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :A AND type = 'note_reminder' AND title = 'Reminder: Call the bank'
          AND link = '/business-tools/notepro?note=7a000000-0000-4000-8000-00000000d001'
          AND dedupe_key = 'note_reminder:7a000000-0000-4000-8000-00000000d001:' ||
              (SELECT floor(extract(epoch FROM reminder_date))::bigint FROM public.notes WHERE id = '7a000000-0000-4000-8000-00000000d001')));
SELECT pg_temp.ok('Reminder: a reminder in the future is skipped', pg_temp.n(:A, 'note_reminder:7a000000-0000-4000-8000-00000000d002') = 0);
SELECT pg_temp.ok('Reminder: archived note and template skipped',
  pg_temp.n(:A, 'note_reminder:7a000000-0000-4000-8000-00000000d003') + pg_temp.n(:A, 'note_reminder:7a000000-0000-4000-8000-00000000d004') = 0);
SELECT pg_temp.ok('Reminder: a blank title reads "Untitled note"',
  EXISTS (SELECT 1 FROM public.notifications WHERE user_id = :B AND title = 'Reminder: Untitled note'));

-- Run 2: nothing new.
INSERT INTO t_run SELECT 2, public.generate_due_notifications();
SELECT pg_temp.ok('Run 2 creates nothing (no duplicates)',
  (SELECT (out->>'invoice_overdue')::int + (out->>'note_reminder')::int FROM t_run WHERE run = 2) = 0
  AND (SELECT count(*) FROM public.notifications WHERE user_id IN (:A, :B) AND dedupe_key IS NOT NULL) = 4,
  (SELECT out::text FROM t_run WHERE run = 2));
SELECT pg_temp.ok('Even a direct second insert with the same key is refused by the unique index',
  pg_temp.try($q$INSERT INTO public.notifications (user_id, title, message, type, dedupe_key)
               VALUES ('7a000000-0000-4000-8000-0000000000a1', 'x', 'x', 'invoice_overdue', 'invoice_overdue:7a000000-0000-4000-8000-00000000a001')$q$) LIKE 'ERROR%duplicate key%');

-- Moving a reminder to a new past time fires once more; the old time never again.
UPDATE public.notes SET reminder_date = now() - interval '1 minute' WHERE id = '7a000000-0000-4000-8000-00000000d001';
INSERT INTO t_run SELECT 3, public.generate_due_notifications();
INSERT INTO t_run SELECT 4, public.generate_due_notifications();
SELECT pg_temp.ok('Reminder moved to a new time: fires once for the new time, then not again',
  pg_temp.n(:A, 'note_reminder:7a000000-0000-4000-8000-00000000d001') = 2
  AND (SELECT (out->>'note_reminder')::int FROM t_run WHERE run = 3) = 1
  AND (SELECT (out->>'note_reminder')::int FROM t_run WHERE run = 4) = 0);

-- Per-type switch-off.
INSERT INTO public.notes (id, user_id, title, reminder_date) VALUES ('7a000000-0000-4000-8000-00000000d006', :A, 'Muted', now() - interval '1 minute');
INSERT INTO public.notification_type_prefs (user_id, type, in_app) VALUES (:A, 'note_reminder', false);
INSERT INTO t_run SELECT 5, public.generate_due_notifications();
SELECT pg_temp.ok('A type switched off in preferences creates nothing', pg_temp.n(:A, 'note_reminder:7a000000-0000-4000-8000-00000000d006') = 0);
UPDATE public.notification_type_prefs SET in_app = true WHERE user_id = :A AND type = 'note_reminder';

-- Cap per run.
INSERT INTO t_run SELECT 6, public.generate_due_notifications(1);
SELECT pg_temp.ok('The per-run cap is respected (limit 1 -> at most 1 created)',
  (SELECT (out->>'invoice_overdue')::int + (out->>'note_reminder')::int FROM t_run WHERE run = 6) <= 1
  AND (SELECT (out->>'limit')::int FROM t_run WHERE run = 6) = 1, (SELECT out::text FROM t_run WHERE run = 6));
SELECT pg_temp.ok('Default cap is 500; an absurd limit is clamped to 5000',
  (SELECT (out->>'limit')::int FROM t_run WHERE run = 1) = 500
  AND (public.generate_due_notifications(1000000)->>'limit')::int = 5000);

-- Triggers.
UPDATE public.invoices SET status = 'paid', paid_at = now() WHERE id = '7a000000-0000-4000-8000-00000000a008';
SELECT pg_temp.ok('Trigger: invoice marked paid notifies once, says no email was sent',
  EXISTS (SELECT 1 FROM public.notifications WHERE dedupe_key = 'invoice_paid:7a000000-0000-4000-8000-00000000a008'
          AND title = 'Invoice T-TO-PAY (500.00 EUR) is marked paid' AND message = 'Beta plc. Recorded in B2BNEST. No email was sent.'));
UPDATE public.invoices SET status = 'sent' WHERE id = '7a000000-0000-4000-8000-00000000a008';
UPDATE public.invoices SET status = 'paid' WHERE id = '7a000000-0000-4000-8000-00000000a008';
SELECT pg_temp.ok('Trigger: paid again after unpaid does not notify twice', pg_temp.n(:A, 'invoice_paid:7a000000-0000-4000-8000-00000000a008') = 1);
UPDATE public.invoices SET client_name = 'Renamed' WHERE id = '7a000000-0000-4000-8000-00000000a002';
SELECT pg_temp.ok('Trigger: an update that does not change status creates nothing', pg_temp.n(:A, 'invoice_paid:7a000000-0000-4000-8000-00000000a002') = 0);
UPDATE public.quotes SET status = 'sent' WHERE id IN ('7a000000-0000-4000-8000-00000000c001', '7a000000-0000-4000-8000-00000000c002');
UPDATE public.quotes SET status = 'accepted' WHERE id = '7a000000-0000-4000-8000-00000000c001';
UPDATE public.quotes SET status = 'accepted' WHERE id = '7a000000-0000-4000-8000-00000000c001';
SELECT pg_temp.ok('Trigger: quote status changes notify once per status; archived quote skipped',
  pg_temp.n(:A, 'quote_update:7a000000-0000-4000-8000-00000000c001:') = 2
  AND EXISTS (SELECT 1 FROM public.notifications WHERE dedupe_key = 'quote_update:7a000000-0000-4000-8000-00000000c001:accepted'
              AND title = 'Quote Q-LIVE is now accepted' AND link = '/business-tools?tool=business-finance-assistant&tab=quotes')
  AND pg_temp.n(:A, 'quote_update:7a000000-0000-4000-8000-00000000c002:') = 0);

-- The trigger swallows an insert error: block the insert with a temporary constraint, the invoice update must still succeed.
ALTER TABLE public.notifications ADD CONSTRAINT phase7_test_block_paid CHECK (type IS DISTINCT FROM 'invoice_paid') NOT VALID;
CREATE TEMP TABLE t_swallow ON COMMIT DROP AS
  SELECT pg_temp.try($q$UPDATE public.invoices SET status = 'paid' WHERE id = '7a000000-0000-4000-8000-00000000a001'$q$) AS outcome;
SELECT pg_temp.ok('Trigger: when the notification insert fails, the invoice update still goes through (error swallowed)',
  (SELECT outcome FROM t_swallow) = 'OK'
  AND (SELECT status FROM public.invoices WHERE id = '7a000000-0000-4000-8000-00000000a001') = 'paid'
  AND pg_temp.n(:A, 'invoice_paid:7a000000-0000-4000-8000-00000000a001') = 0, (SELECT outcome FROM t_swallow));
ALTER TABLE public.notifications DROP CONSTRAINT phase7_test_block_paid;

-- Constraints on the new columns.
SELECT pg_temp.ok('Link must be an in-app path: "//evil.example" is rejected',
  pg_temp.try($q$INSERT INTO public.notifications (user_id, title, message, link) VALUES ('7a000000-0000-4000-8000-0000000000a1', 'x', 'x', '//evil.example')$q$) LIKE 'ERROR%notifications_link_in_app%');
SELECT pg_temp.ok('Link must be an in-app path: "https://evil.example" is rejected',
  pg_temp.try($q$INSERT INTO public.notifications (user_id, title, message, link) VALUES ('7a000000-0000-4000-8000-0000000000a1', 'x', 'x', 'https://evil.example')$q$) LIKE 'ERROR%notifications_link_in_app%');
SELECT pg_temp.ok('Rows without link or dedupe key (old writers) still insert',
  pg_temp.try($q$INSERT INTO public.notifications (user_id, title, message, type) VALUES ('7a000000-0000-4000-8000-0000000000a1', 'Legacy', 'Old writer', 'task_shared')$q$) = 'OK');

-- Who can see and run what.
SELECT pg_temp.ok('A user sees their own notifications',
  pg_temp.run_as('authenticated', :A, $q$SELECT count(*) FROM public.notifications WHERE user_id = '7a000000-0000-4000-8000-0000000000a1'$q$)::int > 0);
SELECT pg_temp.ok('A user cannot read another user''s notifications',
  pg_temp.run_as('authenticated', :A, $q$SELECT count(*) FROM public.notifications WHERE user_id = '7b000000-0000-4000-8000-0000000000b2'$q$) = '0');
SELECT pg_temp.ok('A user cannot mark another user''s notification read',
  pg_temp.run_as('authenticated', :A, $q$WITH u AS (UPDATE public.notifications SET read = true WHERE user_id = '7b000000-0000-4000-8000-0000000000b2' RETURNING 1) SELECT count(*) FROM u$q$) = '0');
SELECT pg_temp.ok('A user cannot read another user''s type preferences',
  pg_temp.run_as('authenticated', :B, $q$SELECT count(*) FROM public.notification_type_prefs WHERE user_id = '7a000000-0000-4000-8000-0000000000a1'$q$) = '0');
SELECT pg_temp.ok('A user cannot write a preference row for someone else',
  pg_temp.run_as('authenticated', :B, $q$INSERT INTO public.notification_type_prefs (user_id, type, in_app) VALUES ('7a000000-0000-4000-8000-0000000000a1', 'quote_update', false) RETURNING 1$q$) LIKE 'ERROR%row-level security%');
SELECT pg_temp.ok('A user can switch their own type off and on',
  pg_temp.run_as('authenticated', :B, $q$INSERT INTO public.notification_type_prefs (user_id, type, in_app) VALUES ('7b000000-0000-4000-8000-0000000000b2', 'quote_update', false)
     ON CONFLICT (user_id, type) DO UPDATE SET in_app = EXCLUDED.in_app RETURNING in_app::text$q$) = 'false');
SELECT pg_temp.ok('Anon cannot read type preferences',
  pg_temp.run_as('anon', NULL, $q$SELECT count(*) FROM public.notification_type_prefs$q$) LIKE 'ERROR%permission denied%');
SELECT pg_temp.ok('anon and authenticated have no EXECUTE on the generator; service_role has',
  NOT has_function_privilege('anon', 'public.generate_due_notifications(integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.generate_due_notifications(integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.generate_due_notifications(integer)', 'EXECUTE'));
SELECT pg_temp.ok('Calling the generator as authenticated fails with permission denied',
  pg_temp.run_as('authenticated', :A, $q$SELECT public.generate_due_notifications()::text$q$) LIKE 'ERROR%permission denied%');
SELECT pg_temp.ok('Calling the generator as anon fails with permission denied',
  pg_temp.run_as('anon', NULL, $q$SELECT public.generate_due_notifications()::text$q$) LIKE 'ERROR%permission denied%');
SELECT pg_temp.ok('Helpers are not callable by anon or authenticated (no way to write a notification for someone else)',
  NOT has_function_privilege('authenticated', 'public._notify(uuid,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public._notify(uuid,text,text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public._notification_today(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public._notification_wanted(uuid,text)', 'EXECUTE'));
SELECT pg_temp.ok('Every new function is SECURITY DEFINER with an empty search_path (money formatter: plain, immutable)',
  (SELECT bool_and(prosecdef AND proconfig = ARRAY['search_path=""']) FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname IN ('generate_due_notifications', '_notify', '_notification_today', '_notification_wanted', 'notify_invoice_paid', 'notify_quote_update'))
  AND (SELECT proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = '_notification_money'));
SELECT pg_temp.ok('Service role can run the generator',
  pg_temp.run_as('service_role', NULL, $q$SELECT (public.generate_due_notifications()->>'limit')$q$) = '500');

\o
\pset format unaligned
\pset tuples_only on
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END || ' | ' || name || CASE WHEN detail <> '' THEN ' | ' || detail ELSE '' END FROM t_results ORDER BY n;
SELECT 'SUMMARY | ' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM t_results;
ROLLBACK;
