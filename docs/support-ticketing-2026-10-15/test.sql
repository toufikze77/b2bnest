-- Throwaway-database test for proposal.sql + export.sql + rollback.sql. Disposable cluster only (run-test.sh).
-- Membership helpers copied VERBATIM from live (read 2026-10-15), argument order (org_id, check_user_id).
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
GRANT USAGE ON SCHEMA auth, public, storage TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated; -- mimic Supabase defaults
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT ALL ON storage.objects TO anon, authenticated;
CREATE TABLE public.organizations(id uuid PRIMARY KEY, name text);
CREATE TABLE public.organization_members(organization_id uuid, user_id uuid, role text DEFAULT 'member', is_active bool DEFAULT true);
CREATE TABLE public.notifications(id uuid DEFAULT gen_random_uuid(), user_id uuid, title text, message text, type text, read bool, created_at timestamptz DEFAULT now());
CREATE TABLE public.crm_contacts(id uuid PRIMARY KEY, user_id uuid, name text);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON public.crm_contacts FOR ALL USING (auth.uid()=user_id);
CREATE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = org_id AND om.user_id = check_user_id AND om.is_active = true); $$;
CREATE FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = org_id AND om.user_id = check_user_id
    AND om.role IN ('owner', 'admin') AND om.is_active = true); $$;
-- O1 provides support: M = admin, G = agent member, S = plain member (no support permission). O2 = other company, X admin.
-- K = external customer of O1, L = second customer of O1.
INSERT INTO organizations VALUES ('00000000-0000-0000-0000-0000000000a1','O1'),('00000000-0000-0000-0000-0000000000a2','O2');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
 ('00000000-0000-0000-0000-0000000000a1','11111111-0000-4000-8000-00000000000d','admin'),
 ('00000000-0000-0000-0000-0000000000a1','22222222-0000-4000-8000-00000000000a','member'),
 ('00000000-0000-0000-0000-0000000000a1','33333333-0000-4000-8000-00000000000b','member'),
 ('00000000-0000-0000-0000-0000000000a2','99999999-0000-4000-8000-00000000000c','admin');
INSERT INTO crm_contacts VALUES ('c0000000-0000-0000-0000-000000000001','11111111-0000-4000-8000-00000000000d','M private contact');

\i docs/support-ticketing-2026-10-15/proposal.sql
\set ON_ERROR_STOP 0
CREATE TABLE results(n serial, name text, ok bool, detail text);
GRANT ALL ON results, results_n_seq TO anon, authenticated;
CREATE TABLE ids(k text PRIMARY KEY, v uuid); GRANT ALL ON ids TO anon, authenticated;
CREATE FUNCTION chk(name text, who text, stmt text, expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text; c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE who WHEN 'anon' THEN '{}'
    WHEN 'M' THEN '{"sub":"11111111-0000-4000-8000-00000000000d","email":"m@o1.test"}'
    WHEN 'G' THEN '{"sub":"22222222-0000-4000-8000-00000000000a","email":"g@o1.test"}'
    WHEN 'S' THEN '{"sub":"33333333-0000-4000-8000-00000000000b","email":"s@o1.test"}'
    WHEN 'X' THEN '{"sub":"99999999-0000-4000-8000-00000000000c","email":"x@o2.test"}'
    WHEN 'K' THEN '{"sub":"44444444-0000-4000-8000-00000000000e","email":"k@client.test"}'
    WHEN 'L' THEN '{"sub":"55555555-0000-4000-8000-00000000000f","email":"l@client.test"}' END, true);
  EXECUTE format('SET LOCAL ROLE %I', CASE who WHEN 'anon' THEN 'anon' ELSE 'authenticated' END);
  BEGIN EXECUTE stmt; GET DIAGNOSTICS c = ROW_COUNT; r := 'ROWS=' || c;
  EXCEPTION WHEN others THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO results(name, ok, detail) VALUES (name, CASE WHEN expect='ERROR' THEN r LIKE 'ERROR%' ELSE r = expect END, r);
