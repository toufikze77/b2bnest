-- Finance phase 5 tests (DISPOSABLE local Postgres only): after docs/ledger-year-end/proposal.sql. One transaction,
-- rolled back. Fictional people only. The year ends below are in the past relative to the test date (Nov 2026).
--  A (0fe5…1): owner 1, 2 plain member, 3 demo admin, 4 admin with an authenticator app. Books from 1 Jan 2025, opening
--     bank 1,000.00. Year end 31 March: first year 01/01/2025–31/03/2025 (three months), then 01/04/2025–31/03/2026.
--     First year: sales 180.00, overheads 120.50 (profit 59.50, the README example). Second: sales 300, rent 400 (loss 100).
--  B (0fe5…2): owner 5; a P&L account made inactive with a balance.   C (0fe5…3): owner 6; a year with no activity.
--  D (0fe5…4): owner 7; a closed company.   9: in no company.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) SELECT ('fe500000-0000-4000-8000-00000000000' || x)::uuid, 'y' || x || '@example.test' FROM generate_series(1, 9) x;
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code)
SELECT ('fe500000-0000-4000-8000-00000000000' || x)::uuid, 'y' || x || '@example.test', 'Person ' || x, true, 'GBP' FROM generate_series(1, 9) x
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key)
SELECT ('fe500000-0000-4000-8000-00000000000' || x)::uuid, 'y' || x || '@example.test', true, 'active', 'professional' FROM unnest(ARRAY[1, 5, 6, 7]) x;
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0fe50000-0000-4000-8000-00000000000' || c)::uuid, 'Year ' || c, 'year-' || c, ('fe500000-0000-4000-8000-00000000000' || u)::uuid
  FROM (VALUES (1, 1), (2, 5), (3, 6), (4, 7)) v(c, u);
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fe50000-0000-4000-8000-00000000000' || c)::uuid, ('fe500000-0000-4000-8000-00000000000' || u)::uuid, r, true
  FROM (VALUES (1, 1, 'owner'), (1, 2, 'member'), (1, 3, 'admin'), (1, 4, 'admin'), (2, 5, 'owner'), (3, 6, 'owner'), (4, 7, 'owner')) v(c, u, r);
INSERT INTO public.organization_billing (organization_id, billing_user_id)
SELECT ('0fe50000-0000-4000-8000-00000000000' || c)::uuid, ('fe500000-0000-4000-8000-00000000000' || u)::uuid FROM (VALUES (1, 1), (2, 5), (3, 6), (4, 7)) v(c, u);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('fe500000-0000-4000-8000-000000000003');
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('fe500000-0000-4000-8000-000000000004', 'verified');

