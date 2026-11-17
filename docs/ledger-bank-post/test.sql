-- Finance phase 3c-2 tests (DISPOSABLE local Postgres only): after docs/ledger-bank-post/proposal.sql. One transaction,
-- rolled back. Fictional people only.
--  A (0fe3…1): owner 1 (Business), 2 plain member, 3 demo admin, 4 admin with an authenticator app. Books from 1 Jan 2026,
--     opening bank 1,000.00; invoices posted automatically.   B (0fe3…2): owner 5 (Business).   9: in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fe300000-0000-4000-8000-00000000000' || x)::uuid, 'p' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code)
SELECT ('fe300000-0000-4000-8000-00000000000' || x)::uuid, 'p' || x || '@example.test', 'Person ' || x, true, 'GBP' FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('fe300000-0000-4000-8000-000000000001', 'p1@example.test', true, 'active', 'professional'),
  ('fe300000-0000-4000-8000-000000000005', 'p5@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES
  ('0fe30000-0000-4000-8000-000000000001', 'Post A', 'post-a', 'fe300000-0000-4000-8000-000000000001'),
  ('0fe30000-0000-4000-8000-000000000002', 'Post B', 'post-b', 'fe300000-0000-4000-8000-000000000005');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fe30000-0000-4000-8000-00000000000' || c)::uuid, ('fe300000-0000-4000-8000-00000000000' || u)::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'member'), (1, 3, 'admin'), (1, 4, 'admin'), (2, 5, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0fe30000-0000-4000-8000-000000000001', 'fe300000-0000-4000-8000-000000000001'),
  ('0fe30000-0000-4000-8000-000000000002', 'fe300000-0000-4000-8000-000000000005');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fe300000-0000-4000-8000-000000000003');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fe300000-0000-4000-8000-000000000004', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fe300000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fe30000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fe300000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.acc(org int, c text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(org) AND code = c $$;
CREATE FUNCTION pg_temp.ba(org int) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.ledger_bank_accounts WHERE organization_id = pg_temp.o(org) ORDER BY created_at LIMIT 1 $$;
CREATE FUNCTION pg_temp.line(d text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.ledger_bank_lines WHERE description = d ORDER BY row_no LIMIT 1 $$;
CREATE FUNCTION pg_temp.st(d text) RETURNS text LANGUAGE sql STABLE AS $$ SELECT status FROM public.ledger_bank_lines WHERE id = pg_temp.line(d) $$;
CREATE FUNCTION pg_temp.entry(d text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT posted_entry_id FROM public.ledger_bank_lines WHERE id = pg_temp.line(d) $$;
CREATE FUNCTION pg_temp.jl(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(a.code || ':' || l.debit || '/' || l.credit, ' ' ORDER BY l.line_no) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e $$;
CREATE FUNCTION pg_temp.bank(org int, d date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT t.debit - t.credit FROM public.ledger_trial_balance(pg_temp.o(org), d) t WHERE t.code = '1200' $$;
CREATE FUNCTION pg_temp.audits(a text) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT count(*) FROM public.audit_logs WHERE action = a $$;
CREATE FUNCTION pg_temp.r(d text, descr text, pence bigint, bal bigint DEFAULT NULL) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('date', d, 'description', descr, 'amount_pence', pence, 'balance_pence', bal)) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.o(int), pg_temp.u(int), pg_temp.acc(int, text), pg_temp.ba(int), pg_temp.line(text), pg_temp.st(text),
  pg_temp.entry(text), pg_temp.jl(uuid), pg_temp.bank(int, date), pg_temp.audits(text), pg_temp.r(text, text, bigint, bigint) TO PUBLIC;

SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(1), '2026-01-01', 'import', jsonb_build_array(jsonb_build_object('account_code', '1200', 'debit', '1000.00'),
  jsonb_build_object('account_code', '3000', 'credit', '1000.00')));
SELECT public.ledger_auto_set(pg_temp.o(1), true);
SELECT public.ledger_add_account(pg_temp.o(1), '7150', 'Old costs', 'expense');
SELECT public.ledger_update_account(pg_temp.acc(1, '7150'), NULL, NULL, false);
SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Main');
RESET ROLE;
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at, paid_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'A-1', 'paid', 120, 0, 120, 'GBP', '2026-02-20 12:00+00', '2026-03-05 12:00+00');
SELECT public.ledger_process_queue();
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_bank_import(pg_temp.o(1), pg_temp.ba(1), 'march.csv', jsonb_build_array(
  pg_temp.r('2026-03-03', 'MONTHLY ACCOUNT FEE', -550, 99450),
  pg_temp.r('2026-03-06', 'ACME LTD PAYMENT', 12000),
  pg_temp.r('2026-03-10', 'INTEREST PAID', 12),
  pg_temp.r('2026-03-15', 'TFR FROM DIRECTOR', 50000),
  pg_temp.r('2026-03-20', 'CARD PAYMENT X', -1000),
  pg_temp.r('2026-04-03', 'MONTHLY ACCOUNT FEE APR', -550),
  pg_temp.r('2026-05-03', 'MONTHLY ACCOUNT FEE MAY', -550),
  pg_temp.r('2026-06-03', 'MONTHLY ACCOUNT FEE JUN', -550),
  pg_temp.r('2025-12-15', 'BEFORE THE BOOKS', -100),
  pg_temp.r('2026-02-02', 'FEBRUARY FEE', -550)));
SELECT public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('CARD PAYMENT X'), 'handle_later');
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(2), '2026-01-01', 'fresh', NULL);
SELECT public.ledger_bank_account_save(pg_temp.o(2), NULL, 'Main');
SELECT public.ledger_bank_import(pg_temp.o(2), pg_temp.ba(2), 'b.csv', jsonb_build_array(pg_temp.r('2026-03-03', 'B FEE', -300)));
RESET ROLE;
SELECT pg_temp.ok(pg_temp.st('ACME LTD PAYMENT') = 'matched' AND pg_temp.st('CARD PAYMENT X') = 'ignored' AND pg_temp.st('MONTHLY ACCOUNT FEE') = 'unmatched',
  'setup: one line matched automatically, one ignored, the rest unmatched');

