-- Phase 35 tests (disposable local Postgres only). Run by docs/phase35/run-test.sh after the shim and fixture.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.ok(cond boolean, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL|%', name; END IF;
  RAISE WARNING 'PASS|%', name;
END $$;
-- Expect an error whose message contains `want` from running `sql`.
CREATE FUNCTION pg_temp.fails(sql text, want text, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN
    IF position(want in SQLERRM) > 0 THEN RAISE WARNING 'PASS|%', name; RETURN; END IF;
    RAISE EXCEPTION 'FAIL|% (wrong error: %)', name, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL|% (no error)', name;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text), pg_temp.fails(text, text, text) TO PUBLIC;

-- Users: u1 (no subscribers row yet), u2 (paid, 250), admin (super admin, aal2 when asked).
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'u1@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'u2@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'admin@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'gone@example.test');
INSERT INTO public.profiles (id, email, full_name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'u1@example.test', 'User One'),
  ('22222222-2222-4222-8222-222222222222', 'u2@example.test', 'User Two'),
  ('33333333-3333-4333-8333-333333333333', 'admin@example.test', 'Admin');
INSERT INTO public.user_roles (user_id, role) VALUES ('33333333-3333-4333-8333-333333333333', 'super_admin');
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, plan_key, ai_credits_limit, ai_credits_remaining)
VALUES ('22222222-2222-4222-8222-222222222222', 'u2@example.test', true, 'Business', 'business', 250, 250),
       ('44444444-4444-4444-8444-444444444444', 'gone@example.test', true, 'Solo', 'solo', 50, 50);

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== apply'
\i docs/phase35/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.ai_credit_ledger') IS NOT NULL, 'ledger table exists');
  PERFORM pg_temp.ok(to_regprocedure('public.check_and_deduct_ai_credit(uuid,integer)') IS NULL, 'old two-argument deduct is gone');
  PERFORM pg_temp.ok(to_regprocedure('public.refund_ai_credit(uuid,integer)') IS NULL, 'old two-argument refund is gone');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_proc WHERE proname = 'check_and_deduct_ai_credit') = 1, 'one deduct overload');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)'::regprocedure)) x)
    = (SELECT array_agg(x ORDER BY x) FROM unnest('{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'::text[]) x), 'deduct privileges copied exactly');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.refund_ai_credit(uuid,integer,text,uuid)'::regprocedure)) x)
    = (SELECT array_agg(x ORDER BY x) FROM unnest('{postgres=X/postgres,service_role=X/postgres}'::text[]) x), 'refund privileges copied exactly');
  PERFORM pg_temp.ok((SELECT proacl::text FROM pg_proc WHERE oid = 'public.get_ai_credits_info(uuid)'::regprocedure)
    = (SELECT acl FROM public.phase35_function_backup WHERE fn = 'get_ai_credits_info(uuid)'), 'get_ai_credits_info privileges unchanged');
  PERFORM pg_temp.ok(NOT has_function_privilege('anon', 'public.admin_ai_ledger_summary(integer)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.admin_ai_ledger_summary(integer)', 'EXECUTE'), 'summary: authenticated (guarded inside), not anon');
  PERFORM pg_temp.ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_credit_ledger'::regclass)
    AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_model_prices'::regclass), 'RLS on both tables');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_policies WHERE tablename IN ('ai_credit_ledger', 'ai_model_prices')
    AND policyname = 'require_aal2_if_enrolled' AND permissive = 'RESTRICTIVE' AND roles = '{authenticated}') = 2
    AND (SELECT count(*) FROM pg_policies WHERE tablename IN ('ai_credit_ledger', 'ai_model_prices')) = 2, 'only the Phase 25 restrictive policy');
  PERFORM pg_temp.ok((SELECT input_usd_per_million FROM public.ai_model_prices WHERE model = 'gpt-4.1') = 2.00
    AND (SELECT output_usd_per_million FROM public.ai_model_prices WHERE model = 'gpt-4o-mini') = 0.60, 'prices seeded');
END $$;

