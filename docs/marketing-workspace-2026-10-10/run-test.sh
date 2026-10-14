#!/usr/bin/env bash
# Builds a disposable local Postgres (port 55433) as an unprivileged user, runs test.sql, then deletes it.
set -u
D=/tmp/mktpg; S=/tmp/mktsock; rm -rf $D $S; mkdir -p $D $S; chown lovable $D $S
R="setpriv --reuid=1000 --regid=1000 --clear-groups"
$R initdb -U postgres -D $D >/dev/null && $R pg_ctl -D $D -o "-p 55433 -k $S" -l $S/log start >/dev/null && sleep 2
mkdir -p /tmp/mktrun/docs && rm -rf /tmp/mktrun/docs/marketing-workspace-2026-10-10 && cp -r docs/marketing-workspace-2026-10-10 /tmp/mktrun/docs/
(cd /tmp/mktrun && psql -h $S -p 55433 -U postgres -q -X -f docs/marketing-workspace-2026-10-10/test.sql)
$R pg_ctl -D $D stop >/dev/null; rm -rf $D $S /tmp/mktrun
