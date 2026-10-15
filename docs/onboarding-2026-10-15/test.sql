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
REVOKE SELECT (token) ON public.organization_invitations FROM anon, authenticated;
CREATE TABLE public.platform_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key text UNIQUE, member_limit int, is_active bool DEFAULT true);
CREATE TABLE public.subscribers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, email text, subscribed bool DEFAULT false, plan_key text);
-- Extra labelled sample accounts: OW owner of O1; W, AD, Q new colleagues (verified); Z unverified colleague.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('88888888-0000-4000-8000-000000000012','ow@o1.test',now()),('aaaaaaaa-0000-4000-8000-000000000013','w@new.test',now()),
 ('bbbbbbbb-0000-4000-8000-000000000014','ad@new.test',now()),('cccccccc-0000-4000-8000-000000000015','q@new.test',now()),
 ('dddddddd-0000-4000-8000-000000000016','z@new.test',NULL);
INSERT INTO organization_members(organization_id,user_id,role) VALUES ('00000000-0000-0000-0000-0000000000a1','88888888-0000-4000-8000-000000000012','owner');

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
INSERT INTO subscribers(user_id,email,subscribed,plan_key) VALUES ('88888888-0000-4000-8000-000000000012','ow@o1.test',true,'team');
SELECT t('Seat summary for owner: 6 used, 2 pending, limit 7','ow@o1.test',$$SELECT 1 FROM org_seat_summary('00000000-0000-0000-0000-0000000000a1') WHERE used=6 AND pending=2 AND seat_limit=7$$,'ROWS=1');
SELECT t('Plain member cannot read seats','s@o1.test',$$SELECT org_seat_summary('00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
SELECT t('Invite refused when seats + pending reach the limit','ow@o1.test',$$SELECT org_invite_member('00000000-0000-0000-0000-0000000000a1','extra@x.test','member')$$,'ERROR:seat limit');
SELECT t('AD accepts (7th seat)','ad@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='ad'))$$,'ROWS=1');
SELECT t('Q refused: no free seats','q@new.test',$$SELECT org_accept_invitation((SELECT v FROM ids WHERE k='q'))$$,'ERROR:no free seats');
SELECT ok('Q did not become a member', NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id='cccccccc-0000-4000-8000-000000000015'));
SELECT ok('Plans and subscriptions untouched by the RPCs', (SELECT member_limit FROM platform_plans)=7 AND (SELECT count(*) FROM subscribers)=1);
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

-- EXPORT, ROLLBACK, FAILED APPLY
\o /tmp/onbrun/export.json
\i docs/onboarding-2026-10-15/export.sql
\o
\set ON_ERROR_STOP 1
\i docs/onboarding-2026-10-15/rollback.sql
\set ON_ERROR_STOP 0
SELECT ok('Rollback removed new tables; joined members kept; tickets kept',
  to_regclass('public.onboarding_email_outbox') IS NULL AND to_regclass('public.support_ticket_feedback') IS NULL
  AND EXISTS (SELECT 1 FROM organization_members WHERE user_id='aaaaaaaa-0000-4000-8000-000000000013') AND (SELECT count(*) FROM support_tickets)=1);
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
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' passed, ' || count(*) FILTER (WHERE NOT ok) || ' failed' FROM results;
