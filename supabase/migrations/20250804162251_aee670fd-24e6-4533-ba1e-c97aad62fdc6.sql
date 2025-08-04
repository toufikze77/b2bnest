-- Create projects table for project management
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'bg-blue-500',
  progress INTEGER NOT NULL DEFAULT 0,
  members JSONB DEFAULT '[]'::jsonb,
  deadline DATE,
  budget NUMERIC,
  client TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  custom_columns JSONB DEFAULT '[
    {"id": "backlog", "title": "Backlog", "color": "bg-gray-100", "order": 1},
    {"id": "todo", "title": "To Do", "color": "bg-blue-100", "order": 2},
    {"id": "in-progress", "title": "In Progress", "color": "bg-yellow-100", "order": 3},
    {"id": "review", "title": "Review", "color": "bg-purple-100", "order": 4},
    {"id": "done", "title": "Done", "color": "bg-green-100", "order": 5}
  ]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own projects" 
ON public.projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();