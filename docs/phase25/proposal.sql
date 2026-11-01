-- =====================================================================================================================
-- Phase 25: two-step sign-in enforced in the database (PREPARED, NOT APPLIED).
--
-- !!! ORDER IS MANDATORY. Apply this ONLY AFTER (1) TOTP is enabled in the Supabase dashboard (Authentication → Sign In /
-- !!! Providers → Multi-Factor: TOTP "Enroll and verify" on) AND (2) the Phase 25 frontend is merged and published.
-- !!! If this runs while the old frontend is live, anyone who has set up an authenticator app is locked out of their data
-- !!! (every read returns nothing / MFA_REQUIRED) with NO screen to enter their code. Today 0 accounts have a factor
-- !!! (read 1 Nov 2026), so the window is small, but the order still matters.
--
-- What it does (one transaction; any guard failure changes nothing):
--   1. public.security_settings: one row, admin_requires_aal2 = true (Admin RPCs need aal2 for super admins). Owner-only.
--   2. public.mfa_ok(): true at aal2, or when the caller has NO verified factor, or on a server path (service_role,
--      postgres, supabase_admin: the same rule as public.assert_self). public.require_aal2_if_enrolled() and
--      public.require_aal2_admin() raise SQLSTATE 42501 'MFA_REQUIRED'.
--   3. A RESTRICTIVE policy "require_aal2_if_enrolled" (TO authenticated only; anon is untouched) on 98 tables listed
--      explicitly below. Future tables are NOT covered automatically: add them here on purpose.
--   4. 66 SECURITY DEFINER functions executable by signed-in users get one guard line at the top of their body
--      (44 user-data functions: require_aal2_if_enrolled; 22 admin functions: require_aal2_admin). Each is
--      refused unless its live body hash still equals the one read on 1 Nov 2026. Nothing else in the bodies changes.
--   5. Refuses to finish if any SECURITY DEFINER function executable by `authenticated` is neither guarded nor in the
--      reviewed exclusion list (so a function added after this review is never silently left open).
-- Rollback: docs/phase25/rollback.sql. Tests: docs/phase25/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.mfa_ok()') IS NOT NULL OR to_regclass('public.security_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 25 already exists (applied twice?)';
  END IF;
  IF to_regclass('auth.mfa_factors') IS NULL THEN RAISE EXCEPTION 'auth.mfa_factors is missing: is this a Supabase database?'; END IF;
  IF to_regprocedure('public.is_super_admin(uuid)') IS NULL THEN RAISE EXCEPTION 'public.is_super_admin is missing'; END IF;
END $$;

-- 1. Owner switch (SQL editor only): UPDATE public.security_settings SET admin_requires_aal2 = false, updated_at = now();
CREATE TABLE public.security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  admin_requires_aal2 boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.security_settings (id, admin_requires_aal2) VALUES (true, true);
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.security_settings TO service_role;

