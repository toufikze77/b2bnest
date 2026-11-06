-- =====================================================================================================================
-- Demo account: view-only mode. PREPARED, NOT APPLIED.
--
-- ORDER (docs/demo-readonly/README.md): 1 the owner applies this; 2 deploys the changed Edge Functions; 3 publishes the
-- frontend; 4 adds the demo user to public.demo_readonly_users (one statement in the README; this file adds no row).
--
-- What it adds (one transaction; any check failing changes nothing):
--   1. public.demo_readonly_users (user_id, label, created_at): RLS on, the Phase 25 restrictive aal2 policy, no
--      permissive policy and no client privileges at all. Only the owner (SQL editor) and the service role write it.
--   2. public.is_demo_readonly(): SECURITY DEFINER, search_path '', Phase 25 guard line + guard log row, authenticated
--      only (never anon). True when the caller is in demo_readonly_users.
--   3. public.demo_readonly_guard(): the trigger function. When auth.uid() is set (a request with a person's JWT, also
--      inside any RPC they call) and that person is in demo_readonly_users, the write is refused with SQLSTATE 42501
--      and "This is a demo account. It is view only." Service role, cron and the SQL editor (auth.uid() is null) pass.
--      A trigger function: not callable as an RPC; EXECUTE revoked from everyone (Phase 25 exempts trigger functions).
--   4. Trigger a0_demo_readonly_guard (BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW; the first BEFORE trigger by
--      name) on the 133 guarded tables. The 13 tables allowed without it are listed with reasons in
--      docs/demo-readonly/tables.json and the README.
--   Nothing existing is replaced: no function body, policy or grant of an existing object changes.
--
-- Production facts this was written against (read-only, 6 Nov 2026): 145 tables in public (names md5
-- bb4652cf005ef3a9ee10f4e0f9bea2c4); md5(prosrc) mfa_ok 20516f2ec203220b3ac08d1230c7c306, require_aal2_if_enrolled
-- 10b2ae7bd2f9a94ea20598f19b8aebf2; no trigger in public whose name sorts before 'a1'. Anything else: refused.
-- Rollback: docs/demo-readonly/rollback.sql. Tests: docs/demo-readonly/run-test.sh. Coverage check any time:
-- docs/demo-readonly/check-coverage.sql (read-only).
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE v_names text;
BEGIN
  IF to_regclass('public.demo_readonly_users') IS NOT NULL OR to_regprocedure('public.is_demo_readonly()') IS NOT NULL
     OR to_regprocedure('public.demo_readonly_guard()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard') THEN
    RAISE EXCEPTION 'Demo read-only already exists (applied twice?)';
  END IF;
  IF to_regclass('public.phase25_mfa_guard_log') IS NULL THEN RAISE EXCEPTION 'phase25_mfa_guard_log is missing'; END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.mfa_ok()')) IS DISTINCT FROM '20516f2ec203220b3ac08d1230c7c306'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.require_aal2_if_enrolled()')) IS DISTINCT FROM '10b2ae7bd2f9a94ea20598f19b8aebf2' THEN
    RAISE EXCEPTION 'mfa_ok() or require_aal2_if_enrolled() differs from production as read on 6 Nov 2026';
  END IF;
  SELECT string_agg(c.relname, ',' ORDER BY c.relname) INTO v_names FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p');
  IF md5(v_names) <> 'bb4652cf005ef3a9ee10f4e0f9bea2c4' THEN
    RAISE EXCEPTION 'The tables in public differ from production as read on 6 Nov 2026 (a table was added or removed). Re-read them and update docs/demo-readonly/tables.json first.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
              WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal AND t.tgname COLLATE "C" < 'a1') THEN
    RAISE EXCEPTION 'A trigger in public sorts before a0_demo_readonly_guard; the guard would not fire first';
  END IF;
END $$;

-- 1. The list of view-only people.
CREATE TABLE public.demo_readonly_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.demo_readonly_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY require_aal2_if_enrolled ON public.demo_readonly_users AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
REVOKE ALL ON public.demo_readonly_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_readonly_users TO service_role;
COMMENT ON TABLE public.demo_readonly_users IS 'Demo read-only: people listed here are view only (docs/demo-readonly). No client access; read your own status with is_demo_readonly().';

-- 2. Is the caller in demo mode? (the app shows the banner; the database guard is the real protection)
CREATE FUNCTION public.is_demo_readonly()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard
  RETURN EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = auth.uid());
END;
$function$;
REVOKE ALL ON FUNCTION public.is_demo_readonly() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_demo_readonly() TO authenticated;
INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5)
SELECT 'public.is_demo_readonly()', 'user',
       md5(replace(p.prosrc, E'\n  PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard', '')), md5(p.prosrc)
  FROM pg_proc p WHERE p.oid = 'public.is_demo_readonly()'::regprocedure;

