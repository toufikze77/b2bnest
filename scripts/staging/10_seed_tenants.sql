-- Deterministic SYNTHETIC seed for the isolated local staging database.
-- Contains no production data. Never run against production.
set client_min_messages = warning;

-- ---------------------------------------------------------------- identities
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000001','a_owner@test.invalid', '{"full_name":"A Owner"}'),
  ('aaaaaaaa-0000-4000-8000-000000000002','a_admin@test.invalid', '{"full_name":"A Admin"}'),
  ('aaaaaaaa-0000-4000-8000-000000000003','a_member@test.invalid','{"full_name":"A Member"}'),
  ('bbbbbbbb-0000-4000-8000-000000000001','b_owner@test.invalid', '{"full_name":"B Owner"}'),
  ('bbbbbbbb-0000-4000-8000-000000000002','b_admin@test.invalid', '{"full_name":"B Admin"}'),
  ('bbbbbbbb-0000-4000-8000-000000000003','b_member@test.invalid','{"full_name":"B Member"}'),
  ('cccccccc-0000-4000-8000-000000000001','superadmin@test.invalid','{"full_name":"Test Super Admin"}'),
  ('dddddddd-0000-4000-8000-000000000001','unassigned@test.invalid','{"full_name":"Unassigned User"}')
on conflict (id) do nothing;

insert into public.profiles (id, email, full_name, display_name, company, is_public)
select u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'full_name',
       case when u.id::text like 'aaaa%' then 'Company A Synthetic'
            when u.id::text like 'bbbb%' then 'Company B Synthetic' else 'Platform' end,
       true
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('cccccccc-0000-4000-8000-000000000001','super_admin')
on conflict do nothing;

-- ------------------------------------------------------------ organizations
insert into public.organizations (id, name, slug, created_by) values
  ('0a000000-0000-4000-8000-000000000001','Company A Synthetic','company-a-synthetic','aaaaaaaa-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-000000000001','Company B Synthetic','company-b-synthetic','bbbbbbbb-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role) values
  ('0a000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','owner'),
  ('0a000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000002','admin'),
  ('0a000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000003','member'),
  ('0b000000-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000001','owner'),
  ('0b000000-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002','admin'),
  ('0b000000-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000003','member')
on conflict do nothing;

-- ------------------------------------------------------- tenant-scoped data
insert into public.projects (id, user_id, organization_id, name, client) values
  ('0a000000-0000-4000-8000-0000000000p1'::text::uuid,'aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-000000000001','A-Project','A-Client'),
  ('0b000000-0000-4000-8000-0000000000p1'::text::uuid,'bbbbbbbb-0000-4000-8000-000000000001','0b000000-0000-4000-8000-000000000001','B-Project','B-Client')
on conflict (id) do nothing;
