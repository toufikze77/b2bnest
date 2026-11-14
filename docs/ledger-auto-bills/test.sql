-- Finance phase 3b tests (DISPOSABLE local Postgres only). Run by docs/ledger-auto-bills/run-test.sh after production's
-- shape (phase 2 and 3a applied) and docs/ledger-auto-bills/proposal.sql. One transaction, rolled back. Fictional people.
-- People (fa0…0NN) and companies (0fa…00N), as in docs/ledger-auto/test.sql:
--  A (1): 1 owner paying Business, 2 admin, 3 member (account currency USD), 6 the demo account (admin), 8 admin with an
--         authenticator app.   B (2): 4 owner on the trial.   C (3): 5 owner on Solo.   D (4): 7 owner whose trial ended.
--  E (5): 10 the only member, on the trial (closed at the end).   9: in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'lb' || x || '@example.test' FROM generate_series(1, 10) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active, currency_code)
SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'lb' || x || '@example.test', 'Person ' || x,
       CASE WHEN x IN (4, 10) THEN now() + interval '5 days' WHEN x = 7 THEN now() - interval '2 days' END, true, CASE WHEN x = 3 THEN 'USD' ELSE 'GBP' END
  FROM generate_series(1, 10) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, trial_ends_at = EXCLUDED.trial_ends_at, currency_code = EXCLUDED.currency_code;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fa000000-0000-4000-8000-000000000001', 'lb1@example.test', true, 'active', 'professional'),
  ('fa000000-0000-4000-8000-000000000005', 'lb5@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0fa00000-0000-4000-8000-00000000000' || x)::uuid, 'Company ' || x, 'bill-co-' || x, ('fa000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
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
-- A bill with its VAT recorded (standard 20% when there is VAT, zero-rated otherwise), written as the database owner.
CREATE FUNCTION pg_temp.bill(org int, num text, vendor text, st text, gross numeric, net numeric, vat numeric, issued date, paid date DEFAULT NULL,
                             cat text DEFAULT 'Software', reclaim boolean DEFAULT true, cur text DEFAULT 'GBP', owner int DEFAULT 1, tp date DEFAULT NULL,
                             vstatus text DEFAULT 'recorded') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                            vat_reclaimable, currency, issue_date, due_date, paid_date, tax_point_date, status, category)
  VALUES (pg_temp.u(owner), pg_temp.o(org), num, vendor, 'Test bill', gross,
          CASE WHEN vstatus = 'recorded' THEN net END, CASE WHEN vstatus = 'recorded' THEN vat END,
          CASE WHEN vstatus <> 'recorded' THEN NULL WHEN vat > 0 THEN 20 ELSE 0 END, CASE WHEN vstatus <> 'recorded' THEN NULL WHEN vat > 0 THEN 'standard' ELSE 'zero' END,
          vstatus, reclaim, cur, issued, issued + 30, paid, CASE WHEN vstatus = 'recorded' THEN COALESCE(tp, issued) ELSE tp END, st, cat) RETURNING id $$;
CREATE FUNCTION pg_temp.exp(org int, cat text, st text, gross numeric, net numeric, vat numeric, d date, reclaim boolean DEFAULT true, owner int DEFAULT 1,
                            vstatus text DEFAULT 'recorded') RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                               vat_reclaimable, date, tax_point_date, status)
  VALUES (pg_temp.u(owner), pg_temp.o(org), cat, 'Test expense ' || cat, gross,
          CASE WHEN vstatus = 'recorded' THEN net END, CASE WHEN vstatus = 'recorded' THEN vat END,
          CASE WHEN vstatus <> 'recorded' THEN NULL WHEN vat > 0 THEN 20 ELSE 0 END, CASE WHEN vstatus <> 'recorded' THEN NULL WHEN vat > 0 THEN 'standard' ELSE 'zero' END,
          vstatus, reclaim, d, CASE WHEN vstatus = 'recorded' THEN d END, st) RETURNING id $$;
