#!/usr/bin/env bash
# Rebuild an ISOLATED LOCAL staging database from the schema-only baseline.
# NEVER run this against production. It refuses any non-local PGHOST.
set -euo pipefail

PGHOST="${PGHOST:-/tmp/pgs2}"
PGPORT="${PGPORT:-55433}"
PGDATA="${PGDATA:-/tmp/stg2}"
PGUSER="${PGUSER:-postgres}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

case "$PGHOST" in
  /*|localhost|127.0.0.1) ;;
  *) echo "REFUSING: PGHOST='$PGHOST' is not a local socket/loopback." >&2; exit 1 ;;
esac
if [ -n "${PGHOST##/*}" ] && [ "$PGPORT" = "5432" ]; then
  echo "REFUSING: default port on a network host looks like a real environment." >&2; exit 1
fi

echo "==> Fresh cluster at $PGDATA (socket $PGHOST:$PGPORT)"
pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
rm -rf "$PGDATA" "$PGHOST"; mkdir -p "$PGDATA" "$PGHOST"
initdb -D "$PGDATA" -U "$PGUSER" >/dev/null
pg_ctl -D "$PGDATA" -o "-k $PGHOST -p $PGPORT -c listen_addresses=" -l "$PGHOST/pg.log" start >/dev/null
for _ in $(seq 1 30); do psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done

echo "==> 1/2 Supabase-compatible prerequisites"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/staging/00_supabase_shim.sql" >/dev/null

echo "==> 2/2 Schema-only production baseline"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 \
  -f "$ROOT/supabase/baseline/production-schema-baseline-2026-09.sql" >/dev/null

echo "==> Parity summary"
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -At -F'|' -c "
select 'tables', count(*) from pg_tables where schemaname='public'
union all select 'columns', count(*) from information_schema.columns where table_schema='public'
union all select 'constraints', count(*) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and k.contype in ('p','u','c','f')
union all select 'indexes', count(*) from pg_indexes where schemaname='public'
union all select 'functions', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
union all select 'triggers', count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all select 'rls_tables', count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity
union all select 'policies', count(*) from pg_policies where schemaname in ('public','storage')
union all select 'buckets', count(*) from storage.buckets;"
echo "Done. Staging is schema-only and contains no data."