-- Record of what step 4 changed (used by rollback.sql to restore every body exactly). Service role only.
CREATE TABLE public.phase25_mfa_guard_log (
  fn text PRIMARY KEY, kind text NOT NULL, old_md5 text NOT NULL, new_md5 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phase25_mfa_guard_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phase25_mfa_guard_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.phase25_mfa_guard_log TO service_role;

-- 2. The checks.
CREATE FUNCTION public.mfa_ok()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- server/service paths keep working (same rule as public.assert_self)
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return true;
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') = 'aal2' then
    return true;
  end if;
  if auth.uid() is null then
    return true; -- no user, nothing enrolled: the table's own policies decide
  end if;
  return not exists (
    select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified'
  );
end;
$function$;
REVOKE ALL ON FUNCTION public.mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_ok() TO authenticated, service_role;

CREATE FUNCTION public.require_aal2_if_enrolled()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.mfa_ok() then
    raise exception 'MFA_REQUIRED' using errcode = '42501', hint = 'Enter the 6-digit code from your authenticator app.';
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.require_aal2_if_enrolled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_aal2_if_enrolled() TO authenticated, service_role;

CREATE FUNCTION public.require_aal2_admin()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_aal2_if_enrolled();
  if coalesce(auth.role(), current_user) in ('service_role','postgres','supabase_admin') then
    return;
  end if;
  -- Super admins need aal2 for Admin even before they have set up an app (the frontend sends them to set one up).
  if public.is_super_admin(auth.uid())
     and coalesce((select s.admin_requires_aal2 from public.security_settings s where s.id), true)
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501', hint = 'Admin needs two-step sign-in.';
  end if;
end;
$function$;
REVOKE ALL ON FUNCTION public.require_aal2_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_aal2_admin() TO authenticated, service_role;

-- 3. Restrictive policies (98 tables; excluded tables and reasons are in docs/phase25/README.md).
CREATE POLICY require_aal2_if_enrolled ON public.admin_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.advertisements AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_conversations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_workflows AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ai_workspaces AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.b2b_form_submissions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.bank_accounts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.bank_transactions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.banking_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.bills AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.business_insights AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.companies AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.connections AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.crm_contacts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.crm_deals AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.document_email_log AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.documents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.expenses AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.feedback_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_integrations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_submission_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.integration_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.integration_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.invoices AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.marketing_audiences AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.marketing_campaigns AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.marketing_content_items AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.note_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.notes AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.notification_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.notification_type_prefs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.organization_billing AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.organization_invitations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.organization_members AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.organizations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.outgoings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payment_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payment_notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payments AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payroll_employees AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payroll_run_items AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payroll_runs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.payroll_submissions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.platform_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.platform_tools AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.post_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.post_likes AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.products_services AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.project_activities AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.project_members AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.project_share_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.project_time_entries AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.projects AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.quotes AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.rota_employees AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.rota_shifts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.rota_week_publications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.security_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.social_posts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.staking_rewards AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.staking_transactions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.staking_wallet_links AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.subscribers AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.suppliers AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_agents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_attachments AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_categories AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_customers AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_messages AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_notification_prefs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_ticket_feedback AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.support_tickets AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.team_members AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.teams AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.template_applications AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.todo_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.todo_history AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.todo_subtasks AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.todos AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_2fa_attempts AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_2fa_codes AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_2fa_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_ai_preferences AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_document_templates AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_documents AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_favorite_tools AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_favorites AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_integrations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_notification_preferences AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.user_stakes AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.workflow_run_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- 4. Guard lines in SECURITY DEFINER functions (body hashes read from production on 1 Nov 2026).
CREATE TEMP TABLE p25_expected (fn text PRIMARY KEY, md5 text NOT NULL, lang text NOT NULL, kind text NOT NULL) ON COMMIT DROP;
-- BEGIN EXPECTED
INSERT INTO p25_expected VALUES
  ('public.add_project_member(uuid,uuid,text)', 'd3265b4de0446bf1c8fdf442cd8d8152', 'plpgsql', 'user'),
  ('public.add_team_member(uuid,uuid,text)', 'b355f1b6074ab1495482855bf0c8912d', 'plpgsql', 'user'),
  ('public.admin_ai_stats(integer)', '5a17153d6ec7b5ba4ce88951c9718d32', 'plpgsql', 'admin'),
  ('public.admin_analytics_series(integer)', 'ef73c76ec5bc55f7d2de258f32f560d3', 'plpgsql', 'admin'),
  ('public.admin_company_detail(uuid)', 'd713cd52fd12e99b2c2e20ddd5149a97', 'plpgsql', 'admin'),
  ('public.admin_documents_summary(integer,integer)', '743ec51088be8f7fcb36b3cd5bffde41', 'plpgsql', 'admin'),
  ('public.admin_list_companies(text,integer,integer,text,text)', 'eb023cf0285d8ffd343666854c908735', 'plpgsql', 'admin'),
  ('public.admin_list_projects(text,text,integer,integer)', '89f93b80aecdee9b1b971dca57ddca73', 'plpgsql', 'admin'),
  ('public.admin_list_subscriptions(text,text,integer,integer)', '9aa1e534f719b2e77fb59d18dea15902', 'plpgsql', 'admin'),
  ('public.admin_list_users(text,text,integer,integer,text)', '06e9ec0e08c798ab24930351d186784b', 'plpgsql', 'admin'),
  ('public.admin_log_action(text,text,text,jsonb,text)', '3f16954629693957cd672738dc4da231', 'plpgsql', 'admin'),
  ('public.admin_moderate_post(uuid,boolean)', 'bc5c6d11a5bc913de783a5cd6f141469', 'plpgsql', 'admin'),
  ('public.admin_overview_stats()', '7cf74323ae1aee59627a6a7ab8f66671', 'plpgsql', 'admin'),
  ('public.admin_set_company_status(uuid,text,text)', '52b9ce7c126fae23f725a440e2ba0b16', 'plpgsql', 'admin'),
  ('public.admin_set_user_role(uuid,app_role)', 'bf3c810383b11ee36d105c883d2579ec', 'plpgsql', 'admin'),
  ('public.admin_set_user_status(uuid,boolean)', '4ac8b3ff4231a511ee75d23d6c8c4864', 'plpgsql', 'admin'),
  ('public.admin_social_stats(integer)', '4bf7ab3b3244384efd5d26701a77b4e3', 'plpgsql', 'admin'),
  ('public.admin_support_overview(text,integer,integer)', '10b33e02a55e31a6c29e2b4d079d6e5a', 'plpgsql', 'admin'),
  ('public.admin_system_health()', 'd178a8b191930a97a28615beecd7f2ae', 'plpgsql', 'admin'),
  ('public.admin_tools_overview()', 'b74127cbbe7a33b650adb77995cc9d20', 'plpgsql', 'admin'),
  ('public.admin_update_company(uuid,text,text)', '6c0b2de0174f6edabce413bee465dfcb', 'plpgsql', 'admin'),
  ('public.audit_profile_access(uuid,text)', '3330b078d629e818909ab2109084c3fe', 'plpgsql', 'user'),
  ('public.check_and_deduct_ai_credit(uuid,integer)', '53eb000e38a6e12091f01db15d67fe33', 'plpgsql', 'user'),
  ('public.check_trial_status(uuid)', '5dea0dad6ae4b80cbe954f198d5a2afc', 'plpgsql', 'user'),
  ('public.create_team_with_owner(text)', 'b7e718fd766e288a8f2b34c9be994aee', 'plpgsql', 'user'),
  ('public.ensure_user_has_org(uuid)', 'a349679bfc307cc77bd076a5aa4d620a', 'plpgsql', 'user'),
  ('public.get_advertisement_contact_info(uuid)', '79c4122a307fa16e43a0738973525c26', 'plpgsql', 'user'),
  ('public.get_ai_credits_info(uuid)', 'a7798e0139e35a8b906cda0e646dd01f', 'plpgsql', 'user'),
  ('public.get_bank_account_details(uuid,uuid)', '804a4cccf135cf913ecd5fba341245e9', 'plpgsql', 'user'),
  ('public.get_bank_accounts_safe(uuid)', '9b8d49130828c497e78cc5200dcf4dd5', 'plpgsql', 'user'),
  ('public.get_hmrc_client_secret(uuid)', '403c818389211da9a1ea33bc128e1385', 'plpgsql', 'user'),
  ('public.get_hmrc_tokens(uuid)', '4867b5d3a4916a132a0a856da02d3dd1', 'plpgsql', 'user'),
  ('public.get_integration_tokens(text,uuid)', 'dbc39c173e758867585111ececa26a60', 'plpgsql', 'user'),
  ('public.get_notification_preferences(uuid)', '8c4c2f2de88f023fac5234447fc36293', 'plpgsql', 'user'),
  ('public.get_team_members_with_profiles(uuid)', '3ff7303e3409b492dc6702ebd43bd315', 'plpgsql', 'user'),
  ('public.get_user_display_info(uuid)', '831c6b61eb0f283b778197e9e5eb9cc7', 'plpgsql', 'user'),
  ('public.get_user_integrations_safe(uuid)', 'fc466221a995548f812a38f6244c9a48', 'plpgsql', 'user'),
  ('public.get_user_payments(uuid)', '65600a5a945d36487a28a40a1c410cbd', 'plpgsql', 'user'),
  ('public.get_user_projects(uuid)', '8f043e3e89920108a782be482e0d6619', 'plpgsql', 'user'),
  ('public.get_user_staking_tier(uuid)', 'b680c38f0cd6fb6ee394430df9e7f60a', 'sql', 'user'),
  ('public.get_user_teams(uuid)', '1d68f11e1acc534368de02889a525ba7', 'plpgsql', 'user'),
  ('public.list_master_access()', 'a2225ae0331a85edf936f913736cec7c', 'plpgsql', 'admin'),
  ('public.log_user_action(uuid,text,text,text,jsonb,inet,text)', '9f237eafe55bcfb032c56f8fc3da1e66', 'plpgsql', 'user'),
  ('public.my_access_state()', 'd6811283c32999b3fc5dca5a4f897779', 'plpgsql', 'user'),
  ('public.onboarding_email_status(uuid)', 'e493cbc9de1a0f93fd319707f4955ffe', 'plpgsql', 'user'),
  ('public.org_accept_invitation(text)', '5c7efc62f52e44bb57d4c78b852d1058', 'plpgsql', 'user'),
  ('public.org_invitation_preview(text)', '35b299a33e857d78eb0a9210712ae8ff', 'plpgsql', 'user'),
  ('public.org_invitation_token(uuid)', '35a3244734e314dd206043b75074b349', 'plpgsql', 'user'),
  ('public.org_invite_member(uuid,text,text)', 'd87a3b5634c06ded54cfed58913ef875', 'plpgsql', 'user'),
  ('public.org_manage_invitation(uuid,text)', 'aeb1ed453ebb3e0fe5c68885436b9d9a', 'plpgsql', 'user'),
  ('public.org_seat_summary(uuid)', '88546128c926225d171ac07d0c8d204c', 'plpgsql', 'user'),
  ('public.platform_set_billing_owner(uuid,uuid,text)', '1bf159cb71b31ee8df3d5afa7a7cd898', 'plpgsql', 'admin'),
  ('public.preview_user_emissions(uuid)', '93b789b1d0acbd3506a9bc315b9cb30f', 'plpgsql', 'user'),
  ('public.resolve_active_organization(uuid)', '94fcd71d079a93f3dbc4f16a931b230e', 'plpgsql', 'user'),
  ('public.rota_can_add_employee(uuid)', '5aa99db1e31d8a6da820fe1bee63438c', 'plpgsql', 'user'),
  ('public.set_master_access(uuid,boolean,text)', '760422e973882bbbd36ea69d6fb50f03', 'plpgsql', 'admin'),
  ('public.store_bank_account(text,text,text,text,text,text,text,numeric,numeric,uuid)', 'a4077086440c8f5b71d7705b9e950c8f', 'plpgsql', 'user'),
  ('public.store_integration_tokens(text,text,text,timestamp with time zone,jsonb,uuid)', 'e2cf64c4dc5977ff6b5fd222dba066bd', 'plpgsql', 'user'),
  ('public.support_add_attachment(uuid,uuid,text,text,integer,text,boolean)', '98a658505d5e94136b197e5d3e9877f4', 'plpgsql', 'user'),
  ('public.support_add_message(uuid,text,boolean,uuid)', '68720c7820da075e2abf03ad8ccc7ec8', 'plpgsql', 'user'),
  ('public.support_claim_invitations()', 'e6201a72e8659ed6b320f7b67dbb421e', 'plpgsql', 'user'),
  ('public.support_create_ticket(uuid,text,text,uuid,text,uuid)', '963e2e95d62678d9c0c5e8d676fab034', 'plpgsql', 'user'),
  ('public.support_submit_feedback(uuid,integer,text)', 'cc4843e6a3229691f06b41d573f254d3', 'plpgsql', 'user'),
  ('public.support_update_ticket(uuid,text,text,uuid,uuid,boolean)', '8b2885431678c744e975a645975579d4', 'plpgsql', 'user'),
  ('public.wave1_list_reconcilable_projects()', '9e15cf8dab9c1b456a23690d1b78dcb5', 'sql', 'user'),
  ('public.wave1_reconcile_project(uuid,uuid)', 'dbfcd3a8b4d347763278733d813d75e0', 'plpgsql', 'user');
-- END EXPECTED

DO $do$
DECLARE
  r record; oid_ regprocedure; src text; def text; newsrc text; newdef text; pos int; snip text;
BEGIN
  FOR r IN SELECT * FROM p25_expected ORDER BY fn LOOP
    oid_ := to_regprocedure(r.fn);
    IF oid_ IS NULL THEN RAISE EXCEPTION '% is missing', r.fn; END IF;
    SELECT p.prosrc INTO src FROM pg_proc p WHERE p.oid = oid_;
    IF md5(src) <> r.md5 THEN
      RAISE EXCEPTION '% has changed since this was prepared (body md5 %, expected %). Re-read it before applying.', r.fn, md5(src), r.md5;
    END IF;
    IF position('phase25 mfa guard' in src) > 0 THEN RAISE EXCEPTION '% already has the guard', r.fn; END IF;
    IF r.lang = 'plpgsql' THEN
      snip := CASE r.kind WHEN 'admin' THEN '
  PERFORM public.require_aal2_admin(); -- phase25 mfa guard' ELSE '
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard' END;
      pos := length((regexp_match(src, '^(.*?\mbegin\M)', 'is'))[1]);
      IF pos IS NULL THEN RAISE EXCEPTION '% has no BEGIN', r.fn; END IF;
      newsrc := left(src, pos) || snip || substr(src, pos + 1);
    ELSIF r.lang = 'sql' THEN
      newsrc := CASE r.kind WHEN 'admin' THEN '
SELECT public.require_aal2_admin(); -- phase25 mfa guard
' ELSE '
SELECT public.require_aal2_if_enrolled(); -- phase25 mfa guard
' END || src;
    ELSE
      RAISE EXCEPTION '% has unexpected language %', r.fn, r.lang;
    END IF;
    def := pg_get_functiondef(oid_);
    IF (length(def) - length(replace(def, '$function$' || src || '$function$', ''))) <> length('$function$' || src || '$function$') THEN
      RAISE EXCEPTION '% body could not be located exactly once in its definition', r.fn;
    END IF;
    newdef := replace(def, '$function$' || src || '$function$', '$function$' || newsrc || '$function$');
    EXECUTE newdef;
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = oid_) <> md5(newsrc) THEN RAISE EXCEPTION '% was not updated', r.fn; END IF;
    INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5) VALUES (r.fn, r.kind, r.md5, md5(newsrc));
  END LOOP;
