-- Finance phase 3c-1 tests (DISPOSABLE local Postgres only): after docs/ledger-bank/proposal.sql. One transaction,
-- rolled back. Fictional people only.
--  A (0fd…1): owner 1 (Business), 2 plain member, 3 demo admin, 4 admin with an authenticator app.
--  B (0fd…2): owner 5 (Business).   C (0fd…3): owner 6 (Solo plan: no ledger).   9: in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fd000000-0000-4000-8000-00000000000' || x)::uuid, 'b' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code)
SELECT ('fd000000-0000-4000-8000-00000000000' || x)::uuid, 'b' || x || '@example.test', 'Person ' || x, true, 'GBP' FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fd000000-0000-4000-8000-000000000001', 'b1@example.test', true, 'active', 'professional'),
  ('fd000000-0000-4000-8000-000000000005', 'b5@example.test', true, 'active', 'professional'),
  ('fd000000-0000-4000-8000-000000000006', 'b6@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES
  ('0fd00000-0000-4000-8000-000000000001', 'Bank A', 'bank-a', 'fd000000-0000-4000-8000-000000000001'),
  ('0fd00000-0000-4000-8000-000000000002', 'Bank B', 'bank-b', 'fd000000-0000-4000-8000-000000000005'),
  ('0fd00000-0000-4000-8000-000000000003', 'Bank C', 'bank-c', 'fd000000-0000-4000-8000-000000000006');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fd00000-0000-4000-8000-00000000000' || c)::uuid, ('fd000000-0000-4000-8000-00000000000' || u)::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'member'), (1, 3, 'admin'), (1, 4, 'admin'), (2, 5, 'owner'), (3, 6, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0fd00000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-000000000001'),
  ('0fd00000-0000-4000-8000-000000000002', 'fd000000-0000-4000-8000-000000000005'),
  ('0fd00000-0000-4000-8000-000000000003', 'fd000000-0000-4000-8000-000000000006');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fd000000-0000-4000-8000-000000000003');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fd000000-0000-4000-8000-000000000004', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fd000000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fd00000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fd000000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.r(d text, descr text, pence bigint, bal bigint DEFAULT NULL, ref text DEFAULT NULL) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('date', d, 'description', descr, 'amount_pence', pence, 'balance_pence', bal, 'ref', ref)) $$;
CREATE FUNCTION pg_temp.inv(org int, num text, tot numeric, paid date) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at, paid_at)
  VALUES (pg_temp.u(CASE WHEN org = 2 THEN 5 ELSE 1 END), pg_temp.o(org), num, 'paid', tot, 0, tot, 'GBP', (paid - 20)::timestamptz + interval '12 hours',
          paid::timestamptz + interval '12 hours') RETURNING id $$;
-- The live posting id of a source for a kind.
CREATE FUNCTION pg_temp.post(num text, k text DEFAULT 'invoice_paid') RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT p.id FROM public.ledger_postings p WHERE p.reversed_at IS NULL AND p.kind = k
     AND p.source_id = COALESCE((SELECT id FROM public.invoices WHERE invoice_number = num), (SELECT id FROM public.bills WHERE bill_number = num),
                                (SELECT id FROM public.expenses WHERE description = num)) $$;
CREATE FUNCTION pg_temp.line(descr text, n int DEFAULT 1) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.ledger_bank_lines WHERE description = descr ORDER BY created_at, row_no OFFSET n - 1 LIMIT 1 $$;
CREATE FUNCTION pg_temp.st(descr text, n int DEFAULT 1) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT status || COALESCE(':' || match_kind, '') FROM public.ledger_bank_lines WHERE id = pg_temp.line(descr, n) $$;
CREATE FUNCTION pg_temp.audits(a text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT count(*) FROM public.audit_logs WHERE action = a $$;
CREATE FUNCTION pg_temp.acct(org int, nm text DEFAULT 'Main') RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM public.ledger_bank_accounts WHERE organization_id = pg_temp.o(org) AND name = nm $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.o(int), pg_temp.u(int), pg_temp.r(text, text, bigint, bigint, text), pg_temp.post(text, text),
  pg_temp.line(text, int), pg_temp.st(text, int), pg_temp.audits(text), pg_temp.acct(int, text) TO PUBLIC;

-- Ledgers for A and B (from 1 Jan 2026), automatic postings on for invoices and for bills and expenses.
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'fresh', NULL);
SELECT public.ledger_auto_set(pg_temp.o(1), true); SELECT public.ledger_auto_set(pg_temp.o(1), true, 'bills_and_expenses');
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(2), '2026-01-01', 'fresh', NULL);
SELECT public.ledger_auto_set(pg_temp.o(2), true);
RESET ROLE;

