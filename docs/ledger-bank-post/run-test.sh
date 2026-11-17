#!/usr/bin/env bash
# Finance phase 3c-2 (posting bank lines) tests on a DISPOSABLE local Postgres (port 55418, unix socket
# only). Never touches production. From the repo root:   PG_RUN_USER=postgres bash docs/ledger-bank-post/run-test.sh
set -u
D=/tmp/hlbppg; S=/tmp/hlbpsock; PORT=55418; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"

fresh() {
  $R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
  $R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2
  $P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
  $P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
  # Production as of 17 Nov 2026: the phase 3b chain (docs/ledger-auto-bills/run-test.sh) plus phase 3b, its two
  # follow-ups (#103 category map, #104 VAT registered) phase 3c-1 (docs/ledger-bank) and phase 4 (docs/ledger-reports), applied.
  for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql \
           docs/hmrc-p0/proposal.sql docs/hmrc-plan/proposal.sql docs/hmrc-p1-p2/proposal.sql docs/hmrc-p3/proposal.sql \
           docs/hmrc-p4/fixture.sql docs/demo-readonly/fixture.sql docs/demo-readonly/proposal.sql docs/hmrc-p4/proposal.sql docs/hmrc-p4b/fixture.sql \
           docs/hmrc-p4b/proposal.sql docs/hmrc-p4b/decision-b-function.sql docs/hmrc-p5/fixture.sql docs/hmrc-p5/proposal.sql docs/hmrc-p6/fixture.sql \
           docs/hmrc-p6/proposal.sql docs/hmrc-p7b/fixture.sql docs/hmrc-p7b/proposal.sql docs/hmrc-p7d/fixture.sql docs/ledger/fixture.sql \
           docs/ledger/proposal.sql docs/ledger-auto/fixture.sql docs/ledger-auto/proposal.sql docs/ledger-auto-bills/fixture.sql \
           docs/ledger-auto-bills/proposal.sql docs/ledger-auto-bills/followup-categories.sql docs/ledger-auto-bills/vat-registered.sql docs/ledger-bank/fixture.sql \
           docs/ledger-bank/proposal.sql docs/ledger-reports/fixture.sql \
           docs/ledger-reports/proposal.sql docs/ledger-bank-post/fixture.sql; do
    $P -v ON_ERROR_STOP=1 -f $f >/dev/null 2>&1 || echo "FAIL|$f"
  done
}
fresh
[ "${1:-}" = "--base-only" ] && exit 0

