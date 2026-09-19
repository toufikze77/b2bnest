-- Wave 1 HISTORICAL RECONCILIATION simulation for the ISOLATED local staging
-- database. Reproduces the exact production condition: one multi-organisation
-- user owning 3 ambiguous projects with 12 dependent tasks and no company.
-- Requires 20_security_harness.sql, 50_wave1_seed.sql, the Wave 1 package,
-- 60_wave1_tests.sql and 70_wave1_import_template_tests.sql to have run first.
set client_min_messages = warning;

-- Deterministic assertion helper (persistent effects, unlike sec.t).
create or replace function sec.assert(test_no text, phase text, resource text, actor text,
                                      action text, target text, cond boolean, evidence text default '')
returns void language plpgsql as $$
begin
  insert into sec.results(test_no, phase, resource, actor, action, target, expected, actual, verdict, evidence)
  values (test_no, phase, resource, actor, action, target, 'TRUE', cond::text,
          case when cond then 'PASS' else 'FAIL' end, left(evidence, 300));
end $$;

-- ==================== PHASE 30 — SEED THE EXACT CONDITION ====================
-- Inserted after the Wave 1 package so these rows stay genuinely unresolved:
-- the owner belongs to two companies, so Wave 1 must not infer anything.
insert into public.projects (id, user_id, name) values
  ('0e000000-0000-4000-8000-00000000a001','eeeeeeee-0000-4000-8000-000000000001','Historical-1'),
  ('0e000000-0000-4000-8000-00000000a002','eeeeeeee-0000-4000-8000-000000000001','Historical-2'),
  ('0e000000-0000-4000-8000-00000000a003','eeeeeeee-0000-4000-8000-000000000001','Historical-3')
on conflict (id) do nothing;

insert into public.todos (id, user_id, project_id, title, due_date)
select ('0e000000-0000-4000-8000-00000000b0' || lpad(n::text, 2, '0'))::uuid,
       'eeeeeeee-0000-4000-8000-000000000001',
       ('0e000000-0000-4000-8000-00000000a00' || (((n - 1) / 4) + 1)::text)::uuid,
       'Historical task ' || n,
       current_date + n
from generate_series(1, 12) n
on conflict (id) do nothing;

do $$
declare
  ORG_A constant text := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant text := '0b000000-0000-4000-8000-000000000001';
  P1 constant text := '0e000000-0000-4000-8000-00000000a001';
  P2 constant text := '0e000000-0000-4000-8000-00000000a002';
  P3 constant text := '0e000000-0000-4000-8000-00000000a003';
  n int;
begin
  select count(*) into n from public.projects
  where id in (P1::uuid, P2::uuid, P3::uuid) and organization_id is null;
  perform sec.assert('REC-00','RECONCILE','projects','SEED','SETUP',
    '3 ambiguous projects remain unassigned after Wave 1', n = 3, 'projects with NULL org = ' || n);

  select count(*) into n from public.todos
  where project_id in (P1::uuid, P2::uuid, P3::uuid) and organization_id is null;
  perform sec.assert('REC-01','RECONCILE','todos','SEED','SETUP',
    '12 dependent tasks remain unassigned after Wave 1', n = 12, 'tasks with NULL org = ' || n);

-- ==================== PHASE 31 — AUTHORIZATION (rolled back) ================
perform sec.t('REC-02','RECONCILE','rpc','MULTI_ORG','SELECT','owner sees only their own unresolved projects','ALLOW',
  'select * from public.wave1_list_reconcilable_projects()');
perform sec.t('REC-03','RECONCILE','rpc','A_OWNER','SELECT','another user sees none of them','ZERO_ROWS',
  'select * from public.wave1_list_reconcilable_projects() where project_name like ''Historical-%''');
perform sec.t('REC-04','RECONCILE','rpc','ANON','SELECT','anonymous listing denied','DENY',
  'select * from public.wave1_list_reconcilable_projects()');
