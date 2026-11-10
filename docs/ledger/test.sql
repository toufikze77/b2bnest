-- Finance phase 2 ledger tests (DISPOSABLE local Postgres only). Run by docs/ledger/run-test.sh after production's
-- shape, docs/ledger/fixture.sql and docs/ledger/proposal.sql. One transaction, rolled back. Fictional people only.
-- People (fa0…0NN) and companies (0fa…00N):
--  A (1): 1 owner paying Business, 2 admin, 3 member, 6 the demo account (admin), 8 admin with an authenticator app.
--  B (2): 4 owner on the trial.   C (3): 5 owner on Solo.   D (4): 7 owner whose trial ended.   9: in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'l' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active)
SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(x::text, 2, '0'))::uuid, 'l' || x || '@example.test', 'Person ' || x,
       CASE WHEN x = 4 THEN now() + interval '5 days' WHEN x = 7 THEN now() - interval '2 days' END, true
  FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, trial_ends_at = EXCLUDED.trial_ends_at;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fa000000-0000-4000-8000-000000000001', 'l1@example.test', true, 'active', 'professional'),
  ('fa000000-0000-4000-8000-000000000005', 'l5@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0fa00000-0000-4000-8000-00000000000' || x)::uuid, 'Company ' || x, 'ledger-co-' || x, ('fa000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 5), (4, 7)) v(x, o);
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fa00000-0000-4000-8000-00000000000' || c)::uuid, ('fa000000-0000-4000-8000-0000000000' || lpad(u::text, 2, '0'))::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'admin'), (1, 3, 'member'), (1, 6, 'admin'), (1, 8, 'admin'), (2, 4, 'owner'), (3, 5, 'owner'), (4, 7, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id)
SELECT ('0fa00000-0000-4000-8000-00000000000' || x)::uuid, ('fa000000-0000-4000-8000-0000000000' || lpad(o::text, 2, '0'))::uuid
  FROM (VALUES (1, 1), (2, 4), (3, 5), (4, 7)) v(x, o);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fa000000-0000-4000-8000-000000000006');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fa000000-0000-4000-8000-000000000008', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fa000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'), 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fa000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fa00000-0000-4000-8000-00000000000' || n)::uuid $$;
-- A two-line journal: debit one account, credit another.
CREATE FUNCTION pg_temp.pair(dr text, cr text, amount text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_array(jsonb_build_object('account_code', dr, 'debit', amount), jsonb_build_object('account_code', cr, 'credit', amount)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.u(int), pg_temp.o(int), pg_temp.pair(text, text, text) TO PUBLIC;

\echo '== setup: once per company; import posts one balanced opening journal at the start date'
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ DECLARE s jsonb; r jsonb; BEGIN
  s := public.ledger_status(pg_temp.o(1));
  PERFORM pg_temp.ok(s ->> 'access' = 'ok' AND (s ->> 'can_post')::boolean AND NOT (s ->> 'set_up')::boolean, 'Business owner: allowed, not set up yet');
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'import', jsonb_build_array(jsonb_build_object('account_code', '1200', 'debit', '1000.00'), jsonb_build_object('account_code', '3000', 'credit', '999.99')))$q$,
    'LEDGER_UNBALANCED', 'an unbalanced opening set is refused');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_settings WHERE organization_id = pg_temp.o(1)), 'and nothing was created (one transaction)');
  r := public.ledger_setup(pg_temp.o(1), '2026-01-01', 'import', pg_temp.pair('1200', '3000', '1000.00') || jsonb_build_array(jsonb_build_object('account_code', '1100', 'debit', '250.50'), jsonb_build_object('account_code', '2100', 'credit', '250.50')));
  PERFORM pg_temp.ok(r ->> 'result' = 'ok' AND (r ->> 'accounts')::int = 30, 'import: settings, the 30-account chart and the opening journal');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1) AND source_type = 'opening_balance' AND entry_date = '2026-01-01') = 1, 'one opening journal dated the start date');
  PERFORM pg_temp.ok((SELECT sum(debit) = sum(credit) AND count(*) = 4 FROM public.journal_lines WHERE organization_id = pg_temp.o(1)), 'its four lines balance');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND is_system) = 17, '17 system accounts (Bank, Debtors, VAT control, Suspense and the rest)');
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(1), '2026-02-01', 'fresh', NULL)$q$, 'LEDGER_ALREADY_SET_UP', 'a second setup is refused');
  s := public.ledger_status(pg_temp.o(1));
  PERFORM pg_temp.ok((s ->> 'set_up')::boolean AND s ->> 'start_date' = '2026-01-01' AND s ->> 'opening_mode' = 'import' AND s ->> 'base_currency' = 'GBP', 'status: set up, the start date, import, GBP');
