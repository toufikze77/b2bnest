#!/usr/bin/env bash
# Phase 36 tests on a DISPOSABLE local Postgres 16 (port 55480, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase36/run-test.sh
# Builds on Phase 35 exactly as production is: the Supabase shim, Supabase's default privileges, the Phase 35 fixture
# (production function bodies, hash-checked) and docs/phase35/proposal.sql; then docs/phase36/fixture.sql and test.sql.
set -u
D=/tmp/p36pg; S=/tmp/p36sock; PORT=55480; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
$P -v ON_ERROR_STOP=1 -f docs/phase35/fixture.sql >/dev/null || echo "FAIL|phase35 fixture"
$P -v ON_ERROR_STOP=1 -f docs/phase35/proposal.sql >/dev/null || echo "FAIL|phase35 proposal"
$P -v ON_ERROR_STOP=1 -f docs/phase36/fixture.sql >/dev/null || echo "FAIL|phase36 fixture"

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase36/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase36/proposal.sql 2>&1 | grep -q 'Phase 36 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
