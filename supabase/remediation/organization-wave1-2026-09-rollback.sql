-- ============================================================================
-- B2BNEST — ORGANISATION OWNERSHIP WAVE 1 — ROLLBACK
--
-- Restores the pre-Wave-1 state exactly:
--   * removes Wave 1 triggers, guard functions and helper functions
--   * restores the original teams / team_members / projects / todos /
--     todo_subtasks / todo_comments policies and grants
--   * reverts ONLY the organisation values this package wrote, using the
--     journal (no other row is touched, nothing is deleted)
--   * drops the columns Wave 1 added to teams
-- No business row is ever deleted.
-- Apply as one transaction.
-- ============================================================================
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- 1. Remove tenant guards first (so the reverts below are not blocked)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS wave1_teams_org_guard    ON public.teams;
DROP TRIGGER IF EXISTS wave1_projects_org_guard ON public.projects;
DROP TRIGGER IF EXISTS wave1_todos_parent_guard ON public.todos;
DROP TRIGGER IF EXISTS wave1_todos_org_guard    ON public.todos;
DROP FUNCTION IF EXISTS public.wave1_enforce_org_membership();
DROP FUNCTION IF EXISTS public.wave1_todo_parent_tenant();

-- ---------------------------------------------------------------------------
-- 2. Revert journalled backfill values only
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF to_regclass('public.wave1_backfill_journal') IS NOT NULL THEN
    UPDATE public.projects p SET organization_id = j.old_org_id
      FROM public.wave1_backfill_journal j
     WHERE j.table_name = 'projects' AND j.row_id = p.id
       AND p.organization_id = j.new_org_id;
    UPDATE public.todos t SET organization_id = j.old_org_id
      FROM public.wave1_backfill_journal j
     WHERE j.table_name = 'todos' AND j.row_id = t.id
       AND t.organization_id = j.new_org_id;
    -- teams.organization_id disappears with the column drop below
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Restore original RLS policies
-- ---------------------------------------------------------------------------
-- teams
DROP POLICY IF EXISTS teams_org_select ON public.teams;
DROP POLICY IF EXISTS teams_org_insert ON public.teams;
DROP POLICY IF EXISTS teams_org_update ON public.teams;
DROP POLICY IF EXISTS teams_org_delete ON public.teams;
CREATE POLICY "Users can view teams they own or belong to" ON public.teams FOR SELECT
  USING ((owner_id = auth.uid()) OR (id IN (SELECT team_members.team_id FROM public.team_members WHERE team_members.user_id = auth.uid())));
CREATE POLICY "Users can create their own teams" ON public.teams FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Team owners can update their teams" ON public.teams FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "Team owners can delete their teams" ON public.teams FOR DELETE
  USING (owner_id = auth.uid());

-- team_members
DROP POLICY IF EXISTS team_members_org_select ON public.team_members;
DROP POLICY IF EXISTS team_members_org_manage ON public.team_members;
CREATE POLICY team_members_owner_manage ON public.team_members FOR ALL
  USING (public.owns_team(team_id, auth.uid())) WITH CHECK (public.owns_team(team_id, auth.uid()));
CREATE POLICY team_members_owner_view ON public.team_members FOR SELECT
  USING (public.owns_team(team_id, auth.uid()));
CREATE POLICY team_members_view_own ON public.team_members FOR SELECT
  USING (auth.uid() = user_id);

-- projects
DROP POLICY IF EXISTS projects_org_select ON public.projects;
DROP POLICY IF EXISTS projects_org_insert ON public.projects;
DROP POLICY IF EXISTS projects_org_update ON public.projects;
DROP POLICY IF EXISTS projects_org_delete ON public.projects;
CREATE POLICY "Organization members can manage projects" ON public.projects FOR ALL
  USING (public.user_is_organization_member(organization_id))
  WITH CHECK (public.user_is_organization_member(organization_id));
CREATE POLICY "Organization members can view projects" ON public.projects FOR SELECT
  USING (public.user_is_organization_member(organization_id));