END $$;
RESET ROLE;
SELECT pg_temp.who(4);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(2), '2026-04-01', 'fresh', pg_temp.pair('1200', '3000', '1.00'))$q$, 'LEDGER_BAD_MODE', 'starting fresh takes no opening balances');
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(2), '2026-04-01', 'later', NULL)$q$, 'LEDGER_BAD_MODE', 'only fresh or import');
  PERFORM pg_temp.ok(public.ledger_setup(pg_temp.o(2), '2026-04-01', 'fresh', NULL) ->> 'result' = 'ok', 'a trial owner sets up fresh (no journal)');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(2)), 'fresh: no opening journal');
END $$;
RESET ROLE;

\echo '== posting: the balance rule and every input check'
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ DECLARE r jsonb; r2 jsonb; BEGIN
  r := public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'Office rent February', 'Paid by bank', pg_temp.pair('7100', '1200', '120.00'));
  PERFORM pg_temp.ok(r ->> 'result' = 'ok', 'a balanced manual journal posts');
  PERFORM pg_temp.ok((SELECT posted_by = pg_temp.u(1) AND posted_by_name = 'Person 1' AND source_type = 'manual' FROM public.journal_entries WHERE id = (r ->> 'entry_id')::uuid), 'who posted it is recorded');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.audit_logs WHERE user_id = pg_temp.u(1) AND action = 'ledger.journal_manual' AND resource_id = r ->> 'entry_id') = 1, 'one audit row');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', jsonb_build_array(jsonb_build_object('account_code', '7100', 'debit', '10.00'), jsonb_build_object('account_code', '1200', 'credit', '9.99')))$q$,
    'LEDGER_UNBALANCED', 'an unbalanced journal is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', jsonb_build_array(jsonb_build_object('account_code', '7100', 'debit', '10.00')))$q$,
    'LEDGER_TOO_FEW_LINES', 'a single-line journal is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', jsonb_build_array(jsonb_build_object('account_code', '7100', 'debit', '10.00', 'credit', '10.00'), jsonb_build_object('account_code', '1200', 'debit', '5.00', 'credit', '5.00')))$q$,
    'LEDGER_ONE_SIDE', 'a debit and a credit on one line are refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', jsonb_build_array(jsonb_build_object('account_code', '7100', 'debit', '-10.00'), jsonb_build_object('account_code', '1200', 'debit', '10.00')))$q$,
    'LEDGER_BAD_AMOUNT', 'a negative amount is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7100', '1200', '10.005'))$q$, 'LEDGER_BAD_AMOUNT', 'more than two decimals is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7100', '1200', '0.00'))$q$, 'LEDGER_ONE_SIDE', 'a zero line is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', NULL, pg_temp.pair('7100', '1200', '1.00'))$q$, 'LEDGER_REASON_REQUIRED', 'a manual journal needs a reason');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', '', 'reason', pg_temp.pair('7100', '1200', '1.00'))$q$, 'LEDGER_BAD_MEMO', 'a memo is required');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', repeat('m', 201), 'reason', pg_temp.pair('7100', '1200', '1.00'))$q$, 'LEDGER_BAD_MEMO', 'a memo of at most 200 characters');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7100', '1200', '1.00'), 'opening_balance')$q$, 'LEDGER_BAD_SOURCE', 'the browser posts manual journals only');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2025-12-31', 'x', 'reason', pg_temp.pair('7100', '1200', '1.00'))$q$, 'LEDGER_BEFORE_START', 'a date before the start date is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7100', 'NOPE', '1.00'))$q$, 'LEDGER_UNKNOWN_ACCOUNT', 'an unknown account is refused');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', jsonb_build_array(jsonb_build_object('account_id', %L, 'debit', '1.00'), jsonb_build_object('account_code', '1200', 'credit', '1.00')))$q$,
    (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(2) AND code = '7100')), 'LEDGER_UNKNOWN_ACCOUNT', 'another company''s account is refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', (SELECT jsonb_agg(l) FROM (SELECT jsonb_build_object('account_code', '7100', 'debit', '1.00') l FROM generate_series(1, 100) UNION ALL SELECT jsonb_build_object('account_code', '1200', 'credit', '1.00') FROM generate_series(1, 101)) z))$q$,
    'LEDGER_TOO_MANY_LINES', 'at most 200 lines');
  r := public.ledger_post_journal(pg_temp.o(1), '2026-02-11', 'Software', 'Monthly subscription', pg_temp.pair('7700', '1200', '30.00'), 'manual', 'key-software-0001');
  r2 := public.ledger_post_journal(pg_temp.o(1), '2026-02-11', 'Software', 'Monthly subscription', pg_temp.pair('7700', '1200', '30.00'), 'manual', 'key-software-0001');
  PERFORM pg_temp.ok(r2 ->> 'result' = 'existing' AND r2 ->> 'entry_id' = r ->> 'entry_id', 'the same idempotency key returns the same journal');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE idempotency_key = 'key-software-0001') = 1, 'and posts it once');