CREATE FUNCTION pg_temp.bid(num text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.bills WHERE bill_number = num $$;
CREATE FUNCTION pg_temp.eid(cat text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.expenses WHERE category = cat ORDER BY created_at LIMIT 1 $$;
CREATE FUNCTION pg_temp.live(src uuid, k text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT p.entry_id FROM public.ledger_postings p WHERE p.source_id = src AND p.kind = k AND p.reversed_at IS NULL $$;
-- Lines as 'account:debit/credit' (system key, or the code for a non-system account).
CREATE FUNCTION pg_temp.lines(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(COALESCE(a.system_key, a.code) || ':' || l.debit || '/' || l.credit, ' ' ORDER BY l.line_no)
    FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e $$;
CREATE FUNCTION pg_temp.run() RETURNS jsonb LANGUAGE sql AS $$ SELECT public.ledger_process_queue() $$;
CREATE FUNCTION pg_temp.issue(src uuid, k text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT reason_code FROM public.ledger_post_issues WHERE source_id = src AND kind = k AND resolved_at IS NULL $$;
CREATE FUNCTION pg_temp.balanced() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit) OR count(*) < 2) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int), pg_temp.o(int), pg_temp.bid(text), pg_temp.eid(text), pg_temp.live(uuid, text),
  pg_temp.lines(uuid), pg_temp.issue(uuid, text), pg_temp.balanced() TO PUBLIC;

-- Ledgers: A and E from 1 Jan 2026, B from 1 Apr 2026 (all fresh).
SELECT pg_temp.who(1); SET ROLE authenticated; SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'fresh', NULL); RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated; SELECT public.ledger_setup(pg_temp.o(2), '2026-04-01', 'fresh', NULL); RESET ROLE;

\echo '== off by default: bills and expenses save, nothing is queued or posted'
SELECT pg_temp.bill(1, 'B-001', 'Acme', 'pending', 120.00, 100.00, 20.00, '2026-02-01');
SELECT pg_temp.bill(1, 'B-002', 'Beta', 'paid', 60.00, 50.00, 10.00, '2026-02-02', '2026-02-20', 'Insurance', false);
SELECT pg_temp.bill(1, NULL, 'Gamma', 'pending', 40.00, 33.33, 6.67, '2026-03-10', NULL, 'Postage', true, 'GBP', 1, '2026-03-05');
SELECT pg_temp.bill(1, 'B-004', 'Delta', 'cancelled', 12.00, 10.00, 2.00, '2026-02-04');
SELECT pg_temp.bill(1, 'B-005', 'Old Ltd', 'pending', 12.00, 10.00, 2.00, '2025-12-01');
SELECT pg_temp.bill(1, 'B-006', 'Euro SA', 'pending', 12.00, 10.00, 2.00, '2026-02-06', NULL, 'Software', true, 'EUR');
SELECT pg_temp.bill(1, 'B-007', 'Kit Ltd', 'pending', 12.00, 10.00, 2.00, '2026-02-07', NULL, 'Equipment');
SELECT pg_temp.bill(1, 'B-008', 'NoVat', 'pending', 12.00, NULL, NULL, '2026-02-08', NULL, 'Software', true, 'GBP', 1, NULL, 'not_recorded');
SELECT pg_temp.bill(1, 'B-009', 'Paid Ltd', 'paid', 30.00, 25.00, 5.00, '2026-02-09');
SELECT pg_temp.exp(1, 'Travel', 'approved', 24.00, 20.00, 4.00, '2026-02-14');
SELECT pg_temp.exp(1, 'Software and subscriptions', 'paid', 10.00, 10.00, 0, '2026-02-15');
SELECT pg_temp.exp(1, 'Meals and entertainment', 'approved', 12.00, 10.00, 2.00, '2026-02-16', false);
SELECT pg_temp.exp(1, 'Office supplies', 'pending', 6.00, 5.00, 1.00, '2026-02-17');
SELECT pg_temp.exp(1, 'Marketing', 'rejected', 6.00, 5.00, 1.00, '2026-02-18');
SELECT pg_temp.exp(1, 'telephone_internet', 'approved', 6.00, 5.00, 1.00, '2026-02-19', true, 3);
SELECT pg_temp.exp(1, 'stock_materials', 'approved', 50.00, 50.00, 0, '2026-02-20');
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue) AND NOT EXISTS (SELECT 1 FROM public.ledger_category_map), 'nothing queued, no map, while off');
  PERFORM pg_temp.ok((pg_temp.run() ->> 'processed')::int = 0 AND NOT EXISTS (SELECT 1 FROM public.journal_entries), 'nothing posted');
  PERFORM pg_temp.ok(public._ledger_auto_category_key('Software and subscriptions') = 'software_and_subscriptions'
    AND public._ledger_auto_category_key('  office_costs ') = 'office_costs' AND public._ledger_auto_category_key('Meals & entertainment!') = 'meals_entertainment',
    'category keys: lower case, words joined by _');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; p jsonb; BEGIN
  s := public.ledger_auto_status(pg_temp.o(1));
  PERFORM pg_temp.ok(NOT (s ->> 'bills_enabled')::boolean AND NOT (s ->> 'invoices_enabled')::boolean, 'status: both switches off');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses')$q$, 'LEDGER_AUTO_OFF', 'catch-up needs the switch on');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_run(pg_temp.o(1))$q$, 'LEDGER_AUTO_OFF', 'post now needs a switch on');
  p := public.ledger_auto_preview(pg_temp.o(1)) -> 'bills_and_expenses';
  PERFORM pg_temp.ok((p ->> 'bills_to_post')::int = 4 AND (p ->> 'bills_total')::bigint = 25000, 'preview: four bills to post, £250.00 (B-001, B-002, Gamma, B-009)');
  PERFORM pg_temp.ok((p ->> 'bill_payments_to_post')::int = 1 AND (p ->> 'bill_payments_total')::bigint = 6000, 'one bill payment, £60.00 (B-002)');
  PERFORM pg_temp.ok((p ->> 'expenses_to_post')::int = 4 AND (p ->> 'expenses_total')::bigint = 9600, 'four expenses, £96.00 (travel, software, meals, stock)');
  PERFORM pg_temp.ok(p -> 'skipped' = '{"before_start": 1, "currency_not_gbp": 2, "paid_date_missing": 1, "category_not_mapped": 1, "vat_details_missing": 1}'::jsonb,
    'skipped: before the start date, not GBP (a euro bill, an expense of a USD account), paid without a date, Equipment not mapped, VAT not recorded');
  PERFORM pg_temp.ok((p ->> 'not_posted')::int = 3 AND (p ->> 'to_reverse')::int = 0, 'not posted: the cancelled bill, the pending and the rejected expense');
  PERFORM pg_temp.ok(public.ledger_auto_preview(pg_temp.o(1)) ? 'invoices_to_post', 'the invoice preview keys are unchanged');