CREATE FUNCTION pg_temp.who(n int, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', 'fe500000-0000-4000-8000-00000000000' || n, 'role', 'authenticated', 'aal', aal)::text, false) $$;
CREATE FUNCTION pg_temp.o(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('0fe50000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('fe500000-0000-4000-8000-00000000000' || n)::uuid $$;
CREATE FUNCTION pg_temp.acc(org int, c text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.ledger_accounts WHERE organization_id = pg_temp.o(org) AND code = c $$;
CREATE FUNCTION pg_temp.jl(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(a.code || ':' || l.debit || '/' || l.credit, ' ' ORDER BY l.line_no) FROM public.journal_lines l JOIN public.ledger_accounts a ON a.id = l.account_id WHERE l.entry_id = e $$;
CREATE FUNCTION pg_temp.descs(e uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(l.description, ' | ' ORDER BY l.line_no) FROM public.journal_lines l WHERE l.entry_id = e $$;
-- What a preview says would be posted, in the same form as pg_temp.jl.
CREATE FUNCTION pg_temp.pv(p jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT concat_ws(' ', (SELECT string_agg((l ->> 'code') || ':' || (l ->> 'debit')::numeric(14,2) || '/' || (l ->> 'credit')::numeric(14,2), ' ' ORDER BY l ->> 'code') FROM jsonb_array_elements(p -> 'lines') l),
    CASE WHEN (p ->> 'profit')::numeric <> 0 THEN '3200:' || (p -> 'retained_earnings' ->> 'debit')::numeric(14,2) || '/' || (p -> 'retained_earnings' ->> 'credit')::numeric(14,2) END) $$;
CREATE FUNCTION pg_temp.ye(org int, d date) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT e.id FROM public.journal_entries e WHERE e.organization_id = pg_temp.o(org) AND e.source_type = 'year_end' AND e.entry_date = d
     AND NOT EXISTS (SELECT 1 FROM public.journal_entries r WHERE r.reverses_entry_id = e.id) $$;
CREATE FUNCTION pg_temp.lock(org int) RETURNS date LANGUAGE sql STABLE AS $$ SELECT locked_through FROM public.ledger_settings WHERE organization_id = pg_temp.o(org) $$;
CREATE FUNCTION pg_temp.audits(a text, org int) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT count(*) FROM public.audit_logs WHERE action = a AND resource_id = pg_temp.o(org)::text $$;
CREATE FUNCTION pg_temp.entries(org int) RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT count(*) FROM public.journal_entries WHERE organization_id = pg_temp.o(org) $$;
CREATE FUNCTION pg_temp.pl(org int, c text, f date, t date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT x.amount FROM public.ledger_report_profit_loss(pg_temp.o(org), f, t) x WHERE x.code = c $$;
CREATE FUNCTION pg_temp.bs(org int, c text, d date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT x.balance FROM public.ledger_report_balance_sheet(pg_temp.o(org), d) x WHERE x.code = c), 0) $$;
CREATE FUNCTION pg_temp.bs_ok(org int, d date) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT bool_and(x.balanced) FROM public.ledger_report_balance_sheet(pg_temp.o(org), d) x $$;
CREATE FUNCTION pg_temp.tb_ok(org int, d date) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT sum(t.debit) = sum(t.credit) FROM public.ledger_trial_balance(pg_temp.o(org), d) t $$;
CREATE FUNCTION pg_temp.tb(org int, c text, d date) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT t.debit - t.credit FROM public.ledger_trial_balance(pg_temp.o(org), d) t WHERE t.code = c), 0) $$;
CREATE FUNCTION pg_temp.j(org int, d text, dr text, cr text, amt text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.ledger_post_journal(pg_temp.o(org), d::date, 'Test ' || d, 'test entry', jsonb_build_array(jsonb_build_object('account_code', dr, 'debit', amt),
    jsonb_build_object('account_code', cr, 'credit', amt))) $$;
GRANT EXECUTE ON FUNCTION pg_temp.who(int, text), pg_temp.o(int), pg_temp.u(int), pg_temp.acc(int, text), pg_temp.jl(uuid), pg_temp.descs(uuid), pg_temp.pv(jsonb),
  pg_temp.ye(int, date), pg_temp.lock(int), pg_temp.audits(text, int), pg_temp.entries(int), pg_temp.pl(int, text, date, date), pg_temp.bs(int, text, date),
  pg_temp.bs_ok(int, date), pg_temp.tb_ok(int, date), pg_temp.tb(int, text, date), pg_temp.j(int, text, text, text, text) TO PUBLIC;

SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(1), '2025-01-01', 'import', jsonb_build_array(jsonb_build_object('account_code', '1200', 'debit', '1000.00'),
  jsonb_build_object('account_code', '3000', 'credit', '1000.00')));
SELECT pg_temp.j(1, '2025-02-10', '1200', '4000', '180.00');
SELECT pg_temp.j(1, '2025-03-10', '8200', '1200', '120.50');
SELECT pg_temp.j(1, '2025-06-01', '1200', '4000', '300.00');
SELECT pg_temp.j(1, '2025-07-01', '7100', '1200', '400.00');
SELECT pg_temp.j(1, '2026-05-01', '1200', '4000', '50.00');
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(2), '2025-01-01', 'fresh', NULL);
SELECT public.ledger_add_account(pg_temp.o(2), '7150', 'Old costs', 'expense');
SELECT pg_temp.j(2, '2025-05-05', '7150', '1200', '25.00');
SELECT public.ledger_update_account(pg_temp.acc(2, '7150'), NULL, NULL, false);
RESET ROLE;
SELECT pg_temp.who(6); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(3), '2025-01-01', 'fresh', NULL);
RESET ROLE;
SELECT pg_temp.who(7); SET ROLE authenticated;
SELECT public.ledger_setup(pg_temp.o(4), '2025-01-01', 'fresh', NULL);
SELECT public.ledger_year_end_set(pg_temp.o(4), 12, 31);
RESET ROLE;

\echo '== shape'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) = 160, 'still 160 tables: no table added');
  PERFORM pg_temp.ok((SELECT string_agg(attname || ':' || format_type(atttypid, atttypmod) || ':' || attnotnull, ',' ORDER BY attname) FROM pg_attribute
    WHERE attrelid = 'public.ledger_settings'::regclass AND attname LIKE 'financial_year_end%' AND NOT attisdropped) = 'financial_year_end_day:smallint:false,financial_year_end_month:smallint:false',
    'two new nullable smallint columns on ledger_settings');
  PERFORM pg_temp.ok((SELECT pg_get_constraintdef(oid) LIKE '%bank_line%year_end%' FROM pg_constraint WHERE conname = 'je_source_type'), 'je_source_type allows year_end and keeps bank_line');
  PERFORM pg_temp.ok(EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.journal_entries'::regclass AND tgname = 'ledger_year_end_guard'), 'the year-end guard trigger is on journal_entries');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'ledger_year_end%' OR p.proname LIKE '\_ledger\_ye\_%' OR p.proname = '_ledger_year_end_entry_guard')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('service_role', p.oid, 'EXECUTE')
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c = 'search_path=""'))),
    'no year-end function for anon or service_role; every one with an empty search_path');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'ledger_year_end%' AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 5
    AND (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE '\_ledger\_ye\_%' OR p.proname = '_ledger_year_end_entry_guard')
           AND has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 0, 'the five RPCs for signed-in users; the six helpers for nobody');
  PERFORM pg_temp.ok((SELECT bool_and(prosecdef) FROM pg_proc WHERE proname LIKE 'ledger_year_end%') AND NOT (SELECT prosecdef FROM pg_proc WHERE proname = '_ledger_year_end_entry_guard'),
    'the RPCs are security definer; the trigger function is not');
