-- Phase 22 test (throwaway Postgres 16 only; run-test.sh). Baseline = production today: the three Admin functions
-- verbatim (fixture-live.sql). Shows today's wrong figures, applies proposal.sql, checks every rule, then rollback.sql.
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
-- Run a query as a signed-in user (sub = uuid) and return its text value (or the error).
CREATE FUNCTION as_user_val(u uuid, q text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; BEGIN EXECUTE q INTO v; EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
GRANT ALL ON r TO anon, authenticated, service_role; GRANT USAGE ON SEQUENCE r_n_seq TO anon, authenticated, service_role;

\set ADM '''a0000000-0000-4000-8000-000000000000'''
-- One account of each kind (no real data): a super admin; Business monthly (today's price); legacy Business monthly;
-- Scale annual; Solo monthly; a cancelled Scale; a checkout never paid (incomplete_expired); a trial; trial ended;
-- suspended; and the old "free" row check-subscription writes.
INSERT INTO auth.users(id, email) SELECT ('a000000' || i || '-0000-4000-8000-000000000000')::uuid, 'u' || i || '@example.test' FROM generate_series(0,9) i;
INSERT INTO public.profiles(id, email) SELECT id, email FROM auth.users;
INSERT INTO public.user_roles VALUES (:ADM, 'super_admin');
INSERT INTO public.subscribers(user_id, email, subscribed, subscription_tier, plan_key, billing_interval, subscription_status, stripe_price_id, subscription_end) VALUES
  ('a0000001-0000-4000-8000-000000000000', 'u1', true,  'Professional', 'professional', 'month', 'active',  'price_biz_m',    now() + interval '20 days'),
  ('a0000002-0000-4000-8000-000000000000', 'u2', true,  'Professional', 'professional', 'month', 'active',  'price_proleg_m', now() + interval '20 days'),
  ('a0000003-0000-4000-8000-000000000000', 'u3', true,  'Enterprise',   'enterprise',   'year',  'active',  'price_scale_y',  now() + interval '200 days'),
  ('a0000004-0000-4000-8000-000000000000', 'u4', true,  'Starter',      'starter',      'month', 'active',  'price_unmapped', now() + interval '20 days'),
  ('a0000005-0000-4000-8000-000000000000', 'u5', false, 'Enterprise',   'enterprise',   'month', 'canceled','price_scale_m',  now() - interval '10 days'),
  ('a0000006-0000-4000-8000-000000000000', 'u6', false, 'Professional', 'professional', 'month', 'incomplete_expired', 'price_biz_m', now() - interval '5 days'),
  ('a0000007-0000-4000-8000-000000000000', 'u7', false, 'free',          NULL,          NULL,    NULL,       NULL,            NULL);
INSERT INTO public.fixture_access VALUES
  ('a0000000-0000-4000-8000-000000000000','owner',NULL,'self'), ('a0000001-0000-4000-8000-000000000000','subscribed','professional','self'),
  ('a0000002-0000-4000-8000-000000000000','subscribed','professional','self'), ('a0000003-0000-4000-8000-000000000000','subscribed','enterprise','self'),
  ('a0000004-0000-4000-8000-000000000000','subscribed','starter','self'), ('a0000005-0000-4000-8000-000000000000','trial_ended',NULL,'self'),
  ('a0000006-0000-4000-8000-000000000000','trial_ended',NULL,'self'), ('a0000007-0000-4000-8000-000000000000','trial',NULL,'self'),
  ('a0000008-0000-4000-8000-000000000000','trial',NULL,'self'), ('a0000009-0000-4000-8000-000000000000','suspended',NULL,'self');
UPDATE public.profiles SET is_active = false WHERE id = 'a0000009-0000-4000-8000-000000000000';

-- ===== Before (production today) =====
SELECT ok('before: MRR counts every subscribed row at the fixed monthly price for its tier (59+59+89+19 = 226)',
  as_user_val(:ADM, $$SELECT (public.admin_overview_stats()->>'mrr')$$) = '226');
SELECT ok('before: the legacy Business subscriber is valued at £59 (pays £35) and the annual Scale one at £89/month (pays £890/year)',
  as_user_val(:ADM, $$SELECT string_agg((x->>'value'), ',' ORDER BY x->>'email') FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' IN ('u2','u3')$$) = '59,89');
SELECT ok('before: a cancelled row still shows a Value (£89)',
  as_user_val(:ADM, $$SELECT x->>'value' FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' = 'u5'$$) = '89');
SELECT ok('before: a checkout that was never paid is labelled "cancelled"',
  as_user_val(:ADM, $$SELECT x->>'status' FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' = 'u6'$$) = 'cancelled');
SELECT ok('before: the row check-subscription writes for a non-payer has plan "free" and status "free"',
  as_user_val(:ADM, $$SELECT (x->>'plan') || '|' || (x->>'status') FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' = 'u7'$$) = 'free|free');

-- ===== Apply =====
\i proposal.sql

SELECT ok('apply: plan_prices has the 10 catalogue prices (6 current, 4 legacy) and no browser access',
  (SELECT count(*) FROM public.plan_prices) = 10 AND (SELECT count(*) FILTER (WHERE legacy) FROM public.plan_prices) = 4
  AND NOT has_table_privilege('authenticated', 'public.plan_prices', 'SELECT') AND NOT has_table_privilege('anon', 'public.plan_prices', 'SELECT'));
SELECT ok('apply: every replaced function has search_path empty; the helper is not callable by signed-in users',
  (SELECT bool_and(array_to_string(proconfig, ',') = 'search_path=""') FROM pg_proc WHERE proname IN ('admin_overview_stats','admin_list_subscriptions','admin_list_users','_subscriber_monthly_value'))
  AND NOT has_function_privilege('authenticated', 'public._subscriber_monthly_value(text,boolean,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.admin_overview_stats()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_overview_stats()', 'EXECUTE'));
SELECT ok('a non-admin still gets "Not authorized"',
  as_user_val('a0000001-0000-4000-8000-000000000000', $$SELECT public.admin_overview_stats()::text$$) LIKE 'ERROR%Not authorized%');

-- Price ids not mapped yet: everything entitled is an ESTIMATE at today's price (still wrong for the legacy row).
SELECT ok('unmapped: MRR = 59 + 59 + 890/12 + 19 = 211.17, all four counted as estimates',
  as_user_val(:ADM, $$SELECT (public.admin_overview_stats()->>'mrr') || '|' || (public.admin_overview_stats()->>'mrr_estimated')$$) = '211.17|4');

-- Owner maps the Stripe price ids (data-step.sql).
UPDATE public.plan_prices SET stripe_price_id = 'price_biz_m'    WHERE lookup_key = 'b2bnest_business_monthly_gbp';
UPDATE public.plan_prices SET stripe_price_id = 'price_proleg_m' WHERE lookup_key = 'b2bnest_professional_monthly_gbp';
UPDATE public.plan_prices SET stripe_price_id = 'price_scale_y'   WHERE lookup_key = 'b2bnest_scale_annual_gbp';
UPDATE public.plan_prices SET stripe_price_id = 'price_scale_m'   WHERE lookup_key = 'b2bnest_scale_monthly_gbp';

SELECT ok('mapped: MRR = 59 (Business) + 35 (legacy Business) + 74.17 (Scale £890/12) + 19 (Solo, still an estimate) = 187.17',
  as_user_val(:ADM, $$SELECT (public.admin_overview_stats()->>'mrr') || '|' || (public.admin_overview_stats()->>'mrr_estimated')$$) = '187.17|1');
SELECT ok('ARR = MRR x 12 = 2246.04', as_user_val(:ADM, $$SELECT public.admin_overview_stats()->>'arr'$$) = '2246.04');
SELECT ok('per-row Value: what each pays a month, with its basis; cancelled, never-paid and no-plan rows are 0',
  as_user_val(:ADM, $$SELECT string_agg((x->>'email') || '=' || (x->>'value') || ':' || (x->>'value_basis'), ',' ORDER BY x->>'email')
     FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x$$)
  = 'u1=59.00:stripe_price,u2=35.00:stripe_price,u3=74.17:stripe_price,u4=19.00:estimate,u5=0:none,u6=0:none,u7=0:none');
SELECT ok('statuses: active x4, cancelled (Stripe canceled), not_completed (never paid), no_plan (was "free")',
  as_user_val(:ADM, $$SELECT string_agg((x->>'email') || '=' || (x->>'status'), ',' ORDER BY x->>'email')
     FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x$$)
  = 'u1=active,u2=active,u3=active,u4=active,u5=cancelled,u6=not_completed,u7=no_plan');
SELECT ok('each subscription row carries its plan_key and the access state from _access_state_for',
  as_user_val(:ADM, $$SELECT (x->>'plan_key') || '|' || (x->>'access_state') FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' = 'u3'$$) = 'enterprise|subscribed'
  AND as_user_val(:ADM, $$SELECT x->>'access_state' FROM jsonb_array_elements(public.admin_list_subscriptions('all',NULL,50,0)->'rows') x WHERE x->>'email' = 'u7'$$) = 'trial');
SELECT ok('filters: "no_plan", and the old "free" value means the same; "trial" uses the access state',
  as_user_val(:ADM, $$SELECT public.admin_list_subscriptions('no_plan',NULL,50,0)->>'total'$$) = '1'
  AND as_user_val(:ADM, $$SELECT public.admin_list_subscriptions('free',NULL,50,0)->>'total'$$) = '1'
  AND as_user_val(:ADM, $$SELECT public.admin_list_subscriptions('trial',NULL,50,0)->>'total'$$) = '1'
  AND as_user_val(:ADM, $$SELECT public.admin_list_subscriptions('not_completed',NULL,50,0)->>'total'$$) = '1');
SELECT ok('tiles: no_plan_users = free_users = 6 profiles without an entitled subscription; trials = 2 from the access state; active = 4',
  as_user_val(:ADM, $$SELECT (s->>'no_plan_users') || '|' || (s->>'free_users') || '|' || (s->>'trials') || '|' || (s->>'active_subscriptions') FROM (SELECT public.admin_overview_stats() s) q$$) = '6|6|2|4');
SELECT ok('users: each row carries plan_key and access_state (owner, trial, trial_ended, suspended, subscribed)',
  as_user_val(:ADM, $$SELECT string_agg((x->>'email') || '=' || COALESCE(x->>'plan_key','-') || '/' || COALESCE(x->>'access_state','-'), ',' ORDER BY x->>'email')
     FROM jsonb_array_elements(public.admin_list_users(NULL,'all',50,0,NULL)->'rows') x$$)
  = 'u0@example.test=-/owner,u1@example.test=professional/subscribed,u2@example.test=professional/subscribed,u3@example.test=enterprise/subscribed,u4@example.test=starter/subscribed,u5@example.test=enterprise/trial_ended,u6@example.test=professional/trial_ended,u7@example.test=-/trial,u8@example.test=-/trial,u9@example.test=-/suspended');
SELECT ok('users filters: plan by key (professional = 2 paying), no_plan and old "free" alike, trial_ended by access state',
  as_user_val(:ADM, $$SELECT public.admin_list_users(NULL,'all',50,0,'professional')->>'total'$$) = '2'
  AND as_user_val(:ADM, $$SELECT public.admin_list_users(NULL,'no_plan',50,0,NULL)->>'total'$$) = '6'
  AND as_user_val(:ADM, $$SELECT public.admin_list_users(NULL,'free',50,0,NULL)->>'total'$$) = '6'
  AND as_user_val(:ADM, $$SELECT public.admin_list_users(NULL,'all',50,0,'free')->>'total'$$) = '6'
  AND as_user_val(:ADM, $$SELECT public.admin_list_users(NULL,'trial_ended',50,0,NULL)->>'total'$$) = '2');

-- ===== Rollback =====
\i rollback.sql
SELECT ok('rollback: the three functions are back exactly as live (same md5 as production)',
  md5(pg_get_functiondef('public.admin_overview_stats()'::regprocedure)) = '28ee18513e9010929d93f70c89dfa7da'
  AND md5(pg_get_functiondef('public.admin_list_subscriptions(text,text,integer,integer)'::regprocedure)) = 'f8061f10eb397748969715af30661310'
  AND md5(pg_get_functiondef('public.admin_list_users(text,text,integer,integer,text)'::regprocedure)) = '24265c01d545e12517a1f15edebf0d5b');
SELECT ok('rollback: plan_prices and the helper are gone; MRR is the old 226 again',
  to_regclass('public.plan_prices') IS NULL AND to_regprocedure('public._subscriber_monthly_value(text,boolean,text,text,text,text)') IS NULL
  AND as_user_val(:ADM, $$SELECT public.admin_overview_stats()->>'mrr'$$) = '226');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR detail = '' THEN '' ELSE ' (' || detail || ')' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