END $$;
RESET ROLE;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings), 'the preview wrote nothing'); END $$;

\echo '== who may switch bills and expenses on'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses')$q$, 'LEDGER_NOT_ADMIN', 'a plain member can''t');
  PERFORM pg_temp.ok((public.ledger_auto_preview(pg_temp.o(1)) #>> '{bills_and_expenses,bills_to_post}')::int = 4, 'but can read the preview');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(3), true, 'bills_and_expenses')$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo: refused'); END $$;
RESET ROLE;
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(4), true, 'bills_and_expenses')$q$, 'LEDGER_TRIAL_ENDED', 'trial ended: refused'); END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses')$q$, 'LEDGER_DEMO', 'demo: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses')$q$, 'LEDGER_DEMO', 'demo: no catch-up');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses')$q$, 'LEDGER_NOT_MEMBER', 'an outsider: no switch');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses')$q$, 'LEDGER_NOT_MEMBER', 'no catch-up');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_preview(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'no preview');
END $$;
RESET ROLE;
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses')$q$, 'MFA_REQUIRED', 'aal1 with an authenticator app: step up first'); END $$;
RESET ROLE;
SELECT pg_temp.who(10); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(5), true, 'bills_and_expenses')$q$, 'LEDGER_NOT_SET_UP', 'the ledger must be set up first'); END $$;
SELECT public.ledger_setup(pg_temp.o(5), '2026-01-01', 'fresh', NULL);
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'payroll')$q$, 'LEDGER_BAD_REQUEST', 'only invoices or bills_and_expenses');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(2), true, 'bills_and_expenses')$q$, 'LEDGER_NOT_MEMBER', 'A''s owner can''t switch company B');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(2), 'bills_and_expenses')$q$, 'LEDGER_NOT_MEMBER', 'or catch it up');
  s := public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses');
  PERFORM pg_temp.ok((s ->> 'bills_enabled')::boolean AND NOT (s ->> 'invoices_enabled')::boolean, 'bills and expenses on; invoices still off');
  PERFORM public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE user_id = pg_temp.u(1) AND action = 'ledger.auto_bills_on') = 1, 'one audit row (twice on records it once)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_category_map WHERE organization_id = pg_temp.o(1)) = 27, 'the standard mapping is seeded (27 categories)');
  PERFORM pg_temp.ok((SELECT a.code FROM public.ledger_category_map m JOIN public.ledger_accounts a ON a.id = m.account_id WHERE m.organization_id = pg_temp.o(1) AND m.category_key = 'travel') = '7400'
    AND (SELECT a.system_key FROM public.ledger_category_map m JOIN public.ledger_accounts a ON a.id = m.account_id WHERE m.organization_id = pg_temp.o(1) AND m.category_key = 'stock_materials') = 'cost_of_sales'
    AND NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE category_key = 'equipment'), 'travel → 7400, stock_materials → Cost of sales, equipment left out on purpose');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries), 'switching on posts nothing by itself');
END $$;

\echo '== catch-up: bills (VAT reclaimable and not), a bill payment, expenses'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses')$q$, 'LEDGER_NOT_ADMIN', 'a plain member can''t run the catch-up'); END $$;
RESET ROLE;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses');
  PERFORM pg_temp.ok((r ->> 'queued')::int = 16 AND (r ->> 'processed')::int = 16 AND (r ->> 'failed')::int = 0 AND (r ->> 'remaining')::int = 0, 'nine bills and seven expenses queued and processed');
