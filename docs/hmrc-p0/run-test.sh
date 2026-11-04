#!/usr/bin/env bash
# HMRC P0 tests on a DISPOSABLE local Postgres 16 (port 55400, unix socket only). Never touches production.
# From the repo root:   PG_RUN_USER=postgres bash docs/hmrc-p0/run-test.sh
set -u
D=/tmp/hp0pg; S=/tmp/hp0sock; PORT=55400; U=${PG_RUN_USER:-postgres}
R="setpriv --reuid=$U --regid=$(id -gn "$U") --clear-groups"
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
P="psql -h $S -p $PORT -U postgres -q -X"
$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1; rm -rf $D $S; mkdir -p $D $S; chown "$U" $D $S
$R "$BIN/initdb" -U postgres -D $D >/dev/null 2>&1 && $R "$BIN/pg_ctl" -D $D -o "-p $PORT -k $S -c listen_addresses=''" -l $S/log start >/dev/null && sleep 2

$P -v ON_ERROR_STOP=1 -f scripts/staging/00_supabase_shim.sql >/dev/null 2>&1 || echo "FAIL|shim"
$P -v ON_ERROR_STOP=1 -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;" >/dev/null || echo "FAIL|default privileges"
for f in docs/phase35/fixture.sql docs/phase36/fixture.sql docs/phase37/fixture.sql docs/phase31/fixture.sql docs/hmrc-p0/fixture.sql; do
  $P -v ON_ERROR_STOP=1 -f $f >/dev/null || echo "FAIL|$f"
done

echo "== the functions are byte-identical to production (4 Nov 2026)"
$P -At -c "select case when string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) =
  '_access_state_for=292e158f87569a1b7bdbe32e64da0a67 decrypt_hmrc_token=eec73118249cabf4f41722c379db680b encrypt_hmrc_settings_secret=be10b3464a317741e4ffcb1dfe0aaf8a encrypt_hmrc_token=744c7dca6d8cabbef4d95e58f4fb09f5 get_hmrc_client_secret=eba34f6298f5594e2cf160e12548c6e4 get_hmrc_tokens=5532c89e3e0c944bca121522b6dbbc06 is_admin_or_owner=4517a33cfa92147cc60eb2ee67d782ca mfa_ok=20516f2ec203220b3ac08d1230c7c306 require_aal2_if_enrolled=10b2ae7bd2f9a94ea20598f19b8aebf2 update_hmrc_updated_at=301a884953d37769916294bb60562e05 user_is_organization_admin=c6dd628541413ec82565a6676a55a767 user_is_organization_member=1fb55538d44b2451875f8baf1b6e4388'
  then 'PASS|function hashes = production' else 'FAIL|hashes: ' || string_agg(p.proname || '=' || md5(p.prosrc), ' ' order by p.proname) end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.proname in ('_access_state_for','decrypt_hmrc_token','encrypt_hmrc_settings_secret','encrypt_hmrc_token','get_hmrc_client_secret','get_hmrc_tokens','is_admin_or_owner','mfa_ok','require_aal2_if_enrolled','update_hmrc_updated_at','user_is_organization_admin','user_is_organization_member')"
$P -At -c "select case when (select count(*) from pg_policies where schemaname='public' and tablename like 'hmrc%') = 14
  and has_function_privilege('authenticated','public.get_hmrc_tokens(uuid)','EXECUTE') and not has_column_privilege('authenticated','public.hmrc_integrations','access_token','SELECT')
  and has_column_privilege('authenticated','public.hmrc_integrations','access_token','INSERT') and has_column_privilege('authenticated','public.hmrc_settings','client_id','SELECT')
  then 'PASS|policies and grants = production shape' else 'FAIL|production shape' end"

