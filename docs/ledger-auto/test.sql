-- Finance phase 3a tests (DISPOSABLE local Postgres only). Run by docs/ledger-auto/run-test.sh after production's shape
-- (phase 2 applied) and docs/ledger-auto/proposal.sql. One transaction, rolled back. Fictional people only.
-- People (fa0…0NN) and companies (0fa…00N), as in docs/ledger/test.sql:
--  A (1): 1 owner paying Business, 2 admin, 3 member, 6 the demo account (admin), 8 admin with an authenticator app.
--  B (2): 4 owner on the trial.   C (3): 5 owner on Solo.   D (4): 7 owner whose trial ended.   9: in no company.
--  E (5): 10 the only member, on the trial (closed at the end).
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'la' || x || '@example.test' FROM generate_series(1, 10) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active)
SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'la' || x || '@example.test', 'Person ' || x,
       CASE WHEN x IN (4, 10) THEN now() + interval '5 days' WHEN x = 7 THEN now() - interval '2 days' END, true
  FROM generate_series(1, 10) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, trial_ends_at = EXCLUDED.trial_ends_at;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fa000000-0000-4000-8000-000000000001', 'la1@example.test', true, 'active', 'professional'),
  ('fa000000-0000-4000-8000-000000000005', 'la5@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0fa00000-0000-4000-8000-00000000000' || x)::uuid, 'Company ' || x, 'auto-co-' || x, ('fa000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 5), (4, 7), (5, 10)) v(x, o);
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fa00000-0000-4000-8000-00000000000' || c)::uuid, ('fa000000-0000-4000-8000-0000000000' || lpad(u::text, 2, '0'))::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'admin'), (1, 3, 'member'), (1, 6, 'admin'), (1, 8, 'admin'), (2, 4, 'owner'), (3, 5, 'owner'), (4, 7, 'owner'), (5, 10, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id)
SELECT ('0fa00000-0000-4000-8000-00000000000' || x)::uuid, ('fa000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 5), (4, 7), (5, 10)) v(x, o);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fa000000-0000-4000-8000-000000000006');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fa000000-0000-4000-8000-000000000008', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fa00000-0000-4000-8000-00000000000' || n)::uuid $$;
-- An invoice, written as the database owner (the app's own checks are not under test here).
CREATE FUNCTION pg_temp.inv(org int, num text, st text, sub numeric, tax numeric, tot numeric, created date, paid timestamptz DEFAULT NULL,
                            cur text DEFAULT 'GBP', owner int DEFAULT 1, tp date DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at, paid_at, tax_point_date)
  VALUES (pg_temp.u(owner), pg_temp.o(org), num, st, sub, tax, tot, cur, (created::text || ' 12:00:00+00')::timestamptz, paid, tp) RETURNING id $$;
CREATE FUNCTION pg_temp.id(num text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.invoices WHERE invoice_number = num $$;
-- The live automatic journal of an invoice for a kind, and its lines as 'code:debit/credit' sorted.
CREATE FUNCTION pg_temp.live(num text, k text DEFAULT 'invoice_issued') RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT p.entry_id FROM public.ledger_postings p WHERE p.source_id = pg_temp.id(num) AND p.kind = k AND p.reversed_at IS NULL $$;
CREATE FUNCTION pg_temp.lines(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(a.system_key || ':' || l.debit || '/' || l.credit, ' ' ORDER BY l.line_no) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e $$;
CREATE FUNCTION pg_temp.run() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.ledger_process_queue() $$;
CREATE FUNCTION pg_temp.open_issue(num text, k text DEFAULT 'invoice_issued') RETURNS text LANGUAGE sql STABLE AS $$
  SELECT reason_code FROM public.ledger_post_issues WHERE source_id = pg_temp.id(num) AND kind = k AND resolved_at IS NULL $$;
CREATE FUNCTION pg_temp.balanced() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit) OR count(*) < 2) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int), pg_temp.o(int), pg_temp.id(text), pg_temp.live(text, text), pg_temp.lines(uuid),
  pg_temp.open_issue(text, text), pg_temp.balanced() TO PUBLIC;

