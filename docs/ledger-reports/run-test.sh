#!/usr/bin/env bash
# Finance phase 4 (ledger reports) tests on a DISPOSABLE local Postgres (port 55417, unix socket
# only). Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-reports/run-test.sh
set -u
D=/tmp/hlreppg; S=/tmp/hlrepsock; PORT=55417; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 16 Nov 2026: the phase 3b chain (docs/ledger-auto-bills/run-test.sh) plus phase 3b, its two
  # follow-ups (#103 category map, #104 VAT registered) and phase 3c-1 (docs/ledger-bank), applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql \
           docs/ledger-auto-bills/proposal.sql docs/ledger-auto-bills/followup-categories.sql docs/ledger-auto-bills/vat-registered.sql docs/ledger-bank/fixture.sql \
           docs/ledger-bank/proposal.sql docs/ledger-reports/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (16 Nov 2026: phases 2, 3a, 3b with its two follow-ups, and 3c-1 applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'b9fec97b9d0d8c836c6af78125e92371' and count(*) = 160
  then 'PASS|the 160 tables in public = production (md5 of the sorted names joined with commas)' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"

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
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgtype::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
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
# Everything except the new report functions: every other function body and grant, and every table, column, constraint,
# index, trigger, grant and policy (the fingerprint above, with the four new functions left out).
other() { $P -At -c "select md5(string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, ''))) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname not like 'ledger_report_%'"; }
catalog() { $P -At -c "select md5(concat_ws('|',
  (select string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)) from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped where c.relnamespace = 'public'::regnamespace),
  (select string_agg(conrelid::regclass::text || conname || pg_get_constraintdef(oid), ',' order by conrelid::regclass::text || conname || pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace),
  (select string_agg(tgrelid::regclass::text || tgname, ',' order by tgrelid::regclass::text || tgname) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not tgisinternal),
  (select string_agg(tablename || policyname || coalesce(qual, '') || coalesce(with_check, ''), ',' order by tablename || policyname || coalesce(qual, '') || coalesce(with_check, '')) from pg_policies where schemaname = 'public'),
  (select string_agg(relname || coalesce(relacl::text, '') || relrowsecurity::text, ',' order by relname || coalesce(relacl::text, '') || relrowsecurity::text) from pg_class where relnamespace = 'public'::regnamespace)))"; }
o1=$(other); c1=$(catalog)

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql 2>&1 | grep ERROR | head -3; }
[ "$(other)" = "$o1" ] && echo "PASS|no existing function changed (every other body and grant identical)" || echo "FAIL|an existing function changed"
[ "$(catalog)" = "$c1" ] && echo "PASS|no table, column, constraint, index, trigger, policy or table grant changed" || echo "FAIL|catalog changed"
$P -At -c "select case when count(*) = 160 then 'PASS|still 160 tables' else 'FAIL|tables ' || count(*) end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-reports/rollback.sql 2>&1 | grep ERROR | head -3; }
same "rollback drops only the four new functions: everything else exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/rollback.sql 2>&1 | grep -q 'are not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.journal_entries) = 0 and (select count(*) from public.ledger_bank_lines) = 0
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the earlier ledger suites still pass with phase 4 applied"
for t in docs/ledger-bank/test.sql docs/ledger-auto/test.sql docs/ledger/test.sql; do
  n=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'FAIL\||ERROR')
  [ "$f" = 0 ] && [ "$n" -ge 70 ] && echo "PASS|$t: $n checks pass" || { echo "FAIL|$t ($n pass, $f fail)"; $P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -E 'FAIL\||ERROR' | head -3; }
done
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql 2>&1 | grep -q 'already exist' && echo "PASS|second apply refused (already exist)" || echo "FAIL|second apply"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._ledger_rule(p_org uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT ''ok''::text'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql 2>&1 | grep -q '_ledger_rule.*differs' && echo "PASS|a changed guarded function is refused" || echo "FAIL|function drift"
fresh
$P -c "ALTER TABLE public.journal_lines ALTER COLUMN description TYPE varchar(200)" >/dev/null 2>&1
$P -v ON_ERROR_STOP=1 -f docs/ledger-reports/proposal.sql 2>&1 | grep -q 'columns differ' && echo "PASS|a changed column type is refused" || echo "FAIL|column drift"
$P -At -c "select case when to_regprocedure('public.ledger_report_profit_loss(uuid,date,date)') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
