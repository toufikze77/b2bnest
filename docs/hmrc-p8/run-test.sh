#!/usr/bin/env bash
# HMRC P8 tests on a DISPOSABLE local Postgres (port 55410, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p8/run-test.sh
set -u
D=/tmp/hp8pg; S=/tmp/hp8sock; PORT=55410; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 8 Nov 2026: the earlier fixtures and every applied proposal up to HMRC P7b.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh

echo "== production shape (8 Nov 2026, HMRC P0-P7b applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'ca2f5c858ee858f9b3f7c14131e00b9f' and count(*) = 148
  then 'PASS|the 148 tables in public = production' else 'FAIL|table set ' || md5(string_agg(relname, ',' order by relname)) || ' ' || count(*) end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when string_agg(p.proname || '=' || case when p.proname like '\\_hmrc%' then md5(regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')) else md5(p.prosrc) end, ' ' order by p.proname) = '_hmrc_audit_append_only=6ae1ac1cea7541ebb73882222b74ecd0 _hmrc_vat_submission_guard=1e72b1b1e464e1676757fa8fefb7261a hmrc_manage_allowed=9304f069f05402aab62d343b3626cd65 hmrc_take_obligations_slot=58c7d543191e1960d2e6bd01ca643b0b'
  then 'PASS|the functions P8 relies on = production' else 'FAIL|function sources: ' || string_agg(p.proname || '=' || case when p.proname like '\\_hmrc%' then md5(regexp_replace(p.prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')) else md5(p.prosrc) end, ' ' order by p.proname) end
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_hmrc_audit_append_only', '_hmrc_vat_submission_guard', 'hmrc_manage_allowed', 'hmrc_take_obligations_slot')"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t8;
CREATE FUNCTION t8.fingerprint() RETURNS text LANGUAGE sql AS $f$
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
CREATE TABLE t8.before AS SELECT t8.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t8 TO PUBLIC;
SQL
same() { $P -At -c "select case when t8.fingerprint() = (select fp from t8.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/rollback.sql >/dev/null 2>&1 || { echo "FAIL|empty rollback"; $P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: functions (with grants), columns, constraints, indexes, triggers, grants, RLS and policies exactly as before"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.hmrc_audit_log) = 0 then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes" || echo "FAIL|demo coverage"

echo "== a second apply is refused; rollback refuses while P8 rows exist, unless forced"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql 2>&1 | grep -q 'HMRC P8 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"
$P -c "SET ROLE service_role; SELECT public.hmrc_take_read_slot('0a800000-0000-4000-8000-000000000001'::uuid, NULL::uuid, 'sandbox', 'vat_payments')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/rollback.sql 2>&1 | grep -q 'HMRC P8 read row' && echo "PASS|rollback refused while read rows exist" || echo "FAIL|rollback not refused"
$P -At -c "select case when to_regprocedure('public.hmrc_take_read_slot(uuid,uuid,text,text,integer)') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
PGOPTIONS="-c app.hmrc_p8_force=on" $P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/rollback.sql >/dev/null 2>&1 && echo "PASS|forced rollback works" || echo "FAIL|forced rollback"
$P -At -c "select case when to_regprocedure('public.hmrc_take_read_slot(uuid,uuid,text,text,integer)') is null
  and (select count(*) from public.hmrc_audit_log where event = 'vat_payments_call') = 1
  and (select not convalidated from pg_constraint where conname = 'hal_event') then 'PASS|forced: function gone, history kept, old rule NOT VALID' else 'FAIL|forced rollback state' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._hmrc_audit_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS \$\$ BEGIN RETURN NEW; END \$\$" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql 2>&1 | grep -q '_hmrc_audit_append_only.*differs' && echo "PASS|a changed audit guard is refused" || echo "FAIL|function drift"
fresh
$P -c "ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event; ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event <> '')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql 2>&1 | grep -q 'event rule differs' && echo "PASS|a changed event rule is refused" || echo "FAIL|event rule drift"
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p8/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regprocedure('public.hmrc_take_read_slot(uuid,uuid,text,text,integer)') is null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