-- Ledgers: A from 1 Jan 2026, B from 1 Apr 2026 (both fresh).
SELECT pg_temp.who(1); SET ROLE authenticated; SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'fresh', NULL); RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated; SELECT public.ledger_setup(pg_temp.o(2), '2026-04-01', 'fresh', NULL); RESET ROLE;

\echo '== off by default: invoices save, nothing is queued or posted'
SELECT pg_temp.inv(1, 'A-001', 'sent', 100.00, 20.00, 120.00, '2026-02-01');
SELECT pg_temp.inv(1, 'A-002', 'paid', 50.00, 0, 50.00, '2026-02-02', '2026-02-10 09:30:00+00');
SELECT pg_temp.inv(1, 'A-003', 'draft', 10.00, 2.00, 12.00, '2026-02-03');
SELECT pg_temp.inv(1, 'A-004', 'sent', 10.00, 2.00, 12.00, '2025-12-15');
SELECT pg_temp.inv(1, 'A-005', 'sent', 10.00, 2.00, 12.01, '2026-02-05');
SELECT pg_temp.inv(1, 'A-006', 'sent', 10.00, 2.00, 12.00, '2026-02-06', NULL, 'USD');
SELECT pg_temp.inv(1, 'A-007', 'paid', 80.00, 16.00, 96.00, '2026-02-07');
SELECT pg_temp.inv(1, 'A-008', 'overdue', 33.33, 6.67, 40.00, '2026-03-10', NULL, 'GBP', 2, '2026-03-05');
SELECT pg_temp.inv(1, 'A-009', 'sent', 10.00, 2.00, 12.00, '2026-02-09');
UPDATE public.invoices SET archived_at = now() WHERE invoice_number = 'A-009';
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings), 'no company has automatic postings on');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'nothing queued while off');
  PERFORM pg_temp.ok((pg_temp.run() ->> 'processed')::int = 0 AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(1)), 'and nothing posted');
END $$;
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  s := public.ledger_auto_status(pg_temp.o(1));
  PERFORM pg_temp.ok(s ->> 'access' = 'ok' AND (s ->> 'can_manage')::boolean AND (s ->> 'set_up')::boolean AND NOT (s ->> 'invoices_enabled')::boolean, 'status: owner can manage, off');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1))$q$, 'LEDGER_AUTO_OFF', 'catch-up needs the switch on');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_run(pg_temp.o(1))$q$, 'LEDGER_AUTO_OFF', 'and so does "post now"');
END $$;

\echo '== preview: counts and totals in pence, nothing written'
DO $$ DECLARE p jsonb; BEGIN
  p := public.ledger_auto_preview(pg_temp.o(1));
  PERFORM pg_temp.ok((p ->> 'invoices_to_post')::int = 4 AND (p ->> 'invoices_total')::bigint = 30600, 'four invoices to post, £306.00 (A-001, A-002, A-007, A-008)');
  PERFORM pg_temp.ok((p ->> 'payments_to_post')::int = 1 AND (p ->> 'payments_total')::bigint = 5000, 'one payment to post, £50.00 (A-002)');
  PERFORM pg_temp.ok(p -> 'skipped' = '{"before_start": 1, "currency_not_gbp": 1, "paid_date_missing": 1, "amounts_do_not_add_up": 1}'::jsonb,
    'skipped with reasons: before the start date, not GBP, no paid date, amounts not adding up');
  PERFORM pg_temp.ok((p ->> 'not_issued')::int = 2 AND (p ->> 'already_posted')::int = 0 AND (p ->> 'to_reverse')::int = 0, 'draft and archived are not issued');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_issues),
    'the preview wrote nothing');
END $$;

\echo '== who may switch it on'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true)$q$, 'LEDGER_NOT_ADMIN', 'a plain member can''t switch it on');
  PERFORM pg_temp.ok((public.ledger_auto_preview(pg_temp.o(1)) ->> 'invoices_to_post')::int = 4, 'but can read the preview');
  PERFORM pg_temp.ok(NOT (public.ledger_auto_status(pg_temp.o(1)) ->> 'can_manage')::boolean, 'and status says read only');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(3), true)$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo: refused');
  PERFORM pg_temp.ok(public.ledger_auto_status(pg_temp.o(3)) ->> 'access' = 'plan_not_included', 'Solo status: the upgrade note');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_preview(pg_temp.o(3))$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo preview: refused');
