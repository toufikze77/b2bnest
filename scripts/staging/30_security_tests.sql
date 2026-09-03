-- Company A/B tenant-isolation test cases (isolated local staging only).
-- Requires: 10_seed_tenants.sql and 20_security_harness.sql
set client_min_messages = warning;
truncate sec.results restart identity;

-- ============================================================ PHASE 4 / 8.1
-- 30-case matrix from docs/tenant-architecture-review-2026-09.md
-- Cases 1-11: per-resource CRUD (executed against every major tenant resource)

do $$
declare
  r record;
  org_a uuid := '0a000000-0000-4000-8000-000000000001';
  org_b uuid := '0b000000-0000-4000-8000-000000000001';
begin
  -- resource, own-row id (A), foreign-row id (B), insert stmt for own tenant, insert stmt for foreign tenant
  for r in
    select * from (values
      ('crm_contacts','0a000000-0000-4000-8000-0000000000c1','0b000000-0000-4000-8000-0000000000c1',
       $i$insert into public.crm_contacts(user_id,name) values (sec.actor_uid('A_MEMBER'),'A-new')$i$,
       $i$insert into public.crm_contacts(user_id,name) values (sec.actor_uid('B_OWNER'),'X-forged')$i$),
      ('crm_deals','0a000000-0000-4000-8000-0000000000c2','0b000000-0000-4000-8000-0000000000c2',
       $i$insert into public.crm_deals(user_id,title) values (sec.actor_uid('A_MEMBER'),'A-new')$i$,
       $i$insert into public.crm_deals(user_id,title) values (sec.actor_uid('B_OWNER'),'X-forged')$i$),
      ('invoices','0a000000-0000-4000-8000-0000000000d1','0b000000-0000-4000-8000-0000000000d1',
       $i$insert into public.invoices(user_id,invoice_number) values (sec.actor_uid('A_MEMBER'),'A-NEW')$i$,
       $i$insert into public.invoices(user_id,invoice_number) values (sec.actor_uid('B_OWNER'),'X-FORGED')$i$),
      ('quotes','0a000000-0000-4000-8000-0000000000d2','0b000000-0000-4000-8000-0000000000d2',
       $i$insert into public.quotes(user_id,quote_number) values (sec.actor_uid('A_MEMBER'),'A-NEW')$i$,
       $i$insert into public.quotes(user_id,quote_number) values (sec.actor_uid('B_OWNER'),'X-FORGED')$i$),
      ('bills','0a000000-0000-4000-8000-0000000000d3','0b000000-0000-4000-8000-0000000000d3',
       $i$insert into public.bills(user_id,vendor_name,description,amount,issue_date,due_date) values (sec.actor_uid('A_MEMBER'),'v','d',1,current_date,current_date)$i$,
       $i$insert into public.bills(user_id,vendor_name,description,amount,issue_date,due_date) values (sec.actor_uid('B_OWNER'),'v','d',1,current_date,current_date)$i$),
      ('expenses','0a000000-0000-4000-8000-0000000000d4','0b000000-0000-4000-8000-0000000000d4',
       $i$insert into public.expenses(user_id,category,description,amount,date) values (sec.actor_uid('A_MEMBER'),'c','d',1,current_date)$i$,
       $i$insert into public.expenses(user_id,category,description,amount,date) values (sec.actor_uid('B_OWNER'),'c','d',1,current_date)$i$),
      ('payroll_employees','0a000000-0000-4000-8000-0000000000a1','0b000000-0000-4000-8000-0000000000a1',
       $i$insert into public.payroll_employees(user_id,first_name,last_name,ni_number) values (sec.actor_uid('A_MEMBER'),'f','l','AA1')$i$,
       $i$insert into public.payroll_employees(user_id,first_name,last_name,ni_number) values (sec.actor_uid('B_OWNER'),'f','l','BB1')$i$),
      ('documents','0a000000-0000-4000-8000-0000000000a2','0b000000-0000-4000-8000-0000000000a2',
       $i$insert into public.documents(user_id,title,category) values (sec.actor_uid('A_MEMBER'),'A-new','legal')$i$,
       $i$insert into public.documents(user_id,title,category) values (sec.actor_uid('B_OWNER'),'X-forged','legal')$i$),
      ('ai_workspaces','0a000000-0000-4000-8000-0000000000a3','0b000000-0000-4000-8000-0000000000a3',
       $i$insert into public.ai_workspaces(user_id,title) values (sec.actor_uid('A_MEMBER'),'A-new')$i$,
       $i$insert into public.ai_workspaces(user_id,title) values (sec.actor_uid('B_OWNER'),'X-forged')$i$),
      ('ai_conversations','0a000000-0000-4000-8000-0000000000a4','0b000000-0000-4000-8000-0000000000a4',
       $i$insert into public.ai_conversations(user_id,conversation_type) values (sec.actor_uid('A_MEMBER'),'A-new')$i$,
       $i$insert into public.ai_conversations(user_id,conversation_type) values (sec.actor_uid('B_OWNER'),'X-forged')$i$),
      ('teams','0a000000-0000-4000-8000-0000000000e1','0b000000-0000-4000-8000-0000000000e1',
       $i$insert into public.teams(owner_id,name) values (sec.actor_uid('A_MEMBER'),'A-new')$i$,
       $i$insert into public.teams(owner_id,name) values (sec.actor_uid('B_OWNER'),'X-forged')$i$)
    ) as v(res, a_id, b_id, ins_own, ins_foreign)
  loop
    -- 1 own-company SELECT
    perform sec.t('1','4/CRUD',r.res,'A_OWNER','SELECT own row','A','ALLOW',
      format('select 1 from public.%I where id = %L', r.res, r.a_id));
    perform sec.t('1','4/CRUD',r.res,'A_MEMBER','SELECT own-company row','A','INFO',
      format('select 1 from public.%I where id = %L', r.res, r.a_id));
    -- 2 INSERT for own tenant
    perform sec.t('2','4/CRUD',r.res,'A_MEMBER','INSERT own','A','ALLOW', r.ins_own);
    -- 3 member updates own-authored row (member owns nothing here; owner path)
    perform sec.t('3','4/CRUD',r.res,'A_OWNER','UPDATE own row','A','ALLOW',
      format('update public.%I set %I = now() where id = %L', r.res, case when r.res='teams' then 'created_at' else 'updated_at' end, r.a_id));
    -- 4 member updates colleague row
    perform sec.t('4','4/CRUD',r.res,'A_MEMBER','UPDATE colleague row','A','INFO',
      format('update public.%I set %I = now() where id = %L', r.res, case when r.res='teams' then 'created_at' else 'updated_at' end, r.a_id));
    -- 5 owner deletes company row
    perform sec.t('5','4/CRUD',r.res,'A_OWNER','DELETE own row','A','ALLOW',
      format('delete from public.%I where id = %L', r.res, r.a_id));
    -- 6 cross-tenant SELECT
    perform sec.t('6','4/CRUD',r.res,'A_OWNER','SELECT tenant B row','B','ZERO_ROWS',
      format('select 1 from public.%I where id = %L', r.res, r.b_id));
    perform sec.t('6','4/CRUD',r.res,'A_MEMBER','SELECT tenant B row','B','ZERO_ROWS',
      format('select 1 from public.%I where id = %L', r.res, r.b_id));
    -- 7 cross-tenant UPDATE
    perform sec.t('7','4/CRUD',r.res,'A_MEMBER','UPDATE tenant B row','B','DENY',
      format('update public.%I set %I = now() where id = %L', r.res, case when r.res='teams' then 'created_at' else 'updated_at' end, r.b_id));
    -- 8 cross-tenant DELETE
    perform sec.t('8','4/CRUD',r.res,'A_MEMBER','DELETE tenant B row','B','DENY',
      format('delete from public.%I where id = %L', r.res, r.b_id));
    -- 9 INSERT impersonating tenant B ownership
    perform sec.t('9','4/CRUD',r.res,'A_MEMBER','INSERT as tenant B owner','B','DENY_ERROR', r.ins_foreign);
    -- 10 mirror from B side
    perform sec.t('10','4/CRUD',r.res,'B_MEMBER','SELECT tenant A row','A','ZERO_ROWS',
      format('select 1 from public.%I where id = %L', r.res, r.a_id));
    perform sec.t('10','4/CRUD',r.res,'B_MEMBER','UPDATE tenant A row','A','DENY',
      format('update public.%I set %I = now() where id = %L', r.res, case when r.res='teams' then 'created_at' else 'updated_at' end, r.a_id));
    perform sec.t('10','4/CRUD',r.res,'B_MEMBER','DELETE tenant A row','A','DENY',
      format('delete from public.%I where id = %L', r.res, r.a_id));
    -- 11 anonymous
    perform sec.t('11','4/CRUD',r.res,'ANON','SELECT any row','A+B','DENY',
      format('select 1 from public.%I', r.res));
    perform sec.t('11','4/CRUD',r.res,'UNASSIGNED','SELECT any row','A+B','ZERO_ROWS',
      format('select 1 from public.%I', r.res));
  end loop;
