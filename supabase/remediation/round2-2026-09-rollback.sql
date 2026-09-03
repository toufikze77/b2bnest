-- ============================================================================
-- B2BNest — ROLLBACK for SECURITY REMEDIATION ROUND 2 (2026-09)
-- Reverts supabase/remediation/round2-2026-09.sql to the PRE-ROUND2 state
-- captured in supabase/baseline/production-schema-baseline-2026-09.sql.
--
-- WARNING: this restores the PRE-REMEDIATION (less secure) posture.
-- Run only as an emergency rollback. Never run for convenience.
-- Idempotent; safe to re-run. DO NOT RUN AGAINST PRODUCTION WITHOUT AUTHORIZATION.
--
-- Reversibility classification:
--   FULLY REVERSIBLE          : function bodies, grants, RLS policies
--   CONDITIONALLY REVERSIBLE  : documents.is_public (column is KEPT by default)
--   NOT SAFELY REVERSIBLE     : none (Round 2 performs no destructive DML)
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. FUNCTIONS — restore pre-Round2 bodies (FULLY REVERSIBLE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hmrc_tokens(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_user_integrations_safe(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(id uuid, user_id uuid, integration_name text, is_connected boolean, connected_at timestamp with time zone, expires_at timestamp with time zone, metadata jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, has_access_token boolean, has_refresh_token boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

CREATE OR REPLACE FUNCTION public.get_integration_tokens(p_integration_name text, p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(access_token text, refresh_token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_bank_accounts_safe(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(id uuid, account_id text, provider_name text, account_type text, currency text, balance numeric, available_balance numeric, last_synced_at timestamp with time zone, is_active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_bank_account_details(p_account_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(account_number text, sort_code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_hmrc_client_secret(p_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.store_integration_tokens(p_integration_name text, p_access_token text, p_refresh_token text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_metadata jsonb DEFAULT '{}'::jsonb, p_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.store_bank_account(p_account_id text, p_provider_id text, p_provider_name text, p_account_type text, p_account_number text DEFAULT NULL::text, p_sort_code text DEFAULT NULL::text, p_currency text DEFAULT 'GBP'::text, p_balance numeric DEFAULT NULL::numeric, p_available_balance numeric DEFAULT NULL::numeric, p_user_id uuid DEFAULT auth.uid())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_user_payments(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(id uuid, stripe_session_id text, amount integer, currency text, status text, item_name text, payment_method text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_payment_details_admin(p_payment_id uuid)
 RETURNS TABLE(id uuid, stripe_session_id text, customer_email text, customer_name text, company_name text, contact_number text, amount integer, currency text, status text, item_name text, payment_method text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_ai_credits_info(p_user_id uuid DEFAULT auth.uid())
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

CREATE OR REPLACE FUNCTION public.get_user_display_info(p_user_id uuid)
 RETURNS TABLE(id uuid, display_name text, avatar_url text, headline text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

-- ---------------------------------------------------------------------------
-- B. RLS POLICIES — restore pre-Round2 policy set on affected tables
--    (FULLY REVERSIBLE)
-- ---------------------------------------------------------------------------
-- B.1 remove policies introduced by Round 2 that did not exist before
drop policy if exists "documents_select_owned_purchased_or_public" on public.documents;
drop policy if exists "Team owners can delete their teams" on public.teams;
drop policy if exists "ai_conversations_delete_policy" on public.ai_conversations;

-- B.2 restore baseline policies
drop policy if exists "Users can create their own conversations" on public.ai_conversations;
CREATE POLICY "Users can create their own conversations" ON public.ai_conversations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "Users can update their own conversations" on public.ai_conversations;
CREATE POLICY "Users can update their own conversations" ON public.ai_conversations AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

drop policy if exists "ai_conversations_insert_policy" on public.ai_conversations;
CREATE POLICY ai_conversations_insert_policy ON public.ai_conversations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "ai_conversations_select_policy" on public.ai_conversations;
CREATE POLICY ai_conversations_select_policy ON public.ai_conversations AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

drop policy if exists "documents_delete_own_or_super_admin" on public.documents;
CREATE POLICY documents_delete_own_or_super_admin ON public.documents AS PERMISSIVE FOR DELETE TO authenticated
  USING (((auth.uid() = user_id) OR is_super_admin(auth.uid())));

drop policy if exists "documents_insert_own_or_super_admin" on public.documents;
CREATE POLICY documents_insert_own_or_super_admin ON public.documents AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) OR is_super_admin(auth.uid())));

drop policy if exists "documents_select_owned_purchased_or_free" on public.documents;
CREATE POLICY documents_select_owned_purchased_or_free ON public.documents AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR is_super_admin(auth.uid()) OR (COALESCE(price, (0)::numeric) = (0)::numeric) OR (EXISTS ( SELECT 1
   FROM user_documents ud
  WHERE ((ud.document_id = documents.id) AND (ud.user_id = auth.uid()))))));

drop policy if exists "documents_update_own_or_super_admin" on public.documents;
CREATE POLICY documents_update_own_or_super_admin ON public.documents AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((auth.uid() = user_id) OR is_super_admin(auth.uid())))
  WITH CHECK (((auth.uid() = user_id) OR is_super_admin(auth.uid())));

drop policy if exists "Users can delete their own HMRC integrations" on public.hmrc_integrations;
CREATE POLICY "Users can delete their own HMRC integrations" ON public.hmrc_integrations AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Users can insert their own HMRC integrations" on public.hmrc_integrations;
CREATE POLICY "Users can insert their own HMRC integrations" ON public.hmrc_integrations AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "Users can update their own HMRC integrations" on public.hmrc_integrations;
CREATE POLICY "Users can update their own HMRC integrations" ON public.hmrc_integrations AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Users can view their own HMRC integrations" on public.hmrc_integrations;
CREATE POLICY "Users can view their own HMRC integrations" ON public.hmrc_integrations AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Users can delete their own HMRC settings" on public.hmrc_settings;
CREATE POLICY "Users can delete their own HMRC settings" ON public.hmrc_settings AS PERMISSIVE FOR DELETE TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Users can insert their own HMRC settings" on public.hmrc_settings;
CREATE POLICY "Users can insert their own HMRC settings" ON public.hmrc_settings AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "Users can update their own HMRC settings" on public.hmrc_settings;
CREATE POLICY "Users can update their own HMRC settings" ON public.hmrc_settings AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Users can view their own HMRC settings" on public.hmrc_settings;
CREATE POLICY "Users can view their own HMRC settings" ON public.hmrc_settings AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Admins can view all HMRC submission logs" on public.hmrc_submission_logs;
CREATE POLICY "Admins can view all HMRC submission logs" ON public.hmrc_submission_logs AS PERMISSIVE FOR SELECT TO public
  USING (is_admin_or_owner(auth.uid()));

drop policy if exists "Users can insert their own HMRC submission logs" on public.hmrc_submission_logs;
CREATE POLICY "Users can insert their own HMRC submission logs" ON public.hmrc_submission_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "Users can view their own HMRC submission logs" on public.hmrc_submission_logs;
CREATE POLICY "Users can view their own HMRC submission logs" ON public.hmrc_submission_logs AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

drop policy if exists "Block anonymous access to payments" on public.payments;
CREATE POLICY "Block anonymous access to payments" ON public.payments AS PERMISSIVE FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

drop policy if exists "System functions can manage payments" on public.payments;
CREATE POLICY "System functions can manage payments" ON public.payments AS PERMISSIVE FOR ALL TO public
  USING (false)
  WITH CHECK (false);

drop policy if exists "Users can insert their own payments" on public.payments;
CREATE POLICY "Users can insert their own payments" ON public.payments AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((customer_email IS NULL) OR (customer_email = auth.email()))));

drop policy if exists "Users can view their own payments" on public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (customer_email = auth.email())));

drop policy if exists "Users can view their own payments only" on public.payments;
CREATE POLICY "Users can view their own payments only" ON public.payments AS PERMISSIVE FOR SELECT TO authenticated
  USING (((auth.uid() = user_id) OR (auth.email() = customer_email)));

drop policy if exists "Organization members can create projects" on public.projects;
CREATE POLICY "Organization members can create projects" ON public.projects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.is_active = true)))));

drop policy if exists "Organization members can manage projects" on public.projects;
CREATE POLICY "Organization members can manage projects" ON public.projects AS PERMISSIVE FOR ALL TO public
  USING (user_is_organization_member(organization_id))
  WITH CHECK (user_is_organization_member(organization_id));

drop policy if exists "Organization members can view projects" on public.projects;
CREATE POLICY "Organization members can view projects" ON public.projects AS PERMISSIVE FOR SELECT TO public
  USING (user_is_organization_member(organization_id));

drop policy if exists "Project owners can update projects" on public.projects;
CREATE POLICY "Project owners can update projects" ON public.projects AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = auth.uid()) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (organization_members.is_active = true))))));

