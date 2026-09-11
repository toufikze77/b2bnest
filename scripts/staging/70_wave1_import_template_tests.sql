-- Wave 1 FINAL BLOCKER regression suite (spreadsheet import, template
-- application, company switching, member pickers, parent/child tenancy).
-- Isolated local staging only. Requires 20_security_harness.sql, 50_wave1_seed.sql,
-- the Wave 1 package and 60_wave1_tests.sql to have run first.
set client_min_messages = warning;

do $$
declare
  ORG_A constant text := '0a000000-0000-4000-8000-000000000001';
  ORG_B constant text := '0b000000-0000-4000-8000-000000000001';
  PRJ_A constant text := '0a000000-0000-4000-8000-0000000000f1';
  PRJ_B constant text := '0b000000-0000-4000-8000-0000000000f1';
  FAKE  constant text := '00000000-dead-4000-8000-00000000dead';
begin
-- ==================== PHASE 20 — SPREADSHEET IMPORT =========================
-- The corrected import stamps organization_id = validated active organisation.
perform sec.t('IMP-01','IMPORT','projects','MULTI_ORG','INSERT','import into active org A','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Imported-A'')', ORG_A));
perform sec.t('IMP-02','IMPORT','projects','MULTI_ORG','INSERT','import into active org B','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Imported-B'')', ORG_B));
perform sec.t('IMP-03','IMPORT','projects','MULTI_ORG','INSERT','manipulated payload: non-member org','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Imported-X'')', FAKE));
perform sec.t('IMP-04','IMPORT','projects','A_MEMBER','INSERT','manipulated payload: other tenant','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''A_MEMBER''),%L,''Imported-X'')', ORG_B));
perform sec.t('IMP-05','IMPORT','projects','ANON','INSERT','anonymous import','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''A_MEMBER''),%L,''Imported-X'')', ORG_A));
perform sec.t('IMP-06','IMPORT','projects','UNASSIGNED','INSERT','import without membership','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''UNASSIGNED''),%L,''Imported-X'')', ORG_A));
perform sec.t('IMP-07','IMPORT','projects','MULTI_ORG','INSERT','multi-row batch into org A','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Batch-1''),(sec.actor_uid(''MULTI_ORG''),%L,''Batch-2''),(sec.actor_uid(''MULTI_ORG''),%L,''Batch-3'')', ORG_A, ORG_A, ORG_A));
perform sec.t('IMP-08','IMPORT','projects','MULTI_ORG','INSERT','batch atomicity: one bad tenant row','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Batch-ok''),(sec.actor_uid(''MULTI_ORG''),%L,''Batch-bad'')', ORG_A, FAKE));
perform sec.t('IMP-09','IMPORT','projects','MULTI_ORG','SELECT','imported A row invisible in B filter','ZERO_ROWS',
  format('select 1 from public.projects where organization_id=%L and name=''Imported-A''', ORG_B));

-- ==================== PHASE 21 — TEMPLATE APPLICATION =======================
perform sec.t('TPL-01','TEMPLATE','projects','MULTI_ORG','INSERT','template board into active org A','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Tpl-A'')', ORG_A));
perform sec.t('TPL-02','TEMPLATE','projects','MULTI_ORG','INSERT','template board into active org B','ALLOW',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Tpl-B'')', ORG_B));
perform sec.t('TPL-03','TEMPLATE','projects','MULTI_ORG','INSERT','template board into non-member org','DENY_ERROR',
  format('insert into public.projects(user_id, organization_id, name) values (sec.actor_uid(''MULTI_ORG''),%L,''Tpl-X'')', FAKE));
perform sec.t('TPL-04','TEMPLATE','todos','MULTI_ORG','INSERT','template task matches parent org','ALLOW',
  format('insert into public.todos(user_id, organization_id, project_id, title) values (sec.actor_uid(''MULTI_ORG''),%L,%L,''Tpl-task'')', ORG_A, PRJ_A));
