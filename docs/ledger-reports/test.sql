-- Finance phase 4 tests (DISPOSABLE local Postgres only): after docs/ledger-reports/proposal.sql. One transaction,
-- rolled back. Fictional people only.
--  A (0fe2…1): owner 1 (Business), 2 plain member, 3 demo admin, 4 admin with an authenticator app. Books from 1 Jan 2026
--     with opening balances; invoices, bills and expenses posted automatically.
--  B (0fe2…2): owner 5 (Business), books from 1 Jan 2026, nothing automatic.   C (0fe2…3): owner 6 (Solo).   9: no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fe200000-0000-4000-8000-00000000000' || x)::uuid, 'r' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code)
SELECT ('fe200000-0000-4000-8000-00000000000' || x)::uuid, 'r' || x || '@example.test', 'Person ' || x, true, 'GBP' FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fe200000-0000-4000-8000-000000000001', 'r1@example.test', true, 'active', 'professional'),
  ('fe200000-0000-4000-8000-000000000005', 'r5@example.test', true, 'active', 'professional'),
  ('fe200000-0000-4000-8000-000000000006', 'r6@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES
  ('0fe20000-0000-4000-8000-000000000001', 'Reports A', 'rep-a', 'fe200000-0000-4000-8000-000000000001'),
  ('0fe20000-0000-4000-8000-000000000002', 'Reports B', 'rep-b', 'fe200000-0000-4000-8000-000000000005'),
  ('0fe20000-0000-4000-8000-000000000003', 'Reports C', 'rep-c', 'fe200000-0000-4000-8000-000000000006');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fe20000-0000-4000-8000-00000000000' || c)::uuid, ('fe200000-0000-4000-8000-00000000000' || u)::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'member'), (1, 3, 'admin'), (1, 4, 'admin'), (2, 5, 'owner'), (3, 6, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0fe20000-0000-4000-8000-000000000001', 'fe200000-0000-4000-8000-000000000001'),
  ('0fe20000-0000-4000-8000-000000000002', 'fe200000-0000-4000-8000-000000000005'),
  ('0fe20000-0000-4000-8000-000000000003', 'fe200000-0000-4000-8000-000000000006');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fe200000-0000-4000-8000-000000000003');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fe200000-0000-4000-8000-000000000004', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fe200000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fe20000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fe200000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.acc(org int, c text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(org) AND code = c $$;
CREATE FUNCTION pg_temp.ln(c text, dr text, cr text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_build_object('account_code', c, 'debit', dr, 'credit', cr) $$;
-- The trial balance figure for one account as at a date, signed to the account's normal side (as the reports sign it).
CREATE FUNCTION pg_temp.tb(org int, c text, d date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN t.type IN ('asset', 'expense') THEN t.debit - t.credit ELSE t.credit - t.debit END FROM public.ledger_trial_balance(pg_temp.o(org), d) t WHERE t.code = c $$;
CREATE FUNCTION pg_temp.pl(org int, c text, f date, t date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT amount FROM public.ledger_report_profit_loss(pg_temp.o(org), f, t) WHERE code = c $$;
CREATE FUNCTION pg_temp.net(org int, f date, t date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(sum(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) FROM public.ledger_report_profit_loss(pg_temp.o(org), f, t) $$;
CREATE FUNCTION pg_temp.bs(org int, c text, d date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT balance FROM public.ledger_report_balance_sheet(pg_temp.o(org), d) WHERE code = c $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.o(int), pg_temp.u(int), pg_temp.acc(int, text), pg_temp.ln(text, text, text), pg_temp.tb(int, text, date),
  pg_temp.pl(int, text, date, date), pg_temp.net(int, date, date), pg_temp.bs(int, text, date) TO PUBLIC;

-- A: books from 1 Jan 2026 with opening balances (bank 1,000.00, fixed assets 5,000.00, share capital 6,000.00).
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'import', jsonb_build_array(pg_temp.ln('1200', '1000.00', '0'), pg_temp.ln('0010', '5000.00', '0'), pg_temp.ln('3000', '0', '6000.00')));
SELECT public.ledger_auto_set(pg_temp.o(1), true); SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses');
-- A manual journal for rent on 5 Mar, then its reversal on 6 Mar: they cancel out everywhere.
SELECT public.ledger_reverse_journal((public.ledger_post_journal(pg_temp.o(1), '2026-03-05', 'Rent March', 'Monthly rent', jsonb_build_array(pg_temp.ln('7100', '500.00', '0'), pg_temp.ln('1200', '0', '500.00')),
  'manual', 'rent-march-2026') ->> 'entry_id')::uuid, 'Entered twice', '2026-03-06');
RESET ROLE;
-- Automatic postings (phases 3a/3b): an invoice issued 10 Feb, paid 20 Feb (100 + 20 VAT); a bill received 15 Feb, paid 1 Mar
-- (200 + 40 VAT); an expense (taxi, 30.00, no VAT) on 18 Feb.
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at, paid_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'A-1', 'paid', 100, 20, 120, 'GBP', '2026-02-10 12:00+00', '2026-02-20 12:00+00');
INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                          currency, issue_date, due_date, paid_date, tax_point_date, status, category)
VALUES (pg_temp.u(1), pg_temp.o(1), 'AB-1', 'Supplier Ltd', 'x', 240, 200, 40, 20, 'standard', 'recorded', 'GBP', '2026-02-15', '2026-03-15', '2026-03-01', '2026-02-15', 'paid', 'Software');
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
VALUES (pg_temp.u(1), pg_temp.o(1), 'transport', 'Taxi', 30, 30, 0, 0, 'outside_scope', 'recorded', '2026-02-18', '2026-02-18', 'approved');
SELECT public.ledger_process_queue();
-- A journal posted now (16 Nov) for an earlier date (15 Jan): it belongs to January.
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_post_journal(pg_temp.o(1), '2026-01-15', 'Bank charges January', 'Found late', jsonb_build_array(pg_temp.ln('7900', '12.34', '0'), pg_temp.ln('1200', '0', '12.34')), 'manual', 'fee-january-2026');
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(2), '2026-01-01', 'fresh', NULL);
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(1) AND reversed_at IS NULL) = 5,
  'setup: invoice issued and paid, bill received and paid, expense: five automatic postings');

\echo '== shape and privileges'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'ledger_report_%') = 4, 'four report functions');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'ledger_report_%'
    AND (p.provolatile <> 's' OR NOT p.prosecdef OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""'))), 'each is STABLE, SECURITY DEFINER, search_path empty');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'ledger_report_%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE') OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'))),
    'authenticated only: anon and service_role cannot run them');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 160, 'still 160 tables: no table added');