echo "== production shape (17 Nov 2026: phases 2, 3a, 3b with its follow-ups, 3c-1 and 4 applied)"
$P -At -c "select case when md5(string_agg(relname, ',' order by relname)) = 'b9fec97b9d0d8c836c6af78125e92371' and count(*) = 160
  then 'PASS|the 160 tables in public = production' else 'FAIL|table set' end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"

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
# What 3c-2 may change: the five replaced 3c-1 functions, the new functions, je_source_type, lbl_status, lbl_state and the two
# new foreign keys and unique key on ledger_bank_lines (and its new columns). Everything else must be identical.
others() { $P -At -c "select md5(concat_ws('|',
  (select string_agg(p.oid::regprocedure::text || md5(p.prosrc) || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text || md5(p.prosrc) || coalesce(p.proacl::text, '')) from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname not in ('_ledger_bank_guard', '_ledger_bank_match_run', 'ledger_bank_match', 'ledger_bank_ignore', 'ledger_bank_overview')
     and p.proname not in ('_ledger_bank_allowed_account', '_ledger_bank_post_line', 'ledger_bank_post', 'ledger_bank_post_many', 'ledger_bank_unpost')),
  (select string_agg(conrelid::regclass::text || conname || pg_get_constraintdef(oid), ',' order by conrelid::regclass::text || conname || pg_get_constraintdef(oid)) from pg_constraint where connamespace = 'public'::regnamespace
     and conname not in ('je_source_type', 'lbl_status', 'lbl_state', 'lbl_posted_entry', 'lbl_posted_entry_fk', 'lbl_posted_account')),
  (select string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)) from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where c.relnamespace = 'public'::regnamespace and not (c.relname = 'ledger_bank_lines' and a.attname like 'posted_%') and not (c.relname like 'lbl_posted%')),
  (select string_agg(tgrelid::regclass::text || tgname || tgfoid::regproc::text, ',' order by tgrelid::regclass::text || tgname || tgfoid::regproc::text) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not tgisinternal),
  (select string_agg(tablename || policyname || coalesce(qual, '') || coalesce(with_check, ''), ',' order by tablename || policyname || coalesce(qual, '') || coalesce(with_check, '')) from pg_policies where schemaname = 'public'),
  (select string_agg(relname || coalesce(relacl::text, '') || relrowsecurity::text, ',' order by relname || coalesce(relacl::text, '') || relrowsecurity::text) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r')))"; }
o1=$(others)
acl() { $P -At -c "select string_agg(proname || coalesce(proacl::text, ''), ',' order by proname) from pg_proc where proname in ('_ledger_bank_guard', '_ledger_bank_match_run', 'ledger_bank_match', 'ledger_bank_ignore', 'ledger_bank_overview')"; }
a1=$(acl)

echo "== apply, then an empty rollback restores the exact state"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql >/dev/null 2>&1 || { echo "FAIL|apply"; $P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql 2>&1 | grep ERROR | head -3; }
[ "$(others)" = "$o1" ] && echo "PASS|nothing else changed: other functions, constraints, columns, triggers, policies, table grants and RLS identical" || echo "FAIL|something else changed"
[ "$(acl)" = "$a1" ] && echo "PASS|the five replaced functions kept their exact grants" || echo "FAIL|grants of replaced functions"
$P -At -c "select case when count(*) = 160 then 'PASS|still 160 tables' else 'FAIL|tables ' || count(*) end from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p')"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/rollback.sql >/dev/null 2>&1 || { echo "FAIL|rollback"; $P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/rollback.sql 2>&1 | grep ERROR | head -3; }
same "empty rollback: the 3c-1 constraints, guard and functions back exactly; the new columns and functions gone"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/rollback.sql 2>&1 | grep -q 'is not applied' && echo "PASS|rollback refused when not applied" || echo "FAIL|rollback twice"

echo "== apply again and run the suite (one transaction, rolled back)"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql >/dev/null 2>&1 && echo "PASS|re-apply after rollback works" || echo "FAIL|re-apply"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'
$P -At -c "select case when (select count(*) from public.journal_entries) = 0 and (select count(*) from public.ledger_bank_lines) = 0
  then 'PASS|the suite left nothing behind (rolled back)' else 'FAIL|suite rows left' end"
echo "== the earlier suites still pass with 3c-2 applied"
for t in docs/ledger-bank/test.sql docs/ledger-reports/test.sql docs/ledger-auto/test.sql docs/ledger/test.sql; do
  n=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'PASS\|'); f=$($P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -cE 'FAIL\||ERROR')
  [ "$f" = 0 ] && [ "$n" -ge 70 ] && echo "PASS|$t: $n checks pass" || { echo "FAIL|$t ($n pass, $f fail)"; $P -v ON_ERROR_STOP=1 -f $t 2>&1 | grep -E 'FAIL\||ERROR' | head -3; }
done
$P -v ON_ERROR_STOP=1 -f docs/demo-readonly/check-coverage.sql 2>&1 | grep -q 'DEMO_GUARD_OK' && echo "PASS|demo coverage check still passes" || echo "FAIL|demo coverage"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql 2>&1 | grep -q 'already exists' && echo "PASS|second apply refused (already exists)" || echo "FAIL|second apply"

