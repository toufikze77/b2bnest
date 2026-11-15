-- Finance phase 3b follow-up 2 tests, part 2 (DISPOSABLE local Postgres only): after vat-registered.sql. One
-- transaction, rolled back. Fictional people only.
--  N (0ff…1): not VAT registered (the default)   R (0ff…2): VAT registered   F (0ff…3): registered from 1 Mar 2026
--  People: 1 owner of N, R and F (Business); 2 plain member of N; 3 demo admin of N; 4 admin of N with an authenticator
--  app; 5 Solo owner of S (0ff…4); 9 in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('ff000000-0000-4000-8000-00000000000' || x)::uuid, 'w' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code)
SELECT ('ff000000-0000-4000-8000-00000000000' || x)::uuid, 'w' || x || '@example.test', 'Person ' || x, true, 'GBP' FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('ff000000-0000-4000-8000-000000000001', 'w1@example.test', true, 'active', 'professional'),
  ('ff000000-0000-4000-8000-000000000005', 'w5@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0ff00000-0000-4000-8000-00000000000' || x)::uuid, 'W' || x, 'w-co-' || x, CASE WHEN x = 4 THEN 'ff000000-0000-4000-8000-000000000005' ELSE 'ff000000-0000-4000-8000-000000000001' END::uuid
  FROM generate_series(1, 4) x;
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0ff00000-0000-4000-8000-00000000000' || c)::uuid, ('ff000000-0000-4000-8000-00000000000' || u)::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (2, 1, 'owner'), (3, 1, 'owner'), (1, 2, 'member'), (1, 3, 'admin'), (1, 4, 'admin'), (4, 5, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id)
SELECT ('0ff00000-0000-4000-8000-00000000000' || x)::uuid, CASE WHEN x = 4 THEN 'ff000000-0000-4000-8000-000000000005' ELSE 'ff000000-0000-4000-8000-000000000001' END::uuid FROM generate_series(1, 4) x;
INSERT INTO public.demo_readonly_users (user_id) VALUES ('ff000000-0000-4000-8000-000000000003');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('ff000000-0000-4000-8000-000000000004', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'ff000000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0ff00000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('ff000000-0000-4000-8000-00000000000' || n)::uuid $$;
-- A bill: VAT recorded when net is given, otherwise not recorded.
CREATE FUNCTION pg_temp.bill(org int, num text, gross numeric, net numeric, vat numeric, issued date, st text DEFAULT 'pending', paid date DEFAULT NULL,
                             cat text DEFAULT 'Software', cur text DEFAULT 'GBP') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                            currency, issue_date, due_date, paid_date, tax_point_date, status, category)
  VALUES (pg_temp.u(1), pg_temp.o(org), num, 'Acme', 'x', gross, net, vat, CASE WHEN net IS NULL THEN NULL WHEN vat > 0 THEN 20 ELSE 0 END,
          CASE WHEN net IS NULL THEN NULL WHEN vat > 0 THEN 'standard' ELSE 'zero' END, CASE WHEN net IS NULL THEN 'not_recorded' ELSE 'recorded' END,
          cur, issued, issued + 30, paid, CASE WHEN net IS NULL THEN NULL ELSE issued END, st, cat) RETURNING id $$;