END $$;
RESET ROLE;

\echo '== reversal: the mirror entry, once; a reversal is not reversed'
SELECT pg_temp.who(2);
SET ROLE authenticated;
DO $$ DECLARE e uuid; r jsonb; BEGIN
  e := (SELECT id FROM public.journal_entries WHERE memo = 'Office rent February');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_reverse_journal(%L, '')$q$, e), 'LEDGER_REASON_REQUIRED', 'a reversal needs a reason');
  r := public.ledger_reverse_journal(e, 'Wrong month', '2026-03-01');
  PERFORM pg_temp.ok(r ->> 'result' = 'ok', 'an admin reverses a journal');
  PERFORM pg_temp.ok((SELECT reverses_entry_id = e AND source_type = 'reversal' AND entry_date = '2026-03-01' AND memo = 'Reversal: Office rent February' AND reason = 'Wrong month'
                        FROM public.journal_entries WHERE id = (r ->> 'entry_id')::uuid), 'the reversal points at it, with the reason');
  PERFORM pg_temp.ok((SELECT bool_and(x.debit = y.credit AND x.credit = y.debit AND x.account_id = y.account_id) FROM public.journal_lines x JOIN public.journal_lines y ON y.line_no = x.line_no
                        WHERE x.entry_id = e AND y.entry_id = (r ->> 'entry_id')::uuid), 'its lines mirror the original');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_reverse_journal(%L, 'again')$q$, e), 'LEDGER_ALREADY_REVERSED', 'a journal is reversed once only');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_reverse_journal(%L, 'undo the undo')$q$, r ->> 'entry_id'), 'LEDGER_REVERSAL_OF_REVERSAL', 'a reversal is not reversed');
  PERFORM pg_temp.ok((SELECT sum(debit) = sum(credit) FROM public.ledger_trial_balance(pg_temp.o(1), '2026-12-31')), 'the trial balance: total debits equal total credits');
  PERFORM pg_temp.ok((SELECT debit - credit FROM public.ledger_trial_balance(pg_temp.o(1), '2026-12-31') WHERE code = '7100') = 0, 'rent is back to zero after the reversal');
  PERFORM pg_temp.ok((SELECT debit FROM public.ledger_trial_balance(pg_temp.o(1), '2026-02-28') WHERE code = '7100') = 120, 'the trial balance on a date excludes later journals');
END $$;
RESET ROLE;

