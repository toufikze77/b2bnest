-- Phase 15 test (throwaway Postgres 16 only; run-test.sh). Baseline = production today: workflow_run_logs exactly as
-- live (fixture-live.sql). Shows today's problems, applies proposal.sql, checks every rule, then rollback.sql.
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
\i fixture-live.sql

SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION try(stmt text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE stmt; RETURN 'OK'; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLSTATE || ' ' || SQLERRM; END $$;
CREATE FUNCTION fresh(q text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- Run one statement as a signed-in user (sub = uuid), as anon, or as the service role.
CREATE FUNCTION as_user(u uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; res := try(stmt); RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN res; END $$;
CREATE FUNCTION as_user_val(u uuid, q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
CREATE FUNCTION as_anon(stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  SET LOCAL ROLE anon; res := try(stmt); RESET ROLE; RETURN res; END $$;
CREATE FUNCTION as_service(stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  SET LOCAL ROLE service_role; res := try(stmt); RESET ROLE; RETURN res; END $$;
GRANT ALL ON r TO anon, authenticated, service_role; GRANT USAGE ON SEQUENCE r_n_seq TO anon, authenticated, service_role;

\set ANA '''aaaaaaaa-0000-4000-8000-000000000001'''
\set BOB '''bbbbbbbb-0000-4000-8000-000000000002'''
\set WF  '''f0000000-0000-4000-8000-0000000000f1'''
\set RUN '''e0000000-0000-4000-8000-0000000000e1'''

-- ===== Before (production today) =====
SELECT ok('before: a signed-in user can write their own "ok" (sent) row from the browser: the forgery problem',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, workflow_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000f1', 'email.send', 'ok', 'smtp')$$) = 'OK');
SELECT ok('before: anon and authenticated hold TRUNCATE (not covered by RLS)',
  has_table_privilege('anon', 'public.workflow_run_logs', 'TRUNCATE') AND has_table_privilege('authenticated', 'public.workflow_run_logs', 'TRUNCATE'));
SELECT ok('before: status "unknown" cannot be stored', as_service($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'unknown', 'smtp')$$) LIKE 'ERROR 23514%');
-- An older server row (as workflow-execute writes today) that must survive.
SELECT ok('fixture: an older WhatsApp row from the server',
  as_service($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider, request_summary) VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'whatsapp.send', 'error', 'twilio', '{"channel":"whatsapp","body_length":5}')$$) = 'OK');

-- ===== Apply =====
\i proposal.sql

SELECT ok('after: existing rows are kept', fresh('SELECT count(*) FROM public.workflow_run_logs') = '2');
SELECT ok('after: a browser can no longer write a "sent" (ok) row',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'ok', 'smtp')$$) LIKE 'ERROR 42501%');
SELECT ok('after: nor an "error" or "unknown" row',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'error', 'none')$$) LIKE 'ERROR 42501%'
  AND as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'unknown', 'none')$$) LIKE 'ERROR 42501%');
SELECT ok('after: a browser may record its own skipped step (provider none) with run id and step number',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, workflow_id, run_id, step_index, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000e1', 1, 'x.post', 'skipped', 'none')$$) = 'OK');
SELECT ok('after: a skipped row claiming a real provider is refused',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'x.post', 'skipped', 'smtp')$$) LIKE 'ERROR 42501%');
SELECT ok('after: nobody can write a row for someone else',
  as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('bbbbbbbb-0000-4000-8000-000000000002', 'x.post', 'skipped', 'none')$$) LIKE 'ERROR 42501%');
SELECT ok('after: the server (service role) writes ok / error / unknown rows with run id and step',
  as_service($$INSERT INTO public.workflow_run_logs(user_id, workflow_id, run_id, step_index, step, status, provider, request_summary, response_summary) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000e1', 0, 'email.send', 'ok', 'smtp', '{"recipients":2}', '{"code":"accepted","message":"Accepted by the email provider."}'),
    ('aaaaaaaa-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000e1', 2, 'email.send', 'unknown', 'smtp', '{}', '{"code":"timeout"}'),
    ('aaaaaaaa-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000f1', 'e0000000-0000-4000-8000-0000000000e1', 3, 'email.send', 'error', 'smtp', '{}', '{"code":"provider_rejected"}')$$) = 'OK');
