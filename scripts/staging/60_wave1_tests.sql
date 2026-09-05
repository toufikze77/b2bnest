-- Wave 1 tenant-ownership test matrix. Isolated local staging only.
-- Requires: 20_security_harness.sql (schema sec) and the Wave 1 package.
set client_min_messages = warning;

-- extend the actor map with the multi-organisation user
create or replace function sec.actor_uid(label text) returns uuid language sql immutable as $$
  select case label
    when 'A_OWNER'  then 'aaaaaaaa-0000-4000-8000-000000000001'
    when 'A_ADMIN'  then 'aaaaaaaa-0000-4000-8000-000000000002'
    when 'A_MEMBER' then 'aaaaaaaa-0000-4000-8000-000000000003'
    when 'B_OWNER'  then 'bbbbbbbb-0000-4000-8000-000000000001'
    when 'B_ADMIN'  then 'bbbbbbbb-0000-4000-8000-000000000002'
    when 'B_MEMBER' then 'bbbbbbbb-0000-4000-8000-000000000003'
    when 'SUPER_ADMIN' then 'cccccccc-0000-4000-8000-000000000001'
    when 'UNASSIGNED'  then 'dddddddd-0000-4000-8000-000000000001'
    when 'MULTI_ORG'   then 'eeeeeeee-0000-4000-8000-000000000001'
    else null end::uuid
$$;
create or replace function sec.actor_email(label text) returns text language sql immutable as $$
  select case label
    when 'A_OWNER' then 'a_owner@test.invalid'
    when 'A_ADMIN' then 'a_admin@test.invalid'
    when 'A_MEMBER' then 'a_member@test.invalid'
    when 'B_OWNER' then 'b_owner@test.invalid'
    when 'B_ADMIN' then 'b_admin@test.invalid'
    when 'B_MEMBER' then 'b_member@test.invalid'
    when 'SUPER_ADMIN' then 'superadmin@test.invalid'
    when 'UNASSIGNED' then 'unassigned@test.invalid'
    when 'MULTI_ORG'  then 'multi_org@test.invalid'
    else null end
$$;

do $$
declare
  ORG_A constant text := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant text := '0b000000-0000-4000-8000-000000000001';
  PRJ_A constant text := '0a000000-0000-4000-8000-0000000000f1';
  PRJ_B constant text := '0b000000-0000-4000-8000-0000000000f1';
  TSK_A constant text := '0a000000-0000-4000-8000-0000000000f2';
  TSK_B constant text := '0b000000-0000-4000-8000-0000000000f2';
  TEAM_A constant text := '0a000000-0000-4000-8000-0000000000e1';
  TEAM_B constant text := '0b000000-0000-4000-8000-0000000000e1';
  FAKE  constant text := '00000000-dead-4000-8000-00000000dead';
begin
-- ============================ PHASE 15 — COMPANY A/B ========================
-- projects
perform sec.t('W1-01','A/B','projects','A_OWNER','SELECT','A project','ALLOW',
  format('select 1 from public.projects where id=%L', PRJ_A));
perform sec.t('W1-02','A/B','projects','A_OWNER','SELECT','B project','ZERO_ROWS',
  format('select 1 from public.projects where id=%L', PRJ_B));
perform sec.t('W1-03','A/B','projects','B_OWNER','SELECT','A project','ZERO_ROWS',
  format('select 1 from public.projects where id=%L', PRJ_A));
perform sec.t('W1-04','A/B','projects','A_OWNER','INSERT','into org B','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''A_OWNER''),%L,''X'')', ORG_B));
perform sec.t('W1-05','A/B','projects','B_ADMIN','UPDATE','A project','DENY',
  format('update public.projects set name=''hacked'' where id=%L', PRJ_A));
perform sec.t('W1-06','A/B','projects','B_OWNER','DELETE','A project','DENY',
  format('delete from public.projects where id=%L', PRJ_A));
perform sec.t('W1-07','A/B','projects','A_OWNER','SELECT','guessed uuid','ZERO_ROWS',
  format('select 1 from public.projects where id=%L', FAKE));
perform sec.t('W1-08','A/B','projects','A_OWNER','INSERT','own org A','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''A_OWNER''),%L,''New A'')', ORG_A));

-- todos
perform sec.t('W1-09','A/B','todos','A_MEMBER','SELECT','A task','ALLOW',
  format('select 1 from public.todos where id=%L', TSK_A));
perform sec.t('W1-10','A/B','todos','A_MEMBER','SELECT','B task','ZERO_ROWS',
  format('select 1 from public.todos where id=%L', TSK_B));