END $$;
SET ROLE anon;
SELECT pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31')$q$, 'permission denied', 'anon is refused');
RESET ROLE;

\echo '== who can read'
SELECT pg_temp.who(2); SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31')) > 0
  AND (SELECT count(*) FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31')) > 0
  AND public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '1200'), '2026-01-01', '2026-03-31') ? 'rows'
  AND public.ledger_report_completeness(pg_temp.o(1)) ? 'waiting', 'a plain member reads all four reports');
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_MEMBER', 'a non-member: profit and loss refused');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31')$q$, 'LEDGER_NOT_MEMBER', 'balance sheet refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '1200'), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_MEMBER', 'account detail refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_completeness(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'completeness refused');
END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT * FROM public.ledger_report_balance_sheet(pg_temp.o(3), '2026-03-31')$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo plan: refused like the trial balance');
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31')$q$, 'LEDGER_DEMO', 'the demo account: refused like the trial balance');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_trial_balance(pg_temp.o(1), '2026-03-31')$q$, 'LEDGER_DEMO', '(the trial balance refuses it the same way)');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_report_completeness(pg_temp.o(1))$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first');
RESET ROLE;
SELECT pg_temp.who(4, 'aal2'); SET ROLE authenticated;
SELECT pg_temp.ok(public.ledger_report_completeness(pg_temp.o(1)) ? 'waiting', 'at aal2: allowed');
RESET ROLE;

