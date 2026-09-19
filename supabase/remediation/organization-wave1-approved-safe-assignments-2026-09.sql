-- WAVE 1 APPROVED SAFE ASSIGNMENTS — PREPARED, NOT EXECUTED
-- Scope: B2BNEST and AI NEST only. Production execution requires a separate
-- explicit deployment authorization, backup, preflight and changing ROLLBACK.
begin;

create temporary table approved_project_assignments (
  project_id uuid primary key,
  expected_name text not null,
  expected_owner uuid not null,
  organization_id uuid not null,
  expected_children integer not null
) on commit drop;

insert into approved_project_assignments values
  ('cb4c260b-4905-433c-9563-9f381ea3912d', 'B2BNEST', '66a8af46-6904-4022-8695-53cf272c8ee4', 'd2d372cd-a0fb-4ff9-9918-c2ffdd823242', 6),
  ('499fdffe-5741-4984-99c5-8b654f82d555', 'AI NEST', '66a8af46-6904-4022-8695-53cf272c8ee4', 'd2d372cd-a0fb-4ff9-9918-c2ffdd823242', 1);

do $$
declare bad integer;
begin
  select count(*) into bad from approved_project_assignments a
  left join public.projects p on p.id = a.project_id
  where p.id is null or p.name <> a.expected_name or p.user_id <> a.expected_owner
     or p.organization_id is not null;
  if bad <> 0 then raise exception 'ABORT: project identity, owner, name, or NULL-state changed'; end if;

  select count(*) into bad from approved_project_assignments a
  where not exists (
    select 1 from public.organization_members m
    where m.user_id = a.expected_owner and m.organization_id = a.organization_id and m.is_active
  );
  if bad <> 0 then raise exception 'ABORT: owner is not an active member of the approved company'; end if;

  select count(*) into bad from approved_project_assignments a
  where (select count(*) from public.todos t where t.project_id = a.project_id) <> a.expected_children
     or exists (
       select 1 from public.todos t where t.project_id = a.project_id
       and t.organization_id is distinct from a.organization_id
     );
  if bad <> 0 then raise exception 'ABORT: child count or company consistency changed'; end if;
end $$;

update public.projects p
set organization_id = a.organization_id
from approved_project_assignments a
where p.id = a.project_id and p.organization_id is null;

do $$
declare bad integer;
begin
  select count(*) into bad from approved_project_assignments a
  join public.projects p on p.id = a.project_id
  where p.organization_id is distinct from a.organization_id;
  if bad <> 0 then raise exception 'VERIFY FAILED: approved assignments did not apply exactly'; end if;

  if exists (
    select 1 from public.projects
    where id in (
      'b7ac8fb5-09b0-438b-8cfa-042e3f024b1a',
      'd13672f8-f5f4-4e2a-a4e1-35df0cf0ff32',
      '271ce96c-2341-4f9b-a9db-96d3ad54a9ec'
    ) and organization_id is not null
  ) then raise exception 'VERIFY FAILED: held project was modified'; end if;
end $$;

rollback;