END $$;
RESET ROLE;
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(4), true)$q$, 'LEDGER_TRIAL_ENDED', 'trial ended: refused'); END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true)$q$, 'LEDGER_DEMO', 'demo account: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1))$q$, 'LEDGER_DEMO', 'demo account: no catch-up');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_status(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'an outsider: no status');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_preview(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'no preview');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true)$q$, 'LEDGER_NOT_MEMBER', 'no switch');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'no catch-up');
END $$;
RESET ROLE;
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true)$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first'); END $$;
RESET ROLE;
SELECT pg_temp.who(10); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(5), true)$q$, 'LEDGER_NOT_SET_UP', 'the ledger must be set up first'); END $$;
SELECT public.ledger_setup(pg_temp.o(5), '2026-01-01', 'fresh', NULL);
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(2), true)$q$, 'LEDGER_NOT_MEMBER', 'the owner of A can''t switch company B');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_preview(pg_temp.o(2))$q$, 'LEDGER_NOT_MEMBER', 'or preview it');
  s := public.ledger_auto_set(pg_temp.o(1), true);
  PERFORM pg_temp.ok((s ->> 'invoices_enabled')::boolean AND s ->> 'enabled_at' IS NOT NULL, 'the owner switches it on');
  PERFORM public.ledger_auto_set(pg_temp.o(1), true);
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE user_id = pg_temp.u(1) AND action = 'ledger.auto_invoices_on' AND resource_id = pg_temp.o(1)::text) = 1,
    'one audit row (switching on twice records it once)');
  PERFORM pg_temp.ok((SELECT enabled_by FROM public.ledger_auto_settings WHERE organization_id = pg_temp.o(1)) = pg_temp.u(1), 'who switched it on is kept (opaque id)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(1)), 'switching on posts nothing by itself');
END $$;

\echo '== catch-up: issue and payment journals, balanced, on the system accounts'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1))$q$, 'LEDGER_NOT_ADMIN', 'a plain member can''t run the catch-up'); END $$;
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(1));
  PERFORM pg_temp.ok((r ->> 'queued')::int = 9 AND (r ->> 'processed')::int = 9 AND (r ->> 'remaining')::int = 0 AND (r ->> 'failed')::int = 0, 'catch-up queues and processes all nine invoices');