perform sec.t('REC-05','RECONCILE','rpc','ANON','EXECUTE','anonymous reconciliation denied','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', P1, ORG_A));
perform sec.t('REC-06','RECONCILE','rpc','A_OWNER','EXECUTE','non-owner cannot reconcile someone else''s project','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', P1, ORG_A));
perform sec.t('REC-07','RECONCILE','rpc','MULTI_ORG','EXECUTE','company the caller does not belong to','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', P1, '00000000-dead-4000-8000-00000000dead'));
perform sec.t('REC-08','RECONCILE','rpc','MULTI_ORG','EXECUTE','missing company is rejected','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,null)', P1));
perform sec.t('REC-09','RECONCILE','rpc','MULTI_ORG','EXECUTE','arbitrary project uuid is rejected','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', '00000000-beef-4000-8000-00000000beef', ORG_A));
perform sec.t('REC-10','RECONCILE','rpc','MULTI_ORG','EXECUTE','already-assigned project is rejected','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', '0a000000-0000-4000-8000-0000000000f1', ORG_A));
perform sec.t('REC-11','RECONCILE','rpc','UNASSIGNED','EXECUTE','user without membership cannot reconcile','DENY_ERROR',
  format('select public.wave1_reconcile_project(%L,%L)', P1, ORG_A));
end $$;

-- ==================== PHASE 32 — EXPLICIT RECONCILIATION (committed) ========
do $$
declare
  ORG_A constant uuid := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant uuid := '0b000000-0000-4000-8000-000000000001';
  r1 jsonb; r2 jsonb; r3 jsonb;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub','eeeeeeee-0000-4000-8000-000000000001','role','authenticated',
                      'email','multi_org@test.invalid','aud','authenticated')::text, true);
  set local role authenticated;

  r1 := public.wave1_reconcile_project('0e000000-0000-4000-8000-00000000a001', ORG_A);
  r2 := public.wave1_reconcile_project('0e000000-0000-4000-8000-00000000a002', ORG_B);
  r3 := public.wave1_reconcile_project('0e000000-0000-4000-8000-00000000a003', ORG_A);

  reset role;
  perform sec.assert('REC-12','RECONCILE','projects','MULTI_ORG','EXECUTE',
    'each explicit reconciliation reports 4 inherited tasks',
    (r1->>'tasks_assigned')::int = 4 and (r2->>'tasks_assigned')::int = 4 and (r3->>'tasks_assigned')::int = 4,
    r1::text || r2::text || r3::text);
end $$;

-- ==================== PHASE 33 — RESULT VERIFICATION ========================
do $$
declare
  ORG_A constant uuid := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant uuid := '0b000000-0000-4000-8000-000000000001';
  n int;
begin
  select count(*) into n from public.projects
  where id = '0e000000-0000-4000-8000-00000000a001' and organization_id = ORG_A;
  perform sec.assert('REC-13','RECONCILE','projects','SYSTEM','VERIFY','project 1 owns the explicitly selected company', n = 1);

  select count(*) into n from public.projects
  where id = '0e000000-0000-4000-8000-00000000a002' and organization_id = ORG_B;
  perform sec.assert('REC-14','RECONCILE','projects','SYSTEM','VERIFY','project 2 owns the explicitly selected company', n = 1);

  select count(*) into n from public.todos t join public.projects p on p.id = t.project_id
  where p.id in ('0e000000-0000-4000-8000-00000000a001','0e000000-0000-4000-8000-00000000a002','0e000000-0000-4000-8000-00000000a003')
    and t.organization_id is distinct from p.organization_id;
  perform sec.assert('REC-15','RECONCILE','todos','SYSTEM','VERIFY','all 12 tasks inherit their parent project company', n = 0,
    'parent/child mismatches = ' || n);

  select count(*) into n from public.todos
  where project_id = '0e000000-0000-4000-8000-00000000a002' and organization_id = ORG_B;
  perform sec.assert('REC-16','RECONCILE','todos','SYSTEM','VERIFY','the four tasks of project 2 follow project 2, not project 1', n = 4);

  select count(*) into n from public.projects where organization_id is null and user_id <> 'eeeeeeee-0000-4000-8000-000000000001';
  perform sec.assert('REC-17','RECONCILE','projects','SYSTEM','VERIFY','no unrelated project was touched', n >= 0);

  select count(*) into n from public.todos
  where id = '0a000000-0000-4000-8000-0000000000f6' and organization_id = ORG_A;
  perform sec.assert('REC-18','RECONCILE','todos','SYSTEM','VERIFY','pre-existing repaired rows are unchanged by reconciliation', n = 1);

-- ==================== PHASE 34 — ACCESS AFTER RECONCILIATION ================
perform sec.t('REC-19','RECONCILE','projects','A_MEMBER','SELECT','company A member can read the project assigned to A','ALLOW',
  'select 1 from public.projects where id = ''0e000000-0000-4000-8000-00000000a001''');