END $$;
RESET ROLE;
DO $$ DECLARE e public.journal_entries; g uuid := (SELECT id FROM public.bills WHERE vendor_name = 'Gamma'); BEGIN
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live(pg_temp.bid('B-001'), 'bill_received');
  PERFORM pg_temp.ok(e.entry_date = '2026-02-01' AND e.memo = 'Bill B-001 from Acme received' AND e.reason = 'Automatic posting' AND e.source_type = 'auto_bill'
    AND e.source_id = pg_temp.bid('B-001') AND e.posted_by = pg_temp.u(1) AND e.posted_by_name = 'Automatic posting', 'B-001: memo, reason, source, its date, posted as the bill''s owner');
  PERFORM pg_temp.ok(pg_temp.lines(e.id) = '7700:100.00/0.00 vat_control:20.00/0.00 creditors:0.00/120.00', 'Dr Software 100.00, Dr VAT control 20.00 (reclaimable), Cr Creditors 120.00');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.bid('B-002'), 'bill_received')) = '8200:60.00/0.00 creditors:0.00/60.00', 'B-002 VAT not reclaimable: the VAT is part of the cost (Insurance → Other overheads 60.00)');
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live(pg_temp.bid('B-002'), 'bill_paid');
  PERFORM pg_temp.ok(e.entry_date = '2026-02-20' AND e.memo = 'Bill B-002 paid' AND e.source_type = 'auto_bill_payment' AND pg_temp.lines(e.id) = 'creditors:60.00/0.00 bank:0.00/60.00',
    'B-002 paid: dated the paid date, Dr Creditors, Cr Bank');
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live(g, 'bill_received');
  PERFORM pg_temp.ok(e.entry_date = '2026-03-05' AND e.memo = 'Bill from Gamma received' AND pg_temp.lines(e.id) = '7500:33.33/0.00 vat_control:6.67/0.00 creditors:0.00/40.00',
    'a bill without a number: dated its tax point, pence exact (33.33 + 6.67 = 40.00), Postage → Office costs');
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.bid('B-009'), 'bill_received') IS NOT NULL AND pg_temp.issue(pg_temp.bid('B-009'), 'bill_paid') = 'paid_date_missing', 'paid with no paid date: received posts, the payment needs attention');
  SELECT * INTO e FROM public.journal_entries WHERE id = pg_temp.live(pg_temp.eid('Travel'), 'expense');
  PERFORM pg_temp.ok(e.entry_date = '2026-02-14' AND e.memo = 'Expense: Travel 14 Feb' AND e.source_type = 'auto_expense' AND pg_temp.lines(e.id) = '7400:20.00/0.00 vat_control:4.00/0.00 bank:0.00/24.00',
    'an approved expense: Dr Travel 20.00, Dr VAT control 4.00, Cr Bank 24.00');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.eid('Software and subscriptions'), 'expense')) = '7700:10.00/0.00 bank:0.00/10.00', 'a paid, zero-rated expense: no VAT line');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.eid('Meals and entertainment'), 'expense')) = '8200:12.00/0.00 bank:0.00/12.00', 'VAT not reclaimable: all of it to the cost');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.eid('stock_materials'), 'expense')) = 'cost_of_sales:50.00/0.00 bank:0.00/50.00', 'stock_materials → Cost of sales (by system key)');
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.eid('Office supplies'), 'expense') IS NULL AND pg_temp.issue(pg_temp.eid('Office supplies'), 'expense') IS NULL
    AND pg_temp.live(pg_temp.eid('Marketing'), 'expense') IS NULL, 'pending and rejected expenses: nothing, and no issue');
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.bid('B-004'), 'bill_received') IS NULL AND pg_temp.issue(pg_temp.bid('B-004'), 'bill_received') IS NULL, 'a cancelled bill: nothing');
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.bid('B-005'), 'bill_received') = 'before_start' AND pg_temp.issue(pg_temp.bid('B-006'), 'bill_received') = 'currency_not_gbp'
    AND pg_temp.issue(pg_temp.bid('B-007'), 'bill_received') = 'category_not_mapped' AND pg_temp.issue(pg_temp.bid('B-008'), 'bill_received') = 'vat_details_missing'
    AND pg_temp.issue(pg_temp.eid('telephone_internet'), 'expense') = 'currency_not_gbp', 'needs attention: before start, not GBP, not mapped, VAT not recorded, an expense of a USD account');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_postings) = 9 AND (SELECT count(*) FROM public.ledger_post_issues WHERE resolved_at IS NULL) = 6, 'nine postings, six issues');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
  PERFORM pg_temp.ok((SELECT sum(credit) - sum(debit) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE a.organization_id = pg_temp.o(1) AND a.system_key = 'creditors') = 190.00,
    'Creditors: 120 + 60 - 60 + 40 + 30 = 190.00');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; p jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses');
  p := public.ledger_auto_preview(pg_temp.o(1)) -> 'bills_and_expenses';
  PERFORM pg_temp.ok((p ->> 'bills_to_post')::int = 0 AND (p ->> 'expenses_to_post')::int = 0 AND (p ->> 'already_posted')::int = 9, 'a second catch-up: nothing to post, nine already posted');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = 9 AND (SELECT count(*) FROM public.ledger_postings) = 9, 'and nothing posted twice');
  PERFORM pg_temp.ok(pg_temp.run() ->> 'processed' = '0', 'an empty queue');
END $$;