drop policy if exists "Users can create their own projects" on public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

drop policy if exists "Users can delete projects they own" on public.projects;
CREATE POLICY "Users can delete projects they own" ON public.projects AS PERMISSIVE FOR DELETE TO public
  USING (user_owns_project(id));

drop policy if exists "Users can update projects they own" on public.projects;
CREATE POLICY "Users can update projects they own" ON public.projects AS PERMISSIVE FOR UPDATE TO public
  USING (user_owns_project(id));

drop policy if exists "Users can view projects in their organization" on public.projects;
CREATE POLICY "Users can view projects in their organization" ON public.projects AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE ((organization_members.user_id = auth.uid()) AND (organization_members.is_active = true)))) OR (id IN ( SELECT project_members.project_id
   FROM project_members
  WHERE (project_members.user_id = auth.uid())))));

drop policy if exists "Users can view projects they own or are organization members of" on public.projects;
CREATE POLICY "Users can view projects they own or are organization members of" ON public.projects AS PERMISSIVE FOR SELECT TO public
  USING (user_can_access_project(id));

drop policy if exists "insert_subscription" on public.subscribers;
CREATE POLICY insert_subscription ON public.subscribers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND ((email IS NULL) OR (email = auth.email()))));

drop policy if exists "select_own_subscription" on public.subscribers;
CREATE POLICY select_own_subscription ON public.subscribers AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR (email = auth.email())));

