-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  organization_id UUID REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create project_members table
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Users can view teams in their organization" 
ON public.teams 
FOR SELECT 
USING (user_is_organization_member(organization_id));

CREATE POLICY "Users can create teams in their organization" 
ON public.teams 
FOR INSERT 
WITH CHECK (user_is_organization_member(organization_id));

CREATE POLICY "Users can update teams in their organization" 
ON public.teams 
FOR UPDATE 
USING (user_is_organization_member(organization_id));

-- RLS policies for projects
CREATE POLICY "Users can view projects in their organization" 
ON public.projects 
FOR SELECT 
USING (user_is_organization_member(organization_id));

CREATE POLICY "Users can create projects in their organization" 
ON public.projects 
FOR INSERT 
WITH CHECK (user_is_organization_member(organization_id));

CREATE POLICY "Users can update projects in their organization" 
ON public.projects 
FOR UPDATE 
USING (user_is_organization_member(organization_id));

-- RLS policies for team_members
CREATE POLICY "Users can view team members in their organization" 
ON public.team_members 
FOR SELECT 
USING (EXISTS(SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND user_is_organization_member(teams.organization_id)));

CREATE POLICY "Users can manage team members in their organization" 
ON public.team_members 
FOR ALL 
USING (EXISTS(SELECT 1 FROM public.teams WHERE teams.id = team_members.team_id AND user_is_organization_member(teams.organization_id)));

-- RLS policies for project_members
CREATE POLICY "Users can view project members in their organization" 
ON public.project_members 
FOR SELECT 
USING (EXISTS(SELECT 1 FROM public.projects WHERE projects.id = project_members.project_id AND user_is_organization_member(projects.organization_id)));

CREATE POLICY "Users can manage project members in their organization" 
ON public.project_members 
FOR ALL 
USING (EXISTS(SELECT 1 FROM public.projects WHERE projects.id = project_members.project_id AND user_is_organization_member(projects.organization_id)));