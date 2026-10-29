-- Phase 20 test (throwaway Postgres 16 only; run-test.sh). Baseline = production today: check_and_deduct_ai_credit
-- verbatim from production (fixture-live.sql). Applies proposal.sql, checks every rule, then rollback.sql.
-- The concurrency check (many requests at once at the limit) runs from run-test.sh with parallel connections.
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
\i fixture-live.sql
GRANT SELECT, INSERT, UPDATE ON public.subscribers TO service_role;

SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION fresh(q text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLERRM; END $$;
CREATE FUNCTION as_user_val(u uuid, q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
CREATE FUNCTION as_anon_val(q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  SET LOCAL ROLE anon; BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END; RESET ROLE; RETURN v; END $$;
CREATE FUNCTION as_service_val(q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role; BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
GRANT ALL ON r TO anon, authenticated, service_role; GRANT USAGE ON SEQUENCE r_n_seq TO anon, authenticated, service_role;

\set ANA '''aaaaaaaa-0000-4000-8000-000000000001'''
\set BOB '''bbbbbbbb-0000-4000-8000-000000000002'''
INSERT INTO auth.users VALUES (:ANA, 'ana@example.test'), (:BOB, 'bob@example.test');
INSERT INTO public.subscribers(user_id, email, subscription_tier, ai_credits_limit, ai_credits_remaining)
  VALUES (:ANA, 'ana@example.test', 'Starter', 250, 2), (:BOB, 'bob@example.test', 'Professional', 1000, 1000);

-- ===== Before (production today) =====
SELECT ok('before: the live check_and_deduct_ai_credit has the hash the guard expects',
  md5(pg_get_functiondef('public.check_and_deduct_ai_credit(uuid, integer)'::regprocedure)) = 'c19946704eca6184e29581d8fb5bb26e');
SELECT ok('before: there is no way to give a credit back', to_regprocedure('public.refund_ai_credit(uuid, integer)') IS NULL);

-- ===== Apply =====
\i proposal.sql
SELECT ok('apply: refund_ai_credit exists, SECURITY DEFINER, search_path empty',
  fresh($$SELECT prosecdef::text || '|' || array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.refund_ai_credit(uuid, integer)'::regprocedure$$) = 'true|search_path=""');
SELECT ok('apply: only service_role (and the owner) may execute it',
  NOT has_function_privilege('anon', 'public.refund_ai_credit(uuid, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.refund_ai_credit(uuid, integer)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.refund_ai_credit(uuid, integer)', 'EXECUTE'));
SELECT ok('apply: check_and_deduct_ai_credit unchanged (same hash, same grants)',
  md5(pg_get_functiondef('public.check_and_deduct_ai_credit(uuid, integer)'::regprocedure)) = 'c19946704eca6184e29581d8fb5bb26e'
  AND has_function_privilege('authenticated', 'public.check_and_deduct_ai_credit(uuid, integer)', 'EXECUTE'));

-- ===== Rules =====
SELECT ok('a signed-in user cannot call it, even for themselves',
  as_user_val(:ANA, $$SELECT public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 5)::text$$) LIKE 'ERROR permission denied%');
SELECT ok('anon cannot call it', as_anon_val($$SELECT public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001')::text$$) LIKE 'ERROR permission denied%');

-- Reserve, then refund: the balance ends where it started.
SELECT ok('reserve: the deduct takes 1 credit (2 → 1)',
  as_service_val($$SELECT (public.check_and_deduct_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1)->>'credits_remaining')$$) = '1');
SELECT ok('refund: gives exactly that credit back (1 → 2), refunded = 1',
  as_service_val($$SELECT (r->>'credits_remaining') || '|' || (r->>'refunded') FROM public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1) r$$) = '2|1');

-- At the limit: deduct refuses; refund never goes above the limit.
UPDATE public.subscribers SET ai_credits_remaining = 250 WHERE user_id = :ANA;
SELECT ok('refund at the limit gives nothing (stays 250, refunded = 0)',
  as_service_val($$SELECT (r->>'credits_remaining') || '|' || (r->>'refunded') FROM public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1) r$$) = '250|0');
UPDATE public.subscribers SET ai_credits_remaining = 249 WHERE user_id = :ANA;
SELECT ok('refund of 5 when 1 below the limit stops at the limit (249 → 250, refunded = 1)',
  as_service_val($$SELECT (r->>'credits_remaining') || '|' || (r->>'refunded') FROM public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 5) r$$) = '250|1');
UPDATE public.subscribers SET ai_credits_remaining = 300 WHERE user_id = :ANA;
SELECT ok('a balance already above the limit is never lowered by a refund (300 stays 300)',
  as_service_val($$SELECT (r->>'credits_remaining') FROM public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1) r$$) = '300');

-- After the monthly reset the deduct refilled the balance; a late refund can't push it past the limit.
UPDATE public.subscribers SET ai_credits_remaining = 0, ai_credits_reset_date = now() - interval '1 day' WHERE user_id = :ANA;
SELECT ok('deduct after the reset date refills to the limit and takes 1 (→ 249)',
  as_service_val($$SELECT (public.check_and_deduct_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1)->>'credits_remaining')$$) = '249');
SELECT ok('refund afterwards: back to 250, never 251',
  as_service_val($$SELECT (public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1)->>'credits_remaining')$$) = '250');

-- At zero: the deduct refuses, and a refused deduct is never refunded by the function code (nothing was taken).
UPDATE public.subscribers SET ai_credits_remaining = 0 WHERE user_id = :ANA;
SELECT ok('at 0 credits the deduct refuses (success false, insufficient_credits)',
  as_service_val($$SELECT (r->>'success') || '|' || (r->>'error') FROM public.check_and_deduct_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1) r$$) = 'false|insufficient_credits');

SELECT ok('invalid amounts are refused (0, -1, 1001, null user)',
  as_service_val($$SELECT public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 0)::text$$) LIKE 'ERROR Invalid credit amount%'
  AND as_service_val($$SELECT public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', -1)::text$$) LIKE 'ERROR Invalid credit amount%'
  AND as_service_val($$SELECT public.refund_ai_credit('aaaaaaaa-0000-4000-8000-000000000001', 1001)::text$$) LIKE 'ERROR Invalid credit amount%'
  AND as_service_val($$SELECT public.refund_ai_credit(NULL, 1)::text$$) LIKE 'ERROR Invalid credit amount%');
SELECT ok('no subscriber row: nothing created, refunded = 0',
  as_service_val($$SELECT (r->>'success') || '|' || (r->>'refunded') FROM public.refund_ai_credit('cccccccc-0000-4000-8000-000000000003', 1) r$$) = 'false|0'
  AND fresh($$SELECT count(*)::text FROM public.subscribers WHERE user_id = 'cccccccc-0000-4000-8000-000000000003'$$) = '0');
SELECT ok('another user''s balance is untouched (Bob still 1000)', fresh($$SELECT ai_credits_remaining::text FROM public.subscribers WHERE user_id = 'bbbbbbbb-0000-4000-8000-000000000002'$$) = '1000');

-- ===== Rollback =====
\i rollback.sql
SELECT ok('rollback: refund_ai_credit removed', to_regprocedure('public.refund_ai_credit(uuid, integer)') IS NULL);
SELECT ok('rollback: check_and_deduct_ai_credit still exactly as live',
  md5(pg_get_functiondef('public.check_and_deduct_ai_credit(uuid, integer)'::regprocedure)) = 'c19946704eca6184e29581d8fb5bb26e');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR detail = '' THEN '' ELSE ' (' || detail || ')' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