\echo '== shape'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 160, 'still 160 tables: no table added');
  PERFORM pg_temp.ok((SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' ORDER BY attname) FROM pg_attribute
    WHERE attrelid = 'public.ledger_bank_lines'::regclass AND attname LIKE 'posted_%' AND NOT attisdropped) = 'posted_account_id:uuid,posted_at:timestamp with time zone,posted_by:uuid,posted_entry_id:uuid',
    'four new nullable columns on ledger_bank_lines');
  PERFORM pg_temp.ok((SELECT pg_get_constraintdef(oid) LIKE '%bank_line%' FROM pg_constraint WHERE conname = 'je_source_type')
    AND (SELECT pg_get_constraintdef(oid) LIKE '%posted%' FROM pg_constraint WHERE conname = 'lbl_status'), 'je_source_type allows bank_line; lbl_status allows posted');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE '%ledger_bank%'
    AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""'))), 'no bank function for anon; every one with an empty search_path');
  PERFORM pg_temp.ok(has_function_privilege('authenticated', 'public.ledger_bank_post(uuid,uuid,uuid,text)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.ledger_bank_unpost(uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._ledger_bank_post_line(uuid,uuid,uuid,text)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public._ledger_bank_allowed_account(uuid,uuid,uuid)', 'EXECUTE'), 'the RPCs are callable; the helpers are not');
END $$;
SET ROLE anon;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'))$q$, 'permission denied', 'anon is refused');
RESET ROLE;

\echo '== who can post'
SELECT pg_temp.who(2); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_NOT_ADMIN', 'a plain member cannot post');
SELECT pg_temp.ok((public.ledger_bank_overview(pg_temp.o(1), pg_temp.ba(1)) -> 'counts' ->> 'posted')::int = 0, 'but reads the overview (0 posted)');
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_NOT_MEMBER', 'a non-member cannot post');
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_DEMO', 'the demo account cannot post');
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'))$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first');
RESET ROLE;