END $$;
RESET ROLE;
DO $$ DECLARE e public.journal_entries; BEGIN
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live('A-001');
  PERFORM pg_temp.ok(e.entry_date = '2026-02-01' AND e.memo = 'Invoice A-001 issued' AND e.reason = 'Automatic posting' AND e.source_type = 'auto_invoice'
    AND e.source_id = pg_temp.id('A-001') AND e.posted_by = pg_temp.u(1) AND e.posted_by_name = 'Automatic posting', 'A-001: memo, reason, source, dated its issue day, posted as the invoice''s owner');
  PERFORM pg_temp.ok(pg_temp.lines(e.id) = 'debtors:120.00/0.00 sales:0.00/100.00 vat_control:0.00/20.00', 'A-001: Dr Debtors 120.00, Cr Sales 100.00, Cr VAT control 20.00');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live('A-002')) = 'debtors:50.00/0.00 sales:0.00/50.00', 'A-002: no VAT line when the VAT is zero');
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live('A-002', 'invoice_paid');
  PERFORM pg_temp.ok(e.entry_date = '2026-02-10' AND e.memo = 'Invoice A-002 paid' AND e.source_type = 'auto_invoice_payment'
    AND pg_temp.lines(e.id) = 'bank:50.00/0.00 debtors:0.00/50.00', 'A-002 paid: dated the paid day, Dr Bank, Cr Debtors');
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live('A-008');
  PERFORM pg_temp.ok(e.entry_date = '2026-03-05' AND e.posted_by = pg_temp.u(2) AND pg_temp.lines(e.id) = 'debtors:40.00/0.00 sales:0.00/33.33 vat_control:0.00/6.67',
    'A-008: dated its tax point, pence exact (33.33 + 6.67 = 40.00)');
  PERFORM pg_temp.ok(pg_temp.live('A-007') IS NOT NULL AND pg_temp.live('A-007', 'invoice_paid') IS NULL AND pg_temp.open_issue('A-007', 'invoice_paid') = 'paid_date_missing',
    'A-007: paid without a paid date: the issue posts, the payment needs attention');
  PERFORM pg_temp.ok(pg_temp.open_issue('A-004') = 'before_start' AND pg_temp.live('A-004') IS NULL, 'A-004: before the ledger start date: needs attention, not posted');
  PERFORM pg_temp.ok(pg_temp.open_issue('A-005') = 'amounts_do_not_add_up' AND pg_temp.live('A-005') IS NULL, 'A-005: 10.00 + 2.00 is not 12.01: needs attention');
  PERFORM pg_temp.ok(pg_temp.open_issue('A-006') = 'currency_not_gbp' AND pg_temp.live('A-006') IS NULL, 'A-006: USD: skipped, needs attention');
  PERFORM pg_temp.ok(pg_temp.live('A-003') IS NULL AND pg_temp.open_issue('A-003') IS NULL AND pg_temp.live('A-009') IS NULL, 'draft and archived: nothing, and no issue');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings) = 5 AND (SELECT count(*) FROM public.ledger_post_issues WHERE resolved_at IS NULL) = 4, 'five postings, four issues');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
  PERFORM pg_temp.ok((SELECT sum(debit) - sum(credit) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE a.organization_id = pg_temp.o(1) AND a.system_key = 'debtors') = 256.00,
    'Debtors: 120 + 50 - 50 + 96 + 40 = 256.00');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; p jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(1));
  PERFORM pg_temp.ok((r ->> 'processed')::int = 9, 'a second catch-up looks at everything again');
  p := public.ledger_auto_preview(pg_temp.o(1));
  PERFORM pg_temp.ok((p ->> 'invoices_to_post')::int = 0 AND (p ->> 'payments_to_post')::int = 0 AND (p ->> 'already_posted')::int = 5, 'preview now: nothing to post, five already posted');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) = 5 AND (SELECT count(*) FROM public.ledger_postings) = 5, 'and posts nothing twice');
  PERFORM pg_temp.fails($q$WITH j AS (SELECT public._ledger_auto_journal(pg_temp.o(1), '2026-02-01', 'Invoice A-001 issued', 'auto_invoice', pg_temp.id('A-001'), pg_temp.u(1),
      (SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'debit', public._ledger_auto_pence(debit), 'credit', public._ledger_auto_pence(credit))) FROM public.journal_lines WHERE entry_id = pg_temp.live('A-001'))) AS id)
    INSERT INTO public.ledger_postings (organization_id, source_table, source_id, kind, version_hash, entry_id)
    SELECT organization_id, source_table, source_id, kind, version_hash, (SELECT id FROM j) FROM public.ledger_postings WHERE kind = 'invoice_issued' AND source_label = 'A-001'$q$,
    'ledger_postings_one_live', 'the database refuses a second live posting for the same invoice and kind');
END $$;