drop policy if exists "update_own_subscription" on public.subscribers;
CREATE POLICY update_own_subscription ON public.subscribers AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((user_id = auth.uid()) OR (email = auth.email())))
  WITH CHECK (((user_id = auth.uid()) OR (email = auth.email())));

drop policy if exists "Team owners can update their teams" on public.teams;
CREATE POLICY "Team owners can update their teams" ON public.teams AS PERMISSIVE FOR UPDATE TO public
  USING ((owner_id = auth.uid()));

drop policy if exists "Users can create their own teams" on public.teams;
CREATE POLICY "Users can create their own teams" ON public.teams AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((owner_id = auth.uid()));

drop policy if exists "Users can view teams they own or belong to" on public.teams;
CREATE POLICY "Users can view teams they own or belong to" ON public.teams AS PERMISSIVE FOR SELECT TO public
  USING (((owner_id = auth.uid()) OR (id IN ( SELECT team_members.team_id
   FROM team_members
  WHERE (team_members.user_id = auth.uid())))));

-- ---------------------------------------------------------------------------
-- C. PRIVILEGES — restore pre-Round2 EXECUTE and table grants
--    (FULLY REVERSIBLE — restores broad PUBLIC EXECUTE, which is insecure)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('grant execute on function %s to public', r.sig);
  end loop;
