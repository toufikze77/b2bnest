-- Add archived_at to todos and link from work_requests
alter table if exists public.todos add column if not exists archived_at timestamp with time zone;
alter table if exists public.work_requests add column if not exists created_task_id uuid references public.todos(id) on delete set null;
create index if not exists idx_todos_archived_at on public.todos(archived_at);