end $$;

-- projects / todos / organizations use organization_id (separate statements)
select sec.t('1','4/CRUD','projects','A_MEMBER','SELECT own-org project','A','ALLOW',
  $$select 1 from public.projects where organization_id = '0a000000-0000-4000-8000-000000000001'$$);
select sec.t('6','4/CRUD','projects','A_MEMBER','SELECT org B project','B','ZERO_ROWS',
  $$select 1 from public.projects where organization_id = '0b000000-0000-4000-8000-000000000001'$$);
select sec.t('7','4/CRUD','projects','A_OWNER','UPDATE org B project','B','DENY',
  $$update public.projects set name='hacked' where id='0b000000-0000-4000-8000-0000000000f1'$$);
select sec.t('8','4/CRUD','projects','A_OWNER','DELETE org B project','B','DENY',
  $$delete from public.projects where id='0b000000-0000-4000-8000-0000000000f1'$$);
select sec.t('9','4/CRUD','projects','A_MEMBER','INSERT with org B id','B','DENY_ERROR',
  $$insert into public.projects(user_id,name,organization_id) values (sec.actor_uid('A_MEMBER'),'X','0b000000-0000-4000-8000-000000000001')$$);
select sec.t('1','4/CRUD','todos','A_MEMBER','SELECT own-org task','A','ALLOW',
  $$select 1 from public.todos where organization_id='0a000000-0000-4000-8000-000000000001'$$);