CREATE FUNCTION pg_temp.exp(org int, cat text, gross numeric, d date, net numeric DEFAULT NULL, vat numeric DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
  VALUES (pg_temp.u(1), pg_temp.o(org), cat, 'x ' || cat, gross, net, vat, CASE WHEN net IS NULL THEN NULL WHEN vat > 0 THEN 20 ELSE 0 END,
          CASE WHEN net IS NULL THEN NULL WHEN vat > 0 THEN 'standard' ELSE 'zero' END, CASE WHEN net IS NULL THEN 'not_recorded' ELSE 'recorded' END,
          d, CASE WHEN net IS NULL THEN NULL ELSE d END, 'approved') RETURNING id $$;
CREATE FUNCTION pg_temp.live(src uuid, k text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT entry_id FROM public.ledger_postings WHERE source_id = src AND kind = k AND reversed_at IS NULL $$;
CREATE FUNCTION pg_temp.lines(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(COALESCE(a.system_key, a.code) || ':' || l.debit || '/' || l.credit, ' ' ORDER BY l.line_no)
    FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e $$;
CREATE FUNCTION pg_temp.issue(src uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(reason_code, ',' ORDER BY kind) FROM public.ledger_post_issues WHERE source_id = src AND resolved_at IS NULL $$;
CREATE FUNCTION pg_temp.byname(t text, n text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN t = 'b' THEN (SELECT id FROM public.bills WHERE bill_number = n) ELSE (SELECT id FROM public.expenses WHERE description = n) END $$;
CREATE FUNCTION pg_temp.balanced() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit) OR count(*) < 2) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.o(int), pg_temp.u(int), pg_temp.live(uuid, text), pg_temp.lines(uuid), pg_temp.issue(uuid),
  pg_temp.byname(text, text), pg_temp.balanced() TO PUBLIC;

SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(n), '2026-01-01', 'fresh', NULL) FROM generate_series(1, 3) n;
SELECT public.ledger_auto_set(pg_temp.o(n), true, 'bills_and_expenses') FROM generate_series(1, 3) n;
RESET ROLE;

\echo '== the setting: default No, read in the status'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  s := public.ledger_auto_status(pg_temp.o(1));
  PERFORM pg_temp.ok(s ? 'vat_registered' AND NOT (s ->> 'vat_registered')::boolean AND s ->> 'vat_registered_from' IS NULL, 'status: vat_registered false by default, no date');
  PERFORM pg_temp.ok(s ? 'bills_enabled' AND s ? 'invoices_enabled' AND s ? 'waiting' AND s ? 'open_issues' AND s ? 'enabled_at' AND s ? 'can_manage', 'every earlier status key is kept');
  s := public.ledger_vat_registered_set(pg_temp.o(2), true);
  PERFORM pg_temp.ok((s ->> 'vat_registered')::boolean AND s ->> 'vat_registered_from' IS NULL, 'R: registered (no date)');
  s := public.ledger_vat_registered_set(pg_temp.o(3), true, '2026-03-01');
  PERFORM pg_temp.ok((s ->> 'vat_registered')::boolean AND s ->> 'vat_registered_from' = '2026-03-01', 'F: registered from 1 March 2026');
  PERFORM public.ledger_vat_registered_set(pg_temp.o(2), true);
  PERFORM public.ledger_vat_registered_set(pg_temp.o(1), false);
  PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), NULL)$q$, 'LEDGER_BAD_REQUEST', 'yes or no is required');
  PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true, '1990-01-01')$q$, 'LEDGER_BAD_DATE', 'a sensible date only');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.vat_registered_on' AND user_id = pg_temp.u(1)) = 2
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'ledger.vat_registered_off'),
    'audit: one row per real change (R and F on); setting R to Yes again and N to No again wrote nothing');
END $$;

\echo '== who may change it'
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true)$q$, 'LEDGER_NOT_ADMIN', 'a plain member can''t');
  PERFORM pg_temp.ok(NOT (public.ledger_auto_status(pg_temp.o(1)) ->> 'vat_registered')::boolean, 'but can read it');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true)$q$, 'LEDGER_NOT_MEMBER', 'an outsider can''t'); END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true)$q$, 'LEDGER_DEMO', 'the demo account can''t'); END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true)$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first'); END $$;
RESET ROLE;
SELECT pg_temp.who(4, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT (public.ledger_vat_registered_set(pg_temp.o(1), false) ->> 'vat_registered')::boolean, 'at aal2: allowed (no change, so no audit row)');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(4), true)$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo: refused'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(1), true)$q$, 'permission denied', 'anon: no RPC'); END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_auto_settings SET vat_registered = true$q$, 'permission denied', 'no direct write to the setting');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_vat_registered(pg_temp.o(1), current_date)$q$, 'permission denied', 'the helper is not callable');
END $$;
RESET ROLE;