perform sec.t('W1-11','A/B','todos','B_MEMBER','SELECT','A task','ZERO_ROWS',
  format('select 1 from public.todos where id=%L', TSK_A));
perform sec.t('W1-12','A/B','todos','B_OWNER','UPDATE','A task','DENY',
  format('update public.todos set title=''hacked'' where id=%L', TSK_A));
perform sec.t('W1-13','A/B','todos','B_OWNER','DELETE','A task','DENY',
  format('delete from public.todos where id=%L', TSK_A));
perform sec.t('W1-14','A/B','todos','B_OWNER','INSERT','into org A','DENY_ERROR',
  format('insert into public.todos(user_id, organization_id, title) values (sec.actor_uid(''B_OWNER''),%L,''X'')', ORG_A));
perform sec.t('W1-15','A/B','todos','A_MEMBER','INSERT','own org A','ALLOW',
  format('insert into public.todos(user_id, organization_id, title) values (sec.actor_uid(''A_MEMBER''),%L,''New A task'')', ORG_A));

-- teams
perform sec.t('W1-16','A/B','teams','A_ADMIN','SELECT','A team','ALLOW',
  format('select 1 from public.teams where id=%L', TEAM_A));
perform sec.t('W1-17','A/B','teams','A_ADMIN','SELECT','B team','ZERO_ROWS',
  format('select 1 from public.teams where id=%L', TEAM_B));
perform sec.t('W1-18','A/B','teams','B_ADMIN','SELECT','A team','ZERO_ROWS',
  format('select 1 from public.teams where id=%L', TEAM_A));
perform sec.t('W1-19','A/B','teams','B_OWNER','UPDATE','A team','DENY',
  format('update public.teams set name=''hacked'' where id=%L', TEAM_A));
perform sec.t('W1-20','A/B','teams','B_OWNER','DELETE','A team','DENY',
  format('delete from public.teams where id=%L', TEAM_A));
perform sec.t('W1-21','A/B','teams','A_OWNER','INSERT','into org B','DENY_ERROR',
  format('insert into public.teams(owner_id, organization_id, name) values (sec.actor_uid(''A_OWNER''),%L,''X'')', ORG_B));
perform sec.t('W1-22','A/B','teams','A_OWNER','INSERT','own org A','ALLOW',
  format('insert into public.teams(owner_id, organization_id, name) values (sec.actor_uid(''A_OWNER''),%L,''New A team'')', ORG_A));
perform sec.t('W1-23','A/B','team_members','B_OWNER','SELECT','A team members','ZERO_ROWS',
  format('select 1 from public.team_members where team_id=%L', TEAM_A));

-- anonymous
perform sec.t('W1-24','A/B','projects','ANON','SELECT','any project','DENY',
  'select 1 from public.projects');
perform sec.t('W1-25','A/B','todos','ANON','SELECT','any todo','DENY',
  'select 1 from public.todos');
perform sec.t('W1-26','A/B','teams','ANON','SELECT','any team','DENY',
  'select 1 from public.teams');
perform sec.t('W1-27','A/B','projects','ANON','INSERT','any project','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (%L,%L,''anon'')', FAKE, ORG_A));

-- ============================ PHASE 16 — MULTI-ORG ==========================
perform sec.t('W1-28','MULTI','projects','MULTI_ORG','INSERT','explicit org A','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''M-A'')', ORG_A));
perform sec.t('W1-29','MULTI','projects','MULTI_ORG','INSERT','explicit org B','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''M-B'')', ORG_B));
perform sec.t('W1-30','MULTI','projects','MULTI_ORG','INSERT','no organisation','DENY_ERROR',
  'insert into public.projects(user_id, name) values (sec.actor_uid(''MULTI_ORG''),''M-none'')');
perform sec.t('W1-31','MULTI','todos','MULTI_ORG','INSERT','no organisation','DENY_ERROR',
  'insert into public.todos(user_id, title) values (sec.actor_uid(''MULTI_ORG''),''M-none'')');
perform sec.t('W1-32','MULTI','teams','MULTI_ORG','INSERT','no organisation','DENY_ERROR',
  'insert into public.teams(owner_id, name) values (sec.actor_uid(''MULTI_ORG''),''M-none'')');
perform sec.t('W1-33','MULTI','projects','MULTI_ORG','INSERT','guessed organisation','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''M-fake'')', FAKE));
perform sec.t('W1-34','MULTI','projects','MULTI_ORG','SELECT','A project (member of A)','ALLOW',
  format('select 1 from public.projects where id=%L', PRJ_A));
