-- Payroll UK schema
create table if not exists payroll_employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  ni_number text,
  tax_code text not null default '1257L',
  ni_category text not null default 'A',
  annual_salary numeric not null check (annual_salary >= 0),
  pay_frequency text not null default 'MTH', -- MTH or WK
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_employees_user on payroll_employees(user_id);

create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null, -- YYYY-MM
  pay_date date not null,
  tax_year text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_runs_user on payroll_runs(user_id);

create table if not exists payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payroll_runs(id) on delete cascade,
  employee_id uuid not null references payroll_employees(id) on delete restrict,
  gross_pay numeric not null,
  taxable_pay numeric not null,
  tax_deducted numeric not null,
  employee_nic numeric not null,
  employer_nic numeric not null,
  net_pay numeric not null
);

create index if not exists idx_payroll_items_run on payroll_run_items(run_id);
create index if not exists idx_payroll_items_employee on payroll_run_items(employee_id);

create table if not exists payroll_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references payroll_runs(id) on delete cascade,
  type text not null, -- FPS or EPS
  submission_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_submissions_user on payroll_submissions(user_id);

-- RLS: enable and allow owner access
alter table payroll_employees enable row level security;
alter table payroll_runs enable row level security;
alter table payroll_run_items enable row level security;
alter table payroll_submissions enable row level security;

create policy "payroll_employees_owner" on payroll_employees for all using (auth.uid() = user_id);
create policy "payroll_runs_owner" on payroll_runs for all using (auth.uid() = user_id);
create policy "payroll_items_owner" on payroll_run_items for select using (
  exists(select 1 from payroll_runs r where r.id = run_id and r.user_id = auth.uid())
);
create policy "payroll_submissions_owner" on payroll_submissions for all using (auth.uid() = user_id);