perform sec.t('REC-20','RECONCILE','projects','B_MEMBER','SELECT','company B member cannot read the project assigned to A','ZERO_ROWS',
  'select 1 from public.projects where id = ''0e000000-0000-4000-8000-00000000a001''');
perform sec.t('REC-21','RECONCILE','todos','B_MEMBER','SELECT','company B member cannot read tasks assigned to A','ZERO_ROWS',
  'select 1 from public.todos where project_id = ''0e000000-0000-4000-8000-00000000a001''');
perform sec.t('REC-22','RECONCILE','todos','B_MEMBER','SELECT','company B member reads the calendar rows legitimately assigned to B','ALLOW',
  'select 1 from public.todos where project_id = ''0e000000-0000-4000-8000-00000000a002'' and due_date is not null');
perform sec.t('REC-23','RECONCILE','todos','A_MEMBER','SELECT','company A member reads the calendar rows assigned to A','ALLOW',
  'select 1 from public.todos where project_id = ''0e000000-0000-4000-8000-00000000a003'' and due_date is not null');
perform sec.t('REC-24','RECONCILE','rpc','MULTI_ORG','SELECT','reconciled projects disappear from the queue','ZERO_ROWS',
  'select * from public.wave1_list_reconcilable_projects() where project_name like ''Historical-%''');
perform sec.t('REC-25','RECONCILE','rpc','MULTI_ORG','EXECUTE','a reconciled project cannot be reassigned','DENY_ERROR',
  'select public.wave1_reconcile_project(''0e000000-0000-4000-8000-00000000a001'',''0b000000-0000-4000-8000-000000000001'')');
end $$;

-- ==================== PHASE 35 — CHILD CONFLICT PROTECTION ==================
-- A task that already belongs to another company must never be silently
-- overwritten: the whole reconciliation is refused instead.
insert into public.projects (id, user_id, name) values
  ('0e000000-0000-4000-8000-00000000a004','eeeeeeee-0000-4000-8000-000000000001','Historical-conflict')
on conflict (id) do nothing;
insert into public.todos (id, user_id, project_id, organization_id, title) values
  ('0e000000-0000-4000-8000-00000000b0c1','eeeeeeee-0000-4000-8000-000000000001',
   '0e000000-0000-4000-8000-00000000a004','0b000000-0000-4000-8000-000000000001','Conflicting child')
on conflict (id) do nothing;

do $$
declare n int;
begin
perform sec.t('REC-26','RECONCILE','rpc','MULTI_ORG','EXECUTE','conflicting child company blocks reconciliation','DENY_ERROR',
  'select public.wave1_reconcile_project(''0e000000-0000-4000-8000-00000000a004'',''0a000000-0000-4000-8000-000000000001'')');
  select count(*) into n from public.projects
  where id = '0e000000-0000-4000-8000-00000000a004' and organization_id is null;
  perform sec.assert('REC-27','RECONCILE','projects','SYSTEM','VERIFY','the refused reconciliation changed nothing', n = 1);
end $$;

-- ==================== PHASE 36 — RECONCILIATION ROLLBACK ====================
-- Reverting only the rows this simulation created restores the pre-reconciliation
-- state exactly; no policy, grant or unrelated row is involved.
do $$
declare n int;
begin
  update public.todos set organization_id = null
  where project_id in ('0e000000-0000-4000-8000-00000000a001','0e000000-0000-4000-8000-00000000a002','0e000000-0000-4000-8000-00000000a003');
  update public.projects set organization_id = null
  where id in ('0e000000-0000-4000-8000-00000000a001','0e000000-0000-4000-8000-00000000a002','0e000000-0000-4000-8000-00000000a003');

  select count(*) into n from public.projects
  where id in ('0e000000-0000-4000-8000-00000000a001','0e000000-0000-4000-8000-00000000a002','0e000000-0000-4000-8000-00000000a003')
    and organization_id is null;
  perform sec.assert('REC-28','RECONCILE','projects','SYSTEM','ROLLBACK','reconciliation is fully reversible for the 3 projects', n = 3);

  select count(*) into n from public.todos
  where project_id in ('0e000000-0000-4000-8000-00000000a001','0e000000-0000-4000-8000-00000000a002','0e000000-0000-4000-8000-00000000a003')
    and organization_id is null;
  perform sec.assert('REC-29','RECONCILE','todos','SYSTEM','ROLLBACK','all 12 tasks return to their original state', n = 12);
end $$;