\echo '== posting money out and money in'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; s jsonb; e public.journal_entries; v_before numeric; BEGIN
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.ba(1), '2026-03-03');
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'difference_pence')::bigint = -550, 'before: the statement (994.50) is 5.50 below the ledger (1,000.00)');
  v_before := pg_temp.bank(1, '2026-03-31');
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'));
  PERFORM pg_temp.ok(r ->> 'result' = 'posted' AND pg_temp.st('MONTHLY ACCOUNT FEE') = 'posted', 'the £5.50 fee is posted');
  SELECT * INTO e FROM public.journal_entries WHERE id = (r ->> 'entry_id')::uuid;
  PERFORM pg_temp.ok(e.source_type = 'bank_line' AND e.source_id = pg_temp.line('MONTHLY ACCOUNT FEE') AND e.entry_date = '2026-03-03' AND e.reason = 'Bank statement line'
    AND e.posted_by = pg_temp.u(1) AND e.posted_by_name = 'Person 1' AND e.memo = 'Bank: MONTHLY ACCOUNT FEE', 'a bank_line journal on the line''s date, naming its line and the poster');
  PERFORM pg_temp.ok(pg_temp.jl(e.id) = '7900:5.50/0.00 1200:0.00/5.50', 'money out: Dr 7900 Bank charges 5.50, Cr 1200 Bank 5.50');
  PERFORM pg_temp.ok(pg_temp.bank(1, '2026-03-31') = v_before - 5.50, 'the trial balance Bank moves by exactly the line amount');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.ba(1), '2026-03-03');
  PERFORM pg_temp.ok((s -> 'reconciliation' ->> 'difference_pence')::bigint = 0, 'after posting: the difference is £0.00');
  PERFORM pg_temp.ok((s -> 'counts' ->> 'posted')::int = 1 AND s -> 'posted' -> 0 ->> 'account_code' = '7900' AND s -> 'posted' -> 0 ->> 'account_name' = 'Bank charges'
    AND (s -> 'posted' -> 0 ->> 'entry_id')::uuid = e.id, 'the overview lists the posted line with its account and journal');
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('INTEREST PAID'), pg_temp.acc(1, '4900'));
  PERFORM pg_temp.ok(pg_temp.jl((r ->> 'entry_id')::uuid) = '1200:0.12/0.00 4900:0.00/0.12', 'money in: Dr 1200 Bank 0.12, Cr 4900 Other income 0.12');
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('TFR FROM DIRECTOR'), pg_temp.acc(1, '2310'));
  PERFORM pg_temp.ok(pg_temp.jl((r ->> 'entry_id')::uuid) = '1200:500.00/0.00 2310:0.00/500.00', 'owner money in: Cr 2310 Directors'' loan account');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_lines GROUP BY entry_id HAVING sum(debit) <> sum(credit)), 'every journal balances');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.bank_post') = 3, 'one audit row per posting');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action LIKE 'ledger.bank_%' AND details::text ~ '(FEE|INTEREST|DIRECTOR)'), 'audit rows never copy the description');
  PERFORM pg_temp.ok((SELECT details ->> 'account_code' = '7900' AND (details ->> 'amount_pence')::int = -550 AND resource_type = 'bank_statement_line'
    FROM public.audit_logs WHERE action = 'ledger.bank_post' AND details ->> 'line_id' = pg_temp.line('MONTHLY ACCOUNT FEE')::text), 'the audit row: amount, account code, entry');
END $$;