END $$;

\echo '== year-end dates (29 February means the last day of February)'
DO $$ BEGIN
  PERFORM pg_temp.ok(public._ledger_ye_date(2027, 2, 29) = '2027-02-28' AND public._ledger_ye_date(2028, 2, 29) = '2028-02-29' AND public._ledger_ye_date(2100, 2, 29) = '2100-02-28'
    AND public._ledger_ye_date(2000, 2, 29) = '2000-02-29', '29 Feb: 28 Feb in 2027 and 2100, 29 Feb in 2028 and 2000');
  PERFORM pg_temp.ok(public._ledger_ye_first('2025-01-01', 3, 31) = '2025-03-31' AND public._ledger_ye_first('2025-03-31', 3, 31) = '2026-03-31'
    AND public._ledger_ye_first('2025-04-01', 3, 31) = '2026-03-31', 'first year end: the first one after the start date (three months; twelve; just under twelve)');
  PERFORM pg_temp.ok(public._ledger_ye_next('2025-01-01', NULL, 3, 31) = '2025-03-31' AND public._ledger_ye_next('2025-01-01', '2025-03-31', 3, 31) = '2026-03-31'
    AND public._ledger_ye_next('2025-01-01', '2025-02-15', 3, 31) = '2025-03-31' AND public._ledger_ye_next('2024-03-01', '2027-02-28', 2, 29) = '2028-02-29',
    'next year end: after the lock (a hand-set lock mid-year still closes that year end next)');
END $$;

\echo '== setting the year end'
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_year_end_status(pg_temp.o(1));
  PERFORM pg_temp.ok((r ->> 'set_up')::boolean AND r -> 'year_end_month' = 'null'::jsonb AND r -> 'next_year_end' = 'null'::jsonb AND jsonb_array_length(r -> 'closed_years') = 0,
    'no default: before it is set, status has no year end');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_preview(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_YEAR_END_NOT_SET', 'preview before it is set: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_YEAR_END_NOT_SET', 'close before it is set: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 2, 30)$q$, 'LEDGER_YEAR_END_BAD_DATE', '30 February: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 4, 31)$q$, 'LEDGER_YEAR_END_BAD_DATE', '31 April: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 13, 1)$q$, 'LEDGER_YEAR_END_BAD_DATE', 'month 13: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 1, 0)$q$, 'LEDGER_YEAR_END_BAD_DATE', 'day 0: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), NULL, 31)$q$, 'LEDGER_YEAR_END_BAD_DATE', 'no month: refused');
  r := public.ledger_year_end_set(pg_temp.o(1), 12, 31);
  PERFORM pg_temp.ok(r ->> 'result' = 'saved' AND r ->> 'first_year_end' = '2025-12-31', 'owner sets 31 December: saved, first year end 31/12/2025');
  r := public.ledger_year_end_set(pg_temp.o(1), 3, 31);
  PERFORM pg_temp.ok(r ->> 'result' = 'saved' AND r ->> 'first_year_end' = '2025-03-31', 'changed to 31 March while nothing is closed: first year end 31/03/2025 (a three-month first year)');
  r := public.ledger_year_end_set(pg_temp.o(1), 3, 31);
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.audits('ledger.year_end_set', 1) = 2, 'the same again: unchanged, no audit row (two rows for the two changes)');
  PERFORM pg_temp.ok((SELECT details ->> 'was_month' FROM public.audit_logs WHERE action = 'ledger.year_end_set' AND details ->> 'month' = '3') = '12', 'the audit row records the old and new date');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(2), 12, 31)$q$, 'LEDGER_NOT_MEMBER', 'isolation: owner 1 cannot set company B''s year end');
