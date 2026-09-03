-- =========================================================
-- Helper: do two users share an active organization?
-- =========================================================
CREATE OR REPLACE FUNCTION public.users_share_organization(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m1
    JOIN public.organization_members m2
      ON m1.organization_id = m2.organization_id
    WHERE m1.user_id = _a AND m2.user_id = _b
      AND COALESCE(m1.is_active, true) AND COALESCE(m2.is_active, true)
  );
$$;
REVOKE ALL ON FUNCTION public.users_share_organization(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.users_share_organization(uuid, uuid) TO authenticated, service_role;

-- =========================================================
-- FIX 1 — add_project_member
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_project_member(p_project_id uuid, p_user_id uuid, p_role text DEFAULT 'contributor'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_org_id uuid;
  v_owner uuid;
  result JSON;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT organization_id, user_id INTO v_org_id, v_owner
  FROM public.projects WHERE id = p_project_id;

  IF v_owner IS NULL AND v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Caller must own the project or administer the owning organization
  IF NOT (
    v_owner = v_caller
    OR (v_org_id IS NOT NULL AND public.user_is_organization_admin(v_org_id, v_caller))
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Target user must belong to the same tenant as the project
  IF NOT (
    p_user_id = v_owner
    OR (v_org_id IS NOT NULL AND public.user_is_organization_member(v_org_id, p_user_id))
    OR public.users_share_organization(v_caller, p_user_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized: user does not belong to this company';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (p_project_id, p_user_id, p_role)
  ON CONFLICT (project_id, user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING to_json(project_members.*) INTO result;

  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.add_project_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_project_member(uuid, uuid, text) TO authenticated, service_role;

-- =========================================================
-- FIX 2 — add_team_member
-- =========================================================
CREATE OR REPLACE FUNCTION public.add_team_member(p_team_id uuid, p_user_id uuid, p_role text DEFAULT 'member'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_owner uuid;
  result JSON;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.teams WHERE id = p_team_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_owner <> v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT (p_user_id = v_caller OR public.users_share_organization(v_caller, p_user_id)) THEN
    RAISE EXCEPTION 'Not authorized: user does not belong to this company';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (p_team_id, p_user_id, p_role)
  ON CONFLICT (team_id, user_id)
  DO UPDATE SET role = EXCLUDED.role
  RETURNING to_json(team_members.*) INTO result;

  RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.add_team_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_team_member(uuid, uuid, text) TO authenticated, service_role;

-- =========================================================
-- FIX 3 — unguarded SECURITY DEFINER RPCs
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_user_projects(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  IF auth.uid() IS NULL OR (p_user_id <> auth.uid() AND NOT public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_agg(DISTINCT jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description,
      'status', p.status, 'progress', p.progress, 'deadline', p.deadline,
      'client', p.client, 'color', p.color, 'created_at', p.created_at,
      'updated_at', p.updated_at, 'budget', p.budget,
      'priority', p.priority, 'stage', p.stage))
  INTO result
  FROM public.projects p
  LEFT JOIN public.organization_members om
    ON p.organization_id = om.organization_id AND COALESCE(om.is_active, true)
  LEFT JOIN public.project_members pm ON p.id = pm.project_id
  WHERE om.user_id = p_user_id OR pm.user_id = p_user_id OR p.user_id = p_user_id;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_user_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_projects(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_teams(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result JSON;
BEGIN
  IF auth.uid() IS NULL OR (p_user_id <> auth.uid() AND NOT public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'created_at', t.created_at))
  INTO result
  FROM public.teams t
  INNER JOIN public.team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_user_teams(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_teams(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_team_members_with_profiles(p_team_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  result JSON;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.owns_team(p_team_id, v_caller)
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = v_caller)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_agg(json_build_object(
      'id', tm.id, 'team_id', tm.team_id, 'user_id', tm.user_id,
      'role', tm.role, 'created_at', tm.created_at,
      'user', json_build_object(
        'id', pr.id, 'email', pr.email, 'full_name', pr.full_name,
        'display_name', pr.display_name, 'avatar_url', pr.avatar_url)))
  INTO result
  FROM public.team_members tm
  LEFT JOIN public.profiles pr ON tm.user_id = pr.id
  WHERE tm.team_id = p_team_id;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_team_members_with_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_members_with_profiles(uuid) TO authenticated, service_role;

-- AI credits: only the account owner or the server may deduct
CREATE OR REPLACE FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer DEFAULT 1)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_subscriber RECORD;
  v_result JSON;
BEGIN
  IF NOT (
    auth.uid() = p_user_id
    OR COALESCE(auth.role(), current_user) IN ('service_role', 'postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_credits_to_deduct IS NULL OR p_credits_to_deduct < 1 OR p_credits_to_deduct > 1000 THEN
    RAISE EXCEPTION 'Invalid credit amount';
  END IF;

  SELECT * INTO v_subscriber FROM public.subscribers WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, ai_credits_limit, ai_credits_remaining)
    VALUES (p_user_id, (SELECT email FROM auth.users WHERE id = p_user_id), false, 'free', 10, 10)
    RETURNING * INTO v_subscriber;
  END IF;

  IF v_subscriber.ai_credits_reset_date <= NOW() THEN
    UPDATE public.subscribers
    SET ai_credits_remaining = ai_credits_limit,
        ai_credits_reset_date = NOW() + interval '1 month'
    WHERE user_id = p_user_id
    RETURNING * INTO v_subscriber;
  END IF;

  IF v_subscriber.ai_credits_remaining < p_credits_to_deduct THEN
    RETURN json_build_object(
      'success', false, 'error', 'insufficient_credits',
      'credits_remaining', v_subscriber.ai_credits_remaining,
      'credits_limit', v_subscriber.ai_credits_limit,
      'reset_date', v_subscriber.ai_credits_reset_date,
      'subscription_tier', v_subscriber.subscription_tier);
  END IF;

  UPDATE public.subscribers
  SET ai_credits_remaining = ai_credits_remaining - p_credits_to_deduct
  WHERE user_id = p_user_id
  RETURNING json_build_object(
    'success', true,
    'credits_remaining', ai_credits_remaining,
    'credits_limit', ai_credits_limit,
    'reset_date', ai_credits_reset_date,
    'subscription_tier', subscription_tier) INTO v_result;

  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(uuid, integer) TO authenticated, service_role;

-- Payments: server-side only
CREATE OR REPLACE FUNCTION public.create_payment_record(p_stripe_session_id text, p_customer_email text, p_amount integer, p_item_name text, p_user_id uuid DEFAULT NULL::uuid, p_customer_name text DEFAULT NULL::text, p_company_name text DEFAULT NULL::text, p_contact_number text DEFAULT NULL::text, p_currency text DEFAULT 'gbp'::text, p_payment_method text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    payment_id uuid;
BEGIN
    IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    INSERT INTO public.payments (
        stripe_session_id, user_id, customer_email, customer_name, company_name,
        contact_number, amount, currency, item_name, payment_method, metadata, status)
    VALUES (
        p_stripe_session_id,
        p_user_id,
        public.encrypt_payment_data(p_customer_email),
        CASE WHEN p_customer_name IS NOT NULL THEN public.encrypt_payment_data(p_customer_name) END,
        CASE WHEN p_company_name IS NOT NULL THEN public.encrypt_payment_data(p_company_name) END,
        CASE WHEN p_contact_number IS NOT NULL THEN public.encrypt_payment_data(p_contact_number) END,
        p_amount, p_currency, p_item_name, p_payment_method, p_metadata, 'pending')
    RETURNING id INTO payment_id;

    INSERT INTO public.payment_audit_logs (user_id, payment_id, action, ip_address)
    VALUES (p_user_id, payment_id, 'payment_created', inet_client_addr());

    RETURN payment_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.create_payment_record(text, text, integer, text, uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_record(text, text, integer, text, uuid, text, text, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.update_payment_status(p_status text, p_stripe_session_id text DEFAULT NULL::text, p_stripe_payment_intent_id text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    payment_record RECORD;
BEGIN
    IF COALESCE(auth.role(), current_user) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT * INTO payment_record
    FROM public.payments
    WHERE (p_stripe_session_id IS NOT NULL AND stripe_session_id = p_stripe_session_id)
       OR (p_stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id = p_stripe_payment_intent_id)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    UPDATE public.payments
    SET status = p_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
        metadata = COALESCE(p_metadata, metadata),
        updated_at = now()
    WHERE id = payment_record.id;

    INSERT INTO public.payment_audit_logs (user_id, payment_id, action, ip_address)
    VALUES (payment_record.user_id, payment_record.id, 'status_updated_to_' || p_status, inet_client_addr());

    RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_payment_status(text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_status(text, text, text, text, jsonb) TO service_role;

-- Other caller-controlled reads
REVOKE EXECUTE ON FUNCTION public.preview_user_emissions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_trial_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_team_with_owner(text) FROM anon;

-- =========================================================
-- FIX 4 — decrypt_/encrypt_ helpers: no anon, no authenticated
-- =========================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'decrypt\_%' OR p.proname LIKE 'encrypt\_%')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- admin_* functions must not be callable anonymously
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'admin\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- =========================================================
-- FIX 5 — remove cross-tenant admin/owner policies
-- =========================================================
-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Members can view profiles in their organizations"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.users_share_organization(auth.uid(), id));

-- crm
DROP POLICY IF EXISTS "Admins can view all contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Admins can view all deals" ON public.crm_deals;

-- documents (platform template library + user owned rows)
DROP POLICY IF EXISTS "Only admin/owner can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Only admin/owner can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Only admin/owner can update documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view purchased or owned documents" ON public.documents;

CREATE POLICY "documents_insert_own_or_super_admin"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "documents_update_own_or_super_admin"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "documents_delete_own_or_super_admin"
  ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "documents_select_owned_purchased_or_free"
  ON public.documents FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_super_admin(auth.uid())
    OR COALESCE(price, 0) = 0
    OR EXISTS (
      SELECT 1 FROM public.user_documents ud
      WHERE ud.document_id = documents.id AND ud.user_id = auth.uid()
    )
  );

-- audit tables: platform-level reads only
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all banking audit logs" ON public.banking_audit_logs;
CREATE POLICY "Super admins can view all banking audit logs"
  ON public.banking_audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all integration audit logs" ON public.integration_audit_logs;
CREATE POLICY "Super admins can view all integration audit logs"
  ON public.integration_audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all payment audit logs" ON public.payment_audit_logs;
CREATE POLICY "Super admins can view all payment audit logs"
  ON public.payment_audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_logs;
CREATE POLICY "Super admins can view security audit logs"
  ON public.security_audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- =========================================================
-- FIX 6 — user_roles privilege escalation
-- =========================================================
DROP POLICY IF EXISTS "Owners can insert non-owner roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can update non-owner roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owners can delete non-owner roles" ON public.user_roles;

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins can insert customer roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND role <> 'super_admin'::public.app_role
    AND user_id <> auth.uid()
  );
CREATE POLICY "Super admins can update customer roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid())
  WITH CHECK (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid());
CREATE POLICY "Super admins can delete customer roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) AND role <> 'super_admin'::public.app_role AND user_id <> auth.uid());

-- Hard block: super_admin can never be granted from a client session
CREATE OR REPLACE FUNCTION public.prevent_super_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.role = 'super_admin'::public.app_role
     AND auth.uid() IS NOT NULL
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized: super_admin cannot be assigned through the API';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_escalation ON public.user_roles;
CREATE TRIGGER trg_prevent_super_admin_escalation
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_escalation();