\echo '== not VAT registered (N): the whole amount as the cost, no VAT line'
SELECT pg_temp.bill(1, 'N-1', 120.00, NULL, NULL, '2026-02-01');
SELECT pg_temp.bill(1, 'N-2', 60.00, NULL, NULL, '2026-02-02', 'paid', '2026-02-20', 'Insurance');
SELECT pg_temp.bill(1, 'N-3', 120.00, 100.00, 20.00, '2026-02-03');
SELECT pg_temp.exp(1, 'transport', 24.00, '2026-02-14');
SELECT pg_temp.bill(1, 'N-EUR', 12.00, NULL, NULL, '2026-02-05', 'pending', NULL, 'Software', 'EUR');
SELECT pg_temp.bill(1, 'N-EQ', 12.00, NULL, NULL, '2026-02-05', 'pending', NULL, 'equipment_tools');
SELECT pg_temp.bill(1, 'N-OLD', 12.00, NULL, NULL, '2025-12-05');
SELECT public.ledger_process_queue();
DO $$ DECLARE e public.journal_entries; BEGIN
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live(pg_temp.byname('b', 'N-1'), 'bill_received');
  PERFORM pg_temp.ok(pg_temp.lines(e.id) = '7700:120.00/0.00 creditors:0.00/120.00' AND e.memo = 'Bill N-1 from Acme received',
    'an unrecorded bill: Dr Software 120.00 (the whole amount), Cr Creditors 120.00, no VAT line, memo unchanged');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.byname('b', 'N-2'), 'bill_paid')) = 'creditors:60.00/0.00 bank:0.00/60.00'
    AND pg_temp.lines(pg_temp.live(pg_temp.byname('b', 'N-2'), 'bill_received')) = '8200:60.00/0.00 creditors:0.00/60.00', 'its payment posts as usual');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.byname('b', 'N-3'), 'bill_received')) = '7700:100.00/0.00 vat_control:20.00/0.00 creditors:0.00/120.00',
    'recorded VAT is never discarded: posted with its VAT line even though N is not registered');
  PERFORM pg_temp.ok((SELECT pg_temp.lines(p.entry_id) FROM public.ledger_postings p WHERE p.organization_id = pg_temp.o(1) AND p.source_label = 'transport' AND p.reversed_at IS NULL)
    = '7400:24.00/0.00 bank:0.00/24.00', 'an unrecorded expense: Dr Travel 24.00, Cr Bank');
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.byname('b', 'N-EUR')) = 'currency_not_gbp' AND pg_temp.issue(pg_temp.byname('b', 'N-EQ')) = 'category_not_mapped'
    AND pg_temp.issue(pg_temp.byname('b', 'N-OLD')) = 'before_start', 'the other holds still apply: not GBP, category not mapped, before the start date');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
END $$;
UPDATE public.ledger_settings SET locked_through = '2026-01-31' WHERE organization_id = pg_temp.o(1);
SELECT pg_temp.bill(1, 'N-LOCK', 12.00, NULL, NULL, '2026-01-20');
SELECT public.ledger_process_queue();
DO $$ BEGIN PERFORM pg_temp.ok(pg_temp.issue(pg_temp.byname('b', 'N-LOCK')) = 'period_locked', 'and a locked period'); END $$;

\echo '== VAT registered (R): unrecorded is held, recorded posts with VAT'
SELECT pg_temp.bill(2, 'R-1', 120.00, NULL, NULL, '2026-02-01');
SELECT pg_temp.bill(2, 'R-2', 120.00, 100.00, 20.00, '2026-02-01');
SELECT public.ledger_process_queue();
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.byname('b', 'R-1')) = 'vat_details_missing' AND pg_temp.live(pg_temp.byname('b', 'R-1'), 'bill_received') IS NULL,
    'registered: an unrecorded bill waits as "VAT details missing"');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.byname('b', 'R-2'), 'bill_received')) = '7700:100.00/0.00 vat_control:20.00/0.00 creditors:0.00/120.00', 'a recorded bill posts with VAT');
END $$;

