-- ============================================================================
-- B2BNEST — ORGANISATION OWNERSHIP  WAVE 1  (teams, team_members, projects,
-- todos + todo children)
--
-- STATUS: STAGING VALIDATION PACKAGE — NOT AUTHORIZED FOR PRODUCTION.
--
-- Design source: docs/organization-ownership-migration-design-2026-09.md
-- Properties:
--   * additive / expand-only: no column is dropped, no row is deleted
--   * idempotent: safe to re-run
--   * deterministic backfill only; ambiguous ownership is never guessed
--   * every backfilled value is journalled so the rollback is exact
--   * organizations + organization_members remains the only tenant model
-- Apply as one transaction.
-- ============================================================================
set client_min_messages = warning;

-- ---------------------------------------------------------------------------
-- 0. JOURNAL + RECONCILIATION  (needed by backfill and by rollback)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wave1_backfill_journal (
  id           bigserial PRIMARY KEY,
  table_name   text NOT NULL,
  row_id       uuid NOT NULL,
  old_org_id   uuid,
  new_org_id   uuid NOT NULL,
  method       text NOT NULL,          -- PARENT-DERIVED | SINGLE-MEMBERSHIP-DERIVED | DETERMINISTIC
  applied_at   timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wave1_backfill_journal TO service_role;
GRANT ALL ON SEQUENCE public.wave1_backfill_journal_id_seq TO service_role;
ALTER TABLE public.wave1_backfill_journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave1_journal_service_only ON public.wave1_backfill_journal;
CREATE POLICY wave1_journal_service_only ON public.wave1_backfill_journal
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wave1_unresolved_rows (
  id           bigserial PRIMARY KEY,
  table_name   text NOT NULL,
  row_id       uuid NOT NULL,
  owner_user   uuid,
  parent_id    uuid,
  class        text NOT NULL,          -- AMBIGUOUS | ORPHANED
  reason       text NOT NULL,
  detected_at  timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wave1_unresolved_rows TO service_role;
GRANT ALL ON SEQUENCE public.wave1_unresolved_rows_id_seq TO service_role;
ALTER TABLE public.wave1_unresolved_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave1_unresolved_service_only ON public.wave1_unresolved_rows;
CREATE POLICY wave1_unresolved_service_only ON public.wave1_unresolved_rows
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 1. SCHEMA EXPANSION (additive only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_organization_id_fkey') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_organization_id_fkey') THEN
    -- projects carry financial/statutory linkage: never cascade-delete
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_organization_id_fkey') THEN
    ALTER TABLE public.todos
      ADD CONSTRAINT todos_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- attribution: keep legacy owner_id, add created_by for parity with projects/todos
UPDATE public.teams SET created_by = owner_id WHERE created_by IS NULL;

CREATE INDEX IF NOT EXISTS teams_organization_id_idx        ON public.teams(organization_id);
CREATE INDEX IF NOT EXISTS team_members_team_user_idx       ON public.team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS projects_organization_id_idx     ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS todos_organization_id_idx        ON public.todos(organization_id);
CREATE INDEX IF NOT EXISTS todos_project_id_idx             ON public.todos(project_id);

-- ---------------------------------------------------------------------------
-- 2. DETERMINISTIC BACKFILL  (provable ownership only)
-- ---------------------------------------------------------------------------
-- helper: the single active organisation of a user, or NULL when 0 or >1
CREATE OR REPLACE FUNCTION public.wave1_sole_org(p_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 1 THEN min(om.organization_id) END
  FROM public.organization_members om
  WHERE om.user_id = p_user AND om.is_active = true
$$;
REVOKE ALL ON FUNCTION public.wave1_sole_org(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wave1_sole_org(uuid) TO service_role;

-- 2a. teams -> owner's sole organisation (SINGLE-MEMBERSHIP-DERIVED)
WITH src AS (
  SELECT t.id, public.wave1_sole_org(t.owner_id) AS org
  FROM public.teams t WHERE t.organization_id IS NULL
), upd AS (
  UPDATE public.teams t SET organization_id = s.org
  FROM src s WHERE t.id = s.id AND s.org IS NOT NULL
  RETURNING t.id, t.organization_id
)
INSERT INTO public.wave1_backfill_journal(table_name, row_id, old_org_id, new_org_id, method)
SELECT 'teams', id, NULL, organization_id, 'SINGLE-MEMBERSHIP-DERIVED' FROM upd;

-- 2b. projects -> creator's sole organisation
WITH src AS (
  SELECT p.id, public.wave1_sole_org(p.user_id) AS org
  FROM public.projects p WHERE p.organization_id IS NULL
), upd AS (
  UPDATE public.projects p SET organization_id = s.org
  FROM src s WHERE p.id = s.id AND s.org IS NOT NULL
  RETURNING p.id, p.organization_id
)
INSERT INTO public.wave1_backfill_journal(table_name, row_id, old_org_id, new_org_id, method)
SELECT 'projects', id, NULL, organization_id, 'SINGLE-MEMBERSHIP-DERIVED' FROM upd;

-- 2c. todos -> parent project's organisation (strongest evidence; also repairs
--     todo/project mismatches, which are a data-integrity defect)
WITH upd AS (
  UPDATE public.todos t
  SET organization_id = p.organization_id
  FROM public.projects p
  WHERE t.project_id = p.id
    AND p.organization_id IS NOT NULL
    AND (t.organization_id IS DISTINCT FROM p.organization_id)
  RETURNING t.id, t.organization_id AS new_org,
            (SELECT organization_id FROM public.todos o WHERE o.id = t.id) AS ignored
)
INSERT INTO public.wave1_backfill_journal(table_name, row_id, old_org_id, new_org_id, method)
SELECT 'todos', id, NULL, new_org, 'PARENT-DERIVED' FROM upd;

-- 2d. project-less todos -> creator's sole organisation
WITH src AS (
  SELECT t.id, public.wave1_sole_org(t.user_id) AS org
  FROM public.todos t WHERE t.organization_id IS NULL AND t.project_id IS NULL
), upd AS (
  UPDATE public.todos t SET organization_id = s.org
  FROM src s WHERE t.id = s.id AND s.org IS NOT NULL
  RETURNING t.id, t.organization_id
)
INSERT INTO public.wave1_backfill_journal(table_name, row_id, old_org_id, new_org_id, method)
SELECT 'todos', id, NULL, organization_id, 'SINGLE-MEMBERSHIP-DERIVED' FROM upd;

-- 2e. record everything that is still unresolved. NOTHING is guessed here.
DELETE FROM public.wave1_unresolved_rows;
INSERT INTO public.wave1_unresolved_rows(table_name, row_id, owner_user, parent_id, class, reason)
SELECT 'teams', t.id, t.owner_id, NULL,
       CASE WHEN om.n IS NULL OR om.n = 0 THEN 'ORPHANED' ELSE 'AMBIGUOUS' END,
       CASE WHEN om.n IS NULL OR om.n = 0 THEN 'owner has no active organisation membership'
            ELSE 'owner belongs to '||om.n||' organisations; no parent proves ownership' END
FROM public.teams t
LEFT JOIN (SELECT user_id, count(*) n FROM public.organization_members WHERE is_active GROUP BY 1) om
  ON om.user_id = t.owner_id
WHERE t.organization_id IS NULL;

INSERT INTO public.wave1_unresolved_rows(table_name, row_id, owner_user, parent_id, class, reason)
SELECT 'projects', p.id, p.user_id, NULL,
       CASE WHEN om.n IS NULL OR om.n = 0 THEN 'ORPHANED' ELSE 'AMBIGUOUS' END,
       CASE WHEN om.n IS NULL OR om.n = 0 THEN 'creator has no active organisation membership'
            ELSE 'creator belongs to '||om.n||' organisations; no parent proves ownership' END
FROM public.projects p
LEFT JOIN (SELECT user_id, count(*) n FROM public.organization_members WHERE is_active GROUP BY 1) om
  ON om.user_id = p.user_id
WHERE p.organization_id IS NULL;

INSERT INTO public.wave1_unresolved_rows(table_name, row_id, owner_user, parent_id, class, reason)
SELECT 'todos', t.id, t.user_id, t.project_id,
       CASE WHEN om.n IS NULL OR om.n = 0 THEN 'ORPHANED' ELSE 'AMBIGUOUS' END,
       CASE WHEN t.project_id IS NOT NULL THEN 'parent project has no organisation'
            WHEN om.n IS NULL OR om.n = 0 THEN 'creator has no active organisation membership'
            ELSE 'creator belongs to '||om.n||' organisations; no parent proves ownership' END
FROM public.todos t
LEFT JOIN (SELECT user_id, count(*) n FROM public.organization_members WHERE is_active GROUP BY 1) om
  ON om.user_id = t.user_id
WHERE t.organization_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. DATABASE-SIDE TENANT VALIDATION (never trust a client organization_id)
-- ---------------------------------------------------------------------------
-- Membership is enforced for authenticated callers. service_role (edge
-- functions) and platform super admins are exempt on purpose.
CREATE OR REPLACE FUNCTION public.wave1_enforce_org_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  sole uuid;
BEGIN
  IF TG_TABLE_NAME = 'teams' AND NEW.created_by IS NULL THEN
    NEW.created_by := uid;
  END IF;

  -- trusted server paths
  IF uid IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin(uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL THEN
    sole := public.wave1_sole_org(uid);
    IF sole IS NULL THEN
      -- 0 memberships: legacy personal record is still permitted.
      -- >1 memberships: the caller must send a validated active organisation.
      IF EXISTS (SELECT 1 FROM public.organization_members
                 WHERE user_id = uid AND is_active) THEN
        RAISE EXCEPTION 'ACTIVE_ORGANIZATION_REQUIRED: % rows must carry an explicit organization_id', TG_TABLE_NAME
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;
    NEW.organization_id := sole;
  END IF;

  IF NOT public.user_is_organization_member(NEW.organization_id, uid) THEN
    RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED: caller is not an active member of the target organisation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wave1_enforce_org_membership() FROM PUBLIC;

-- todos always inherit tenancy from their parent project; mismatch is rejected.
CREATE OR REPLACE FUNCTION public.wave1_todo_parent_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p_org uuid;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT organization_id INTO p_org FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = '23503';
  END IF;
  IF p_org IS NULL THEN
    RETURN NEW;                       -- legacy unresolved project: leave as-is
  END IF;
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := p_org;
  ELSIF NEW.organization_id <> p_org THEN
    RAISE EXCEPTION 'CROSS_TENANT_PARENT: todo.organization_id must equal project.organization_id'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.wave1_todo_parent_tenant() FROM PUBLIC;

DROP TRIGGER IF EXISTS wave1_teams_org_guard ON public.teams;
CREATE TRIGGER wave1_teams_org_guard BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.wave1_enforce_org_membership();

DROP TRIGGER IF EXISTS wave1_projects_org_guard ON public.projects;
CREATE TRIGGER wave1_projects_org_guard BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.wave1_enforce_org_membership();

-- parent-derivation runs first, then membership validation
DROP TRIGGER IF EXISTS wave1_todos_parent_guard ON public.todos;
CREATE TRIGGER wave1_todos_parent_guard BEFORE INSERT OR UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.wave1_todo_parent_tenant();

DROP TRIGGER IF EXISTS wave1_todos_org_guard ON public.todos;
CREATE TRIGGER wave1_todos_org_guard BEFORE INSERT OR UPDATE ON public.todos
  FOR EACH ROW EXECUTE FUNCTION public.wave1_enforce_org_membership();

-- ---------------------------------------------------------------------------
-- 4. TENANT-AWARE RLS FOR WAVE 1
-- ---------------------------------------------------------------------------
-- 4a. teams --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view teams they own or belong to" ON public.teams;
DROP POLICY IF EXISTS "Users can create their own teams"          ON public.teams;
DROP POLICY IF EXISTS "Team owners can update their teams"        ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete their teams"        ON public.teams;
DROP POLICY IF EXISTS teams_org_select ON public.teams;
DROP POLICY IF EXISTS teams_org_insert ON public.teams;
DROP POLICY IF EXISTS teams_org_update ON public.teams;
DROP POLICY IF EXISTS teams_org_delete ON public.teams;

CREATE POLICY teams_org_select ON public.teams FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_is_organization_member(organization_id, auth.uid()))
  OR (organization_id IS NULL AND owner_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY teams_org_insert ON public.teams FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid()))
);
CREATE POLICY teams_org_update ON public.teams FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, auth.uid()))
)
WITH CHECK (
  organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid())
);
CREATE POLICY teams_org_delete ON public.teams FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_is_organization_owner(organization_id, auth.uid()))
);

