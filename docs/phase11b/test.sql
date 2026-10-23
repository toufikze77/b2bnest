-- Phase 11b test (throwaway Postgres only; run-test.sh). Baseline = onboarding harness fixture + the LIVE definitions read
-- on 2026-10-23, then proposal.sql, data-step.sql, enable-caps.sql, every rule, then rollback back to the baseline.
\set ON_ERROR_STOP 1
-- Reshape to the live columns (read 2026-10-23)
ALTER TABLE platform_plans ADD COLUMN name text NOT NULL DEFAULT '', ADD COLUMN description text,
  ADD COLUMN monthly_price numeric NOT NULL DEFAULT 0, ADD COLUMN annual_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN currency text NOT NULL DEFAULT 'GBP', ADD COLUMN features jsonb NOT NULL DEFAULT '[]', ADD COLUMN ai_credit_limit int NOT NULL DEFAULT 0,
  ADD COLUMN storage_limit_mb int NOT NULL DEFAULT 0, ADD COLUMN project_limit int NOT NULL DEFAULT 0, ADD COLUMN document_limit int NOT NULL DEFAULT 0,
  ADD COLUMN is_featured bool NOT NULL DEFAULT false, ADD COLUMN archived_at timestamptz,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE platform_plans ALTER COLUMN key SET NOT NULL, ALTER COLUMN member_limit SET NOT NULL, ALTER COLUMN member_limit SET DEFAULT 0,
  ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE subscribers ADD COLUMN stripe_price_id text, ADD COLUMN subscription_tier text, ADD COLUMN billing_interval text;
-- Live definitions and ACLs as baseline
\i live-functions-2026-10-23.sql
GRANT EXECUTE ON FUNCTION _seat_caps_enabled(), _seat_pool(uuid), _seat_pool_orgs(uuid), _seat_pool_lock(uuid), _seat_needs_new(uuid,uuid,text),
  _org_billing_owner(uuid), organization_members_guard(), org_seat_summary(uuid), org_invite_member(uuid,text,text) TO service_role;
CREATE TABLE snap AS SELECT p.proname::text AS name, md5(pg_get_functiondef(p.oid)) AS def, p.proacl::text AS acl, p.proconfig::text AS cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('_seat_caps_enabled','_seat_pool','organization_members_guard','org_invite_member','org_seat_summary');
CREATE TABLE snap_cols AS SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_plans';

-- Helpers (some refer to functions the proposal creates, so their bodies are checked when they run)
SET check_function_bodies = off;
CREATE TABLE r(n serial, name text, ok bool, detail text);
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO r(name,ok,detail) VALUES (name, coalesce(cond,false), detail) $$;
CREATE FUNCTION try(stmt text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN EXECUTE stmt; RETURN 'OK'; EXCEPTION WHEN others THEN RETURN 'ERROR ' || SQLERRM; END $$;
CREATE FUNCTION uid(e text) RETURNS uuid LANGUAGE sql VOLATILE AS $$ SELECT id FROM auth.users WHERE email=e $$;
CREATE FUNCTION mk(e text) RETURNS uuid LANGUAGE sql AS $$ INSERT INTO auth.users(id,email,email_confirmed_at) VALUES (gen_random_uuid(), e, now()) RETURNING id $$;
CREATE FUNCTION add(org uuid, e text, role text DEFAULT 'member') RETURNS text LANGUAGE plpgsql AS $$ BEGIN
  IF uid(e) IS NULL THEN PERFORM mk(e); END IF;
  RETURN try(format('INSERT INTO organization_members(organization_id,user_id,role) VALUES (%L,%L,%L)', org, uid(e), role)); END $$;
CREATE FUNCTION as_user(e text, stmt text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE res text; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid(e), 'email', e)::text, true);
  SET LOCAL ROLE authenticated; res := try(stmt); RESET ROLE; RETURN res; END $$;
