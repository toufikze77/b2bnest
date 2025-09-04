-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  progress INTEGER DEFAULT 0,
  deadline DATE,
  client TEXT,
  color TEXT DEFAULT '#10B981',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create project_members table
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  invited_by UUID,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teams
CREATE POLICY "Organization members can view teams" 
ON public.teams 
FOR SELECT 
USING (user_is_organization_member(organization_id));

CREATE POLICY "Organization admins can manage teams" 
ON public.teams 
FOR ALL 
USING (user_is_organization_admin(organization_id))
WITH CHECK (user_is_organization_admin(organization_id));

-- Create RLS policies for projects
CREATE POLICY "Organization members can view projects" 
ON public.projects 
FOR SELECT 
USING (user_is_organization_member(organization_id));

CREATE POLICY "Organization admins can manage projects" 
ON public.projects 
FOR ALL 
USING (user_is_organization_admin(organization_id))
WITH CHECK (user_is_organization_admin(organization_id));

-- Create RLS policies for team_members
CREATE POLICY "Team members can view team membership" 
ON public.team_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND user_is_organization_member(t.organization_id)
));

CREATE POLICY "Organization admins can manage team members" 
ON public.team_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND user_is_organization_admin(t.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teams t 
  WHERE t.id = team_members.team_id 
  AND user_is_organization_admin(t.organization_id)
));

-- Create RLS policies for project_members
CREATE POLICY "Project members can view project membership" 
ON public.project_members 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_members.project_id 
  AND user_is_organization_member(p.organization_id)
));

CREATE POLICY "Organization admins can manage project members" 
ON public.project_members 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_members.project_id 
  AND user_is_organization_admin(p.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_members.project_id 
  AND user_is_organization_admin(p.organization_id)
));

-- Create triggers for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX idx_projects_organization_id ON public.projects(organization_id);
CREATE INDEX idx_projects_team_id ON public.projects(team_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);