-- Phase 12b test (throwaway Postgres only; run-test.sh). Baseline = support + onboarding harness fixtures, the Phase 12
-- live shapes (docs/phase12/fixture-live.sql), the live admin_audit_logs (fixture-live.sql here), then Phase 12's
-- proposal.sql exactly as it is live today. Then proposal.sql, every rule, data-step.sql, rollback.sql.
\set ON_ERROR_STOP 1
\i p12-fixture-live.sql
\i fixture-live.sql
\i p12-proposal.sql

-- Helpers (same as docs/phase12/test.sql)
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
-- The caller's own my_access_state(), as that user: "state/via/days_left"
CREATE FUNCTION my_state(e text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE v text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid(e), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN SELECT s.state || '/' || s.via || '/' || s.days_left INTO v FROM public.my_access_state() s;
  EXCEPTION WHEN others THEN v := 'ERROR ' || SQLERRM; END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', '{}', true); RETURN v; END $$;
CREATE FUNCTION st(e text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT concat_ws('/', s.state, s.via, s.days_left, coalesce(s.plan_key,'-'), coalesce(s.subscription_status,'-'), coalesce(s.owner_name,'-'))
  FROM public._access_state_for(uid(e)) s $$;
CREATE FUNCTION set_end(e text, t timestamptz) RETURNS void LANGUAGE sql AS $$ UPDATE public.profiles SET trial_ends_at = t WHERE id = uid(e) $$;
CREATE FUNCTION sw(caller text, target text, onoff bool, note text DEFAULT NULL) RETURNS text LANGUAGE sql AS $$
  SELECT as_user(caller, format('SELECT public.set_master_access(%L, %L, %L)', uid(target), onoff, note)) $$;
CREATE FUNCTION audits(action text) RETURNS bigint LANGUAGE sql VOLATILE AS $$ SELECT count(*) FROM public.admin_audit_logs WHERE admin_audit_logs.action = audits.action $$;
SET check_function_bodies = on;

-- ============ 0. Baseline = production today ============
SELECT ok('Local Phase 12 _access_state_for body is byte-for-byte the production one (md5(prosrc) read 2026-10-28)',
  (SELECT md5(prosrc) = 'f8c1f091832a8f06837f4928ce0bf91c' AND md5(pg_get_function_result(oid)) = '2b10abc13bcb9b7198c8a6142c7cd9a6'
     FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure),
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure));
CREATE TABLE snap AS SELECT md5(pg_get_functiondef('public._access_state_for(uuid)'::regprocedure)) AS def,
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) AS acl,
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure) AS mas_acl;

-- People: SA super admin (+admin, like owner 1), AD admin only (like owner 2), U plain user, M1/M2 future masters,
-- MEM a member of U's company, S a subscriber. All trials long over unless stated.
SELECT signup('sa@t.test', 'Sara Super'), signup('ad@t.test', 'Adam Admin'), signup('u@t.test', 'Una User'),
       signup('m1@t.test', 'Mia Master'), signup('m2@t.test', 'Max Master'), signup('mem@t.test', 'Mo Member'),
       signup('s@t.test', 'Sol Sub'), signup('new@t.test', 'Nia New');
SELECT set_end(e, now() - interval '20 days') FROM unnest(ARRAY['sa@t.test','ad@t.test','u@t.test','m1@t.test','m2@t.test','mem@t.test','s@t.test']) e;
INSERT INTO public.user_roles(user_id, role) VALUES (uid('sa@t.test'), 'super_admin'), (uid('sa@t.test'), 'admin'),
  (uid('ad@t.test'), 'admin'), (uid('ad@t.test'), 'user'), (uid('u@t.test'), 'user');
INSERT INTO public.subscribers(user_id, email, subscribed, plan_key, subscription_status) VALUES (uid('s@t.test'), 's@t.test', true, 'starter', 'active');
INSERT INTO public.organization_members(organization_id, user_id, role)
  SELECT b.organization_id, uid('mem@t.test'), 'member' FROM public.organization_billing b WHERE b.billing_user_id = uid('m1@t.test');