select sec.t('6','4/CRUD','todos','A_MEMBER','SELECT org B task','B','ZERO_ROWS',
  $$select 1 from public.todos where organization_id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('7','4/CRUD','todos','A_MEMBER','UPDATE org B task','B','DENY',
  $$update public.todos set title='hacked' where id='0b000000-0000-4000-8000-0000000000f2'$$);
select sec.t('8','4/CRUD','todos','A_MEMBER','DELETE org B task','B','DENY',
  $$delete from public.todos where id='0b000000-0000-4000-8000-0000000000f2'$$);
select sec.t('6','4/CRUD','organizations','A_MEMBER','SELECT org B','B','ZERO_ROWS',
  $$select 1 from public.organizations where id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('6','4/CRUD','organization_members','A_OWNER','SELECT org B members','B','ZERO_ROWS',
  $$select 1 from public.organization_members where organization_id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('7','4/CRUD','organizations','A_OWNER','UPDATE org B','B','DENY',
  $$update public.organizations set name='hacked' where id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('11','4/CRUD','projects','ANON','SELECT projects','A+B','DENY',
  $$select 1 from public.projects$$);
select sec.t('11','4/CRUD','organizations','ANON','SELECT organizations','A+B','DENY',
  $$select 1 from public.organizations$$);

-- ============================================================ PHASE 4 / 8.2
select sec.t('12','4/RPC','crm_contacts','A_MEMBER','filtered read of B rows (PostgREST equivalent)','B','ZERO_ROWS',
  $$select 1 from public.crm_contacts where user_id = sec.actor_uid('B_OWNER')$$);
select sec.t('13','4/RPC','admin_list_companies','A_MEMBER','rpc','platform','DENY_ERROR',
  $$select public.admin_list_companies(null,10,0,null,null)$$);
select sec.t('13','4/RPC','admin_company_detail','A_MEMBER','rpc','platform','DENY_ERROR',
  $$select public.admin_company_detail('0b000000-0000-4000-8000-000000000001')$$);
select sec.t('13','4/RPC','admin_set_user_role','A_OWNER','rpc','platform','DENY_ERROR',
  $$select public.admin_set_user_role(sec.actor_uid('A_OWNER'),'super_admin')$$);
select sec.t('13','4/RPC','admin_set_company_status','A_ADMIN','rpc','platform','DENY_ERROR',
  $$select public.admin_set_company_status('0b000000-0000-4000-8000-000000000001','suspended','x')$$);
select sec.t('14','4/RPC','admin_overview_stats','ANON','rpc','platform','DENY_ERROR',
  $$select public.admin_overview_stats()$$);
select sec.t('14','4/RPC','decrypt_banking_data','ANON','rpc','platform','DENY_ERROR',
  $$select public.decrypt_banking_data('x')$$);
select sec.t('14','4/RPC','create_payment_record','ANON','rpc','platform','DENY_ERROR',
  $$select public.create_payment_record('s','e@test.invalid',1,'i',null,null,null,null,'gbp',null,'{}'::jsonb)$$);
select sec.t('14','4/RPC','update_payment_status','ANON','rpc','platform','DENY_ERROR',
  $$select public.update_payment_status('paid','s',null,null,'{}'::jsonb)$$);
select sec.t('15','4/RPC','add_project_member','A_MEMBER','add self to B project','B','DENY_ERROR',
  $$select public.add_project_member('0b000000-0000-4000-8000-0000000000f1', sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('16','4/RPC','add_team_member','A_MEMBER','add self to B team','B','DENY_ERROR',
  $$select public.add_team_member('0b000000-0000-4000-8000-0000000000e1', sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('17','4/RPC','get_user_projects','A_MEMBER','read B user projects','B','DENY_ERROR',
  $$select public.get_user_projects(sec.actor_uid('B_OWNER'))$$);
select sec.t('17','4/RPC','get_user_teams','A_MEMBER','read B user teams','B','DENY_ERROR',
  $$select public.get_user_teams(sec.actor_uid('B_OWNER'))$$);
select sec.t('18','4/RPC','get_team_members_with_profiles','A_MEMBER','read B team members','B','DENY_ERROR',
  $$select public.get_team_members_with_profiles('0b000000-0000-4000-8000-0000000000e1')$$);
select sec.t('19','4/RPC','check_and_deduct_ai_credit','A_MEMBER','deduct B credits','B','DENY_ERROR',
  $$select public.check_and_deduct_ai_credit(sec.actor_uid('B_OWNER'),100)$$);
select sec.t('20','4/ESC','user_roles','A_MEMBER','INSERT self super_admin','platform','DENY_ERROR',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'super_admin')$$);
select sec.t('20','4/ESC','user_roles','A_MEMBER','INSERT self admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('21','4/ESC','organization_members','A_MEMBER','UPDATE own role to owner','A','DENY',
  $$update public.organization_members set role='owner' where user_id=sec.actor_uid('A_MEMBER')$$);
select sec.t('22','4/ESC','organization_members','A_OWNER','UPDATE B members','B','DENY',
  $$update public.organization_members set role='member' where organization_id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('22','4/ESC','subscribers','A_OWNER','UPDATE B subscriber','B','DENY',
  $$update public.subscribers set subscription_tier='enterprise' where user_id=sec.actor_uid('B_OWNER')$$);
select sec.t('23','4/ESC','subscribers','A_OWNER','UPDATE own tier','A','DENY',
  $$update public.subscribers set subscription_tier='enterprise' where user_id=sec.actor_uid('A_OWNER')$$);
select sec.t('24','4/AUDIT','admin_audit_logs','A_MEMBER','INSERT forged admin log','platform','DENY',
  $$insert into public.admin_audit_logs(admin_id,action) values (sec.actor_uid('SUPER_ADMIN'),'forged')$$);
select sec.t('24','4/AUDIT','payment_audit_logs','A_MEMBER','INSERT forged payment log','platform','DENY',
  $$insert into public.payment_audit_logs(user_id,action) values (sec.actor_uid('B_OWNER'),'forged')$$);
select sec.t('25','4/AUDIT','audit_logs','A_MEMBER','UPDATE audit row','A','DENY',
  $$update public.audit_logs set action='tampered' where id='0a000000-0000-4000-8000-0000000000b3'$$);
select sec.t('25','4/AUDIT','audit_logs','A_MEMBER','DELETE audit row','A','DENY',
  $$delete from public.audit_logs where id='0a000000-0000-4000-8000-0000000000b3'$$);
select sec.t('26','4/STORAGE','storage.objects','A_MEMBER','INSERT into B user path','B','DENY_ERROR',
  $$insert into storage.objects(bucket_id,name,owner) values ('user-avatars', sec.actor_uid('B_OWNER')||'/x.png', sec.actor_uid('A_MEMBER'))$$);
select sec.t('27','4/STORAGE','storage.objects','A_MEMBER','UPDATE B object','B','DENY',
  $$update storage.objects set name='hacked' where id='0b000000-0000-4000-8000-0000000000b4'$$);
select sec.t('27','4/STORAGE','storage.objects','A_MEMBER','DELETE B object','B','DENY',
  $$delete from storage.objects where id='0b000000-0000-4000-8000-0000000000b4'$$);
select sec.t('28','4/STORAGE','storage.objects','A_MEMBER','SELECT B object (public bucket)','B','INFO',
  $$select 1 from storage.objects where id='0b000000-0000-4000-8000-0000000000b4'$$);
select sec.t('29','4/ADMIN','admin_list_companies','SUPER_ADMIN','rpc','platform','ALLOW',
  $$select public.admin_list_companies(null,10,0,null,null)$$);
select sec.t('29','4/ADMIN','admin_overview_stats','SUPER_ADMIN','rpc','platform','ALLOW',
  $$select public.admin_overview_stats()$$);
select sec.t('29','4/ADMIN','admin_company_detail','SUPER_ADMIN','rpc','platform','ALLOW',
  $$select public.admin_company_detail('0b000000-0000-4000-8000-000000000001')$$);
select sec.t('30','4/ADMIN','admin_audit_logs','SUPER_ADMIN','write + read audit entry','platform','ALLOW',
  $$select public.admin_log_action('test.matrix','organization','0b000000-0000-4000-8000-000000000001','{}'::jsonb,'success')$$);

-- ============================================================ PHASE 6 same-tenant
select sec.t('S1','6/SAME','projects','A_MEMBER','SELECT own-org projects','A','ALLOW',
  $$select 1 from public.projects where organization_id='0a000000-0000-4000-8000-000000000001'$$);
select sec.t('S2','6/SAME','organization_members','A_MEMBER','SELECT own-org members','A','ALLOW',
  $$select 1 from public.organization_members where organization_id='0a000000-0000-4000-8000-000000000001'$$);
select sec.t('S3','6/SAME','todos','A_OWNER','INSERT own-org task','A','ALLOW',
  $$insert into public.todos(user_id,title,organization_id) values (sec.actor_uid('A_OWNER'),'A-new','0a000000-0000-4000-8000-000000000001')$$);
select sec.t('S4','6/SAME','profiles','A_MEMBER','SELECT own profile','A','ALLOW',
  $$select 1 from public.profiles where id=sec.actor_uid('A_MEMBER')$$);
select sec.t('S5','6/SAME','profiles','A_MEMBER','SELECT colleague profile','A','INFO',
  $$select 1 from public.profiles where id=sec.actor_uid('A_OWNER')$$);
select sec.t('S6','6/SAME','crm_contacts','A_OWNER','SELECT own contacts','A','ALLOW',
  $$select 1 from public.crm_contacts where user_id=sec.actor_uid('A_OWNER')$$);
select sec.t('S7','6/SAME','invoices','A_OWNER','UPDATE own invoice','A','ALLOW',
  $$update public.invoices set notes='ok' where id='0a000000-0000-4000-8000-0000000000d1'$$);
select sec.t('S8','6/SAME','get_user_projects','A_OWNER','own projects rpc','A','ALLOW',
  $$select public.get_user_projects(sec.actor_uid('A_OWNER'))$$);
select sec.t('S9','6/SAME','get_user_teams','A_OWNER','own teams rpc','A','ALLOW',
  $$select public.get_user_teams(sec.actor_uid('A_OWNER'))$$);
select sec.t('S10','6/SAME','add_project_member','A_OWNER','add A user to A project','A','ALLOW',
  $$select public.add_project_member('0a000000-0000-4000-8000-0000000000f1', sec.actor_uid('A_ADMIN'),'contributor')$$);
select sec.t('S11','6/SAME','add_team_member','A_OWNER','add A user to A team','A','ALLOW',
  $$select public.add_team_member('0a000000-0000-4000-8000-0000000000e1', sec.actor_uid('A_ADMIN'),'member')$$);
select sec.t('S12','6/SAME','check_and_deduct_ai_credit','A_OWNER','deduct own credit','A','ALLOW',
  $$select public.check_and_deduct_ai_credit(sec.actor_uid('A_OWNER'),1)$$);
select sec.t('S13','6/SAME','get_user_payments','A_OWNER','own payments rpc','A','ALLOW',
  $$select public.get_user_payments(sec.actor_uid('A_OWNER'))$$);

-- ============================================================ PHASE 7 role escalation
select sec.t('R1','7/ROLE','user_roles','A_MEMBER','self -> admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('R2','7/ROLE','user_roles','A_MEMBER','self -> owner','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'owner')$$);
select sec.t('R3','7/ROLE','user_roles','A_MEMBER','self -> super_admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'super_admin')$$);
select sec.t('R4','7/ROLE','user_roles','A_ADMIN','self -> super_admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_ADMIN'),'super_admin')$$);
select sec.t('R5','7/ROLE','user_roles','A_OWNER','self -> super_admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_OWNER'),'super_admin')$$);
select sec.t('R6','7/ROLE','user_roles','A_OWNER','UPDATE own role row to super_admin','platform','DENY',
  $$update public.user_roles set role='super_admin' where user_id=sec.actor_uid('A_OWNER')$$);
select sec.t('R7','7/ROLE','user_roles','A_ADMIN','grant super_admin to guessed uuid','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('B_MEMBER'),'super_admin')$$);
select sec.t('R8','7/ROLE','user_roles','A_ADMIN','grant admin to other-tenant user','B','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('B_MEMBER'),'admin')$$);
select sec.t('R9','7/ROLE','admin_set_user_role','A_OWNER','rpc escalate self','platform','DENY_ERROR',
  $$select public.admin_set_user_role(sec.actor_uid('A_OWNER'),'super_admin')$$);
select sec.t('R10','7/ROLE','user_roles','UNASSIGNED','self -> super_admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('UNASSIGNED'),'super_admin')$$);
select sec.t('R11','7/ROLE','user_roles','ANON','insert super_admin','platform','DENY',
  $$insert into public.user_roles(user_id,role) values (sec.actor_uid('A_MEMBER'),'super_admin')$$);
select sec.t('R12','7/ROLE','organization_members','A_MEMBER','self -> admin in own org','A','DENY',
  $$update public.organization_members set role='admin' where user_id=sec.actor_uid('A_MEMBER')$$);
select sec.t('R13','7/ROLE','is_super_admin','A_MEMBER','check authoritative role fn','platform','INFO',
  $$select 1 where public.is_super_admin(sec.actor_uid('A_MEMBER'))$$);
select sec.t('R14','7/ROLE','is_super_admin','SUPER_ADMIN','check authoritative role fn','platform','ALLOW',
  $$select 1 where public.is_super_admin(sec.actor_uid('SUPER_ADMIN'))$$);

-- ============================================================ PHASE 8 membership escalation
select sec.t('M1','8/MEMBER','project_members','A_MEMBER','direct INSERT into B project','B','DENY',
  $$insert into public.project_members(project_id,user_id,role) values ('0b000000-0000-4000-8000-0000000000f1',sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('M2','8/MEMBER','add_project_member','A_ADMIN','rpc add A user to B project','B','DENY_ERROR',
  $$select public.add_project_member('0b000000-0000-4000-8000-0000000000f1',sec.actor_uid('A_ADMIN'),'admin')$$);
select sec.t('M3','8/MEMBER','team_members','A_OWNER','direct INSERT into B team','B','DENY',
  $$insert into public.team_members(team_id,user_id,role) values ('0b000000-0000-4000-8000-0000000000e1',sec.actor_uid('A_OWNER'),'admin')$$);
select sec.t('M4','8/MEMBER','add_team_member','B_MEMBER','rpc add self to A team','A','DENY_ERROR',
  $$select public.add_team_member('0a000000-0000-4000-8000-0000000000e1',sec.actor_uid('B_MEMBER'),'admin')$$);
select sec.t('M5','8/MEMBER','add_project_member','A_MEMBER','guessed project uuid','B','DENY_ERROR',
  $$select public.add_project_member('00000000-0000-4000-8000-00000000dead',sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('M6','8/MEMBER','organization_members','A_MEMBER','self-join org B','B','DENY',
  $$insert into public.organization_members(organization_id,user_id,role) values ('0b000000-0000-4000-8000-000000000001',sec.actor_uid('A_MEMBER'),'admin')$$);
select sec.t('M7','8/MEMBER','users_share_organization','A_MEMBER','probe A vs B','B','INFO',
  $$select 1 where public.users_share_organization(sec.actor_uid('A_MEMBER'),sec.actor_uid('B_MEMBER'))$$);
select sec.t('M8','8/MEMBER','users_share_organization','A_MEMBER','probe A vs A','A','ALLOW',
  $$select 1 where public.users_share_organization(sec.actor_uid('A_MEMBER'),sec.actor_uid('A_OWNER'))$$);
select sec.t('M9','8/MEMBER','users_share_organization','ANON','probe','platform','DENY_ERROR',
  $$select public.users_share_organization(sec.actor_uid('A_MEMBER'),sec.actor_uid('B_MEMBER'))$$);

-- ============================================================ PHASE 9 RPC authorization
do $$
declare r record;
begin
  for r in select * from (values
    ('get_user_projects',      $c$select public.get_user_projects(sec.actor_uid('B_OWNER'))$c$),
    ('get_user_teams',         $c$select public.get_user_teams(sec.actor_uid('B_OWNER'))$c$),
    ('get_user_payments',      $c$select public.get_user_payments(sec.actor_uid('B_OWNER'))$c$),
    ('get_bank_accounts_safe', $c$select public.get_bank_accounts_safe(sec.actor_uid('B_OWNER'))$c$),
    ('get_bank_account_details',$c$select public.get_bank_account_details('0b000000-0000-4000-8000-0000000000a6',sec.actor_uid('B_OWNER'))$c$),
    ('get_integration_tokens', $c$select public.get_integration_tokens('synthetic',sec.actor_uid('B_OWNER'))$c$),
    ('get_user_integrations_safe',$c$select public.get_user_integrations_safe(sec.actor_uid('B_OWNER'))$c$),
    ('get_hmrc_tokens',        $c$select public.get_hmrc_tokens(sec.actor_uid('B_OWNER'))$c$),
    ('get_hmrc_client_secret', $c$select public.get_hmrc_client_secret(sec.actor_uid('B_OWNER'))$c$),
    ('check_and_deduct_ai_credit',$c$select public.check_and_deduct_ai_credit(sec.actor_uid('B_OWNER'),5)$c$),
    ('get_team_members_with_profiles',$c$select public.get_team_members_with_profiles('0b000000-0000-4000-8000-0000000000e1')$c$),
    ('get_user_display_info',  $c$select public.get_user_display_info(sec.actor_uid('B_OWNER'))$c$),
    ('decrypt_banking_data',   $c$select public.decrypt_banking_data('x')$c$),
    ('decrypt_integration_token',$c$select public.decrypt_integration_token('x')$c$),
    ('decrypt_hmrc_token',     $c$select public.decrypt_hmrc_token('x')$c$),
    ('decrypt_payment_data',   $c$select public.decrypt_payment_data('x')$c$),
    ('encrypt_banking_data',   $c$select public.encrypt_banking_data('x')$c$),
    ('encrypt_payment_data',   $c$select public.encrypt_payment_data('x')$c$),
    ('create_payment_record',  $c$select public.create_payment_record('s','e@test.invalid',1,'i',sec.actor_uid('B_OWNER'),null,null,null,'gbp',null,'{}'::jsonb)$c$),
    ('update_payment_status',  $c$select public.update_payment_status('paid','s',null,null,'{}'::jsonb)$c$),
    ('store_bank_account',     $c$select public.store_bank_account('x','p','P','current','1','2','GBP',1,1,sec.actor_uid('B_OWNER'))$c$),
    ('store_integration_tokens',$c$select public.store_integration_tokens('synthetic','t','r',null,'{}'::jsonb,sec.actor_uid('B_OWNER'))$c$),
    ('admin_list_users',       $c$select public.admin_list_users(null,null,10,0,null)$c$),
    ('admin_list_projects',    $c$select public.admin_list_projects(null,null,10,0)$c$),
    ('admin_list_subscriptions',$c$select public.admin_list_subscriptions(null,null,10,0)$c$),
    ('admin_system_health',    $c$select public.admin_system_health()$c$),
    ('admin_set_user_status',  $c$select public.admin_set_user_status(sec.actor_uid('B_OWNER'),false)$c$),
    ('admin_moderate_post',    $c$select public.admin_moderate_post('00000000-0000-4000-8000-00000000dead',true)$c$)
  ) as v(fn, stmt) loop
    perform sec.t('P9','9/RPC',r.fn,'ANON','execute','wrong tenant / platform','DENY_ERROR', r.stmt);
    perform sec.t('P9','9/RPC',r.fn,'UNASSIGNED','execute','wrong tenant / platform','DENY_ERROR', r.stmt);
    perform sec.t('P9','9/RPC',r.fn,'A_MEMBER','execute','wrong tenant / platform','DENY_ERROR', r.stmt);
    perform sec.t('P9','9/RPC',r.fn,'A_OWNER','execute','wrong tenant / platform','DENY_ERROR', r.stmt);
  end loop;
end $$;

-- ============================================================ PHASE 10 profile / PII
select sec.t('PII1','10/PII','profiles','A_MEMBER','SELECT B profile row','B','ZERO_ROWS',
  $$select 1 from public.profiles where id=sec.actor_uid('B_OWNER')$$);
select sec.t('PII2','10/PII','profiles','A_MEMBER','SELECT B email','B','ZERO_ROWS',
  $$select 1 from public.profiles where email='b_owner@test.invalid'$$);
select sec.t('PII3','10/PII','profiles','ANON','SELECT any profile','A+B','DENY',
  $$select 1 from public.profiles$$);
select sec.t('PII4','10/PII','public_profiles','ANON','SELECT view','A+B','INFO',
  $$select 1 from public.public_profiles$$);
select sec.t('PII5','10/PII','get_user_display_info','A_MEMBER','B display info','B','DENY_ERROR',
  $$select public.get_user_display_info(sec.actor_uid('B_OWNER'))$$);
select sec.t('PII6','10/PII','get_team_members_with_profiles','A_MEMBER','A team (legit)','A','INFO',
  $$select public.get_team_members_with_profiles('0a000000-0000-4000-8000-0000000000e1')$$);
select sec.t('PII7','10/PII','profiles','A_MEMBER','UPDATE B profile','B','DENY',
  $$update public.profiles set full_name='hacked' where id=sec.actor_uid('B_OWNER')$$);

-- ============================================================ PHASE 11 user-scoped tables
do $$
declare r record;
begin
  for r in select unnest(array[
    'crm_contacts','crm_deals','invoices','quotes','bills','expenses','outgoings','suppliers',
    'products_services','documents','payroll_employees','ai_workspaces','ai_conversations',
    'notes','bank_accounts','user_integrations','subscribers','payments','audit_logs']) as tbl
  loop
    perform sec.t('U-'||r.tbl,'11/USERSCOPED',r.tbl,'B_MEMBER','cross-tenant SELECT','A','ZERO_ROWS',
      format($f$select 1 from public.%I where user_id = sec.actor_uid('A_OWNER')$f$, r.tbl));
    perform sec.t('U-'||r.tbl,'11/USERSCOPED',r.tbl,'A_MEMBER','same-tenant colleague SELECT','A','INFO',
      format($f$select 1 from public.%I where user_id = sec.actor_uid('A_OWNER')$f$, r.tbl));
  end loop;
end $$;

-- ============================================================ PHASE 12 storage
select sec.t('ST1','12/STORAGE','storage.objects','ANON','read public bucket object','A','INFO',
  $$select 1 from storage.objects where bucket_id='user-avatars'$$);
select sec.t('ST2','12/STORAGE','storage.objects','A_MEMBER','write into own uid path','A','ALLOW',
  $$insert into storage.objects(bucket_id,name,owner) values ('user-avatars', sec.actor_uid('A_MEMBER')||'/ok.png', sec.actor_uid('A_MEMBER'))$$);
select sec.t('ST3','12/STORAGE','storage.objects','A_MEMBER','write into guessed path','B','DENY_ERROR',
  $$insert into storage.objects(bucket_id,name,owner) values ('company-logos','0b000000-0000-4000-8000-000000000001/x.png', sec.actor_uid('A_MEMBER'))$$);
select sec.t('ST4','12/STORAGE','storage.objects','ANON','write','A','DENY_ERROR',
  $$insert into storage.objects(bucket_id,name) values ('user-avatars','anon/x.png')$$);
select sec.t('ST5','12/STORAGE','storage.buckets','A_MEMBER','create bucket','platform','DENY',
  $$insert into storage.buckets(id,name,public) values ('rogue','rogue',true)$$);
select sec.t('ST6','12/STORAGE','storage.objects','A_MEMBER','delete own object','A','INFO',
  $$delete from storage.objects where id='0a000000-0000-4000-8000-0000000000b4'$$);

-- ============================================================ PHASE 13 super admin
do $$
declare r record; a text;
begin
  for r in select * from (values
    ('admin_list_companies', $c$select public.admin_list_companies(null,10,0,null,null)$c$),
    ('admin_list_users',     $c$select public.admin_list_users(null,null,10,0,null)$c$),
    ('admin_list_projects',  $c$select public.admin_list_projects(null,null,10,0)$c$),
    ('admin_list_subscriptions',$c$select public.admin_list_subscriptions(null,null,10,0)$c$),
    ('admin_overview_stats', $c$select public.admin_overview_stats()$c$),
    ('admin_system_health',  $c$select public.admin_system_health()$c$),
    ('admin_tools_overview', $c$select public.admin_tools_overview()$c$),
    ('admin_set_company_status',$c$select public.admin_set_company_status('0b000000-0000-4000-8000-000000000001','suspended','test')$c$),
    ('admin_set_user_role',  $c$select public.admin_set_user_role(sec.actor_uid('B_MEMBER'),'admin')$c$),
    ('admin_set_user_status',$c$select public.admin_set_user_status(sec.actor_uid('B_MEMBER'),false)$c$)
  ) as v(fn, stmt) loop
    perform sec.t('SA','13/SUPERADMIN',r.fn,'SUPER_ADMIN','execute','platform','ALLOW', r.stmt);
    perform sec.t('SA','13/SUPERADMIN',r.fn,'A_OWNER','execute','platform','DENY_ERROR', r.stmt);
    perform sec.t('SA','13/SUPERADMIN',r.fn,'A_ADMIN','execute','platform','DENY_ERROR', r.stmt);
    perform sec.t('SA','13/SUPERADMIN',r.fn,'A_MEMBER','execute','platform','DENY_ERROR', r.stmt);
    perform sec.t('SA','13/SUPERADMIN',r.fn,'B_OWNER','execute','platform','DENY_ERROR', r.stmt);
    perform sec.t('SA','13/SUPERADMIN',r.fn,'B_MEMBER','execute','platform','DENY_ERROR', r.stmt);
  end loop;
end $$;
select sec.t('SA-AUDIT','13/SUPERADMIN','admin_audit_logs','SUPER_ADMIN','read platform audit','platform','INFO',
  $$select 1 from public.admin_audit_logs$$);
select sec.t('SA-AUDIT','13/SUPERADMIN','admin_audit_logs','A_OWNER','read platform audit','platform','ZERO_ROWS',
  $$select 1 from public.admin_audit_logs$$);

-- ============================================================ PHASE 15 payments
select sec.t('PAY1','15/PAYMENT','create_payment_record','A_MEMBER','forge own payment','A','DENY_ERROR',
  $$select public.create_payment_record('s1','a_member@test.invalid',9999,'Enterprise',sec.actor_uid('A_MEMBER'),null,null,null,'gbp',null,'{}'::jsonb)$$);
select sec.t('PAY2','15/PAYMENT','update_payment_status','A_MEMBER','mark own payment paid','A','DENY_ERROR',
  $$select public.update_payment_status('paid','s1',null,null,'{}'::jsonb)$$);
select sec.t('PAY3','15/PAYMENT','payments','A_MEMBER','UPDATE B payment','B','DENY',
  $$update public.payments set status='paid' where id='0b000000-0000-4000-8000-0000000000b2'$$);
select sec.t('PAY4','15/PAYMENT','payments','A_OWNER','UPDATE own payment status','A','DENY',
  $$update public.payments set status='paid' where id='0a000000-0000-4000-8000-0000000000b2'$$);
select sec.t('PAY5','15/PAYMENT','payments','A_MEMBER','INSERT payment for B user','B','DENY',
  $$insert into public.payments(user_id,customer_email,amount,item_name,status) values (sec.actor_uid('B_OWNER'),'x@test.invalid',1,'x','paid')$$);
select sec.t('PAY6','15/PAYMENT','subscribers','A_MEMBER','INSERT premium subscriber for self','A','DENY',
  $$insert into public.subscribers(user_id,email,subscribed,subscription_tier) values (sec.actor_uid('A_MEMBER'),'a_member@test.invalid',true,'enterprise')$$);

-- ============================================================ PHASE 16 AI credits
select sec.t('AI1','16/AICREDIT','check_and_deduct_ai_credit','A_MEMBER','deduct B credits','B','DENY_ERROR',
  $$select public.check_and_deduct_ai_credit(sec.actor_uid('B_OWNER'),50)$$);
select sec.t('AI2','16/AICREDIT','check_and_deduct_ai_credit','ANON','deduct credits','platform','DENY_ERROR',
  $$select public.check_and_deduct_ai_credit(sec.actor_uid('A_OWNER'),50)$$);
select sec.t('AI3','16/AICREDIT','check_and_deduct_ai_credit','UNASSIGNED','deduct guessed uuid credits','platform','DENY_ERROR',
  $$select public.check_and_deduct_ai_credit(sec.actor_uid('A_OWNER'),50)$$);
select sec.t('AI4','16/AICREDIT','subscribers','A_MEMBER','raise own credit balance','A','DENY',
  $$update public.subscribers set ai_credits_remaining=99999 where user_id=sec.actor_uid('A_OWNER')$$);

-- ============================================================ PHASE 17 audit logs
select sec.t('AU1','17/AUDIT','audit_logs','A_ADMIN','read own audit rows','A','INFO',
  $$select 1 from public.audit_logs where user_id=sec.actor_uid('A_ADMIN')$$);
select sec.t('AU2','17/AUDIT','audit_logs','A_ADMIN','read B audit rows','B','ZERO_ROWS',
  $$select 1 from public.audit_logs where user_id=sec.actor_uid('B_OWNER')$$);
select sec.t('AU3','17/AUDIT','audit_logs','A_OWNER','read B audit rows','B','ZERO_ROWS',
  $$select 1 from public.audit_logs where user_id=sec.actor_uid('B_OWNER')$$);
select sec.t('AU4','17/AUDIT','audit_logs','B_ADMIN','read A audit rows','A','ZERO_ROWS',
  $$select 1 from public.audit_logs where user_id=sec.actor_uid('A_OWNER')$$);
select sec.t('AU5','17/AUDIT','security_audit_logs','A_ADMIN','read all security audit','platform','ZERO_ROWS',
  $$select 1 from public.security_audit_logs$$);
select sec.t('AU6','17/AUDIT','banking_audit_logs','A_ADMIN','read all banking audit','platform','ZERO_ROWS',
  $$select 1 from public.banking_audit_logs$$);
select sec.t('AU7','17/AUDIT','admin_audit_logs','A_ADMIN','read platform audit','platform','ZERO_ROWS',
  $$select 1 from public.admin_audit_logs$$);

-- ==================================================== PHASE 9b targeted probes
select sec.t('X1','9/RPC','get_hmrc_tokens','ANON','read B HMRC tokens by guessed uuid','B','DENY_ERROR',
  $$select public.get_hmrc_tokens(sec.actor_uid('B_OWNER'))$$);
select sec.t('X2','9/RPC','get_hmrc_tokens','A_MEMBER','read B HMRC tokens','B','DENY_ERROR',
  $$select public.get_hmrc_tokens(sec.actor_uid('B_OWNER'))$$);
select sec.t('X3','9/RPC','get_user_integrations_safe','ANON','read B integrations','B','DENY_ERROR',
  $$select public.get_user_integrations_safe(sec.actor_uid('B_OWNER'))$$);
select sec.t('X4','9/RPC','get_bank_accounts_safe','ANON','read B bank accounts','B','DENY_ERROR',
  $$select public.get_bank_accounts_safe(sec.actor_uid('B_OWNER'))$$);
select sec.t('X5','9/RPC','get_hmrc_client_secret','ANON','read B client secret','B','DENY_ERROR',
  $$select public.get_hmrc_client_secret(sec.actor_uid('B_OWNER'))$$);
select sec.t('X6','4/CRUD','documents','A_MEMBER','SELECT paid B document','B','ZERO_ROWS',
  $$select 1 from public.documents where id='0b000000-0000-4000-8000-0000000000b6'$$);
select sec.t('X7','4/CRUD','documents','A_MEMBER','SELECT free B document (marketplace by design)','B','INFO',
  $$select 1 from public.documents where id='0b000000-0000-4000-8000-0000000000a2'$$);
select sec.t('X8','4/CRUD','hmrc_integrations','A_MEMBER','SELECT B HMRC row','B','ZERO_ROWS',
  $$select 1 from public.hmrc_integrations where organization_id='0b000000-0000-4000-8000-000000000001'$$);
select sec.t('X9','4/CRUD','projects','A_MEMBER','INSERT own project with foreign org id (owner column self)','B','DENY_ERROR',
  $$insert into public.projects(user_id,name,organization_id) values (sec.actor_uid('A_MEMBER'),'X-cross','0b000000-0000-4000-8000-000000000001')$$);
select sec.t('X10','4/CRUD','todos','A_MEMBER','INSERT own todo with foreign org id','B','DENY_ERROR',
  $$insert into public.todos(user_id,title,organization_id) values (sec.actor_uid('A_MEMBER'),'X-cross','0b000000-0000-4000-8000-000000000001')$$);
