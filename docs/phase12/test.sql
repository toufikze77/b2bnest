-- Phase 12 test (throwaway Postgres only; run-test.sh). Baseline = support + onboarding harness fixtures, then the LIVE
-- profiles / user_roles / sign-up shapes read on 2026-10-27 (fixture-live.sql). Then: the hole reproduced, proposal.sql,
-- every access state, the exact-timestamp flip, the data step and its rollback, the precheck, rollback.sql.
\set ON_ERROR_STOP 1
\i fixture-live.sql

-- Snapshot of the live profiles ACL (table + every column) and the live functions the proposal must not change
CREATE TABLE snap_acl AS
  SELECT 'table'::text AS obj, (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass) AS acl
  UNION ALL SELECT a.attname::text, a.attacl::text FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
CREATE TABLE snap_fn AS SELECT p.proname::text AS name, md5(pg_get_functiondef(p.oid)) AS def, p.proacl::text AS acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('handle_new_user','check_trial_status','assert_self','is_super_admin');

-- Helpers (some refer to functions the proposal creates, so their bodies are checked when they run)
SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION try(stmt text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE stmt; RETURN 'OK'; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLERRM; END $$;
CREATE FUNCTION uid(e text) RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT id FROM auth.users WHERE email = e $$;
-- Sign-up exactly as production: an auth.users row; the live trigger creates profile, company, membership (+ billing owner)
CREATE FUNCTION signup(e text, name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE i uuid := gen_random_uuid(); BEGIN
  INSERT INTO auth.users(id, email, email_confirmed_at, raw_user_meta_data)
  VALUES (i, e, now(), CASE WHEN name IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('full_name', name) END);
  RETURN i; END $$;
CREATE FUNCTION as_user(e text, stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid(e), 'email', e, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated; res := try(stmt); RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true); RETURN res; END $$;
CREATE FUNCTION as_anon(stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon; res := try(stmt); RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN res; END $$;
-- Reads with a fresh snapshot (a plain subquery in the same statement would not see what as_user() just wrote)
CREATE FUNCTION fresh(q text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
CREATE FUNCTION ends(e text) RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT trial_ends_at FROM public.profiles WHERE id = uid(e) $$;
CREATE FUNCTION set_end(e text, t timestamptz) RETURNS void LANGUAGE sql AS $$ UPDATE public.profiles SET trial_ends_at = t WHERE id = uid(e) $$;
CREATE FUNCTION org_of(e text) RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT organization_id FROM public.organization_billing WHERE billing_user_id = uid(e) LIMIT 1 $$;
CREATE FUNCTION join_co(member_e text, owner_e text, role text DEFAULT 'member') RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_of(owner_e), uid(member_e), role) $$;
CREATE FUNCTION sub(e text, status text, subscribed bool DEFAULT true, plan text DEFAULT 'professional') RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.subscribers WHERE user_id = uid(e);
  INSERT INTO public.subscribers(user_id, email, subscribed, plan_key, subscription_status) VALUES (uid(e), e, subscribed, plan, status) $$;
-- "state/via/days_left/plan/status/owner_name" from the server rules
CREATE FUNCTION st(e text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT concat_ws('/', s.state, s.via, s.days_left, coalesce(s.plan_key,'-'), coalesce(s.subscription_status,'-'), coalesce(s.owner_name,'-'))
  FROM public._access_state_for(uid(e)) s $$;
SET check_function_bodies = on;

-- ============ 0. The hole, before the proposal ============
SELECT signup('hole@t.test', 'Hole Tester');
SELECT set_end('hole@t.test', now() - interval '3 days');
SELECT ok('BEFORE: a signed-in user CAN push their own trial_ends_at to 2099 (the hole is real)',
  as_user('hole@t.test', $$UPDATE public.profiles SET trial_ends_at = '2099-01-01' WHERE id = auth.uid()$$) = 'OK'
  AND ends('hole@t.test') = '2099-01-01'::timestamptz, ends('hole@t.test')::text);
SELECT ok('BEFORE: and can flip is_trial_active / trial_expired / trial_started_at',
  as_user('hole@t.test', $$UPDATE public.profiles SET is_trial_active = true, trial_expired = false, trial_started_at = now() WHERE id = auth.uid()$$) = 'OK');
DELETE FROM public.profiles WHERE id = uid('hole@t.test');
SELECT ok('BEFORE: a user can also INSERT their own profile with a far-future trial',
  as_user('hole@t.test', $$INSERT INTO public.profiles(id, email, trial_ends_at) VALUES (auth.uid(), 'hole@t.test', '2099-01-01')$$) = 'OK'
  AND ends('hole@t.test') = '2099-01-01'::timestamptz);
SELECT set_end('hole@t.test', now() - interval '3 days');

-- ============ 1. Apply ============
\i proposal.sql
-- (applying it twice is checked by run-test.sh: the guard must refuse)

-- ============ 2. The hole is closed ============
SELECT ok('AFTER: UPDATE trial_ends_at is refused', as_user('hole@t.test', $$UPDATE public.profiles SET trial_ends_at = '2099-01-01' WHERE id = auth.uid()$$) LIKE 'ERROR%permission denied%');
SELECT ok('AFTER: UPDATE trial_started_at is refused', as_user('hole@t.test', $$UPDATE public.profiles SET trial_started_at = now() WHERE id = auth.uid()$$) LIKE 'ERROR%permission denied%');
SELECT ok('AFTER: UPDATE is_trial_active is refused', as_user('hole@t.test', $$UPDATE public.profiles SET is_trial_active = true WHERE id = auth.uid()$$) LIKE 'ERROR%permission denied%');
SELECT ok('AFTER: UPDATE trial_expired is refused', as_user('hole@t.test', $$UPDATE public.profiles SET trial_expired = false WHERE id = auth.uid()$$) LIKE 'ERROR%permission denied%');
SELECT ok('AFTER: the trial end did not move', ends('hole@t.test') < now());
SELECT ok('AFTER: anon cannot update any trial column', as_anon($$UPDATE public.profiles SET trial_ends_at = '2099-01-01'$$) LIKE 'ERROR%permission denied%');
DELETE FROM public.profiles WHERE id = uid('hole@t.test');
SELECT ok('AFTER: INSERT of each trial column is refused',
  as_user('hole@t.test', $$INSERT INTO public.profiles(id, trial_ends_at) VALUES (auth.uid(), '2099-01-01')$$) LIKE 'ERROR%permission denied%'
  AND as_user('hole@t.test', $$INSERT INTO public.profiles(id, trial_started_at) VALUES (auth.uid(), now())$$) LIKE 'ERROR%permission denied%'
  AND as_user('hole@t.test', $$INSERT INTO public.profiles(id, is_trial_active) VALUES (auth.uid(), true)$$) LIKE 'ERROR%permission denied%'
  AND as_user('hole@t.test', $$INSERT INTO public.profiles(id, trial_expired) VALUES (auth.uid(), false)$$) LIKE 'ERROR%permission denied%');
SELECT ok('AFTER: a user can still insert their own profile without trial columns (defaults give 14 days)',
  as_user('hole@t.test', $$INSERT INTO public.profiles(id, email) VALUES (auth.uid(), 'hole@t.test')$$) = 'OK'
  AND fresh($$SELECT (trial_ends_at - trial_started_at)::text FROM public.profiles WHERE email = 'hole@t.test'$$) = '14 days');
SELECT ok('AFTER: every other profile field still saves (Settings, profile dialog, theme, avatar)',
  as_user('hole@t.test', $$UPDATE public.profiles SET full_name='H T', display_name='HT', theme='dark', currency_code='GBP', timezone='Europe/London',
         country_code='GB', language_code='en', date_format='DD/MM/YYYY', time_format='24h', avatar_url='a.png', bio='b', is_active=true,
         updated_at=now() WHERE id = auth.uid()$$) = 'OK'
  AND fresh($$SELECT theme || display_name FROM public.profiles WHERE email = 'hole@t.test'$$) = 'darkHT');
SELECT ok('AFTER: the ProfileSetup upsert (insert ... on conflict update, no trial columns) still works',
  as_user('hole@t.test', $$INSERT INTO public.profiles(id, email, full_name, headline, location, industry, company, position, bio, experience_years,
         skills, website, linkedin_url, twitter_url, is_public) VALUES (auth.uid(), 'hole@t.test', 'H', 'h', 'l', 'i', 'c', 'p', 'b', 3, '{a}', 'w', 'li', 'tw', true)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, headline = EXCLUDED.headline, is_public = EXCLUDED.is_public$$) = 'OK');
SELECT ok('AFTER: the AccountSettings avatar upsert still works',
  as_user('hole@t.test', $$INSERT INTO public.profiles(id, email, avatar_url) VALUES (auth.uid(), 'hole@t.test', 'x.png')
         ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url$$) = 'OK');
SELECT ok('AFTER: a user still reads their own trial dates', as_user('hole@t.test', $$SELECT trial_ends_at, is_trial_active FROM public.profiles WHERE id = auth.uid()$$) = 'OK');
SELECT ok('AFTER: service_role (Edge Functions) can still write the trial columns',
  (SELECT has_column_privilege('service_role','public.profiles','trial_ends_at','UPDATE') AND has_column_privilege('service_role','public.profiles','is_trial_active','INSERT')));
SELECT ok('AFTER: authenticated has no INSERT/UPDATE on any trial column, and UPDATE on all 28 others',
  (SELECT bool_and(NOT has_column_privilege('authenticated','public.profiles',c,'UPDATE') AND NOT has_column_privilege('authenticated','public.profiles',c,'INSERT'))
     FROM unnest(ARRAY['trial_started_at','trial_ends_at','is_trial_active','trial_expired']) c)
  AND (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='profiles'
        AND has_column_privilege('authenticated','public.profiles',c.column_name,'UPDATE')) = 28);
SELECT ok('AFTER: SELECT grants on profiles unchanged (table + column ACL for SELECT)',
  has_table_privilege('authenticated','public.profiles','SELECT') AND NOT has_table_privilege('anon','public.profiles','SELECT')
  AND has_column_privilege('anon','public.profiles','display_name','SELECT') AND NOT has_column_privilege('anon','public.profiles','email','SELECT'));

-- ============ 3. Sign-up still gets exactly 14 days ============
BEGIN;
SELECT signup('new@t.test', 'Nina New');
SELECT ok('Sign-up: profile trial starts now and ends exactly 14 days later',
  (SELECT trial_started_at = now() AND trial_ends_at = now() + interval '14 days' AND is_trial_active AND NOT trial_expired
     FROM public.profiles WHERE id = uid('new@t.test')));
COMMIT;
SELECT ok('Sign-up: company, admin membership and billing owner created as before',
  (SELECT count(*) FROM public.organization_members m JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.user_id = uid('new@t.test') AND m.role = 'admin' AND o.name = 'Nina New''s Organization') = 1
  AND (SELECT source FROM public.organization_billing WHERE billing_user_id = uid('new@t.test')) = 'company_created');
SELECT ok('Sign-up: state = trial, 14 days left, via self', st('new@t.test') = 'trial/self/14/-/-/-', st('new@t.test'));
SELECT ok('my_access_state() as the new user returns the same row',
  as_user('new@t.test', $q$DO $x$ BEGIN IF (SELECT state || days_left FROM public.my_access_state()) <> 'trial14' THEN RAISE EXCEPTION 'bad'; END IF; END $x$$q$) = 'OK');

-- ============ 4. Every state ============
-- Owner accounts (platform roles)
SELECT signup('own1@t.test'), signup('own2@t.test'), signup('plain@t.test');
SELECT set_end(e, now() - interval '30 days') FROM unnest(ARRAY['own1@t.test','own2@t.test','plain@t.test']) e;
INSERT INTO public.user_roles(user_id, role) VALUES (uid('own1@t.test'), 'admin'), (uid('own1@t.test'), 'super_admin'),
  (uid('own2@t.test'), 'admin'), (uid('own2@t.test'), 'user'), (uid('plain@t.test'), 'user');
SELECT ok('Owner account (admin + super_admin, trial long over): owner', st('own1@t.test') LIKE 'owner/self/0/%', st('own1@t.test'));
SELECT ok('Owner account (admin + user): owner', st('own2@t.test') LIKE 'owner/self/%', st('own2@t.test'));
SELECT ok('Role "user" alone gives nothing: trial_ended', st('plain@t.test') = 'trial_ended/self/0/-/-/-', st('plain@t.test'));
SELECT ok('A super admin cannot grant super_admin, nor a role to themselves (live policy)',
  as_user('own1@t.test', $$INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'owner')$$) LIKE 'ERROR%'
  AND as_user('own1@t.test', format('INSERT INTO public.user_roles(user_id, role) VALUES (%L, %L)', uid('plain@t.test'), 'super_admin')) LIKE 'ERROR%');
SELECT ok('A normal user cannot grant themselves admin', as_user('plain@t.test', $$INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin')$$) LIKE 'ERROR%');

-- Own subscription, each Stripe status (trial long over, so only the subscription can give access)
SELECT signup('s_' || s || '@t.test') FROM unnest(ARRAY['active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','nullsub','nullfalse']) s;
SELECT set_end('s_' || s || '@t.test', now() - interval '1 day') FROM unnest(ARRAY['active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','nullsub','nullfalse']) s;
SELECT sub('s_' || s || '@t.test', s, s IN ('active','trialing','past_due','unpaid')) FROM unnest(ARRAY['active','trialing','past_due','unpaid']) s;
SELECT sub('s_' || s || '@t.test', s, false) FROM unnest(ARRAY['canceled','incomplete','incomplete_expired','paused']) s;
SELECT sub('s_nullsub@t.test', NULL, true), sub('s_nullfalse@t.test', NULL, false);
SELECT ok('Subscribed (active): subscribed/self', st('s_active@t.test') = 'subscribed/self/0/professional/active/-', st('s_active@t.test'));
SELECT ok('Subscribed (trialing): subscribed/self', st('s_trialing@t.test') = 'subscribed/self/0/professional/trialing/-', st('s_trialing@t.test'));
SELECT ok('past_due keeps access while Stripe retries (same as the webhook)', st('s_past_due@t.test') = 'subscribed/self/0/professional/past_due/-', st('s_past_due@t.test'));
SELECT ok('unpaid keeps access (same as the webhook ENTITLED_STATUSES)', st('s_unpaid@t.test') = 'subscribed/self/0/professional/unpaid/-', st('s_unpaid@t.test'));
SELECT ok('canceled: trial_ended', st('s_canceled@t.test') = 'trial_ended/self/0/-/-/-', st('s_canceled@t.test'));
SELECT ok('incomplete / incomplete_expired / paused: trial_ended',
  st('s_incomplete@t.test') LIKE 'trial_ended/%' AND st('s_incomplete_expired@t.test') LIKE 'trial_ended/%' AND st('s_paused@t.test') LIKE 'trial_ended/%');
SELECT ok('canceled even if a stale row still says subscribed = true: trial_ended',
  (SELECT sub('s_canceled@t.test', 'canceled', true)) IS NULL AND st('s_canceled@t.test') LIKE 'trial_ended/%');
SELECT ok('Old row with no status but subscribed = true: subscribed', st('s_nullsub@t.test') LIKE 'subscribed/self/%', st('s_nullsub@t.test'));
SELECT ok('Old row with no status and subscribed = false: trial_ended', st('s_nullfalse@t.test') LIKE 'trial_ended/%');
SELECT ok('canceled subscription but trial still running: trial',
  (SELECT set_end('s_canceled@t.test', now() + interval '3 days')) IS NULL AND st('s_canceled@t.test') = 'trial/self/3/-/-/-', st('s_canceled@t.test'));

-- Companies: a member follows the billing owner of the company they belong to
SELECT signup('boss@t.test', 'Bea Boss'), signup('staff@t.test', 'Sam Staff'), signup('late@t.test', 'Lee Late'), signup('mid@t.test', 'Max Mid');
SELECT set_end(e, now() - interval '2 days') FROM unnest(ARRAY['boss@t.test','staff@t.test','late@t.test','mid@t.test']) e;
SELECT join_co('staff@t.test', 'boss@t.test');
SELECT ok('Member, own and owner trial both ended: trial_ended via company, names the owner',
  st('staff@t.test') = 'trial_ended/company/0/-/-/Bea Boss', st('staff@t.test'));
SELECT ok('Owner of that company sees the self view (they choose a plan)', st('boss@t.test') = 'trial_ended/self/0/-/-/-', st('boss@t.test'));
SELECT sub('boss@t.test', 'active', true, 'starter');
SELECT ok('Member whose company owner subscribed: subscribed via company', st('staff@t.test') = 'subscribed/company/0/starter/active/Bea Boss', st('staff@t.test'));
SELECT ok('Owner who subscribed: subscribed via self', st('boss@t.test') = 'subscribed/self/0/starter/active/-', st('boss@t.test'));
SELECT sub('boss@t.test', 'past_due', true, 'starter');
SELECT ok('Owner past_due: member keeps access too', st('staff@t.test') LIKE 'subscribed/company/0/starter/past_due/%');
SELECT sub('boss@t.test', 'canceled', false, 'starter');
SELECT ok('Owner cancels: member is back to trial_ended via company', st('staff@t.test') LIKE 'trial_ended/company/%');
UPDATE public.organization_members SET is_active = false WHERE user_id = uid('staff@t.test') AND organization_id = org_of('boss@t.test');
SELECT sub('boss@t.test', 'active', true, 'starter');
SELECT ok('Deactivated member does not get the company subscription (own view)', st('staff@t.test') = 'trial_ended/self/0/-/-/-', st('staff@t.test'));
UPDATE public.organization_members SET is_active = true WHERE user_id = uid('staff@t.test') AND organization_id = org_of('boss@t.test');
-- Member during the owner's trial
SELECT join_co('late@t.test', 'mid@t.test');
SELECT set_end('mid@t.test', now() + interval '5 days');
SELECT ok('Member whose own trial ended, owner''s trial running: trial via company with the owner''s days',
  st('late@t.test') = 'trial/company/5/-/-/Max Mid', st('late@t.test'));
SELECT set_end('late@t.test', now() + interval '9 days');
SELECT ok('Own trial longer than the company''s: own trial counts', st('late@t.test') = 'trial/self/9/-/-/-', st('late@t.test'));
SELECT set_end('late@t.test', now() - interval '1 day'), set_end('mid@t.test', now() - interval '1 day');
SELECT ok('Both ended: trial_ended via company', st('late@t.test') = 'trial_ended/company/0/-/-/Max Mid', st('late@t.test'));
UPDATE public.profiles SET display_name = '  ', full_name = NULL WHERE id = uid('mid@t.test');
SELECT ok('No owner name on file: owner_name is empty (app says "the account owner")', st('late@t.test') = 'trial_ended/company/0/-/-/-', st('late@t.test'));
-- A member of a company with NO billing owner (live: 4 ownerless companies) only has their own state
SELECT signup('orphan@t.test');
SELECT set_end('orphan@t.test', now() - interval '1 day');
INSERT INTO public.organizations(id, name, created_by) VALUES ('12000000-0000-4000-8000-000000000001', 'Ownerless', NULL);
SELECT ok('Member of a company with no billing owner: own state, self view', st('orphan@t.test') = 'trial_ended/self/0/-/-/-', st('orphan@t.test'));

-- Support customers live in support_customers, never organization_members: they never inherit the company's plan
SELECT signup('cust@t.test', 'Cara Customer');
SELECT set_end('cust@t.test', now() - interval '1 day');
INSERT INTO public.support_customers(organization_id, email, user_id, invited_by, claimed_at)
VALUES (org_of('boss@t.test'), 'cust@t.test', uid('cust@t.test'), uid('boss@t.test'), now());
SELECT ok('Support customer of a subscribed company: not subscribed, own view (the portal is exempt from the paywall)',
  st('cust@t.test') = 'trial_ended/self/0/-/-/-', st('cust@t.test'));
SELECT ok('Support customer is not an organization member', NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = uid('cust@t.test') AND organization_id = org_of('boss@t.test')));

-- ============ 5. The exact timestamp ============
BEGIN;
SELECT set_end('plain@t.test', now()); -- now() is fixed for the whole transaction
DELETE FROM public.user_roles WHERE user_id = uid('plain@t.test');
SELECT ok('trial_ends_at = now(): already trial_ended', st('plain@t.test') LIKE 'trial_ended/%', st('plain@t.test'));
SELECT set_end('plain@t.test', now() + interval '1 microsecond');
SELECT ok('trial_ends_at = now() + 1 microsecond: still trial, 1 day left', st('plain@t.test') = 'trial/self/1/-/-/-', st('plain@t.test'));
SELECT set_end('plain@t.test', now() + interval '14 days');
SELECT ok('Exactly 14 days left: 14', st('plain@t.test') LIKE 'trial/self/14/%');
SELECT set_end('plain@t.test', now() + interval '13 days 1 hour');
SELECT ok('13 days 1 hour left: rounds up to 14', st('plain@t.test') LIKE 'trial/self/14/%');
SELECT set_end('plain@t.test', now() + interval '1 day');
SELECT ok('Exactly 1 day left: 1', st('plain@t.test') LIKE 'trial/self/1/%');
SELECT set_end('plain@t.test', now() - interval '1 microsecond');
SELECT ok('1 microsecond after the end: trial_ended, 0 days', st('plain@t.test') = 'trial_ended/self/0/-/-/-');
COMMIT;
SELECT ok('Stale flags are ignored: is_trial_active = true with an ended date is still trial_ended',
  (SELECT is_trial_active FROM public.profiles WHERE id = uid('plain@t.test')) AND st('plain@t.test') LIKE 'trial_ended/%');

-- ============ 6. Function security ============
SELECT ok('All three functions: SET search_path = '''' (and SECURITY DEFINER where they read tables)',
  (SELECT bool_and(p.proconfig = ARRAY['search_path=""']) AND count(*) = 3 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('my_access_state','_access_state_for','_access_entitled'))
  AND (SELECT prosecdef AND provolatile = 's' FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure)
  AND (SELECT prosecdef AND provolatile = 's' FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure));
SELECT ok('my_access_state: authenticated and service_role only (not anon, not PUBLIC)',
  has_function_privilege('authenticated','public.my_access_state()','EXECUTE') AND has_function_privilege('service_role','public.my_access_state()','EXECUTE')
  AND NOT has_function_privilege('anon','public.my_access_state()','EXECUTE')
  AND (SELECT NOT EXISTS (SELECT 1 FROM aclexplode(proacl) a WHERE a.grantee = 0) FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure),
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure));
SELECT ok('Helpers: service_role only (a user cannot read someone else''s state)',
  NOT has_function_privilege('authenticated','public._access_state_for(uuid)','EXECUTE') AND NOT has_function_privilege('anon','public._access_state_for(uuid)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public._access_entitled(text,boolean)','EXECUTE')
  AND has_function_privilege('service_role','public._access_state_for(uuid)','EXECUTE')
  AND as_user('plain@t.test', format('SELECT * FROM public._access_state_for(%L)', uid('s_active@t.test'))) LIKE 'ERROR%permission denied%');
SELECT ok('anon calling my_access_state is refused', as_anon('SELECT * FROM public.my_access_state()') LIKE 'ERROR%permission denied%');
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT ok('No JWT subject: my_access_state raises "sign in required"', try('SELECT * FROM public.my_access_state()') LIKE 'ERROR%sign in required%',
  try('SELECT * FROM public.my_access_state()'));
COMMIT;
SELECT ok('my_access_state always answers for the caller only (as the member: subscribed via company)',
  as_user('staff@t.test', $q$DO $x$ BEGIN IF (SELECT state || '/' || via FROM public.my_access_state()) <> 'subscribed/company' THEN RAISE EXCEPTION 'bad'; END IF; END $x$$q$) = 'OK');
SELECT ok('Live functions unchanged (handle_new_user, check_trial_status, assert_self, is_super_admin: body and grants)',
  (SELECT count(*) FROM snap_fn s JOIN pg_proc p ON p.proname = s.name JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE md5(pg_get_functiondef(p.oid)) = s.def AND p.proacl::text IS NOT DISTINCT FROM s.acl) = 4);
SELECT ok('check_trial_status still works for the caller and still flips the flags lazily',
  as_user('plain@t.test', format('SELECT * FROM public.check_trial_status(%L)', uid('plain@t.test'))) = 'OK'
  AND fresh($$SELECT NOT is_trial_active AND trial_expired FROM public.profiles WHERE email = 'plain@t.test'$$) = 'true');
SELECT ok('check_trial_status still refuses another user''s id',
  as_user('plain@t.test', format('SELECT * FROM public.check_trial_status(%L)', uid('boss@t.test'))) LIKE 'ERROR%Access denied%');

-- ============ 7. The precheck counts the same states as the function ============
\i precheck-as-table.sql
SELECT ok('precheck.sql categories = _access_state_for for every profile',
  (SELECT string_agg(left(category, 1) || '=' || accounts, ' ' ORDER BY category) FROM pc) =
  (SELECT string_agg(k || '=' || c, ' ' ORDER BY k) FROM (
     SELECT CASE WHEN s.state = 'owner' THEN '1' WHEN s.state = 'subscribed' AND s.via = 'self' THEN '2' WHEN s.state = 'subscribed' THEN '3'
                 WHEN s.state = 'trial' THEN '4' WHEN s.via = 'self' THEN '5' ELSE '6' END AS k, count(*) AS c
       FROM public.profiles p CROSS JOIN LATERAL public._access_state_for(p.id) s GROUP BY 1) x),
  (SELECT string_agg(left(category,1) || '=' || accounts, ' ' ORDER BY category) FROM pc));
SELECT ok('precheck.sql is read-only (no INSERT/UPDATE/DELETE/ALTER/GRANT)',
  pg_read_file(current_setting('p12.dir') || '/precheck.sql') !~* '\m(insert|update|delete|alter|grant|revoke|create|drop|truncate)\M');

-- ============ 8. Data step and its rollback ============
SELECT signup('flag@t.test');
UPDATE public.profiles SET trial_ends_at = now() - interval '5 days', is_trial_active = true, trial_expired = false WHERE id = uid('flag@t.test');
UPDATE public.profiles SET is_trial_active = true, trial_expired = false WHERE id = uid('plain@t.test'); -- a second stale row
CREATE TABLE before_flags AS SELECT id, is_trial_active, trial_expired, trial_ends_at FROM public.profiles;
CREATE TABLE states_before AS SELECT p.id, st(u.email) AS s FROM public.profiles p JOIN auth.users u ON u.id = p.id;
\i data-step.sql
SELECT ok('Data step: no ended trial keeps a stale "active" flag',
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE trial_ends_at <= now() AND (is_trial_active OR NOT trial_expired)));
SELECT ok('Data step: running trials untouched', (SELECT is_trial_active AND NOT trial_expired FROM public.profiles WHERE id = uid('new@t.test')));
SELECT ok('Data step: trial dates untouched', NOT EXISTS (SELECT 1 FROM public.profiles p JOIN before_flags b USING (id) WHERE p.trial_ends_at IS DISTINCT FROM b.trial_ends_at));
SELECT ok('Data step: nobody''s access state changes (access never reads the flags)',
  NOT EXISTS (SELECT 1 FROM states_before b JOIN auth.users u ON u.id = b.id WHERE st(u.email) IS DISTINCT FROM b.s));
SELECT ok('Data step backup table: RLS on, no anon/authenticated access',
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.phase12_trial_flags_backup'::regclass)
  AND NOT has_table_privilege('authenticated','public.phase12_trial_flags_backup','SELECT') AND NOT has_table_privilege('anon','public.phase12_trial_flags_backup','SELECT')
  AND has_table_privilege('service_role','public.phase12_trial_flags_backup','SELECT'));
SELECT ok('Data step backed up only the rows it changed', (SELECT count(*) FROM public.phase12_trial_flags_backup) =
  (SELECT count(*) FROM before_flags WHERE trial_ends_at <= now() AND (is_trial_active IS DISTINCT FROM false OR trial_expired IS DISTINCT FROM true)));
\i data-step-rollback.sql
SELECT ok('Data step rollback: every flag back exactly as before',
  NOT EXISTS (SELECT 1 FROM public.profiles p JOIN before_flags b USING (id)
               WHERE (p.is_trial_active, p.trial_expired) IS DISTINCT FROM (b.is_trial_active, b.trial_expired)));
SELECT ok('Data step rollback: backup table dropped', to_regclass('public.phase12_trial_flags_backup') IS NULL);

-- ============ 9. rollback.sql ============
\i rollback.sql
SELECT ok('Rollback: the three functions are gone',
  to_regprocedure('public.my_access_state()') IS NULL AND to_regprocedure('public._access_state_for(uuid)') IS NULL
  AND to_regprocedure('public._access_entitled(text,boolean)') IS NULL);
SELECT ok('Rollback: profiles table ACL restored exactly',
  (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass) = (SELECT acl FROM snap_acl WHERE obj = 'table'),
  (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass));
SELECT ok('Rollback: every column ACL restored exactly',
  NOT EXISTS (SELECT 1 FROM snap_acl s JOIN pg_attribute a ON a.attrelid = 'public.profiles'::regclass AND a.attname = s.obj
               WHERE coalesce(a.attacl::text, '{}') IS DISTINCT FROM coalesce(s.acl, '{}')),
  (SELECT string_agg(s.obj || ':' || coalesce(a.attacl::text,'null') || '<>' || coalesce(s.acl,'null'), ', ') FROM snap_acl s
     JOIN pg_attribute a ON a.attrelid = 'public.profiles'::regclass AND a.attname = s.obj WHERE coalesce(a.attacl::text, '{}') IS DISTINCT FROM coalesce(s.acl, '{}')));
SELECT ok('Rollback: the hole is open again (as the README warns)',
  as_user('hole@t.test', $$UPDATE public.profiles SET trial_ends_at = '2099-01-01' WHERE id = auth.uid()$$) = 'OK');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR coalesce(detail, '') = '' THEN '' ELSE ' [' || detail || ']' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