\echo '== profit and loss'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE inc numeric; exp numeric; BEGIN
  PERFORM pg_temp.ok(pg_temp.pl(1, '4000', '2026-01-01', '2026-03-31') = 100.00, 'sales 100.00 (the invoice net; its VAT is not income)');
  PERFORM pg_temp.ok(pg_temp.pl(1, '7400', '2026-01-01', '2026-03-31') = 30.00, 'travel 30.00 (the taxi)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31') WHERE type NOT IN ('income', 'expense')) = 0,
    'only income and expense accounts');
  SELECT sum(t.credit - t.debit) FILTER (WHERE t.type = 'income'), sum(t.debit - t.credit) FILTER (WHERE t.type = 'expense') INTO inc, exp
    FROM public.ledger_trial_balance(pg_temp.o(1), '2026-03-31') t;
  PERFORM pg_temp.ok((SELECT sum(amount) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31') WHERE type = 'income') = inc
    AND (SELECT sum(amount) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31') WHERE type = 'expense') = exp,
    'income and expense totals equal the trial balance for the same dates (books start 1 Jan)');
  PERFORM pg_temp.ok(pg_temp.net(1, '2026-01-01', '2026-03-31') = inc - exp AND inc - exp = 100.00 - 200.00 - 30.00 - 12.34, 'net profit = income - expenses (-142.34, a loss)');
  PERFORM pg_temp.ok(pg_temp.pl(1, '7100', '2026-03-01', '2026-03-31') = 0, 'March rent and its reversal: the account shows activity netting to 0.00');
  PERFORM pg_temp.ok(pg_temp.pl(1, '7900', '2026-01-01', '2026-01-31') = 12.34 AND pg_temp.pl(1, '7900', '2026-02-01', '2026-11-30') IS NULL,
    'a journal posted today for 15 Jan lands in January (entry date, not when it was posted)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-01-01')),
    'the opening-balance journal (1 Jan) is not in profit and loss');
  PERFORM pg_temp.ok((SELECT sum(amount) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-02-01', '2026-02-28') WHERE type = 'income')
    = (SELECT sum(t.credit - t.debit) FROM public.ledger_trial_balance(pg_temp.o(1), '2026-02-28') t WHERE t.type = 'income')
    - (SELECT sum(t.credit - t.debit) FROM public.ledger_trial_balance(pg_temp.o(1), '2026-01-31') t WHERE t.type = 'income'), 'February alone = the trial balance at 28 Feb minus 31 Jan');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_report_profit_loss(pg_temp.o(1), '2025-01-01', '2025-12-31')), 'before the books start: nothing');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-03-31', '2026-01-01')$q$, 'LEDGER_BAD_RANGE', 'from after to: refused');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2021-01-01', '2026-01-01')$q$, 'LEDGER_BAD_RANGE', 'more than 5 years: refused');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_report_profit_loss(pg_temp.o(1), '2021-01-02', '2026-01-01')) = 0, 'exactly 5 years: allowed');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), NULL, '2026-01-01')$q$, 'LEDGER_BAD_RANGE', 'a missing date: refused');
END $$;