END $$;
RESET ROLE;
SELECT pg_temp.ok(pg_temp.audits('ledger.year_end_set', 1) = 2, 'after the refused cross-company call, still two audit rows');
SELECT pg_temp.who(2); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 6, 30)$q$, 'LEDGER_NOT_ADMIN', 'a plain member cannot set it');
SELECT pg_temp.ok((public.ledger_year_end_status(pg_temp.o(1)) ->> 'year_end_month')::int = 3 AND NOT (public.ledger_year_end_status(pg_temp.o(1)) ->> 'can_manage')::boolean,
  'a plain member reads the status (can_manage false)');
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 6, 30)$q$, 'LEDGER_DEMO', 'the demo admin cannot set it');
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 6, 30)$q$, 'MFA_REQUIRED', 'an admin with an authenticator app at aal1: step up first');
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_status(pg_temp.o(1))$q$, 'MFA_REQUIRED', '(and to read the status)');
RESET ROLE;
SELECT pg_temp.who(9); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_status(pg_temp.o(1))$q$, 'LEDGER_NOT_MEMBER', 'someone outside the company cannot read the status');
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_preview(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_NOT_MEMBER', 'nor the preview');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_status(pg_temp.o(1))$q$, 'permission denied', 'anon cannot call it at all');
RESET ROLE;

\echo '== preview the first year (profit 59.50)'
SELECT pg_temp.who(2); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_year_end_preview(pg_temp.o(1), '2025-03-31');
  PERFORM pg_temp.ok(pg_temp.pv(r) = '4000:180.00/0.00 8200:0.00/120.50 3200:0.00/59.50', 'a member previews: Sales debited 180.00, Other overheads credited 120.50, Retained earnings credited 59.50');
  PERFORM pg_temp.ok((r ->> 'profit')::numeric = 59.50 AND r ->> 'year_start' = '2025-01-01' AND r ->> 'lock_date' = '2025-03-31' AND r -> 'problem' = 'null'::jsonb
    AND NOT (r ->> 'needs_acknowledgement')::boolean AND NOT (r ->> 'can_manage')::boolean, 'profit 59.50, the year 01/01/2025–31/03/2025, nothing in the way');
  r := public.ledger_year_end_preview(pg_temp.o(1), '2026-03-31');
  PERFORM pg_temp.ok(r ->> 'problem' = 'out_of_order' AND r ->> 'year_start' = '2025-04-01', 'the second year: out of order until the first is closed');
  PERFORM pg_temp.ok(public.ledger_year_end_preview(pg_temp.o(1), '2027-03-31') ->> 'problem' = 'out_of_order', 'a future year end further on: out of order');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_preview(pg_temp.o(1), '2025-03-30')$q$, 'LEDGER_YEAR_END_BAD_DATE', 'a date that is not a year end: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_preview(pg_temp.o(1), '2024-03-31')$q$, 'LEDGER_YEAR_END_BAD_DATE', 'a year end before the books start: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_NOT_ADMIN', 'a plain member cannot close');
END $$;
RESET ROLE;
SELECT pg_temp.who(3); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_DEMO', 'the demo admin cannot close');
RESET ROLE;
SELECT pg_temp.who(4); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2025-03-31')$q$, 'MFA_REQUIRED', 'an admin at aal1 cannot close');
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_NOT_MEMBER', 'another company''s owner cannot close it');
RESET ROLE;
SELECT pg_temp.ok(pg_temp.lock(1) IS NULL AND pg_temp.audits('ledger.year_end_close', 1) = 0, 'the refused calls changed nothing');

\echo '== close the first year'
SELECT pg_temp.who(1); SET ROLE authenticated;
CREATE TEMP TABLE pv1 AS SELECT public.ledger_year_end_preview(pg_temp.o(1), '2025-03-31') AS p;
GRANT SELECT ON pv1 TO PUBLIC;
SELECT pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2026-03-31')$q$, 'LEDGER_YEAR_END_OUT_OF_ORDER', 'years close in order: the second first is refused');
DO $$ DECLARE r jsonb; e uuid; BEGIN
  r := public.ledger_year_end_close(pg_temp.o(1), '2025-03-31');
  e := (r ->> 'entry_id')::uuid;
  PERFORM pg_temp.ok(r ->> 'result' = 'closed' AND (r ->> 'profit')::numeric = 59.50 AND r ->> 'locked_through' = '2025-03-31', 'closed: profit 59.50, locked through 31/03/2025');
  PERFORM pg_temp.ok(pg_temp.jl(e) = (SELECT pg_temp.pv(p) FROM pv1), 'the journal is exactly what the preview showed');
  PERFORM pg_temp.ok((SELECT source_type = 'year_end' AND entry_date = '2025-03-31' AND reason = 'Year end close 2025' AND memo = 'Year end close: year ending 31/03/2025'
                        AND posted_by = pg_temp.u(1) FROM public.journal_entries WHERE id = e), 'one year_end journal dated 31/03/2025, reason "Year end close 2025", the memo names the year');
  PERFORM pg_temp.ok(pg_temp.descs(e) = 'Sales | Other overheads | Retained earnings', 'every line carries the account name');
  PERFORM pg_temp.ok(pg_temp.lock(1) = '2025-03-31' AND pg_temp.audits('ledger.year_end_close', 1) = 1, 'the lock moved to the year end; one audit row');
END $$;
DO $$ DECLARE r jsonb; n bigint := pg_temp.entries(1); BEGIN
  r := public.ledger_year_end_close(pg_temp.o(1), '2025-03-31', true);
  PERFORM pg_temp.ok(r ->> 'result' = 'unchanged' AND pg_temp.entries(1) = n AND pg_temp.audits('ledger.year_end_close', 1) = 1, 'closing it again: unchanged, no journal, no audit row');
END $$;

\echo '== reports after the close'
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.pl(1, '4000', '2025-01-01', '2025-03-31') = 180.00 AND pg_temp.pl(1, '8200', '2025-01-01', '2025-03-31') = 120.50,
    'profit and loss for the closed year keeps its real figures (180.00 and 120.50)');
  PERFORM pg_temp.ok(pg_temp.pl(1, '4000', '2025-01-01', '2026-03-31') = 480.00, 'and across the close: sales 480.00 (the close journal is not income)');
  PERFORM pg_temp.ok(pg_temp.bs(1, '3200', '2025-03-31') = 59.50 AND pg_temp.bs(1, 'PL', '2025-03-31') = 0 AND pg_temp.bs_ok(1, '2025-03-31'),
    'balance sheet at the year end: retained earnings 59.50, profit for the period 0, balanced');
  PERFORM pg_temp.ok(pg_temp.bs(1, '3200', '2025-06-30') = 59.50 AND pg_temp.bs(1, 'PL', '2025-06-30') = 300.00 AND pg_temp.bs_ok(1, '2025-06-30'),
    'three months later: retained earnings 59.50, profit for the period 300.00 (the open year only), balanced');
  PERFORM pg_temp.ok(pg_temp.bs(1, 'PL', '2025-03-01') = 180.00 AND pg_temp.bs(1, '3200', '2025-03-01') = 0, 'before the year end date: the year so far, nothing closed yet');
  PERFORM pg_temp.ok(pg_temp.tb_ok(1, '2025-03-31') AND pg_temp.tb(1, '4000', '2025-03-31') = 0 AND pg_temp.tb(1, '8200', '2025-03-31') = 0 AND pg_temp.tb(1, '3200', '2025-03-31') = -59.50,
    'the trial balance (unchanged) still balances: Sales and overheads at nil, retained earnings 59.50 credit');