SELECT ok('after: other statuses are refused (no "sent", no "delivered")',
  as_service($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'delivered', 'smtp')$$) LIKE 'ERROR 23514%');
SELECT ok('after: step number must be 0-9',
  as_service($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider, step_index) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'ok', 'smtp', 10)$$) LIKE 'ERROR 23514%');
SELECT ok('after: a summary big enough to hold a message body is refused',
  as_service(format($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider, response_summary) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'ok', 'smtp', %L)$$, json_build_object('message', repeat('x', 2100))::text)) LIKE 'ERROR 23514%');

SELECT ok('after: Ana reads only her own rows (the 1 forged before + 1 skipped + 3 server rows)',
  as_user_val(:ANA, 'SELECT count(*) FROM public.workflow_run_logs') = '5');
SELECT ok('after: Bob reads only his own row, never Ana''s',
  as_user_val(:BOB, 'SELECT count(*) FROM public.workflow_run_logs') = '1'
  AND as_user_val(:BOB, $$SELECT count(*) FROM public.workflow_run_logs WHERE user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = '0');
SELECT ok('after: a run groups by run id in step order', as_user_val(:ANA,
  $$SELECT string_agg(step_index || ':' || status, ',' ORDER BY step_index) FROM public.workflow_run_logs WHERE run_id = 'e0000000-0000-4000-8000-0000000000e1'$$) = '0:ok,1:skipped,2:unknown,3:error');
SELECT ok('after: anon can read nothing', as_anon('SELECT count(*) FROM public.workflow_run_logs') LIKE 'ERROR 42501%');
SELECT ok('after: users can''t update, delete or truncate',
  as_user(:ANA, 'UPDATE public.workflow_run_logs SET status = ''ok''') LIKE 'ERROR 42501%'
  AND as_user(:ANA, 'DELETE FROM public.workflow_run_logs') LIKE 'ERROR 42501%'
  AND as_user(:ANA, 'TRUNCATE public.workflow_run_logs') LIKE 'ERROR 42501%'
  AND as_anon('TRUNCATE public.workflow_run_logs') LIKE 'ERROR 42501%');
SELECT ok('after: grants are exactly SELECT, INSERT for authenticated and nothing for anon',
  fresh($$SELECT string_agg(grantee || ':' || privilege_type, ',' ORDER BY grantee, privilege_type) FROM information_schema.role_table_grants
          WHERE table_schema = 'public' AND table_name = 'workflow_run_logs' AND grantee IN ('anon', 'authenticated')$$) = 'authenticated:INSERT,authenticated:SELECT');
SELECT ok('after: RLS is on', fresh($$SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.workflow_run_logs'::regclass$$) = 'true');
SELECT ok('after: the history index exists', to_regclass('public.workflow_run_logs_user_workflow_created_idx') IS NOT NULL);

-- ===== Rollback =====
\i rollback.sql
SELECT ok('rollback: run_id and step_index removed', fresh($$SELECT count(*) FROM information_schema.columns WHERE table_name = 'workflow_run_logs' AND column_name IN ('run_id', 'step_index')$$) = '0');
SELECT ok('rollback: Phase 15-only rows (unknown, skipped) removed; ok and error rows kept',
  fresh('SELECT string_agg(status, '','' ORDER BY status) FROM public.workflow_run_logs') = 'error,error,ok,ok');
SELECT ok('rollback: live policies back', fresh($$SELECT string_agg(policyname, ' | ' ORDER BY policyname) FROM pg_policies WHERE tablename = 'workflow_run_logs'$$) = 'Users insert own run logs | Users view own run logs');
SELECT ok('rollback: live grants back', has_table_privilege('anon', 'public.workflow_run_logs', 'TRUNCATE')
  AND as_user(:ANA, $$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'ok', 'smtp')$$) = 'OK');
SELECT ok('rollback: live status check back', as_service($$INSERT INTO public.workflow_run_logs(user_id, step, status, provider) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'email.send', 'unknown', 'smtp')$$) LIKE 'ERROR 23514%');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR detail = '' THEN '' ELSE ' (' || detail || ')' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