\echo '== changes after posting: reverse, then post the new version'
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'A-010', 'draft', 0.10, 0.20, 0.30, 'GBP', '2026-03-20 12:00+00');
SELECT pg_temp.who(1); SET ROLE authenticated;
UPDATE public.invoices SET status = 'sent' WHERE invoice_number = 'A-010';
RESET ROLE;
DO $$ DECLARE old uuid; rev public.journal_entries; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_post_queue WHERE source_id = pg_temp.id('A-010')) = 2, 'the invoice trigger queued A-010 (created as a draft, then sent by its owner)');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live('A-010')) = 'debtors:0.30/0.00 sales:0.00/0.10 vat_control:0.00/0.20', 'A-010 posted: 0.10 + 0.20 = 0.30 exactly');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'the queue is empty after the run');
  UPDATE public.invoices SET notes = 'no ledger field changed' WHERE invoice_number = 'A-001';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'a change to a field the ledger doesn''t use queues nothing');

  old := pg_temp.live('A-001');
  UPDATE public.invoices SET subtotal = 200.00, tax_amount = 40.00, total_amount = 240.00 WHERE invoice_number = 'A-001';
  PERFORM pg_temp.run();
  SELECT * INTO rev FROM public.journal_entries WHERE reverses_entry_id = old;
  PERFORM pg_temp.ok(rev.source_type = 'reversal' AND rev.entry_date = '2026-02-01' AND rev.memo = 'Reversal: Invoice A-001 issued' AND rev.posted_by_name = 'Automatic posting'
    AND pg_temp.lines(rev.id) = 'debtors:0.00/120.00 sales:100.00/0.00 vat_control:20.00/0.00', 'A-001 edited: the old journal is reversed on its own date (period open)');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live('A-001')) = 'debtors:240.00/0.00 sales:0.00/200.00 vat_control:0.00/40.00', 'and the new version posts');
  PERFORM pg_temp.ok((SELECT reversed_how = 'automatic' AND reversal_entry_id = rev.id FROM public.ledger_postings WHERE entry_id = old), 'the old posting records its reversal');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings WHERE source_id = pg_temp.id('A-001') AND reversed_at IS NULL) = 1, 'one live posting for A-001');

  old := pg_temp.live('A-002', 'invoice_paid');
  UPDATE public.invoices SET status = 'sent', paid_at = NULL WHERE invoice_number = 'A-002';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old) AND pg_temp.live('A-002', 'invoice_paid') IS NULL AND pg_temp.live('A-002') IS NOT NULL,
    'A-002 marked unpaid: the payment is reversed, the issue stays');
  UPDATE public.invoices SET status = 'paid', paid_at = '2026-03-01 10:00+00' WHERE invoice_number = 'A-002';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT entry_date FROM public.journal_entries WHERE id = pg_temp.live('A-002', 'invoice_paid')) = '2026-03-01', 'paid again: a new payment journal on the new date');

  UPDATE public.invoices SET paid_at = '2026-03-31 23:30+00' WHERE invoice_number = 'A-002';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT entry_date FROM public.journal_entries WHERE id = pg_temp.live('A-002', 'invoice_paid')) = '2026-04-01', 'the paid day is the UK calendar day (23:30 UTC on 31 March is 1 April in London)');

  old := pg_temp.live('A-008');
  UPDATE public.invoices SET status = 'draft' WHERE invoice_number = 'A-008';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live('A-008') IS NULL AND EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old), 'back to draft: reversed');
  UPDATE public.invoices SET invoice_number = 'A-010B' WHERE invoice_number = 'A-010';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT memo FROM public.journal_entries WHERE id = pg_temp.live('A-010B')) = 'Invoice A-010B issued'
    AND (SELECT count(*) FROM public.ledger_postings WHERE source_id = pg_temp.id('A-010B')) = 2, 'a new number: reversed and posted again under the new number');
  old := pg_temp.live('A-010B');
  UPDATE public.invoices SET archived_at = now() WHERE invoice_number = 'A-010B';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live('A-010B') IS NULL AND EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old), 'archived: reversed');

  old := pg_temp.live('A-007');
  DELETE FROM public.invoices WHERE invoice_number = 'A-007';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT posted_by = pg_temp.u(1) AND memo = 'Reversal: Invoice A-007 issued' FROM public.journal_entries WHERE reverses_entry_id = old), 'deleted: reversed (the posting row keeps no foreign key to the invoice)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE source_label = 'A-007' AND resolved_at IS NULL), 'and its needs-attention row is resolved');

  UPDATE public.invoices SET total_amount = 12.00 WHERE invoice_number = 'A-005';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live('A-005') IS NOT NULL AND pg_temp.open_issue('A-005') IS NULL
    AND (SELECT resolved_at IS NOT NULL FROM public.ledger_post_issues WHERE source_id = pg_temp.id('A-005')), 'A-005 fixed: posted, and the issue resolves itself');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal still balances');
  PERFORM pg_temp.ok(pg_temp.run() ->> 'processed' = '0' AND (SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) = 18, 'running again posts nothing (18 journals: 6 posted, 6 reversed, 6 re-posted)');
END $$;