\echo '== idempotency and refusals'
DO $$ DECLARE r jsonb; n bigint; BEGIN
  n := (SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1));
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '7900'));
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND (SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(1)) = n AND pg_temp.audits('ledger.bank_post') = 3,
    'posting again to the same account: unchanged, no new journal, no audit row');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), pg_temp.acc(1, '8200'))$q$, 'LEDGER_BANK_ALREADY_POSTED', 'to another account: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('ACME LTD PAYMENT'), pg_temp.acc(1, '4900'))$q$, 'LEDGER_BANK_ALREADY_MATCHED', 'a matched line: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('CARD PAYMENT X'), pg_temp.acc(1, '8200'))$q$, 'LEDGER_BANK_IGNORED', 'an ignored line: un-ignore first');
  PERFORM pg_temp.fails(format($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE APR'), pg_temp.acc(1, %L))$q$, c), 'LEDGER_BANK_ACCOUNT_NOT_ALLOWED', 'account ' || c || ' is not allowed')
    FROM unnest(ARRAY['1200', '1100', '2100', '2200', '2210', '2220', '7150']) c;
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE APR'), pg_temp.acc(2, '7900'))$q$, 'LEDGER_BANK_ACCOUNT_NOT_ALLOWED', 'nor another company''s account');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('BEFORE THE BOOKS'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_BEFORE_START', 'a line dated before the books start: the ledger refuses it');
  PERFORM pg_temp.ok(pg_temp.st('BEFORE THE BOOKS') = 'unmatched' AND pg_temp.audits('ledger.bank_post') = 3, 'and nothing changed');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE APR'), pg_temp.acc(1, '7900'), 'bad key')$q$, 'LEDGER_BAD_KEY', 'a malformed key is refused');
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE APR'), pg_temp.acc(1, '1210'), 'post-apr-fee-key');
  PERFORM pg_temp.ok(r ->> 'result' = 'posted' AND (SELECT idempotency_key FROM public.journal_entries WHERE id = (r ->> 'entry_id')::uuid) = 'post-apr-fee-key',
    '1210 Cash is allowed; the key is kept on the journal');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE MAY'), pg_temp.acc(1, '7900'), 'post-apr-fee-key')$q$, 'LEDGER_BANK_KEY_USED', 'a key already used is refused');
END $$;

\echo '== matching never touches a posted line'
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_bank_match_run(pg_temp.o(1), pg_temp.ba(1));
  PERFORM pg_temp.ok((r ->> 'unposted')::int = 0 AND pg_temp.st('MONTHLY ACCOUNT FEE') = 'posted' AND pg_temp.st('INTEREST PAID') = 'posted', 'the match run leaves posted lines alone');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_match(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), (SELECT id FROM public.ledger_postings WHERE kind = 'invoice_paid' LIMIT 1))$q$,
    'LEDGER_BANK_ALREADY_POSTED', 'a posted line cannot be matched by hand');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_ignore(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'), 'not_business')$q$, 'LEDGER_BANK_ALREADY_POSTED', 'nor ignored');
  PERFORM pg_temp.ok(public.ledger_bank_unmatch(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE')) ->> 'result' = 'unchanged'
    AND public.ledger_bank_unignore(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE')) ->> 'result' = 'unchanged' AND pg_temp.st('MONTHLY ACCOUNT FEE') = 'posted', 'unmatch and un-ignore leave it posted');
END $$;
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET amount_pence = -1 WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE')$q$, 'LEDGER_APPEND_ONLY', 'a posted line''s amount never changes');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET description = 'x', line_date = '2026-03-04' WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE')$q$, 'LEDGER_APPEND_ONLY', 'nor its date or description');
  PERFORM pg_temp.fails($q$DELETE FROM public.ledger_bank_lines WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE')$q$, 'LEDGER_APPEND_ONLY', 'lines are never deleted');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET status = 'posted', posted_entry_id = pg_temp.entry('INTEREST PAID'), posted_account_id = pg_temp.acc(1, '4900'), posted_at = now()
     WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE MAY')$q$, 'LEDGER_BANK_NOT_ITS_JOURNAL', 'a line can only name its own journal (even directly)');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET status = 'posted' WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE MAY')$q$, 'lbl_state', 'a posted line must name its journal, account and time');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_bank_lines SET posted_by = gen_random_uuid() WHERE id = pg_temp.line('MONTHLY ACCOUNT FEE MAY')$q$, 'lbl_state', 'an unmatched line has no posted fields');
END $$;

