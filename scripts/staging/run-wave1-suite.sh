#!/usr/bin/env bash
# Full Wave 1 tenant/security suite against a disposable local PostgreSQL cluster.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGHOST="${PGHOST:-/tmp/pgs2}"
PGPORT="${PGPORT:-55433}"
PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER

case "$PGHOST" in
  /*|localhost|127.0.0.1) ;;
  *) echo "REFUSING: staging suite requires a local socket or loopback host." >&2; exit 1 ;;
esac
if [[ "$PGHOST" != /* && "$PGPORT" == "5432" ]]; then
  echo "REFUSING: default PostgreSQL port is not allowed for this destructive staging rebuild." >&2
  exit 1
fi

PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1)
run_sql() { "${PSQL[@]}" -q -f "$ROOT/$1"; }

echo "==> Rebuilding disposable staging from the production schema baseline"
bash "$ROOT/scripts/staging/rebuild-from-baseline.sh"

echo "==> Applying Round 2 security remediation"
run_sql supabase/remediation/round2-2026-09.sql

echo "==> Seeding synthetic Company A/B data"
run_sql scripts/staging/10_seed_tenants.sql

echo "==> Installing the test harness and running baseline security/application tests"
run_sql scripts/staging/20_security_harness.sql
run_sql scripts/staging/30_security_tests.sql
run_sql scripts/staging/40_app_compat_tests.sql

echo "==> Seeding Wave 1 cases and applying Wave 1"
run_sql scripts/staging/50_wave1_seed.sql
run_sql supabase/remediation/organization-wave1-2026-09.sql
run_sql scripts/staging/60_wave1_tests.sql
run_sql scripts/staging/70_wave1_import_template_tests.sql
run_sql scripts/staging/80_wave1_reconciliation_tests.sql

read -r pass fail info other <<<"$("${PSQL[@]}" -At -F' ' -c "select count(*) filter (where verdict='PASS'), count(*) filter (where verdict='FAIL'), count(*) filter (where verdict='INFO'), count(*) filter (where verdict not in ('PASS','FAIL','INFO')) from sec.results;")"
printf 'TOTAL SECURITY CHECKS: %s PASS / %s FAIL / %s INFO\n' "$pass" "$fail" "$info"
if [[ "$fail" != "0" || "$other" != "0" ]]; then
  echo "FAILED: one or more staging assertions did not pass." >&2
  exit 1
fi