END $$;

\echo '== the lock'
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT pg_temp.j(1, '2025-03-15', '1200', '4000', '1.00')$q$, 'LEDGER_PERIOD_LOCKED', 'a manual journal in the closed year: refused');
  PERFORM pg_temp.ok((pg_temp.j(1, '2025-04-01', '1200', '4900', '1.00') ->> 'entry_id') IS NOT NULL, 'the day after the year end: allowed');
  PERFORM pg_temp.fails($q$SELECT public.ledger_reverse_journal(pg_temp.ye(1, '2025-03-31'), 'undo the close')$q$, 'LEDGER_YEAR_END_REOPEN_ONLY', 'the close journal cannot be reversed from Journals');
  PERFORM pg_temp.fails($q$SELECT public.ledger_post_journal(pg_temp.o(1), '2025-05-01', 'x', 'test entry', '[]'::jsonb, 'year_end')$q$, 'LEDGER_BAD_SOURCE', 'nor posted as a manual journal');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(1), 12, 31)$q$, 'LEDGER_YEAR_END_FIXED', 'the year end cannot change once a year is closed');
  PERFORM pg_temp.ok(public.ledger_year_end_set(pg_temp.o(1), 3, 31) ->> 'result' = 'unchanged', '(the same date: unchanged)');
END $$;
RESET ROLE;
DO $$ BEGIN
  -- Even as the database owner (no RPC), the lock does not move back and a year_end journal is not written.
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = NULL WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_LOCK_BACKWARDS', 'directly: the lock does not move back');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = '2025-02-28' WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_LOCK_BACKWARDS', 'not even a little');
  PERFORM set_config('ledger.year_end_reopen', pg_temp.o(2)::text || ':2025-03-31:', true);
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = NULL WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_LOCK_BACKWARDS', 'the re-open flag for another company does not open it');
  PERFORM set_config('ledger.year_end_reopen', pg_temp.o(1)::text || ':2025-03-31:2025-01-31', true);
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = NULL WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_LOCK_BACKWARDS', 'nor a flag naming a different move');
  PERFORM set_config('ledger.year_end_reopen', '', true);
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET financial_year_end_month = 12 WHERE organization_id = pg_temp.o(1)$q$, 'LEDGER_YEAR_END_FIXED', 'directly: the year end does not change while locked');
  PERFORM pg_temp.fails($q$INSERT INTO public.journal_entries (organization_id, entry_date, memo, reason, source_type) VALUES (pg_temp.o(1), '2025-05-01', 'x', 'xxx', 'year_end')$q$,
    'LEDGER_YEAR_END_ONLY_BY_CLOSE', 'directly: a year_end journal is written only by the close');
  PERFORM pg_temp.ok(pg_temp.lock(1) = '2025-03-31', 'the lock is still 31/03/2025');
