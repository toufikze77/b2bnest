
-- 1. HMRC integrations: protect tokens
REVOKE SELECT (access_token, refresh_token) ON public.hmrc_integrations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_hmrc_tokens(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(access_token text, refresh_token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR (p_user_id <> auth.uid() AND NOT public.is_admin_or_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
    SELECT h.access_token, h.refresh_token, h.expires_at
    FROM public.hmrc_integrations h
    WHERE h.user_id = p_user_id AND h.is_connected = true;
END;
$$;

-- 2. HMRC settings: protect client_secret
REVOKE SELECT (client_secret) ON public.hmrc_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_hmrc_client_secret(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF p_user_id IS NULL OR (p_user_id <> auth.uid() AND NOT public.is_admin_or_owner(auth.uid())) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT client_secret INTO v_secret
    FROM public.hmrc_settings
    WHERE user_id = p_user_id
    LIMIT 1;
  RETURN v_secret;
END;
$$;

-- 3. payment_notifications: drop always-true policy
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.payment_notifications;

CREATE POLICY "Service role manages notifications"
ON public.payment_notifications
AS PERMISSIVE FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view notifications"
ON public.payment_notifications
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- 4. project_activities: expand to organization members & project members
DROP POLICY IF EXISTS "Users can view activities for their projects" ON public.project_activities;
DROP POLICY IF EXISTS "Users can create activities for their projects" ON public.project_activities;

CREATE POLICY "Users can view project activities"
ON public.project_activities
FOR SELECT
TO authenticated
USING (public.user_can_access_project(project_id, auth.uid()));

CREATE POLICY "Users can create project activities"
ON public.project_activities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.user_can_access_project(project_id, auth.uid()));

-- 5. project_time_entries: add owner fallback policy
CREATE POLICY "Project owners can manage their time entries"
ON public.project_time_entries
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_time_entries.project_id AND p.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_time_entries.project_id AND p.user_id = auth.uid())
);

-- 6. todos: fallback when organization_id IS NULL
CREATE POLICY "Users can manage personal todos"
ON public.todos
FOR ALL
TO authenticated
USING (organization_id IS NULL AND auth.uid() = user_id)
WITH CHECK (organization_id IS NULL AND auth.uid() = user_id);

-- 7. organization_invitations: lookup by token
CREATE POLICY "Invitees can look up by token"
ON public.organization_invitations
FOR SELECT
TO anon, authenticated
USING (token = current_setting('app.invitation_token', true));