\echo '== isolation between companies'
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), (SELECT id FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(1) LIMIT 1), pg_temp.acc(2, '7900'))$q$,
    'LEDGER_NOT_MEMBER', 'B''s owner cannot post in A');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(2), pg_temp.line('MONTHLY ACCOUNT FEE MAY'), pg_temp.acc(2, '7900'))$q$, 'LEDGER_NOT_FOUND', 'nor reach A''s line through B');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(2), pg_temp.line('B FEE'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_BANK_ACCOUNT_NOT_ALLOWED', 'nor use A''s account');
  PERFORM pg_temp.ok(public.ledger_bank_post(pg_temp.o(2), pg_temp.line('B FEE'), pg_temp.acc(2, '7900')) ->> 'result' = 'posted', 'B posts its own line to its own account');
END $$;
RESET ROLE;

\echo '== post many (all or nothing)'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post_many(pg_temp.o(1), pg_temp.acc(1, '7900'), ARRAY[pg_temp.line('MONTHLY ACCOUNT FEE MAY'), pg_temp.line('CARD PAYMENT X')])$q$,
    'LEDGER_BANK_IGNORED', 'one ignored line among them: refused');
  PERFORM pg_temp.ok(pg_temp.st('MONTHLY ACCOUNT FEE MAY') = 'unmatched', 'and nothing was posted (all or nothing)');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post_many(pg_temp.o(1), pg_temp.acc(1, '7900'), (SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 51)))$q$,
    'LEDGER_BANK_TOO_MANY_LINES', '51 lines: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post_many(pg_temp.o(1), pg_temp.acc(1, '7900'), ARRAY[pg_temp.line('MONTHLY ACCOUNT FEE MAY'), pg_temp.line('MONTHLY ACCOUNT FEE MAY')])$q$,
    'LEDGER_BAD_REQUEST', 'the same line twice: refused');
  r := public.ledger_bank_post_many(pg_temp.o(1), pg_temp.acc(1, '7900'), ARRAY[pg_temp.line('MONTHLY ACCOUNT FEE MAY'), pg_temp.line('MONTHLY ACCOUNT FEE JUN'), pg_temp.line('MONTHLY ACCOUNT FEE')]);
  PERFORM pg_temp.ok((r ->> 'posted')::int = 2 AND (r ->> 'unchanged')::int = 1 AND jsonb_array_length(r -> 'entry_ids') = 3 AND pg_temp.st('MONTHLY ACCOUNT FEE JUN') = 'posted',
    'May and June fees posted in one call (March already was: unchanged)');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.bank_post') = 7, 'one audit row per line actually posted (A: 6, B: 1)');
END $$;

\echo '== phase 4 reports pick it up'
DO $$ DECLARE c jsonb; BEGIN
  PERFORM pg_temp.ok((SELECT amount FROM public.ledger_report_profit_loss(pg_temp.o(1), '2026-01-01', '2026-06-30') WHERE code = '7900') = 16.50, 'profit and loss shows the fees (3 x 5.50)');
  PERFORM pg_temp.ok((SELECT bool_and(balanced) FROM public.ledger_report_balance_sheet(pg_temp.o(1), '2026-06-30')), 'the balance sheet still balances');
  c := public.ledger_report_completeness(pg_temp.o(1));
  PERFORM pg_temp.ok((c ->> 'bank_unmatched')::int = (SELECT count(*) FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(1) AND status = 'unmatched')
    AND (c ->> 'bank_unmatched')::int = 2, 'completeness: bank_unmatched counts only the 2 lines still unmatched');
END $$;

\echo '== un-posting'
DO $$ DECLARE r jsonb; e uuid; rev public.journal_entries; v_bank numeric; BEGIN
  e := pg_temp.entry('INTEREST PAID'); v_bank := pg_temp.bank(1, '2026-12-31');
  r := public.ledger_bank_unpost(pg_temp.o(1), pg_temp.line('INTEREST PAID'));
  SELECT * INTO rev FROM public.journal_entries WHERE id = (r ->> 'reversal_entry_id')::uuid;
  PERFORM pg_temp.ok(r ->> 'how' = 'reversed' AND rev.source_type = 'reversal' AND rev.reverses_entry_id = e AND rev.entry_date = '2026-03-10' AND r ->> 'reversal_dated' = 'line_date',
    'un-post: a reversal journal on the line''s date');
  PERFORM pg_temp.ok(pg_temp.jl(rev.id) = '1200:0.00/0.12 4900:0.12/0.00' AND pg_temp.bank(1, '2026-12-31') = v_bank - 0.12, 'it mirrors the lines; Bank moves back');
  PERFORM pg_temp.ok(pg_temp.st('INTEREST PAID') = 'unmatched' AND (SELECT posted_entry_id IS NULL AND posted_account_id IS NULL AND posted_at IS NULL AND posted_by IS NULL
    FROM public.ledger_bank_lines WHERE id = pg_temp.line('INTEREST PAID')), 'the line is unmatched with every posted field cleared');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.journal_entries WHERE id = e), 'the original journal is still there (nothing deleted)');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.bank_unpost') = 1, 'one audit row');
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_unpost(pg_temp.o(1), pg_temp.line('INTEREST PAID'))$q$, 'LEDGER_BANK_NOT_POSTED', 'un-posting again: refused (it is not posted)');
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('INTEREST PAID'), pg_temp.acc(1, '4900'));
  PERFORM pg_temp.ok(r ->> 'result' = 'posted' AND (r ->> 'entry_id')::uuid <> e, 'it can be posted again (a new journal)');
