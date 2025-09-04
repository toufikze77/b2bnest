-- Enable RLS on tables that are missing it
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Fix the get_user_teams function to match actual table schema
CREATE OR REPLACE FUNCTION public.get_user_teams(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'name', t.name,
      'created_at', t.created_at
    )
  ) INTO result
  FROM public.teams t
  INNER JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Fix the get_user_projects function to work with organization_members
CREATE OR REPLACE FUNCTION public.get_user_projects(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Get projects where user is organization member OR direct project member
  SELECT json_agg(
    json_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'status', p.status,
      'progress', p.progress,
      'deadline', p.deadline,
      'client', p.client,
      'color', p.color,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'budget', p.budget,
      'priority', p.priority,
      'stage', p.stage
    )
  ) INTO result
  FROM public.projects p
  LEFT JOIN public.organization_members om ON p.organization_id = om.organization_id
  LEFT JOIN public.project_members pm ON p.id = pm.project_id
  WHERE om.user_id = p_user_id OR pm.user_id = p_user_id OR p.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Create RLS policies for projects
CREATE POLICY "Users can view projects in their organization" ON public.projects
FOR SELECT USING (
  user_id = auth.uid() OR
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_active = true
  ) OR
  id IN (
    SELECT project_id FROM public.project_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can create projects" ON public.projects
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Project owners can update projects" ON public.projects
FOR UPDATE USING (
  user_id = auth.uid() OR
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  )
);

-- Create RLS policies for teams
CREATE POLICY "Users can view teams they own or belong to" ON public.teams
FOR SELECT USING (
  owner_id = auth.uid() OR
  id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own teams" ON public.teams
FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Team owners can update their teams" ON public.teams
FOR UPDATE USING (owner_id = auth.uid());

-- Create RLS policies for team_members
CREATE POLICY "Users can view team members of teams they belong to" ON public.team_members
FOR SELECT USING (
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
  ) OR
  team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Team owners can manage team members" ON public.team_members
FOR ALL USING (
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
  )
);

-- Create RLS policies for project_members
CREATE POLICY "Users can view project members of projects they have access to" ON public.project_members
FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  ) OR
  project_id IN (
    SELECT p.id FROM public.projects p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid() AND om.is_active = true
  ) OR
  user_id = auth.uid()
);

CREATE POLICY "Project owners can manage project members" ON public.project_members
FOR ALL USING (
  project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  ) OR
  project_id IN (
    SELECT p.id FROM public.projects p
    JOIN public.organization_members om ON p.organization_id = om.organization_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.is_active = true
  )
);