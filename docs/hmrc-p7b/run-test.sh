#!/usr/bin/env bash
# HMRC P7b tests on a DISPOSABLE local Postgres (port 55409, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p7b/run-test.sh
set -u
D=/tmp/hp7bpg; S=/tmp/hp7bsock; PORT=55409; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 9 Nov 2026: the earlier fixtures and every applied proposal up to HMRC P6, then P7b's fixture.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh

echo "== production shape (9 Nov 2026, HMRC P0-P6 applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = '8d3fe32d0d61218e3b079b9953c4c090' and count(*) = 147
  then 'PASS|the 147 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) = '_hmrc_audit_append_only=8f283e3f58f0d54343cff1e44a86a49e _hmrc_vat_submission_guard=9f0f119b78a033245b1ef8875e4a31d4 ai_credit_ledger_append_only=a54399ea2a9c9459257cfd3cacd02480 demo_readonly_guard=087b5fe2695b95b8ba2ba6eb195ba995 mfa_ok=20516f2ec203220b3ac08d1230c7c306'
  then 'PASS|the functions P7b relies on = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_hmrc_audit_append_only', '_hmrc_vat_submission_guard', 'ai_credit_ledger_append_only', 'demo_readonly_guard', 'mfa_ok')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t7;
CREATE FUNCTION t7.fingerprint() RETURNS text LANGUAGE sql AS $f$
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
CREATE TABLE t7.before AS SELECT t7.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t7 TO PUBLIC;
SQL
same() { $P -At -c "select case when t7.fingerprint() = (select fp from t7.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/rollback.sql >/dev/null 2>&1 || { echo "FAIL|empty rollback"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: functions (with grants), columns, constraints, indexes, triggers, grants, RLS and policies exactly as before (hmrc_integrations recreated empty)"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.data_rights_requests) = 0 and not exists (select 1 from public.organizations where closed_at is not null)
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the new tables" || echo "FAIL|demo coverage"

echo "== a second apply is refused; rollback refuses once a company is closed"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep -q 'HMRC P7b already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"
$P -c "INSERT INTO auth.users (id, email) VALUES ('f7000000-0000-4000-8000-0000000000aa', 'r@example.test');
  INSERT INTO public.organizations (id, name, slug) VALUES ('0d700000-0000-4000-8000-000000000001', 'R', 'r');
  INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ('0d700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000aa', 'owner', true);
  SELECT public.data_rights_close_company('0d700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000aa', NULL, false)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/rollback.sql 2>&1 | grep -q 'a company is closed' && echo "PASS|rollback refused while a company is closed (no force switch)" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regclass('public.data_rights_requests') is not null and to_regclass('public.hmrc_integrations') is null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "INSERT INTO auth.users (id, email) VALUES ('f7000000-0000-4000-8000-0000000000bb', 'x@example.test');
  INSERT INTO public.hmrc_integrations (user_id, access_token) VALUES ('f7000000-0000-4000-8000-0000000000bb', 'plain')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep -q 'hmrc_integrations is not empty' && echo "PASS|a non-empty hmrc_integrations is not dropped" || echo "FAIL|non-empty legacy table"
$P -c "DELETE FROM public.hmrc_integrations" >/dev/null
$P -c "CREATE VIEW public.zz_uses_legacy AS SELECT id FROM public.hmrc_integrations" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep -q 'a view uses hmrc_integrations' && echo "PASS|a view on the legacy table is refused" || echo "FAIL|view dependency"
$P -c "DROP VIEW public.zz_uses_legacy" >/dev/null
$P -c "CREATE OR REPLACE FUNCTION public._hmrc_audit_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS \$\$ BEGIN RETURN NEW; END \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep -q '_hmrc_audit_append_only.*differs' && echo "PASS|a changed audit guard is refused" || echo "FAIL|function drift"
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p7b/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regclass('public.data_rights_requests') is null and to_regclass('public.hmrc_integrations') is not null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