END $do$;

-- 5. Nothing executable by signed-in users is left unreviewed.
CREATE TEMP TABLE p25_excluded (fn text PRIMARY KEY, reason text NOT NULL) ON COMMIT DROP;
-- BEGIN EXCLUDED
INSERT INTO p25_excluded VALUES
  ('public.email_unsubscribe(text)', 'Public unsubscribe link from emails (token only, also callable signed out). No account data returned.'),
  ('public.get_invitation_by_token(text)', 'Looks up an invitation by its secret token on the join/sign-up page, before the person can have a code.'),
  ('public.has_role(uuid,app_role)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.is_admin_or_owner(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.is_project_member(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.is_safe_profile_field(text)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.is_super_admin(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.is_team_member(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.owns_team(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.support_can_view_ticket(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.support_feedback_submitted(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.support_is_agent(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.support_is_customer(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.support_is_manager(uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.template_usage_counts()', 'Public template usage counts (also callable signed out). No personal data.'),
  ('public.user_can_access_project(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.user_is_organization_admin(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.user_is_organization_member(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.user_is_organization_owner(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.user_owns_project(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.users_share_organization(uuid,uuid)', 'Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables).'),
  ('public.wave1_enforce_org_membership()', 'Trigger function: runs inside a write that the table''s RLS (with the new policy) already checks.'),
  ('public.wave1_todo_parent_tenant()', 'Trigger function: runs inside a write that the table''s RLS (with the new policy) already checks.');
-- END EXCLUDED

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO missing
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.oid::regprocedure::text NOT IN ('mfa_ok()', 'require_aal2_if_enrolled()', 'require_aal2_admin()')
    AND position('phase25 mfa guard' in p.prosrc) = 0
    AND NOT EXISTS (SELECT 1 FROM p25_excluded e WHERE to_regprocedure(e.fn) = p.oid);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unreviewed SECURITY DEFINER function(s) executable by signed-in users: %. Review them, then add a guard or an exclusion.', missing;
  END IF;
  IF (SELECT count(*) FROM public.phase25_mfa_guard_log) <> 66 THEN RAISE EXCEPTION 'guard count mismatch'; END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'require_aal2_if_enrolled') <> 98 THEN
    RAISE EXCEPTION 'policy count mismatch';
  END IF;
END $$;

COMMIT;
