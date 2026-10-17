-- Throwaway-database test for onboarding proposal.sql + export.sql + rollback.sql (run-test.sh only, never production).
-- Prelude = support ticketing harness fixture (live-mirrored helpers, users, companies) + the applied support proposal.
\i /tmp/onbrun/prelude.sql
-- Live shapes read 2026-10-15: organization_invitations (+ policy, token column hidden), platform_plans, subscribers (subset).
CREATE FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = org_id AND om.user_id = check_user_id AND om.role = 'owner' AND om.is_active = true); $$;
CREATE TABLE public.organization_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['admin','manager','member'])), invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days', accepted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Organization admins can manage invitations" ON public.organization_invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_members.organization_id = organization_invitations.organization_id
    AND organization_members.user_id = auth.uid() AND organization_members.role = ANY (ARRAY['owner','admin']) AND organization_members.is_active = true));
REVOKE ALL ON public.organization_invitations FROM anon, authenticated; -- live: no grants to anon/authenticated
CREATE TABLE public.platform_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE, member_limit int, is_active bool DEFAULT true);
CREATE TABLE public.subscribers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text, subscribed bool DEFAULT false, plan_key text);
-- Extra labelled sample accounts: OW owner of O1; W, AD, Q new colleagues (verified); Z unverified colleague.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('88888888-0000-4000-8000-000000000012','ow@o1.test',now()),('aaaaaaaa-0000-4000-8000-000000000013','w@new.test',now()),
 ('bbbbbbbb-0000-4000-8000-000000000014','ad@new.test',now()),('cccccccc-0000-4000-8000-000000000015','q@new.test',now()),
 ('dddddddd-0000-4000-8000-000000000016','z@new.test',NULL);
INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','88888888-0000-4000-8000-000000000012','owner');

-- An email already sitting in the ticket queue before the package (live had 1 such acknowledgement on 2026-10-16).
INSERT INTO support_settings(organization_id,support_name) VALUES ('00000000-0000-0000-0000-0000000000a2','O2 Support');
INSERT INTO support_tickets(id,organization_id,reference,subject,description,requester_id,client_request_id) VALUES
 ('f0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','T-00001','Old','Old','99999999-0000-4000-8000-00000000000c',gen_random_uuid());
INSERT INTO support_email_outbox(id,organization_id,ticket_id,kind,recipient_user_id,dedupe_key) VALUES
 ('a0ff58dd-c038-49ca-a212-e58bed67923e','00000000-0000-0000-0000-0000000000a2','f0000000-0000-0000-0000-000000000001','acknowledgement','99999999-0000-4000-8000-00000000000c','ack:old'),
 (gen_random_uuid(),'00000000-0000-0000-0000-0000000000a2','f0000000-0000-0000-0000-000000000001','acknowledgement','99999999-0000-4000-8000-00000000000c','ack:other');
-- Live shape: companies record their creator. O1 created by its owner OW (gets a billing owner); O2 created by X who is only
-- an admin (like the 4 live ownerless companies: no billing owner). SA = platform super admin.
UPDATE organizations SET created_by='88888888-0000-4000-8000-000000000012' WHERE id='00000000-0000-0000-0000-0000000000a1';
UPDATE organizations SET created_by='99999999-0000-4000-8000-00000000000c' WHERE id='00000000-0000-0000-0000-0000000000a2';
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ('eeeeeeee-0000-4000-8000-000000000017','sa@b2bnest.test',now()),
 ('f1111111-0000-4000-8000-000000000018','p1@new.test',now()),('f2222222-0000-4000-8000-000000000019','p2@new.test',now()),
 ('f3333333-0000-4000-8000-00000000001a','c5@o5.test',now());
CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _user_id = 'eeeeeeee-0000-4000-8000-000000000017'::uuid $$;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

\i docs/onboarding-2026-10-15/proposal.sql
\set ON_ERROR_STOP 0
CREATE TABLE results(n serial, name text, ok bool, detail text); GRANT ALL ON results, results_n_seq TO anon, authenticated, service_role;
CREATE TABLE ids(k text PRIMARY KEY, v text); GRANT ALL ON ids TO anon, authenticated, service_role;
CREATE FUNCTION t(name text, who text, stmt text, expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text; c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE WHEN who='anon' THEN '{}' ELSE
    json_build_object('sub',(SELECT id FROM auth.users WHERE email=who),'email',who)::text END, true);
  EXECUTE format('SET LOCAL ROLE %I', CASE who WHEN 'anon' THEN 'anon' ELSE 'authenticated' END);
  BEGIN EXECUTE stmt; GET DIAGNOSTICS c = ROW_COUNT; r := 'ROWS=' || c; EXCEPTION WHEN others THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO results(name, ok, detail) VALUES (name, CASE WHEN expect='ERROR' THEN r LIKE 'ERROR%' WHEN expect LIKE 'ERROR:%' THEN r LIKE '%'||substr(expect,7)||'%' ELSE r = expect END, r);
