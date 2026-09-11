-- =====================================================================
-- WAVE 1 — HISTORICAL PROJECT OWNERSHIP RECONCILIATION
-- STATUS: NOT APPROVED / NOT EXECUTED / DO NOT RUN
-- =====================================================================
-- This package assigns an organisation to historical projects that have
-- organization_id IS NULL. Ownership CANNOT be inferred, because the owning
-- users are members of several organisations. Every assignment below must be
-- entered explicitly by a human decision-maker.
--
-- The template is FAIL-CLOSED: with no approved assignments it raises and
-- changes nothing. Nothing here runs automatically, and it must never be
-- executed against production without written per-project approval.
--
-- PRODUCTION EVIDENCE (read-only, captured 2026-09):
--   cb4c260b-4905-433c-9563-9f381ea3912d  B2BNEST        owner 66a8af46…  6 tasks   child org d2d372cd…  (owner has 1 org)
--   499fdffe-5741-4984-99c5-8b654f82d555  AI NEST        owner 66a8af46…  1 task    child org d2d372cd…  (owner has 1 org)
--   b7ac8fb5-09b0-438b-8cfa-042e3f024b1a  AINEST         owner 3eac00c6…  5 tasks   child org 69fd39aa…  (owner has 3 orgs — AMBIGUOUS)
--   d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32  NESTPRO TRADE  owner 3eac00c6…  0 tasks   no evidence         (AMBIGUOUS)
--   271ce96c-2341-4f9b-a9db-96d3ad54a9ec  NG TELECOM     owner 3eac00c6…  6 tasks   child org 136792c5… (owner has 3 orgs — AMBIGUOUS)
-- Total NULL-organisation projects: 5 (not 3). Tasks under the ambiguous
-- multi-organisation subset: 11 (not 12), and all 11 already carry an
-- organisation id matching their sibling evidence.
-- =====================================================================

begin;

create temporary table wave1_approved_assignments (
  project_id      uuid primary key,
  organization_id uuid not null,
  approved_by     text not null,
  approved_at     timestamptz not null default now()
) on commit drop;

-- ---------------------------------------------------------------------
-- STEP 1 — HUMAN INPUT REQUIRED
-- Uncomment one row per project ONLY after a named person has approved it.
-- ---------------------------------------------------------------------
-- insert into wave1_approved_assignments(project_id, organization_id, approved_by) values
--   ('cb4c260b-4905-433c-9563-9f381ea3912d','<ORG-UUID>','<name/email>'),
--   ('499fdffe-5741-4984-99c5-8b654f82d555','<ORG-UUID>','<name/email>'),
--   ('b7ac8fb5-09b0-438b-8cfa-042e3f024b1a','<ORG-UUID>','<name/email>'),
--   ('d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32','<ORG-UUID>','<name/email>'),
--   ('271ce96c-2341-4f9b-a9db-96d3ad54a9ec','<ORG-UUID>','<name/email>');

do $$
declare n int; bad int;
begin
  select count(*) into n from wave1_approved_assignments;
  if n = 0 then
    raise exception 'ABORT: no approved project -> organisation assignments were supplied.';
  end if;

  -- STEP 2 — every target must still be NULL (no silent overwrite)
  select count(*) into bad
  from wave1_approved_assignments a
  join public.projects p on p.id = a.project_id
  where p.organization_id is not null;
  if bad > 0 then raise exception 'ABORT: % target project(s) already own an organisation.', bad; end if;

  -- STEP 3 — every approved project must exist
  select count(*) into bad
  from wave1_approved_assignments a
  left join public.projects p on p.id = a.project_id
  where p.id is null;
  if bad > 0 then raise exception 'ABORT: % approved project id(s) do not exist.', bad; end if;

  -- STEP 4 — the project owner must be an active member of the approved org
  select count(*) into bad
  from wave1_approved_assignments a
  join public.projects p on p.id = a.project_id
  where not exists (
    select 1 from public.organization_members m
    where m.user_id = p.user_id and m.organization_id = a.organization_id and m.is_active
  );
  if bad > 0 then raise exception 'ABORT: % assignment(s) name an organisation the owner does not belong to.', bad; end if;

  -- STEP 5 — approved org must not contradict existing child-task evidence
  select count(*) into bad
  from wave1_approved_assignments a
  join public.todos t on t.project_id = a.project_id
  where t.organization_id is not null and t.organization_id <> a.organization_id;
  if bad > 0 then raise exception 'ABORT: % child task(s) contradict the approved organisation.', bad; end if;
end $$;

-- STEP 6 — assign the projects
update public.projects p
set organization_id = a.organization_id
from wave1_approved_assignments a
where p.id = a.project_id and p.organization_id is null;

-- STEP 7 — assign child tasks strictly from their parent project
update public.todos t
set organization_id = p.organization_id
from public.projects p
join wave1_approved_assignments a on a.project_id = p.id
where t.project_id = p.id and t.organization_id is null;

-- STEP 8 — verify: nothing approved may remain unassigned or inconsistent
do $$
declare bad int;
begin
  select count(*) into bad from wave1_approved_assignments a
  join public.projects p on p.id = a.project_id where p.organization_id is distinct from a.organization_id;
  if bad > 0 then raise exception 'VERIFY FAILED: % project(s) not assigned as approved.', bad; end if;

  select count(*) into bad from wave1_approved_assignments a
  join public.todos t on t.project_id = a.project_id
  where t.organization_id is distinct from a.organization_id;
  if bad > 0 then raise exception 'VERIFY FAILED: % task(s) not consistent with their parent.', bad; end if;
end $$;

-- Review the result, then COMMIT manually. Left open on purpose.
rollback;