-- Payments already in the ledger (phases 3a/3b post them; 3c-1 posts nothing).
SELECT pg_temp.inv(1, 'A-1', 120.00, '2026-03-05');   -- money in 12000p on 5 Mar
SELECT pg_temp.inv(1, 'A-2', 50.00, '2026-03-10');    -- two money-in payments of 5000p, 2 days apart
SELECT pg_temp.inv(1, 'A-3', 50.00, '2026-03-12');
SELECT pg_temp.inv(1, 'A-4', 75.00, '2026-03-01');    -- 19 days before its line: by hand only
SELECT pg_temp.inv(1, 'A-5', 99.99, '2026-01-25');    -- 35 days before its line: too far apart even by hand
SELECT pg_temp.inv(2, 'B-1', 120.00, '2026-03-05');   -- company B: same amount and date as A-1
INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                          currency, issue_date, due_date, paid_date, tax_point_date, status, category)
VALUES (pg_temp.u(1), pg_temp.o(1), 'AB-1', 'Supplier Ltd', 'x', 240, 200, 40, 20, 'standard', 'recorded', 'GBP', '2026-02-20', '2026-03-20', '2026-03-08', '2026-02-20', 'paid', 'Software');
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
VALUES (pg_temp.u(1), pg_temp.o(1), 'transport', 'Taxi', 30, 30, 0, 0, 'outside_scope', 'recorded', '2026-03-15', '2026-03-15', 'approved');
SELECT public.ledger_process_queue();
SELECT pg_temp.ok(pg_temp.post('A-1') IS NOT NULL AND pg_temp.post('A-2') IS NOT NULL AND pg_temp.post('A-5') IS NOT NULL AND pg_temp.post('AB-1', 'bill_paid') IS NOT NULL
  AND pg_temp.post('Taxi', 'expense') IS NOT NULL AND pg_temp.post('B-1') IS NOT NULL, 'setup: the payments are posted to the Bank account by the 3a/3b engine');
-- Company A's ledger (the checks below run as A's owner, who reads A's rows only).
CREATE TEMP TABLE before_counts AS SELECT (SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) AS je,
  (SELECT count(*) FROM public.journal_lines WHERE organization_id = pg_temp.o(1)) AS jl,
  (SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(1)) AS lp, (SELECT md5(string_agg(id::text || reversed_at::text, ',' ORDER BY id)) FROM public.ledger_postings) AS lph;
GRANT SELECT ON before_counts TO PUBLIC;

\echo '== shape: tables, RLS, grants'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 160, '160 tables in public (157 + 3)');
  PERFORM pg_temp.ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.ledger_bank_accounts'::regclass, 'public.ledger_bank_imports'::regclass, 'public.ledger_bank_lines'::regclass)),
    'RLS is on for the three tables');
  PERFORM pg_temp.ok(NOT has_table_privilege('anon', 'public.ledger_bank_lines', 'SELECT') AND NOT has_table_privilege('anon', 'public.ledger_bank_accounts', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.ledger_bank_imports', 'SELECT'), 'anon cannot read any of them');
  PERFORM pg_temp.ok(NOT has_table_privilege('authenticated', 'public.ledger_bank_lines', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.ledger_bank_lines', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.ledger_bank_lines', 'DELETE') AND NOT has_table_privilege('authenticated', 'public.ledger_bank_accounts', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.ledger_bank_imports', 'INSERT'), 'signed-in people have no direct write grant');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname LIKE '%ledger_bank%' AND has_function_privilege('anon', oid, 'EXECUTE')),
    'anon can run none of the new functions');
  PERFORM pg_temp.ok(NOT has_function_privilege('authenticated', 'public._ledger_bank_match_run(uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._ledger_bank_open_payments(uuid,uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.ledger_bank_import(uuid,uuid,text,jsonb)', 'EXECUTE'), 'the internal helpers are not callable; the RPCs are');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard' AND tgrelid IN ('public.ledger_bank_accounts'::regclass,
    'public.ledger_bank_imports'::regclass, 'public.ledger_bank_lines'::regclass)) = 3, 'the demo guard is on all three tables');
  PERFORM pg_temp.ok(to_regclass('public.bank_accounts') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE '%ledger_bank%'
    AND (prosrc LIKE '%public.bank_accounts%' OR prosrc LIKE '%public.bank_transactions%')), 'the old per-user bank tables are not read by any new function');
END $$;