CREATE POLICY "Organization members can create projects" ON public.projects FOR INSERT
  WITH CHECK ((organization_id IS NOT NULL) AND public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Users can view projects in their organization" ON public.projects FOR SELECT
  USING ((user_id = auth.uid())
      OR (organization_id IN (SELECT organization_members.organization_id FROM public.organization_members
                              WHERE organization_members.user_id = auth.uid() AND organization_members.is_active = true))
      OR (id IN (SELECT project_members.project_id FROM public.project_members WHERE project_members.user_id = auth.uid())));
CREATE POLICY "Users can view projects they own or are organization members of" ON public.projects FOR SELECT
  USING (public.user_can_access_project(id));
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can update projects they own" ON public.projects FOR UPDATE
  USING (public.user_owns_project(id, auth.uid()))
  WITH CHECK ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Project owners can update projects" ON public.projects FOR UPDATE
  USING ((user_id = auth.uid()) OR ((organization_id IS NOT NULL) AND public.user_is_organization_admin(organization_id, auth.uid())))
  WITH CHECK ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid()));
CREATE POLICY "Users can delete projects they own" ON public.projects FOR DELETE
  USING (public.user_owns_project(id));

-- todos
DROP POLICY IF EXISTS todos_org_select ON public.todos;
DROP POLICY IF EXISTS todos_org_insert ON public.todos;
DROP POLICY IF EXISTS todos_org_update ON public.todos;
DROP POLICY IF EXISTS todos_org_delete ON public.todos;
CREATE POLICY "Organization members can manage todos" ON public.todos FOR ALL
  USING (public.user_is_organization_member(organization_id))
  WITH CHECK (public.user_is_organization_member(organization_id));
CREATE POLICY "Organization members can view todos" ON public.todos FOR SELECT
  USING (public.user_is_organization_member(organization_id));
CREATE POLICY "Users can manage personal todos" ON public.todos FOR ALL
  USING ((organization_id IS NULL) AND (auth.uid() = user_id))
  WITH CHECK ((organization_id IS NULL) AND (auth.uid() = user_id));
CREATE POLICY "Users can manage todos in their organization" ON public.todos FOR ALL
  USING (organization_id IN (SELECT om.organization_id FROM public.organization_members om
                             WHERE om.user_id = auth.uid() AND om.is_active = true));

-- todo children
DROP POLICY IF EXISTS todo_subtasks_org_all ON public.todo_subtasks;
CREATE POLICY "Users can view subtasks of their todos" ON public.todo_subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_subtasks.todo_id AND todos.user_id = auth.uid()));
CREATE POLICY "Users can create subtasks for their todos" ON public.todo_subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_subtasks.todo_id AND todos.user_id = auth.uid()));
CREATE POLICY "Users can update subtasks of their todos" ON public.todo_subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_subtasks.todo_id AND todos.user_id = auth.uid()));
CREATE POLICY "Users can delete subtasks of their todos" ON public.todo_subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_subtasks.todo_id AND todos.user_id = auth.uid()));

DROP POLICY IF EXISTS todo_comments_org_select ON public.todo_comments;
DROP POLICY IF EXISTS todo_comments_org_insert ON public.todo_comments;
DROP POLICY IF EXISTS todo_comments_own_delete ON public.todo_comments;
CREATE POLICY "Users can view comments on their todos" ON public.todo_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_comments.todo_id
                 AND (todos.user_id = auth.uid() OR todos.assigned_to = auth.uid())));
CREATE POLICY "Users can create comments on their todos" ON public.todo_comments FOR INSERT
  WITH CHECK ((auth.uid() = user_id) AND EXISTS (SELECT 1 FROM public.todos WHERE todos.id = todo_comments.todo_id
                 AND (todos.user_id = auth.uid() OR todos.assigned_to = auth.uid())));
CREATE POLICY "Users can delete their own comments" ON public.todo_comments FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Restore pre-Wave-1 grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.teams, public.team_members TO anon;

-- ---------------------------------------------------------------------------
-- 5. Drop Wave 1 schema additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_organization_id_fkey;
DROP INDEX IF EXISTS public.teams_organization_id_idx;
ALTER TABLE public.teams DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.teams DROP COLUMN IF EXISTS created_by;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_organization_id_fkey;
ALTER TABLE public.todos    DROP CONSTRAINT IF EXISTS todos_organization_id_fkey;
DROP INDEX IF EXISTS public.projects_organization_id_idx;
DROP INDEX IF EXISTS public.todos_organization_id_idx;
DROP INDEX IF EXISTS public.todos_project_id_idx;
DROP INDEX IF EXISTS public.team_members_team_user_idx;

DROP FUNCTION IF EXISTS public.resolve_active_organization(uuid);
DROP FUNCTION IF EXISTS public.wave1_sole_org(uuid);
DROP TABLE IF EXISTS public.wave1_backfill_journal;
DROP TABLE IF EXISTS public.wave1_unresolved_rows;

-- ============================================================================
-- END WAVE 1 ROLLBACK
-- ============================================================================