-- Phase 25 guard log: docs/phase25/rollback.sql strips exactly this line and must land on old_md5.
DO $$
DECLARE r record; src text;
BEGIN
  FOR r IN SELECT * FROM public.phase25_mfa_guard_log WHERE fn IN ('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)',
             'public.get_ai_credits_info(uuid)', 'public.admin_ai_ledger_summary(integer)') LOOP
    SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure(r.fn);
    PERFORM pg_temp.ok(md5(src) = r.new_md5, 'guard log new_md5 matches ' || r.fn);
    PERFORM pg_temp.ok(md5(replace(src, CASE r.kind WHEN 'admin' THEN E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard'
                                                     ELSE E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard' END, '')) = r.old_md5,
                       'guard log old_md5 is the body without the guard ' || r.fn);
  END LOOP;
  PERFORM pg_temp.ok((SELECT count(*) FROM public.phase25_mfa_guard_log) = 4, 'guard log: 3 earlier rows + the summary');
  PERFORM pg_temp.ok((SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_ai_stats(integer)') = 'a9b59459c95004fc16f844843055eb33', 'unrelated guard row untouched');
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== user calls (authenticated, own account)'
SET request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
SET ROLE authenticated;
DO $$
DECLARE j json;
BEGIN
  PERFORM pg_temp.ok((public.get_ai_credits_info('11111111-1111-4111-8111-111111111111') ->> 'credits_limit')::int = 50, 'no row: get_ai_credits_info says 50');
  j := public.check_and_deduct_ai_credit('11111111-1111-4111-8111-111111111111', 10, 'legal_document', 'aaaaaaaa-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'credits_remaining')::int = 40 AND (j ->> 'credits_limit')::int = 50, 'first reserve: 50 granted, 10 taken');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM json_object_keys(j) k) = ARRAY['credits_limit','credits_remaining','reset_date','subscription_tier','success'], 'return shape unchanged');
  -- Two-argument call (the deployed functions before the redeploy) still works.
  j := public.check_and_deduct_ai_credit('11111111-1111-4111-8111-111111111111', 1);
  PERFORM pg_temp.ok((j ->> 'credits_remaining')::int = 39, 'old-style call works (defaults)');
END $$;
SELECT pg_temp.fails($$SELECT public.check_and_deduct_ai_credit('22222222-2222-4222-8222-222222222222', 1)$$, 'Not authorized', 'cannot spend someone else''s credits');
SELECT pg_temp.fails($$SELECT public.check_and_deduct_ai_credit('11111111-1111-4111-8111-111111111111', 1, 'Bad Feature!')$$, 'Invalid feature', 'feature is validated');
SELECT pg_temp.fails($$SELECT public.check_and_deduct_ai_credit('11111111-1111-4111-8111-111111111111', 1001)$$, 'Invalid credit amount', '1..1000 bound kept');
SELECT pg_temp.fails($$SELECT public.refund_ai_credit('11111111-1111-4111-8111-111111111111', 10)$$, 'permission denied', 'users cannot refund');
SELECT pg_temp.fails($$SELECT public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'gpt-4.1', 1, 1)$$, 'permission denied', 'users cannot record usage');
SELECT pg_temp.fails($$SELECT count(*) FROM public.ai_credit_ledger$$, 'permission denied', 'users cannot read the ledger');
SELECT pg_temp.fails($$SELECT count(*) FROM public.ai_model_prices$$, 'permission denied', 'users cannot read prices');
SELECT pg_temp.fails($$SELECT public.admin_ai_ledger_summary(30)$$, 'Not authorized', 'summary refuses non-admins');
RESET ROLE;

-- Enrolled user without aal2: the guard refuses (the frontend shows the quiet error).
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('11111111-1111-4111-8111-111111111111', 'verified');
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.check_and_deduct_ai_credit('11111111-1111-4111-8111-111111111111', 1)$$, 'MFA_REQUIRED', 'phase25 guard kept on deduct');
SELECT pg_temp.fails($$SELECT public.get_ai_credits_info('11111111-1111-4111-8111-111111111111')$$, 'MFA_REQUIRED', 'phase25 guard kept on info');
RESET ROLE;
DELETE FROM auth.mfa_factors;
RESET request.jwt.claims;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== server calls (service_role)'
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$
DECLARE j json;
BEGIN
  j := public.refund_ai_credit('11111111-1111-4111-8111-111111111111', 10, 'legal_document', 'aaaaaaaa-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 10 AND (j ->> 'credits_remaining')::int = 49, 'refund gives 10 back');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM json_object_keys(j) k) = ARRAY['credits_limit','credits_remaining','refunded','reset_date','success'], 'refund return shape unchanged');
  j := public.refund_ai_credit('11111111-1111-4111-8111-111111111111', 10, 'legal_document', 'aaaaaaaa-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'refunded')::int = 0 AND (j ->> 'credits_remaining')::int = 49, 'retry of the same refund refunds 0');
  PERFORM pg_temp.ok((SELECT ai_credits_remaining FROM public.subscribers WHERE user_id = '11111111-1111-4111-8111-111111111111') = 49, 'balance unchanged by the retry');
  -- Cap: at the limit nothing more comes back, but the row is written so a retry is recognised.
  j := public.refund_ai_credit('11111111-1111-4111-8111-111111111111', 5, 'ai_assistant', 'aaaaaaaa-0000-4000-8000-000000000002');
  PERFORM pg_temp.ok((j ->> 'refunded')::int = 1 AND (j ->> 'credits_remaining')::int = 50, 'refund capped at the limit');
  -- Without a request id (old callers): works as before (u2 is at its limit, so nothing comes back).
  j := public.refund_ai_credit('22222222-2222-4222-8222-222222222222', 1);
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND (j ->> 'refunded')::int = 0, 'old-style refund call works (capped)');
  j := public.refund_ai_credit('99999999-9999-4999-8999-999999999999', 1, null, gen_random_uuid());
  PERFORM pg_temp.ok((j ->> 'error') = 'no_subscriber', 'no row: no_subscriber, unchanged');

  j := public.record_ai_usage('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000003', 'legal_document', 'service_agreement', 'gpt-4.1', 2000, 5500);
  PERFORM pg_temp.ok((j ->> 'cost_usd_micros')::bigint = 48000, 'gpt-4.1 2,000 in + 5,500 out = $0.048 (48,000 micros)');
  j := public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'gpt-4o-mini', 3, 1);
  PERFORM pg_temp.ok((j ->> 'cost_usd_micros')::bigint = 1, 'rounds half up (0.45 + 0.6 = 1.05 -> 1)');
  j := public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'gpt-4o-mini', 1, 0);
  PERFORM pg_temp.ok((j ->> 'cost_usd_micros')::bigint = 0, '0.15 rounds to 0');
  j := public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'some-new-model', 100, 100);
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND j ->> 'cost_usd_micros' IS NULL, 'unknown model: NULL cost, no error');
END $$;
SELECT pg_temp.fails($$SELECT public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'gpt-4.1', 2000001, 1)$$, 'Invalid token count', 'absurd token counts refused');
SELECT pg_temp.fails($$SELECT public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'ai_assistant', null, 'gpt-4.1', -1, 1)$$, 'Invalid token count', 'negative tokens refused');
SELECT pg_temp.fails($$SELECT public.record_ai_usage('11111111-1111-4111-8111-111111111111', null, 'legal_document', 'Bad Type', 'gpt-4.1', 1, 1)$$, 'Invalid doc_type', 'doc_type validated');
DO $$
DECLARE j json;
BEGIN
  -- Insufficient: no reserve row.
  j := public.check_and_deduct_ai_credit('22222222-2222-4222-8222-222222222222', 1000, 'legal_document', gen_random_uuid());
  PERFORM pg_temp.ok((j ->> 'success')::boolean IS FALSE AND j ->> 'error' = 'insufficient_credits', 'insufficient: same answer as before');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ai_credit_ledger WHERE user_id = '22222222-2222-4222-8222-222222222222' AND event = 'reserve'), 'insufficient: nothing reserved');
  -- Monthly reset writes a reset row.
  UPDATE public.subscribers SET ai_credits_remaining = 30, ai_credits_reset_date = now() - interval '1 minute' WHERE user_id = '22222222-2222-4222-8222-222222222222';
  j := public.check_and_deduct_ai_credit('22222222-2222-4222-8222-222222222222', 1, 'ai_assistant', 'bbbbbbbb-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok((j ->> 'credits_remaining')::int = 249, 'reset to the limit, then 1 taken');
  PERFORM pg_temp.ok((SELECT credits FROM public.ai_credit_ledger WHERE user_id = '22222222-2222-4222-8222-222222222222' AND event = 'reset') = 220, 'reset row: +220 (30 -> 250)');
  PERFORM pg_temp.ok((SELECT plan_key FROM public.ai_credit_ledger WHERE user_id = '22222222-2222-4222-8222-222222222222' AND event = 'reserve') = 'business', 'reserve row carries the plan');
END $$;
RESET ROLE;
RESET request.jwt.claims;

DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(event || ':' || credits || ':' || coalesce(balance_after::text, '-'), ',' ORDER BY created_at, event)
                        FROM public.ai_credit_ledger WHERE user_id = '11111111-1111-4111-8111-111111111111' AND event IN ('grant', 'reserve', 'refund'))
                      = 'grant:50:50,reserve:-10:40,reserve:-1:39,refund:10:49,refund:1:50', 'u1 history: grant, reserves, one refund per request');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger WHERE request_id = 'aaaaaaaa-0000-4000-8000-000000000001' AND event = 'refund') = 1, 'one refund row per request');
  PERFORM pg_temp.ok((SELECT feature FROM public.ai_credit_ledger WHERE event = 'grant') IS NULL, 'grant row has no feature');
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== append-only'
SELECT pg_temp.fails($$UPDATE public.ai_credit_ledger SET credits = 0$$, 'append-only', 'no UPDATE');
SELECT pg_temp.fails($$DELETE FROM public.ai_credit_ledger$$, 'append-only', 'no DELETE');
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
SELECT public.check_and_deduct_ai_credit('44444444-4444-4444-8444-444444444444', 3, 'ai_assistant', gen_random_uuid());
RESET ROLE; RESET request.jwt.claims;
DELETE FROM auth.users WHERE id = '44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger WHERE user_id IS NULL AND event = 'reserve' AND credits = -3) = 1, 'deleted account: history kept, user_id NULL');
END $$;
INSERT INTO public.ai_credit_ledger (event, feature, credits, created_at) VALUES ('adjust', 'purge_test', 0, now() - interval '26 months');
SELECT pg_temp.fails($$DELETE FROM public.ai_credit_ledger WHERE feature = 'purge_test'$$, 'append-only', 'old rows are not deleted without the purge switch');
BEGIN; SET LOCAL app.ai_ledger_purge = 'on';
DELETE FROM public.ai_credit_ledger WHERE created_at < now() - interval '25 months';
COMMIT;
DO $$ BEGIN PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.ai_credit_ledger WHERE feature = 'purge_test'), 'explicit 25-month purge transaction works'); END $$;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== admin summary'
SET request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.admin_ai_ledger_summary(30)$$, 'MFA_REQUIRED', 'summary needs aal2 for a super admin');
RESET ROLE;
SET request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}';
SET ROLE authenticated;
DO $$
DECLARE s jsonb := public.admin_ai_ledger_summary(30);
BEGIN
  PERFORM pg_temp.ok((s ->> 'credits_spent')::int = 15, 'spent: 10 + 1 + 1 + 3');
  PERFORM pg_temp.ok((s ->> 'credits_refunded')::int = 11, 'refunded: 10 + 1 (+ 0 capped)');
  PERFORM pg_temp.ok((s ->> 'net_credits')::int = 4, 'net');
  PERFORM pg_temp.ok((s ->> 'requests')::int = 4, 'requests = reserves');
  PERFORM pg_temp.ok((s ->> 'cost_usd')::numeric = 0.048001, 'cost in USD');
  PERFORM pg_temp.ok((s ->> 'unpriced_calls')::int = 1, 'unpriced calls counted');
  PERFORM pg_temp.ok((s ->> 'refund_rate')::numeric = 0.5, 'refund rate = refunds that gave credits back / requests');
  PERFORM pg_temp.ok(jsonb_array_length(s -> 'by_day') = 30, '30 days');
  PERFORM pg_temp.ok((SELECT (x ->> 'requests')::int FROM jsonb_array_elements(s -> 'by_feature') x WHERE x ->> 'feature' = 'legal_document') = 1, 'by feature: legal_document');
  PERFORM pg_temp.ok((SELECT x ->> 'user_name' FROM jsonb_array_elements(s -> 'top_users') x WHERE x ->> 'user_id' IS NULL) = 'Deleted account', 'top users: deleted account named');
  PERFORM pg_temp.ok((SELECT (x ->> 'documents')::int FROM jsonb_array_elements(s -> 'documents_by_type') x WHERE x ->> 'doc_type' = 'service_agreement') = 1, 'documents by type');
  PERFORM pg_temp.ok((s -> 'by_day' -> 29 ->> 'credits')::int = 4, 'today''s net credits');