\echo '== bank accounts'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; n bigint; BEGIN
  r := public.ledger_bank_account_save(pg_temp.o(1), NULL, '  Main  ', '1234');
  PERFORM pg_temp.ok(r ->> 'result' = 'created', 'a manager adds a bank account (name trimmed)');
  PERFORM pg_temp.ok((SELECT name = 'Main' AND last4 = '1234' AND currency = 'GBP' AND is_active FROM public.ledger_bank_accounts WHERE id = (r ->> 'id')::uuid), 'stored: name, last 4, GBP, active');
  PERFORM pg_temp.ok((SELECT ledger_account_id = (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND system_key = 'bank')
    FROM public.ledger_bank_accounts WHERE id = (r ->> 'id')::uuid), 'it is tied to the company''s Bank account (1200)');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'main')$q$, 'LEDGER_BANK_NAME_TAKEN', 'names are unique per company, any case');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'X', '12a4')$q$, 'LEDGER_BANK_BAD_LAST4', 'last 4: digits only');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'X', '12345678')$q$, 'LEDGER_BANK_BAD_LAST4', 'never a full account number');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, '   ')$q$, 'LEDGER_BANK_BAD_NAME', 'a name is required');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, repeat('x', 81))$q$, 'LEDGER_BANK_BAD_NAME', 'names up to 80 characters');
  n := pg_temp.audits('ledger.bank_account_update');
  r := public.ledger_bank_account_save(pg_temp.o(1), pg_temp.acct(1), 'Main', '1234', true);
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.audits('ledger.bank_account_update') = n, 'saving the same values: no change, no audit row');
  PERFORM public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Savings');
  r := public.ledger_bank_account_save(pg_temp.o(1), pg_temp.acct(1, 'Savings'), 'Savings', NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'updated' AND pg_temp.audits('ledger.bank_account_update') = n + 1, 'made inactive: one audit row');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.bank_account_create') = 2, 'one audit row per account created');
  FOR i IN 3..10 LOOP PERFORM public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Extra ' || i); END LOOP;
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Eleventh')$q$, 'LEDGER_BANK_ACCOUNT_LIMIT', 'at most 10 bank accounts per company');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1, 'Savings'), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$,
    'LEDGER_BANK_ACCOUNT_INACTIVE', 'an inactive account takes no import');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_accounts SET ledger_account_id = (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND system_key = 'sales') WHERE id = pg_temp.acct(1)$q$,
    'LEDGER_APPEND_ONLY', 'even the database owner cannot move a bank account to another ledger account');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_bank_accounts (organization_id, name, ledger_account_id) VALUES (pg_temp.o(1), 'Odd',
    (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND system_key = 'sales'))$q$, 'LEDGER_BANK_NOT_BANK_ACCOUNT', 'v1: only the Bank account');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_bank_accounts (organization_id, name, ledger_account_id) VALUES (pg_temp.o(2), 'Odd',
    (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND system_key = 'bank'))$q$, 'LEDGER_BANK_NOT_BANK_ACCOUNT', 'never another company''s Bank account');
END $$;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT public.ledger_bank_account_save(pg_temp.o(2), NULL, 'Main');
RESET ROLE;

\echo '== who can do what'
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  s := public.ledger_bank_overview(pg_temp.o(1));
  PERFORM pg_temp.ok(s ->> 'access' = 'ok' AND NOT (s ->> 'can_manage')::boolean AND jsonb_array_length(s -> 'accounts') = 10, 'a plain member reads the overview, cannot manage');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$, 'LEDGER_NOT_ADMIN', 'a member cannot import');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Mine')$q$, 'LEDGER_NOT_ADMIN', 'nor add a bank account');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match_run(pg_temp.o(1), pg_temp.acct(1))$q$, 'LEDGER_NOT_ADMIN', 'nor run the matcher');
END $$;
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'a non-member cannot read the overview');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$, 'LEDGER_NOT_MEMBER', 'nor import');
END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.ledger_bank_overview(pg_temp.o(1)) ->> 'access' = 'ok', 'the demo account reads its own company');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(2))$q$, 'LEDGER_NOT_MEMBER', 'but never another company');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$, 'LEDGER_DEMO', 'the demo account cannot import');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Demo')$q$, 'LEDGER_DEMO', 'nor add accounts');
END $$;
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(1))$q$, 'MFA_REQUIRED', 'reading too');
END $$;
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.ledger_bank_overview(pg_temp.o(3)) ->> 'access' = 'plan_not_included', 'Solo plan: the overview says the plan does not include it');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(3), NULL, 'Main')$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'and nothing can be added');
END $$;
RESET ROLE;

