-- Phase 12c test (throwaway Postgres only; run-test.sh). Baseline = production today: support + onboarding harness
-- fixtures, Phase 12 live shapes and proposal (as live), the live admin_audit_logs, Phase 12b proposal, and the live
-- admin_log_action / admin_set_user_status (fixture-live.sql). Then the bug reproduced, proposal.sql, every rule,
-- rollback.sql.
\set ON_ERROR_STOP 1
\i p12-fixture-live.sql
\i p12b-fixture-live.sql
\i p12-proposal.sql
\i p12b-proposal.sql
\i fixture-live.sql

-- Helpers (as in docs/phase12b/test.sql)
SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION try(stmt text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE stmt; RETURN 'OK'; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLSTATE || ' ' || SQLERRM; END $$;
CREATE FUNCTION fresh(q text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
CREATE FUNCTION uid(e text) RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT id FROM auth.users WHERE email = e $$;
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
CREATE FUNCTION my_state(e text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid(e), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN SELECT concat_ws('/', s.state, s.via, s.days_left, coalesce(s.plan_key, '-')) INTO v FROM public.my_access_state() s;
  EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
CREATE FUNCTION st(e text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT concat_ws('/', s.state, s.via, s.days_left, coalesce(s.plan_key,'-'), coalesce(s.subscription_status,'-'), coalesce(s.owner_name,'-'))
  FROM public._access_state_for(uid(e)) s $$;
CREATE FUNCTION set_end(e text, t timestamptz) RETURNS void LANGUAGE sql AS $$ UPDATE public.profiles SET trial_ends_at = t WHERE id = uid(e) $$;
-- Suspend (false) / reactivate (true) as a given caller, through the RPC
CREATE FUNCTION sus(caller text, target text, active bool) RETURNS text LANGUAGE sql AS $$
  SELECT as_user(caller, format('SELECT public.admin_set_user_status(%L, %L)', uid(target), active)) $$;
CREATE FUNCTION audits(action text) RETURNS bigint LANGUAGE sql VOLATILE AS $$ SELECT count(*) FROM public.admin_audit_logs WHERE admin_audit_logs.action = audits.action $$;
CREATE FUNCTION flag(e text) RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT coalesce(is_active::text, 'null') FROM public.profiles WHERE id = uid(e) $$;
SET check_function_bodies = on;

-- ============ 0. Baseline = production today ============
SELECT ok('Local bodies are byte-for-byte production''s (md5 of prosrc read 2026-10-28)',
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) = '07c21748745fb10e84459577f5c3129b'
  AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.admin_set_user_status(uuid,boolean)'::regprocedure) = '1877bf0d05437954004bbc6ab8d57ce3');
CREATE TABLE snap_acl AS
  SELECT 'table'::text AS obj, (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass) AS acl
  UNION ALL SELECT a.attname::text, a.attacl::text FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped;
CREATE TABLE snap_fn AS SELECT p.proname::text AS name, md5(pg_get_functiondef(p.oid)) AS def, md5(p.prosrc) AS src, p.proacl::text AS acl, p.proconfig::text AS cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('_access_state_for','admin_set_user_status','my_access_state','admin_log_action','handle_new_user','set_master_access','list_master_access');

-- People. SA super admin; AD admin role; OW owner role; MA master account; U subscriber; T in a running trial;
-- E trial ended; BOSS subscribed company owner with member MEM.
SELECT signup(e || '@t.test', n) FROM (VALUES ('sa','Sara Super'),('sb','Sam Super'),('ad','Adam Admin'),('ow','Olga Owner'),('ma','Mia Master'),
  ('u','Una Sub'),('t','Tia Trial'),('e','Eve Ended'),('boss','Bea Boss'),('mem','Mo Member')) v(e, n);
SELECT set_end(e || '@t.test', now() - interval '20 days') FROM unnest(ARRAY['sa','sb','ad','ow','ma','u','e','boss','mem']) e;
SELECT set_end('t@t.test', now() + interval '5 days');
INSERT INTO public.user_roles(user_id, role) VALUES (uid('sa@t.test'), 'super_admin'), (uid('sa@t.test'), 'admin'), (uid('sb@t.test'), 'super_admin'),
  (uid('ad@t.test'), 'admin'), (uid('ow@t.test'), 'owner');
INSERT INTO public.master_access(user_id, note) VALUES (uid('ma@t.test'), 'test master');
INSERT INTO public.subscribers(user_id, email, subscribed, plan_key, subscription_status) VALUES
  (uid('u@t.test'), 'u@t.test', true, 'starter', 'active'), (uid('boss@t.test'), 'boss@t.test', true, 'professional', 'active');
INSERT INTO public.organization_members(organization_id, user_id, role)
  SELECT b.organization_id, uid('mem@t.test'), 'member' FROM public.organization_billing b WHERE b.billing_user_id = uid('boss@t.test');
CREATE TABLE states_before AS SELECT u.email, st(u.email) AS s FROM auth.users u JOIN public.profiles p ON p.id = u.id;

-- ============ 1. The problem, before the proposal ============
SELECT ok('BEFORE: Suspend only flips the flag (live RPC succeeds)', sus('sa@t.test', 'u@t.test', false) = 'OK' AND flag('u@t.test') = 'false');
SELECT ok('BEFORE: the suspended subscriber still gets full access (subscribed)', my_state('u@t.test') LIKE 'subscribed/self/%', my_state('u@t.test'));
SELECT ok('BEFORE: the suspended person can switch themselves back to Active from the browser',
  as_user('u@t.test', 'UPDATE public.profiles SET is_active = true WHERE id = auth.uid()') = 'OK' AND flag('u@t.test') = 'true');
SELECT ok('BEFORE: a super admin, an admin, a master account can all be "suspended"',
  sus('sa@t.test', 'sb@t.test', false) = 'OK' AND sus('sa@t.test', 'ad@t.test', false) = 'OK' AND sus('sa@t.test', 'ma@t.test', false) = 'OK');
-- back to the baseline (all active, audit cleared)
UPDATE public.profiles SET is_active = true;
DELETE FROM public.admin_audit_logs;

-- ============ 2. Apply ============
\i proposal.sql
-- (applying it twice, and re-applying after rollback, are checked by run-test.sh)

SELECT ok('No state changes for anyone who is active', NOT EXISTS (SELECT 1 FROM states_before b WHERE st(b.email) IS DISTINCT FROM b.s),
  (SELECT string_agg(b.email || ': ' || b.s || ' -> ' || st(b.email), '; ') FROM states_before b WHERE st(b.email) IS DISTINCT FROM b.s));

-- ============ 3. The flag is locked ============
SELECT ok('A user cannot change their own is_active (UPDATE refused)',
  as_user('u@t.test', 'UPDATE public.profiles SET is_active = false WHERE id = auth.uid()') LIKE 'ERROR 42501%permission denied%');
SELECT ok('…nor INSERT a profile with is_active',
  try(format('DELETE FROM public.profiles WHERE id = %L', uid('e@t.test'))) = 'OK'
  AND as_user('e@t.test', 'INSERT INTO public.profiles(id, is_active) VALUES (auth.uid(), true)') LIKE 'ERROR 42501%permission denied%'
  AND as_user('e@t.test', 'INSERT INTO public.profiles(id, email) VALUES (auth.uid(), ''e@t.test'')') = 'OK');
SELECT set_end('e@t.test', now() - interval '20 days');
SELECT ok('anon cannot write is_active', as_anon('UPDATE public.profiles SET is_active = true') LIKE 'ERROR 42501%');
SELECT ok('Every other profile field still saves (Settings, profile dialog, theme, avatar)',
  as_user('u@t.test', $q$UPDATE public.profiles SET full_name='U S', display_name='US', theme='dark', currency_code='GBP', timezone='Europe/London',
         country_code='GB', language_code='en', date_format='DD/MM/YYYY', time_format='24h', avatar_url='a.png', bio='b', updated_at=now() WHERE id = auth.uid()$q$) = 'OK'
  AND fresh($q$SELECT theme || display_name FROM public.profiles WHERE email = 'u@t.test'$q$) = 'darkUS');
SELECT ok('ProfileSetup and avatar upserts (no is_active) still work',
  as_user('u@t.test', $q$INSERT INTO public.profiles(id, email, full_name, headline, is_public) VALUES (auth.uid(), 'u@t.test', 'U', 'h', true)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, headline = EXCLUDED.headline, is_public = EXCLUDED.is_public$q$) = 'OK'
  AND as_user('u@t.test', $q$INSERT INTO public.profiles(id, email, avatar_url) VALUES (auth.uid(), 'u@t.test', 'x.png')
         ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url$q$) = 'OK');
SELECT ok('Trial columns are still locked (Phase 12)', as_user('u@t.test', $q$UPDATE public.profiles SET trial_ends_at = '2099-01-01' WHERE id = auth.uid()$q$) LIKE 'ERROR 42501%');
SELECT ok('Grants: only is_active changed (INSERT/UPDATE gone for authenticated, anon SELECT kept); table ACL and all other columns identical',
  (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass) = (SELECT acl FROM snap_acl WHERE obj = 'table')
  AND NOT EXISTS (SELECT 1 FROM snap_acl s JOIN pg_attribute a ON a.attrelid = 'public.profiles'::regclass AND a.attname = s.obj
                   WHERE s.obj <> 'is_active' AND a.attacl::text IS DISTINCT FROM s.acl)
  AND NOT has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE') AND NOT has_column_privilege('authenticated', 'public.profiles', 'is_active', 'INSERT')
  AND has_column_privilege('authenticated', 'public.profiles', 'is_active', 'SELECT') AND has_column_privilege('anon', 'public.profiles', 'is_active', 'SELECT')
  AND has_column_privilege('service_role', 'public.profiles', 'is_active', 'UPDATE'),
  (SELECT attacl::text FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'is_active'));
SELECT ok('Sign-up still works and starts active with a 14-day trial (handle_new_user, unchanged)',
  (SELECT signup('new@t.test', 'Nia New')) IS NOT NULL AND flag('new@t.test') = 'true' AND my_state('new@t.test') = 'trial/self/14/-'
  AND (SELECT def FROM snap_fn WHERE name = 'handle_new_user') = (SELECT md5(pg_get_functiondef('public.handle_new_user()'::regprocedure))));

-- ============ 4. Suspended means suspended ============
CREATE TABLE before_suspend AS SELECT e, st(e) AS s FROM unnest(ARRAY['u@t.test','t@t.test','e@t.test','mem@t.test']) e;
SELECT ok('Super admin suspends a subscriber, a running trial, an ended trial and a company member',
  sus('sa@t.test', 'u@t.test', false) = 'OK' AND sus('sa@t.test', 't@t.test', false) = 'OK'
  AND sus('sa@t.test', 'e@t.test', false) = 'OK' AND sus('sa@t.test', 'mem@t.test', false) = 'OK');
SELECT ok('Suspended subscriber: suspended (no plan)', my_state('u@t.test') = 'suspended/self/0/-', my_state('u@t.test'));
SELECT ok('Suspended in a running trial: suspended, 0 days', my_state('t@t.test') = 'suspended/self/0/-', my_state('t@t.test'));
SELECT ok('Suspended after the trial: suspended (not trial_ended)', my_state('e@t.test') = 'suspended/self/0/-', my_state('e@t.test'));
SELECT ok('Suspended member of a subscribed company: suspended, the company plan does not help', my_state('mem@t.test') = 'suspended/self/0/-', my_state('mem@t.test'));
SELECT ok('Full row: suspended / no trial date / 0 / no plan / no status / self / no owner name',
  (SELECT s.trial_ends_at IS NULL AND s.plan_key IS NULL AND s.subscription_status IS NULL AND s.owner_name IS NULL FROM public._access_state_for(uid('u@t.test')) s));
SELECT ok('The company owner is not affected by a suspended member', my_state('boss@t.test') LIKE 'subscribed/self/%');
SELECT ok('A suspended person cannot switch themselves back on', as_user('u@t.test', 'UPDATE public.profiles SET is_active = true WHERE id = auth.uid()') LIKE 'ERROR 42501%'
  AND flag('u@t.test') = 'false' AND my_state('u@t.test') LIKE 'suspended/%');
SELECT ok('…nor touch any trial column', as_user('u@t.test', $q$UPDATE public.profiles SET trial_ends_at = '2099-01-01', is_trial_active = true WHERE id = auth.uid()$q$) LIKE 'ERROR 42501%');
SELECT ok('Reactivating restores every previous state exactly',
  sus('sa@t.test', 'u@t.test', true) = 'OK' AND sus('sa@t.test', 't@t.test', true) = 'OK' AND sus('sa@t.test', 'e@t.test', true) = 'OK' AND sus('sa@t.test', 'mem@t.test', true) = 'OK'
  AND NOT EXISTS (SELECT 1 FROM before_suspend b WHERE st(b.e) IS DISTINCT FROM b.s),
  (SELECT string_agg(b.e || ': ' || b.s || ' -> ' || st(b.e), '; ') FROM before_suspend b WHERE st(b.e) IS DISTINCT FROM b.s));
SELECT ok('Audit: 4 user.suspended and 4 user.reactivated rows, by the super admin',
  audits('user.suspended') = 4 AND audits('user.reactivated') = 4
  AND fresh(format('SELECT count(*)::text FROM public.admin_audit_logs WHERE admin_id <> %L', uid('sa@t.test'))) = '0');

-- ============ 5. Who can and can't be suspended ============
SELECT ok('A super admin cannot be suspended', sus('sa@t.test', 'sb@t.test', false) LIKE 'ERROR P0001%cannot_suspend_super_admin%', sus('sa@t.test', 'sb@t.test', false));
SELECT ok('An admin-role user cannot be suspended', sus('sa@t.test', 'ad@t.test', false) LIKE 'ERROR P0001%cannot_suspend_admin%');
SELECT ok('An owner-role user cannot be suspended', sus('sa@t.test', 'ow@t.test', false) LIKE 'ERROR P0001%cannot_suspend_admin%');
SELECT ok('A master account cannot be suspended', sus('sa@t.test', 'ma@t.test', false) LIKE 'ERROR P0001%cannot_suspend_master%');
SELECT ok('Nobody can suspend themselves', sus('sa@t.test', 'sa@t.test', false) LIKE 'ERROR 42501%You cannot change your own status%');
SELECT ok('An admin who is not a super admin is refused', sus('ad@t.test', 'u@t.test', false) LIKE 'ERROR 42501%Not authorized%');
SELECT ok('A normal user is refused', sus('u@t.test', 'e@t.test', false) LIKE 'ERROR 42501%Not authorized%');
SELECT ok('anon cannot call it', as_anon(format('SELECT public.admin_set_user_status(%L, false)', uid('u@t.test'))) LIKE 'ERROR 42501%permission denied%');
SELECT ok('A missing user is refused (P0002)', as_user('sa@t.test', format('SELECT public.admin_set_user_status(%L, false)', gen_random_uuid())) LIKE 'ERROR P0002%no such user%');
SELECT ok('A missing on/off is refused', as_user('sa@t.test', format('SELECT public.admin_set_user_status(%L, NULL)', uid('u@t.test'))) LIKE 'ERROR 22004%');
SELECT ok('Refusals changed nothing and wrote no audit row',
  flag('sb@t.test') = 'true' AND flag('ad@t.test') = 'true' AND flag('ow@t.test') = 'true' AND flag('ma@t.test') = 'true' AND flag('sa@t.test') = 'true'
  AND audits('user.suspended') = 4);
SELECT ok('Even if a protected account''s flag is false (set behind the RPC''s back), it is never blocked',
  try($q$UPDATE public.profiles SET is_active = false WHERE email IN ('sb@t.test','ad@t.test','ow@t.test','ma@t.test')$q$) = 'OK'
  AND my_state('sb@t.test') LIKE 'owner/%' AND my_state('ad@t.test') LIKE 'owner/%' AND my_state('ow@t.test') LIKE 'owner/%' AND my_state('ma@t.test') LIKE 'owner/%');
SELECT ok('Reactivating a protected account is allowed (it only clears the flag)', sus('sa@t.test', 'ad@t.test', true) = 'OK' AND flag('ad@t.test') = 'true');
UPDATE public.profiles SET is_active = true;
SELECT ok('Switching a master off and then suspending works (the order the Admin page asks for)',
  as_user('sa@t.test', format('SELECT public.set_master_access(%L, true)', uid('sa@t.test'))) = 'OK'
  AND as_user('sa@t.test', format('SELECT public.set_master_access(%L, false)', uid('ma@t.test'))) = 'OK'
  AND sus('sa@t.test', 'ma@t.test', false) = 'OK' AND my_state('ma@t.test') = 'suspended/self/0/-'
  AND sus('sa@t.test', 'ma@t.test', true) = 'OK');

-- ============ 6. Function security ============
SELECT ok('admin_set_user_status: SECURITY DEFINER, SET search_path = '''', returns boolean, same signature',
  (SELECT prosecdef AND proconfig = ARRAY['search_path=""'] AND prorettype = 'boolean'::regtype FROM pg_proc WHERE oid = 'public.admin_set_user_status(uuid,boolean)'::regprocedure));
SELECT ok('admin_set_user_status grants unchanged: authenticated and service_role only',
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public.admin_set_user_status(uuid,boolean)'::regprocedure) = (SELECT acl FROM snap_fn WHERE name = 'admin_set_user_status'));
SELECT ok('_suspension_protected: service_role only; SET search_path = ''''',
  NOT has_function_privilege('authenticated', 'public._suspension_protected(uuid)', 'EXECUTE') AND NOT has_function_privilege('anon', 'public._suspension_protected(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public._suspension_protected(uuid)', 'EXECUTE')
  AND (SELECT proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public._suspension_protected(uuid)'::regprocedure));
SELECT ok('_access_state_for and my_access_state: grants and search_path unchanged; my_access_state body unchanged',
  (SELECT proacl::text = (SELECT acl FROM snap_fn WHERE name = '_access_state_for') AND proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure)
  AND (SELECT md5(pg_get_functiondef(oid)) FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure) = (SELECT def FROM snap_fn WHERE name = 'my_access_state'));
SELECT ok('_access_state_for = the live body plus exactly one new rule (one "suspended", master_access still mentioned once)',
  (SELECT (length(prosrc) - length(replace(prosrc, '''suspended''', ''))) / length('''suspended''') = 1
      AND (length(prosrc) - length(replace(prosrc, 'master_access', ''))) / length('master_access') = 1 FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure));
SELECT ok('Other live functions untouched (admin_log_action, handle_new_user, set_master_access, list_master_access)',
  (SELECT count(*) FROM snap_fn s JOIN pg_proc p ON p.proname = s.name JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE s.name IN ('admin_log_action','handle_new_user','set_master_access','list_master_access') AND md5(pg_get_functiondef(p.oid)) = s.def AND p.proacl::text IS NOT DISTINCT FROM s.acl) = 4);

-- ============ 7. rollback.sql ============
SELECT sus('sa@t.test', 'u@t.test', false); -- leave one suspended account in place
\i rollback.sql
SELECT ok('Rollback: both functions byte-for-byte as live again (full definition, body, search_path, grants)',
  NOT EXISTS (SELECT 1 FROM snap_fn s JOIN pg_proc p ON p.proname = s.name JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE s.name IN ('_access_state_for','admin_set_user_status')
      AND (md5(pg_get_functiondef(p.oid)) IS DISTINCT FROM s.def OR md5(p.prosrc) IS DISTINCT FROM s.src OR p.proacl::text IS DISTINCT FROM s.acl OR p.proconfig::text IS DISTINCT FROM s.cfg))
  AND (SELECT proconfig::text FROM pg_proc WHERE oid = 'public.admin_set_user_status(uuid,boolean)'::regprocedure) = '{search_path=public}');
SELECT ok('Rollback: profiles table and every column ACL exactly as before',
  (SELECT relacl::text FROM pg_class WHERE oid = 'public.profiles'::regclass) = (SELECT acl FROM snap_acl WHERE obj = 'table')
  AND NOT EXISTS (SELECT 1 FROM snap_acl s JOIN pg_attribute a ON a.attrelid = 'public.profiles'::regclass AND a.attname = s.obj
                   WHERE s.obj <> 'table' AND a.attacl::text IS DISTINCT FROM s.acl),
  (SELECT attacl::text FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'is_active'));
SELECT ok('Rollback: helper dropped', to_regprocedure('public._suspension_protected(uuid)') IS NULL);
SELECT ok('Rollback: the flag is display-only again (the suspended subscriber is back to subscribed, as the README warns)',
  my_state('u@t.test') LIKE 'subscribed/self/%');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR coalesce(detail, '') = '' THEN '' ELSE ' [' || detail || ']' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
