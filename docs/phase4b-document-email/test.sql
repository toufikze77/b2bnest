-- Throwaway-database test for proposal.sql + rollback.sql (run-test.sh only, never production).
-- Minimal Supabase-like fixture: anon/authenticated/service_role roles, auth.uid() from request.jwt.claims, auth.users,
-- and Supabase's default grants on new public tables (so the proposal's REVOKE is really exercised).
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated; -- mimic Supabase defaults
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text UNIQUE);
INSERT INTO auth.users VALUES ('11111111-0000-4000-8000-000000000001','a@owner.test'),('22222222-0000-4000-8000-000000000002','b@owner.test');

\i docs/phase4b-document-email/proposal.sql
\set ON_ERROR_STOP 0
CREATE TABLE results(n serial, name text, ok bool, detail text); GRANT ALL ON results, results_n_seq TO anon, authenticated, service_role;
CREATE FUNCTION t(name text, who text, stmt text, expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text; c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN who IN ('anon','service') THEN '{}' ELSE
    json_build_object('sub',(SELECT id FROM auth.users WHERE email=who))::text END, true);
  EXECUTE format('SET LOCAL ROLE %I', CASE who WHEN 'anon' THEN 'anon' WHEN 'service' THEN 'service_role' ELSE 'authenticated' END);
  BEGIN EXECUTE stmt; GET DIAGNOSTICS c = ROW_COUNT; r := 'ROWS=' || c; EXCEPTION WHEN others THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO results(name, ok, detail) VALUES (name, CASE WHEN expect='ERROR' THEN r LIKE 'ERROR%' ELSE r = expect END, r);
END $$;
CREATE FUNCTION cnt(who text, q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM auth.users WHERE email=who))::text, true);
  SET LOCAL ROLE authenticated; EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; RESET ROLE; RETURN c::text;
  EXCEPTION WHEN others THEN RESET ROLE; RETURN 'ERROR ' || SQLERRM; END $$;
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO results(name,ok,detail) VALUES (name,coalesce(cond,false),detail) $$;
\set A '''11111111-0000-4000-8000-000000000001'''
\set B '''22222222-0000-4000-8000-000000000002'''
\set D1 '''d0000000-0000-4000-8000-0000000000d1'''
\set D2 '''d0000000-0000-4000-8000-0000000000d2'''

-- SHAPE
SELECT ok('Table exists with RLS enabled', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.document_email_log'::regclass));
SELECT ok('Index (user_id, created_at) exists', to_regclass('public.document_email_log_user_created') IS NOT NULL);
SELECT ok('Index (document_id, created_at) exists', to_regclass('public.document_email_log_document_created') IS NOT NULL);
SELECT ok('Helper is SECURITY DEFINER with an empty search_path',
  (SELECT prosecdef AND proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE proname = 'document_email_recent_counts'),
  (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE proname = 'document_email_recent_counts'));
SELECT ok('authenticated has SELECT only (no INSERT/UPDATE/DELETE grants)',
  has_table_privilege('authenticated','public.document_email_log','SELECT') AND NOT has_table_privilege('authenticated','public.document_email_log','INSERT')
  AND NOT has_table_privilege('authenticated','public.document_email_log','UPDATE') AND NOT has_table_privilege('authenticated','public.document_email_log','DELETE'));
SELECT ok('anon has no access at all', NOT has_table_privilege('anon','public.document_email_log','SELECT'));
SELECT ok('Helper executable by service_role only',
  has_function_privilege('service_role','public.document_email_recent_counts(uuid,uuid,timestamptz)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.document_email_recent_counts(uuid,uuid,timestamptz)','EXECUTE')
  AND NOT has_function_privilege('anon','public.document_email_recent_counts(uuid,uuid,timestamptz)','EXECUTE'));

-- WRITES: only the service role (the Edge Function)
SELECT t('Service role writes an accepted row', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status,provider_reply) VALUES (%s,'invoice',%s,'client.example','accepted_by_provider','250 2.0.0 OK queued')$q$, :'A', :'D1'), 'ROWS=1');
SELECT t('Service role writes a failed row', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status,error_stage,provider_reply) VALUES (%s,'invoice',%s,'client.example','failed','auth','535 5.7.139 Authentication unsuccessful')$q$, :'A', :'D1'), 'ROWS=1');
SELECT t('Service role writes an uncertain row', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status,error_stage) VALUES (%s,'quote',%s,'client.example','uncertain','data_end')$q$, :'A', :'D2'), 'ROWS=1');
SELECT t('Service role writes a row for owner B', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status) VALUES (%s,'quote',%s,'other.example','accepted_by_provider')$q$, :'B', :'D2'), 'ROWS=1');
SELECT t('Service role: an old accepted row (25 hours ago)', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status,created_at) VALUES (%s,'invoice',%s,'client.example','accepted_by_provider',now() - interval '25 hours')$q$, :'A', :'D1'), 'ROWS=1');
SELECT t('Signed-in owner cannot insert', 'a@owner.test', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,status) VALUES (%s,'invoice',%s,'accepted_by_provider')$q$, :'A', :'D1'), 'ERROR');
SELECT t('Signed-in owner cannot update own rows', 'a@owner.test', $q$UPDATE public.document_email_log SET status='failed'$q$, 'ERROR');
SELECT t('Signed-in owner cannot delete own rows', 'a@owner.test', $q$DELETE FROM public.document_email_log$q$, 'ERROR');
SELECT t('anon cannot read', 'anon', $q$SELECT * FROM public.document_email_log$q$, 'ERROR');