end $$;

GRANT EXECUTE ON FUNCTION public.add_project_member(p_project_id uuid, p_user_id uuid, p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_member(p_project_id uuid, p_user_id uuid, p_role text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_team_member(p_team_id uuid, p_user_id uuid, p_role text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_team_member(p_team_id uuid, p_user_id uuid, p_role text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_ai_stats(_days integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_stats(_days integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_analytics_series(_days integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_analytics_series(_days integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_company_detail(_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_company_detail(_org_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_documents_summary(_limit integer, _offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_documents_summary(_limit integer, _offset integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_companies(_search text, _limit integer, _offset integer, _status text, _plan text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_companies(_search text, _limit integer, _offset integer, _status text, _plan text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(_search text, _status text, _limit integer, _offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_projects(_search text, _status text, _limit integer, _offset integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(_status text, _search text, _limit integer, _offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(_status text, _search text, _limit integer, _offset integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users(_search text, _status text, _limit integer, _offset integer, _plan text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(_search text, _status text, _limit integer, _offset integer, _plan text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_log_action(_action text, _target_type text, _target_id text, _details jsonb, _status text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_action(_action text, _target_type text, _target_id text, _details jsonb, _status text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post(_post_id uuid, _hide boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_post(_post_id uuid, _hide boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_company_status(_org_id uuid, _status text, _reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_company_status(_org_id uuid, _status text, _reason text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(_user_id uuid, _active boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(_user_id uuid, _active boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_social_stats(_limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_social_stats(_limit integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_support_overview(_status text, _limit integer, _offset integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_support_overview(_status text, _limit integer, _offset integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_system_health() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_tools_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tools_overview() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_company(_org_id uuid, _name text, _plan text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_company(_org_id uuid, _name text, _plan text) TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_profile_access(accessed_user_id uuid, access_type text) TO anon;
GRANT EXECUTE ON FUNCTION public.audit_profile_access(accessed_user_id uuid, access_type text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_profile_access(accessed_user_id uuid, access_type text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_2fa_rate_limit(p_email text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_2fa_rate_limit(p_email text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_2fa_rate_limit(p_email text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_deduct_ai_credit(p_user_id uuid, p_credits_to_deduct integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_trial_status(user_id_param uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_status(user_id_param uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_2fa_codes() TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_2fa_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_2fa_codes() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_payment_record(p_stripe_session_id text, p_customer_email text, p_amount integer, p_item_name text, p_user_id uuid, p_customer_name text, p_company_name text, p_contact_number text, p_currency text, p_payment_method text, p_metadata jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(p_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_with_owner(p_name text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_user_organization() TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_organization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_organization() TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_banking_data(encrypted_data text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_hmrc_token(encrypted_token text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_integration_token(encrypted_token text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_payment_data(encrypted_data text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_banking_data(data text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_hmrc_settings_secret() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_hmrc_token(token text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_integration_token(token text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_payment_data(data text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_notification_preferences() TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_notification_preferences() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_org(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_org(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_org(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(ad_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(ad_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advertisement_contact_info(ad_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credits_info(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ai_credits_info(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_credits_info(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_bank_account_details(p_account_id uuid, p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bank_account_details(p_account_id uuid, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bank_account_details(p_account_id uuid, p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_bank_accounts_safe(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bank_accounts_safe(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_bank_accounts_safe(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_hmrc_client_secret(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_hmrc_client_secret(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hmrc_client_secret(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_hmrc_tokens(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_hmrc_tokens(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hmrc_tokens(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_integration_tokens(p_integration_name text, p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_integration_tokens(p_integration_name text, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_integration_tokens(p_integration_name text, p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(p_token text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(p_token text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(p_token text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_notification_preferences(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_details_admin(p_payment_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_payment_details_admin(p_payment_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_details_admin(p_payment_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_team_members_with_profiles(p_team_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members_with_profiles(p_team_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_display_info(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_info(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_display_info(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_integrations_safe(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_integrations_safe(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_integrations_safe(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_payments(p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_payments(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_payments(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_projects(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_projects(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_staking_tier(_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_staking_tier(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_staking_tier(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_teams(p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_teams(p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(_project_id uuid, _user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(_project_id uuid, _user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(_project_id uuid, _user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_safe_profile_field(field_name text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_safe_profile_field(field_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_safe_profile_field(field_name text) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_team_member(_team_id uuid, _user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(_team_id uuid, _user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(_team_id uuid, _user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_todo_changes() TO anon;
GRANT EXECUTE ON FUNCTION public.log_todo_changes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_todo_changes() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_details jsonb, p_ip_address inet, p_user_agent text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_details jsonb, p_ip_address inet, p_user_agent text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_action(p_user_id uuid, p_action text, p_resource_type text, p_resource_id text, p_details jsonb, p_ip_address inet, p_user_agent text) TO service_role;
GRANT EXECUTE ON FUNCTION public.owns_team(_team_id uuid, _user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.owns_team(_team_id uuid, _user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_team(_team_id uuid, _user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_super_admin_escalation() TO anon;
GRANT EXECUTE ON FUNCTION public.prevent_super_admin_escalation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_super_admin_escalation() TO service_role;
GRANT EXECUTE ON FUNCTION public.preview_user_emissions(_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_user_emissions(_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rota_can_add_employee(p_org_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.rota_can_add_employee(p_org_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rota_can_add_employee(p_org_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_bank_account(p_account_id text, p_provider_id text, p_provider_name text, p_account_type text, p_account_number text, p_sort_code text, p_currency text, p_balance numeric, p_available_balance numeric, p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.store_bank_account(p_account_id text, p_provider_id text, p_provider_name text, p_account_type text, p_account_number text, p_sort_code text, p_currency text, p_balance numeric, p_available_balance numeric, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_bank_account(p_account_id text, p_provider_id text, p_provider_name text, p_account_type text, p_account_number text, p_sort_code text, p_currency text, p_balance numeric, p_available_balance numeric, p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_integration_tokens(p_integration_name text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone, p_metadata jsonb, p_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.store_integration_tokens(p_integration_name text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone, p_metadata jsonb, p_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_integration_tokens(p_integration_name text, p_access_token text, p_refresh_token text, p_expires_at timestamp with time zone, p_metadata jsonb, p_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.template_usage_counts() TO anon;
GRANT EXECUTE ON FUNCTION public.template_usage_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.template_usage_counts() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_ai_workspaces_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_ai_workspaces_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ai_workspaces_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_b2b_forms_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_b2b_forms_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_b2b_forms_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_bills_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_bills_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_bills_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_hmrc_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_hmrc_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_hmrc_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_notes_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_notes_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notes_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_payment_status(p_status text, p_stripe_session_id text, p_stripe_payment_intent_id text, p_payment_method text, p_metadata jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_post_comment_count() TO anon;
GRANT EXECUTE ON FUNCTION public.update_post_comment_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_post_comment_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_post_like_count() TO anon;
GRANT EXECUTE ON FUNCTION public.update_post_like_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_post_like_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_post_reply_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.update_post_reply_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_post_reply_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_project_time_entries_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_project_time_entries_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_time_entries_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_todo_subtasks_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_todo_subtasks_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_todo_subtasks_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_todo_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_todo_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_todo_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_project(project_id uuid, check_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_organization_admin(org_id uuid, check_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_organization_member(org_id uuid, check_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_organization_owner(org_id uuid, check_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_project(project_id uuid, check_user_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.users_share_organization(_a uuid, _b uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_organization(_a uuid, _b uuid) TO service_role;

GRANT DELETE ON public.payments TO anon;
GRANT INSERT ON public.payments TO anon;
GRANT MAINTAIN ON public.payments TO anon;
GRANT REFERENCES ON public.payments TO anon;
GRANT SELECT ON public.payments TO anon;
GRANT TRIGGER ON public.payments TO anon;
GRANT TRUNCATE ON public.payments TO anon;
GRANT UPDATE ON public.payments TO anon;
GRANT DELETE ON public.payments TO authenticated;
GRANT INSERT ON public.payments TO authenticated;
GRANT MAINTAIN ON public.payments TO authenticated;
GRANT REFERENCES ON public.payments TO authenticated;
GRANT SELECT ON public.payments TO authenticated;
GRANT TRIGGER ON public.payments TO authenticated;
GRANT TRUNCATE ON public.payments TO authenticated;
GRANT UPDATE ON public.payments TO authenticated;
GRANT DELETE ON public.payments TO service_role;
GRANT INSERT ON public.payments TO service_role;
GRANT MAINTAIN ON public.payments TO service_role;
GRANT REFERENCES ON public.payments TO service_role;
GRANT SELECT ON public.payments TO service_role;
GRANT TRIGGER ON public.payments TO service_role;
GRANT TRUNCATE ON public.payments TO service_role;
GRANT UPDATE ON public.payments TO service_role;
GRANT DELETE ON public.subscribers TO anon;
GRANT INSERT ON public.subscribers TO anon;
GRANT MAINTAIN ON public.subscribers TO anon;
GRANT REFERENCES ON public.subscribers TO anon;
GRANT SELECT ON public.subscribers TO anon;
GRANT TRIGGER ON public.subscribers TO anon;
GRANT TRUNCATE ON public.subscribers TO anon;
GRANT UPDATE ON public.subscribers TO anon;
GRANT DELETE ON public.subscribers TO authenticated;
GRANT INSERT ON public.subscribers TO authenticated;
GRANT MAINTAIN ON public.subscribers TO authenticated;
GRANT REFERENCES ON public.subscribers TO authenticated;
GRANT SELECT ON public.subscribers TO authenticated;
GRANT TRIGGER ON public.subscribers TO authenticated;
GRANT TRUNCATE ON public.subscribers TO authenticated;
GRANT UPDATE ON public.subscribers TO authenticated;
GRANT DELETE ON public.subscribers TO service_role;
GRANT INSERT ON public.subscribers TO service_role;
GRANT MAINTAIN ON public.subscribers TO service_role;
GRANT REFERENCES ON public.subscribers TO service_role;
GRANT SELECT ON public.subscribers TO service_role;
GRANT TRIGGER ON public.subscribers TO service_role;
GRANT TRUNCATE ON public.subscribers TO service_role;
GRANT UPDATE ON public.subscribers TO service_role;

-- ---------------------------------------------------------------------------
-- D. documents.is_public — CONDITIONALLY REVERSIBLE
--    The column is KEPT by default: after deployment the application/admins may
--    have flagged documents as public, and dropping the column would destroy
--    that curation. Only an all-default (all false) column is dropped.
--    Set b2bnest.force_drop_is_public = 'on' to force removal.
-- ---------------------------------------------------------------------------
do $$
declare v_flagged bigint; v_force text := coalesce(current_setting('b2bnest.force_drop_is_public', true), 'off');
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='documents' and column_name='is_public') then
    raise notice 'documents.is_public absent — nothing to revert';
    return;
  end if;
  select count(*) into v_flagged from public.documents where is_public is true;
  if v_flagged = 0 or v_force = 'on' then
    alter table public.documents drop column is_public;
    raise notice 'documents.is_public dropped (flagged rows: %, force: %)', v_flagged, v_force;
  else
    raise notice 'documents.is_public RETAINED: % rows are flagged public. Column is unused by the restored policy set.', v_flagged;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- E. Remove the Round 2 authorization helper (FULLY REVERSIBLE)
--    Safe only after section A restored every function that called it.
-- ---------------------------------------------------------------------------
drop function if exists public.assert_self(uuid);

commit;