END $$;
DO $$ BEGIN
  UPDATE public.ledger_settings SET locked_through = '2025-04-02' WHERE organization_id = pg_temp.o(3);
  PERFORM pg_temp.ok(pg_temp.lock(3) = '2025-04-02', 'moving a lock forward still works as before (company C, hand-set to 02/04/2025)');
  PERFORM pg_temp.fails($q$UPDATE public.ledger_settings SET locked_through = NULL WHERE organization_id = pg_temp.o(3)$q$, 'LEDGER_LOCK_BACKWARDS', 'and back is still refused');
  RAISE EXCEPTION 'undo';
EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'undo' THEN RAISE; END IF;
END $$;
SELECT pg_temp.ok(pg_temp.lock(3) IS NULL, '(company C''s hand-set lock undone: that block was rolled back)');

\echo '== warnings and acknowledgement (second year: a loss)'
SELECT pg_temp.who(1); SET ROLE authenticated;
SELECT public.ledger_auto_set(pg_temp.o(1), true);
SELECT public.ledger_bank_account_save(pg_temp.o(1), NULL, 'Main');
SELECT public.ledger_bank_import(pg_temp.o(1), (SELECT id FROM public.ledger_bank_accounts WHERE organization_id = pg_temp.o(1)), 'y.csv',
  '[{"date": "2025-08-01", "description": "UNKNOWN", "amount_pence": -100}, {"date": "2026-04-02", "description": "NEXT YEAR", "amount_pence": -100}]'::jsonb);
RESET ROLE;
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'Z-0', 'sent', 0, 0, 0, 'GBP', '2025-09-01 12:00+00');
SELECT public.ledger_process_queue();
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES (pg_temp.u(1), pg_temp.o(1), 'W-1', 'sent', 10, 0, 10, 'GBP', '2025-10-01 12:00+00'),
       (pg_temp.u(1), pg_temp.o(1), 'W-2', 'sent', 10, 0, 10, 'GBP', '2026-05-01 12:00+00');
SELECT pg_temp.ok((SELECT count(*) FROM public.ledger_post_issues WHERE organization_id = pg_temp.o(1) AND resolved_at IS NULL) = 1
  AND (SELECT count(*) FROM public.ledger_post_queue WHERE organization_id = pg_temp.o(1)) = 2, 'setup: one held invoice (zero total), two waiting');
SELECT pg_temp.who(1); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_year_end_preview(pg_temp.o(1), '2026-03-31');
  PERFORM pg_temp.ok(r -> 'warnings' = '{"held": 1, "waiting": 1, "bank_unmatched": 1}'::jsonb AND (r ->> 'needs_acknowledgement')::boolean AND r -> 'problem' = 'null'::jsonb,
    'preview: one waiting, one held, one unmatched bank line in the year (the ones dated after it are not counted)');
  PERFORM pg_temp.ok(pg_temp.pv(r) = '4000:300.00/0.00 4900:1.00/0.00 7100:0.00/400.00 3200:99.00/0.00' AND (r ->> 'profit')::numeric = -99.00,
    'a loss: income debited, expense credited, retained earnings debited 99.00');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2026-03-31')$q$, 'LEDGER_YEAR_END_NEEDS_ACK', 'not acknowledged: refused');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2026-03-31', false)$q$, 'LEDGER_YEAR_END_NEEDS_ACK', '(explicitly false: refused)');
  PERFORM pg_temp.ok(pg_temp.lock(1) = '2025-03-31', 'nothing changed');