\echo '== import validation (all or nothing)'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'bad.csv', jsonb_build_array(
    pg_temp.r('2026-03-01', 'ok', 100), pg_temp.r('2026-02-30', 'bad day', 100), pg_temp.r('1999-12-31', 'too old', 100),
    pg_temp.r(to_char(current_date + 2, 'YYYY-MM-DD'), 'future', 100), pg_temp.r('2026-03-01', 'zero', 0),
    jsonb_build_object('date', '2026-03-01', 'description', 'decimal', 'amount_pence', 10.5),
    jsonb_build_object('date', '2026-03-01', 'description', 'text amount', 'amount_pence', '100'),
    pg_temp.r('2026-03-01', '   ', 100), pg_temp.r('01/03/2026', 'uk date not converted', 100),
    jsonb_build_object('date', '2026-03-01', 'description', 'bad balance', 'amount_pence', 100, 'balance_pence', 1.5),
    pg_temp.r('2026-03-01', repeat('d', 501), 100), pg_temp.r('2026-03-01', 'long ref', 100, NULL, repeat('r', 101)), '"not a row"'::jsonb));
  PERFORM pg_temp.ok(r ->> 'result' = 'rejected' AND (r ->> 'imported')::int = 0 AND (r ->> 'rejected')::int = 12, 'twelve bad rows: rejected, nothing imported');
  PERFORM pg_temp.ok((SELECT string_agg(e ->> 'reason', ',' ORDER BY (e ->> 'row')::int) FROM jsonb_array_elements(r -> 'problems') e)
    = 'bad_date,date_out_of_range,date_out_of_range,amount_zero,amount_not_whole_pence,amount_missing,bad_description,bad_date,bad_balance,bad_description,bad_reference,not_a_row',
    'each problem has its row and reason');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_bank_lines) AND NOT EXISTS (SELECT 1 FROM public.ledger_bank_imports), 'nothing was stored (not even the good row)');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.bank_import') = 0, 'a rejected import writes no audit row');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'big.csv', (SELECT jsonb_agg(pg_temp.r('2026-03-01', 'row ' || x, x)) FROM generate_series(1, 2001) x))$q$,
    'LEDGER_BANK_TOO_MANY_ROWS', '2001 rows in one call are refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', '[]'::jsonb)$q$, 'LEDGER_BAD_REQUEST', 'no rows: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(2), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100)))$q$, 'LEDGER_NOT_FOUND',
    'another company''s bank account: not found');
END $$;

\echo '== import and automatic matching'
DO $$ DECLARE r jsonb; s jsonb; BEGIN
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), '  statement-march.csv  ', jsonb_build_array(
    pg_temp.r('2026-03-06', 'ACME LTD PAYMENT', 12000, 112000, 'INV A-1'),
    pg_temp.r('2026-03-11', 'CLIENT X', 5000),
    pg_temp.r('2026-03-09', 'SUPPLIER LTD', -24000),
    pg_temp.r('2026-03-15', 'TAXI', -3000),
    pg_temp.r('2026-03-15', 'TAXI', -3000),
    pg_temp.r('2026-03-20', 'LATE PAYER', 7500),
    pg_temp.r('2026-03-01', 'OLD CLIENT', 9999),
    pg_temp.r('2026-03-06', 'MONEY OUT 120', -12000),
    pg_temp.r('2026-03-25', 'BANK FEE', -500, 120000)));
  PERFORM pg_temp.ok(r ->> 'result' = 'ok' AND (r ->> 'imported')::int = 9 AND (r ->> 'skipped_duplicates')::int = 0 AND (r ->> 'rejected')::int = 0,
    '9 lines imported, 0 already imported, 0 rejected');
  PERFORM pg_temp.ok(NOT (r ->> 'imported_before')::boolean, 'a new file: not imported before');
  PERFORM pg_temp.ok((SELECT file_name = 'statement-march.csv' AND row_count = 9 AND first_date = '2026-03-01' AND last_date = '2026-03-25' FROM public.ledger_bank_imports),
    'the import records the trimmed file name, rows and dates');
  PERFORM pg_temp.ok(pg_temp.st('TAXI', 1) = 'unmatched' AND pg_temp.st('TAXI', 2) = 'unmatched'
    AND (SELECT count(*) FROM public.ledger_bank_lines WHERE description = 'TAXI') = 2, 'two genuine identical lines in one file are both kept');
  PERFORM pg_temp.ok(pg_temp.st('ACME LTD PAYMENT') = 'matched:auto' AND (SELECT matched_posting_id FROM public.ledger_bank_lines WHERE id = pg_temp.line('ACME LTD PAYMENT')) = pg_temp.post('A-1'),
    'money in 12000p a day after invoice A-1 was paid: matched automatically');
  PERFORM pg_temp.ok(pg_temp.st('SUPPLIER LTD') = 'matched:auto' AND (SELECT matched_posting_id FROM public.ledger_bank_lines WHERE id = pg_temp.line('SUPPLIER LTD')) = pg_temp.post('AB-1', 'bill_paid'),
    'money out 24000p: matched to the bill payment');
  PERFORM pg_temp.ok(pg_temp.st('CLIENT X') = 'unmatched', 'two payments of 5000p within 7 days: left for a person (ambiguous)');
  PERFORM pg_temp.ok(pg_temp.st('TAXI', 1) = 'unmatched' AND pg_temp.st('TAXI', 2) = 'unmatched', 'one expense payment fits two identical lines: neither is matched automatically');
  PERFORM pg_temp.ok(pg_temp.st('LATE PAYER') = 'unmatched', '19 days apart: not matched automatically (7-day window)');
  PERFORM pg_temp.ok(pg_temp.st('MONEY OUT 120') = 'unmatched', 'direction: money out never matches an invoice payment (money in) of the same amount');
  PERFORM pg_temp.ok((r ->> 'matched')::int = 2 AND pg_temp.audits('ledger.bank_match') = 2 AND pg_temp.audits('ledger.bank_import') = 1, 'two matches, one audit row each; one import row');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) = (SELECT je FROM before_counts)
    AND (SELECT count(*) FROM public.journal_lines WHERE organization_id = pg_temp.o(1)) = (SELECT jl FROM before_counts)
    AND (SELECT count(*) FROM public.ledger_postings WHERE organization_id = pg_temp.o(1)) = (SELECT lp FROM before_counts), 'importing and matching posted nothing to the ledger');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-03-31');
  PERFORM pg_temp.ok((s -> 'counts' ->> 'unmatched')::int = 7 AND (s -> 'counts' ->> 'matched')::int = 2 AND (s -> 'counts' ->> 'ignored')::int = 0
    AND (s -> 'counts' ->> 'needs_attention')::int = 0, 'overview counts: 7 unmatched, 2 matched');
  PERFORM pg_temp.ok((SELECT jsonb_array_length(u -> 'suggestions') FROM jsonb_array_elements(s -> 'unmatched') u WHERE u ->> 'description' = 'CLIENT X') = 2,
    'the ambiguous line shows both suggestions');
  PERFORM pg_temp.ok((SELECT (u -> 'suggestions' -> 0 ->> 'days_apart')::int FROM jsonb_array_elements(s -> 'unmatched') u WHERE u ->> 'description' = 'LATE PAYER') = 19,
    'the 19-day payment is suggested (31-day window), with its distance');
  PERFORM pg_temp.ok((SELECT jsonb_array_length(u -> 'suggestions') FROM jsonb_array_elements(s -> 'unmatched') u WHERE u ->> 'description' = 'MONEY OUT 120') = 0,
    'no suggestion in the wrong direction');
  PERFORM pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(s -> 'unmatched_payments') p WHERE p ->> 'source_label' IN ('A-2', 'A-3', 'A-4')) = 3
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'unmatched_payments') p WHERE p ->> 'source_label' IN ('A-1', 'A-5')),
    'ledger payments not matched in the period covered (1-25 Mar) are listed; matched ones and January''s are not');
