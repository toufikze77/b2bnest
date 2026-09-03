-- Tenant-isolation security harness for the ISOLATED local staging database.
-- Executes every test through a real PostgREST-equivalent session:
--   SET LOCAL ROLE anon|authenticated|service_role
--   set_config('request.jwt.claims', ...)  -- auth.uid() reads this, exactly as in Supabase
-- Every statement runs in a rolled-back subtransaction, so the seed stays deterministic.
set client_min_messages = warning;

drop schema if exists sec cascade;
create schema sec;

create table sec.results (
  seq          serial primary key,
  test_no      text,
  phase        text,
  resource     text,
  actor        text,
  action       text,
  target       text,
  expected     text,
  actual       text,
  verdict      text,
  evidence     text
);

create function sec.actor_uid(label text) returns uuid language sql immutable as $$
  select case label
    when 'A_OWNER'  then 'aaaaaaaa-0000-4000-8000-000000000001'
    when 'A_ADMIN'  then 'aaaaaaaa-0000-4000-8000-000000000002'
    when 'A_MEMBER' then 'aaaaaaaa-0000-4000-8000-000000000003'
    when 'B_OWNER'  then 'bbbbbbbb-0000-4000-8000-000000000001'
    when 'B_ADMIN'  then 'bbbbbbbb-0000-4000-8000-000000000002'
    when 'B_MEMBER' then 'bbbbbbbb-0000-4000-8000-000000000003'
    when 'SUPER_ADMIN' then 'cccccccc-0000-4000-8000-000000000001'
    when 'UNASSIGNED'  then 'dddddddd-0000-4000-8000-000000000001'
    else null end::uuid
$$;

create function sec.actor_email(label text) returns text language sql immutable as $$
  select case label
    when 'A_OWNER' then 'a_owner@test.invalid'
    when 'A_ADMIN' then 'a_admin@test.invalid'
    when 'A_MEMBER' then 'a_member@test.invalid'
    when 'B_OWNER' then 'b_owner@test.invalid'
    when 'B_ADMIN' then 'b_admin@test.invalid'
    when 'B_MEMBER' then 'b_member@test.invalid'
    when 'SUPER_ADMIN' then 'superadmin@test.invalid'
    when 'UNASSIGNED' then 'unassigned@test.invalid'
    else null end
$$;

-- Runs `stmt` as `label` and returns 'ROWS=n' or 'ERROR <sqlstate>: <msg>'.
create function sec.exec(label text, stmt text) returns text
language plpgsql as $$
declare
  dbrole text := case when label = 'ANON' then 'anon'
                      when label = 'SERVICE' then 'service_role'
                      else 'authenticated' end;
  uid uuid := sec.actor_uid(label);
  res text;
  n bigint;
begin
  perform set_config('request.jwt.claims',
    case when uid is null and label <> 'SERVICE' then '{"role":"anon"}'
         else json_build_object('sub', uid, 'role', dbrole, 'email', sec.actor_email(label),
                                'aud','authenticated')::text end, true);
  execute format('set local role %I', dbrole);
  begin
    execute stmt;
    get diagnostics n = row_count;
    res := 'ROWS=' || n;
    raise exception using errcode = 'P0001', message = '__rollback__';
  exception when others then
    if sqlerrm <> '__rollback__' then
      res := 'ERROR ' || sqlstate || ': ' || left(replace(sqlerrm, E'\n', ' '), 140);
    end if;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return res;
end $$;

-- Records one test. expected: ALLOW | ZERO_ROWS | DENY | DENY_ERROR
create function sec.t(test_no text, phase text, resource text, actor text,
                      action text, target text, expected text, stmt text)
returns void language plpgsql as $$
declare a text; v text;
begin
  a := sec.exec(actor, stmt);
  v := case
    when expected = 'ALLOW'      then case when a like 'ROWS=%' and a <> 'ROWS=0' then 'PASS' else 'FAIL' end
    when expected = 'ZERO_ROWS'  then case when a = 'ROWS=0' then 'PASS' else 'FAIL' end
    when expected = 'DENY'       then case when a like 'ERROR%' or a = 'ROWS=0' then 'PASS' else 'FAIL' end
    when expected = 'DENY_ERROR' then case when a like 'ERROR%' then 'PASS' else 'FAIL' end
    when expected = 'INFO'       then 'INFO'
    else 'BLOCKED' end;
  insert into sec.results(test_no, phase, resource, actor, action, target, expected, actual, verdict, evidence)
  values (test_no, phase, resource, actor, action, target, expected, a, v, left(stmt, 300));
end $$;

-- The test statements themselves call sec.actor_uid(); the test schema must be
-- reachable from the simulated sessions. This grants access to the TEST schema
-- only and does not touch any application policy or grant.
grant usage on schema sec to anon, authenticated, service_role;
grant execute on function sec.actor_uid(text), sec.actor_email(text) to anon, authenticated, service_role;