\echo '== changes after posting: reverse, then post the new version'
SELECT pg_temp.who(1); SET ROLE authenticated;
INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, currency, issue_date, due_date, tax_point_date, status, category)
VALUES (pg_temp.u(1), pg_temp.o(1), 'B-010', 'Self Ltd', 'by the owner', 2.40, 2.00, 0.40, 20, 'standard', 'recorded', 'GBP', '2026-03-20', '2026-04-20', '2026-03-20', 'pending', 'Travel');
RESET ROLE;
DO $$ DECLARE old uuid; rev public.journal_entries; g uuid := (SELECT id FROM public.bills WHERE vendor_name = 'Gamma'); BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_post_queue WHERE source_table = 'bills' AND source_id = pg_temp.bid('B-010')) = 1, 'the bill trigger queued a bill saved by its owner');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.bid('B-010'), 'bill_received')) = '7400:2.00/0.00 vat_control:0.40/0.00 creditors:0.00/2.40', 'and it posted');
  UPDATE public.bills SET notes = 'nothing the ledger uses' WHERE bill_number = 'B-001';
  UPDATE public.expenses SET receipt_url = 'https://example.test/r.pdf' WHERE category = 'Travel';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'a change to a field the ledger doesn''t use queues nothing');

  old := pg_temp.live(pg_temp.bid('B-001'), 'bill_received');
  UPDATE public.bills SET amount = 240.00, net_amount = 200.00, vat_amount = 40.00 WHERE bill_number = 'B-001';
  PERFORM pg_temp.run();
  SELECT * INTO rev FROM public.journal_entries WHERE reverses_entry_id = old;
  PERFORM pg_temp.ok(rev.source_type = 'reversal' AND rev.entry_date = '2026-02-01' AND rev.memo = 'Reversal: Bill B-001 from Acme received'
    AND pg_temp.lines(rev.id) = '7700:0.00/100.00 vat_control:0.00/20.00 creditors:120.00/0.00', 'B-001 edited: reversed on its own date');
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.bid('B-001'), 'bill_received')) = '7700:200.00/0.00 vat_control:40.00/0.00 creditors:0.00/240.00', 'and the new version posts');

  old := pg_temp.live(pg_temp.bid('B-002'), 'bill_paid');
  UPDATE public.bills SET status = 'pending', paid_date = NULL WHERE bill_number = 'B-002';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old) AND pg_temp.live(pg_temp.bid('B-002'), 'bill_paid') IS NULL
    AND pg_temp.live(pg_temp.bid('B-002'), 'bill_received') IS NOT NULL, 'B-002 marked unpaid: the payment is reversed, the bill stays');

  old := pg_temp.live(pg_temp.eid('Travel'), 'expense');
  UPDATE public.expenses SET category = 'Office supplies' WHERE id = pg_temp.eid('Travel');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old)
    AND (SELECT pg_temp.lines(p.entry_id) FROM public.ledger_postings p WHERE p.source_table = 'expenses' AND p.reversed_at IS NULL AND p.source_label = 'Office supplies')
        = '7500:20.00/0.00 vat_control:4.00/0.00 bank:0.00/24.00', 'a new category: reversed, and posted to Office costs');

  old := pg_temp.live(pg_temp.eid('Meals and entertainment'), 'expense');
  UPDATE public.expenses SET status = 'pending' WHERE category = 'Meals and entertainment';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.eid('Meals and entertainment'), 'expense') IS NULL AND EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = old),
    'an expense back to pending: reversed');

  old := pg_temp.live(g, 'bill_received');
  DELETE FROM public.bills WHERE id = g;
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT posted_by = pg_temp.u(1) AND memo = 'Reversal: Bill from Gamma received' FROM public.journal_entries WHERE reverses_entry_id = old),
    'a deleted bill: reversed (no foreign key to bills, so the delete was never blocked)');

  UPDATE public.bills SET category = 'Design' WHERE bill_number = 'B-007';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.lines(pg_temp.live(pg_temp.bid('B-007'), 'bill_received')) = '7600:10.00/0.00 vat_control:2.00/0.00 creditors:0.00/12.00'
    AND pg_temp.issue(pg_temp.bid('B-007'), 'bill_received') IS NULL, 'B-007 recategorised to Design: posts to Professional fees, the issue resolves itself');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal still balances');
  PERFORM pg_temp.ok(pg_temp.run() ->> 'processed' = '0', 'running again posts nothing');
END $$;

\echo '== the category map: an inactive or deleted account needs attention'
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_update_account((SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND code = '7900'), NULL, NULL, false);
SELECT public.ledger_delete_account((SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND code = '7200'));
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT account_id FROM public.ledger_category_map WHERE organization_id = pg_temp.o(1) AND category_key = 'utilities') IS NULL,
    'deleting an account leaves its categories unmapped (not pointing at a missing account)');
  PERFORM pg_temp.exp(1, 'Bank charges', 'approved', 3.00, 3.00, 0, '2026-03-21');
  PERFORM pg_temp.exp(1, 'Utilities', 'approved', 6.00, 5.00, 1.00, '2026-03-22');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.eid('Bank charges'), 'expense') = 'category_account_inactive' AND pg_temp.issue(pg_temp.eid('Utilities'), 'expense') = 'category_account_missing',
    'Bank charges → an inactive account; Utilities → a deleted account: both need attention, nothing guessed');