END $$;

\echo '== re-import: duplicates are skipped'
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'statement-march.csv', jsonb_build_array(
    pg_temp.r('2026-03-06', 'ACME LTD PAYMENT', 12000, 112000, 'INV A-1'), pg_temp.r('2026-03-11', 'CLIENT X', 5000), pg_temp.r('2026-03-09', 'SUPPLIER LTD', -24000),
    pg_temp.r('2026-03-15', 'TAXI', -3000), pg_temp.r('2026-03-15', 'TAXI', -3000), pg_temp.r('2026-03-20', 'LATE PAYER', 7500), pg_temp.r('2026-03-01', 'OLD CLIENT', 9999),
    pg_temp.r('2026-03-06', 'MONEY OUT 120', -12000), pg_temp.r('2026-03-25', 'BANK FEE', -500, 120000)));
  PERFORM pg_temp.ok((r ->> 'imported')::int = 0 AND (r ->> 'skipped_duplicates')::int = 9 AND (r ->> 'imported_before')::boolean, 'the same file again: 0 imported, 9 already imported, and it says so');
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'overlap.csv', jsonb_build_array(
    pg_temp.r('2026-03-25', 'BANK FEE', -500, 120000), pg_temp.r('2026-03-15', 'TAXI', -3000), pg_temp.r('2026-03-15', 'TAXI', -3000), pg_temp.r('2026-03-15', 'TAXI', -3000),
    pg_temp.r('2026-03-28', 'INTEREST', 12, 120012)));
  PERFORM pg_temp.ok((r ->> 'imported')::int = 2 AND (r ->> 'skipped_duplicates')::int = 3 AND NOT (r ->> 'imported_before')::boolean,
    'an overlapping statement: the two known taxis and the fee are skipped; a third taxi and the interest are new');
  -- A file sent in chunks: the browser numbers identical rows across the whole file (seq), so chunk 2's first taxi is the 4th.
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'chunk.csv', jsonb_build_array(
    pg_temp.r('2026-03-15', 'TAXI', -3000) || '{"seq": 4}', pg_temp.r('2026-03-15', 'TAXI', -3000) || '{"seq": 3}'));
  PERFORM pg_temp.ok((r ->> 'imported')::int = 1 AND (r ->> 'skipped_duplicates')::int = 1, 'with seq, the 4th taxi is new and the 3rd is a known one');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_bank_lines WHERE description = 'TAXI') = 4, 'four taxi lines in all');
END $$;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_bank_import(pg_temp.o(1), pg_temp.acct(1), 'x.csv', jsonb_build_array(pg_temp.r('2026-03-01', 'x', 100) || '{"seq": 1.5}'));
  PERFORM pg_temp.ok(r ->> 'result' = 'rejected' AND r -> 'problems' -> 0 ->> 'reason' = 'bad_sequence', 'a bad seq is reported as a rejected row');
END $$;