perform sec.t('W1-35','MULTI','projects','MULTI_ORG','SELECT','B project (member of B)','ALLOW',
  format('select 1 from public.projects where id=%L', PRJ_B));
perform sec.t('W1-36','MULTI','projects','MULTI_ORG','SELECT','filtered to org A only','ALLOW',
  format('select 1 from public.projects where organization_id=%L', ORG_A));
perform sec.t('W1-37','MULTI','projects','MULTI_ORG','SELECT','org A filter excludes B rows','ZERO_ROWS',
  format('select 1 from public.projects where organization_id=%L and id=%L', ORG_A, PRJ_B));
perform sec.t('W1-38','MULTI','projects','MULTI_ORG','SELECT','no cross-org leak beyond A+B','ZERO_ROWS',
  format('select 1 from public.projects where organization_id is not null and organization_id not in (%L,%L)', ORG_A, ORG_B));

-- ====================== PHASE 17 — CROSS-TENANT PARENTS =====================
perform sec.t('W1-39','PARENT','todos','MULTI_ORG','INSERT','A project + org B','DENY_ERROR',
  format('insert into public.todos(user_id, organization_id, project_id, title) values (sec.actor_uid(''MULTI_ORG''),%L,%L,''X'')', ORG_B, PRJ_A));
perform sec.t('W1-40','PARENT','todos','MULTI_ORG','INSERT','B project + org A','DENY_ERROR',
  format('insert into public.todos(user_id, organization_id, project_id, title) values (sec.actor_uid(''MULTI_ORG''),%L,%L,''X'')', ORG_A, PRJ_B));
perform sec.t('W1-41','PARENT','todos','A_OWNER','INSERT','B project','DENY_ERROR',
  format('insert into public.todos(user_id, project_id, title) values (sec.actor_uid(''A_OWNER''),%L,''X'')', PRJ_B));
perform sec.t('W1-42','PARENT','todos','A_OWNER','INSERT','guessed project uuid','DENY_ERROR',
  format('insert into public.todos(user_id, project_id, title) values (sec.actor_uid(''A_OWNER''),%L,''X'')', FAKE));
perform sec.t('W1-43','PARENT','todos','A_OWNER','UPDATE','move A task to B org','DENY_ERROR',
  format('update public.todos set organization_id=%L where id=%L', ORG_B, TSK_A));
perform sec.t('W1-44','PARENT','projects','A_OWNER','UPDATE','move A project to B org','DENY_ERROR',
  format('update public.projects set organization_id=%L where id=%L', ORG_B, PRJ_A));
perform sec.t('W1-45','PARENT','team_members','B_OWNER','INSERT','add B user to A team','DENY_ERROR',
  format('insert into public.team_members(team_id, user_id) values (%L, sec.actor_uid(''B_MEMBER''))', TEAM_A));

-- ====================== PHASE 18 — SAME-TENANT SHARING ======================
perform sec.t('W1-46','SHARING','projects','A_ADMIN','SELECT','project created by A_OWNER','ALLOW',
  format('select 1 from public.projects where id=%L', PRJ_A));
perform sec.t('W1-47','SHARING','projects','A_MEMBER','SELECT','project created by A_OWNER','ALLOW',
  format('select 1 from public.projects where id=%L', PRJ_A));
perform sec.t('W1-48','SHARING','projects','A_ADMIN','UPDATE','project created by A_OWNER','ALLOW',
  format('update public.projects set name=''renamed by admin'' where id=%L', PRJ_A));
perform sec.t('W1-49','SHARING','todos','A_ADMIN','SELECT','task created by A_OWNER','ALLOW',
  format('select 1 from public.todos where id=%L', TSK_A));
perform sec.t('W1-50','SHARING','todos','A_MEMBER','UPDATE','task created by A_OWNER','ALLOW',
  format('update public.todos set status=''in-progress'' where id=%L', TSK_A));
perform sec.t('W1-51','SHARING','teams','A_MEMBER','SELECT','team created by A_OWNER','ALLOW',
  format('select 1 from public.teams where id=%L', TEAM_A));
perform sec.t('W1-52','SHARING','teams','A_ADMIN','UPDATE','team created by A_OWNER','ALLOW',
  format('update public.teams set name=''A-Team renamed'' where id=%L', TEAM_A));
perform sec.t('W1-53','SHARING','projects','A_MEMBER','DELETE','project created by A_OWNER','DENY',
  format('delete from public.projects where id=%L', PRJ_A));