-- 4b. team_members -------------------------------------------------------
DROP POLICY IF EXISTS team_members_owner_manage ON public.team_members;
DROP POLICY IF EXISTS team_members_owner_view   ON public.team_members;
DROP POLICY IF EXISTS team_members_view_own     ON public.team_members;
DROP POLICY IF EXISTS team_members_org_select   ON public.team_members;
DROP POLICY IF EXISTS team_members_org_manage   ON public.team_members;

CREATE POLICY team_members_org_select ON public.team_members FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND (t.owner_id = auth.uid()
           OR (t.organization_id IS NOT NULL
               AND public.user_is_organization_member(t.organization_id, auth.uid())))
  )
);
CREATE POLICY team_members_org_manage ON public.team_members FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND (t.owner_id = auth.uid()
           OR (t.organization_id IS NOT NULL
               AND public.user_is_organization_admin(t.organization_id, auth.uid())))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND (t.owner_id = auth.uid()
           OR (t.organization_id IS NOT NULL
               AND public.user_is_organization_admin(t.organization_id, auth.uid())))
  )
);

-- 4c. projects — collapse the overlapping legacy set into one tenant model
DROP POLICY IF EXISTS "Organization members can manage projects"                       ON public.projects;
DROP POLICY IF EXISTS "Organization members can view projects"                         ON public.projects;
DROP POLICY IF EXISTS "Organization members can create projects"                       ON public.projects;
DROP POLICY IF EXISTS "Users can view projects in their organization"                   ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they own or are organization members of" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects"                             ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they own"                              ON public.projects;
DROP POLICY IF EXISTS "Project owners can update projects"                              ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects they own"                               ON public.projects;
DROP POLICY IF EXISTS projects_org_select ON public.projects;
DROP POLICY IF EXISTS projects_org_insert ON public.projects;
DROP POLICY IF EXISTS projects_org_update ON public.projects;
DROP POLICY IF EXISTS projects_org_delete ON public.projects;