\echo '== manual match, unmatch, ignore'
DO $$ DECLARE r jsonb; n bigint; BEGIN
  r := public.ledger_bank_match(pg_temp.o(1), pg_temp.line('CLIENT X'), pg_temp.post('A-2'));
  PERFORM pg_temp.ok(r ->> 'result' = 'matched' AND pg_temp.st('CLIENT X') = 'matched:manual', 'a person picks one of the two suggestions');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('TAXI', 1), pg_temp.post('A-2'))$q$, 'LEDGER_BANK_ALREADY_MATCHED',
    'a payment is matched by at most one line');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('CLIENT X'), pg_temp.post('A-3'))$q$, 'LEDGER_BANK_ALREADY_MATCHED',
    'a matched line must be unmatched first');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('MONEY OUT 120'), pg_temp.post('A-1'))$q$, 'LEDGER_BANK_ALREADY_MATCHED',
    'A-1 is taken (and would be the wrong direction anyway)');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('MONEY OUT 120'), pg_temp.post('A-3'))$q$, 'LEDGER_BANK_AMOUNT_DIFFERS',
    'by hand too: the amount and direction must agree');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('OLD CLIENT'), pg_temp.post('A-5'))$q$, 'LEDGER_BANK_TOO_FAR_APART',
    'by hand: more than 31 days apart is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('LATE PAYER'), (SELECT id FROM public.ledger_postings WHERE kind = 'invoice_issued' LIMIT 1))$q$,
    'LEDGER_BANK_NOT_A_PAYMENT', 'only payments can be matched');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('LATE PAYER'), pg_temp.post('B-1'))$q$, 'LEDGER_NOT_FOUND',
    'never another company''s payment');
  r := public.ledger_bank_match(pg_temp.o(1), pg_temp.line('LATE PAYER'), pg_temp.post('A-4'));
  PERFORM pg_temp.ok(pg_temp.st('LATE PAYER') = 'matched:manual', '19 days apart: allowed by hand');
  n := pg_temp.audits('ledger.bank_unmatch');
  r := public.ledger_bank_unmatch(pg_temp.o(1), pg_temp.line('CLIENT X'));
  PERFORM pg_temp.ok(r ->> 'result' = 'unmatched' AND pg_temp.st('CLIENT X') = 'unmatched' AND pg_temp.audits('ledger.bank_unmatch') = n + 1, 'unmatch: one audit row');
  r := public.ledger_bank_unmatch(pg_temp.o(1), pg_temp.line('CLIENT X'));
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.audits('ledger.bank_unmatch') = n + 1, 'unmatching again changes nothing, no audit row');
  r := public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('BANK FEE'), 'handle_later');
  PERFORM pg_temp.ok(pg_temp.st('BANK FEE') = 'ignored' AND pg_temp.audits('ledger.bank_ignore') = 1, 'ignore (handle later): one audit row');
  r := public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('BANK FEE'), 'handle_later');
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.audits('ledger.bank_ignore') = 1, 'the same reason again: no change');
  PERFORM public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('BANK FEE'), 'not_business');
  PERFORM pg_temp.ok((SELECT ignore_reason FROM public.ledger_bank_lines WHERE id = pg_temp.line('BANK FEE')) = 'not_business' AND pg_temp.audits('ledger.bank_ignore') = 2,
    'a different reason: changed, one more audit row');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('BANK FEE'), 'whatever')$q$, 'LEDGER_BAD_REQUEST', 'only the two reasons');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('ACME LTD PAYMENT'), 'not_business')$q$, 'LEDGER_BANK_ALREADY_MATCHED', 'a matched line is not ignored');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('BANK FEE'), pg_temp.post('A-3'))$q$, 'LEDGER_BANK_IGNORED', 'an ignored line is not matched');
  PERFORM pg_temp.ok((public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1)) -> 'counts' ->> 'ignored')::int = 1, 'ignored lines are counted and listed, never hidden');
  r := public.ledger_bank_unignore(pg_temp.o(1), pg_temp.line('BANK FEE'));
  PERFORM pg_temp.ok(pg_temp.st('BANK FEE') = 'unmatched' AND pg_temp.audits('ledger.bank_unignore') = 1, 'un-ignore: back to unmatched, one audit row');
  r := public.ledger_bank_unignore(pg_temp.o(1), pg_temp.line('BANK FEE'));
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.audits('ledger.bank_unignore') = 1, 'un-ignoring again changes nothing');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET matched_posting_id = pg_temp.post('A-1'), status = 'matched', match_kind = 'manual', matched_at = now() WHERE id = pg_temp.line('MONEY OUT 120')$q$,
    'ledger_bank_lines_one_per_posting', 'the database itself refuses a second line for one payment');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET amount_pence = 1 WHERE id = pg_temp.line('BANK FEE')$q$, 'LEDGER_APPEND_ONLY', 'an imported amount never changes');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET description = 'x', line_date = '2026-03-02' WHERE id = pg_temp.line('BANK FEE')$q$, 'LEDGER_APPEND_ONLY', 'nor its date or description');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_bank_lines WHERE id = pg_temp.line('BANK FEE')$q$, 'LEDGER_APPEND_ONLY', 'lines are never deleted');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_imports SET file_name = 'x'$q$, 'LEDGER_APPEND_ONLY', 'imports are never edited');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_bank_accounts WHERE id = pg_temp.acct(1)$q$, 'LEDGER_APPEND_ONLY', 'bank accounts are never deleted');
  PERFORM pg_temp.fails($q$TRUNCATE public.ledger_bank_lines CASCADE$q$, 'LEDGER_APPEND_ONLY', 'nor truncated');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET status = 'matched', match_kind = 'manual', matched_at = now(), matched_posting_id = (SELECT id FROM public.ledger_postings
     WHERE kind = 'invoice_issued' AND organization_id = pg_temp.o(1) LIMIT 1) WHERE id = pg_temp.line('BANK FEE')$q$, 'LEDGER_BANK_NOT_A_PAYMENT', 'only payments, even directly');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET status = 'matched' WHERE id = pg_temp.line('BANK FEE')$q$, 'lbl_state', 'a matched line must name its payment');