\echo '== a journal reversed by hand stays reversed'
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_reverse_journal(pg_temp.live('A-005'), 'Posted by mistake');
DO $$ BEGIN
  PERFORM public.ledger_auto_catch_up(pg_temp.o(1));
  PERFORM pg_temp.ok(pg_temp.live('A-005') IS NULL AND (SELECT reversed_how FROM public.ledger_postings WHERE source_id = pg_temp.id('A-005') ORDER BY created_at DESC LIMIT 1) = 'by_hand',
    'an automatic journal reversed by hand is recorded as such and not posted again');
END $$;
RESET ROLE;
UPDATE public.invoices SET subtotal = 20.00, tax_amount = 4.00, total_amount = 24.00 WHERE invoice_number = 'A-005';
DO $$ BEGIN
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live('A-005')) = 'debtors:24.00/0.00 sales:0.00/20.00 vat_control:0.00/4.00', 'once the invoice changes, the new version posts');
END $$;

\echo '== locked periods'
UPDATE public.ledger_settings SET locked_through = '2026-02-28' WHERE organization_id = pg_temp.o(1);
DO $$ DECLARE old uuid; BEGIN
  PERFORM pg_temp.inv(1, 'A-011', 'sent', 10.00, 0, 10.00, '2026-02-15');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.open_issue('A-011') = 'period_locked' AND pg_temp.live('A-011') IS NULL, 'an invoice dated in a locked period: needs attention');
  old := pg_temp.live('A-001');
  UPDATE public.invoices SET subtotal = 300.00, tax_amount = 60.00, total_amount = 360.00 WHERE invoice_number = 'A-001';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT entry_date FROM public.journal_entries WHERE reverses_entry_id = old) = current_date, 'a posted invoice in a locked period changes: the reversal is dated today');
  PERFORM pg_temp.ok(pg_temp.live('A-001') IS NULL AND pg_temp.open_issue('A-001') = 'period_locked', 'and the new version waits (period locked)');
END $$;

\echo '== saving an invoice never fails because of the ledger'
ALTER TABLE public.ledger_post_queue ADD CONSTRAINT zz_force_failure CHECK (source_id IS NULL) NOT VALID;
DO $$ BEGIN
  UPDATE public.invoices SET status = 'overdue' WHERE invoice_number = 'A-002';
  PERFORM pg_temp.ok((SELECT status FROM public.invoices WHERE invoice_number = 'A-002') = 'overdue' AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue),
    'the queue refuses the row: the invoice is still saved');
  PERFORM pg_temp.inv(1, 'A-012', 'sent', 1.00, 0, 1.00, '2026-03-15');
  PERFORM pg_temp.ok(pg_temp.id('A-012') IS NOT NULL, 'and a new invoice is still created');
END $$;
ALTER TABLE public.ledger_post_queue DROP CONSTRAINT zz_force_failure;
ALTER TABLE public.journal_entries ADD CONSTRAINT zz_force_failure CHECK (memo <> 'Invoice A-FAIL issued') NOT VALID;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.inv(1, 'A-FAIL', 'sent', 5.00, 0, 5.00, '2026-03-16');
  PERFORM pg_temp.inv(1, 'A-OK', 'sent', 6.00, 0, 6.00, '2026-03-16');
  r := pg_temp.run();
  PERFORM pg_temp.ok((r ->> 'failed')::int = 1 AND pg_temp.live('A-OK') IS NOT NULL AND pg_temp.live('A-FAIL') IS NULL, 'a posting that fails doesn''t stop the others');
  PERFORM pg_temp.ok((SELECT attempts = 1 AND last_error = '23514' FROM public.ledger_post_queue WHERE source_id = pg_temp.id('A-FAIL')), 'it stays queued with the error code only');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE memo = 'Invoice A-FAIL issued'), 'and nothing of it was written');
  PERFORM pg_temp.run(); PERFORM pg_temp.run(); PERFORM pg_temp.run(); PERFORM pg_temp.run();
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue) AND pg_temp.open_issue('A-FAIL') = 'processing_failed', 'after five attempts: needs attention, off the queue');
END $$;
ALTER TABLE public.journal_entries DROP CONSTRAINT zz_force_failure;
DO $$ BEGIN
  UPDATE public.invoices SET status = 'overdue' WHERE invoice_number = 'A-FAIL';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live('A-FAIL') IS NOT NULL AND pg_temp.open_issue('A-FAIL') IS NULL, 'once it can post, it posts and the issue resolves');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
