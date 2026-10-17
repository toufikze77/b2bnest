#!/usr/bin/env bash
# Disposable local Postgres (port 55436) for proposal.sql + rollback.sql. Never touches production.
# Run from the repository root: bash docs/phase4b-document-email/run-test.sh
set -u
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}; PATH=$BIN:$PATH
D=/tmp/p4bpg; S=/tmp/p4bsock; R=/tmp/p4b-run; U=${PG_RUN_USER:-postgres}
rm -rf $D $S $R; mkdir -p $D $S $R/docs; chown $U $D $S $R
AS="setpriv --reuid=$U --regid=$(id -gn $U) --clear-groups"
$AS initdb -U postgres -D $D >/dev/null && $AS pg_ctl -D $D -o "-p 55436 -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/phase4b-document-email $R/docs/
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' docs/phase4b-document-email/proposal.sql > $R/proposal_fail.sql
cd $R
psql -h $S -p 55436 -U postgres -q -X -f docs/phase4b-document-email/test.sql -P pager=off -A -t 2>&1 | grep -vE "^(SET|$)"
cd /; $AS pg_ctl -D $D stop >/dev/null; rm -rf $D $S $R
