-- Phase 2: Fix RLS Policies for Team and Project Members (Clean Slate)

-- 1. Enable RLS on tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to start clean
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all team_members policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_members' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.team_members';
    END LOOP;
    
    -- Drop all project_members policies
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'project_members' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.project_members';
    END LOOP;
END $$;

-- 3. Create security definer functions
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_team(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE id = _team_id
      AND owner_id = _user_id
  )
$$;

-- 4. Create RLS policies for team_members
CREATE POLICY "team_members_view_own"
ON public.team_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "team_members_owner_view"
ON public.team_members
FOR SELECT
USING (public.owns_team(team_id, auth.uid()));

CREATE POLICY "team_members_owner_manage"
ON public.team_members
FOR ALL
USING (public.owns_team(team_id, auth.uid()))
WITH CHECK (public.owns_team(team_id, auth.uid()));

-- 5. Create RLS policies for project_members
CREATE POLICY "project_members_view_own"
ON public.project_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "project_members_owner_view"
ON public.project_members
FOR SELECT
USING (public.user_owns_project(project_id, auth.uid()));

CREATE POLICY "project_members_owner_manage"
ON public.project_members
FOR ALL
USING (public.user_owns_project(project_id, auth.uid()))
WITH CHECK (public.user_owns_project(project_id, auth.uid()));

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);