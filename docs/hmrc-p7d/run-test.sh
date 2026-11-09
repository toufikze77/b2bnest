#!/usr/bin/env bash
# HMRC P7d tests on a DISPOSABLE local Postgres (port 55411, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p7d/run-test.sh
set -u
D=/tmp/hp7dpg; S=/tmp/hp7dsock; PORT=55411; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 8 Nov 2026: the earlier fixtures and every applied proposal up to HMRC P7b (HMRC P8 is not applied).
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh

echo "== production shape (9 Nov 2026, HMRC P0-P7b applied; P8 not applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'ca2f5c858ee858f9b3f7c14131e00b9f' and count(*) = 148
  then 'PASS|the 148 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = 'email_unsubscribe=c8a6dcd39ad367d1a066cb360ae78bad get_invitation_by_token=dc1a3743a222906f765a033a91600a35 has_role=dcfc17cfff0b246634d5df8bf8ceb915 is_admin_or_owner=4517a33cfa92147cc60eb2ee67d782ca is_project_member=a2e30ee2428aeba1406b277aa5a6e653 is_super_admin=246e360cf6b2ed74a7ff7c96cbbf2351 is_team_member=589fb0e6fc56c14233e66a8564809ac3 owns_team=178218309894c3bfab5c338a590d7fcd template_usage_counts=fe071921d118bb2cbd493903df316656 user_can_access_project=29b1466b2b98c3917924cc62ca3de023 user_is_organization_admin=c6dd628541413ec82565a6676a55a767 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388 user_is_organization_owner=589d2d261abc3f48dd2c617f7133a099 user_owns_project=61232e20a33aacf69e2039ab6fa0907f'
  then 'PASS|the 14 helper bodies = production' else 'FAIL|helper bodies: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('email_unsubscribe','get_invitation_by_token','has_role','is_admin_or_owner','is_project_member','is_super_admin','is_team_member','owns_team','template_usage_counts','user_can_access_project','user_is_organization_admin','user_is_organization_member','user_is_organization_owner','user_owns_project')"
$P -At -c "select case when bool_and(has_function_privilege('anon', p.oid, 'EXECUTE') and has_function_privilege('authenticated', p.oid, 'EXECUTE') and has_function_privilege('service_role', p.oid, 'EXECUTE'))
  then 'PASS|anon, authenticated and service_role can run all 14 (production as read)' else 'FAIL|grants' end from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('email_unsubscribe','get_invitation_by_token','has_role','is_admin_or_owner','is_project_member','is_super_admin','is_team_member','owns_team','template_usage_counts','user_can_access_project','user_is_organization_admin','user_is_organization_member','user_is_organization_owner','user_owns_project')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t7d;
CREATE FUNCTION t7d.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT indexrelid::regclass::text AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text AS v FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v
      FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE t7d.before AS SELECT t7d.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t7d TO PUBLIC;
SQL
same() { $P -At -c "select case when t7d.fingerprint() = (select fp from t7d.before) then 'PASS|$1' else 'FAIL|$1' end"; }

grants() { $P -At -c "select string_agg(g, ',' order by g) from (select p.oid::regprocedure::text || ':' || case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end || ':' || a.privilege_type as g from pg_proc p, aclexplode(p.proacl) a where p.pronamespace = 'public'::regnamespace and p.proname in ('is_project_member','is_team_member','owns_team','user_can_access_project','get_invitation_by_token')) s" 2>/dev/null; }
G0=$(grants)

echo "== apply, then rollback restores the exact grant list"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when not has_function_privilege('anon','public.owns_team(uuid,uuid)','EXECUTE') and has_function_privilege('authenticated','public.owns_team(uuid,uuid)','EXECUTE') then 'PASS|applied: anon refused, authenticated kept' else 'FAIL|applied state' end"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback"
[ "$(grants)" = "$G0" ] && echo "PASS|rollback: the five helpers' grants are exactly as before (owner, service_role, anon, authenticated)" || echo "FAIL|grant list differs after rollback"
same "rollback: functions (with grants), columns, constraints, indexes, triggers, grants, RLS and policies exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/rollback.sql 2>&1 | grep -q 'HMRC P7d is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'HMRC P7d already applied' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE POLICY zz_anon_uses_helper ON public.projects FOR SELECT TO anon USING (public.is_project_member(id, NULL))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'is_project_member.*used by an anon or public policy' && echo "PASS|a helper used by an anon policy is not revoked" || echo "FAIL|policy dependency"
$P -c "DROP POLICY zz_anon_uses_helper ON public.projects" >/dev/null
$P -c "CREATE VIEW public.zz_v AS SELECT public.owns_team(gen_random_uuid(), gen_random_uuid()) AS x" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'owns_team.*used by a view' && echo "PASS|a helper used by a view is not revoked" || echo "FAIL|view dependency"
$P -c "DROP VIEW public.zz_v" >/dev/null
$P -c "CREATE FUNCTION public.zz_invoker() RETURNS boolean LANGUAGE sql AS 'SELECT public.is_team_member(gen_random_uuid(), gen_random_uuid())'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'is_team_member.*SECURITY INVOKER' && echo "PASS|a helper called by an anon-runnable invoker function is not revoked" || echo "FAIL|invoker dependency"
$P -c "DROP FUNCTION public.zz_invoker()" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public.owns_team(_team_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT true'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'owns_team.*differs' && echo "PASS|a changed helper body is refused" || echo "FAIL|body drift"
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7d/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when has_function_privilege('anon','public.get_invitation_by_token(text)','EXECUTE') then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