CREATE POLICY projects_org_select ON public.projects FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_is_organization_member(organization_id, auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
  OR public.is_project_member(id, auth.uid())
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY projects_org_insert ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid()))
);
-- creator, org admin/owner, or explicit project member may edit; plain members
-- of the organisation get read access only (BUSINESS DECISION: see report).
CREATE POLICY projects_org_update ON public.projects FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_member(id, auth.uid())
  OR (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, auth.uid()))
)
WITH CHECK (
  organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid())
);
CREATE POLICY projects_org_delete ON public.projects FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_is_organization_owner(organization_id, auth.uid()))
);

-- 4d. todos --------------------------------------------------------------
DROP POLICY IF EXISTS "Organization members can manage todos"        ON public.todos;
DROP POLICY IF EXISTS "Organization members can view todos"          ON public.todos;
DROP POLICY IF EXISTS "Users can manage personal todos"              ON public.todos;
DROP POLICY IF EXISTS "Users can manage todos in their organization"  ON public.todos;
DROP POLICY IF EXISTS todos_org_select ON public.todos;
DROP POLICY IF EXISTS todos_org_insert ON public.todos;
DROP POLICY IF EXISTS todos_org_update ON public.todos;
DROP POLICY IF EXISTS todos_org_delete ON public.todos;