perform sec.t('TPL-05','TEMPLATE','todos','MULTI_ORG','INSERT','template task contradicts parent org','DENY_ERROR',
  format('insert into public.todos(user_id, organization_id, project_id, title) values (sec.actor_uid(''MULTI_ORG''),%L,%L,''Tpl-task-bad'')', ORG_B, PRJ_A));
perform sec.t('TPL-06','TEMPLATE','projects','A_OWNER','SELECT','B template board','ZERO_ROWS',
  format('select 1 from public.projects where organization_id=%L', ORG_B));

-- ==================== PHASE 22 — COMPANY SWITCHING / CACHE ==================
perform sec.t('SW-01','SWITCH','projects','MULTI_ORG','SELECT','context A returns A rows','ALLOW',
  format('select 1 from public.projects where organization_id=%L', ORG_A));
perform sec.t('SW-02','SWITCH','projects','MULTI_ORG','SELECT','context B returns B rows','ALLOW',
  format('select 1 from public.projects where organization_id=%L', ORG_B));
perform sec.t('SW-03','SWITCH','projects','MULTI_ORG','SELECT','A board never appears under B filter','ZERO_ROWS',
  format('select 1 from public.projects where organization_id=%L and id=%L', ORG_B, PRJ_A));
perform sec.t('SW-04','SWITCH','todos','MULTI_ORG','SELECT','A task never appears under B filter','ZERO_ROWS',
  format('select 1 from public.todos where organization_id=%L and project_id=%L', ORG_B, PRJ_A));
perform sec.t('SW-05','SWITCH','projects','A_OWNER','SELECT','non-member context yields nothing','ZERO_ROWS',
  format('select 1 from public.projects where organization_id=%L', ORG_B));

-- ==================== PHASE 23 — MEMBER PICKERS =============================
perform sec.t('PICK-01','PICKER','organization_members','A_OWNER','SELECT','A members visible','ALLOW',
  format('select 1 from public.organization_members where organization_id=%L', ORG_A));
perform sec.t('PICK-02','PICKER','organization_members','A_OWNER','SELECT','B members hidden','ZERO_ROWS',
  format('select 1 from public.organization_members where organization_id=%L', ORG_B));
perform sec.t('PICK-03','PICKER','organization_members','A_OWNER','SELECT','multi-org user assignable in A','ALLOW',
  format('select 1 from public.organization_members where organization_id=%L and user_id=sec.actor_uid(''MULTI_ORG'')', ORG_A));
perform sec.t('PICK-04','PICKER','organization_members','A_OWNER','SELECT','B-only user not assignable in A','ZERO_ROWS',
  'select 1 from public.organization_members where user_id = sec.actor_uid(''B_MEMBER'')');
perform sec.t('PICK-05','PICKER','organization_members','MULTI_ORG','SELECT','multi-org user sees both memberships','ALLOW',
  'select 1 from public.organization_members where user_id = sec.actor_uid(''MULTI_ORG'')');

-- ============ PHASE 24 — PARENT/CHILD TENANT CONSISTENCY ====================
perform sec.t('PC-01','PARENT','todos','SERVICE','SELECT','mismatched child rows are reported, not rewritten','ALLOW',
  'select 1 from public.wave1_unresolved_rows where class = ''MISMATCH''');
perform sec.t('PC-02','PARENT','todos','SERVICE','SELECT','no NULL-org todo left under an org-owned project','ZERO_ROWS',
  'select 1 from public.todos t join public.projects p on p.id=t.project_id where p.organization_id is not null and t.organization_id is null');
perform sec.t('PC-03','PARENT','journal','SERVICE','SELECT','deterministic backfill journalled','ALLOW',
  'select 1 from public.wave1_backfill_journal where method = ''PARENT-DERIVED''');
perform sec.t('PC-04','PARENT','todos','MULTI_ORG','UPDATE','cannot move task to other tenant','DENY',
  format('update public.todos set organization_id=%L where project_id=%L', ORG_B, PRJ_A));
end $$;
