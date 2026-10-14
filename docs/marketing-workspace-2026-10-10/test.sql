-- Throwaway-database test for proposal.sql + rollback.sql.
-- Run ONLY against a disposable local cluster (see run-test.sh). Uses minimal
-- stand-ins for existing tables/functions with the same columns and rules.
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE FUNCTION public.handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now(); RETURN NEW; END$$;
CREATE TABLE public.organization_members(organization_id uuid, user_id uuid, is_active bool DEFAULT true);
CREATE FUNCTION public.user_is_organization_member(o uuid, u uuid) RETURNS bool LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT EXISTS(SELECT 1 FROM organization_members WHERE organization_id=o AND user_id=u AND is_active) $$;
CREATE TABLE public.crm_contacts(id uuid PRIMARY KEY, user_id uuid NOT NULL, name text);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own ON public.crm_contacts FOR ALL USING (auth.uid()=user_id);
CREATE TABLE public.todos(id uuid PRIMARY KEY, user_id uuid NOT NULL, organization_id uuid, title text);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crm_contacts, public.todos TO authenticated;

-- A = aaaa…, B = bbbb…; org O1 has A only.
INSERT INTO organization_members VALUES ('00000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000001');
INSERT INTO crm_contacts VALUES
 ('c0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','A contact'),
 ('c0000000-0000-0000-0000-00000000000b','bbbbbbbb-0000-4000-8000-000000000001','B contact');
INSERT INTO todos VALUES
 ('d0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001',NULL,'A personal'),
 ('d0000000-0000-0000-0000-0000000000a1','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a1','O1 task by B'),
 ('d0000000-0000-0000-0000-00000000000b','bbbbbbbb-0000-4000-8000-000000000001',NULL,'B personal');

\i docs/marketing-workspace-2026-10-10/proposal.sql
\set ON_ERROR_STOP 0

CREATE TABLE results(n serial, name text, ok bool, detail text);
GRANT ALL ON results, results_n_seq TO anon, authenticated;
CREATE FUNCTION chk(name text, who text, stmt text, expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text; c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE who WHEN 'anon' THEN '{}' WHEN 'A' THEN '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}' ELSE '{"sub":"bbbbbbbb-0000-4000-8000-000000000001"}' END, true);
  EXECUTE format('SET LOCAL ROLE %I', CASE who WHEN 'anon' THEN 'anon' ELSE 'authenticated' END);
  BEGIN EXECUTE stmt; GET DIAGNOSTICS c = ROW_COUNT; r := 'ROWS=' || c;
  EXCEPTION WHEN others THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO results(name, ok, detail) VALUES (name, CASE WHEN expect='ERROR' THEN r LIKE 'ERROR%' ELSE r = expect END, r);
END $$;

