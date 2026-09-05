-- Wave 1 additional SYNTHETIC fixtures for the isolated local staging database.
-- Adds a multi-organisation user and rows that exercise every backfill class.
-- Must run BEFORE supabase/remediation/organization-wave1-2026-09.sql.
set client_min_messages = warning;

insert into auth.users (id, email, raw_user_meta_data) values
  ('eeeeeeee-0000-4000-8000-000000000001','multi_org@test.invalid','{"full_name":"Multi Org User"}')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, display_name, company, is_public)
values ('eeeeeeee-0000-4000-8000-000000000001','multi_org@test.invalid','Multi Org User','Multi Org User','Both',false)
on conflict (id) do nothing;

-- legitimate member of BOTH organisations
insert into public.organization_members (organization_id, user_id, role) values
  ('0a000000-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','member'),
  ('0b000000-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001','member')
on conflict do nothing;

-- ---------------------------------------------------------------- fixtures
-- SINGLE-MEMBERSHIP-DERIVED (A_ADMIN belongs to A only)
insert into public.teams (id, owner_id, name) values
  ('0a000000-0000-4000-8000-0000000000e2','aaaaaaaa-0000-4000-8000-000000000002','A-Legacy-Team')
on conflict (id) do nothing;
insert into public.projects (id, user_id, name) values
  ('0a000000-0000-4000-8000-0000000000f3','aaaaaaaa-0000-4000-8000-000000000002','A-Legacy-Project')
on conflict (id) do nothing;
insert into public.todos (id, user_id, title) values
  ('0a000000-0000-4000-8000-0000000000f4','aaaaaaaa-0000-4000-8000-000000000002','A-Legacy-Todo')
on conflict (id) do nothing;

-- PARENT-DERIVED (todo attached to an organisation-owned project, org NULL)
insert into public.todos (id, user_id, project_id, title) values
  ('0a000000-0000-4000-8000-0000000000f5','aaaaaaaa-0000-4000-8000-000000000001',
   '0a000000-0000-4000-8000-0000000000f1','A-Parent-Derived-Todo')
on conflict (id) do nothing;

-- MISMATCH repair (todo says B, parent project is A)
insert into public.todos (id, user_id, organization_id, project_id, title) values
  ('0a000000-0000-4000-8000-0000000000f6','aaaaaaaa-0000-4000-8000-000000000001',
   '0b000000-0000-4000-8000-000000000001','0a000000-0000-4000-8000-0000000000f1','A-Mismatched-Todo')
on conflict (id) do nothing;

-- AMBIGUOUS (multi-org owner, no parent evidence)
insert into public.teams (id, owner_id, name) values
  ('0e000000-0000-4000-8000-0000000000e1','eeeeeeee-0000-4000-8000-000000000001','Ambiguous-Team')
on conflict (id) do nothing;
insert into public.projects (id, user_id, name) values
  ('0e000000-0000-4000-8000-0000000000f1','eeeeeeee-0000-4000-8000-000000000001','Ambiguous-Project')
on conflict (id) do nothing;
insert into public.todos (id, user_id, title) values
  ('0e000000-0000-4000-8000-0000000000f2','eeeeeeee-0000-4000-8000-000000000001','Ambiguous-Todo')
on conflict (id) do nothing;

-- ORPHANED (owner has no active membership at all)
insert into public.teams (id, owner_id, name) values
  ('0d000000-0000-4000-8000-0000000000e1','dddddddd-0000-4000-8000-000000000001','Orphan-Team')
on conflict (id) do nothing;
insert into public.projects (id, user_id, name) values
  ('0d000000-0000-4000-8000-0000000000f1','dddddddd-0000-4000-8000-000000000001','Orphan-Project')
on conflict (id) do nothing;
insert into public.todos (id, user_id, title) values
  ('0d000000-0000-4000-8000-0000000000f2','dddddddd-0000-4000-8000-000000000001','Orphan-Todo')
on conflict (id) do nothing;