CREATE POLICY todos_org_select ON public.todos FOR SELECT TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_is_organization_member(organization_id, auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);
CREATE POLICY todos_org_insert ON public.todos FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid()))
);
-- work items are collaborative inside one organisation
CREATE POLICY todos_org_update ON public.todos FOR UPDATE TO authenticated
USING (
  (organization_id IS NOT NULL AND public.user_is_organization_member(organization_id, auth.uid()))
  OR (organization_id IS NULL AND user_id = auth.uid())
)
WITH CHECK (
  organization_id IS NULL OR public.user_is_organization_member(organization_id, auth.uid())
);
CREATE POLICY todos_org_delete ON public.todos FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR assigned_to = auth.uid()
  OR (organization_id IS NOT NULL AND public.user_is_organization_admin(organization_id, auth.uid()))
);

-- 4e. todo children follow the parent todo's tenancy --------------------
DROP POLICY IF EXISTS "Users can view subtasks of their todos"    ON public.todo_subtasks;
DROP POLICY IF EXISTS "Users can create subtasks for their todos" ON public.todo_subtasks;
DROP POLICY IF EXISTS "Users can update subtasks of their todos"  ON public.todo_subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks of their todos"  ON public.todo_subtasks;
DROP POLICY IF EXISTS todo_subtasks_org_all ON public.todo_subtasks;

