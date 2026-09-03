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

insert into public.user_roles (user_id, role)
values ('cccccccc-0000-4000-8000-000000000001','super_admin')
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

-- ------------------------------------------- organization-scoped tenant data
insert into public.projects (id, user_id, organization_id, name, client) values
  ('0a000000-0000-4000-8000-0000000000f1','aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-000000000001','A-Project','A-Client'),
  ('0b000000-0000-4000-8000-0000000000f1','bbbbbbbb-0000-4000-8000-000000000001','0b000000-0000-4000-8000-000000000001','B-Project','B-Client')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000f1','aaaaaaaa-0000-4000-8000-000000000003','contributor'),
  ('0b000000-0000-4000-8000-0000000000f1','bbbbbbbb-0000-4000-8000-000000000003','contributor')
on conflict do nothing;

insert into public.todos (id, user_id, organization_id, project_id, title) values
  ('0a000000-0000-4000-8000-0000000000f2','aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-000000000001','0a000000-0000-4000-8000-0000000000f1','A-Task'),
  ('0b000000-0000-4000-8000-0000000000f2','bbbbbbbb-0000-4000-8000-000000000001','0b000000-0000-4000-8000-000000000001','0b000000-0000-4000-8000-0000000000f1','B-Task')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name) values
  ('0a000000-0000-4000-8000-0000000000e1','aaaaaaaa-0000-4000-8000-000000000001','A-Team'),
  ('0b000000-0000-4000-8000-0000000000e1','bbbbbbbb-0000-4000-8000-000000000001','B-Team')
on conflict (id) do nothing;