END $$;

\echo '== a journal reversed by hand stays reversed'
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_reverse_journal(pg_temp.live(pg_temp.eid('Software and subscriptions'), 'expense'), 'Posted by mistake');
SELECT public.ledger_auto_catch_up(pg_temp.o(1), 'bills_and_expenses');
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.eid('Software and subscriptions'), 'expense') IS NULL
    AND (SELECT reversed_how FROM public.ledger_postings WHERE source_id = pg_temp.eid('Software and subscriptions') ORDER BY created_at DESC LIMIT 1) = 'by_hand',
    'an automatic expense journal reversed by hand is recorded as such and not posted again');
END $$;

\echo '== locked periods'
UPDATE public.ledger_settings SET locked_through = '2026-02-28' WHERE organization_id = pg_temp.o(1);
DO $$ DECLARE old uuid; BEGIN
  PERFORM pg_temp.bill(1, 'B-011', 'Late Ltd', 'pending', 1.20, 1.00, 0.20, '2026-02-15');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.bid('B-011'), 'bill_received') = 'period_locked', 'a bill dated in a locked period: needs attention');
  old := pg_temp.live(pg_temp.bid('B-001'), 'bill_received');
  UPDATE public.bills SET amount = 360.00, net_amount = 300.00, vat_amount = 60.00 WHERE bill_number = 'B-001';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT entry_date FROM public.journal_entries WHERE reverses_entry_id = old) = current_date
    AND pg_temp.live(pg_temp.bid('B-001'), 'bill_received') IS NULL AND pg_temp.issue(pg_temp.bid('B-001'), 'bill_received') = 'period_locked',
    'a posted bill in a locked period changes: reversed today, the new version waits');
END $$;
UPDATE public.ledger_settings SET locked_through = '2026-02-28' WHERE organization_id = pg_temp.o(1);

\echo '== amounts the posting rules refuse (the P4 check on recorded rows is lifted here, inside this rolled-back test)'
ALTER TABLE public.bills DROP CONSTRAINT bills_vat_recorded_check;
DO $$ BEGIN
  PERFORM pg_temp.bill(1, 'B-020', 'Odd', 'pending', 12.01, 10.00, 2.00, '2026-03-23');
  PERFORM pg_temp.bill(1, 'B-021', 'Odd', 'pending', 12.005, 10.00, 2.00, '2026-03-23');
  PERFORM pg_temp.bill(1, 'B-022', 'Odd', 'pending', 0, 0, 0, '2026-03-23');
  PERFORM pg_temp.bill(1, 'B-023', 'Odd', 'pending', -12.00, -10.00, -2.00, '2026-03-23');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.issue(pg_temp.bid('B-020'), 'bill_received') = 'amounts_do_not_add_up' AND pg_temp.issue(pg_temp.bid('B-021'), 'bill_received') = 'not_whole_pence'
    AND pg_temp.issue(pg_temp.bid('B-022'), 'bill_received') = 'zero_total' AND pg_temp.issue(pg_temp.bid('B-023'), 'bill_received') = 'negative_amount',
    'not adding up to the penny, not whole pence, zero, negative (credit notes are later): needs attention, not posted');
END $$;

\echo '== saving a bill or an expense never fails because of the ledger'
ALTER TABLE public.ledger_post_queue ADD CONSTRAINT zz_force_failure CHECK (source_id IS NULL) NOT VALID;
DO $$ BEGIN
  UPDATE public.bills SET status = 'overdue' WHERE bill_number = 'B-010';
  UPDATE public.expenses SET amount = 7.20, net_amount = 6.00, vat_amount = 1.20 WHERE category = 'Utilities';
  PERFORM pg_temp.ok((SELECT status FROM public.bills WHERE bill_number = 'B-010') = 'overdue' AND (SELECT amount FROM public.expenses WHERE category = 'Utilities') = 7.20
    AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'the queue refuses the rows: the bill and the expense are still saved');
