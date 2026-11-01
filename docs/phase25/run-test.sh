#!/usr/bin/env bash
# Phase 25 tests on a DISPOSABLE local Postgres 16 (port 55460, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/phase25/run-test.sh        (SKIP_EARLIER=1 to skip step 1)
#
# 1. Every earlier suite UNCHANGED (docs/phase22/run-test.sh runs Phases 12, 12b, 12c, 13, 15, 20 and 22).
# 2. A replica of the production schema: scripts/staging/00_supabase_shim.sql + the Sept 2026 schema-only baseline
#    (supabase/baseline; its 269 "GRANT MAINTAIN" lines are skipped because Postgres 16 has no MAINTAIN privilege)
#    + every migration since 29 Sep 2026 + the SQL of the phases applied by hand since then. Some of those no longer
#    apply on top of each other (they guard against drift); the script lists them. The replica has 111 of the 123
#    production tables (the 12 missing are service-only tables that Phase 25 excludes) and 61 of the 66 functions
#    Phase 25 guards (40 byte-identical to production).
# 3. Phase 25 itself (test.sql): proposal.sql with the replica's own function hashes (the real hashes are production's;
#    the real proposal.sql is also run and must be REFUSED here, because the replica's bodies differ), every rule,
#    then rollback.sql restores every body exactly.
# 4. Guards: second apply refused; a new unreviewed SECURITY DEFINER function makes the apply refuse.
set -u
[ "${SKIP_EARLIER:-0}" = 1 ] || bash docs/phase22/run-test.sh
ROOT=$(pwd); D=/tmp/p25pg; S=/tmp/p25sock; PORT=55460; U=${PG_RUN_USER:-postgres}; W=/tmp/p25run
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S $W; mkdir -p $D $S $W; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