CREATE TABLE states_before AS SELECT u.email, st(u.email) AS s FROM auth.users u JOIN public.profiles p ON p.id = u.id;

-- ============ 1. Apply ============
\i proposal.sql
-- (applying it twice, and re-applying after rollback, are checked by run-test.sh)

SELECT ok('Every Phase 12 state is unchanged when there are no master accounts',
  NOT EXISTS (SELECT 1 FROM states_before b WHERE st(b.email) IS DISTINCT FROM b.s),
  (SELECT string_agg(b.email || ': ' || b.s || ' -> ' || st(b.email), '; ') FROM states_before b WHERE st(b.email) IS DISTINCT FROM b.s));
SELECT ok('_access_state_for: same grants (service_role only) and SET search_path = ''''',
  (SELECT proacl::text FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) = (SELECT acl FROM snap)
  AND (SELECT proconfig = ARRAY['search_path=""'] AND prosecdef FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure)
  AND (SELECT proacl::text FROM pg_proc WHERE oid = 'public.my_access_state()'::regprocedure) = (SELECT mas_acl FROM snap));
SELECT ok('_access_state_for = the Phase 12 body plus exactly one master-account rule',
  (SELECT length(pg_get_functiondef('public._access_state_for(uuid)'::regprocedure)) - length(replace(pg_get_functiondef('public._access_state_for(uuid)'::regprocedure), 'master_access', '')))
    = length('master_access'));

-- ============ 2. The table is closed ============
SELECT ok('master_access: RLS on, no policies', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.master_access'::regclass)
  AND NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.master_access'::regclass));
SELECT ok('master_access: no privilege for anon or authenticated (Supabase default grants revoked), service_role full',
  NOT has_table_privilege('authenticated', 'public.master_access', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.master_access', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.master_access', 'UPDATE') AND NOT has_table_privilege('authenticated', 'public.master_access', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.master_access', 'SELECT') AND NOT has_table_privilege('anon', 'public.master_access', 'INSERT')
  AND has_table_privilege('service_role', 'public.master_access', 'SELECT') AND has_table_privilege('service_role', 'public.master_access', 'INSERT')
  AND has_table_privilege('service_role', 'public.master_access', 'DELETE'),
  (SELECT relacl::text FROM pg_class WHERE oid = 'public.master_access'::regclass));
SELECT ok('A normal user cannot read master_access', as_user('u@t.test', 'SELECT * FROM public.master_access') LIKE 'ERROR 42501%permission denied%');
SELECT ok('A normal user cannot switch themselves on by writing the table',
  as_user('u@t.test', 'INSERT INTO public.master_access(user_id) VALUES (auth.uid())') LIKE 'ERROR 42501%permission denied%');
SELECT ok('Even a super admin cannot write the table directly (only through the function)',
  as_user('sa@t.test', 'INSERT INTO public.master_access(user_id) VALUES (auth.uid())') LIKE 'ERROR 42501%permission denied%');
SELECT ok('anon cannot read the table', as_anon('SELECT * FROM public.master_access') LIKE 'ERROR 42501%');

-- ============ 3. Function security ============
SELECT ok('set_master_access / list_master_access: SECURITY DEFINER, SET search_path = ''''',
  (SELECT bool_and(prosecdef AND proconfig = ARRAY['search_path=""']) AND count(*) = 2 FROM pg_proc
    WHERE oid IN ('public.set_master_access(uuid,boolean,text)'::regprocedure, 'public.list_master_access()'::regprocedure)));
SELECT ok('Both functions: authenticated and service_role only (not anon, not PUBLIC)',
  has_function_privilege('authenticated', 'public.set_master_access(uuid,boolean,text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.set_master_access(uuid,boolean,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.list_master_access()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_master_access(uuid,boolean,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.list_master_access()', 'EXECUTE')
  AND NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid IN ('public.set_master_access(uuid,boolean,text)'::regprocedure,
        'public.list_master_access()'::regprocedure) AND a.grantee = 0));