echo "== rollback refuses while a line is posted, and once a bank-line journal exists"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|posting setup"
INSERT INTO auth.users (id, email) VALUES ('fe310000-0000-4000-8000-000000000001', 'z@example.test');
INSERT INTO public.profiles (id, email, currency_code) VALUES ('fe310000-0000-4000-8000-000000000001', 'z@example.test', 'GBP') ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP';
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES ('fe310000-0000-4000-8000-000000000001', 'z@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES ('0fe31000-0000-4000-8000-000000000001', 'Z', 'post-z', 'fe310000-0000-4000-8000-000000000001');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES ('0fe31000-0000-4000-8000-000000000001', 'fe310000-0000-4000-8000-000000000001', 'owner', true);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES ('0fe31000-0000-4000-8000-000000000001', 'fe310000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims', '{"sub": "fe310000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_setup('0fe31000-0000-4000-8000-000000000001', '2026-01-01', 'fresh', NULL);
SELECT public.ledger_bank_account_save('0fe31000-0000-4000-8000-000000000001', NULL, 'Main');
SELECT public.ledger_bank_import('0fe31000-0000-4000-8000-000000000001', (SELECT id FROM public.ledger_bank_accounts), 'z.csv', '[{"date": "2026-03-03", "description": "Fee", "amount_pence": -550}]'::jsonb);
SELECT public.ledger_bank_post('0fe31000-0000-4000-8000-000000000001', (SELECT id FROM public.ledger_bank_lines), (SELECT id FROM public.ledger_accounts WHERE code = '7900'));
SQL
$P -At -c "select case when (select count(*) from public.ledger_bank_lines where status = 'posted') = 1 then 'PASS|one posted line committed (balanced at commit)' else 'FAIL|posting' end"
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/rollback.sql 2>&1 | grep -q 'holds posted lines' && echo "PASS|rollback refused while a line is posted, and says why" || echo "FAIL|rollback with a posted line"
$P -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || echo "FAIL|unpost setup"
SELECT set_config('request.jwt.claims', '{"sub": "fe310000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_bank_unpost('0fe31000-0000-4000-8000-000000000001', (SELECT id FROM public.ledger_bank_lines));
SQL
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/rollback.sql 2>&1 | grep -q 'bank-line journals' && echo "PASS|after un-posting, still refused: the bank-line journal stays (journals are never deleted)" || echo "FAIL|rollback with a journal"
$P -At -c "select case when to_regprocedure('public.ledger_bank_post(uuid,uuid,uuid,text)') is not null then 'PASS|the refused rollbacks changed nothing' else 'FAIL|partial rollback' end"

echo "== drift is refused before anything changes (fresh database)"
fresh
$P -c "CREATE TABLE public.zz_surprise (id int)" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql 2>&1 | grep -q 'tables in public differ' && echo "PASS|a changed table set is refused" || echo "FAIL|table drift"
fresh
$P -c "CREATE OR REPLACE FUNCTION public.ledger_bank_ignore(p_org uuid, p_line uuid, p_reason text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS 'SELECT ''{}''::jsonb'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql 2>&1 | grep -q 'ledger_bank_ignore.*differs' && echo "PASS|a changed 3c-1 function body is refused" || echo "FAIL|function drift"
fresh
$P -c "ALTER TABLE public.ledger_bank_lines DROP CONSTRAINT lbl_status; ALTER TABLE public.ledger_bank_lines ADD CONSTRAINT lbl_status CHECK (status IN ('unmatched', 'matched', 'ignored', 'other'))" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/ledger-bank-post/proposal.sql 2>&1 | grep -q 'lbl_status differs' && echo "PASS|a changed constraint is refused" || echo "FAIL|constraint drift"
$P -At -c "select case when to_regprocedure('public.ledger_bank_post(uuid,uuid,uuid,text)') is null then 'PASS|nothing was applied by the refused runs' else 'FAIL|partial apply' end"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