END $$;
CREATE TEMP TABLE pv2 AS SELECT public.ledger_year_end_preview(pg_temp.o(1), '2026-03-31') AS p;
DO $$ DECLARE r jsonb; e uuid; BEGIN
  r := public.ledger_year_end_close(pg_temp.o(1), '2026-03-31', true);
  e := (r ->> 'entry_id')::uuid;
  PERFORM pg_temp.ok(r ->> 'result' = 'closed' AND (r ->> 'profit')::numeric = -99.00 AND pg_temp.jl(e) = (SELECT pg_temp.pv(p) FROM pv2), 'acknowledged: closed, exactly as previewed (loss 99.00)');
  PERFORM pg_temp.ok((SELECT (details ->> 'acknowledged')::boolean AND details -> 'warnings' ->> 'bank_unmatched' = '1' FROM public.audit_logs WHERE action = 'ledger.year_end_close' AND details ->> 'year_end' = '2026-03-31'),
    'the audit row records the acknowledgement and the warnings');
  PERFORM pg_temp.ok(pg_temp.bs(1, '3200', '2026-03-31') = -39.50 AND pg_temp.bs(1, 'PL', '2026-03-31') = 0 AND pg_temp.bs(1, 'PL', '2026-06-30') = 50.00 AND pg_temp.bs_ok(1, '2026-06-30'),
    'balance sheet: retained earnings 59.50 − 99.00 = −39.50; profit for the period after it only the open year (50.00); balanced');
  PERFORM pg_temp.ok(pg_temp.pl(1, '7100', '2025-04-01', '2026-03-31') = 400.00 AND pg_temp.pl(1, '4000', '2025-04-01', '2026-03-31') = 300.00, 'P&L for the second year: real figures');
  r := public.ledger_year_end_status(pg_temp.o(1));
  PERFORM pg_temp.ok(jsonb_array_length(r -> 'closed_years') = 2 AND r -> 'closed_years' -> 0 ->> 'profit' = '59.50' AND r -> 'closed_years' -> 1 ->> 'profit' = '-99.00'
    AND r -> 'closed_years' -> 0 ->> 'year_start' = '2025-01-01' AND r ->> 'latest_closed' = '2026-03-31' AND r ->> 'next_year_end' = '2027-03-31'
    AND r ->> 'next_year_start' = '2026-04-01' AND NOT (r ->> 'can_close_now')::boolean AND (r ->> 'can_manage')::boolean, 'status: two closed years with their results; next 2027, not yet');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(1), '2027-03-31')$q$, 'LEDGER_YEAR_END_FUTURE', 'a year end in the future: refused');
  PERFORM pg_temp.ok(public.ledger_year_end_preview(pg_temp.o(1), '2027-03-31') ->> 'problem' = 'future', '(the preview says why)');
  PERFORM pg_temp.ok(public.ledger_year_end_preview(pg_temp.o(1), '2025-03-31') ->> 'problem' = 'already_closed', 'a closed year previews as already closed');
END $$;

\echo '== re-open'
DO $$ DECLARE r jsonb; e uuid := pg_temp.ye(1, '2026-03-31'); BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_reopen(pg_temp.o(1), '2025-03-31')$q$, 'LEDGER_YEAR_END_NOT_LATEST', 'only the most recent closed year re-opens');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_reopen(pg_temp.o(1), '2027-03-31')$q$, 'LEDGER_YEAR_END_NOT_CLOSED', 'a year that is not closed: refused');
  r := public.ledger_year_end_reopen(pg_temp.o(1), '2026-03-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'reopened' AND pg_temp.lock(1) = '2025-03-31' AND r ->> 'locked_through' = '2025-03-31', 're-opened: the lock is back at the previous year end');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.journal_entries WHERE reverses_entry_id = e) = 1
    AND (SELECT entry_date = '2026-03-31' AND source_type = 'reversal' AND reason = 'Year end re-opened 2026' FROM public.journal_entries WHERE id = (r ->> 'reversal_entry_id')::uuid)
    AND pg_temp.jl((r ->> 'reversal_entry_id')::uuid) = '4000:0.00/300.00 4900:0.00/1.00 7100:400.00/0.00 3200:0.00/99.00', 'the close is reversed once, on its own date, line for line');
  PERFORM pg_temp.ok(pg_temp.bs(1, '3200', '2026-03-31') = 59.50 AND pg_temp.bs(1, 'PL', '2026-03-31') = -99.00 AND pg_temp.bs_ok(1, '2026-03-31')
    AND pg_temp.pl(1, '4000', '2025-04-01', '2026-03-31') = 300.00 AND pg_temp.tb_ok(1, '2026-03-31'), 'reports are as before the close; still balanced');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.year_end_reopen', 1) = 1 AND jsonb_array_length(public.ledger_year_end_status(pg_temp.o(1)) -> 'closed_years') = 1, 'one audit row; one closed year left');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_reopen(pg_temp.o(1), '2026-03-31')$q$, 'LEDGER_YEAR_END_NOT_CLOSED', 'again: refused (it is open)');
  PERFORM pg_temp.fails(format('SELECT public.ledger_reverse_journal(%L, %L)', (r ->> 'reversal_entry_id'), 'reverse it back'), 'LEDGER_REVERSAL_OF_REVERSAL', 'the reversal cannot be reversed');
  PERFORM pg_temp.ok((pg_temp.j(1, '2025-12-01', '7500', '1200', '1.00') ->> 'entry_id') IS NOT NULL, 'a journal in the re-opened year: allowed');
  r := public.ledger_year_end_close(pg_temp.o(1), '2026-03-31', true);
  PERFORM pg_temp.ok(r ->> 'result' = 'closed' AND (r ->> 'profit')::numeric = -100.00 AND pg_temp.ye(1, '2026-03-31') = (r ->> 'entry_id')::uuid
    AND public.ledger_year_end_status(pg_temp.o(1)) -> 'closed_years' -> 1 ->> 'profit' = '-100.00', 'closed again with the new figures: the status shows the new close');