SELECT chk('A creates audience','A',$$INSERT INTO marketing_audiences(id,name,filter) VALUES ('a1000000-0000-0000-0000-000000000001','Leads','{"status":"lead"}')$$,'ROWS=1');
SELECT chk('A creates campaign with own contact (duplicates collapsed)','A',$$INSERT INTO marketing_campaigns(id,name,audience_id,contact_ids) VALUES ('ca000000-0000-0000-0000-000000000001','Q4','a1000000-0000-0000-0000-000000000001','{c0000000-0000-0000-0000-00000000000a,c0000000-0000-0000-0000-00000000000a}')$$,'ROWS=1');
SELECT chk('A campaign with B''s contact rejected','A',$$INSERT INTO marketing_campaigns(name,contact_ids) VALUES ('x','{c0000000-0000-0000-0000-00000000000b}')$$,'ERROR');
SELECT chk('A campaign with unknown contact rejected','A',$$INSERT INTO marketing_campaigns(name,contact_ids) VALUES ('x','{c0000000-0000-0000-0000-0000000000ff}')$$,'ERROR');
SELECT chk('A adds B''s contact by update rejected','A',$$UPDATE marketing_campaigns SET contact_ids = contact_ids || 'c0000000-0000-0000-0000-00000000000b'::uuid$$,'ERROR');
SELECT chk('A content + own personal task','A',$$INSERT INTO marketing_content_items(id,title,campaign_id,todo_id) VALUES ('ec000000-0000-0000-0000-000000000001','Post','ca000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a')$$,'ROWS=1');
SELECT chk('A content + company task (A is member)','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('Org','d0000000-0000-0000-0000-0000000000a1')$$,'ROWS=1');
SELECT chk('A content + B''s personal task rejected','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('x','d0000000-0000-0000-0000-00000000000b')$$,'ERROR');
SELECT chk('B content + task of company B is not in rejected','B',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('x','d0000000-0000-0000-0000-0000000000a1')$$,'ERROR');
SELECT chk('Same task linked twice rejected (retry protection)','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('dup','d0000000-0000-0000-0000-00000000000a')$$,'ERROR');
SELECT chk('B content referencing A''s campaign rejected','B',$$INSERT INTO marketing_content_items(title,campaign_id) VALUES ('x','ca000000-0000-0000-0000-000000000001')$$,'ERROR');
SELECT chk('B campaign referencing A''s audience rejected','B',$$INSERT INTO marketing_campaigns(name,audience_id) VALUES ('x','a1000000-0000-0000-0000-000000000001')$$,'ERROR');
SELECT chk('B inserting a row owned by A rejected','B',$$INSERT INTO marketing_audiences(name,user_id) VALUES ('x','aaaaaaaa-0000-4000-8000-000000000001')$$,'ERROR');
SELECT chk('A cannot hand ownership to B','A',$$UPDATE marketing_audiences SET user_id='bbbbbbbb-0000-4000-8000-000000000001'$$,'ERROR');
SELECT chk('B reads A''s audiences: 0','B',$$SELECT * FROM marketing_audiences$$,'ROWS=0');
SELECT chk('B reads A''s campaigns: 0','B',$$SELECT * FROM marketing_campaigns$$,'ROWS=0');
SELECT chk('B reads A''s content: 0','B',$$SELECT * FROM marketing_content_items$$,'ROWS=0');
SELECT chk('B updates A''s campaign: 0','B',$$UPDATE marketing_campaigns SET name='hacked'$$,'ROWS=0');
SELECT chk('B deletes A''s audience: 0','B',$$DELETE FROM marketing_audiences$$,'ROWS=0');
SELECT chk('Anonymous read refused','anon',$$SELECT * FROM marketing_campaigns$$,'ERROR');
SELECT chk('Anonymous insert refused','anon',$$INSERT INTO marketing_audiences(name) VALUES ('x')$$,'ERROR');
SELECT chk('A archives campaign','A',$$UPDATE marketing_campaigns SET archived_at=now() WHERE id='ca000000-0000-0000-0000-000000000001'$$,'ROWS=1');
SELECT chk('A restores campaign','A',$$UPDATE marketing_campaigns SET archived_at=NULL, status='completed' WHERE id='ca000000-0000-0000-0000-000000000001'$$,'ROWS=1');
SELECT chk('Invalid status rejected','A',$$UPDATE marketing_campaigns SET status='sent'$$,'ERROR');
SELECT chk('End before start rejected','A',$$UPDATE marketing_campaigns SET start_date='2026-11-02', end_date='2026-11-01'$$,'ERROR');
SELECT chk('Blank name rejected','A',$$INSERT INTO marketing_audiences(name) VALUES ('   ')$$,'ERROR');
-- deleted references
DELETE FROM crm_contacts WHERE id='c0000000-0000-0000-0000-00000000000a';
DELETE FROM todos WHERE id='d0000000-0000-0000-0000-00000000000a';
SELECT chk('Deleted contact: campaign still editable','A',$$UPDATE marketing_campaigns SET name='Q4 v2'$$,'ROWS=1');
SELECT chk('Deleted task: link cleared, row kept','A',$$SELECT 1 FROM marketing_content_items WHERE id='ec000000-0000-0000-0000-000000000001' AND todo_id IS NULL$$,'ROWS=1');
SELECT chk('Persistence: A still sees 1 audience, 1 campaign, 2 content','A',$$SELECT 1 FROM marketing_audiences UNION ALL SELECT 1 FROM marketing_campaigns UNION ALL SELECT 1 FROM marketing_content_items$$,'ROWS=4');

\i docs/marketing-workspace-2026-10-10/rollback.sql
INSERT INTO results(name, ok, detail) SELECT 'Rollback removes the 3 tables + guard, keeps contacts/tasks',
  (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'marketing_%')=0
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='marketing_guard')
  AND (SELECT count(*) FROM crm_contacts)=1 AND (SELECT count(*) FROM todos)=2, 'checked';
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
