-- Throwaway-database test for proposal.sql (r2) + export.sql + rollback.sql.
-- Run ONLY against a disposable local cluster (see run-test.sh).
-- todos/projects/crm_contacts policies and the membership helpers below are copied
-- VERBATIM from live (read 2026-10-14), including helper argument order (org_id, check_user_id).
\set ON_ERROR_STOP 1
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
-- Mimic Supabase default privileges (tables auto-granted to anon) to prove the explicit REVOKE works.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
CREATE FUNCTION public.handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now(); RETURN NEW; END$$;
CREATE TABLE public.organization_members(organization_id uuid, user_id uuid, role text DEFAULT 'member', is_active bool DEFAULT true);
CREATE FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = org_id AND om.user_id = check_user_id AND om.is_active = true); $$;
CREATE FUNCTION public.is_super_admin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.projects(id uuid PRIMARY KEY, user_id uuid NOT NULL, organization_id uuid);
CREATE TABLE public.project_members(project_id uuid, user_id uuid);
CREATE TABLE public.crm_contacts(id uuid PRIMARY KEY, user_id uuid NOT NULL, name text);
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own contacts" ON public.crm_contacts FOR ALL USING (auth.uid()=user_id);
CREATE TABLE public.todos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL,
  description text, status text NOT NULL DEFAULT 'todo', priority text NOT NULL DEFAULT 'medium', due_date date,
  assigned_to uuid, reporter_id uuid, project_id uuid, organization_id uuid);
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY todos_org_select ON public.todos FOR SELECT USING (((organization_id IS NOT NULL) AND user_is_organization_member(organization_id, auth.uid())) OR ((organization_id IS NULL) AND (user_id = auth.uid())) OR is_super_admin(auth.uid()));
CREATE POLICY todos_org_insert ON public.todos FOR INSERT WITH CHECK ((user_id = auth.uid()) AND ((organization_id IS NULL) OR user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY todos_org_update ON public.todos FOR UPDATE USING (((organization_id IS NOT NULL) AND user_is_organization_member(organization_id, auth.uid())) OR ((organization_id IS NULL) AND (user_id = auth.uid()))) WITH CHECK ((organization_id IS NULL) OR user_is_organization_member(organization_id, auth.uid()));

-- A, B, C. Company O1 = {A, B}; company O2 = {C}. Project P1 in O1 owned by B with B as only project member.
INSERT INTO organization_members(organization_id,user_id) VALUES
 ('00000000-0000-0000-0000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000001'),
 ('00000000-0000-0000-0000-0000000000a1','bbbbbbbb-0000-4000-8000-000000000001'),
 ('00000000-0000-0000-0000-0000000000a2','cccccccc-0000-4000-8000-000000000001');
INSERT INTO projects VALUES ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a1');
INSERT INTO project_members VALUES ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-4000-8000-000000000001');
INSERT INTO crm_contacts VALUES
 ('c0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','A contact'),
 ('c0000000-0000-0000-0000-00000000000b','bbbbbbbb-0000-4000-8000-000000000001','B contact');
INSERT INTO todos(id,user_id,organization_id,project_id,title) VALUES
 ('d0000000-0000-0000-0000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001',NULL,NULL,'A personal'),
 ('d0000000-0000-0000-0000-0000000000a1','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a1',NULL,'O1 task by B'),
 ('d0000000-0000-0000-0000-0000000000a2','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a1','11111111-0000-0000-0000-000000000001','O1 project-P1 task (A not a project member)'),
 ('d0000000-0000-0000-0000-0000000000c2','cccccccc-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a2',NULL,'O2 task by C'),
 ('d0000000-0000-0000-0000-00000000000b','bbbbbbbb-0000-4000-8000-000000000001',NULL,NULL,'B personal'),
 ('d0000000-0000-0000-0000-0000000000a3','bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-0000-0000-0000000000a1',NULL,'O1 task 2 (for revoke test)');

\i docs/marketing-workspace-2026-10-10/proposal.sql
\set ON_ERROR_STOP 0

CREATE TABLE results(n serial, name text, ok bool, detail text);
GRANT ALL ON results, results_n_seq TO anon, authenticated;
CREATE FUNCTION chk(name text, who text, stmt text, expect text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r text; c bigint; BEGIN
  PERFORM set_config('request.jwt.claims', CASE who WHEN 'anon' THEN '{}'
    WHEN 'A' THEN '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}'
    WHEN 'B' THEN '{"sub":"bbbbbbbb-0000-4000-8000-000000000001"}'
    ELSE '{"sub":"cccccccc-0000-4000-8000-000000000001"}' END, true);
  EXECUTE format('SET LOCAL ROLE %I', CASE who WHEN 'anon' THEN 'anon' ELSE 'authenticated' END);
  BEGIN EXECUTE stmt; GET DIAGNOSTICS c = ROW_COUNT; r := 'ROWS=' || c;
  EXCEPTION WHEN others THEN r := 'ERROR ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO results(name, ok, detail) VALUES (name, CASE WHEN expect='ERROR' THEN r LIKE 'ERROR%' ELSE r = expect END, r);
END $$;

-- Task-link rule (the gap under review)
SELECT chk('Link own personal task: allowed','A',$$INSERT INTO marketing_content_items(id,title,todo_id) VALUES ('ec000000-0000-0000-0000-000000000001','P','d0000000-0000-0000-0000-00000000000a')$$,'ROWS=1');
SELECT chk('Link company task (A active member of O1): allowed','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('O','d0000000-0000-0000-0000-0000000000a1')$$,'ROWS=1');
SELECT chk('Project task in same company, A not project member: same as live task rule (visible) -> allowed','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('R','d0000000-0000-0000-0000-0000000000a2')$$,'ROWS=1');
SELECT chk('  ...and live task rule itself shows A that task (parity)','A',$$SELECT 1 FROM todos WHERE id='d0000000-0000-0000-0000-0000000000a2'$$,'ROWS=1');
SELECT chk('Link another company''s task (O2): rejected','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('x','d0000000-0000-0000-0000-0000000000c2')$$,'ERROR');
SELECT chk('Link another user''s personal task: rejected','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('x','d0000000-0000-0000-0000-00000000000b')$$,'ERROR');
SELECT chk('C links O1 task via UPDATE: rejected','C',$$WITH i AS (INSERT INTO marketing_content_items(id,title) VALUES ('ec000000-0000-0000-0000-0000000000c1','c') RETURNING id) SELECT 1$$,'ROWS=1');
SELECT chk('  ...update to O1 task rejected','C',$$UPDATE marketing_content_items SET todo_id='d0000000-0000-0000-0000-0000000000a3'$$,'ERROR');
SELECT chk('Same task linked twice: rejected','A',$$INSERT INTO marketing_content_items(title,todo_id) VALUES ('dup','d0000000-0000-0000-0000-00000000000a')$$,'ERROR');
-- Revocation after linking
SELECT chk('Pre-revoke: A links O1 task 2','A',$$INSERT INTO marketing_content_items(id,title,todo_id) VALUES ('ec000000-0000-0000-0000-0000000000r1','Rv','d0000000-0000-0000-0000-0000000000a3')$$,'ROWS=1');
UPDATE organization_members SET is_active=false WHERE user_id='aaaaaaaa-0000-4000-8000-000000000001';
SELECT chk('After revoke: linked task no longer displayed (task read returns 0)','A',$$SELECT 1 FROM todos WHERE id IN ('d0000000-0000-0000-0000-0000000000a1','d0000000-0000-0000-0000-0000000000a2','d0000000-0000-0000-0000-0000000000a3')$$,'ROWS=0');
SELECT chk('After revoke: own planned-content row still readable (title only, no task details)','A',$$SELECT 1 FROM marketing_content_items WHERE id='ec000000-0000-0000-0000-0000000000r1'$$,'ROWS=1');
SELECT chk('After revoke: re-linking a company task rejected','A',$$UPDATE marketing_content_items SET todo_id=NULL WHERE id='ec000000-0000-0000-0000-0000000000r1'$$,'ROWS=1');
SELECT chk('  ...relink attempt','A',$$UPDATE marketing_content_items SET todo_id='d0000000-0000-0000-0000-0000000000a3' WHERE id='ec000000-0000-0000-0000-0000000000r1'$$,'ERROR');
SELECT chk('After revoke: create follow-up task in O1 refused','A',$$SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000r1','00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
UPDATE organization_members SET is_active=true WHERE user_id='aaaaaaaa-0000-4000-8000-000000000001';
-- Create task: idempotent on retry
SELECT chk('Create task first call','A',$$SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000r1','00000000-0000-0000-0000-0000000000a1')$$,'ROWS=1');
SELECT chk('Create task retry (same item)','A',$$SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000r1','00000000-0000-0000-0000-0000000000a1')$$,'ROWS=1');
INSERT INTO results(name, ok, detail) SELECT 'Retry created exactly 1 task', count(*)=1, count(*)::text FROM todos WHERE title='Content: Rv';
SELECT chk('B cannot create task for A''s item','B',$$SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000r1','00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
-- Anonymous: explicit revoke beats default grants
SELECT chk('Anon read audiences refused','anon',$$SELECT * FROM marketing_audiences$$,'ERROR');
SELECT chk('Anon read campaigns refused','anon',$$SELECT * FROM marketing_campaigns$$,'ERROR');
SELECT chk('Anon read content refused','anon',$$SELECT * FROM marketing_content_items$$,'ERROR');
SELECT chk('Anon create-task function refused','anon',$$SELECT marketing_create_followup_task('ec000000-0000-0000-0000-0000000000r1','00000000-0000-0000-0000-0000000000a1')$$,'ERROR');
INSERT INTO results(name, ok, detail) SELECT 'anon has zero table privileges on the 3 tables', count(*)=0, count(*)::text
  FROM information_schema.role_table_grants WHERE grantee='anon' AND table_name LIKE 'marketing_%';
-- Export then rollback
CREATE TEMP TABLE ex AS SELECT marketing_export FROM (
  SELECT json_build_object('audiences',(SELECT coalesce(json_agg(a),'[]') FROM marketing_audiences a),
    'campaigns',(SELECT coalesce(json_agg(c),'[]') FROM marketing_campaigns c),
    'content_items',(SELECT coalesce(json_agg(i),'[]') FROM marketing_content_items i)) marketing_export) s;
\i docs/marketing-workspace-2026-10-10/export.sql
INSERT INTO results(name, ok, detail) SELECT 'Export contains all content rows', json_array_length(marketing_export->'content_items')=(SELECT count(*) FROM marketing_content_items), json_array_length(marketing_export->'content_items')::text FROM ex;
\i docs/marketing-workspace-2026-10-10/rollback.sql
INSERT INTO results(name, ok, detail) SELECT 'Rollback removes tables + both functions, keeps contacts/tasks',
  (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'marketing_%')=0
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE 'marketing_%')
  AND (SELECT count(*) FROM crm_contacts)=2 AND (SELECT count(*) FROM todos)=7, 'checked';
-- Atomicity: proposal with an injected failure just before COMMIT
\i /tmp/mktrun/proposal_fail.sql
ROLLBACK;
INSERT INTO results(name, ok, detail) SELECT 'Failed application leaves no tables/functions/policies',
  (SELECT count(*) FROM pg_tables WHERE tablename LIKE 'marketing_%')=0
  AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname LIKE 'marketing_%')
  AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename LIKE 'marketing_%'), 'checked';
SELECT n, CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END verdict, name, detail FROM results ORDER BY n;