-- READS: owners see only their own rows
SELECT ok('Owner A reads exactly their 4 rows', cnt('a@owner.test', 'SELECT * FROM public.document_email_log') = '4', cnt('a@owner.test', 'SELECT * FROM public.document_email_log'));
SELECT ok('Owner B reads exactly their 1 row', cnt('b@owner.test', 'SELECT * FROM public.document_email_log') = '1');
SELECT ok('Owner A cannot see B''s row', cnt('a@owner.test', format('SELECT * FROM public.document_email_log WHERE user_id = %s', :'B')) = '0');

-- CHECKS: never a full address, never "delivered", short replies only
SELECT t('recipient_domain with an @ is refused', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,recipient_domain,status) VALUES (%s,'invoice',%s,'x@client.example','failed')$q$, :'A', :'D1'), 'ERROR');
SELECT t('status "delivered" is refused', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,status) VALUES (%s,'invoice',%s,'delivered')$q$, :'A', :'D1'), 'ERROR');
SELECT t('document_kind "receipt" is refused', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,status) VALUES (%s,'receipt',%s,'failed')$q$, :'A', :'D1'), 'ERROR');
SELECT t('provider_reply over 300 characters is refused', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,status,provider_reply) VALUES (%s,'invoice',%s,'failed',repeat('x',301))$q$, :'A', :'D1'), 'ERROR');
SELECT t('unknown user_id is refused (FK to auth.users)', 'service', format($q$INSERT INTO public.document_email_log(user_id,document_kind,document_id,status) VALUES ('99999999-0000-4000-8000-000000000009','invoice',%s,'failed')$q$, :'D1'), 'ERROR');

-- LIMIT HELPER: counts accepted + uncertain in the window; failed and old rows don't count
SET ROLE service_role;
SELECT ok('Counts for A since 24h: user 2 (accepted + uncertain), document D1 1 (failed and 25h-old excluded)',
  (SELECT user_count = 2 AND document_count = 1 FROM public.document_email_recent_counts(:A, :D1, now() - interval '24 hours')),
  (SELECT user_count || '/' || document_count FROM public.document_email_recent_counts(:A, :D1, now() - interval '24 hours')));
SELECT ok('Counts for B since 24h: user 1, document D2 1', (SELECT user_count = 1 AND document_count = 1 FROM public.document_email_recent_counts(:B, :D2, now() - interval '24 hours')));
RESET ROLE;
SELECT t('Signed-in owner cannot call the limit helper', 'a@owner.test', format('SELECT * FROM public.document_email_recent_counts(%s, %s, now())', :'A', :'D1'), 'ERROR');
SELECT t('anon cannot call the limit helper', 'anon', format('SELECT * FROM public.document_email_recent_counts(%s, %s, now())', :'A', :'D1'), 'ERROR');
DELETE FROM auth.users WHERE email = 'b@owner.test';
SELECT ok('Deleting a user removes their log rows (ON DELETE CASCADE)', NOT EXISTS (SELECT 1 FROM public.document_email_log WHERE user_id = :B)
  AND EXISTS (SELECT 1 FROM public.document_email_log WHERE user_id = :A));

-- ROLLBACK, FAILED APPLY, RE-APPLY
\i docs/phase4b-document-email/rollback.sql
SELECT ok('Rollback removes the table', to_regclass('public.document_email_log') IS NULL);
SELECT ok('Rollback removes the helper', NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'document_email_recent_counts'));
\i /tmp/p4b-run/proposal_fail.sql
SELECT ok('A failed apply leaves nothing behind', to_regclass('public.document_email_log') IS NULL AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'document_email_recent_counts'));
\i docs/phase4b-document-email/proposal.sql
SELECT ok('Proposal re-applies cleanly after rollback', to_regclass('public.document_email_log') IS NOT NULL);

SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM results;