\echo '== the chart of accounts'
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ DECLARE v uuid; bank uuid; rent uuid; BEGIN
  bank := (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND code = '1200');
  rent := (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND code = '7100');
  PERFORM public.ledger_update_account(bank, 'Business current account');
  PERFORM pg_temp.ok((SELECT name FROM public.ledger_accounts WHERE id = bank) = 'Business current account', 'a system account can be renamed');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_update_account(%L, NULL, '1201')$q$, bank), 'LEDGER_SYSTEM_ACCOUNT', 'a system account keeps its code');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_update_account(%L, NULL, NULL, false)$q$, bank), 'LEDGER_SYSTEM_ACCOUNT', 'a system account stays active');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_delete_account(%L)$q$, bank), 'LEDGER_SYSTEM_ACCOUNT', 'a system account can''t be deleted');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_delete_account(%L)$q$, rent), 'LEDGER_ACCOUNT_USED', 'a used account can''t be deleted');
  PERFORM public.ledger_update_account(rent, 'Rent', '7101', false);
  PERFORM pg_temp.ok((SELECT code = '7101' AND NOT is_active FROM public.ledger_accounts WHERE id = rent), 'a used, non-system account can be recoded and deactivated');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-12', 'x', 'reason', pg_temp.pair('7101', '1200', '1.00'))$q$, 'LEDGER_ACCOUNT_INACTIVE', 'an inactive account takes no new journal');
  PERFORM pg_temp.fails($q$SELECT public.ledger_add_account(pg_temp.o(1), '7101', 'Dup', 'expense')$q$, 'LEDGER_CODE_TAKEN', 'codes are unique in a company');
  PERFORM pg_temp.fails($q$SELECT public.ledger_add_account(pg_temp.o(1), '7150', 'Odd', 'cost')$q$, 'LEDGER_BAD_TYPE', 'five types only');
  v := public.ledger_add_account(pg_temp.o(1), '7150', 'Insurance', 'expense');
  PERFORM pg_temp.ok((SELECT normal_side = 'debit' AND NOT is_system FROM public.ledger_accounts WHERE id = v), 'a new account gets the normal side of its type');
  PERFORM public.ledger_delete_account(v);
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE id = v), 'an unused account can be deleted');
END $$;
RESET ROLE;

\echo '== who may do what (RLS and the plan rule)'
SELECT pg_temp.who(3);
SET ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
  s := public.ledger_status(pg_temp.o(1));
  PERFORM pg_temp.ok(s ->> 'access' = 'ok' AND NOT (s ->> 'can_post')::boolean, 'a member: may read, may not post');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) > 0 AND (SELECT count(*) FROM public.journal_lines) > 0 AND (SELECT count(*) FROM public.ledger_accounts) = 30, 'a member reads the company''s ledger');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'LEDGER_NOT_ADMIN', 'a member can''t post');
  PERFORM pg_temp.fails($q$INSERT INTO public.journal_entries (organization_id, entry_date, memo, source_type, posted_by) VALUES (pg_temp.o(1), '2026-02-10', 'x', 'manual', pg_temp.u(3))$q$, 'permission denied', 'no direct insert');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_accounts SET name = 'x'$q$, 'permission denied', 'no direct update');
  PERFORM pg_temp.fails($q$DELETE FROM public.journal_lines$q$, 'permission denied', 'no direct delete');
END $$;
RESET ROLE;
SELECT pg_temp.who(9);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = 0 AND (SELECT count(*) FROM public.ledger_settings) = 0 AND (SELECT count(*) FROM public.ledger_accounts) = 0, 'an outsider reads nothing');
  PERFORM pg_temp.fails($q$SELECT public.ledger_status(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'and is refused the status');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'LEDGER_NOT_MEMBER', 'and can''t post');
END $$;
RESET ROLE;
SELECT pg_temp.who(4);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = 0 AND (SELECT count(*) FROM public.ledger_accounts) = 30 AND (SELECT bool_and(organization_id = pg_temp.o(2)) FROM public.ledger_accounts),
    'company B reads only its own ledger, never A''s');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'LEDGER_NOT_MEMBER', 'B''s owner can''t post into A');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.who(4);
  PERFORM pg_temp.fails(format($q$SET LOCAL ROLE authenticated; SELECT public.ledger_reverse_journal(%L, 'not mine')$q$, (SELECT id FROM public.journal_entries WHERE organization_id = pg_temp.o(1) AND source_type = 'manual' LIMIT 1)),
    'LEDGER_NOT_MEMBER', 'B''s owner can''t reverse A''s journal');
