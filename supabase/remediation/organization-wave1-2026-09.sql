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
-- Every object this package actually creates is recorded, so the rollback can
-- remove ONLY Wave 1 additions and never a pre-existing constraint or index.
CREATE TABLE IF NOT EXISTS public.wave1_created_objects (
  object_kind text NOT NULL,          -- COLUMN | CONSTRAINT | INDEX
  object_name text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (object_kind, object_name)
);
GRANT ALL ON public.wave1_created_objects TO service_role;
ALTER TABLE public.wave1_created_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wave1_created_objects_service_only ON public.wave1_created_objects;
CREATE POLICY wave1_created_objects_service_only ON public.wave1_created_objects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
DECLARE
  had_org_col boolean := EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='organization_id');
  had_cb_col  boolean := EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='created_by');
  r record;
BEGIN
  ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS organization_id uuid;
  ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_by uuid;
  IF NOT had_org_col THEN
    INSERT INTO public.wave1_created_objects(object_kind, object_name)
    VALUES ('COLUMN','teams.organization_id') ON CONFLICT DO NOTHING;
  END IF;
  IF NOT had_cb_col THEN
    INSERT INTO public.wave1_created_objects(object_kind, object_name)
    VALUES ('COLUMN','teams.created_by') ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_organization_id_fkey') THEN
    ALTER TABLE public.teams
      ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE CASCADE;
    INSERT INTO public.wave1_created_objects(object_kind, object_name)
    VALUES ('CONSTRAINT','teams.teams_organization_id_fkey') ON CONFLICT DO NOTHING;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_organization_id_fkey') THEN
    -- projects carry financial/statutory linkage: never cascade-delete
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE RESTRICT;
    INSERT INTO public.wave1_created_objects(object_kind, object_name)
    VALUES ('CONSTRAINT','projects.projects_organization_id_fkey') ON CONFLICT DO NOTHING;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_organization_id_fkey') THEN
    ALTER TABLE public.todos
      ADD CONSTRAINT todos_organization_id_fkey FOREIGN KEY (organization_id)
      REFERENCES public.organizations(id) ON DELETE CASCADE;
    INSERT INTO public.wave1_created_objects(object_kind, object_name)
    VALUES ('CONSTRAINT','todos.todos_organization_id_fkey') ON CONFLICT DO NOTHING;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('teams_organization_id_idx',    'CREATE INDEX teams_organization_id_idx ON public.teams(organization_id)'),
      ('team_members_team_user_idx',   'CREATE INDEX team_members_team_user_idx ON public.team_members(team_id, user_id)'),
      ('projects_organization_id_idx', 'CREATE INDEX projects_organization_id_idx ON public.projects(organization_id)'),
      ('todos_organization_id_idx',    'CREATE INDEX todos_organization_id_idx ON public.todos(organization_id)'),
      ('todos_project_id_idx',         'CREATE INDEX todos_project_id_idx ON public.todos(project_id)')
    ) AS v(idx, ddl)
  LOOP
    IF to_regclass('public.'||r.idx) IS NULL THEN
      EXECUTE r.ddl;
      INSERT INTO public.wave1_created_objects(object_kind, object_name)
      VALUES ('INDEX', r.idx) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- attribution: keep legacy owner_id, add created_by for parity with projects/todos
UPDATE public.teams SET created_by = owner_id WHERE created_by IS NULL;