\echo '== balance sheet'
DO $$ DECLARE a numeric; le numeric; BEGIN
  PERFORM pg_temp.ok(pg_temp.bs(1, '0010', '2026-01-01') = 5000.00 AND pg_temp.bs(1, '1200', '2026-01-01') = 1000.00 AND pg_temp.bs(1, '3000', '2026-01-01') = 6000.00,
    'the opening balances appear on the balance sheet at the start date');
  PERFORM pg_temp.ok(pg_temp.bs(1, 'PL', '2026-01-01') = 0, 'and no profit yet');
  PERFORM pg_temp.ok((SELECT bool_and(balanced) FROM public.ledger_report_balance_sheet(pg_temp.o(1), d)) AND (SELECT count(*) FROM public.ledger_report_balance_sheet(pg_temp.o(1), d)) > 0, 'balanced on ' || d)
    FROM unnest(ARRAY['2026-01-01', '2026-02-15', '2026-02-28', '2026-03-05', '2026-03-31', '2026-11-30']::date[]) d;
  SELECT sum(balance) FILTER (WHERE type = 'asset'), sum(balance) FILTER (WHERE type IN ('liability', 'equity')) INTO a, le FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31');
  PERFORM pg_temp.ok(a = le, 'assets ' || a || ' = liabilities and equity ' || le || ' (opening, invoice, bill, expense, payments, a reversed journal)');
  PERFORM pg_temp.ok(pg_temp.bs(1, 'PL', '2026-03-31') = pg_temp.net(1, '2026-01-01', '2026-03-31') AND pg_temp.bs(1, 'PL', '2026-02-28') = pg_temp.net(1, '2026-01-01', '2026-02-28'),
    'the "Profit for the period" row equals profit and loss from the start date to the as-at date');
  PERFORM pg_temp.ok((SELECT name FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31') WHERE code = 'PL') = 'Profit for the period (not yet closed to retained earnings)'
    AND (SELECT type FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31') WHERE code = 'PL') = 'equity', 'the PL row: its name, as equity');
  PERFORM pg_temp.ok(pg_temp.bs(1, '1200', '2026-03-31') = pg_temp.tb(1, '1200', '2026-03-31') AND pg_temp.bs(1, '2200', '2026-03-31') = pg_temp.tb(1, '2200', '2026-03-31'),
    'each balance equals the trial balance signed to its normal side (bank, VAT control)');
  PERFORM pg_temp.ok(pg_temp.bs(1, '1200', '2026-03-31') = 1000.00 + 120.00 - 240.00 - 30.00 - 12.34 AND pg_temp.bs(1, '1100', '2026-03-31') IS NULL AND pg_temp.bs(1, '2100', '2026-03-31') IS NULL,
    'bank 837.66 (the rent and its reversal cancel); debtors and creditors are cleared, so not listed');
  PERFORM pg_temp.ok(pg_temp.bs(1, '1100', '2026-02-15') = 120.00 AND pg_temp.bs(1, '2100', '2026-02-28') = 240.00, 'before payment: debtors 120.00 on 15 Feb, creditors 240.00 on 28 Feb');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31') WHERE type IN ('income', 'expense')) = 0, 'no income or expense rows');
  PERFORM pg_temp.ok(pg_temp.bs(1, '2200', '2026-03-31') = -20.00 AND pg_temp.pl(1, '7700', '2026-01-01', '2026-03-31') = 200.00
    AND (SELECT sum(balance) FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31') WHERE type = 'equity') = 5857.66,
    'the README''s worked example: VAT control -20.00, software 200.00, equity 5,857.66');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-03-31') WHERE balance = 0 AND code <> 'PL') = 0, 'zero balances are left out (except the PL row)');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) = 1 AND bool_and(code = 'PL' AND balance = 0 AND balanced) FROM public.ledger_report_balance_sheet(pg_temp.o(2), '2026-03-31')),
  'empty books: just the PL row at 0.00, balanced');
RESET ROLE;

\echo '== account detail'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '1200'), '2026-02-01', '2026-03-31');
  PERFORM pg_temp.ok((r ->> 'opening_balance')::numeric = pg_temp.tb(1, '1200', '2026-01-31'), 'opening balance = the trial balance the day before the start (' || (r ->> 'opening_balance') || ')');
  PERFORM pg_temp.ok((r ->> 'closing_balance')::numeric = pg_temp.tb(1, '1200', '2026-03-31')
    AND (r -> 'rows' -> (jsonb_array_length(r -> 'rows') - 1) ->> 'balance')::numeric = pg_temp.tb(1, '1200', '2026-03-31'), 'the running balance ends at the trial balance figure for the end date');
  PERFORM pg_temp.ok(NOT (r ->> 'truncated')::boolean AND (r ->> 'line_count')::int = jsonb_array_length(r -> 'rows'), 'not truncated; every line listed');
  PERFORM pg_temp.ok((SELECT string_agg(e ->> 'entry_date', ',' ORDER BY i) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY q(e, i))
    = (SELECT string_agg(e ->> 'entry_date', ',' ORDER BY e ->> 'entry_date', i) FROM jsonb_array_elements(r -> 'rows') WITH ORDINALITY q(e, i)), 'lines in date order');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'rows') e WHERE e ->> 'source_label' = 'A-1' AND e ->> 'source_type' = 'auto_invoice_payment' AND (e ->> 'debit')::numeric = 120.00)
    AND EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'rows') e WHERE e ->> 'source_label' = 'AB-1' AND (e ->> 'credit')::numeric = 240.00),
    'each automatic line names its source (invoice A-1, bill AB-1)');
  PERFORM pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(r -> 'rows') e WHERE e ->> 'source_type' IN ('manual', 'reversal') AND e ->> 'source_label' IS NULL) = 2,
    'the manual rent journal and its reversal: manual and reversal, no label');
  r := public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '7100'), '2026-03-01', '2026-03-31');
  PERFORM pg_temp.ok(jsonb_array_length(r -> 'rows') = 2 AND (r ->> 'closing_balance')::numeric = 0 AND (r -> 'rows' -> 0 ->> 'balance')::numeric = 500.00,
    'rent: 500.00 then back to 0.00 after the reversal');
  r := public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '3000'), '2026-01-01', '2026-03-31');
  PERFORM pg_temp.ok((r ->> 'opening_balance')::numeric = 0 AND (r ->> 'closing_balance')::numeric = 6000.00 AND r -> 'rows' -> 0 ->> 'source_type' = 'opening_balance'
    AND r -> 'account' ->> 'normal_side' = 'credit', 'share capital: credit-side balance, the opening journal shown as opening balance');
  r := public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '1200'), '2026-04-01', '2026-04-30');
  PERFORM pg_temp.ok(jsonb_array_length(r -> 'rows') = 0 AND (r ->> 'opening_balance')::numeric = (r ->> 'closing_balance')::numeric, 'a period with no lines: no rows, opening = closing');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(1, '1200'), '2026-03-31', '2026-03-01')$q$, 'LEDGER_BAD_RANGE', 'from after to: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_account_detail(pg_temp.o(1), pg_temp.acc(2, '1200'), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_FOUND', 'another company''s account: not found');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_account_detail(pg_temp.o(1), gen_random_uuid(), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_FOUND', 'an unknown account: not found');
END $$;
RESET ROLE;

\echo '== isolation between companies'
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_MEMBER', 'B''s owner cannot read A''s profit and loss');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_account_detail(pg_temp.o(2), pg_temp.acc(1, '1200'), '2026-01-01', '2026-03-31')$q$, 'LEDGER_NOT_FOUND',
    'nor A''s bank account through B (not found: nothing leaks)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_report_profit_loss(pg_temp.o(2), '2026-01-01', '2026-12-31'))
    AND (SELECT (ledger_report_account_detail ->> 'line_count')::int FROM public.ledger_report_account_detail(pg_temp.o(2), pg_temp.acc(2, '1200'), '2026-01-01', '2026-12-31')) = 0,
    'B''s reports show none of A''s postings');