perform sec.t('W1-54','SHARING','todo_subtasks','A_ADMIN','INSERT','subtask on A task','ALLOW',
  format('insert into public.todo_subtasks(todo_id, user_id, title) values (%L, sec.actor_uid(''A_ADMIN''),''sub'')', TSK_A));
perform sec.t('W1-55','SHARING','todo_subtasks','B_ADMIN','INSERT','subtask on A task','DENY_ERROR',
  format('insert into public.todo_subtasks(todo_id, user_id, title) values (%L, sec.actor_uid(''B_ADMIN''),''sub'')', TSK_A));
perform sec.t('W1-56','SHARING','todo_comments','A_MEMBER','INSERT','comment on A task','ALLOW',
  format('insert into public.todo_comments(todo_id, user_id, content) values (%L, sec.actor_uid(''A_MEMBER''),''hi'')', TSK_A));
perform sec.t('W1-57','SHARING','todo_comments','B_MEMBER','INSERT','comment on A task','DENY_ERROR',
  format('insert into public.todo_comments(todo_id, user_id, content) values (%L, sec.actor_uid(''B_MEMBER''),''hi'')', TSK_A));

-- ================== PHASE 19 — PERSONAL DATA REGRESSION =====================
perform sec.t('W1-58','PERSONAL','notes','A_ADMIN','SELECT','A_OWNER note','ZERO_ROWS',
  'select 1 from public.notes where user_id = sec.actor_uid(''A_OWNER'')');
perform sec.t('W1-59','PERSONAL','ai_conversations','A_ADMIN','SELECT','A_OWNER conversation','ZERO_ROWS',
  'select 1 from public.ai_conversations where user_id = sec.actor_uid(''A_OWNER'')');
perform sec.t('W1-60','PERSONAL','user_integrations','A_ADMIN','SELECT','A_OWNER integration','ZERO_ROWS',
  'select 1 from public.user_integrations where user_id = sec.actor_uid(''A_OWNER'')');
perform sec.t('W1-61','PERSONAL','bank_accounts','A_ADMIN','SELECT','A_OWNER bank account','ZERO_ROWS',
  'select 1 from public.bank_accounts where user_id = sec.actor_uid(''A_OWNER'')');
perform sec.t('W1-62','PERSONAL','notes','MULTI_ORG','SELECT','other users notes','ZERO_ROWS',
  'select 1 from public.notes');

-- ================== ACTIVE ORGANISATION RESOLUTION ==========================
perform sec.t('W1-63','ACTIVE-ORG','resolve','A_MEMBER','RPC','requested org A','ALLOW',
  format('select 1 where public.resolve_active_organization(%L::uuid) = %L::uuid', ORG_A, ORG_A));
perform sec.t('W1-64','ACTIVE-ORG','resolve','A_MEMBER','RPC','requested org B falls back to A','ALLOW',
  format('select 1 where public.resolve_active_organization(%L::uuid) = %L::uuid', ORG_B, ORG_A));
perform sec.t('W1-65','ACTIVE-ORG','resolve','MULTI_ORG','RPC','requested org B honoured','ALLOW',
  format('select 1 where public.resolve_active_organization(%L::uuid) = %L::uuid', ORG_B, ORG_B));
perform sec.t('W1-66','ACTIVE-ORG','resolve','ANON','RPC','anonymous','DENY_ERROR',
  'select public.resolve_active_organization(null)');
perform sec.t('W1-67','ACTIVE-ORG','wave1_sole_org','A_MEMBER','RPC','internal helper not callable','DENY_ERROR',
  'select public.wave1_sole_org(sec.actor_uid(''A_MEMBER''))');
perform sec.t('W1-68','ACTIVE-ORG','journal','A_OWNER','SELECT','backfill journal','DENY',
  'select 1 from public.wave1_backfill_journal');
perform sec.t('W1-69','ACTIVE-ORG','unresolved','A_OWNER','SELECT','unresolved rows','DENY',
  'select 1 from public.wave1_unresolved_rows');

-- ============ SUPER ADMIN + UNASSIGNED LEGACY BEHAVIOUR =====================
perform sec.t('W1-70','PLATFORM','projects','SUPER_ADMIN','SELECT','all tenants','ALLOW',
  'select 1 from public.projects');
perform sec.t('W1-71','PLATFORM','projects','UNASSIGNED','SELECT','other tenants','ZERO_ROWS',
  format('select 1 from public.projects where id in (%L,%L)', PRJ_A, PRJ_B));
perform sec.t('W1-72','PLATFORM','projects','UNASSIGNED','SELECT','own legacy personal project','ALLOW',
  'select 1 from public.projects where user_id = sec.actor_uid(''UNASSIGNED'')');
end $$;
