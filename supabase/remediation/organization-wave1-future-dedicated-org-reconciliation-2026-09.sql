-- FUTURE DEDICATED-ORGANISATION RECONCILIATION — TEMPLATE ONLY / DO NOT RUN
-- Requires separately authorised creation of NESTPRO TRADE and NG TELECOM LTD,
-- their real UUIDs below, a fresh backup, and explicit approval for the six-task
-- NG TELECOM move. It defaults to ROLLBACK and fails closed.
begin;

create temporary table future_org_inputs (
  organization_name text primary key,
  organization_id uuid not null,
  approved_by text not null
) on commit drop;

-- Intentionally empty. Supply BOTH real UUIDs only after the organisations are
-- created through the normal application path and production authorization is granted.
-- insert into future_org_inputs values
--   ('NESTPRO TRADE', '<REAL-UUID>', '<NAMED-APPROVER>'),
--   ('NG TELECOM LTD', '<REAL-UUID>', '<NAMED-APPROVER>');

do $$
declare bad integer;
begin
  if (select count(*) from future_org_inputs) <> 2 then
    raise exception 'ABORT: both explicitly approved dedicated organisations are required';
  end if;
  select count(*) into bad from future_org_inputs i
  left join public.organizations o on o.id=i.organization_id and o.name=i.organization_name
  where o.id is null;
  if bad <> 0 then raise exception 'ABORT: dedicated organisation identity does not match'; end if;

  if not exists (
    select 1 from public.organization_members m join future_org_inputs i on i.organization_id=m.organization_id
    where i.organization_name='NESTPRO TRADE' and m.user_id='3eac00c6-b29d-4dff-aef6-d9b1159e5c17' and m.is_active
  ) or not exists (
    select 1 from public.organization_members m join future_org_inputs i on i.organization_id=m.organization_id
    where i.organization_name='NG TELECOM LTD' and m.user_id='3eac00c6-b29d-4dff-aef6-d9b1159e5c17' and m.is_active
  ) then raise exception 'ABORT: historical owner lacks active membership'; end if;

  if (select count(*) from public.todos where project_id='d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32') <> 0 then
    raise exception 'ABORT: NESTPRO TRADE unexpectedly has children';
  end if;
  if (select count(*) from public.todos where project_id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec') <> 6 then
    raise exception 'ABORT: NG TELECOM child count changed';
  end if;
  if exists (
    select 1 from public.todos where project_id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec'
    and organization_id is distinct from '136792c5-1268-482f-ae83-b2da315403fd'
  ) then raise exception 'ABORT: NG TELECOM child source company changed'; end if;
end $$;

create temporary table future_reconciliation_journal as
select 'projects'::text table_name, p.id row_id, p.organization_id old_org_id,
       i.organization_id new_org_id
from public.projects p
join future_org_inputs i on i.organization_name = case p.id
  when 'd13672f8-f5f4-4e2a-a4e1-35df0cf0ff32'::uuid then 'NESTPRO TRADE'
  when '271ce96c-2341-4f9b-a9db-96d3ad54a9ec'::uuid then 'NG TELECOM LTD' end
union all
select 'todos', t.id, t.organization_id, i.organization_id
from public.todos t cross join future_org_inputs i
where t.project_id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec'
  and i.organization_name='NG TELECOM LTD';

update public.projects p set organization_id=i.organization_id
from future_org_inputs i
where (p.id='d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32' and i.organization_name='NESTPRO TRADE')
   or (p.id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec' and i.organization_name='NG TELECOM LTD');

update public.todos t set organization_id=i.organization_id
from future_org_inputs i
where t.project_id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec'
  and t.organization_id='136792c5-1268-482f-ae83-b2da315403fd'
  and i.organization_name='NG TELECOM LTD';

do $$
declare bad integer;
begin
  select count(*) into bad from public.todos t join public.projects p on p.id=t.project_id
  where p.id='271ce96c-2341-4f9b-a9db-96d3ad54a9ec' and t.organization_id is distinct from p.organization_id;
  if bad <> 0 then raise exception 'VERIFY FAILED: NG TELECOM parent/child companies differ'; end if;
  if (select count(*) from future_reconciliation_journal where table_name='todos') <> 6 then
    raise exception 'VERIFY FAILED: journal does not contain exactly six NG TELECOM tasks';
  end if;
end $$;

rollback;