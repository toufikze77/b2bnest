#!/usr/bin/env bash
# Phase 32 tests on a DISPOSABLE local Postgres 16 (port 55320, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase32/run-test.sh
# Builds production's shape: Supabase shim + default privileges, the Phase 35 / 36 / 37 / 31 fixtures (mfa_ok, guard log,
# organisations and members, _access_state_for, the organisation helpers, verbatim) and docs/phase32/fixture.sql (the Rota).
set -u
D=/tmp/p32pg; S=/tmp/p32sock; PORT=55320; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/phase32/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the helpers are byte-identical to production (2 Nov 2026)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) =
  '_access_state_for=292e158f87569a1b7bdbe32e64da0a67 handle_updated_at=da5ac28a58c8b4bb30209bf0d3d7082c mfa_ok=20516f2ec203220b3ac08d1230c7c306 require_aal2_if_enrolled=10b2ae7bd2f9a94ea20598f19b8aebf2 user_is_organization_admin=c6dd628541413ec82565a6676a55a767 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388'
  then 'PASS|helper hashes = production' else 'FAIL|hashes: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('_access_state_for','handle_updated_at','mfa_ok','require_aal2_if_enrolled','user_is_organization_admin','user_is_organization_member')"

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/phase32/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== rollback refuses while companies have holiday data"
$P -v ON_ERROR_STOP=1 -f docs/phase32/rollback.sql 2>&1 | grep -q 'Companies have holiday data' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.rota_leave_requests') is not null and (select count(*) from public.rota_leave_requests) > 0 then 'PASS|nothing removed by the refused rollback' else 'FAIL|refused rollback changed something' end"

echo "== forced rollback restores the exact state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/phase32/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/phase32/proposal.sql 2>&1 | grep -q 'Phase 32 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== a drifted table is refused before anything changes"
PGOPTIONS='-c app.phase32_force=on' $P -v ON_ERROR_STOP=1 -f docs/phase32/rollback.sql >/dev/null 2>&1 || echo "FAIL|forced rollback before drift"
$P -c "CREATE POLICY drift ON public.rota_employees FOR SELECT TO authenticated USING (true)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase32/proposal.sql 2>&1 | grep -q 'policies differ from production' && echo "PASS|drifted policies refused" || echo "FAIL|drift"
$P -c "DROP POLICY drift ON public.rota_employees; CREATE OR REPLACE FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS \$\$ SELECT true \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/phase32/proposal.sql 2>&1 | grep -q 'a helper differs' && echo "PASS|a changed helper is refused" || echo "FAIL|helper drift"
$P -At -c "select case when to_regclass('public.rota_leave_requests') is null and to_regclass('public.phase32_backup') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
