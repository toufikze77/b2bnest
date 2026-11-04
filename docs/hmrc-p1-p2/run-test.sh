#!/usr/bin/env bash
# HMRC P1 + P2 tests on a DISPOSABLE local Postgres 16 (port 55402, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p1-p2/run-test.sh
set -u
D=/tmp/hp12pg; S=/tmp/hp12sock; PORT=55402; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
done

echo "== production shape (4 Nov 2026)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) =
  '_hmrc_audit_append_only=8f283e3f58f0d54343cff1e44a86a49e hmrc_audit_events=47b3d4d71f94b27c947a4f6e007bc182 hmrc_can_manage=1d40a67edbcea7a53e09f9acb986630f hmrc_connection_status=8d04b8c032d84f142acc0adf5bc59cb1 hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65'
  then 'PASS|function hashes = production' else 'FAIL|hashes: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('_hmrc_audit_append_only','hmrc_audit_events','hmrc_can_manage','hmrc_connection_status','hmrc_manage_allowed')"
$P -At -c "select case when pg_get_constraintdef(oid) = 'CHECK ((event = ANY (ARRAY[''connect_started''::text, ''connected''::text, ''refreshed''::text, ''refresh_failed''::text, ''disconnected''::text, ''refused''::text])))'
  then 'PASS|audit event rule = production' else 'FAIL|event rule' end from pg_constraint where conrelid = 'public.hmrc_audit_log'::regclass and conname = 'hal_event'"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t2;
CREATE FUNCTION t2.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(conname || ':' || pg_get_constraintdef(oid), ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.hmrc_audit_log'::regclass),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t2.before AS SELECT t2.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t2 TO PUBLIC;
SQL

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/proposal.sql >/dev/null 2>&1 || echo "FAIL|apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/rollback.sql >/dev/null 2>&1 || echo "FAIL|empty rollback"
$P -At -c "select case when t2.fingerprint() = (select fp from t2.before) then 'PASS|empty rollback: functions, privileges, audit constraints and guard log exactly as before' else 'FAIL|empty rollback not exact' end"

echo "== apply again and run the suite"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/proposal.sql 2>&1 | grep -q 'HMRC P1 + P2 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback with test-call rows: refused, then forced"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/rollback.sql 2>&1 | grep -q 'test-call row' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
PGOPTIONS='-c app.hmrc_p1_p2_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback"
$P -At -c "select case when to_regprocedure('public.hmrc_take_test_slot(uuid,uuid,text,text,integer)') is null
  and (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.hmrc_audit_log'::regclass and conname = 'hal_event') like 'CHECK ((event = ANY (ARRAY[''connect_started''::text, %''refused''::text]))) NOT VALID'
  and (select count(*) from public.hmrc_audit_log where event in ('test_call','test_result')) = 12
  then 'PASS|forced rollback: function gone, the old rule back (NOT VALID), the history kept' else 'FAIL|forced rollback' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/proposal.sql >/dev/null 2>&1 && echo "PASS|apply after a forced rollback works" || echo "FAIL|apply after forced rollback"

echo "== drift is refused before anything changes"
PGOPTIONS='-c app.hmrc_p1_p2_force=on' $P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback before drift"
$P -c "CREATE OR REPLACE FUNCTION public.hmrc_audit_events(p_company uuid, p_limit integer DEFAULT 50) RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'select ''[]''::json'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p1-p2/proposal.sql 2>&1 | grep -q 'hmrc_audit_events(uuid,integer) differs' && echo "PASS|a changed HMRC function is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regprocedure('public.hmrc_take_test_slot(uuid,uuid,text,text,integer)') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
