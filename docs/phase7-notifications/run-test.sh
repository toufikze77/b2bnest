#!/usr/bin/env bash
# Disposable local Postgres (port 55437) for proposal.sql, test.sql and rollback.sql. Never touches production.
# Run from the repository root: bash docs/phase7-notifications/run-test.sh
set -u
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}; PATH=$BIN:$PATH
D=/tmp/p7pg; S=/tmp/p7sock; R=/tmp/p7-run; U=${PG_RUN_USER:-postgres}; P=55437
rm -rf $D $S $R; mkdir -p $D $S $R; chown $U $D $S $R
AS="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
$AS initdb -U postgres -D $D >/dev/null && $AS pg_ctl -D $D -o "-p $P -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/phase7-notifications/. $R/
cd $R
Q="psql -h $S -p $P -U postgres -X -q -v ON_ERROR_STOP=1"
step() { printf '%-72s' "$1"; shift; if out=$("$@" 2>&1); then echo OK; else echo FAILED; echo "$out"; fi; }
val() { $Q -A -t -c "$1"; }
dump() { pg_dump -h $S -p $P -U postgres -s -x --no-owner postgres | grep -vE '^(--|$|SET |SELECT pg_catalog|.(un)?restrict )' > "$1"; }

step "Load the local fixture (production-like tables, roles, RLS)" $Q -f fixture.sql
dump before.schema
step "Apply proposal.sql" $Q -f proposal.sql
step "Apply proposal.sql a second time (idempotent)" $Q -f proposal.sql
dump after1.schema
step "Apply proposal.sql a third time (idempotent)" $Q -f proposal.sql
dump after2.schema
echo "Schema identical after 2nd and 3rd apply: $(cmp -s after1.schema after2.schema && echo yes || echo NO)"
echo "Existing notifications untouched (expect 2|info,welcome): $(val "SELECT count(*) || '|' || string_agg(type, ',' ORDER BY type) FROM notifications WHERE link IS NULL AND dedupe_key IS NULL")"
echo "--- test.sql ---"
$Q -f test.sql 2>&1 | sed -E 's/^psql:test.sql:[0-9]+: (WARNING:  notify_invoice_paid skipped)/(expected, from the swallow test) \1/'
echo "--- after test.sql ---"
echo "Test fixtures rolled back (expect 0): $(val "SELECT count(*) FROM auth.users WHERE email LIKE 'phase7-%'") users, $(val "SELECT count(*) FROM notifications WHERE dedupe_key IS NOT NULL") feature notifications"
echo "Swallowed trigger error was logged as a WARNING: $(grep -c 'WARNING:  notify_invoice_paid skipped' $S/log 2>/dev/null || echo 0) time(s) in the server log"
step "Run test.sql a second time" bash -c "$Q -f test.sql | grep -q 'SUMMARY | .* 0 failed'"
step "Apply rollback.sql" $Q -f rollback.sql
step "Apply rollback.sql a second time (idempotent)" $Q -f rollback.sql
dump rolledback.schema
echo "Schema after rollback identical to before the proposal: $(cmp -s before.schema rolledback.schema && echo yes || { echo NO; diff before.schema rolledback.schema | head -20; })"
echo "Existing notifications still there after rollback (expect 2): $(val "SELECT count(*) FROM notifications")"
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' proposal.sql > proposal_fail.sql
printf '%-72s' "A proposal that fails half-way leaves nothing behind"; $Q -f proposal_fail.sql >/dev/null 2>&1
dump failed.schema; cmp -s before.schema failed.schema && echo OK || echo FAILED
step "Re-apply proposal.sql after rollback" $Q -f proposal.sql
step "test.sql passes again after rollback + re-apply" bash -c "$Q -f test.sql | grep -q 'SUMMARY | .* 0 failed'"
cd /; $AS pg_ctl -D $D stop >/dev/null; rm -rf $D $S $R