$P -v ON_ERROR_STOP=1 >/dev/null <<'SQL' || echo "FAIL|fingerprint"
CREATE SCHEMA t0;
CREATE FUNCTION t0.fingerprint() RETURNS text LANGUAGE sql AS $f$
  SELECT md5(concat_ws('|',
    (SELECT string_agg(p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(p.proacl::text[]) x), '') || ':' || p.prosecdef, ',' ORDER BY p.oid::regprocedure::text)
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace),
    (SELECT string_agg(c.relname || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(c.relacl::text[]) x), ''), ',' ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT a.attrelid::regclass::text || '.' || a.attname || ':' || a.attnotnull || ':' || coalesce((SELECT string_agg(x, ',' ORDER BY x) FROM unnest(a.attacl::text[]) x), '') AS v
       FROM pg_attribute a WHERE a.attrelid IN ('public.hmrc_integrations'::regclass, 'public.hmrc_settings'::regclass, 'public.hmrc_submission_logs'::regclass) AND a.attnum > 0 AND NOT a.attisdropped) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT conrelid::regclass::text || '.' || conname AS v FROM pg_constraint WHERE connamespace = 'public'::regnamespace) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT schemaname || '.' || tablename || '.' || policyname || ':' || permissive || ':' || cmd::text || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS v FROM pg_policies) s),
    (SELECT string_agg(v, ',' ORDER BY v) FROM (SELECT t.tgrelid::regclass::text || '.' || t.tgname AS v FROM pg_trigger t WHERE NOT t.tgisinternal) s),
    (SELECT string_agg(g::text, ',' ORDER BY g::text) FROM public.phase25_mfa_guard_log g)))
$f$;
CREATE TABLE t0.before AS SELECT t0.fingerprint() AS fp;
GRANT USAGE ON SCHEMA t0 TO PUBLIC;
SQL

echo "== suite"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/test.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== a second apply is refused"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/proposal.sql 2>&1 | grep -q 'HMRC P0 already exists' && echo "PASS|second apply refused" || echo "FAIL|second apply"

echo "== rollback refuses while there is HMRC P0 data"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/rollback.sql 2>&1 | grep -q 'HMRC P0 has data' && echo "PASS|rollback refused without force" || echo "FAIL|rollback not refused"
$P -At -c "select case when (select count(*) from public.hmrc_connections) = 1 and (select count(*) from public.hmrc_audit_log) = 2 then 'PASS|nothing removed by the refused rollback' else 'FAIL|refused rollback changed something' end"

echo "== forced rollback restores the exact state, then apply again"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/test-rollback.sql 2>&1 | sed -n 's/.*\(PASS|.*\)/\1/p; s/.*\(FAIL|.*\)/\1/p; /ERROR/p'

echo "== an empty rollback needs no force"
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/rollback.sql >/dev/null 2>&1 && echo "PASS|rollback of an empty HMRC P0 runs without force" || echo "FAIL|empty rollback"

echo "== drift is refused before anything changes"
$P -c "INSERT INTO public.hmrc_integrations (user_id, access_token) VALUES ('a0000000-0000-4000-8000-0000000000ff', 'ENC:x')" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/proposal.sql 2>&1 | grep -q 'HMRC data differs' && echo "PASS|unexpected HMRC data is refused" || echo "FAIL|data drift"
$P -c "CREATE OR REPLACE FUNCTION public.decrypt_hmrc_token(encrypted_token text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS 'select encrypted_token'" >/dev/null
$P -v ON_ERROR_STOP=1 -f docs/hmrc-p0/proposal.sql 2>&1 | grep -q 'decrypt_hmrc_token(text) differs' && echo "PASS|a changed old function is refused" || echo "FAIL|function drift"
$P -At -c "select case when to_regclass('public.hmrc_connections') is null and to_regclass('public.hmrc_p0_backup') is null and to_regprocedure('public.get_hmrc_tokens(uuid)') is not null then 'PASS|nothing applied after the refusals' else 'FAIL|partial apply' end"

$R "$BIN/pg_ctl" -D $D stop >/dev/null 2>&1