END $$;

\echo '== isolation between companies'
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_bank_lines) = 0 AND (SELECT count(*) FROM public.ledger_bank_accounts) = 1, 'B''s owner reads none of A''s lines (RLS), only B''s account');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'nor A''s overview');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('CLIENT X'), pg_temp.post('A-3'))$q$, 'LEDGER_NOT_MEMBER', 'nor match in A');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_unmatch(pg_temp.o(2), (SELECT id FROM public.ledger_bank_lines LIMIT 1))$q$, 'LEDGER_NOT_FOUND', 'B cannot reach A''s line through B either');
  r := public.ledger_bank_import(pg_temp.o(2), pg_temp.acct(2), 'b.csv', jsonb_build_array(pg_temp.r('2026-03-06', 'ACME LTD PAYMENT', 12000)));
  PERFORM pg_temp.ok((r ->> 'imported')::int = 1 AND (r ->> 'matched')::int = 1, 'B imports the same line as A: imported (not a duplicate across companies) and matched');
END $$;
RESET ROLE;
SELECT pg_temp.ok((SELECT matched_posting_id FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(2)) = pg_temp.post('B-1'), 'B''s line matched B''s own payment, never A''s');
SELECT pg_temp.who(2); SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.ledger_bank_lines) = 12 AND NOT EXISTS (SELECT 1 FROM public.ledger_bank_lines WHERE organization_id <> pg_temp.o(1)),
  'A''s plain member reads A''s 12 lines only');
DO $$ BEGIN
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_bank_imports (organization_id, bank_account_id, file_hash, row_count, first_date, last_date) VALUES (pg_temp.o(1), pg_temp.acct(1), md5('x'), 1, current_date, current_date)$q$,
    'permission denied', 'no direct insert for signed-in people');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET status = 'ignored', ignore_reason = 'not_business'$q$, 'permission denied', 'no direct update');
END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($q$SELECT count(*) FROM public.ledger_bank_lines$q$, 'permission denied', 'anon cannot read lines');
SELECT pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(1))$q$, 'permission denied', 'anon cannot call the overview');
RESET ROLE;

\echo '== a matched payment is reversed: needs attention, then re-matched'
UPDATE public.invoices SET paid_at = '2026-03-07 12:00+00' WHERE invoice_number = 'A-1';   -- the invoice changed: 3a reverses and reposts its payment
SELECT public.ledger_process_queue();
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; r jsonb; v_old uuid; BEGIN
  v_old := (SELECT matched_posting_id FROM public.ledger_bank_lines WHERE id = pg_temp.line('ACME LTD PAYMENT'));
  PERFORM pg_temp.ok((SELECT reversed_at IS NOT NULL FROM public.ledger_postings WHERE id = v_old) AND pg_temp.post('A-1') IS DISTINCT FROM v_old,
    'setup: A-1''s payment was reversed and reposted (7 Mar)');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-03-31');
  PERFORM pg_temp.ok((s -> 'counts' ->> 'needs_attention')::int = 1 AND (s -> 'counts' ->> 'matched')::int = 2
    AND s -> 'needs_attention' -> 0 ->> 'description' = 'ACME LTD PAYMENT' AND s -> 'needs_attention' -> 0 ->> 'reason' = 'match_broken',
    'the line pointing at the reversed payment is shown under Needs attention (match_broken), not as matched');
  r := public.ledger_bank_match_run(pg_temp.o(1), pg_temp.acct(1));
  PERFORM pg_temp.ok((r ->> 'unlinked')::int = 1 AND (r ->> 'matched')::int >= 1, 'the match run clears the dead link and matches again');
  PERFORM pg_temp.ok((SELECT matched_posting_id FROM public.ledger_bank_lines WHERE id = pg_temp.line('ACME LTD PAYMENT')) = pg_temp.post('A-1')
    AND pg_temp.st('ACME LTD PAYMENT') = 'matched:auto', 'the line is matched to the reposted payment');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action = 'ledger.bank_unmatch' AND details ->> 'reason' = 'posting_reversed' AND details ->> 'posting_id' = v_old::text) = 1,
    'the cleared link has an audit row naming the reversed payment');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-03-31');
  PERFORM pg_temp.ok((s -> 'counts' ->> 'needs_attention')::int = 0, 'nothing needs attention any more');
  r := public.ledger_bank_match_run(pg_temp.o(1), pg_temp.acct(1));
  PERFORM pg_temp.ok((r ->> 'unlinked')::int = 0 AND (r ->> 'matched')::int = 0, 'a second run changes nothing');
