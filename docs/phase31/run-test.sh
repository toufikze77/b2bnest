#!/usr/bin/env bash
# Phase 31 tests on a DISPOSABLE local Postgres 16 (port 55310, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase31/run-test.sh
# Builds production's shape: Supabase shim + default privileges, the Phase 35 / 36 / 37 fixtures (mfa_ok, guard log,
# organisations, _access_state_for, verbatim) and docs/phase31/fixture.sql (project_time_entries as production).
set -u
D=/tmp/p31pg; S=/tmp/p31sock; PORT=55310; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the helpers are byte-identical to production (2 Nov 2026)"
$P -At -c "select case when md5(prosrc) = '292e158f87569a1b7bdbe32e64da0a67' then 'PASS|_access_state_for = production' else 'FAIL|_access_state_for ' || md5(prosrc) end from pg_proc where oid = 'public._access_state_for(uuid)'::regprocedure"
$P -At -c "select case when md5(prosrc) = '20516f2ec203220b3ac08d1230c7c306' then 'PASS|mfa_ok = production' else 'FAIL|mfa_ok ' || md5(prosrc) end from pg_proc where oid = 'public.mfa_ok()'::regprocedure"

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase31/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== rollback refuses while customers have time entries"
$P -v ON_ERROR_STOP=1 -f docs/phase31/rollback.sql 2>&1 | grep -q 'Customers have time entries' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.time_tracker_settings') is not null and (select count(*) from public.project_time_entries) > 0 then 'PASS|nothing removed by the refused rollback' else 'FAIL|refused rollback changed something' end"

echo "== forced rollback restores the exact state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/phase31/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase31/proposal.sql 2>&1 | grep -q 'Phase 31 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== a drifted table is refused before anything changes"
PGOPTIONS='-c app.phase31_force=on' $P -v ON_ERROR_STOP=1 -f docs/phase31/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback before drift"
$P -c "CREATE POLICY drift ON public.project_time_entries FOR SELECT TO authenticated USING (true)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase31/proposal.sql 2>&1 | grep -q 'policies differ from production' && echo "PASS|drifted policies refused" || echo "FAIL|drift"
$P -At -c "select case when to_regclass('public.time_tracker_settings') is null and to_regclass('public.phase31_backup') is null then 'PASS|nothing applied after the refusal' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