SELECT ok('anon cannot call set_master_access', as_anon(format('SELECT public.set_master_access(%L, true)', uid('u@t.test'))) LIKE 'ERROR 42501%permission denied%');
SELECT ok('anon cannot call list_master_access', as_anon('SELECT * FROM public.list_master_access()') LIKE 'ERROR 42501%permission denied%');
SELECT ok('A normal user calling set_master_access is refused (42501)', sw('u@t.test', 'u@t.test', true) LIKE 'ERROR 42501%only a super admin%');
SELECT ok('An admin who is not a super admin is refused too (42501)', sw('ad@t.test', 'm1@t.test', true) LIKE 'ERROR 42501%only a super admin%');
SELECT ok('A non-super-admin calling list_master_access is refused (42501)',
  as_user('ad@t.test', 'SELECT * FROM public.list_master_access()') LIKE 'ERROR 42501%only a super admin%'
  AND as_user('u@t.test', 'SELECT * FROM public.list_master_access()') LIKE 'ERROR 42501%only a super admin%');
SELECT uid('u@t.test') AS u_id \gset
CREATE TEMP TABLE svc(res text);
GRANT ALL ON svc TO service_role;
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET LOCAL ROLE service_role;
INSERT INTO svc SELECT try(format('SELECT public.set_master_access(%L, true)', :'u_id'));
RESET ROLE;
SELECT ok('Service role with no user is refused too (a super admin must be recorded as the one who did it)',
  (SELECT res FROM svc) LIKE 'ERROR 42501%only a super admin%', (SELECT res FROM svc));
COMMIT;
SELECT ok('Refusals wrote nothing', (SELECT count(*) FROM public.master_access) = 0 AND (SELECT count(*) FROM public.admin_audit_logs) = 0);

-- ============ 4. Switch on ============
SELECT ok('Before: M1 (trial ended, no role) sees trial_ended', my_state('m1@t.test') LIKE 'trial_ended/self/0', my_state('m1@t.test'));
SELECT ok('Super admin switches M1 on', sw('sa@t.test', 'm1@t.test', true, '  Founding partner  ') = 'OK');
SELECT ok('M1: my_access_state() = owner, even with an ended trial and no admin role', my_state('m1@t.test') = 'owner/self/0', my_state('m1@t.test'));
SELECT ok('M1 gets no platform role and no Admin portal (is_super_admin false, no user_roles row)',
  NOT public.is_super_admin(uid('m1@t.test')) AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid('m1@t.test')));
SELECT ok('Audit row: who, whom, on, note (trimmed), when',
  fresh($q$SELECT count(*)::text FROM public.admin_audit_logs WHERE action = 'master_access.on' AND admin_email = 'sa@t.test' AND target_type = 'user'
           AND details->>'note' = 'Founding partner' AND created_at <= now() AND status = 'success'$q$) = '1'
  AND fresh(format('SELECT (admin_id = %L AND target_id = %L)::text FROM public.admin_audit_logs WHERE action = %L', uid('sa@t.test'), uid('m1@t.test'), 'master_access.on')) = 'true');
SELECT ok('Row records who granted it and the note', fresh(format('SELECT (granted_by = %L AND note = %L)::text FROM public.master_access WHERE user_id = %L',
  uid('sa@t.test'), 'Founding partner', uid('m1@t.test'))) = 'true');
SELECT ok('M1''s company member is NOT made a master (only M1 is; the member still follows the billing owner''s plan)',
  my_state('mem@t.test') LIKE 'trial_ended/company/%', my_state('mem@t.test'));
