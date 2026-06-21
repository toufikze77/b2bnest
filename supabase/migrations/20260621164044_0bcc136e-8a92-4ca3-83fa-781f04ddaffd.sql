
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects(deleted_at);

CREATE TABLE IF NOT EXISTS public.project_share_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  share_method TEXT NOT NULL CHECK (share_method IN ('in_platform','email')),
  recipient_user_id UUID,
  recipient_email TEXT,
  message TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.project_share_logs TO authenticated;
GRANT ALL ON public.project_share_logs TO service_role;

ALTER TABLE public.project_share_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view share logs for their projects"
ON public.project_share_logs FOR SELECT
TO authenticated
USING (
  shared_by = auth.uid()
  OR recipient_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid())
);

CREATE POLICY "Users can insert their own share logs"
ON public.project_share_logs FOR INSERT
TO authenticated
WITH CHECK (shared_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_project_share_logs_project ON public.project_share_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_share_logs_shared_by ON public.project_share_logs(shared_by);
