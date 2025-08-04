-- Add new columns to projects table for enhanced functionality
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'discovery',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_hours INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create project_time_entries table for time tracking
CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  task_name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_activities table for activity timeline
CREATE TABLE IF NOT EXISTS public.project_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'status_change', 'assignment', 'file_upload', 'meeting', 'call', 'email', 'milestone')),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_time_entries
CREATE POLICY "Users can manage time entries for their projects"
ON public.project_time_entries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_time_entries.project_id 
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(projects.members))
  )
);

-- RLS policies for project_activities  
CREATE POLICY "Users can view activities for their projects"
ON public.project_activities
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_activities.project_id 
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(projects.members))
  )
);

CREATE POLICY "Users can create activities for their projects"
ON public.project_activities
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = project_activities.project_id 
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(projects.members))
  )
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_project_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_time_entries_updated_at
  BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_time_entries_updated_at();

-- Add constraints and indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project_id ON public.project_time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_user_id ON public.project_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_created_at ON public.project_time_entries(created_at);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON public.project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_user_id ON public.project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON public.project_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_project_activities_type ON public.project_activities(activity_type);