END $$;
RESET ROLE; RESET request.jwt.claims;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== rollback'
\i docs/phase35/rollback.sql
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.check_and_deduct_ai_credit(uuid,integer)'::regprocedure) = 'be23bdba849254ef8dda291c9beee2e5', 'deduct body = production');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.get_ai_credits_info(uuid)'::regprocedure) = '2cac6615542d149b7ae9b126b1388280', 'info body = production');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.refund_ai_credit(uuid,integer)'::regprocedure) = '95d05a5b34ea3acaeffd955c43eb67c0', 'refund body = production');
  PERFORM pg_temp.ok((SELECT count(*) FROM pg_proc WHERE proname IN ('check_and_deduct_ai_credit', 'refund_ai_credit')) = 2, 'no new overloads left');
  PERFORM pg_temp.ok(to_regprocedure('public.record_ai_usage(uuid,uuid,text,text,text,integer,integer)') IS NULL AND to_regprocedure('public.admin_ai_ledger_summary(integer)') IS NULL, 'new functions dropped');
  PERFORM pg_temp.ok(to_regclass('public.ai_credit_ledger') IS NULL AND to_regclass('public.ai_model_prices') IS NULL AND to_regclass('public.phase35_function_backup') IS NULL, 'new tables dropped');
  PERFORM pg_temp.ok((SELECT string_agg(fn || ' ' || old_md5 || ' ' || new_md5, ',' ORDER BY fn) FROM public.phase25_mfa_guard_log) =
    'public.admin_ai_stats(integer) 5a17153d6ec7b5ba4ce88951c9718d32 a9b59459c95004fc16f844843055eb33,public.check_and_deduct_ai_credit(uuid,integer) 53eb000e38a6e12091f01db15d67fe33 be23bdba849254ef8dda291c9beee2e5,public.get_ai_credits_info(uuid) a7798e0139e35a8b906cda0e646dd01f 2cac6615542d149b7ae9b126b1388280',
    'guard log = production rows');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.check_and_deduct_ai_credit(uuid,integer)'::regprocedure)) x)
    = (SELECT array_agg(x ORDER BY x) FROM unnest('{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'::text[]) x), 'deduct privileges restored');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.refund_ai_credit(uuid,integer)'::regprocedure)) x)
    = (SELECT array_agg(x ORDER BY x) FROM unnest('{postgres=X/postgres,service_role=X/postgres}'::text[]) x), 'refund privileges restored');
END $$;

\echo '== apply again after rollback'
\i docs/phase35/proposal.sql
DO $$ BEGIN PERFORM pg_temp.ok(to_regclass('public.ai_credit_ledger') IS NOT NULL, 're-apply after rollback works'); END $$;
