#!/usr/bin/env bash
# Finance phase 2 ledger tests on a DISPOSABLE local Postgres (port 55413, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/ledger/run-test.sh
set -u
D=/tmp/hledgerpg; S=/tmp/hledgersock; PORT=55413; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 8 Nov 2026: the earlier fixtures and every applied proposal up to HMRC P7b (HMRC P8, P7d and the hide switch need not be applied: they add no table).
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh

echo "== production shape (as read from the repository, 10 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'ca2f5c858ee858f9b3f7c14131e00b9f' and count(*) = 148
  then 'PASS|the 148 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = '_data_rights_close_org=b0c5e82fc596390a6275b53524947531 _data_rights_closed_company_guard=2ec2d8630e284aed65d010c61a442a53 _data_rights_company_tables=c4497fd5fa0245618d1168f9c19bffe1 _data_rights_gate_is_open=b22b22eda6bd86e8ff363a6a58bfe3a3 data_rights_delete_account=f46c70bbcc8b82f0c6a7dc26f9308446 demo_readonly_guard=087b5fe2695b95b8ba2ba6eb195ba995 hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65 mfa_ok=20516f2ec203220b3ac08d1230c7c306 require_aal2_if_enrolled=10b2ae7bd2f9a94ea20598f19b8aebf2 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388'
  then 'PASS|the helpers the ledger relies on = the repository bodies' else 'FAIL|helper bodies: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_data_rights_close_org','_data_rights_closed_company_guard','_data_rights_company_tables','_data_rights_gate_is_open','data_rights_delete_account','demo_readonly_guard','hmrc_manage_allowed','mfa_ok','require_aal2_if_enrolled','user_is_organization_member')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA tl;
CREATE FUNCTION tl.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT indexrelid::regclass::text AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text AS v FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v
      FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE tl.before AS SELECT tl.fingerprint() AS fp;
GRANT USAGE ON SCHEMA tl TO PUBLIC;
SQL
same() { $P -At -c "select case when tl.fingerprint() = (select fp from tl.before) then 'PASS|$1' else 'FAIL|$1' end"; }


echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/ledger/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: functions (data_rights_delete_account back to its P7b body), columns, constraints, indexes, triggers, grants, RLS and policies exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/ledger/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.journal_entries) = 0 and (select count(*) from public.ledger_settings) = 0 then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the four new tables" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== the balance rule at commit, for the database owner too (no posting function involved)"
$P -c "INSERT INTO auth.users (id, email) VALUES ('fb000000-0000-4000-8000-000000000001', 'z@example.test');
  INSERT INTO public.organizations (id, name, slug) VALUES ('0fb00000-0000-4000-8000-000000000001', 'Z', 'ledger-z');
  INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode) VALUES ('0fb00000-0000-4000-8000-000000000001', '2026-01-01', 'fresh');
  SELECT public.ledger_seed_chart('0fb00000-0000-4000-8000-000000000001');" >/dev/null
post() { $P -v ON_ERROR_STOP=1 2>&1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"fb000000-0000-4000-8000-000000000001","role":"service_role"}', true);
INSERT INTO public.journal_entries (id, organization_id, entry_date, memo, source_type, posted_by) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', '2026-02-01', 'direct', 'manual', 'fb000000-0000-4000-8000-000000000001');
SELECT set_config('ledger.posting_entry', '0fe00000-0000-4000-8000-000000000001', true);
$1
COMMIT;
SQL
}
acct() { echo "(SELECT id FROM public.ledger_accounts WHERE organization_id = '0fb00000-0000-4000-8000-000000000001' AND code = '$1')"; }
post "INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 1200), 1, 10);
INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, credit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 3000), 2, 9);" | grep -q 'LEDGER_UNBALANCED' && echo "PASS|commit refused: debits and credits differ" || echo "FAIL|unbalanced commit"
post "INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 1200), 1, 10);" | grep -q 'LEDGER_TOO_FEW_LINES' && echo "PASS|commit refused: one line" || echo "FAIL|one-line commit"
post "" | grep -q 'LEDGER_TOO_FEW_LINES' && echo "PASS|commit refused: no lines" || echo "FAIL|no-line commit"
post "INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 1200), 1, 10, 10);" | grep -q 'jl_amounts' && echo "PASS|a line with both sides violates jl_amounts" || echo "FAIL|both sides"
post "INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 1200), 1, -10);" | grep -q 'jl_amounts' && echo "PASS|a negative amount violates jl_amounts" || echo "FAIL|negative"
post "INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 1200), 1, 10);
INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, credit) VALUES ('0fe00000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', $(acct 3000), 2, 10);" | grep -q 'ERROR' && echo "FAIL|balanced commit" || echo "PASS|a balanced two-line journal commits"
$P -At -c "select case when (select count(*) from public.journal_lines where entry_id = '0fe00000-0000-4000-8000-000000000001') = 2 then 'PASS|and only the balanced one is stored' else 'FAIL|stored rows' end"
$P -c "TRUNCATE public.journal_lines" 2>&1 | grep -q 'LEDGER_APPEND_ONLY' && echo "PASS|TRUNCATE of journal lines is refused, even for the database owner" || echo "FAIL|truncate lines"
$P -c "TRUNCATE public.journal_entries CASCADE" 2>&1 | grep -q 'LEDGER_APPEND_ONLY' && echo "PASS|TRUNCATE of journals is refused" || echo "FAIL|truncate entries"
$P -v ON_ERROR_STOP=1 -f docs/ledger/rollback.sql 2>&1 | grep -q 'holds company records' && echo "PASS|rollback refused while the ledger holds records" || echo "FAIL|rollback with rows"
$P -At -c "select case when to_regclass('public.journal_entries') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE OR REPLACE FUNCTION public.hmrc_manage_allowed(p_company uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SET search_path TO '' AS 'SELECT ''ok''::text'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql 2>&1 | grep -q 'hmrc_manage_allowed.*differs' && echo "PASS|a changed plan helper is refused" || echo "FAIL|helper drift"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regclass('public.journal_entries') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