SELECT ok('Switching on again: no change, no second audit row',
  sw('sa@t.test', 'm1@t.test', true) = 'OK' AND audits('master_access.on') = 1
  AND as_user('sa@t.test', format('DO $d$ BEGIN IF (public.set_master_access(%L, true))->>%L <> %L THEN RAISE EXCEPTION %L; END IF; END $d$', uid('m1@t.test'), 'changed', 'false', 'bad')) = 'OK');
SELECT ok('Super admin switches M2 on', sw('sa@t.test', 'm2@t.test', true) = 'OK' AND my_state('m2@t.test') = 'owner/self/0');
SELECT ok('list_master_access: user id, email, display name, granted_at, note; nothing else',
  as_user('sa@t.test', $q$DO $d$ BEGIN
    IF (SELECT string_agg(email || '|' || display_name || '|' || coalesce(note, '-'), ', ' ORDER BY email) FROM public.list_master_access())
       <> 'm1@t.test|Mia Master|Founding partner, m2@t.test|Max Master|-' THEN RAISE EXCEPTION 'bad list'; END IF;
    IF (SELECT count(*) FROM public.list_master_access() WHERE user_id IS NULL OR granted_at IS NULL) > 0 THEN RAISE EXCEPTION 'missing'; END IF;
  END $d$$q$) = 'OK'
  AND (SELECT array_to_string(proargnames, ',') FROM pg_proc WHERE oid = 'public.list_master_access()'::regprocedure) = 'user_id,email,display_name,granted_at,note');

-- ============ 5. Switch off, and the last master ============
SELECT ok('Super admin switches M1 off', sw('sa@t.test', 'm1@t.test', false) = 'OK');
SELECT ok('M1 is back to the normal rules: trial_ended', my_state('m1@t.test') = 'trial_ended/self/0', my_state('m1@t.test'));
SELECT ok('Audit row for off', audits('master_access.off') = 1);
SELECT ok('The last master account cannot be removed', sw('sa@t.test', 'm2@t.test', false) LIKE 'ERROR P0001%last_master_account: you can''t remove the last master account%',
  sw('sa@t.test', 'm2@t.test', false));
SELECT ok('…so M2 keeps owner access and no audit row was written', my_state('m2@t.test') = 'owner/self/0' AND audits('master_access.off') = 1);
SELECT ok('Switching off someone who is not a master is a harmless no-op, even with one master left',
  sw('sa@t.test', 'u@t.test', false) = 'OK' AND audits('master_access.off') = 1 AND (SELECT count(*) FROM public.master_access) = 1);
SELECT ok('A super admin cannot be locked out: switch SA on, then off — SA still owner (role) and still a super admin',
  sw('sa@t.test', 'sa@t.test', true) = 'OK' AND sw('sa@t.test', 'sa@t.test', false) = 'OK'
  AND my_state('sa@t.test') = 'owner/self/0' AND public.is_super_admin(uid('sa@t.test'))
  AND as_user('sa@t.test', 'SELECT * FROM public.list_master_access()') = 'OK');
SELECT ok('Unknown user is refused (P0002); nothing written', as_user('sa@t.test', format('SELECT public.set_master_access(%L, true)', gen_random_uuid())) LIKE 'ERROR P0002%no such user%');
SELECT ok('Note over 300 characters is refused', sw('sa@t.test', 'u@t.test', true, repeat('x', 301)) LIKE 'ERROR 22001%300 characters%'
  AND NOT EXISTS (SELECT 1 FROM public.master_access WHERE user_id = uid('u@t.test')));
SELECT ok('Missing on/off is refused', as_user('sa@t.test', format('SELECT public.set_master_access(%L, NULL)', uid('u@t.test'))) LIKE 'ERROR 22004%');
SELECT ok('Audit totals: 3 on (M1, M2, SA) and 2 off (M1, SA); refusals and no-ops wrote nothing',
  audits('master_access.on') = 3 AND audits('master_access.off') = 2 AND (SELECT count(*) FROM public.admin_audit_logs) = 5);