-- ---------------------------------------------------------------------------
-- 2. DETERMINISTIC BACKFILL  (provable ownership only)
-- ---------------------------------------------------------------------------
-- helper: the single active organisation of a user, or NULL when 0 or >1
CREATE OR REPLACE FUNCTION public.wave1_sole_org(p_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN count(*) = 1 THEN (array_agg(om.organization_id))[1] END
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

-- 2c. todos -> parent project's organisation (strongest evidence).
--     ONLY rows whose organisation is still NULL are written. A todo that
--     already carries a DIFFERENT organisation than its parent project is a
--     data-integrity defect and is reported for manual reconciliation instead
--     of being silently rewritten (an unjournalled overwrite is not reversible).
WITH upd AS (
  UPDATE public.todos t
  SET organization_id = p.organization_id
  FROM public.projects p
  WHERE t.project_id = p.id
    AND p.organization_id IS NOT NULL
    AND t.organization_id IS NULL
  RETURNING t.id, t.organization_id AS new_org
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

-- 2f. report (never rewrite) todos whose organisation contradicts their parent
INSERT INTO public.wave1_unresolved_rows(table_name, row_id, owner_user, parent_id, class, reason)
SELECT 'todos', t.id, t.user_id, t.project_id, 'MISMATCH',
       'todo.organization_id differs from parent project.organization_id; manual reconciliation required'
FROM public.todos t
JOIN public.projects p ON p.id = t.project_id
WHERE t.organization_id IS NOT NULL
  AND p.organization_id IS NOT NULL
  AND t.organization_id <> p.organization_id;



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
  IF TG_TABLE_NAME = 'teams' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := uid;
    END IF;
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
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_requested IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_ORGANIZATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_is_organization_member(p_requested, uid) THEN
    RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  RETURN p_requested;                         -- explicit membership proven
END $$;
REVOKE ALL ON FUNCTION public.resolve_active_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_active_organization(uuid) TO authenticated, service_role;

-- ============================================================================
-- END WAVE 1
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7. HISTORICAL PROJECT RECONCILIATION (explicit, owner-driven, no guessing)
-- ---------------------------------------------------------------------------
-- Wave 1 never infers the company of a historical project. These two functions
-- are the ONLY supported way to resolve them: the authenticated owner sees only
-- their own unresolved projects and explicitly names one of the companies they
-- are an active member of. Child tasks inherit strictly from the parent, and an
-- existing child company is never silently overwritten.

CREATE OR REPLACE FUNCTION public.wave1_list_reconcilable_projects()
RETURNS TABLE(project_id uuid, project_name text, task_count bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name,
         (SELECT count(*) FROM public.todos t WHERE t.project_id = p.id),
         p.created_at
  FROM public.projects p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id = auth.uid()
    AND p.organization_id IS NULL
  ORDER BY p.created_at;
$$;
REVOKE ALL ON FUNCTION public.wave1_list_reconcilable_projects() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wave1_list_reconcilable_projects() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wave1_reconcile_project(p_project_id uuid, p_organization_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_owner uuid;
  v_org uuid;
  v_conflicts int;
  v_tasks int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_project_id IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_AND_ORGANIZATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT user_id, organization_id INTO v_owner, v_org
  FROM public.projects WHERE id = p_project_id FOR UPDATE;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'PROJECT_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF v_owner <> uid THEN
    RAISE EXCEPTION 'PROJECT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_org IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ALREADY_RECONCILED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_organization_id) THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_is_organization_member(p_organization_id, uid) THEN
    RAISE EXCEPTION 'ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- Pre-flight correction 1: never silently overwrite an existing child company.
  SELECT count(*) INTO v_conflicts FROM public.todos
  WHERE project_id = p_project_id
    AND organization_id IS NOT NULL
    AND organization_id <> p_organization_id;
  IF v_conflicts > 0 THEN
    RAISE EXCEPTION 'CHILD_ORGANIZATION_CONFLICT: % task(s) already belong to another company', v_conflicts
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects SET organization_id = p_organization_id
  WHERE id = p_project_id AND organization_id IS NULL;

  UPDATE public.todos SET organization_id = p_organization_id
  WHERE project_id = p_project_id AND organization_id IS NULL;
  GET DIAGNOSTICS v_tasks = ROW_COUNT;

  BEGIN
    INSERT INTO public.audit_logs(user_id, action, resource_type, resource_id, details)
    VALUES (uid, 'wave1_reconcile_project', 'projects', p_project_id::text,
            jsonb_build_object('organization_id', p_organization_id, 'tasks_assigned', v_tasks));
  EXCEPTION WHEN others THEN
    NULL;  -- audit is best-effort; it must never block a legitimate reconciliation
  END;

  RETURN jsonb_build_object('project_id', p_project_id,
                            'organization_id', p_organization_id,
                            'tasks_assigned', v_tasks);
END $$;
REVOKE ALL ON FUNCTION public.wave1_reconcile_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wave1_reconcile_project(uuid, uuid) TO authenticated, service_role;