END $$;
RESET ROLE;

\echo '== completeness'
-- A: an invoice in dollars (held: currency not GBP), one waiting in the queue, and an unmatched bank statement line.
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'A-USD', 'sent', 10, 0, 10, 'USD', '2026-03-10 12:00+00');
SELECT public.ledger_process_queue();
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'A-WAIT', 'sent', 10, 0, 10, 'GBP', '2026-03-11 12:00+00');
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Main');
SELECT public.ledger_bank_import(pg_temp.o(1), (SELECT id FROM public.ledger_bank_accounts WHERE organization_id = pg_temp.o(1)), 'm.csv',
  '[{"date": "2026-03-20", "description": "Unknown", "amount_pence": -999}]'::jsonb);
DO $$ DECLARE c jsonb; BEGIN
  c := public.ledger_report_completeness(pg_temp.o(1));
  PERFORM pg_temp.ok((c ->> 'invoices_auto_on')::boolean AND (c ->> 'bills_auto_on')::boolean, 'A: both automatic switches on');
  PERFORM pg_temp.ok((c ->> 'waiting')::int = 1 AND (c ->> 'open_issues')::int = 1 AND (c ->> 'bank_unmatched')::int = 1, 'A: 1 waiting, 1 held (open issue), 1 unmatched bank line');
  PERFORM pg_temp.ok(c ->> 'start_date' = '2026-01-01' AND c ->> 'locked_through' IS NULL AND (c ->> 'set_up')::boolean AND c ->> 'last_posting_at' IS NOT NULL,
    'start date, no lock, set up, and when the last journal was posted');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.ok((SELECT NOT (c ->> 'invoices_auto_on')::boolean AND NOT (c ->> 'bills_auto_on')::boolean AND (c ->> 'waiting')::int = 0 AND (c ->> 'open_issues')::int = 0
  AND (c ->> 'bank_unmatched')::int = 0 AND c ->> 'last_posting_at' IS NULL FROM public.ledger_report_completeness(pg_temp.o(2)) c), 'B: switches off, nothing waiting, held or unmatched; no journal yet');