SELECT ok('Deleting the user removes their master row (ON DELETE CASCADE)',
  sw('sa@t.test', 'new@t.test', true) = 'OK'
  AND try(format('DELETE FROM public.organizations WHERE created_by = %L', uid('new@t.test'))) = 'OK'
  AND try(format('DELETE FROM auth.users WHERE id = %L', uid('new@t.test'))) = 'OK'
  AND (SELECT count(*) FROM public.master_access) = 1);

-- ============ 6. A master with other states ============
SELECT ok('A master who also has a running trial or a subscription is reported as owner (master wins, like the admin role)',
  sw('sa@t.test', 's@t.test', true) = 'OK' AND my_state('s@t.test') = 'owner/self/0'
  AND sw('sa@t.test', 's@t.test', false) = 'OK' AND st('s@t.test') LIKE 'subscribed/self/%');
SELECT ok('Phase 12 days_left still computed for a master during their trial',
  (SELECT set_end('m2@t.test', now() + interval '3 days 2 hours')) IS NULL AND st('m2@t.test') = 'owner/self/4/-/-/-', st('m2@t.test'));
SELECT set_end('m2@t.test', now() - interval '20 days');

-- ============ 7. data-step.sql ============
SELECT signup('toufikze@gmail.com', 'Owner One'); -- only one of the two owner emails exists in this test database
SELECT set_end('toufikze@gmail.com', now() - interval '20 days');
\i data-step.sql
SELECT ok('data-step: the owner account that exists is a master; the missing one is skipped (no row, no error)',
  EXISTS (SELECT 1 FROM public.master_access WHERE user_id = uid('toufikze@gmail.com') AND note = 'Phase 12b seed: owner account' AND granted_by IS NULL)
  AND (SELECT count(*) FROM public.master_access) = 2 AND my_state('toufikze@gmail.com') = 'owner/self/0');
\i data-step.sql
SELECT ok('data-step is idempotent (second run adds nothing)', (SELECT count(*) FROM public.master_access) = 2);
SELECT ok('data-step looks the email up case-insensitively',
  (SELECT signup('Toufik.Zemri@Outlook.com', 'Owner Two')) IS NOT NULL);
\i data-step.sql
SELECT ok('…and seeds the second owner once it exists', (SELECT count(*) FROM public.master_access) = 3
  AND my_state('Toufik.Zemri@Outlook.com') = 'owner/self/14');

-- ============ 8. rollback.sql ============
CREATE TABLE audit_before AS SELECT count(*) AS n FROM public.admin_audit_logs;
\i rollback.sql
SELECT ok('Rollback: _access_state_for is byte-for-byte the production one again (full definition and body md5), same grants',
  md5(pg_get_functiondef('public._access_state_for(uuid)'::regprocedure)) = (SELECT def FROM snap)
  AND (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) = 'f8c1f091832a8f06837f4928ce0bf91c'
  AND (SELECT proacl::text FROM pg_proc WHERE oid = 'public._access_state_for(uuid)'::regprocedure) = (SELECT acl FROM snap));
SELECT ok('Rollback: table and both functions are gone', to_regclass('public.master_access') IS NULL
  AND to_regprocedure('public.set_master_access(uuid,boolean,text)') IS NULL AND to_regprocedure('public.list_master_access()') IS NULL);
SELECT ok('Rollback: the audit history is kept', (SELECT count(*) FROM public.admin_audit_logs) = (SELECT n FROM audit_before));
SELECT ok('Rollback: masters fall back to the Phase 12 rules (M2: trial_ended); role holders keep owner (SA)',
  my_state('m2@t.test') = 'trial_ended/self/0' AND my_state('sa@t.test') = 'owner/self/0');

SELECT CASE WHEN ok THEN 'PASS|' ELSE 'FAIL|' END || name || CASE WHEN ok OR coalesce(detail, '') = '' THEN '' ELSE ' [' || detail || ']' END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