insert into public.team_members (team_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000e1','aaaaaaaa-0000-4000-8000-000000000003','member'),
  ('0b000000-0000-4000-8000-0000000000e1','bbbbbbbb-0000-4000-8000-000000000003','member')
on conflict do nothing;

-- ------------------------------------------------ user-scoped business data
insert into public.crm_contacts (id, user_id, name, company) values
  ('0a000000-0000-4000-8000-0000000000c1','aaaaaaaa-0000-4000-8000-000000000001','A-Contact','Company A Synthetic'),
  ('0b000000-0000-4000-8000-0000000000c1','bbbbbbbb-0000-4000-8000-000000000001','B-Contact','Company B Synthetic')
on conflict (id) do nothing;

insert into public.crm_deals (id, user_id, contact_id, title, value) values
  ('0a000000-0000-4000-8000-0000000000c2','aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-0000000000c1','A-Deal',1000),
  ('0b000000-0000-4000-8000-0000000000c2','bbbbbbbb-0000-4000-8000-000000000001','0b000000-0000-4000-8000-0000000000c1','B-Deal',2000)
on conflict (id) do nothing;

insert into public.invoices (id, user_id, invoice_number, client_name, total_amount) values
  ('0a000000-0000-4000-8000-0000000000d1','aaaaaaaa-0000-4000-8000-000000000001','A-INV-001','A-Client',100),
  ('0b000000-0000-4000-8000-0000000000d1','bbbbbbbb-0000-4000-8000-000000000001','B-INV-001','B-Client',200)
on conflict (id) do nothing;

insert into public.quotes (id, user_id, quote_number, client_name, total_amount) values
  ('0a000000-0000-4000-8000-0000000000d2','aaaaaaaa-0000-4000-8000-000000000001','A-QUO-001','A-Client',100),
  ('0b000000-0000-4000-8000-0000000000d2','bbbbbbbb-0000-4000-8000-000000000001','B-QUO-001','B-Client',200)
on conflict (id) do nothing;

insert into public.bills (id, user_id, vendor_name, description, amount, issue_date, due_date) values
  ('0a000000-0000-4000-8000-0000000000d3','aaaaaaaa-0000-4000-8000-000000000001','A-Vendor','A-Bill',50,current_date,current_date+7),
  ('0b000000-0000-4000-8000-0000000000d3','bbbbbbbb-0000-4000-8000-000000000001','B-Vendor','B-Bill',60,current_date,current_date+7)
on conflict (id) do nothing;

insert into public.expenses (id, user_id, category, description, amount, date) values
  ('0a000000-0000-4000-8000-0000000000d4','aaaaaaaa-0000-4000-8000-000000000001','travel','A-Expense',25,current_date),
  ('0b000000-0000-4000-8000-0000000000d4','bbbbbbbb-0000-4000-8000-000000000001','travel','B-Expense',35,current_date)
on conflict (id) do nothing;

insert into public.outgoings (id, user_id, name, category, amount, frequency, next_payment_date) values
  ('0a000000-0000-4000-8000-0000000000d5','aaaaaaaa-0000-4000-8000-000000000001','A-Outgoing','rent',500,'monthly',current_date+30),
  ('0b000000-0000-4000-8000-0000000000d5','bbbbbbbb-0000-4000-8000-000000000001','B-Outgoing','rent',600,'monthly',current_date+30)
on conflict (id) do nothing;

insert into public.suppliers (id, user_id, name) values
  ('0a000000-0000-4000-8000-0000000000d6','aaaaaaaa-0000-4000-8000-000000000001','A-Supplier'),
  ('0b000000-0000-4000-8000-0000000000d6','bbbbbbbb-0000-4000-8000-000000000001','B-Supplier')
on conflict (id) do nothing;

insert into public.products_services (id, user_id, name, category, price) values
  ('0a000000-0000-4000-8000-0000000000d7','aaaaaaaa-0000-4000-8000-000000000001','A-Product','general',10),
  ('0b000000-0000-4000-8000-0000000000d7','bbbbbbbb-0000-4000-8000-000000000001','B-Product','general',20)
on conflict (id) do nothing;

insert into public.payroll_employees (id, user_id, first_name, last_name, ni_number) values
  ('0a000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-000000000001','A','Employee','AA000001A'),
  ('0b000000-0000-4000-8000-0000000000a1','bbbbbbbb-0000-4000-8000-000000000001','B','Employee','BB000001B')
on conflict (id) do nothing;

insert into public.documents (id, user_id, title, category, price, file_url) values
  ('0a000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-000000000001','A-Document','legal',0,'https://example.invalid/a.pdf'),
  ('0b000000-0000-4000-8000-0000000000a2','bbbbbbbb-0000-4000-8000-000000000001','B-Document','legal',0,'https://example.invalid/b.pdf')
on conflict (id) do nothing;

insert into public.ai_workspaces (id, user_id, title) values
  ('0a000000-0000-4000-8000-0000000000a3','aaaaaaaa-0000-4000-8000-000000000001','A-Workspace'),
  ('0b000000-0000-4000-8000-0000000000a3','bbbbbbbb-0000-4000-8000-000000000001','B-Workspace')
on conflict (id) do nothing;

insert into public.ai_conversations (id, user_id, conversation_type) values
  ('0a000000-0000-4000-8000-0000000000a4','aaaaaaaa-0000-4000-8000-000000000001','A-Chat'),
  ('0b000000-0000-4000-8000-0000000000a4','bbbbbbbb-0000-4000-8000-000000000001','B-Chat')
on conflict (id) do nothing;

insert into public.notes (id, user_id, title) values
  ('0a000000-0000-4000-8000-0000000000a5','aaaaaaaa-0000-4000-8000-000000000001','A-Note'),
  ('0b000000-0000-4000-8000-0000000000a5','bbbbbbbb-0000-4000-8000-000000000001','B-Note')
on conflict (id) do nothing;

insert into public.bank_accounts (id, user_id, account_id, provider_id, provider_name, account_type) values
  ('0a000000-0000-4000-8000-0000000000a6','aaaaaaaa-0000-4000-8000-000000000001','A-ACC','synthetic','Synthetic Bank','current'),
  ('0b000000-0000-4000-8000-0000000000a6','bbbbbbbb-0000-4000-8000-000000000001','B-ACC','synthetic','Synthetic Bank','current')
on conflict (id) do nothing;

insert into public.user_integrations (id, user_id, integration_name, access_token) values
  ('0a000000-0000-4000-8000-0000000000a7','aaaaaaaa-0000-4000-8000-000000000001','synthetic','SYNTHETIC-A-TOKEN'),
  ('0b000000-0000-4000-8000-0000000000a7','bbbbbbbb-0000-4000-8000-000000000001','synthetic','SYNTHETIC-B-TOKEN')
on conflict (id) do nothing;

insert into public.subscribers (id, user_id, email, subscribed, subscription_tier, ai_credits_remaining, ai_credits_limit) values
  ('0a000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-000000000001','a_owner@test.invalid',true,'premium',100,100),
  ('0b000000-0000-4000-8000-0000000000b1','bbbbbbbb-0000-4000-8000-000000000001','b_owner@test.invalid',true,'premium',100,100)
on conflict (id) do nothing;

insert into public.payments (id, user_id, customer_email, amount, item_name, status) values
  ('0a000000-0000-4000-8000-0000000000b2','aaaaaaaa-0000-4000-8000-000000000001','a_owner@test.invalid',1000,'A-Plan','pending'),
  ('0b000000-0000-4000-8000-0000000000b2','bbbbbbbb-0000-4000-8000-000000000001','b_owner@test.invalid',1000,'B-Plan','pending')
on conflict (id) do nothing;

insert into public.audit_logs (id, user_id, action, resource_type) values
  ('0a000000-0000-4000-8000-0000000000b3','aaaaaaaa-0000-4000-8000-000000000001','A-audit-event','test'),
  ('0b000000-0000-4000-8000-0000000000b3','bbbbbbbb-0000-4000-8000-000000000001','B-audit-event','test')
on conflict (id) do nothing;

-- ------------------------------------------------------------ storage objects
insert into storage.objects (id, bucket_id, name, owner) values
  ('0a000000-0000-4000-8000-0000000000b4','user-avatars','aaaaaaaa-0000-4000-8000-000000000001/a.png','aaaaaaaa-0000-4000-8000-000000000001'),
  ('0b000000-0000-4000-8000-0000000000b4','user-avatars','bbbbbbbb-0000-4000-8000-000000000001/b.png','bbbbbbbb-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- extra fixtures for token-accessor and paid-document tests
insert into public.hmrc_integrations (id, user_id, organization_id, access_token, refresh_token, is_connected) values
  ('0a000000-0000-4000-8000-0000000000b5','aaaaaaaa-0000-4000-8000-000000000001','0a000000-0000-4000-8000-000000000001','SYNTHETIC-A-HMRC','SYNTHETIC-A-REFRESH',true),
  ('0b000000-0000-4000-8000-0000000000b5','bbbbbbbb-0000-4000-8000-000000000001','0b000000-0000-4000-8000-000000000001','SYNTHETIC-B-HMRC','SYNTHETIC-B-REFRESH',true)
on conflict (id) do nothing;

insert into public.documents (id, user_id, title, category, price, file_url) values
  ('0a000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-000000000001','A-Paid-Document','legal',49,'https://example.invalid/a-paid.pdf'),
  ('0b000000-0000-4000-8000-0000000000b6','bbbbbbbb-0000-4000-8000-000000000001','B-Paid-Document','legal',49,'https://example.invalid/b-paid.pdf')
on conflict (id) do nothing;