END $$;
RESET ROLE;
SELECT pg_temp.who(5);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.ledger_status(pg_temp.o(3)) ->> 'access' = 'plan_not_included', 'Solo: the status says plan not included');
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(3), '2026-01-01', 'fresh', NULL)$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'Solo can''t set up the ledger');
  PERFORM pg_temp.fails($q$SELECT * FROM public.ledger_trial_balance(pg_temp.o(3), NULL)$q$, 'LEDGER_PLAN_NOT_INCLUDED', 'nor read a trial balance');
END $$;
RESET ROLE;
SELECT pg_temp.who(7);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(4), '2026-01-01', 'fresh', NULL)$q$, 'LEDGER_TRIAL_ENDED', 'an ended trial can''t set up the ledger');
END $$;
RESET ROLE;
SELECT pg_temp.who(6, 'aal2');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.ledger_status(pg_temp.o(1)) ->> 'access' = 'demo', 'the demo account: status demo');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'LEDGER_DEMO', 'the demo account can''t post');
END $$;
RESET ROLE;
SELECT pg_temp.who(8, 'aal1');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-10', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'MFA_REQUIRED', 'an admin with an authenticator app must use it (aal2)');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) = 0, 'and reads nothing until then (restrictive policy)');
END $$;
RESET ROLE;
SELECT pg_temp.who(8, 'aal2');
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.ledger_post_journal(pg_temp.o(1), '2026-02-13', 'Bank charges', 'Statement', pg_temp.pair('7900', '1200', '5.00')) ->> 'result' = 'ok', 'with aal2 the same admin posts');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT count(*) FROM public.journal_entries$q$, 'permission denied', 'anon: no journals');
  PERFORM pg_temp.fails($q$SELECT count(*) FROM public.ledger_accounts$q$, 'permission denied', 'anon: no accounts');
  PERFORM pg_temp.fails($q$SELECT public.ledger_status(pg_temp.o(1))$q$, 'permission denied', 'anon: no functions');
END $$;
RESET ROLE;

\echo '== append-only for everyone, including the service role and the database owner'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);
SET ROLE service_role;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries) > 0, 'the service role reads (for the data export)');
  PERFORM pg_temp.fails($q$UPDATE public.journal_entries SET memo = 'edited'$q$, 'permission denied', 'the service role can''t update journals');
  PERFORM pg_temp.fails($q$DELETE FROM public.journal_lines$q$, 'permission denied', 'nor delete lines');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode) VALUES (pg_temp.o(3), '2026-01-01', 'fresh')$q$, 'permission denied', 'nor write settings');
END $$;
RESET ROLE;
DO $$ DECLARE e uuid; BEGIN
  e := (SELECT id FROM public.journal_entries WHERE memo = 'Bank charges');
  PERFORM pg_temp.fails(format($q$UPDATE public.journal_entries SET memo = 'edited' WHERE id = %L$q$, e), 'LEDGER_APPEND_ONLY', 'even the owner can''t edit a journal');
  PERFORM pg_temp.fails(format($q$UPDATE public.journal_lines SET debit = debit + 1 WHERE entry_id = %L$q$, e), 'LEDGER_APPEND_ONLY', 'or a line');
  PERFORM pg_temp.fails(format($q$DELETE FROM public.journal_entries WHERE id = %L$q$, e), 'LEDGER_APPEND_ONLY', 'or delete a journal');
  PERFORM pg_temp.fails(format($q$DELETE FROM public.journal_lines WHERE entry_id = %L$q$, e), 'LEDGER_APPEND_ONLY', 'or a line');
  PERFORM pg_temp.fails(format($q$INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit) VALUES (%L, pg_temp.o(1), (SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1) AND code = '1200'), 9, 1)$q$, e),
    'LEDGER_APPEND_ONLY', 'or add a line to a posted journal');
  PERFORM pg_temp.fails($q$SET CONSTRAINTS ALL IMMEDIATE; INSERT INTO public.journal_entries (organization_id, entry_date, memo, source_type, posted_by) VALUES (pg_temp.o(1), '2026-02-10', 'no lines', 'manual', pg_temp.u(1))$q$,
    'LEDGER_TOO_FEW_LINES', 'the database refuses a journal without lines (the balance trigger)');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_accounts SET type = 'income' WHERE organization_id = pg_temp.o(1) AND code = '1200'$q$, 'LEDGER_SYSTEM_ACCOUNT', 'a system account keeps its type');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_settings WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_SETTINGS_FIXED', 'settings go only with the company');
