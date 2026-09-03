#!/usr/bin/env bash
# B2BNest — build an ISOLATED local staging database for tenant-security testing.
#
# SAFETY: this script only ever talks to a local PostgreSQL cluster started by
# itself (unix socket, port 55432). It contains no production connection string,
# no production keys and never reads production data.
#
# Usage: bash scripts/staging/build-staging.sh
set -uo pipefail

PGDATA=${PGDATA:-/tmp/stagingpg}
SOCK=${SOCK:-/tmp/pgsock}
PORT=${PORT:-55432}
PSQL="psql -h $SOCK -p $PORT -U postgres"

# --- guard: refuse to run against anything that is not the local cluster ------
if [ -n "${PGHOST:-}" ] && [ "${PGHOST}" != "$SOCK" ]; then
  echo "BLOCKED — PGHOST points at a non-local database ($PGHOST). Refusing to run."
  exit 1
fi

pg_ctl -D "$PGDATA" -o "-p $PORT -k $SOCK" -l "$SOCK/pg.log" status >/dev/null 2>&1 || {
  rm -rf "$PGDATA"; mkdir -p "$PGDATA" "$SOCK"
  initdb -U postgres -D "$PGDATA" >/dev/null
  pg_ctl -D "$PGDATA" -o "-p $PORT -k $SOCK" -l "$SOCK/pg.log" start
  sleep 2
}

# --- Supabase-compatible base layer (auth/storage/vault shims, roles) --------
$PSQL -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/00_supabase_shim.sql" || exit 1

# --- replay repository migrations in chronological order ---------------------
log=$(dirname "$0")/migration-replay.log
: > "$log"
ok=0; fail=0
for f in supabase/migrations/*.sql; do
  out=$($PSQL -v ON_ERROR_STOP=1 --single-transaction -q -f "$f" 2>&1)
  if [ $? -eq 0 ]; then ok=$((ok+1)); else
    fail=$((fail+1)); { echo "=== FAIL $f"; echo "$out" | grep -m3 ERROR; } >> "$log"
  fi
done
echo "migrations applied: $ok   failed: $fail  (details: $log)"
[ "$fail" -gt 0 ] && echo "SCHEMA DRIFT — repository migrations cannot rebuild the production schema."
exit 0
