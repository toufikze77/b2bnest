-- Project Management entities
create table if not exists public.work_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high','urgent')) default 'medium',
  status text check (status in ('new','in_review','approved','rejected','converted')) default 'new',
  created_at timestamp with time zone default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  target_date date,
  progress int not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  member_email text not null,
  role text not null default 'member',
  created_at timestamp with time zone default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_work_requests_user on public.work_requests(user_id);
create index if not exists idx_goals_user on public.goals(user_id);
create index if not exists idx_team_members_team on public.team_members(team_id);
create index if not exists idx_calendar_events_user on public.calendar_events(user_id);