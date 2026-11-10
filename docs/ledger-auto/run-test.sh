#!/usr/bin/env bash
# Finance phase 3a (automatic invoice postings) tests on a DISPOSABLE local Postgres (port 55414, unix socket only).
# Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-auto/run-test.sh
set -u
D=/tmp/hlautopg; S=/tmp/hlautosock; PORT=55414; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 10 Nov 2026: the phase 2 chain (docs/ledger/run-test.sh) plus docs/ledger/proposal.sql, applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (as read from the repository, 10 Nov 2026)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = '185ba338b34d22b6189306e30de56545' and count(*) = 152
  then 'PASS|the 152 tables in public = production (phase 2 applied)' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -At -c "select case when pg_get_constraintdef(oid) = 'CHECK ((source_type = ANY (ARRAY[''manual''::text, ''opening_balance''::text, ''reversal''::text])))'
  then 'PASS|je_source_type is the phase 2 CHECK' else 'FAIL|je_source_type' end from pg_constraint where conname = 'je_source_type'"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA tl;
CREATE FUNCTION tl.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || p.prosecdef::text || ':' ||
        coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') AS v FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text AS v
       FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname || ':' || pg_get_constraintdef(oid) AS v FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT indexrelid::regclass::text AS v FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname || ':' || t.tgfoid::regproc::text || ':' || t.tgtype::text AS v FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT c.relname || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text AS v FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r') s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT tablename || '.' || policyname || ':' || permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v
      FROM pg_policies WHERE schemaname = 'public') s)))
$f$;
CREATE TABLE tl.before AS SELECT tl.fingerprint() AS fp;
GRANT USAGE ON SCHEMA tl TO PUBLIC;
SQL
same() { $P -At -c "select case when tl.fingerprint() = (select fp from tl.before) then 'PASS|$1' else 'FAIL|$1' end"; }

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when pg_get_constraintdef(oid) like '%auto_invoice%auto_invoice_payment%' then 'PASS|je_source_type now allows the two automatic types' else 'FAIL|new CHECK' end from pg_constraint where conname = 'je_source_type'"
$P -At -c "select case when (select count(*) from pg_trigger where tgrelid = 'public.invoices'::regclass and not tgisinternal) = 6 then 'PASS|invoices: its five triggers plus ledger_auto_invoice' else 'FAIL|invoice triggers' end"
$P -At -c "select case when not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like '%ledger_auto%' or p.proname = 'ledger_process_queue')
  and not exists (select 1 from unnest(p.proconfig) c where c = 'search_path=\"\"')) then 'PASS|every new function sets search_path to empty' else 'FAIL|search_path' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-auto/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: functions, columns, constraints (je_source_type back to phase 2), indexes, triggers, grants, RLS and policies exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.ledger_postings) = 0 and (select count(*) from public.journal_entries) = 0 and (select count(*) from public.invoices) = 0
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the phase 2 suite still passes with phase 3a applied"
$P -v ON_ERROR_STOP=1 -f docs/ledger/test.sql 2>&1 | grep -cE 'PASS\|' | xargs -I{} sh -c '[ {} -ge 70 ] && echo "PASS|phase 2 test.sql: {} checks pass" || echo "FAIL|phase 2 test.sql only {} passes"'
$P -v ON_ERROR_STOP=1 -f docs/ledger/test.sql 2>&1 | grep -E 'FAIL\||ERROR' | head -3
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the four new tables" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql 2>&1 | grep -q 'already exist' && echo "PASS|second apply refused (already exists)" || echo "FAIL|second apply"

echo "== rollback refuses while automatic postings exist"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|posting setup"
INSERT INTO auth.users (id, email) VALUES ('fb000000-0000-4000-8000-000000000001', 'z@example.test');
INSERT INTO public.organizations (id, name, slug) VALUES ('0fb00000-0000-4000-8000-000000000001', 'Z', 'auto-z');
INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode) VALUES ('0fb00000-0000-4000-8000-000000000001', '2026-01-01', 'fresh');
SELECT public.ledger_seed_chart('0fb00000-0000-4000-8000-000000000001');
INSERT INTO public.invoices (id, user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, created_at)
VALUES ('0fc00000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', '0fb00000-0000-4000-8000-000000000001', 'Z-1', 'sent', 1, 0, 1, 'GBP', '2026-02-01');
SELECT public._ledger_auto_apply('0fb00000-0000-4000-8000-000000000001', '0fc00000-0000-4000-8000-000000000001');
SQL
$P -At -c "select case when (select count(*) from public.ledger_postings) = 1 then 'PASS|one automatic posting committed (balanced at commit)' else 'FAIL|posting' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/rollback.sql 2>&1 | grep -q 'holds automatic postings' && echo "PASS|rollback refused while automatic postings exist" || echo "FAIL|rollback with rows"
$P -At -c "select case when to_regclass('public.ledger_postings') is not null then 'PASS|refused rollback changed nothing' else 'FAIL|partial rollback' end"
$P -c "TRUNCATE public.ledger_postings" 2>&1 | grep -q 'LEDGER_APPEND_ONLY' && echo "PASS|TRUNCATE of posting history is refused" || echo "FAIL|truncate postings"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._ledger_rule(p_org uuid, p_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS 'SELECT ''ok''::text'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql 2>&1 | grep -q '_ledger_rule.*differs' && echo "PASS|a changed phase 2 helper is refused" || echo "FAIL|helper drift"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type; ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'reversal', 'opening_balance', 'other'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-auto/proposal.sql 2>&1 | grep -q 'je_source_type differs' && echo "PASS|a changed je_source_type is refused" || echo "FAIL|check drift"
$P -At -c "select case when to_regclass('public.ledger_postings') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