CREATE POLICY todo_subtasks_org_all ON public.todo_subtasks FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.todos t WHERE t.id = todo_subtasks.todo_id
          AND ((t.organization_id IS NOT NULL
                AND public.user_is_organization_member(t.organization_id, auth.uid()))
               OR (t.organization_id IS NULL AND t.user_id = auth.uid())))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.todos t WHERE t.id = todo_subtasks.todo_id
          AND ((t.organization_id IS NOT NULL
                AND public.user_is_organization_member(t.organization_id, auth.uid()))
               OR (t.organization_id IS NULL AND t.user_id = auth.uid())))
);

DROP POLICY IF EXISTS "Users can view comments on their todos"     ON public.todo_comments;
DROP POLICY IF EXISTS "Users can create comments on their todos"   ON public.todo_comments;
DROP POLICY IF EXISTS "Users can delete their own comments"        ON public.todo_comments;
DROP POLICY IF EXISTS todo_comments_org_select ON public.todo_comments;
DROP POLICY IF EXISTS todo_comments_org_insert ON public.todo_comments;
DROP POLICY IF EXISTS todo_comments_own_delete ON public.todo_comments;

CREATE POLICY todo_comments_org_select ON public.todo_comments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.todos t WHERE t.id = todo_comments.todo_id
          AND ((t.organization_id IS NOT NULL
                AND public.user_is_organization_member(t.organization_id, auth.uid()))
               OR (t.organization_id IS NULL AND t.user_id = auth.uid())))
);
CREATE POLICY todo_comments_org_insert ON public.todo_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.todos t WHERE t.id = todo_comments.todo_id
              AND ((t.organization_id IS NOT NULL
                    AND public.user_is_organization_member(t.organization_id, auth.uid()))
                   OR (t.organization_id IS NULL AND t.user_id = auth.uid())))
);
CREATE POLICY todo_comments_own_delete ON public.todo_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. LEAST-PRIVILEGE GRANTS FOR WAVE 1 TABLES
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.teams, public.team_members FROM anon;
REVOKE ALL ON public.projects, public.todos, public.todo_subtasks, public.todo_comments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams, public.team_members,
      public.projects, public.todos, public.todo_subtasks, public.todo_comments TO authenticated;
GRANT ALL ON public.teams, public.team_members, public.projects, public.todos,
      public.todo_subtasks, public.todo_comments TO service_role;

-- ---------------------------------------------------------------------------
-- 6. ACTIVE-ORGANISATION SUPPORT (validated server-side; no new table)
-- ---------------------------------------------------------------------------
-- The client may remember a selection, but the database is the authority.
CREATE OR REPLACE FUNCTION public.resolve_active_organization(p_requested uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); result uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_requested IS NOT NULL
     AND public.user_is_organization_member(p_requested, uid) THEN
    RETURN p_requested;                       -- membership proven
  END IF;
  SELECT om.organization_id INTO result
  FROM public.organization_members om
  WHERE om.user_id = uid AND om.is_active = true
  ORDER BY (om.role = 'owner') DESC, om.created_at ASC
  LIMIT 1;                                     -- deterministic fallback
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.resolve_active_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_active_organization(uuid) TO authenticated, service_role;

-- ============================================================================
-- END WAVE 1
-- ============================================================================