-- 3. The guard. Tiny: one primary-key lookup, only when a person's JWT is present.
CREATE FUNCTION public.demo_readonly_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = v_uid) THEN
    RAISE EXCEPTION 'This is a demo account. It is view only.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.demo_readonly_guard() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.demo_readonly_guard() IS 'Demo read-only trigger (docs/demo-readonly). Trigger function: not an RPC.';

-- 4. Attach it to every guarded table; every table in public is either guarded or on the allow-list.
DO $$
DECLARE
-- BEGIN GUARDED (generated from docs/demo-readonly/tables.json)
  v_guarded text[] := ARRAY[
    'admin_audit_logs', 'advertisement_categories', 'advertisements', 'ai_conversations', 'ai_credit_ledger',
    'ai_credit_lots', 'ai_model_prices', 'ai_topup_checkouts', 'ai_topup_packs', 'ai_workflows', 'ai_workspaces',
    'b2b_form_submissions', 'bank_accounts', 'bank_transactions', 'bills', 'business_insights', 'companies',
    'connections', 'crm_contacts', 'crm_deals', 'document_email_log', 'documents', 'email_optouts', 'expenses',
    'feedback_requests', 'forum_posts', 'forum_replies', 'free_tool_items', 'hmrc_audit_log', 'hmrc_connections',
    'hmrc_integrations', 'hmrc_oauth_states', 'hmrc_p0_backup', 'hmrc_settings', 'hmrc_submission_logs',
    'integration_settings', 'invoices', 'job_postings', 'marketing_audiences', 'marketing_campaigns',
    'marketing_consents', 'marketing_content_items', 'master_access', 'messages', 'news_articles', 'note_categories',
    'notes', 'onboarding_email_outbox', 'organization_billing', 'organization_invitations', 'organization_members',
    'organizations', 'outgoings', 'payment_notifications', 'payments', 'payroll_employees', 'payroll_run_items',
    'payroll_runs', 'payroll_submissions', 'phase12_subscribers_backup', 'phase12_trial_flags_backup',
    'phase25_mfa_guard_log', 'phase31_backup', 'phase32_backup', 'phase35_function_backup',
    'phase35_guard_log_backup', 'phase37_function_backup', 'phase37_guard_log_backup', 'plan_prices',
    'platform_plan_prices', 'platform_plans', 'platform_settings', 'platform_tools', 'post_comments', 'post_likes',
    'products_services', 'profiles', 'project_activities', 'project_members', 'project_share_logs',
    'project_time_entries', 'projects', 'quotes', 'rota_employees', 'rota_leave_allowances', 'rota_leave_requests',
    'rota_shifts', 'rota_week_publications', 'security_settings', 'social_posts', 'staking_reward_pools',
    'staking_rewards', 'staking_tiers', 'staking_transactions', 'staking_wallet_links', 'stripe_webhook_events',
    'subscribers', 'suppliers', 'support_agents', 'support_attachments', 'support_categories', 'support_customers',
    'support_email_outbox', 'support_messages', 'support_notification_prefs', 'support_settings',
    'support_ticket_feedback', 'support_tickets', 'team_members', 'teams', 'template_applications',
    'template_catalog', 'template_events', 'time_tracker_settings', 'todo_comments', 'todo_history', 'todo_subtasks',
    'todos', 'trial_email_outbox', 'trial_email_settings', 'user_2fa_attempts', 'user_2fa_codes',
    'user_2fa_settings', 'user_ai_preferences', 'user_document_templates', 'user_documents', 'user_integrations',
    'user_roles', 'user_stakes', 'wave1_backfill_journal', 'wave1_created_objects', 'wave1_unresolved_rows',
    'workflow_run_logs'
  ];
-- END GUARDED
-- BEGIN ALLOWED
  v_allowed text[] := ARRAY[
    'audit_logs', 'banking_audit_logs', 'demo_readonly_users', 'integration_audit_logs', 'notification_logs',
    'notification_type_prefs', 'notifications', 'payment_audit_logs', 'security_audit_logs', 'trial_email_log',
    'user_favorite_tools', 'user_favorites', 'user_notification_preferences'
  ];
-- END ALLOWED
  t text; v_missing text;
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(v_guarded) x WHERE x = ANY (v_allowed)) THEN RAISE EXCEPTION 'a table is both guarded and allowed'; END IF;
  FOREACH t IN ARRAY v_guarded LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN RAISE EXCEPTION 'guarded table public.% is missing', t; END IF;
    EXECUTE format('CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard()', t);
  END LOOP;
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_missing FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND NOT (c.relname = ANY (v_allowed))
     AND NOT EXISTS (SELECT 1 FROM pg_trigger tr WHERE tr.tgrelid = c.oid AND tr.tgname = 'a0_demo_readonly_guard'
                       AND tr.tgfoid = 'public.demo_readonly_guard()'::regprocedure AND tr.tgenabled = 'O');
  IF v_missing IS NOT NULL THEN RAISE EXCEPTION 'Tables neither guarded nor allowed: %', v_missing; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard') <> 133 THEN RAISE EXCEPTION 'guard count mismatch'; END IF;
END $$;

COMMIT;