END $$;

\echo '== batches of at most 200'
SELECT pg_temp.who(4); SET ROLE authenticated; SELECT public.ledger_auto_set(pg_temp.o(2), true); RESET ROLE;
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
SELECT pg_temp.u(4), pg_temp.o(2), 'B-' || lpad(x::text, 3, '0'), 'sent', 1.00, 0.20, 1.20, 'GBP', '2026-05-01 12:00+00' FROM generate_series(1, 205) x;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(2));
  PERFORM pg_temp.ok((r ->> 'processed')::int = 200 AND (r ->> 'remaining')::int = 5, 'catch-up of 205 invoices: 200 in this run, 5 left');
  r := public.ledger_auto_run(pg_temp.o(2));
  PERFORM pg_temp.ok((r ->> 'processed')::int = 5 AND (r ->> 'remaining')::int = 0, '"post now" finishes them');
END $$;
RESET ROLE;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(2)) = 205
    AND (SELECT sum(debit) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE a.organization_id = pg_temp.o(2) AND a.system_key = 'debtors') = 246.00,
    'all 205 posted, Debtors £246.00 (205 × 1.20, in pence)');
  -- A company whose plan has ended stops posting: its waiting rows are dropped.
  UPDATE public.profiles SET trial_ends_at = now() - interval '1 day' WHERE id = pg_temp.u(4);
  UPDATE public.invoices SET status = 'overdue' WHERE invoice_number = 'B-001';
  r := pg_temp.run();
  PERFORM pg_temp.ok((r ->> 'dropped')::int = 1 AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(2))
    AND (SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(2)) = 205, 'trial ended: nothing posts, the waiting row is dropped');
  UPDATE public.profiles SET trial_ends_at = now() + interval '5 days' WHERE id = pg_temp.u(4);
END $$;

\echo '== reading: members only, read only; aal2; anon'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings) > 0 AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id <> pg_temp.o(1)), 'a member reads company A''s postings, and only A''s');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_post_issues) > 0 AND (SELECT count(*) FROM public.ledger_auto_settings) = 1, 'and its issues and settings');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_auto_settings (organization_id, invoices_enabled) VALUES (pg_temp.o(3), true)$q$, 'permission denied', 'no direct insert');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_post_issues SET resolved_at = now()$q$, 'permission denied', 'no direct update');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_post_queue$q$, 'permission denied', 'no direct delete');
  PERFORM pg_temp.fails($q$SELECT public.ledger_process_queue()$q$, 'permission denied', 'the queue runner is not callable');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_apply(pg_temp.o(1), pg_temp.id('A-001'))$q$, 'permission denied', 'nor the posting function');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_plan(pg_temp.o(1), pg_temp.id('A-001'))$q$, 'permission denied', 'nor the plan');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(1)) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(1))
    AND NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings WHERE organization_id = pg_temp.o(1)), 'company B''s owner sees nothing of company A');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'and can''t catch up company A');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_postings) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'an outsider sees nothing'); END $$;
RESET ROLE;
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_postings), 'aal1 with an authenticator app: nothing visible');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_status(pg_temp.o(1))$q$, 'MFA_REQUIRED', 'and no status');
END $$;
RESET ROLE;
SELECT pg_temp.who(8, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_postings) AND (public.ledger_auto_status(pg_temp.o(1)) ->> 'can_manage')::boolean, 'aal2: visible, and may manage'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT 1 FROM public.ledger_postings$q$, 'permission denied', 'anon: no table access');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_status(pg_temp.o(1))$q$, 'permission denied', 'anon: no RPC');
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN PERFORM pg_temp.fails($q$INSERT INTO public.ledger_post_issues (organization_id, source_table, source_id, kind, reason_code) VALUES (pg_temp.o(1), 'invoices', gen_random_uuid(), 'invoice_issued', 'zero_total')$q$,
  'permission denied', 'service_role: no direct writes either'); END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_postings SET version_hash = md5('x')$q$, 'LEDGER_APPEND_ONLY', 'posting history can''t be rewritten, even by the owner');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_postings$q$, 'LEDGER_APPEND_ONLY', 'or deleted');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_post_issues SET reason_code = 'zero_total'$q$, 'LEDGER_APPEND_ONLY', 'an issue only ever gets resolved');
  PERFORM pg_temp.fails($q$UPDATE public.journal_entries SET memo = 'x' WHERE source_type = 'auto_invoice'$q$, 'LEDGER_APPEND_ONLY', 'automatic journals are append-only like any journal');