RESET ROLE;

\echo '== truncation at 2000 lines'
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT count(public.ledger_post_journal(pg_temp.o(2), '2026-02-01'::date + (i % 20), 'Card ' || i, 'Bulk test', jsonb_build_array(pg_temp.ln('1200', '1.00', '0'), pg_temp.ln('1200', '0.01', '0'),
  pg_temp.ln('4000', '0', '1.01')), 'manual', 'bulk-key-' || i)) FROM generate_series(1, 1001) i;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_report_account_detail(pg_temp.o(2), pg_temp.acc(2, '1200'), '2026-01-01', '2026-03-31');
  PERFORM pg_temp.ok((r ->> 'truncated')::boolean AND jsonb_array_length(r -> 'rows') = 2000 AND (r ->> 'line_count')::int = 2002, '2002 lines: 2000 returned, truncated');
  PERFORM pg_temp.ok((r ->> 'closing_balance')::numeric = pg_temp.tb(2, '1200', '2026-03-31') AND (r ->> 'closing_balance')::numeric = 1011.01 AND (r ->> 'total_debit')::numeric = 1011.01,
    'the totals and closing balance still cover the whole range (1,011.01)');
  PERFORM pg_temp.ok(pg_temp.pl(2, '4000', '2026-01-01', '2026-03-31') = 1011.01, 'and profit and loss adds 1,001 journals exactly (no rounding)');
END $$;
RESET ROLE;

\echo '== a closed company'
SELECT public.data_rights_close_company(pg_temp.o(2), pg_temp.u(5), NULL, false);
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_report_balance_sheet(pg_temp.o(2), '2026-03-31')$q$, 'LEDGER_CLOSED', 'a closed company: no balance sheet');
  PERFORM pg_temp.fails($q$SELECT public.ledger_report_completeness(pg_temp.o(2))$q$, 'LEDGER_CLOSED', 'nor completeness');
END $$;
RESET ROLE;

ROLLBACK;
