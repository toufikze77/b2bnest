-- Phase 36 tests (disposable local Postgres only). Run by docs/phase36/run-test.sh after the Phase 35 shim, fixture and
-- proposal and docs/phase36/fixture.sql.
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

CREATE FUNCTION pg_temp.ok(cond boolean, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAIL|%', name; END IF;
  RAISE WARNING 'PASS|%', name;
END $$;
CREATE FUNCTION pg_temp.fails(sql text, want text, name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE sql; EXCEPTION WHEN OTHERS THEN
    IF position(want in SQLERRM) > 0 THEN RAISE WARNING 'PASS|%', name; RETURN; END IF;
    RAISE EXCEPTION 'FAIL|% (wrong error: %)', name, SQLERRM;
  END;
  RAISE EXCEPTION 'FAIL|% (no error)', name;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean, text), pg_temp.fails(text, text, text) TO PUBLIC;

-- People and companies.
INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'admin@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'owner.a@example.test'),
  ('a0000000-0000-4000-8000-000000000003', 'owner.b@example.test'),
  ('a0000000-0000-4000-8000-000000000004', 'owner.c@example.test'),
  ('a0000000-0000-4000-8000-000000000005', 'owner.d@example.test'),
  ('a0000000-0000-4000-8000-000000000006', 'heavy@example.test');
INSERT INTO public.user_roles (user_id, role) VALUES ('a0000000-0000-4000-8000-000000000001', 'super_admin');
INSERT INTO public.profiles (id, email, full_name, company, trial_ends_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'admin@example.test', 'Admin', null, null),
  ('a0000000-0000-4000-8000-000000000002', 'owner.a@example.test', 'Owner A', null, now() + interval '3 days'),     -- listed
  ('a0000000-0000-4000-8000-000000000003', 'owner.b@example.test', 'Owner B', null, now() + interval '10 days'),    -- too far
  ('a0000000-0000-4000-8000-000000000004', 'owner.c@example.test', 'Owner C', null, now() + interval '2 days'),     -- subscribed
  ('a0000000-0000-4000-8000-000000000005', 'owner.d@example.test', 'Owner D', null, now() + interval '1 day'),      -- suspended
  ('a0000000-0000-4000-8000-000000000006', 'heavy@example.test', 'Heavy User', 'Heavy Co (profile)', null);
INSERT INTO public.organizations (name, created_by, status, is_active) VALUES
  ('Acme Ltd', 'a0000000-0000-4000-8000-000000000002', 'active', true),
  ('Far Away Ltd', 'a0000000-0000-4000-8000-000000000003', 'active', true),
  ('Paid Ltd', 'a0000000-0000-4000-8000-000000000004', 'active', true),
  ('Suspended Ltd', 'a0000000-0000-4000-8000-000000000005', 'suspended', true),
  ('Heavy Co', 'a0000000-0000-4000-8000-000000000006', 'active', true);
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, subscription_tier, plan_key, ai_credits_limit, ai_credits_remaining) VALUES
  ('a0000000-0000-4000-8000-000000000004', 'owner.c@example.test', true, 'active', 'Starter', 'starter', 250, 250),
  ('a0000000-0000-4000-8000-000000000006', 'heavy@example.test', true, 'active', 'Professional', 'professional', 1000, 1000);