END $$;

\echo '== dates: the start date is fixed once a journal exists; a locked period stays locked'
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET start_date = '2026-02-01' WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_START_DATE_FIXED', 'A''s start date can''t change (journals exist)');
  UPDATE public.ledger_settings SET start_date = '2026-05-01' WHERE organization_id = pg_temp.o(2);
  PERFORM pg_temp.ok((SELECT start_date FROM public.ledger_settings WHERE organization_id = pg_temp.o(2)) = '2026-05-01', 'B''s can (no journal yet)');
  UPDATE public.ledger_settings SET locked_through = '2026-02-28' WHERE organization_id = pg_temp.o(1);
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = '2026-01-31' WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_LOCK_BACKWARDS', 'a lock can''t move back');
END $$;
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2026-02-15', 'x', 'reason', pg_temp.pair('7700', '1200', '1.00'))$q$, 'LEDGER_PERIOD_LOCKED', 'a date in a locked period is refused');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_reverse_journal(%L, 'late', '2026-02-20')$q$, (SELECT id FROM public.journal_entries WHERE memo = 'Software')), 'LEDGER_PERIOD_LOCKED', 'a reversal into a locked period too');
  PERFORM pg_temp.ok(public.ledger_post_journal(pg_temp.o(1), '2026-03-02', 'Travel', 'Train', pg_temp.pair('7400', '1200', '12.40')) ->> 'result' = 'ok', 'after the lock: allowed');
END $$;
RESET ROLE;

\echo '== account deletion: journals keep the opaque id; the name becomes "Deleted user"'
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE posted_by = pg_temp.u(2)) = 1, 'the admin posted one journal (the reversal)');
  r := public.data_rights_delete_account(pg_temp.u(2), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'deleted', 'the admin deletes their account');
  PERFORM pg_temp.ok((SELECT posted_by_name FROM public.journal_entries WHERE posted_by = pg_temp.u(2)) = 'Deleted user', 'their journal stays, named "Deleted user"');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) = 6, 'the company keeps all its journals');
  PERFORM pg_temp.fails($q$UPDATE public.journal_entries SET posted_by_name = 'Deleted user' WHERE posted_by = pg_temp.u(1)$q$, 'LEDGER_APPEND_ONLY', 'outside account deletion the name can''t change');
END $$;

\echo '== company closure (through the P7b gate): the ledger goes with the company; closed companies are refused'
DO $$ DECLARE r jsonb; BEGIN
  r := public.data_rights_close_company(pg_temp.o(1), pg_temp.u(1), NULL, false);
  PERFORM pg_temp.ok(r ->> 'result' = 'closed', 'the owner closes company A');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) AND NOT EXISTS (SELECT 1 FROM public.journal_lines WHERE organization_id = pg_temp.o(1))
    AND NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE organization_id = pg_temp.o(1)) AND NOT EXISTS (SELECT 1 FROM public.ledger_settings WHERE organization_id = pg_temp.o(1)),
    'its settings, chart, journals and lines are deleted');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.ledger_settings WHERE organization_id = pg_temp.o(2)), 'company B is untouched');
  PERFORM pg_temp.fails($q$INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode) VALUES (pg_temp.o(1), '2026-01-01', 'fresh')$q$, 'COMPANY_CLOSED', 'no new ledger for a closed company');
END $$;
SELECT pg_temp.who(1);
SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_status(pg_temp.o(1))$q$, 'LEDGER_CLOSED', 'a closed company: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'fresh', NULL)$q$, 'LEDGER_', 'and can''t be set up again');
END $$;
RESET ROLE;
ROLLBACK;