END $$;

\echo '== switching off stops new postings and keeps every journal'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE n int := (SELECT count(*) FROM public.journal_entries); s jsonb; BEGIN
  s := public.ledger_auto_set(pg_temp.o(1), false);
  PERFORM pg_temp.ok(NOT (s ->> 'invoices_enabled')::boolean AND (SELECT count(*) FROM public.journal_entries) = n, 'off: no journal deleted or reversed');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.auto_invoices_off' AND user_id = pg_temp.u(1)) = 1, 'one audit row for switching off');
  UPDATE public.invoices SET subtotal = 1.50, total_amount = 1.50 WHERE invoice_number = 'A-012';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(1)), 'an invoice change queues nothing while off');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_auto_set(pg_temp.o(1), true);
RESET ROLE;

\echo '== account deletion: invoices pass to a successor without reposting; the posting name follows the phase 2 rule'
DO $$ DECLARE r jsonb; n int := (SELECT count(*) FROM public.journal_entries); BEGIN
  r := public.data_rights_delete_account(pg_temp.u(2), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'deleted', 'the admin (owner of A-008) deletes their account');
  PERFORM pg_temp.ok((SELECT user_id FROM public.invoices WHERE invoice_number = 'A-008') = pg_temp.u(1) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue),
    'their company invoice passes to the owner, and nothing is queued (the owner is not a ledger field)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = n, 'no journal is added or removed');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE posted_by = pg_temp.u(2) AND posted_by_name <> 'Deleted user')
    AND (SELECT count(*) FROM public.journal_entries WHERE posted_by = pg_temp.u(2) AND source_type IN ('auto_invoice', 'reversal')) = 2,
    'their automatic journals keep the opaque id; the existing account-deletion step names them "Deleted user" (the source type still says automatic)');
END $$;

\echo '== company closure: every automatic-posting row goes with the company'
SELECT pg_temp.who(10); SET ROLE authenticated; SELECT public.ledger_auto_set(pg_temp.o(5), true); RESET ROLE;
SELECT pg_temp.inv(5, 'E-001', 'paid', 10.00, 2.00, 12.00, '2026-02-01', '2026-02-02 10:00+00', 'GBP', 10);
SELECT pg_temp.inv(5, 'E-002', 'sent', 10.00, 2.00, 99.00, '2026-02-01', NULL, 'GBP', 10);
SELECT pg_temp.inv(5, 'E-003', 'sent', 10.00, 2.00, 12.00, '2026-02-01', NULL, 'GBP', 10);
DO $$ DECLARE r jsonb; BEGIN
  PERFORM public.ledger_process_queue(pg_temp.o(5), 2);
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(5)) = 2 AND EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(5))
    AND EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(5)), 'company E: postings, an issue and one invoice still queued');
  r := public.data_rights_close_company(pg_temp.o(5), pg_temp.u(10), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'closed', 'the owner closes company E');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(5))
    AND NOT EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(5))
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE organization_id = pg_temp.o(5)),
    'settings, postings, issues, queue, journals and invoices are all gone (deleting the invoices queued nothing)');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(1)), 'company A is untouched');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_auto_settings (organization_id) VALUES (pg_temp.o(5))$q$, 'COMPANY_CLOSED', 'no new rows for a closed company');
END $$;
SELECT pg_temp.who(10); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_status(pg_temp.o(5))$q$, 'LEDGER_CLOSED', 'a closed company: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(5), true)$q$, 'LEDGER_CLOSED', 'and can''t be switched on');
END $$;
RESET ROLE;
ROLLBACK;
