-- First, check if members column is not already an array and fix it
DO $$
BEGIN
  -- Check if members column exists and is not an array
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' 
    AND table_schema = 'public' 
    AND column_name = 'members' 
    AND data_type != 'ARRAY'
  ) THEN
    -- Convert members column to array if it's not already
    ALTER TABLE public.projects 
    ALTER COLUMN members TYPE TEXT[] USING string_to_array(members, ',');
  END IF;
END $$;

-- Add new columns to projects table for enhanced functionality
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'discovery',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
ADD COLUMN IF NOT EXISTS estimated_hours INTEGER DEFAULT 0 CHECK (estimated_hours >= 0),
ADD COLUMN IF NOT EXISTS actual_hours INTEGER DEFAULT 0 CHECK (actual_hours >= 0),
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
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  is_billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate NUMERIC(10,2) CHECK (hourly_rate >= 0),
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
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(COALESCE(projects.members, ARRAY[]::UUID[])))
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
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(COALESCE(projects.members, ARRAY[]::UUID[])))
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
    AND (projects.user_id = auth.uid() OR auth.uid() = ANY(COALESCE(projects.members, ARRAY[]::UUID[])))
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

DROP TRIGGER IF EXISTS update_project_time_entries_updated_at ON public.project_time_entries;
CREATE TRIGGER update_project_time_entries_updated_at
  BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_time_entries_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project_id ON public.project_time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_user_id ON public.project_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_created_at ON public.project_time_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_activities_project_id ON public.project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_user_id ON public.project_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_created_at ON public.project_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activities_type ON public.project_activities(activity_type);