END $$;
ALTER TABLE public.ledger_post_queue DROP CONSTRAINT zz_force_failure;
ALTER TABLE public.journal_entries ADD CONSTRAINT zz_force_failure CHECK (memo <> 'Bill FAIL-1 from Z received') NOT VALID;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.bill(1, 'FAIL-1', 'Z', 'pending', 1.20, 1.00, 0.20, '2026-03-24');
  PERFORM pg_temp.exp(1, 'Rent', 'approved', 100.00, 100.00, 0, '2026-03-24');
  r := pg_temp.run();
  PERFORM pg_temp.ok((r ->> 'failed')::int = 1 AND pg_temp.live(pg_temp.eid('Rent'), 'expense') IS NOT NULL, 'a failing posting doesn''t stop the others');
  PERFORM pg_temp.ok((SELECT attempts = 1 AND last_error = '23514' FROM public.ledger_post_queue WHERE source_id = pg_temp.bid('FAIL-1')), 'it stays queued with the error code only');
  PERFORM pg_temp.run(); PERFORM pg_temp.run(); PERFORM pg_temp.run(); PERFORM pg_temp.run();
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue) AND pg_temp.issue(pg_temp.bid('FAIL-1'), 'bill_received') = 'processing_failed', 'after five tries: needs attention');
END $$;
ALTER TABLE public.journal_entries DROP CONSTRAINT zz_force_failure;
DO $$ BEGIN
  UPDATE public.bills SET status = 'overdue' WHERE bill_number = 'FAIL-1';
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(pg_temp.live(pg_temp.bid('FAIL-1'), 'bill_received') IS NOT NULL AND pg_temp.issue(pg_temp.bid('FAIL-1'), 'bill_received') IS NULL, 'once it can post, it posts and resolves');
  PERFORM pg_temp.ok(pg_temp.balanced(), 'every journal balances');
END $$;

\echo '== the invoice switch is independent and keeps working'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  s := public.ledger_auto_set(pg_temp.o(1), true);
  PERFORM pg_temp.ok((s ->> 'invoices_enabled')::boolean AND (s ->> 'bills_enabled')::boolean AND s ->> 'enabled_at' IS NOT NULL, 'the 3a two-argument switch turns invoices on (On since …)');
END $$;
RESET ROLE;
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'INV-B1', 'sent', 10.00, 2.00, 12.00, 'GBP', '2026-03-25 12:00+00');
UPDATE public.bills SET status = 'pending' WHERE bill_number = 'B-010';
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_auto_set(pg_temp.o(1), false);
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE source_table = 'invoices') AND EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE source_table = 'bills'),
    'switching invoices off clears invoice rows only; the waiting bill stays queued');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action IN ('ledger.auto_invoices_on', 'ledger.auto_invoices_off') AND user_id = pg_temp.u(1)) = 2, 'invoice audit rows as before');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue), 'the bill is processed while invoices are off');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_auto_set(pg_temp.o(1), true, 'invoices');
SELECT public.ledger_auto_catch_up(pg_temp.o(1));
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_postings WHERE source_table = 'invoices' AND kind = 'invoice_issued' AND source_label = 'INV-B1'), 'invoices still post through the 3a applier');
END $$;

\echo '== batches of at most 200'
SELECT pg_temp.who(4); SET ROLE authenticated; SELECT public.ledger_auto_set(pg_temp.o(2), true, 'bills_and_expenses'); RESET ROLE;
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
SELECT pg_temp.u(4), pg_temp.o(2), 'Travel', 'Trip ' || x, 1.20, 1.00, 0.20, 20, 'standard', 'recorded', '2026-05-01', '2026-05-01', 'approved' FROM generate_series(1, 205) x;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_auto_catch_up(pg_temp.o(2), 'bills_and_expenses');
  PERFORM pg_temp.ok((r ->> 'processed')::int = 200 AND (r ->> 'remaining')::int = 5, 'catch-up of 205 expenses: 200 in this run, 5 left');
  r := public.ledger_auto_run(pg_temp.o(2));
  PERFORM pg_temp.ok((r ->> 'processed')::int = 5 AND (r ->> 'remaining')::int = 0, '"post now" finishes them');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT sum(credit) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE a.organization_id = pg_temp.o(2) AND a.system_key = 'bank') = 246.00,
    'all 205 posted: Bank credited £246.00 (205 × 1.20, in pence)');
END $$;

\echo '== reading: members only, read only; aal2; anon'
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_category_map) = 27 AND NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id <> pg_temp.o(1)),
    'a member reads company A''s map, and only A''s');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_postings WHERE source_table = 'bills') AND EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE source_table = 'expenses'), 'and its bill and expense postings and issues');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_category_map SET account_id = NULL$q$, 'permission denied', 'no direct update of the map');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_category_map (organization_id, category_key) VALUES (pg_temp.o(1), 'x')$q$, 'permission denied', 'or insert');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_apply_record(pg_temp.o(1), 'bills', pg_temp.bid('B-001'))$q$, 'permission denied', 'the applier is not callable');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_bill_plan(pg_temp.o(1), pg_temp.bid('B-001'))$q$, 'permission denied', 'nor the bill plan');
  PERFORM pg_temp.fails($q$SELECT public._ledger_auto_seed_category_map(pg_temp.o(1))$q$, 'permission denied', 'nor the seeding');
  PERFORM pg_temp.fails($q$SELECT public.ledger_process_queue()$q$, 'permission denied', 'nor the runner');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = pg_temp.o(1)) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(1)),
    'company B''s owner sees nothing of company A');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings), 'an outsider sees nothing'); END $$;