-- 30 more companies whose trial ends in 5 days, to check the cap of 25.
INSERT INTO public.profiles (id, email, full_name, trial_ends_at)
SELECT ('b0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'bulk' || g || '@example.test', 'Bulk ' || g, now() + interval '5 days'
  FROM generate_series(1, 30) g;
INSERT INTO public.organizations (name, created_by)
SELECT 'Bulk ' || lpad(g::text, 2, '0') || ' Ltd', ('b0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid FROM generate_series(1, 30) g;

-- AI activity through the real Phase 35 functions (as the Edge Functions do, service role).
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
SELECT public.check_and_deduct_ai_credit('a0000000-0000-4000-8000-000000000006', 10, 'legal_document', 'c0000000-0000-4000-8000-000000000001');
SELECT public.record_ai_usage('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'legal_document', 'service_agreement', 'gpt-4.1', 2000, 5500);
SELECT public.check_and_deduct_ai_credit('a0000000-0000-4000-8000-000000000006', 10, 'legal_document', 'c0000000-0000-4000-8000-000000000002');
SELECT public.record_ai_usage('a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'legal_document', 'nda_mutual', 'gpt-4.1', 1000, 300);
SELECT public.refund_ai_credit('a0000000-0000-4000-8000-000000000006', 10, 'legal_document', 'c0000000-0000-4000-8000-000000000002');
SELECT public.check_and_deduct_ai_credit('a0000000-0000-4000-8000-000000000004', 1, 'ai_assistant', 'c0000000-0000-4000-8000-000000000003');
SELECT public.record_ai_usage('a0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000003', 'ai_assistant', null, 'gpt-4o-mini', 1000, 1000);
RESET ROLE; RESET request.jwt.claims;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== apply'
\i docs/phase36/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regprocedure('public.admin_overview_series(text,integer)') IS NOT NULL, 'function exists');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.admin_overview_series(text,integer)'::regprocedure)) x)
    = ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres'], 'privileges: authenticated, service_role, postgres');
  PERFORM pg_temp.ok(NOT has_function_privilege('anon', 'public.admin_overview_series(text,integer)', 'EXECUTE'), 'anon cannot execute');
  PERFORM pg_temp.ok((SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public.admin_overview_series(text,integer)'::regprocedure), 'SECURITY DEFINER, search_path pinned');
  PERFORM pg_temp.ok((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_overview_series(text,integer)'::regprocedure)
    = (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_overview_series(text,integer)'), 'guard log new_md5');
  PERFORM pg_temp.ok((SELECT md5(replace(prosrc, E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard', '')) FROM pg_proc WHERE oid = 'public.admin_overview_series(text,integer)'::regprocedure)
    = (SELECT old_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_overview_series(text,integer)' AND kind = 'admin'), 'guard log old_md5 (Phase 25 rollback strips the guard)');
END $$;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== access'
SELECT pg_temp.fails($$SELECT public.admin_overview_series('ai_daily', 30)$$, 'permission denied', 'anon refused') FROM (SELECT set_config('role', 'anon', false)) s;
RESET ROLE;
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.admin_overview_series('ai_daily', 30)$$, 'Not authorized', 'a normal user is refused');
RESET ROLE;
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.admin_overview_series('ai_daily', 30)$$, 'MFA_REQUIRED', 'a super admin without aal2 is refused');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== metrics (super admin, aal2)'
SET request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SET ROLE authenticated;
SELECT pg_temp.fails($$SELECT public.admin_overview_series('everything', 30)$$, 'Unknown metric', 'unknown metric refused');
DO $$
DECLARE j jsonb; r jsonb;
BEGIN
  j := public.admin_overview_series('trials_ending', 30);
  PERFORM pg_temp.ok(jsonb_array_length(j) = 25, 'trials ending: capped at 25');
  PERFORM pg_temp.ok(j -> 0 ->> 'company' = 'Acme Ltd' AND (j -> 0 ->> 'days_left')::int = 3 AND j -> 0 ->> 'owner_email' = 'owner.a@example.test', 'trials ending: soonest first, with owner email and days left');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) x WHERE x ->> 'company' IN ('Far Away Ltd', 'Paid Ltd', 'Suspended Ltd')), 'trials ending: excludes > 7 days, subscribed, suspended');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j -> 0) k) = ARRAY['company','company_id','days_left','owner_email','trial_ends_at'], 'trials ending: only these fields');

  j := public.admin_overview_series('ai_by_plan', 30);
  SELECT x INTO r FROM jsonb_array_elements(j) x WHERE x ->> 'plan_key' = 'professional';
  PERFORM pg_temp.ok((r ->> 'credits')::int = 10 AND (r ->> 'requests')::int = 2 AND (r ->> 'cost_usd')::numeric = 0.0524, 'by plan: Business net credits, requests, cost (48,000 + 4,400 micros)');
  PERFORM pg_temp.ok((r ->> 'subscribers')::int = 1 AND (r ->> 'monthly_price_pence')::int = 5900, 'by plan: subscribers and the current (not legacy) monthly price');
  SELECT x INTO r FROM jsonb_array_elements(j) x WHERE x ->> 'plan_key' = 'enterprise';
  PERFORM pg_temp.ok((r ->> 'credits')::int = 0 AND (r ->> 'monthly_price_pence')::int = 8900, 'by plan: a plan with no use is listed with 0');
  PERFORM pg_temp.ok((SELECT count(*) FROM jsonb_array_elements(j)) = 3, 'by plan: starter, professional, enterprise');

  j := public.admin_overview_series('ai_top_users', 30);
  PERFORM pg_temp.ok(j -> 0 ->> 'email' = 'heavy@example.test' AND j -> 0 ->> 'company' = 'Heavy Co' AND (j -> 0 ->> 'credits')::int = 10
                     AND (j -> 0 ->> 'credits_limit')::int = 1000 AND j -> 0 ->> 'plan' = 'professional', 'top users: email, company from the organisation, credits, limit, plan');
  PERFORM pg_temp.ok((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(j -> 0) k)
    = ARRAY['company','cost_usd','credits','credits_limit','credits_remaining','email','name','plan','requests','user_id'], 'top users: only these fields (no content)');
  PERFORM pg_temp.ok(jsonb_array_length(j) <= 10, 'top users: at most 10');

  j := public.admin_overview_series('ai_daily', 30);
  PERFORM pg_temp.ok(jsonb_array_length(j) = 30, 'daily: 30 days');
  r := j -> 29;
  PERFORM pg_temp.ok((r ->> 'requests')::int = 3 AND (r ->> 'refunded_requests')::int = 1 AND (r ->> 'credits_spent')::int = 21 AND (r ->> 'credits_refunded')::int = 10, 'daily: today''s requests, refunds, credits');
  PERFORM pg_temp.ok(jsonb_array_length(public.admin_overview_series('ai_daily', 7)) = 7 AND jsonb_array_length(public.admin_overview_series('ai_daily', 9999)) = 365
                     AND jsonb_array_length(public.admin_overview_series('ai_daily', 0)) = 1, 'daily: days clamped to 1..365');
END $$;
RESET ROLE; RESET request.jwt.claims;

-- Empty ledger: every metric still answers, with zeros and empty lists (never an error).
BEGIN;
SET LOCAL app.ai_ledger_purge = 'on';
DELETE FROM public.ai_credit_ledger;
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM pg_temp.ok(public.admin_overview_series('ai_top_users', 30) = '[]'::jsonb, 'empty ledger: top users []');
  PERFORM pg_temp.ok((SELECT bool_and((x ->> 'credits')::int = 0) FROM jsonb_array_elements(public.admin_overview_series('ai_by_plan', 30)) x), 'empty ledger: by plan all 0');
  PERFORM pg_temp.ok((SELECT bool_and((x ->> 'requests')::int = 0) FROM jsonb_array_elements(public.admin_overview_series('ai_daily', 30)) x), 'empty ledger: daily all 0');
END $$;
ROLLBACK;

-- ---------------------------------------------------------------------------------------------------------------------
\echo '== rollback'
\i docs/phase36/rollback.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regprocedure('public.admin_overview_series(text,integer)') IS NULL, 'function dropped');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_overview_series(text,integer)'), 'guard log row removed');
  PERFORM pg_temp.ok((SELECT count(*) FROM public.ai_credit_ledger) = 7, 'ledger untouched by rollback');
END $$;
\echo '== apply again'
\i docs/phase36/proposal.sql
DO $$ BEGIN PERFORM pg_temp.ok(to_regprocedure('public.admin_overview_series(text,integer)') IS NOT NULL, 're-apply after rollback works'); END $$;