END $$;
RESET ROLE;
-- A payment reversed and NOT reposted (the invoice is marked unpaid again).
UPDATE public.invoices SET status = 'sent', paid_at = NULL WHERE invoice_number = 'A-4';
SELECT public.ledger_process_queue();
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.ok((public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1)) -> 'counts' ->> 'needs_attention')::int = 1, 'A-4 unpaid again: its manual match needs attention');
  r := public.ledger_bank_match_run(pg_temp.o(1), pg_temp.acct(1));
  PERFORM pg_temp.ok((r ->> 'unlinked')::int = 1 AND pg_temp.st('LATE PAYER') = 'unmatched', 'the run unlinks it; with no payment to match it stays unmatched');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('LATE PAYER'), (SELECT id FROM public.ledger_postings WHERE kind = 'invoice_paid'
     AND reversed_at IS NOT NULL AND source_label = 'A-4' LIMIT 1))$q$, 'LEDGER_BANK_POSTING_REVERSED', 'a reversed payment cannot be matched by hand');
END $$;
RESET ROLE;

\echo '== reconciliation agrees with the trial balance'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE s jsonb; tb bigint; BEGIN
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-03-31');
  SELECT ((debit - credit) * 100)::bigint INTO tb FROM public.ledger_trial_balance(pg_temp.o(1), '2026-03-31') WHERE code = '1200';
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'ledger_balance_pence')::bigint = tb, 'the ledger bank balance equals the trial balance''s Bank figure (' || tb || 'p)');
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'statement_balance_pence')::bigint = 120012 AND s -> 'reconciliation' ->> 'statement_balance_date' = '2026-03-28',
    'the statement balance is the latest balance on or before the date');
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'difference_pence')::bigint = 120012 - tb, 'difference = statement balance minus ledger balance');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-03-10');
  SELECT ((debit - credit) * 100)::bigint INTO tb FROM public.ledger_trial_balance(pg_temp.o(1), '2026-03-10') WHERE code = '1200';
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'statement_balance_pence')::bigint = 112000 AND (s -> 'reconciliation' ->> 'ledger_balance_pence')::bigint = tb,
    'as at 10 Mar: the 6 Mar statement balance, and the ledger as at that date');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.acct(1), '2026-02-01');
  PERFORM pg_temp.ok(s -> 'reconciliation' ->> 'statement_balance_pence' IS NULL AND s -> 'reconciliation' ->> 'difference_pence' IS NULL,
    'no statement balance before the first line: no difference shown');
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'shared_ledger_account')::boolean, 'the overview says when several bank accounts share the ledger Bank account');
END $$;
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) > (SELECT je FROM before_counts), 'sanity: the reversal and repost above came from the 3a engine');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type NOT IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment', 'auto_bill', 'auto_bill_payment', 'auto_expense')),
  'no new kind of journal exists');

\echo '== audit rows'
SELECT pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE action LIKE 'ledger.bank_%' AND (details ->> 'organization_id') IS NULL) = 0, 'every audit row names its company');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action LIKE 'ledger.bank_%' AND details::text LIKE '%ACME%'), 'audit rows never copy statement descriptions');
SELECT pg_temp.ok(pg_temp.audits('ledger.bank_import') = 5, 'one audit row per import call that stored rows (5); none for rejected calls');

\echo '== a closed company'
SELECT public.data_rights_close_company(pg_temp.o(2), pg_temp.u(5), NULL, false);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(2)) AND NOT EXISTS (SELECT 1 FROM public.ledger_bank_accounts WHERE organization_id = pg_temp.o(2)),
  'closing company B removes its bank accounts, imports and lines (through the P7b gate)');
SELECT pg_temp.ok((SELECT count(*) FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(1)) = 12, 'A''s lines are untouched');
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_overview(pg_temp.o(2))$q$, 'LEDGER_CLOSED', 'a closed company: no overview');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_account_save(pg_temp.o(2), NULL, 'Again')$q$, 'LEDGER_CLOSED', 'and no writes');
END $$;
RESET ROLE;
SELECT pg_temp.fails($q$INSERT INTO public.ledger_bank_accounts (organization_id, name, ledger_account_id) VALUES (pg_temp.o(2), 'Direct', gen_random_uuid())$q$,
  'closed', 'the closed-company guard refuses a direct insert too');

ROLLBACK;