CREATE FUNCTION company(id uuid, owner_email text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF uid(owner_email) IS NULL THEN PERFORM mk(owner_email); END IF;
  INSERT INTO organizations(id, name, created_by) VALUES (id, 'Co ' || left(id::text, 4), uid(owner_email));
  INSERT INTO organization_members(organization_id, user_id, role) VALUES (id, uid(owner_email), 'owner'); END $$;
CREATE FUNCTION sub(owner_email text, plan text, price text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO subscribers(user_id,email,subscribed,plan_key,stripe_price_id) VALUES (uid(owner_email), owner_email, true, plan, price) $$;
CREATE FUNCTION seats(org uuid) RETURNS TABLE(used int, pending int, seat_limit int, basis text, enforced bool, admin_used int, admin_pending int, admin_limit int)
  LANGUAGE sql AS $$ SELECT s.used, s.pending, s.seat_limit, s.basis, s.enforced, a.admin_used, a.admin_pending, a.admin_limit
                     FROM _seat_pool(org) s CROSS JOIN _seat_pool_admins(org) a $$;
CREATE FUNCTION active(org uuid) RETURNS bigint LANGUAGE sql AS $$ SELECT count(*) FROM organization_members WHERE organization_id=org AND is_active $$;

SET check_function_bodies = on;
\i proposal.sql

-- 0. Structure, grants, search_path
SELECT ok('All replaced and new functions keep SET search_path = ''''',
  (SELECT bool_and(p.proconfig = ARRAY['search_path=""']) AND count(*) = 9 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('_seat_caps_enabled','_seat_pool','organization_members_guard','org_invite_member','org_seat_summary',
                                               '_seat_plan','_seat_pool_admins','_admin_seat_needs_new','_seat_pool_orgs')));
SELECT ok('Caps stay OFF after proposal', NOT _seat_caps_enabled());
SELECT ok('platform_plan_prices: RLS on; no anon/authenticated access; service_role can read and write',
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.platform_plan_prices'::regclass)
  AND NOT has_table_privilege('anon','public.platform_plan_prices','SELECT') AND NOT has_table_privilege('authenticated','public.platform_plan_prices','SELECT')
  AND NOT has_table_privilege('authenticated','public.platform_plan_prices','INSERT')
  AND has_table_privilege('service_role','public.platform_plan_prices','SELECT') AND has_table_privilege('service_role','public.platform_plan_prices','INSERT'));
SELECT ok('New helpers: service_role only (like the live helpers)',
  NOT has_function_privilege('authenticated','public._seat_pool_admins(uuid)','EXECUTE') AND NOT has_function_privilege('anon','public._seat_plan(uuid)','EXECUTE')
  AND has_function_privilege('service_role','public._admin_seat_needs_new(uuid,uuid,text)','EXECUTE'));
SELECT ok('org_seat_summary: authenticated and service_role, not anon (live ACL)',
  has_function_privilege('authenticated','public.org_seat_summary(uuid)','EXECUTE') AND has_function_privilege('service_role','public.org_seat_summary(uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.org_seat_summary(uuid)','EXECUTE'));
SELECT ok('Five plan rows with the owner''s limits',
  (SELECT string_agg(key||':'||member_limit||'/'||admin_limit||':'||monthly_price||'/'||annual_price, ' ' ORDER BY key) FROM platform_plans)
  = 'enterprise:100/10:89/890 enterprise_legacy:25/10:85/850 professional:50/5:59/590 professional_legacy:5/5:35/350 starter:1/1:19/190',
  (SELECT string_agg(key||':'||member_limit||'/'||admin_limit, ' ' ORDER BY key) FROM platform_plans));
SELECT ok('admin_limit can''t exceed member_limit', try($$INSERT INTO platform_plans(key,name,member_limit,admin_limit) VALUES ('bad','Bad',2,3)$$) LIKE 'ERROR%');

-- Fixture (production-shaped: owners own companies; one owner bills 2 companies)
\set S  '''10000000-0000-4000-8000-000000000001'''
\set X  '''10000000-0000-4000-8000-000000000002'''
\set B1 '''10000000-0000-4000-8000-000000000003'''
\set B2 '''10000000-0000-4000-8000-000000000004'''
\set L1 '''10000000-0000-4000-8000-000000000005'''
\set L2 '''10000000-0000-4000-8000-000000000006'''
\set L3 '''10000000-0000-4000-8000-000000000007'''
\set E  '''10000000-0000-4000-8000-000000000008'''
\set F  '''10000000-0000-4000-8000-000000000009'''
SELECT company(:S,'solo@t.test'); SELECT company(:X,'over@t.test'); SELECT company(:B1,'biz@t.test'); SELECT company(:B2,'biz@t.test');
SELECT company(:L1,'leg@t.test'); SELECT company(:L2,'leg@t.test'); SELECT company(:L3,'leg2@t.test'); SELECT company(:E,'scale@t.test');
SELECT company(:F,'free@t.test');
SELECT ok('Company creation records the billing owner (one pool for biz@, one for leg@)',
  (SELECT count(DISTINCT billing_user_id) FROM organization_billing WHERE organization_id IN (:B1,:B2)) = 1
  AND (SELECT count(DISTINCT billing_user_id) FROM organization_billing WHERE organization_id IN (:L1,:L2)) = 1);
-- Existing subscribers (earlier prices) BEFORE the new prices exist, then the data step records their price ids.
SELECT sub('solo@t.test','starter','price_solomonthly'), sub('over@t.test','starter','price_solomonthly'),
       sub('leg@t.test','professional','price_bus35'), sub('leg2@t.test','professional','price_bus35'), sub('scale@t.test','enterprise','price_scale85');
\i data-step.sql
SELECT ok('Data step recorded exactly the 2 earlier prices in use (Business £35, Scale £85)',
  (SELECT string_agg(stripe_price_id||'>'||plan_key, ' ' ORDER BY stripe_price_id) FROM platform_plan_prices) = 'price_bus35>professional_legacy price_scale85>enterprise_legacy');
-- A NEW Business subscriber after the new prices exist
SELECT sub('biz@t.test','professional','price_bus59');

-- Caps off: nothing is limited yet
SELECT ok('Caps off: Solo company can still add 2 more people', add(:X,'x1@t.test')='OK' AND add(:X,'x2@t.test')='OK');
SELECT ok('Caps off: summary says not enforced, limit known', (SELECT NOT enforced AND seat_limit=1 FROM seats(:X)));

\i enable-caps.sql
SELECT ok('Caps ON after enable-caps.sql', _seat_caps_enabled());

-- Plan resolution, legacy limits, free fallback
SELECT ok('Solo: 1 user, 1 admin, owner fills both', (SELECT used=1 AND seat_limit=1 AND admin_used=1 AND admin_limit=1 AND basis='subscription:starter' FROM seats(:S)));
SELECT ok('Business (new price): 50 users, 5 admins', (SELECT seat_limit=50 AND admin_limit=5 AND basis='subscription:professional' FROM seats(:B1)));
SELECT ok('Legacy Business (£35): 5 users, 5 admins', (SELECT seat_limit=5 AND admin_limit=5 AND basis='subscription:professional_legacy' FROM seats(:L1)));
SELECT ok('Legacy Scale (£85): 25 users, 10 admins', (SELECT seat_limit=25 AND admin_limit=10 AND basis='subscription:enterprise_legacy' FROM seats(:E)));
SELECT ok('Free pool keeps today''s fallback: no limit configured, not enforced', (SELECT seat_limit IS NULL AND admin_limit IS NULL AND NOT enforced AND basis='no_plan:no_limit_configured' FROM seats(:F)));
SELECT ok('Free pool can still add people and admins', add(:F,'f1@t.test','admin')='OK' AND add(:F,'f2@t.test','admin')='OK' AND add(:F,'f3@t.test')='OK');

-- User cap
SELECT ok('Solo user cap reached: adding a member is refused', add(:S,'s1@t.test') LIKE 'ERROR%no free seats%', add(:S,'s1@t.test'));

-- Nobody removed when over limit
SELECT ok('Over-limit pool keeps all 3 people (limit 1)', active(:X)=3 AND (SELECT used=3 AND seat_limit=1 AND enforced FROM seats(:X)));
SELECT ok('Over-limit pool cannot add more', add(:X,'x3@t.test') LIKE 'ERROR%no free seats%');
SELECT ok('Role change of an existing member is never blocked (member -> manager)',
  try(format($$UPDATE organization_members SET role='manager' WHERE organization_id=%L AND user_id=%L$$, :X, uid('x1@t.test')))='OK');
SELECT ok('Deactivation is never blocked', try(format($$UPDATE organization_members SET is_active=false WHERE organization_id=%L AND user_id=%L$$, :X, uid('x2@t.test')))='OK' AND active(:X)=2);

-- Pooled counting (legacy Business, 5 users across L1 + L2)
SELECT ok('Pool: add 2 to L1, the same person also to L2', add(:L1,'a1@t.test')='OK' AND add(:L1,'a2@t.test')='OK' AND add(:L2,'a1@t.test')='OK');
SELECT ok('Shared person counted once across the pool (3 staff)', (SELECT used FROM seats(:L2))=3);
SELECT ok('Pool fills to 5', add(:L2,'a3@t.test')='OK' AND add(:L1,'a4@t.test')='OK' AND (SELECT used FROM seats(:L1))=5);
SELECT ok('6th person refused in either company of the pool', add(:L2,'a5@t.test') LIKE 'ERROR%no free seats%' AND add(:L1,'a5@t.test') LIKE 'ERROR%no free seats%');
SELECT ok('Someone already in the pool can join the other company (no new seat)', add(:L2,'a4@t.test')='OK');

-- Re-activation
SELECT ok('Deactivate a4 in both companies, add a6: pool full again',
  try(format($$UPDATE organization_members SET is_active=false WHERE user_id=%L$$, uid('a4@t.test')))='OK' AND add(:L1,'a6@t.test')='OK' AND (SELECT used FROM seats(:L1))=5);
SELECT ok('Re-activating a4 is refused while the pool is full',
  try(format($$UPDATE organization_members SET is_active=true WHERE organization_id=%L AND user_id=%L$$, :L1, uid('a4@t.test'))) LIKE 'ERROR%no free seats%');

-- Invitation reservation (legacy Business pool of leg2@: owner + 3 = 4 of 5)
SELECT ok('leg2 pool at 4 of 5', add(:L3,'c1@t.test')='OK' AND add(:L3,'c2@t.test')='OK' AND add(:L3,'c3@t.test')='OK' AND (SELECT used FROM seats(:L3))=4);
SELECT ok('Owner invites inv@ (reserves the 5th seat)', as_user('leg2@t.test', format($$SELECT org_invite_member(%L,'inv@t.test','member')$$, :L3))='OK' AND (SELECT pending FROM seats(:L3))=1);
SELECT ok('A direct add while the seat is reserved is refused', add(:L3,'c4@t.test') LIKE 'ERROR%no free seats%');
SELECT ok('Inviting yet another person is refused (seat limit reached)', as_user('leg2@t.test', format($$SELECT org_invite_member(%L,'inv2@t.test','member')$$, :L3)) LIKE 'ERROR%seat limit reached%');
SELECT ok('The invited person joins using the reservation', add(:L3,'inv@t.test')='OK' AND (SELECT used=5 AND pending=0 FROM seats(:L3)));

-- Admin cap (new Business: 5 admins; owner counts as one)
SELECT ok('Business: owner + 4 admins = 5 admins', add(:B1,'b1@t.test','admin')='OK' AND add(:B1,'b2@t.test','admin')='OK'
  AND add(:B2,'b3@t.test','admin')='OK' AND add(:B2,'b4@t.test','admin')='OK' AND (SELECT admin_used FROM seats(:B1))=5);
SELECT ok('6th admin refused; the same person can join as a member', add(:B1,'b5@t.test','admin') LIKE 'ERROR%no free admin seats%' AND add(:B1,'b5@t.test','member')='OK');
SELECT ok('An admin of B1 can also be admin of B2 (same person, no new admin seat)', add(:B2,'b1@t.test','admin')='OK' AND (SELECT admin_used FROM seats(:B2))=5);
SELECT ok('Promoting a member to admin is refused when admin seats are full',
  try(format($$UPDATE organization_members SET role='admin' WHERE organization_id=%L AND user_id=%L$$, :B1, uid('b5@t.test'))) LIKE 'ERROR%no free admin seats%');
SELECT ok('Demoting an admin is never blocked', try(format($$UPDATE organization_members SET role='member' WHERE organization_id=%L AND user_id=%L$$, :B2, uid('b4@t.test')))='OK');
SELECT ok('After the demotion, the promotion succeeds; still 5 admins',
  try(format($$UPDATE organization_members SET role='admin' WHERE organization_id=%L AND user_id=%L$$, :B1, uid('b5@t.test')))='OK' AND (SELECT admin_used FROM seats(:B1))=5);
SELECT ok('Owner can''t invite a 6th admin', as_user('biz@t.test', format($$SELECT org_invite_member(%L,'newadm@t.test','admin')$$, :B1)) LIKE 'ERROR%admin limit reached%');
SELECT ok('Owner can still invite members (user limit 50)', as_user('biz@t.test', format($$SELECT org_invite_member(%L,'newmem@t.test','member')$$, :B1))='OK');
SELECT ok('Demote b2, then an admin invitation reserves the free admin seat',
  try(format($$UPDATE organization_members SET role='member' WHERE organization_id=%L AND user_id=%L$$, :B1, uid('b2@t.test')))='OK'
  AND as_user('biz@t.test', format($$SELECT org_invite_member(%L,'newadm@t.test','admin')$$, :B1))='OK' AND (SELECT admin_used=4 AND admin_pending=1 FROM seats(:B1)));
SELECT ok('While reserved, promoting someone else is refused', try(format($$UPDATE organization_members SET role='admin' WHERE organization_id=%L AND user_id=%L$$, :B1, uid('b2@t.test'))) LIKE 'ERROR%no free admin seats%');
SELECT ok('The invited admin joins using the reservation', add(:B1,'newadm@t.test','admin')='OK' AND (SELECT admin_used=5 AND admin_pending=0 FROM seats(:B1)));
SELECT ok('Nobody was removed: every Business admin and member is still active', (SELECT count(*) FROM organization_members WHERE organization_id IN (:B1,:B2) AND is_active)=9);

-- Support customers never count
INSERT INTO support_customers(organization_id,email,invited_by,user_id) VALUES (:S,'cust@t.test',uid('solo@t.test'),mk('cust@t.test'));
SELECT ok('A support customer of the Solo company uses no seat', (SELECT used FROM seats(:S))=1);

-- Seat summary for the app
SELECT ok('Owner sees users and admins in org_seat_summary', as_user('biz@t.test', format($$SELECT 1/(CASE WHEN (SELECT admin_limit FROM org_seat_summary(%L))=5 THEN 1 ELSE 0 END)$$, :B1))='OK');
SELECT ok('A plain member can''t see seats', as_user('b2@t.test', format($$SELECT * FROM org_seat_summary(%L)$$, :B1)) LIKE 'ERROR%only company owners and admins%');

-- Precheck (read-only) flags the over-limit pool
CREATE TEMP TABLE pc AS
WITH pools AS (SELECT DISTINCT ON (b.billing_user_id) b.billing_user_id, b.organization_id AS any_org FROM organization_billing b ORDER BY b.billing_user_id, b.organization_id)
SELECT s.seat_limit IS NOT NULL AND s.used + s.pending > s.seat_limit AS over_users FROM pools p CROSS JOIN LATERAL _seat_pool(p.any_org) s;
SELECT ok('Precheck logic finds exactly the over-limit pool', (SELECT count(*) FILTER (WHERE over_users) FROM pc)=1);
\o /dev/null
\i precheck.sql
\o
SELECT ok('precheck.sql runs (read-only)', true);

-- Rollback: refused while caps are on; then caps off + rollback = the live baseline again
\set ON_ERROR_STOP 0
\i rollback.sql
\set ON_ERROR_STOP 1
SELECT ok('Rollback refuses while caps are on (nothing undone)', _seat_caps_enabled() AND to_regclass('public.platform_plan_prices') IS NOT NULL);
\i enable-caps-rollback.sql
\i rollback.sql
SELECT ok('After rollback the five functions match the live definitions, ACLs and search_path exactly',
  (SELECT count(*) FROM snap s JOIN pg_proc p ON p.proname=s.name JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
     WHERE md5(pg_get_functiondef(p.oid))=s.def AND p.proacl::text IS NOT DISTINCT FROM s.acl AND p.proconfig::text IS NOT DISTINCT FROM s.cfg)=5);
SELECT ok('After rollback: no new table, helpers, plan rows or admin_limit column',
  to_regclass('public.platform_plan_prices') IS NULL AND to_regprocedure('public._seat_pool_admins(uuid)') IS NULL AND to_regprocedure('public._seat_plan(uuid)') IS NULL
  AND NOT EXISTS (SELECT 1 FROM platform_plans) AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_plans')=(SELECT count(*) FROM snap_cols));
SELECT ok('Rollback removed nobody: memberships unchanged', (SELECT count(*) FROM organization_members WHERE organization_id IN (:B1,:B2) AND is_active)=9);
SET check_function_bodies = on;
\i proposal.sql
SELECT ok('Proposal applies again cleanly after rollback', to_regclass('public.platform_plan_prices') IS NOT NULL AND NOT _seat_caps_enabled());

SELECT (CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END) || '|' || name || CASE WHEN ok THEN '' ELSE ' :: ' || coalesce(detail,'') END FROM r ORDER BY n;
SELECT 'TOTAL|' || count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM r;
