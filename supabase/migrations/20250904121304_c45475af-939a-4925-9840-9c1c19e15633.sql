-- Create helper functions for team and project management

-- Function to add a team member
CREATE OR REPLACE FUNCTION public.add_team_member(
  p_team_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (p_team_id, p_user_id, p_role)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = now()
  RETURNING to_json(team_members.*) INTO result;
  
  RETURN result;
END;
$$;

-- Function to add a project member
CREATE OR REPLACE FUNCTION public.add_project_member(
  p_project_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'contributor'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_project_id, p_user_id, p_role)
  ON CONFLICT (project_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = now()
  RETURNING to_json(project_members.*) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get user projects
CREATE OR REPLACE FUNCTION public.get_user_projects(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
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
      'updated_at', p.updated_at
    )
  ) INTO result
  FROM public.projects p
  INNER JOIN public.project_members pm ON p.id = pm.project_id
  WHERE pm.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get user teams
CREATE OR REPLACE FUNCTION public.get_user_teams(p_user_id UUID)
RETURNS JSON
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
      'description', t.description,
      'color', t.color,
      'created_at', t.created_at,
      'updated_at', t.updated_at
    )
  ) INTO result
  FROM public.teams t
  INNER JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get team members with profiles
CREATE OR REPLACE FUNCTION public.get_team_members_with_profiles(p_team_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', tm.id,
      'team_id', tm.team_id,
      'user_id', tm.user_id,
      'role', tm.role,
      'joined_at', tm.joined_at,
      'created_at', tm.created_at,
      'user', json_build_object(
        'id', pr.id,
        'email', pr.email,
        'full_name', pr.full_name,
        'display_name', pr.display_name,
        'avatar_url', pr.avatar_url
      )
    )
  ) INTO result
  FROM public.team_members tm
  LEFT JOIN public.profiles pr ON tm.user_id = pr.id
  WHERE tm.team_id = p_team_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;