-- Google Calendar sync fixture (DISPOSABLE local Postgres only). The local chain's todos is a minimal stand-in; give it
-- the production columns this feature reads (production todos, read 25 Nov 2026: title, description, due_date date,
-- completed_at, archived_at, ...). Nothing here runs on production.
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Task',
  ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz, ADD COLUMN IF NOT EXISTS archived_at timestamptz;