END $$;
RESET ROLE;
SELECT pg_temp.who(4, 'aal2'); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.ledger_year_end_reopen(pg_temp.o(1), '2026-03-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'reopened', 'an admin at aal2 re-opens');
  r := public.ledger_year_end_reopen(pg_temp.o(1), '2025-03-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'reopened' AND r -> 'locked_through' = 'null'::jsonb AND pg_temp.lock(1) IS NULL, 'then the first year: no lock at all');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.journal_entries y WHERE y.organization_id = pg_temp.o(1) AND y.source_type = 'year_end'
      AND (SELECT count(*) FROM public.journal_entries r WHERE r.reverses_entry_id = y.id) <> 1), 'every close journal is reversed exactly once');
  PERFORM pg_temp.ok(pg_temp.audits('ledger.year_end_reopen', 1) = 3 AND pg_temp.audits('ledger.year_end_close', 1) = 3, 'an audit row for each close and each re-open');
  PERFORM pg_temp.ok(public.ledger_year_end_set(pg_temp.o(1), 12, 31) ->> 'result' = 'saved', 'with nothing closed, the year end can change again');
  PERFORM pg_temp.ok((public.ledger_year_end_preview(pg_temp.o(1), '2025-12-31') ->> 'profit')::numeric = -40.50,
    'and the new first year (to 31/12/2025) previews from the real figures: 481.00 income − 521.50 spending = −40.50');
  PERFORM pg_temp.ok(pg_temp.tb_ok(1, '2026-11-01') AND pg_temp.bs_ok(1, '2026-11-01'), 'the trial balance and balance sheet still balance');
END $$;
RESET ROLE;

\echo '== a year with no activity; an inactive account; a closed company'
SELECT pg_temp.who(6); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM public.ledger_year_end_set(pg_temp.o(3), 12, 31);
  r := public.ledger_year_end_preview(pg_temp.o(3), '2025-12-31');
  PERFORM pg_temp.ok(r -> 'lines' = '[]'::jsonb AND (r ->> 'profit')::numeric = 0 AND r -> 'problem' = 'null'::jsonb, 'no activity: nothing to move');
  r := public.ledger_year_end_close(pg_temp.o(3), '2025-12-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'closed' AND r -> 'entry_id' = 'null'::jsonb AND pg_temp.entries(3) = 0 AND pg_temp.lock(3) = '2025-12-31'
    AND pg_temp.audits('ledger.year_end_close', 3) = 1, 'closed with no journal: only the lock moves (and an audit row)');
  PERFORM pg_temp.ok(public.ledger_year_end_status(pg_temp.o(3)) -> 'closed_years' -> 0 ->> 'profit' = '0.00', 'status lists it, result nil');
  PERFORM pg_temp.fails($q$SELECT pg_temp.j(3, '2025-06-01', '1200', '4000', '5.00')$q$, 'LEDGER_PERIOD_LOCKED', 'and it is locked');
  r := public.ledger_year_end_reopen(pg_temp.o(3), '2025-12-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'reopened' AND r -> 'reversal_entry_id' = 'null'::jsonb AND pg_temp.lock(3) IS NULL AND pg_temp.entries(3) = 0, 're-opened: nothing to reverse, no lock');
END $$;
RESET ROLE;
SELECT pg_temp.who(5); SET ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  PERFORM public.ledger_year_end_set(pg_temp.o(2), 12, 31);
  r := public.ledger_year_end_preview(pg_temp.o(2), '2025-12-31');
  PERFORM pg_temp.ok(r ->> 'problem' = 'inactive_account', 'an inactive expense account with a balance: the preview says so');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(2), '2025-12-31')$q$, 'LEDGER_YEAR_END_INACTIVE_ACCOUNT', 'and the close is refused');
  PERFORM public.ledger_update_account(pg_temp.acc(2, '7150'), NULL, NULL, true);
  r := public.ledger_year_end_close(pg_temp.o(2), '2025-12-31');
  PERFORM pg_temp.ok(r ->> 'result' = 'closed' AND pg_temp.jl((r ->> 'entry_id')::uuid) = '7150:0.00/25.00 3200:25.00/0.00', 'made active again: closed (loss 25.00)');
  PERFORM pg_temp.ok(pg_temp.lock(1) IS NULL AND pg_temp.lock(3) IS NULL, 'isolation: the other companies'' locks did not move');
END $$;
RESET ROLE;
SELECT public.data_rights_close_company(pg_temp.o(4), pg_temp.u(7), NULL, false);
SELECT pg_temp.who(7); SET ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_close(pg_temp.o(4), '2025-12-31')$q$, 'LEDGER_CLOSED', 'a closed company cannot close a year');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_status(pg_temp.o(4))$q$, 'LEDGER_CLOSED', 'nor read the status');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_reopen(pg_temp.o(4), '2025-12-31')$q$, 'LEDGER_CLOSED', 'nor re-open');
  PERFORM pg_temp.fails($q$SELECT public.ledger_year_end_set(pg_temp.o(4), 3, 31)$q$, 'LEDGER_CLOSED', 'nor set the year end');
END $$;
RESET ROLE;

ROLLBACK;
