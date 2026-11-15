#!/usr/bin/env bash
# Finance phase 3c-1 (bank statement import and matching) tests on a DISPOSABLE local Postgres (port 55416, unix socket
# only). Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-bank/run-test.sh
set -u
D=/tmp/hlbankpg; S=/tmp/hlbanksock; PORT=55416; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 15 Nov 2026: the phase 3b chain (docs/ledger-auto-bills/run-test.sh) plus phase 3b, its two
  # follow-ups (#103 category map, #104 VAT registered), applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql \
           docs/ledger-auto-bills/proposal.sql docs/ledger-auto-bills/followup-categories.sql docs/ledger-auto-bills/vat-registered.sql docs/ledger-bank/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (15 Nov 2026: phases 2, 3a, 3b and its two follow-ups applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'e8b4d718206034884fa5766884b831d5' and count(*) = 157
  then 'PASS|the 157 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"

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
# Everything that existed before: every function body, column, constraint, index, trigger, grant and policy outside the new objects.
old() { $P -At -c "select md5(string_agg(p.oid::regprocedure::text || md5(p.prosrc), ',' order by 1)) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname not like '%ledger_bank%'"; }
oldfns=$(old)

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql 2>&1 | grep ERROR | head -3; }
$P -At -c "select case when count(*) = 160 then 'PASS|160 tables after apply (157 + ledger_bank_accounts, ledger_bank_imports, ledger_bank_lines)' else 'FAIL|table count ' || count(*) end
  from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
[ "$(old)" = "$oldfns" ] && echo "PASS|no existing function was replaced (every other body is identical)" || echo "FAIL|an existing function changed"
$P -At -c "select case when not exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  and t.tgfoid::regproc::text like '%ledger_bank%' and c.relname not like 'ledger_bank%') then 'PASS|no trigger was added to an existing table' else 'FAIL|trigger on an existing table' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-bank/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: functions, columns, constraints, indexes, triggers, grants, RLS and policies exactly as before"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.ledger_bank_lines) = 0 and (select count(*) from public.ledger_bank_accounts) = 0 and (select count(*) from public.journal_entries) = 0
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the earlier ledger suites still pass with 3c-1 applied"
for t in docs/ledger-auto/test.sql docs/ledger/test.sql; do
  n=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'FAIL\||ERROR')
  [ "$f" = 0 ] && [ "$n" -ge 70 ] && echo "PASS|$t: $n checks pass" || { echo "FAIL|$t ($n pass, $f fail)"; $P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -E 'FAIL\||ERROR' | head -3; }
done
n=$($P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test-vat-registered.sql 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f docs/ledger-auto-bills/test-vat-registered.sql 2>&1 | grep -cE 'FAIL\||ERROR')
[ "$f" = 0 ] && [ "$n" -ge 35 ] && echo "PASS|the VAT-registered suite (#104): $n checks pass" || echo "FAIL|VAT-registered suite ($n pass, $f fail)"
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check passes with the three bank tables" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql 2>&1 | grep -q 'already exist' && echo "PASS|second apply refused (already exist)" || echo "FAIL|second apply"

echo "== rollback refuses while statement lines exist"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|line setup"
INSERT INTO auth.users (id, email) VALUES ('fd100000-0000-4000-8000-000000000001', 'z@example.test');
INSERT INTO public.profiles (id, email, currency_code) VALUES ('fd100000-0000-4000-8000-000000000001', 'z@example.test', 'GBP') ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES ('fd100000-0000-4000-8000-000000000001', 'z@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES ('0fd10000-0000-4000-8000-000000000001', 'Z', 'bank-z', 'fd100000-0000-4000-8000-000000000001');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ('0fd10000-0000-4000-8000-000000000001', 'fd100000-0000-4000-8000-000000000001', 'owner', true);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('0fd10000-0000-4000-8000-000000000001', 'fd100000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims', '{"sub": "fd100000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_setup('0fd10000-0000-4000-8000-000000000001', '2026-01-01', 'fresh', NULL);
SELECT public.ledger_bank_account_save('0fd10000-0000-4000-8000-000000000001', NULL, 'Main');
SELECT public.ledger_bank_import('0fd10000-0000-4000-8000-000000000001', (SELECT id FROM public.ledger_bank_accounts), 'z.csv',
  '[{"date": "2026-03-01", "description": "Fee", "amount_pence": -100}]'::jsonb);
SQL
$P -At -c "select case when (select count(*) from public.ledger_bank_lines) = 1 then 'PASS|one line committed' else 'FAIL|line' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/rollback.sql 2>&1 | grep -q 'holds bank statement lines' && echo "PASS|rollback refused while lines exist, and says why" || echo "FAIL|rollback with rows"
$P -At -c "select case when to_regclass('public.ledger_bank_lines') is not null and to_regprocedure('public.ledger_bank_import(uuid,uuid,text,jsonb)') is not null
  then 'PASS|the refused rollback changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "CREATE OR REPLACE FUNCTION public._ledger_require_writer(p_org uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS 'SELECT NULL::void'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql 2>&1 | grep -q '_ledger_require_writer.*differs' && echo "PASS|a changed guarded function is refused" || echo "FAIL|function drift"
fresh
$P -c "ALTER TABLE public.ledger_postings DROP CONSTRAINT lp_kind; ALTER TABLE public.ledger_postings ADD CONSTRAINT lp_kind CHECK (kind IN ('invoice_issued', 'invoice_paid', 'other'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank/proposal.sql 2>&1 | grep -q 'lp_kind differs' && echo "PASS|a changed posting kind list is refused" || echo "FAIL|check drift"
$P -At -c "select case when to_regclass('public.ledger_bank_lines') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
