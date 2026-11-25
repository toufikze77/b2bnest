#!/usr/bin/env bash
# Google Calendar sync (calendar_event_links) tests on a DISPOSABLE local Postgres (port 55420, unix socket
# only). Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/google-calendar-sync/run-test.sh
set -u
D=/tmp/hgcpg; S=/tmp/hgcsock; PORT=55420; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 22 Nov 2026: the phase 3b chain (docs/ledger-auto-bills/run-test.sh) plus phase 3b, its two
  # follow-ups (#103 category map, #104 VAT registered) phase 3c-1 (docs/ledger-bank), phase 4 (docs/ledger-reports) and 3c-2 (docs/ledger-bank-post), applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql \
           docs/ledger-auto-bills/proposal.sql docs/ledger-auto-bills/followup-categories.sql docs/ledger-auto-bills/vat-registered.sql docs/ledger-bank/fixture.sql \
           docs/ledger-bank/proposal.sql docs/ledger-reports/fixture.sql \
           docs/ledger-reports/proposal.sql docs/ledger-bank-post/fixture.sql \
           docs/ledger-bank-post/proposal.sql docs/google-calendar-sync/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (25 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'b9fec97b9d0d8c836c6af78125e92371' and count(*) = 160
  then 'PASS|the 160 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
fp() { $P -At -c "select md5(concat_ws('|',
  (select string_agg(v, ',' order by v) from (select p.oid::regprocedure::text || md5(p.prosrc) || coalesce(p.proacl::text, '') as v from pg_proc p where p.pronamespace = 'public'::regnamespace) s),
  (select string_agg(v, ',' order by v) from (select conrelid::regclass::text || conname || pg_get_constraintdef(oid) as v from pg_constraint where connamespace = 'public'::regnamespace) s),
  (select string_agg(v, ',' order by v) from (select c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) as v from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped where c.relnamespace = 'public'::regnamespace) s),
  (select string_agg(v, ',' order by v) from (select tgrelid::regclass::text || tgname || tgfoid::regproc::text as v from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not tgisinternal) s),
  (select string_agg(v, ',' order by v) from (select tablename || policyname || coalesce(qual, '') || coalesce(with_check, '') as v from pg_policies where schemaname = 'public') s),
  (select string_agg(v, ',' order by v) from (select relname || coalesce(relacl::text, '') || relrowsecurity::text as v from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r') s)))"; }
others() { $P -At -c "select md5(concat_ws('|',
  (select string_agg(v, ',' order by v) from (select p.oid::regprocedure::text || md5(p.prosrc) || coalesce(p.proacl::text, '') as v from pg_proc p where p.pronamespace = 'public'::regnamespace) s),
  (select string_agg(v, ',' order by v) from (select conrelid::regclass::text || conname || pg_get_constraintdef(oid) as v from pg_constraint where connamespace = 'public'::regnamespace and conrelid <> coalesce(to_regclass('public.calendar_event_links'), 0)) s),
  (select string_agg(v, ',' order by v) from (select c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) as v from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped where c.relnamespace = 'public'::regnamespace and c.relname not like 'calendar_event_links%') s),
  (select string_agg(v, ',' order by v) from (select tgrelid::regclass::text || tgname || tgfoid::regproc::text as v from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not tgisinternal and c.relname <> 'calendar_event_links') s),
  (select string_agg(v, ',' order by v) from (select tablename || policyname || coalesce(qual, '') || coalesce(with_check, '') as v from pg_policies where schemaname = 'public') s),
  (select string_agg(v, ',' order by v) from (select relname || coalesce(relacl::text, '') || relrowsecurity::text as v from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname <> 'calendar_event_links') s)))"; }
f0=$(fp); o0=$(others)

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/proposal.sql 2>&1 | grep ERROR | head -3; }
[ "$(others)" = "$o0" ] && echo "PASS|nothing else changed: functions, other constraints, columns, triggers, policies, grants and RLS identical" || echo "FAIL|something else changed"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the new table" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|second apply refused (already exists)" || echo "FAIL|second apply"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/rollback.sql >/dev/null 2>&1 || echo "FAIL|rollback"
[ "$(fp)" = "$f0" ] && echo "PASS|empty rollback: exactly as before" || echo "FAIL|rollback left something"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/rollback.sql 2>&1 | grep -q 'does not exist' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.calendar_event_links) = 0 then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== a rollback with links in place drops them (they are a cache) and touches nothing else"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|links setup"
INSERT INTO auth.users (id, email) VALUES ('ca100000-0000-4000-8000-000000000009', 'c9@example.test');
INSERT INTO public.todos (id, user_id, title, status, priority, due_date) VALUES ('ca200000-0000-4000-8000-000000000009', 'ca100000-0000-4000-8000-000000000009', 'T', 'todo', 'low', '2026-12-09');
INSERT INTO public.calendar_event_links (user_id, task_id, external_event_id, content_hash) VALUES ('ca100000-0000-4000-8000-000000000009', 'ca200000-0000-4000-8000-000000000009', 'e', 'h');
SQL
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/rollback.sql >/dev/null 2>&1 && [ "$(others)" = "$o0" ] && $P -At -c "select case when (select count(*) from public.todos where id = 'ca200000-0000-4000-8000-000000000009') = 1 then 'PASS|rollback with links: table gone, the task kept' else 'FAIL|task' end" || echo "FAIL|rollback with links"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/google-calendar-sync/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
$P -At -c "select case when to_regclass('public.calendar_event_links') is null then 'PASS|nothing was applied by the refused run' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
