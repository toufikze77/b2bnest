ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_todos_archived_at ON public.todos(archived_at);