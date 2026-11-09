-- HMRC P7d fixture (DISPOSABLE local Postgres only): brings the local copy of production in line with what was read
-- on 9 Nov 2026 for the 18 SECURITY DEFINER functions the anon role can execute. The earlier fixtures lack several of
-- these helpers, or have other bodies and grants. Bodies are production's exactly (md5 checked by run-test.sh); the
-- tables they read get the columns they need. Grants are set to production's: owner, service_role, anon and
-- authenticated (and PUBLIC only on _data_rights_gate_is_open). Fictional placeholder columns only; no data.
\set ON_ERROR_STOP 1
BEGIN;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS role text, ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + '7 days'::interval), ADD COLUMN IF NOT EXISTS accepted_at timestamptz, ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE public.trial_email_log ADD COLUMN IF NOT EXISTS unsubscribe_token text;
ALTER TABLE public.email_optouts ADD COLUMN IF NOT EXISTS scope text, ADD COLUMN IF NOT EXISTS source text;
CREATE UNIQUE INDEX IF NOT EXISTS email_optouts_user_scope_fixture ON public.email_optouts (user_id, scope);
ALTER TABLE public.trial_email_outbox ADD COLUMN IF NOT EXISTS status text, ADD COLUMN IF NOT EXISTS last_error text, ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.template_events ADD COLUMN IF NOT EXISTS template_slug text, ADD COLUMN IF NOT EXISTS event_type text;

DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.user_roles\n    WHERE user_id = _user_id\n      AND role = _role\n  )\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $s$ || quote_literal(E'\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.team_members\n    WHERE team_id = _team_id\n      AND user_id = _user_id\n  )\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.owns_team(_team_id uuid, _user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\n  SELECT EXISTS (\n    SELECT 1 FROM public.teams\n    WHERE id = _team_id AND owner_id = _user_id\n  )\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\n  SELECT EXISTS (\n    SELECT 1 \n    FROM public.projects p\n    WHERE p.id = project_id \n      AND p.user_id = check_user_id\n  );\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.organization_members om\n    WHERE om.organization_id = org_id\n      AND om.user_id = check_user_id\n      AND om.role = \'owner\'\n      AND om.is_active = true\n  );\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text) RETURNS TABLE(id uuid, organization_id uuid, email text, role text, expires_at timestamp with time zone, accepted_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $s$ || quote_literal(E'\r\n  SELECT id, organization_id, email, role, expires_at, accepted_at FROM public.organization_invitations\r\n   WHERE p_token IS NOT NULL AND token = p_token AND (expires_at IS NULL OR expires_at > now())\r\n     AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1;\r\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.template_usage_counts() RETURNS TABLE(slug text, views bigint, previews bigint, use_clicks bigint, created_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\n  SELECT\n    e.template_slug AS slug,\n    count(*) FILTER (WHERE e.event_type = \'view\')::bigint,\n    count(*) FILTER (WHERE e.event_type = \'preview\')::bigint,\n    count(*) FILTER (WHERE e.event_type = \'use_click\')::bigint,\n    count(*) FILTER (WHERE e.event_type = \'created\')::bigint\n  FROM public.template_events e\n  GROUP BY e.template_slug\n'); END $do$;
DO $do$ BEGIN EXECUTE $s$CREATE OR REPLACE FUNCTION public.email_unsubscribe(_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $s$ || quote_literal(E'\nDECLARE _uid uuid;\nBEGIN\n  IF _token IS NULL OR _token !~ \'^[0-9a-f]{64}$\' THEN RETURN; END IF;\n  SELECT l.user_id INTO _uid FROM public.trial_email_log l WHERE l.unsubscribe_token = _token;\n  IF _uid IS NULL THEN RETURN; END IF;\n  INSERT INTO public.email_optouts(user_id, scope, source) VALUES (_uid, \'trial_emails\', \'email_link\') ON CONFLICT (user_id, scope) DO NOTHING;\n  UPDATE public.trial_email_outbox SET status = \'cancelled\', last_error = \'no longer eligible: opted_out\', updated_at = now()\n   WHERE user_id = _uid AND status IN (\'pending\', \'failed\');\nEND '); END $do$;

-- Production's grants (read 9 Nov 2026).
DO $do$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.has_role(uuid,public.app_role)', 'public.is_admin_or_owner(uuid)', 'public.is_super_admin(uuid)',
    'public.is_project_member(uuid,uuid)', 'public.is_team_member(uuid,uuid)', 'public.owns_team(uuid,uuid)', 'public.user_can_access_project(uuid,uuid)',
    'public.user_is_organization_admin(uuid,uuid)', 'public.user_is_organization_member(uuid,uuid)', 'public.user_is_organization_owner(uuid,uuid)',
    'public.user_owns_project(uuid,uuid)', 'public.get_invitation_by_token(text)', 'public.email_unsubscribe(text)', 'public.template_usage_counts()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, anon, authenticated', f);
  END LOOP;
END $do$;
COMMIT;
