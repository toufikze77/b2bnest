#!/usr/bin/env bash
# Disposable local Postgres (port 55435). Never touches production. Prelude reuses the support harness fixture.
set -u
D=/tmp/onbpg; S=/tmp/onbsock; rm -rf $D $S /tmp/onbrun; mkdir -p $D $S /tmp/onbrun/docs; chown lovable $D $S /tmp/onbrun
R="setpriv --reuid=1000 --regid=1000 --clear-groups"
$R initdb -U postgres -D $D >/dev/null && $R pg_ctl -D $D -o "-p 55435 -k $S" -l $S/log start >/dev/null && sleep 2
cp -r docs/support-ticketing-2026-10-15 docs/onboarding-2026-10-15 /tmp/onbrun/docs/
sed -n '1,57p' docs/support-ticketing-2026-10-15/test.sql > /tmp/onbrun/prelude.sql
sed 's/^COMMIT;$/SELECT 1\/0; -- injected failure\nCOMMIT;/' docs/onboarding-2026-10-15/proposal.sql > /tmp/onbrun/proposal_fail.sql
cd /tmp/onbrun
psql -h $S -p 55435 -U postgres -q -X -f docs/onboarding-2026-10-15/test.sql -P pager=off -A -t 2>&1 | grep -vE "^(SET|$)" | tail -120
cd /; $R pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/onbrun