END $$;
CREATE FUNCTION cnt(who text, q text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',(SELECT id FROM auth.users WHERE email=who))::text, true);
  SET LOCAL ROLE authenticated; EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; RESET ROLE; RETURN c; END $$;
CREATE FUNCTION ok(name text, cond bool, detail text DEFAULT '') RETURNS void LANGUAGE sql AS $$ INSERT INTO results(name,ok,detail) VALUES (name,cond,detail) $$;
\set O1 '''00000000-0000-0000-0000-0000000000a1'''

-- STAFF: who may invite, which roles
SELECT t('Signed-out visitor cannot invite','anon',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','member')$$,'ERROR');
SELECT t('Plain member cannot invite','s@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','member')$$,'ERROR');
SELECT t('Admin cannot invite an admin (no peer escalation)','m@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','admin')$$,'ERROR');
SELECT t('Nobody can invite an owner','ow@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','owner')$$,'ERROR');
SELECT t('Other company admin cannot invite into O1','x@o2.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','member')$$,'ERROR');
SELECT t('Admin invites W as member','m@o1.test',$$INSERT INTO ids SELECT 'w', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','w@new.test','member') WHERE outcome='created'$$,'ROWS=1');
SELECT t('Repeat invite (different case) returns the existing one','m@o1.test',$$SELECT 1 FROM org_invite_member('00000000-0000-0000-0000-0000000000a1',' W@New.test ','member') WHERE outcome='already_pending'$$,'ROWS=1');
SELECT ok('Exactly one invitation for W', (SELECT count(*) FROM organization_invitations WHERE email='w@new.test')=1);
SELECT t('Inviting an existing member says already_member','m@o1.test',$$SELECT 1 FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','g@o1.test','member') WHERE outcome='already_member'$$,'ROWS=1');
SELECT ok('One staff invitation email queued (not sent)', (SELECT count(*) FROM onboarding_email_outbox WHERE kind='staff_invitation')=1);
SELECT t('Token column cannot be read directly','m@o1.test',$$SELECT token FROM organization_invitations$$,'ERROR');
SELECT ok('Admin sees the invitation; plain member and other company see none',
  cnt('m@o1.test','SELECT id FROM organization_invitations')=1 AND cnt('s@o1.test','SELECT id FROM organization_invitations')=0 AND cnt('x@o2.test','SELECT id FROM organization_invitations')=0);
SELECT t('Admin cannot insert invitations directly (API)','m@o1.test',$$INSERT INTO organization_invitations(organization_id,email,role,invited_by,token) VALUES ('00000000-0000-0000-0000-0000000000a1','h@x.test','admin',auth.uid(),'abc')$$,'ERROR');
SELECT t('Admin cannot edit invitations directly (API)','m@o1.test',$$UPDATE organization_invitations SET role='admin'$$,'ERROR');
SELECT t('Queue is server-only','m@o1.test',$$SELECT 1 FROM onboarding_email_outbox$$,'ERROR');
SELECT t('Signed-in users cannot run the sender claim','m@o1.test',$$SELECT onboarding_outbox_claim(5)$$,'ERROR');

-- STAFF: acceptance
SELECT t('Different verified account cannot accept W''s invitation','v@client.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='w'))$$,'ERROR:different email');
SELECT t('Preview shows company and match for W','w@new.test',$$SELECT 1 FROM org_invitation_preview((SELECT v FROM ids WHERE k='w')) WHERE company='O1' AND state='pending' AND email_matches$$,'ROWS=1');
SELECT t('Admin invites Z (unverified)','m@o1.test',$$INSERT INTO ids SELECT 'z', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','z@new.test','member')$$,'ROWS=1');
SELECT t('Unverified account cannot accept','z@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='z'))$$,'ERROR:verify your email');
SELECT t('W accepts with matching verified email','w@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='w'))$$,'ROWS=1');
SELECT ok('W is an active member with role member', EXISTS (SELECT 1 FROM organization_members WHERE user_id='aaaaaaaa-0000-4000-8000-000000000013' AND role='member' AND is_active));
SELECT t('W accepting again is harmless','w@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='w'))$$,'ROWS=1');
SELECT ok('Still one membership for W', (SELECT count(*) FROM organization_members WHERE user_id='aaaaaaaa-0000-4000-8000-000000000013')=1);
SELECT ok('W''s queued email cancelled after acceptance', (SELECT status FROM onboarding_email_outbox o JOIN organization_invitations i ON i.id=o.invitation_id WHERE i.email='w@new.test')='cancelled');
SELECT t('Used invitation cannot be reused by another account','v@client.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='w'))$$,'ERROR');

-- Revoke, expiry, extend
SELECT t('Admin invites V','m@o1.test',$$INSERT INTO ids SELECT 'v1', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','v@client.test','manager')$$,'ROWS=1');
SELECT t('Admin revokes V''s invitation','m@o1.test',$$SELECT org_manage_invitation((SELECT id FROM organization_invitations WHERE email='v@client.test'),'revoke')$$,'ROWS=1');
SELECT t('Revoked invitation cannot be accepted','v@client.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='v1'))$$,'ERROR');
SELECT ok('Revoked invitation email cancelled', (SELECT status FROM onboarding_email_outbox o JOIN organization_invitations i ON i.id=o.invitation_id WHERE i.email='v@client.test')='cancelled');
SELECT t('Re-invite after revoke creates a fresh invitation','m@o1.test',$$INSERT INTO ids SELECT 'v2', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','v@client.test','manager') WHERE outcome='created'$$,'ROWS=1');
UPDATE organization_invitations SET expires_at=now()-interval '1 minute' WHERE token=(SELECT v FROM ids WHERE k='v2');
SELECT t('Expired invitation cannot be accepted','v@client.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='v2'))$$,'ERROR:no longer valid');
SELECT t('Admin extends it','m@o1.test',$$SELECT org_manage_invitation((SELECT id FROM organization_invitations WHERE revoked_at IS NULL AND accepted_at IS NULL AND email='v@client.test'),'extend')$$,'ROWS=1');
SELECT t('V accepts after extension','v@client.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='v2'))$$,'ROWS=1');

-- Admin-role invitations belong to owners only
SELECT t('Owner invites AD as admin','ow@o1.test',$$INSERT INTO ids SELECT 'ad', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','ad@new.test','admin')$$,'ROWS=1');
SELECT t('Admin cannot copy an admin invitation link','m@o1.test',$$SELECT org_invitation_token((SELECT id FROM organization_invitations WHERE email='ad@new.test'))$$,'ERROR');
SELECT t('Admin cannot revoke an admin invitation','m@o1.test',$$SELECT org_manage_invitation((SELECT id FROM organization_invitations WHERE email='ad@new.test'),'revoke')$$,'ERROR');
SELECT t('Owner can copy it','ow@o1.test',$$SELECT org_invitation_token((SELECT id FROM organization_invitations WHERE email='ad@new.test'))$$,'ROWS=1');

-- Seats (server-side; plan values set only in this throwaway database)
SELECT t('Owner invites Q','ow@o1.test',$$INSERT INTO ids SELECT 'q', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a1','q@new.test','member')$$,'ROWS=1');
UPDATE organization_invitations SET revoked_at=now() WHERE email='z@new.test';
INSERT INTO platform_plans(key,member_limit) VALUES ('team',7);
CREATE OR REPLACE FUNCTION public._seat_caps_enabled() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$; -- throwaway DB only: exercise caps
INSERT INTO subscribers(user_id,email,subscribed,plan_key) VALUES ('88888888-0000-4000-8000-000000000012','ow@o1.test',true,'team');
SELECT t('Seat summary for owner: 6 used, 2 pending, limit 7','ow@o1.test',$$SELECT 1 FROM org_seat_summary('00000000-0000-0000-0000-0000000000a1') WHERE used=6 AND pending=2 AND seat_limit=7$$,'ROWS=1');
SELECT t('Plain member cannot read seats','s@o1.test',$$SELECT org_seat_summary('00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
SELECT t('Invite refused when seats + pending reach the limit','ow@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','extra@x.test','member')$$,'ERROR:seat limit');
SELECT t('AD accepts (7th seat)','ad@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='ad'))$$,'ROWS=1');
SELECT t('Q refused: no free seats','q@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='q'))$$,'ERROR:no free seats');
SELECT ok('Q did not become a member', NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id='cccccccc-0000-4000-8000-000000000015'));
SELECT ok('Plans and subscriptions untouched by the RPCs', (SELECT member_limit FROM platform_plans)=7 AND (SELECT count(*) FROM subscribers)=1);
-- Revision 3: one allowance per paying owner across its companies (O3 is a second company billed by OW)
INSERT INTO organizations(id,name,created_by) VALUES ('00000000-0000-0000-0000-0000000000a3','O3','88888888-0000-4000-8000-000000000012');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 ('00000000-0000-0000-0000-0000000000a3','88888888-0000-4000-8000-000000000012','owner'),
 ('00000000-0000-0000-0000-0000000000a3','22222222-0000-4000-8000-00000000000a','member'); -- G works for O1 and O3
SELECT t('Pool summary from O3: same 7 staff (G once), 1 pending, limit 7, 2 companies','ow@o1.test',$$SELECT 1 FROM org_seat_summary('00000000-0000-0000-0000-0000000000a3') WHERE used=7 AND pending=1 AND seat_limit=7 AND pooled_companies=2 AND basis='subscription:team'$$,'ROWS=1');
SELECT t('Full pool: a brand-new person cannot be invited into O3','ow@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a3','n@new.test','member')$$,'ERROR:seat limit');
SELECT t('Full pool: S (already counted via O1) can still be invited into O3','ow@o1.test',$$INSERT INTO ids SELECT 's3', token FROM org_invite_member('00000000-0000-0000-0000-0000000000a3','s@o1.test','member') WHERE outcome='created'$$,'ROWS=1');
SELECT t('Full pool: Q (already reserved in O1) can still be invited into O3','ow@o1.test',$$SELECT 1 FROM org_invite_member('00000000-0000-0000-0000-0000000000a3','q@new.test','member') WHERE outcome='created'$$,'ROWS=1');
SELECT t('Q invited in two pooled companies still reserves one seat','ow@o1.test',$$SELECT 1 FROM org_seat_summary('00000000-0000-0000-0000-0000000000a1') WHERE used=7 AND pending=1$$,'ROWS=1');
SELECT t('S accepts O3 at a full pool (already holds a seat)','s@o1.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='s3'))$$,'ROWS=1');
SELECT ok('S is in O3 and still counted once', EXISTS (SELECT 1 FROM organization_members WHERE organization_id='00000000-0000-0000-0000-0000000000a3' AND user_id='33333333-0000-4000-8000-00000000000b')
  AND (SELECT used FROM _seat_pool('00000000-0000-0000-0000-0000000000a1'))=7);
INSERT INTO support_customers(organization_id,email,invited_by) VALUES ('00000000-0000-0000-0000-0000000000a3','c3@client.test','88888888-0000-4000-8000-000000000012');
SELECT ok('Support customers never use seats', (SELECT used + pending FROM _seat_pool('00000000-0000-0000-0000-0000000000a3'))=8);
UPDATE support_customers SET revoked_at=now() WHERE email='c3@client.test'; -- sample only; keeps the later sender checks unchanged
SELECT t('O2 has no billing owner: reported as such','x@o2.test',$$SELECT 1 FROM org_seat_summary('00000000-0000-0000-0000-0000000000a2') WHERE basis='no_billing_owner' AND NOT enforced AND pooled_companies=1$$,'ROWS=1');
SELECT ok('Another owner''s company is not in OW''s pool', (SELECT pooled_companies FROM _seat_pool('00000000-0000-0000-0000-0000000000a2'))=1
  AND '00000000-0000-0000-0000-0000000000a2' NOT IN (SELECT _seat_pool_orgs('00000000-0000-0000-0000-0000000000a1')));
SELECT t('Q''s second invitation revoked (keeps later sender checks unchanged)','ow@o1.test',$$SELECT org_manage_invitation((SELECT id FROM organization_invitations WHERE organization_id='00000000-0000-0000-0000-0000000000a3' AND email='q@new.test'),'revoke')$$,'ROWS=1');
UPDATE subscribers SET subscribed=false;
INSERT INTO platform_plans(key,member_limit) VALUES ('free',1);
SELECT ok('Unsubscribed owner falls back to the Free plan limit', (SELECT basis='free' AND seat_limit=1 FROM _seat_pool('00000000-0000-0000-0000-0000000000a1')));
SELECT t('Over the limit: nobody is removed, new invitations are refused','ow@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','n2@new.test','member')$$,'ERROR:seat limit');
SELECT ok('Over-limit members all still active', (SELECT used FROM _seat_pool('00000000-0000-0000-0000-0000000000a1'))=7);
-- Revision 4: re-activation bypass closed for every route while full (Free limit 1, 7 staff)
UPDATE organization_members SET is_active=false WHERE user_id='77777777-0000-4000-8000-000000000011' AND organization_id='00000000-0000-0000-0000-0000000000a1'; -- V leaves
SELECT t('Admin cannot re-activate V through the API when there is no free seat','m@o1.test',$$UPDATE organization_members SET is_active=true WHERE user_id='77777777-0000-4000-8000-000000000011'$$,'ERROR:no free seats');
DO $$ BEGIN
  BEGIN UPDATE organization_members SET is_active=true WHERE user_id='77777777-0000-4000-8000-000000000011';
        INSERT INTO results(name,ok,detail) VALUES ('Server-side re-activation (no auth) is blocked too', false, 'was allowed');
  EXCEPTION WHEN others THEN INSERT INTO results(name,ok,detail) VALUES ('Server-side re-activation (no auth) is blocked too', SQLERRM LIKE '%no free seats%', SQLERRM); END;
  BEGIN INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','cccccccc-0000-4000-8000-000000000015','member');
        INSERT INTO results(name,ok,detail) VALUES ('Server-side direct add (no invitation) is blocked when full', false, 'was allowed');
  EXCEPTION WHEN others THEN INSERT INTO results(name,ok,detail) VALUES ('Server-side direct add (no invitation) is blocked when full', SQLERRM LIKE '%no free seats%', SQLERRM); END;
END $$;
UPDATE organization_members SET role='manager' WHERE user_id='22222222-0000-4000-8000-00000000000a' AND organization_id='00000000-0000-0000-0000-0000000000a1';
SELECT ok('Role change of an active member still works while full', (SELECT role FROM organization_members WHERE user_id='22222222-0000-4000-8000-00000000000a' AND organization_id='00000000-0000-0000-0000-0000000000a1')='manager');
DELETE FROM platform_plans WHERE key='free';
SELECT ok('No plan limit stored: no cap', (SELECT seat_limit IS NULL AND basis='no_plan:no_limit_configured' FROM _seat_pool('00000000-0000-0000-0000-0000000000a1')));
-- Revision 4: explicit billing owner, ownerless companies, authorised repair, ownership changes, company creation
SELECT ok('Billing owner seeded only where the creator is the active owner', (SELECT billing_user_id='88888888-0000-4000-8000-000000000012' AND source='seeded_creator_owner' FROM organization_billing WHERE organization_id='00000000-0000-0000-0000-0000000000a1')
  AND NOT EXISTS (SELECT 1 FROM organization_billing WHERE organization_id='00000000-0000-0000-0000-0000000000a2'));
SELECT t('Billing owner table cannot be written through the API','ow@o1.test',$$UPDATE organization_billing SET billing_user_id=auth.uid()$$,'ERROR');
SELECT t('Ownerless O2: its admin cannot invite','x@o2.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a2','n3@new.test','member')$$,'ERROR:no billing owner');
DO $$ BEGIN
  BEGIN INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a2','cccccccc-0000-4000-8000-000000000015','member');
        INSERT INTO results(name,ok,detail) VALUES ('Ownerless O2: server-side add blocked (missing owner is not unlimited)', false, 'was allowed');
  EXCEPTION WHEN others THEN INSERT INTO results(name,ok,detail) VALUES ('Ownerless O2: server-side add blocked (missing owner is not unlimited)', SQLERRM LIKE '%no billing owner%', SQLERRM); END;
END $$;
SELECT ok('Ownerless O2: existing admin keeps access', EXISTS (SELECT 1 FROM organization_members WHERE organization_id='00000000-0000-0000-0000-0000000000a2' AND user_id='99999999-0000-4000-8000-00000000000c' AND is_active));
SELECT t('Only a platform super admin can set a billing owner','m@o1.test',$$SELECT platform_set_billing_owner('00000000-0000-0000-0000-0000000000a2','99999999-0000-4000-8000-00000000000c','repair')$$,'ERROR:super admins only');
SELECT t('Repair needs a reason','sa@b2bnest.test',$$SELECT platform_set_billing_owner('00000000-0000-0000-0000-0000000000a2','99999999-0000-4000-8000-00000000000c','')$$,'ERROR:reason');
SELECT t('Repair target must be an active member','sa@b2bnest.test',$$SELECT platform_set_billing_owner('00000000-0000-0000-0000-0000000000a2','11111111-0000-4000-8000-00000000000d','repair')$$,'ERROR:active member');
SELECT t('Super admin repairs O2 (billing owner = X), recorded','sa@b2bnest.test',$$SELECT platform_set_billing_owner('00000000-0000-0000-0000-0000000000a2','99999999-0000-4000-8000-00000000000c','owner confirmed by email ticket 1')$$,'ROWS=1');
SELECT ok('Repair recorded with who/why', (SELECT source='platform_admin' AND set_by='eeeeeeee-0000-4000-8000-000000000017' AND note LIKE 'owner confirmed%' FROM organization_billing WHERE organization_id='00000000-0000-0000-0000-0000000000a2'));
SELECT t('After repair O2''s admin can invite','x@o2.test',$$SELECT 1 FROM org_invite_member('00000000-0000-0000-0000-0000000000a2','n3@new.test','member') WHERE outcome='created'$$,'ROWS=1');
SELECT t('(sample invitation revoked; keeps later sender checks unchanged)','x@o2.test',$$SELECT org_manage_invitation((SELECT id FROM organization_invitations WHERE email='n3@new.test'),'revoke')$$,'ROWS=1');
UPDATE organization_members SET role='admin' WHERE organization_id='00000000-0000-0000-0000-0000000000a1' AND user_id='88888888-0000-4000-8000-000000000012';
UPDATE organization_members SET role='owner' WHERE organization_id='00000000-0000-0000-0000-0000000000a1' AND user_id='11111111-0000-4000-8000-00000000000d';
SELECT ok('Ownership transfer does not switch the billing owner or the pool', (SELECT billing_user_id FROM organization_billing WHERE organization_id='00000000-0000-0000-0000-0000000000a1')='88888888-0000-4000-8000-000000000012'
  AND (SELECT pooled_companies FROM _seat_pool('00000000-0000-0000-0000-0000000000a1'))=2);
UPDATE organization_members SET role='admin' WHERE organization_id='00000000-0000-0000-0000-0000000000a1' AND user_id='11111111-0000-4000-8000-00000000000d';
UPDATE organization_members SET role='owner' WHERE organization_id='00000000-0000-0000-0000-0000000000a1' AND user_id='88888888-0000-4000-8000-000000000012';
INSERT INTO organizations(id,name,created_by) VALUES ('00000000-0000-0000-0000-0000000000a5','O5 personal','f3333333-0000-4000-8000-00000000001a');
INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a5','f3333333-0000-4000-8000-00000000001a','admin'); -- like sign-up
SELECT ok('New company: its creator as first member becomes the billing owner (sign-up path, even as admin)',
  (SELECT billing_user_id='f3333333-0000-4000-8000-00000000001a' AND source='company_created' FROM organization_billing WHERE organization_id='00000000-0000-0000-0000-0000000000a5'));
DO $$ BEGIN
  BEGIN INSERT INTO organizations(id,name,created_by) VALUES ('00000000-0000-0000-0000-0000000000a6','O6','f3333333-0000-4000-8000-00000000001a');
        INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a6','f1111111-0000-4000-8000-000000000018','owner');
        INSERT INTO results(name,ok,detail) VALUES ('A non-creator cannot claim a new company''s billing by joining first', false, 'was allowed');
  EXCEPTION WHEN others THEN INSERT INTO results(name,ok,detail) VALUES ('A non-creator cannot claim a new company''s billing by joining first', SQLERRM LIKE '%no billing owner%', SQLERRM); END;
END $$;
SELECT t('Seat helpers are not callable by signed-in users','ow@o1.test',$$SELECT * FROM _seat_pool('00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
CREATE OR REPLACE FUNCTION public._seat_caps_enabled() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$; -- back to the shipped state
DELETE FROM subscribers; -- back to "no limit configured" for the rest

-- CUSTOMERS stay separate
SELECT t('Admin sets up support','m@o1.test',$$INSERT INTO support_settings(organization_id,support_name,portal_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1','Acme Support',true)$$,'ROWS=1');
SELECT t('Admin invites customer K','m@o1.test',$$INSERT INTO support_customers(organization_id,email,invited_by) VALUES ('00000000-0000-0000-0000-0000000000a1','k@client.test',auth.uid())$$,'ROWS=1');
SELECT ok('Customer invitation email queued (not sent)', (SELECT count(*) FROM onboarding_email_outbox WHERE kind='customer_invitation' AND recipient_email='k@client.test')=1);
SELECT t('K claims portal access','k@client.test',$$SELECT support_claim_invitations()$$,'ROWS=1');
SELECT ok('Customer K is not a company member and uses no seat', NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id='44444444-0000-4000-8000-00000000000e'));
SELECT t('Customer email cannot be invited as staff','m@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','k@client.test','member')$$,'ERROR:support customer');
INSERT INTO organization_invitations(organization_id,email,role,invited_by,token) VALUES ('00000000-0000-0000-0000-0000000000a1','k@client.test','member','11111111-0000-4000-8000-00000000000d','tok-k');
SELECT t('Active customer cannot accept a staff invitation','k@client.test',$$SELECT org_accept_invitation('tok-k')$$,'ERROR:support customer');
DELETE FROM organization_invitations WHERE token='tok-k';
SET ROLE service_role;
SELECT ok('Sender claim cancels K''s invitation email (already signed up) and sends nothing for revoked/accepted',
  NOT EXISTS (SELECT 1 FROM onboarding_outbox_claim(50) c WHERE c.recipient_email IN ('k@client.test','w@new.test','z@new.test')));
RESET ROLE;
SELECT ok('Only Q''s pending staff invitation was handed to the sender', (SELECT count(*) FROM onboarding_email_outbox WHERE status='sending')=1
  AND (SELECT recipient_email FROM onboarding_email_outbox WHERE status='sending')='q@new.test');

-- AGENTS: accepted colleague becomes selectable
SELECT t('Admin appoints new member W as support agent','m@o1.test',$$INSERT INTO support_agents VALUES ('00000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000013',auth.uid())$$,'ROWS=1');
SELECT t('Customer K still cannot be an agent','m@o1.test',$$INSERT INTO support_agents VALUES ('00000000-0000-0000-0000-0000000000a1','44444444-0000-4000-8000-00000000000e',auth.uid())$$,'ERROR');

-- NOTIFICATIONS
SELECT t('K creates a ticket','k@client.test',$$INSERT INTO ids SELECT 'tk', support_create_ticket('00000000-0000-0000-0000-0000000000a1','Printer','Offline',NULL,'low','e0000000-0000-0000-0000-000000000001')::text$$,'ROWS=1');
SELECT t('Agent W sets Waiting for customer','w@new.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk')::uuid,'waiting_customer',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT ok('Customer notified in-app of the status change', (SELECT count(*) FROM notifications WHERE user_id='44444444-0000-4000-8000-00000000000e' AND title LIKE 'Status update%')=1);
SELECT ok('One status email queued for the customer', (SELECT count(*) FROM support_email_outbox WHERE kind='status_change' AND recipient_user_id='44444444-0000-4000-8000-00000000000e')=1);
SET ROLE service_role;
SELECT ok('Status email carries no message text, only the status',
  (SELECT bool_and(reply_body IS NULL AND ticket_status='waiting_customer') FROM support_outbox_claim(50) WHERE kind='status_change'));
RESET ROLE;
SELECT t('Other company admin cannot set prefs for O1','x@o2.test',$$INSERT INTO support_notification_prefs(organization_id,user_id,email_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1',auth.uid(),false)$$,'ERROR');
SELECT t('K cannot set prefs for someone else','k@client.test',$$INSERT INTO support_notification_prefs(organization_id,user_id,email_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1','22222222-0000-4000-8000-00000000000a',false)$$,'ERROR');
SELECT t('K turns support email off for O1','k@client.test',$$INSERT INTO support_notification_prefs(organization_id,user_id,email_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1',auth.uid(),false)$$,'ROWS=1');
SELECT t('Agent W sets Open','w@new.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk')::uuid,'open',NULL,NULL,NULL,false)$$,'ROWS=1');
SET ROLE service_role; SELECT count(*) FROM support_outbox_claim(50); RESET ROLE;
SELECT ok('Opted-out customer''s status email cancelled, in-app still delivered',
  (SELECT status FROM support_email_outbox WHERE kind='status_change' ORDER BY created_at DESC LIMIT 1)='cancelled'
  AND (SELECT count(*) FROM notifications WHERE user_id='44444444-0000-4000-8000-00000000000e' AND title LIKE 'Status update%')=2);

-- FEEDBACK
SELECT t('Feedback refused while switched off','k@client.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,5,'Great')$$,'ERROR:not switched on');
SELECT t('Admin switches feedback on','m@o1.test',$$UPDATE support_settings SET feedback_enabled=true WHERE organization_id='00000000-0000-0000-0000-0000000000a1'$$,'ROWS=1');
SELECT t('Feedback refused before closure','k@client.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,5,'Great')$$,'ERROR:closed');
SELECT t('Agent closes ticket','w@new.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk')::uuid,'closed',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT t('Rating 6 refused','k@client.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,6,NULL)$$,'ERROR');
SELECT t('Agent cannot submit feedback for the customer','w@new.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,1,NULL)$$,'ERROR');
SELECT t('K submits 5 with a comment','k@client.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,5,'Fixed fast')$$,'ROWS=1');
SELECT t('Second submission refused','k@client.test',$$SELECT support_submit_feedback((SELECT v FROM ids WHERE k='tk')::uuid,1,NULL)$$,'ERROR:already');
SELECT t('K can check it was submitted','k@client.test',$$SELECT 1 WHERE support_feedback_submitted((SELECT v FROM ids WHERE k='tk')::uuid)$$,'ROWS=1');
SELECT ok('Staff read feedback; customer, plain member and other company cannot',
  cnt('w@new.test','SELECT 1 FROM support_ticket_feedback')=1 AND cnt('m@o1.test','SELECT 1 FROM support_ticket_feedback')=1
  AND cnt('k@client.test','SELECT 1 FROM support_ticket_feedback')=0 AND cnt('s@o1.test','SELECT 1 FROM support_ticket_feedback')=0
  AND cnt('x@o2.test','SELECT 1 FROM support_ticket_feedback')=0);
SELECT t('Feedback cannot be inserted directly (API)','k@client.test',$$INSERT INTO support_ticket_feedback VALUES ((SELECT v FROM ids WHERE k='tk')::uuid,'00000000-0000-0000-0000-0000000000a1',1,NULL,auth.uid())$$,'ERROR');

-- Revision 2: direct member inserts, historical queue, staff notifications, no duplicate notices
SELECT ok('Only the known stale email (by id) is cancelled; any other queued email is left untouched',
  (SELECT status FROM support_email_outbox WHERE dedupe_key='ack:old')='cancelled' AND (SELECT status FROM support_email_outbox WHERE dedupe_key='ack:other')<>'cancelled');
SELECT t('Admin cannot add a member directly (API)','m@o1.test',$$INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','cccccccc-0000-4000-8000-000000000015','member')$$,'ERROR');
SELECT t('Owner cannot add a member directly (API)','ow@o1.test',$$INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','cccccccc-0000-4000-8000-000000000015','member')$$,'ERROR');
CREATE FUNCTION nc(who text, pat text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM notifications n JOIN auth.users u ON u.id=n.user_id WHERE u.email=who AND n.title LIKE pat $$;
SELECT t('K creates ticket 2 (unassigned)','k@client.test',$$INSERT INTO ids SELECT 'tk2', support_create_ticket('00000000-0000-0000-0000-0000000000a1','Router','Down',NULL,'low','e0000000-0000-0000-0000-000000000002')::text$$,'ROWS=1');
SELECT t('K replies on unassigned ticket 2','k@client.test',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk2')::uuid,'Any news?',false,'e0000000-0000-0000-0000-000000000003')$$,'ROWS=1');
SELECT ok('Unassigned customer reply notifies agent, admin and owner once each; not the customer',
  nc('w@new.test','Customer replied on%')=1 AND nc('m@o1.test','Customer replied on%')=1 AND nc('ow@o1.test','Customer replied on%')=1
  AND nc('k@client.test','Customer replied on%')=0 AND nc('s@o1.test','Customer replied on%')=0);
SELECT ok('Plain member and other company get no ticket notices', nc('s@o1.test','%T-%')=0 AND nc('x@o2.test','%T-%')=0);
SELECT t('Agent W adds a private note','w@new.test',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk2')::uuid,'internal only',true,'e0000000-0000-0000-0000-000000000004')$$,'ROWS=1');
SELECT ok('Private note notifies nobody and queues no email', (SELECT count(*) FROM notifications WHERE message='internal only' OR title LIKE '%internal%')=0
  AND NOT EXISTS (SELECT 1 FROM support_email_outbox o JOIN support_messages m ON m.id=o.message_id WHERE m.is_internal));
SELECT ok('(before first staff reply) ticket 2 is New', (SELECT status FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk2')::uuid)='new');
SELECT t('Agent W replies publicly (New -> Open)','w@new.test',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk2')::uuid,'Looking now',false,'e0000000-0000-0000-0000-000000000005')$$,'ROWS=1');
SELECT ok('First staff reply: customer gets one reply notice and no extra status notice',
  nc('k@client.test','Reply on%')=1 AND (SELECT count(*) FROM support_email_outbox WHERE kind='status_change' AND ticket_id=(SELECT v FROM ids WHERE k='tk2')::uuid)=0
  AND (SELECT count(*) FROM support_email_outbox WHERE kind='public_reply' AND ticket_id=(SELECT v FROM ids WHERE k='tk2')::uuid)=1);
SELECT t('Agent W resolves ticket 2','w@new.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk2')::uuid,'resolved',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT t('K replies on the resolved ticket (reopens it)','k@client.test',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk2')::uuid,'Still broken',false,'e0000000-0000-0000-0000-000000000006')$$,'ROWS=1');
SELECT ok('Reply-reopen: staff get one "replied" notice, no separate "reopened" notice',
  nc('w@new.test','Customer replied on%')=2 AND nc('w@new.test','Customer reopened%')=0
  AND (SELECT status FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk2')::uuid)='open');
SELECT t('Agent W closes ticket 2','w@new.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk2')::uuid,'closed',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT t('K reopens closed ticket 2','k@client.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk2')::uuid,'open',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT ok('Customer reopen notifies agent, admin and owner; customer gets no notice of own change',
  nc('w@new.test','Customer reopened%')=1 AND nc('m@o1.test','Customer reopened%')=1 AND nc('ow@o1.test','Customer reopened%')=1
  AND nc('k@client.test','Status update on T-00002')=2); -- resolve + close by staff; none for the customer's own reopen
SELECT t('Admin assigns ticket 2 to W','m@o1.test',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk2')::uuid,NULL,NULL,NULL,'aaaaaaaa-0000-4000-8000-000000000013',true)$$,'ROWS=1');
SELECT t('K replies on the assigned ticket','k@client.test',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk2')::uuid,'Thanks',false,'e0000000-0000-0000-0000-000000000007')$$,'ROWS=1');
SELECT ok('Assigned ticket: only the assignee hears about the customer reply',
  nc('w@new.test','Customer replied on%')=3 AND nc('m@o1.test','Customer replied on%')=2 AND nc('ow@o1.test','Customer replied on%')=2);

-- EXPORT, ROLLBACK, FAILED APPLY
\o /tmp/onbrun/export.json
\i docs/onboarding-2026-10-15/export.sql
\o
\set ON_ERROR_STOP 1
\i docs/onboarding-2026-10-15/rollback.sql
\set ON_ERROR_STOP 0
SELECT ok('Rollback removed new tables; joined members kept; tickets kept',
  to_regclass('public.onboarding_email_outbox') IS NULL AND to_regclass('public.support_ticket_feedback') IS NULL
  AND EXISTS (SELECT 1 FROM organization_members WHERE user_id='aaaaaaaa-0000-4000-8000-000000000013') AND (SELECT count(*) FROM support_tickets)=3);
SELECT ok('Rollback restores the previous member INSERT grant and removes the new triggers',
  has_table_privilege('authenticated','public.organization_members','INSERT')
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname IN ('support_messages_notify_staff','support_tickets_status_notify')));
-- Rolled-back invitations lose their revoked/accepted dates; clear the sample ones so re-apply tests the package itself.
-- (Live: re-apply refuses atomically while two live invitations share an email; resolve them first.)
DELETE FROM organization_invitations;
\i /tmp/onbrun/proposal_fail.sql
ROLLBACK;
SELECT ok('Failed apply leaves nothing behind', to_regclass('public.onboarding_email_outbox') IS NULL
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_invitations' AND column_name='revoked_at'));
\set ON_ERROR_STOP 1
\i docs/onboarding-2026-10-15/proposal.sql
\set ON_ERROR_STOP 0
SELECT ok('Package re-applies cleanly after rollback', to_regclass('public.onboarding_email_outbox') IS NOT NULL);
SELECT ok('Re-apply closes direct member INSERT again', NOT has_table_privilege('authenticated','public.organization_members','INSERT'));
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM results;