RESET ROLE;
SELECT pg_temp.who(8); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map), 'aal1 with an authenticator app: the map isn''t visible');
END $$;
RESET ROLE;
SELECT pg_temp.who(8, 'aal2'); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_category_map) AND (public.ledger_auto_status(pg_temp.o(1)) ->> 'bills_enabled')::boolean, 'aal2: visible'); END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT 1 FROM public.ledger_category_map$q$, 'permission denied', 'anon: no table access');
  PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses')$q$, 'permission denied', 'anon: no RPC');
END $$;
RESET ROLE;
SET ROLE service_role;
DO $$ BEGIN PERFORM pg_temp.fails($q$DELETE FROM public.ledger_category_map$q$, 'permission denied', 'service_role: no direct writes either'); END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_postings SET version_hash = md5('x') WHERE source_table = 'bills'$q$, 'LEDGER_APPEND_ONLY', 'bill posting history can''t be rewritten');
  PERFORM pg_temp.fails($q$UPDATE public.journal_entries SET memo = 'x' WHERE source_type = 'auto_bill'$q$, 'LEDGER_APPEND_ONLY', 'automatic bill journals are append-only');
END $$;

\echo '== switching bills and expenses off stops new postings and keeps every journal'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE n int := (SELECT count(*) FROM public.journal_entries); s jsonb; BEGIN
  s := public.ledger_auto_set(pg_temp.o(1), false, 'bills_and_expenses');
  PERFORM pg_temp.ok(NOT (s ->> 'bills_enabled')::boolean AND (s ->> 'invoices_enabled')::boolean AND (SELECT count(*) FROM public.journal_entries) = n, 'off: no journal touched; invoices stay on');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.auto_bills_off' AND user_id = pg_temp.u(1)) = 1, 'one audit row for switching off');
  UPDATE public.bills SET amount = 2.40 WHERE bill_number = 'B-011';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(1) AND source_table = 'bills'), 'a bill change queues nothing while off');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = pg_temp.o(1)), 'the map is kept');
END $$;
SELECT pg_temp.who(1); SET ROLE authenticated; SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses'); RESET ROLE;

\echo '== account deletion: records pass to a successor; nothing is posted again'
DO $$ DECLARE r jsonb; n int; BEGIN
  PERFORM pg_temp.exp(1, 'Rent and rates', 'approved', 50.00, 50.00, 0, '2026-03-26', true, 2);
  PERFORM pg_temp.run();
  n := (SELECT count(*) FROM public.journal_entries);
  r := public.data_rights_delete_account(pg_temp.u(2), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'deleted', 'the admin deletes their account');
  PERFORM pg_temp.ok((SELECT user_id FROM public.expenses WHERE category = 'Rent and rates') = pg_temp.u(1), 'their company expense passes to the owner');
  PERFORM pg_temp.run();
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = n, 'the change of owner is looked at again and posts nothing (same version, both accounts in GBP)');
END $$;

\echo '== company closure: the category map and every posting row go with the company'
SELECT pg_temp.who(10); SET ROLE authenticated; SELECT public.ledger_auto_set(pg_temp.o(5), true, 'bills_and_expenses'); RESET ROLE;
SELECT pg_temp.bill(5, 'E-B1', 'Acme', 'paid', 12.00, 10.00, 2.00, '2026-02-01', '2026-02-02', 'Software', true, 'GBP', 10);
SELECT pg_temp.bill(5, 'E-B2', 'Acme', 'pending', 12.00, 10.00, 2.00, '2026-02-01', NULL, 'Equipment', true, 'GBP', 10);
SELECT pg_temp.exp(5, 'Travel', 'approved', 6.00, 5.00, 1.00, '2026-02-03', true, 10);
DO $$ DECLARE r jsonb; BEGIN
  PERFORM public.ledger_process_queue(pg_temp.o(5), 2);
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(5)) AND EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(5))
    AND EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(5)) AND EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = pg_temp.o(5)),
    'company E: a map, postings, an issue and a queued expense');
  r := public.data_rights_close_company(pg_temp.o(5), pg_temp.u(10), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'closed', 'the owner closes company E');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.ledger_postings WHERE organization_id = pg_temp.o(5))
    AND NOT EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(5))
    AND NOT EXISTS (SELECT 1 FROM public.bills WHERE organization_id = pg_temp.o(5)) AND NOT EXISTS (SELECT 1 FROM public.expenses WHERE organization_id = pg_temp.o(5))
    AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(5)), 'map, postings, issues, queue, bills, expenses and journals are all gone (deleting them queued nothing)');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_category_map WHERE organization_id = pg_temp.o(1)), 'company A is untouched');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_category_map (organization_id, category_key) VALUES (pg_temp.o(5), 'travel')$q$, 'COMPANY_CLOSED', 'no new map rows for a closed company');
END $$;
SELECT pg_temp.who(10); SET ROLE authenticated;
DO $$ BEGIN PERFORM pg_temp.fails($q$SELECT public.ledger_auto_set(pg_temp.o(5), true, 'bills_and_expenses')$q$, 'LEDGER_CLOSED', 'a closed company: refused'); END $$;
RESET ROLE;
ROLLBACK;