\echo '== registered from a date (F, from 1 March 2026)'
SELECT pg_temp.exp(3, 'transport', 12.00, '2026-02-15');
SELECT pg_temp.exp(3, 'fuel', 12.00, '2026-03-05');
SELECT public.ledger_process_queue();
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT pg_temp.lines(p.entry_id) FROM public.ledger_postings p WHERE p.organization_id = pg_temp.o(3) AND p.source_label = 'transport' AND p.reversed_at IS NULL) = '7400:12.00/0.00 bank:0.00/12.00',
    'dated before the registration date: posts with no VAT');
  PERFORM pg_temp.ok((SELECT reason_code FROM public.ledger_post_issues i JOIN public.expenses e ON e.id = i.source_id WHERE e.organization_id = pg_temp.o(3) AND e.category = 'fuel' AND i.resolved_at IS NULL) = 'vat_details_missing',
    'dated on or after it: held until its VAT is recorded');
END $$;

\echo '== switching: No posts the held records; Yes reverses nothing; back and forth changes nothing'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN PERFORM public.ledger_vat_registered_set(pg_temp.o(2), false); END $$;
RESET ROLE;
DO $$ DECLARE n int; h text; BEGIN
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE source_id = pg_temp.byname('b', 'R-1')), 'switching R to No queues its held bill (queue rows only)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.vat_registered_off') = 1, 'one audit row for the change');
  PERFORM public.ledger_process_queue();
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.byname('b', 'R-1'), 'bill_received')) = '7700:120.00/0.00 creditors:0.00/120.00' AND pg_temp.issue(pg_temp.byname('b', 'R-1')) IS NULL,
    'and it posts with no VAT; its issue resolves');
  n := (SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(2));
  h := (SELECT version_hash FROM public.ledger_postings WHERE source_id = pg_temp.byname('b', 'R-1') AND reversed_at IS NULL);
  PERFORM set_config('test.n', n::text, false); PERFORM set_config('test.h', h, false);
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_vat_registered_set(pg_temp.o(2), true);
SELECT public.ledger_auto_catch_up(pg_temp.o(2), 'bills_and_expenses');
SELECT public.ledger_vat_registered_set(pg_temp.o(2), false);
SELECT public.ledger_auto_catch_up(pg_temp.o(2), 'bills_and_expenses');
SELECT public.ledger_vat_registered_set(pg_temp.o(2), true);
SELECT public.ledger_auto_catch_up(pg_temp.o(2), 'bills_and_expenses');
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(2)) = current_setting('test.n')::int
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(2) AND reverses_entry_id IS NOT NULL),
    'Yes, No, Yes with a catch-up after each: no journal added, nothing reversed');
  PERFORM pg_temp.ok((SELECT version_hash FROM public.ledger_postings WHERE source_id = pg_temp.byname('b', 'R-1') AND reversed_at IS NULL) = current_setting('test.h'),
    'the no-VAT posting keeps its version_hash (the setting is not part of it)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action LIKE 'ledger.vat_registered_%') = 6, 'audit: one row per real change (R on, F on, then R off, on, off, on)');
  -- Registered now: a new unrecorded bill is held; editing the no-VAT one makes it a new version, which is held too.
  PERFORM pg_temp.bill(2, 'R-3', 30.00, NULL, NULL, '2026-02-03');
  UPDATE public.bills SET amount = 130.00 WHERE bill_number = 'R-1';
  PERFORM public.ledger_process_queue();
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.byname('b', 'R-3')) = 'vat_details_missing', 'registered again: a new unrecorded bill is held');
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.byname('b', 'R-1'), 'bill_received') IS NULL AND pg_temp.issue(pg_temp.byname('b', 'R-1')) = 'vat_details_missing',
    'and an edited one is a new version: its old journal is reversed (the edit, not the setting) and it waits for its VAT');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
END $$;

\echo '== closed company'
DO $$ BEGIN PERFORM public.data_rights_close_company(pg_temp.o(3), pg_temp.u(1), NULL, false); END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_vat_registered_set(pg_temp.o(3), false)$q$, 'LEDGER_CLOSED', 'a closed company: refused'); END $$;
RESET ROLE;
ROLLBACK;