echo "== Replica of the production schema"
$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
grep -v '^GRANT MAINTAIN' supabase/baseline/production-schema-baseline-2026-09.sql > $W/baseline.sql
$P -v ON_ERROR_STOP=1 -f $W/baseline.sql >/dev/null 2>&1 || echo "FAIL|baseline"
for f in $(ls supabase/migrations/*.sql | awk -F/ '$NF >= "20260929"') docs/crm-recovery-2026-10-08/apply-v2.sql \
  docs/marketing-workspace-2026-10-10/proposal.sql docs/onboarding-2026-10-15/proposal.sql docs/support-ticketing-2026-10-15/proposal.sql \
  docs/phase4b-document-email/proposal.sql docs/phase7-notifications/proposal.sql docs/phase8-cleanup/proposal.sql docs/phase11b/proposal.sql \
  docs/phase12/proposal.sql docs/phase12b/proposal.sql docs/phase12c/proposal.sql docs/phase13/proposal.sql docs/phase15/proposal.sql \
  docs/phase20/proposal.sql docs/phase22/proposal.sql; do
  $P -v ON_ERROR_STOP=1 -1 -f "$f" >$W/one.log 2>&1 || echo "  (not replayed: $f: $(grep -m1 -o 'ERROR: .*' $W/one.log | cut -c1-90))"
done
$P -v ON_ERROR_STOP=1 -f docs/phase25/fixture.sql >/dev/null || echo "FAIL|fixture"

# proposal.test.sql = proposal.sql with the replica's own hashes for the guarded functions that exist here, and the
# replica-only SECURITY DEFINER functions (dropped or revoked in production since Sept) added to the exclusion list.
$P -At -c "select p.oid::regprocedure::text || '|' || md5(p.prosrc) || '|' || l.lanname from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang where n.nspname = 'public'" > $W/local.txt
$P -At -c "select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')" > $W/local_secdef.txt
python3 -I - "$ROOT/docs/phase25/proposal.sql" "$W" <<'PY'
import re, sys
src, w = sys.argv[1], sys.argv[2]
s = open(src).read()
local = {f: (m, lang) for f, m, lang in (l.split('|') for l in open(w + '/local.txt').read().split('\n') if '|' in l)}
a, b = s.index('-- BEGIN EXPECTED'), s.index('-- END EXPECTED')
rows = re.findall(r"\('public\.([^']+)', '([0-9a-f]{32})', '(\w+)', '(\w+)'\)", s[a:b])
keep = [(f, local[f][0], local[f][1], kind) for f, _, lang, kind in rows if f in local]  # the replica's own body and language
block = "-- BEGIN EXPECTED (TEST: replica hashes)\nINSERT INTO p25_expected VALUES\n" + ",\n".join(f"  ('public.{f}', '{m}', '{l}', '{k}')" for f, m, l, k in keep) + ";\n"
s = s[:a] + block + s[b:]
a, b = s.index('-- BEGIN EXCLUDED'), s.index('-- END EXCLUDED')
excl = re.findall(r"\('public\.([^']+)', '", s[a:b])
known = {f for f, *_ in rows} | set(excl)
extra = [f for f in open(w + '/local_secdef.txt').read().split() if f and f not in known]
s = s[:b] + ("INSERT INTO p25_excluded VALUES\n" + ",\n".join(f"  ('public.{f}', 'replica only (not in production)')" for f in extra) + ";\n" if extra else "") + s[b:]
s = s.replace(f"<> {len(rows)} THEN RAISE EXCEPTION 'guard count mismatch'", f"<> {len(keep)} THEN RAISE EXCEPTION 'guard count mismatch'")
open(w + '/proposal.test.sql', 'w').write(s)
print(f"   test proposal: {len(keep)} of {len(rows)} guarded functions exist in the replica; {len(extra)} replica-only functions excluded")
PY
cp docs/phase25/proposal.sql docs/phase25/rollback.sql docs/phase25/test.sql $W/

echo "== The real proposal.sql is refused on the replica (bodies differ from production), nothing applied"
OUT=$( (cd $W && $P -v ON_ERROR_STOP=1 -f proposal.sql) 2>&1 )
echo "$OUT" | grep -q "has changed since this was prepared\|is missing" && \
  $P -At -c "select case when to_regprocedure('public.mfa_ok()') is null and to_regclass('public.security_settings') is null then 'PASS|real proposal.sql refused by its hash guard; nothing created' else 'FAIL|partial apply' end" \
  || echo "FAIL|real proposal.sql was not refused: $(echo "$OUT" | tail -1)"

echo "== I: docs/phase25/test.sql"
(cd $W && $P -v ON_ERROR_STOP=1 -f test.sql 2>&1 | grep -E "PASS\||FAIL\||TOTAL\||ERROR")

echo "== Guards"
cd $W
$P -v ON_ERROR_STOP=1 -f proposal.test.sql >/dev/null 2>&1 && echo "PASS|proposal applies again cleanly after rollback.sql" || echo "FAIL|re-apply after rollback"
OUT=$($P -v ON_ERROR_STOP=1 -f proposal.test.sql 2>&1); echo "$OUT" | grep -q "already exists (applied twice?)" \
  && echo "PASS|Applying proposal.sql twice is refused" || echo "FAIL|second apply: $OUT"
$P -v ON_ERROR_STOP=1 -f rollback.sql >/dev/null
$P -c "CREATE FUNCTION public.p25_new_unreviewed() RETURNS int LANGUAGE sql SECURITY DEFINER AS 'select 1'; GRANT EXECUTE ON FUNCTION public.p25_new_unreviewed() TO authenticated;" >/dev/null
OUT=$($P -v ON_ERROR_STOP=1 -f proposal.test.sql 2>&1); echo "$OUT" | grep -q "Unreviewed SECURITY DEFINER function(s) executable by signed-in users: p25_new_unreviewed()" \
  && $P -At -c "select case when to_regprocedure('public.mfa_ok()') is null and not exists (select 1 from pg_proc where prosrc like '%phase25 mfa guard%') then 'PASS|a new unreviewed SECURITY DEFINER function makes the apply refuse; nothing changed' else 'FAIL|partial apply' end" \
  || echo "FAIL|unreviewed function not caught: $(echo "$OUT" | tail -1)"
cd /; $R "$BIN/pg_ctl" -D $D stop >/dev/null; rm -rf $D $S $W