END $$;
CREATE FUNCTION cnt(who text, q text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE who WHEN 'K' THEN '{"sub":"44444444-0000-4000-8000-00000000000e"}'
    WHEN 'L' THEN '{"sub":"55555555-0000-4000-8000-00000000000f"}' WHEN 'G' THEN '{"sub":"22222222-0000-4000-8000-00000000000a"}'
    WHEN 'S' THEN '{"sub":"33333333-0000-4000-8000-00000000000b"}' WHEN 'X' THEN '{"sub":"99999999-0000-4000-8000-00000000000c"}'
    ELSE '{"sub":"11111111-0000-4000-8000-00000000000d"}' END, true);
  SET LOCAL ROLE authenticated; EXECUTE 'SELECT count(*) FROM (' || q || ') s' INTO c; RESET ROLE; RETURN c; END $$;

-- Setup by manager
SELECT chk('Plain member cannot set up support','S',$$INSERT INTO support_settings(organization_id,support_name) VALUES ('00000000-0000-0000-0000-0000000000a1','x')$$,'ERROR');
SELECT chk('Admin sets up support (no hours)','M',$$INSERT INTO support_settings(organization_id,support_name,portal_enabled) VALUES ('00000000-0000-0000-0000-0000000000a1','Acme Support',true)$$,'ROWS=1');
SELECT chk('Admin cannot rewrite ticket counter','M',$$UPDATE support_settings SET next_ticket_number=500$$,'ERROR');
SELECT chk('Admin adds category','M',$$INSERT INTO support_categories(id,organization_id,name) VALUES ('ca000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Email')$$,'ROWS=1');
SELECT chk('Admin adds agent G (company member)','M',$$INSERT INTO support_agents VALUES ('00000000-0000-0000-0000-0000000000a1','22222222-0000-4000-8000-00000000000a','11111111-0000-4000-8000-00000000000d')$$,'ROWS=1');
SELECT chk('Admin cannot make a non-member (customer K) an agent','M',$$INSERT INTO support_agents VALUES ('00000000-0000-0000-0000-0000000000a1','44444444-0000-4000-8000-00000000000e','11111111-0000-4000-8000-00000000000d')$$,'ERROR');
SELECT chk('Admin invites customer K','M',$$INSERT INTO support_customers(organization_id,email,invited_by) VALUES ('00000000-0000-0000-0000-0000000000a1','k@client.test','11111111-0000-4000-8000-00000000000d')$$,'ROWS=1');
SELECT chk('Admin invites customer L','M',$$INSERT INTO support_customers(organization_id,email,invited_by) VALUES ('00000000-0000-0000-0000-0000000000a1','l@client.test','11111111-0000-4000-8000-00000000000d')$$,'ROWS=1');
SELECT chk('Customer K claims own invitation','K',$$SELECT support_claim_invitations()$$,'ROWS=1');
SELECT chk('Customer L claims own invitation','L',$$SELECT support_claim_invitations()$$,'ROWS=1');
SELECT chk('Customer cannot promote self to agent','K',$$INSERT INTO support_agents VALUES ('00000000-0000-0000-0000-0000000000a1','44444444-0000-4000-8000-00000000000e','44444444-0000-4000-8000-00000000000e')$$,'ERROR');
SELECT chk('Customer cannot invite others','K',$$INSERT INTO support_customers(organization_id,email,invited_by) VALUES ('00000000-0000-0000-0000-0000000000a1','z@z.test','44444444-0000-4000-8000-00000000000e')$$,'ERROR');
SELECT chk('Customer cannot edit own customer record','K',$$UPDATE support_customers SET revoked_at=NULL WHERE user_id=auth.uid()$$,'ROWS=0');
SELECT chk('Admin cannot re-point a customer to another account','M',$$UPDATE support_customers SET user_id='22222222-0000-4000-8000-00000000000a' WHERE email='k@client.test'$$,'ERROR');
-- Tickets
SELECT chk('K creates ticket','K',$$INSERT INTO ids SELECT 'tk', support_create_ticket('00000000-0000-0000-0000-0000000000a1','Printer offline','It stopped','ca000000-0000-0000-0000-000000000001','high','e0000000-0000-0000-0000-000000000001')$$,'ROWS=1');
SELECT chk('K retries same request (double click)','K',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','Printer offline','It stopped',NULL,'high','e0000000-0000-0000-0000-000000000001')$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Retry made exactly 1 ticket, reference T-00001', count(*)=1 AND min(reference)='T-00001', count(*)||' '||min(reference) FROM support_tickets;
INSERT INTO results(name,ok,detail) SELECT 'One acknowledgement queued (not sent)', count(*)=1, count(*)::text FROM support_email_outbox WHERE kind='acknowledgement';
INSERT INTO results(name,ok,detail) SELECT 'Admin + agent notified in-app', count(*)=2, count(*)::text FROM notifications WHERE type='support';
SELECT chk('L creates own ticket','L',$$INSERT INTO ids SELECT 'tl', support_create_ticket('00000000-0000-0000-0000-0000000000a1','VPN','Cannot connect',NULL,'low','e0000000-0000-0000-0000-000000000002')$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Second reference T-00002', reference='T-00002', reference FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tl');
INSERT INTO results(name,ok,detail) SELECT 'K sees only own ticket', cnt('K','SELECT 1 FROM support_tickets')=1, cnt('K','SELECT 1 FROM support_tickets')::text;
INSERT INTO results(name,ok,detail) SELECT 'Agent G sees both', cnt('G','SELECT 1 FROM support_tickets')=2, '';
INSERT INTO results(name,ok,detail) SELECT 'Plain member S (no support permission) sees none', cnt('S','SELECT 1 FROM support_tickets')=0, '';
INSERT INTO results(name,ok,detail) SELECT 'Other company admin X sees none', cnt('X','SELECT 1 FROM support_tickets')=0, '';
INSERT INTO results(name,ok,detail) SELECT 'Customer K sees no CRM contacts', cnt('K','SELECT 1 FROM crm_contacts')=0, '';
SELECT chk('K cannot insert ticket directly (API)','K',$$INSERT INTO support_tickets(organization_id,reference,subject,description,requester_id,client_request_id) VALUES ('00000000-0000-0000-0000-0000000000a1','T-9','x','y',auth.uid(),gen_random_uuid())$$,'ERROR');
SELECT chk('K cannot update ticket directly (API)','K',$$UPDATE support_tickets SET status='closed'$$,'ERROR');
SELECT chk('X cannot create ticket in O1','X',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','x','y',NULL,'low',gen_random_uuid())$$,'ERROR');
SELECT chk('S (member, no permission) cannot create ticket in O1','S',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','x','y',NULL,'low',gen_random_uuid())$$,'ERROR');
SELECT chk('Ticket in company without support set up refused','X',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a2','x','y',NULL,'low',gen_random_uuid())$$,'ERROR');
-- Messages, private notes
SELECT chk('Agent private note','G',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'Internal: check toner','true','f0000000-0000-0000-0000-000000000001')$$,'ROWS=1');
SELECT chk('Agent public reply','G',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'We are on it','false','f0000000-0000-0000-0000-000000000002')$$,'ROWS=1');
SELECT chk('Agent public reply retried','G',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'We are on it','false','f0000000-0000-0000-0000-000000000002')$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Retry stored one reply and queued one reply email', (SELECT count(*) FROM support_messages WHERE NOT is_internal)=1 AND (SELECT count(*) FROM support_email_outbox WHERE kind='public_reply')=1, '';
INSERT INTO results(name,ok,detail) SELECT 'No email queued for private note', NOT EXISTS (SELECT 1 FROM support_email_outbox o JOIN support_messages m ON m.id=o.message_id WHERE m.is_internal), '';
INSERT INTO results(name,ok,detail) SELECT 'Customer K sees public reply but NOT private note', cnt('K','SELECT 1 FROM support_messages')=1 AND cnt('K','SELECT 1 FROM support_messages WHERE is_internal')=0, cnt('K','SELECT 1 FROM support_messages')::text;
INSERT INTO results(name,ok,detail) SELECT 'Status moved New -> Open on staff reply', status='open', status FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk');
SELECT chk('K cannot add a private note','K',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'x','true',gen_random_uuid())$$,'ERROR');
SELECT chk('L cannot reply on K''s ticket (guessed ID)','L',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'x','false',gen_random_uuid())$$,'ERROR');
INSERT INTO results(name,ok,detail) SELECT 'L sees no messages of K''s ticket', cnt('L','SELECT 1 FROM support_messages')=0, '';
-- Status changes
SELECT chk('Customer cannot change priority','K',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),NULL,'urgent',NULL,NULL,false)$$,'ERROR');
SELECT chk('Agent sets Waiting for customer','G',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),'waiting_customer',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT chk('Customer reply','K',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'Tried that','false',gen_random_uuid())$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Customer reply moved Waiting -> Open', status='open', status FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk');
SELECT chk('Agent cannot assign to plain member S','G',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),NULL,NULL,NULL,'33333333-0000-4000-8000-00000000000b',true)$$,'ERROR');
SELECT chk('Agent assigns to self/agent G','M',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),NULL,NULL,NULL,'22222222-0000-4000-8000-00000000000a',true)$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Assignment confirmed in database', assignee_id='22222222-0000-4000-8000-00000000000a', '' FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk');
SELECT chk('Agent closes','G',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),'closed',NULL,NULL,NULL,false)$$,'ROWS=1');
SELECT chk('Customer cannot reply on closed ticket','K',$$SELECT support_add_message((SELECT v FROM ids WHERE k='tk'),'x','false',gen_random_uuid())$$,'ERROR');
SELECT chk('Customer reopens own closed ticket','K',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),'open',NULL,NULL,NULL,false)$$,'ROWS=1');
INSERT INTO results(name,ok,detail) SELECT 'Reopen confirmed: open, closed_at cleared', status='open' AND closed_at IS NULL, status FROM support_tickets WHERE id=(SELECT v FROM ids WHERE k='tk');
SELECT chk('L cannot reopen K''s ticket','L',$$SELECT support_update_ticket((SELECT v FROM ids WHERE k='tk'),'open',NULL,NULL,NULL,false)$$,'ERROR');
-- Attachments
SELECT chk('K records public attachment','K',format($$SELECT support_add_attachment('%s',NULL,'00000000-0000-0000-0000-0000000000a1/%s/a-photo.png','photo.png',1000,'image/png',false)$$,(SELECT v FROM ids WHERE k='tk'),(SELECT v FROM ids WHERE k='tk')),'ROWS=1');
SELECT chk('Agent records private-note attachment','G',format($$SELECT support_add_attachment('%s',NULL,'00000000-0000-0000-0000-0000000000a1/%s/b-log.txt','log.txt',10,'text/plain',true)$$,(SELECT v FROM ids WHERE k='tk'),(SELECT v FROM ids WHERE k='tk')),'ROWS=1');
INSERT INTO storage.objects(bucket_id,name) SELECT 'support-attachments', storage_path FROM support_attachments;
INSERT INTO results(name,ok,detail) SELECT 'K can download own public file only (not private-note file)', cnt('K','SELECT 1 FROM storage.objects')=1, cnt('K','SELECT 1 FROM storage.objects')::text;
INSERT INTO results(name,ok,detail) SELECT 'L cannot download K''s files', cnt('L','SELECT 1 FROM storage.objects')=0, '';
INSERT INTO results(name,ok,detail) SELECT 'Agent can download both', cnt('G','SELECT 1 FROM storage.objects')=2, '';
SELECT chk('Oversize file (11 MB) refused','K',format($$SELECT support_add_attachment('%s',NULL,'00000000-0000-0000-0000-0000000000a1/%s/c.pdf','c.pdf',11534336,'application/pdf',false)$$,(SELECT v FROM ids WHERE k='tk'),(SELECT v FROM ids WHERE k='tk')),'ERROR');
SELECT chk('Executable type refused','K',format($$SELECT support_add_attachment('%s',NULL,'00000000-0000-0000-0000-0000000000a1/%s/d.exe','d.exe',10,'application/x-msdownload',false)$$,(SELECT v FROM ids WHERE k='tk'),(SELECT v FROM ids WHERE k='tk')),'ERROR');
SELECT chk('Customer cannot upload into another ticket folder','L',format($$INSERT INTO storage.objects(bucket_id,name) VALUES ('support-attachments','00000000-0000-0000-0000-0000000000a1/%s/x.png')$$,(SELECT v FROM ids WHERE k='tk')),'ERROR');
SELECT chk('Customer can upload into own ticket folder','K',format($$INSERT INTO storage.objects(bucket_id,name) VALUES ('support-attachments','00000000-0000-0000-0000-0000000000a1/%s/e.png')$$,(SELECT v FROM ids WHERE k='tk')),'ROWS=1');
-- Revoked access
UPDATE support_customers SET revoked_at=now() WHERE email='k@client.test';
INSERT INTO results(name,ok,detail) SELECT 'Revoked customer K sees no tickets, messages or files', cnt('K','SELECT 1 FROM support_tickets')+cnt('K','SELECT 1 FROM support_messages')+cnt('K','SELECT 1 FROM storage.objects')=0, '';
SELECT chk('Revoked customer cannot create ticket','K',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','x','y',NULL,'low',gen_random_uuid())$$,'ERROR');
UPDATE organization_members SET is_active=false WHERE user_id='22222222-0000-4000-8000-00000000000a';
INSERT INTO results(name,ok,detail) SELECT 'Agent removed from company sees no tickets', cnt('G','SELECT 1 FROM support_tickets')=0, '';
UPDATE support_settings SET portal_enabled=false;
INSERT INTO results(name,ok,detail) SELECT 'Portal switched off: customer L sees nothing', cnt('L','SELECT 1 FROM support_tickets')=0, '';
-- Anonymous + outbox
SELECT chk('Anon read tickets refused','anon',$$SELECT * FROM support_tickets$$,'ERROR');
SELECT chk('Anon create ticket refused','anon',$$SELECT support_create_ticket('00000000-0000-0000-0000-0000000000a1','x','y',NULL,'low',gen_random_uuid())$$,'ERROR');
SELECT chk('Admin cannot read email outbox (server only)','M',$$SELECT * FROM support_email_outbox$$,'ERROR');
INSERT INTO results(name,ok,detail) SELECT 'anon has zero privileges on support tables', count(*)=0, count(*)::text FROM information_schema.role_table_grants WHERE grantee='anon' AND table_name LIKE 'support_%';
-- Export, rollback
CREATE TEMP TABLE ex AS SELECT json_build_object('tickets',(SELECT json_agg(x) FROM support_tickets x)) j;
\i docs/support-ticketing-2026-10-15/export.sql
INSERT INTO results(name,ok,detail) SELECT 'Export contains both tickets', json_array_length(j->'tickets')=2, '' FROM ex;
\i docs/support-ticketing-2026-10-15/rollback.sql
INSERT INTO results(name,ok,detail) SELECT 'Rollback removes all support objects, keeps companies/members/contacts/notifications',
  (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'support_%')=0 AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE 'support_%')
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname LIKE 'Support files%')
  AND (SELECT count(*) FROM organization_members)=4 AND (SELECT count(*) FROM crm_contacts)=1 AND (SELECT count(*) FROM notifications)>0, '';
\i /tmp/suprun/proposal_fail.sql
ROLLBACK;
INSERT INTO results(name,ok,detail) SELECT 'Failed application leaves nothing behind',
  (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'support_%')=0 AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE 'support_%'), '';
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