END $$;

\echo '== a posted journal reversed from the Journals screen'
DO $$ DECLARE s jsonb; e uuid; r jsonb; n bigint; BEGIN
  e := pg_temp.entry('TFR FROM DIRECTOR');
  PERFORM public.ledger_reverse_journal(e, 'Reversed on the Journals screen', '2026-03-15');
  s := public.ledger_bank_overview(pg_temp.o(1), pg_temp.ba(1), '2026-12-31');
  PERFORM pg_temp.ok((s -> 'counts' ->> 'needs_attention')::int = 1 AND s -> 'needs_attention' -> 0 ->> 'reason' = 'post_broken'
    AND s -> 'needs_attention' -> 0 ->> 'description' = 'TFR FROM DIRECTOR' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s -> 'posted') p WHERE p ->> 'description' = 'TFR FROM DIRECTOR'),
    'the line shows under Needs attention (post_broken), not as posted');
  n := (SELECT count(*) FROM public.journal_entries WHERE reverses_entry_id = e);
  r := public.ledger_bank_match_run(pg_temp.o(1), pg_temp.ba(1));
  PERFORM pg_temp.ok((r ->> 'unposted')::int = 1 AND pg_temp.st('TFR FROM DIRECTOR') = 'unmatched' AND (SELECT count(*) FROM public.journal_entries WHERE reverses_entry_id = e) = n,
    'the next match run returns it to unmatched (no second reversal)');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'ledger.bank_unpost' AND details ->> 'reason' = 'journal_reversed' AND details ->> 'entry_id' = e::text), 'with an audit row');
  PERFORM pg_temp.ok((public.ledger_bank_overview(pg_temp.o(1), pg_temp.ba(1)) -> 'counts' ->> 'needs_attention')::int = 0, 'nothing needs attention now');
  -- Un-post after a reversal from Journals: not reversed twice.
  r := public.ledger_bank_post(pg_temp.o(1), pg_temp.line('TFR FROM DIRECTOR'), pg_temp.acc(1, '2310'));
  e := (r ->> 'entry_id')::uuid;
  PERFORM public.ledger_reverse_journal(e, 'Reversed on the Journals screen', '2026-03-16');
  r := public.ledger_bank_unpost(pg_temp.o(1), pg_temp.line('TFR FROM DIRECTOR'));
  PERFORM pg_temp.ok(r ->> 'how' = 'already_reversed' AND (SELECT count(*) FROM public.journal_entries WHERE reverses_entry_id = e) = 1 AND pg_temp.st('TFR FROM DIRECTOR') = 'unmatched',
    'un-posting a journal already reversed from Journals: no second reversal, the line is unmatched');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'ledger.bank_unpost' AND details ->> 'reason' = 'already_reversed'), 'the audit row says so');
END $$;

\echo '== a locked period'
RESET ROLE;
UPDATE public.ledger_settings SET locked_through = '2026-03-31' WHERE organization_id = pg_temp.o(1);
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; rev public.journal_entries; BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_bank_post(pg_temp.o(1), pg_temp.line('FEBRUARY FEE'), pg_temp.acc(1, '7900'))$q$, 'LEDGER_PERIOD_LOCKED', 'posting into a locked period: the ledger refuses it');
  r := public.ledger_bank_unpost(pg_temp.o(1), pg_temp.line('MONTHLY ACCOUNT FEE'));
  SELECT * INTO rev FROM public.journal_entries WHERE id = (r ->> 'reversal_entry_id')::uuid;
  PERFORM pg_temp.ok(r ->> 'reversal_dated' = 'today' AND rev.entry_date = current_date AND r ->> 'how' = 'reversed', 'un-posting a line in a locked period: the reversal is dated today, and it says so');
END $$;
RESET ROLE;

\echo '== a closed company'
SELECT public.data_rights_close_company(pg_temp.o(2), pg_temp.u(5), NULL, false);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ledger_bank_lines WHERE organization_id = pg_temp.o(2)) AND NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE organization_id = pg_temp.o(2)),
  'closing company B (with a posted line) removes its lines and journals through the P7b gate');
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_bank_unpost(pg_temp.o(2), gen_random_uuid())$q$, 'LEDGER_CLOSED', 'a closed company: nothing can be posted or un-posted');
RESET ROLE;

ROLLBACK;
