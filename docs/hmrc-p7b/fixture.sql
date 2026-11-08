-- HMRC P7b local fixture: makes the disposable test database match production (read-only, 9 Nov 2026) where P7b depends
-- on it. Loaded after docs/hmrc-p6/proposal.sql. Never applied to production.
--   1. public._hmrc_vat_submission_guard exactly as applied (the P6 body without its comment lines;
--      md5(prosrc) 9f0f119b78a033245b1ef8875e4a31d4).
--   2. public.ai_credit_ledger_append_only and its trigger exactly as in production (md5 a54399ea2a9c9459257cfd3cacd02480):
--      it lets the user_id FK set NULL when an account is deleted, and blocks every other change.
--   3. log_todo_changes and _time_entry_guard with their triggers, and hmrc_settings' unique key, as in production.
--   4. The person and company columns production has but the older fixtures left out, then production's 133 foreign
--      keys (pg_get_constraintdef). A key whose other columns the local skeleton tables don't have is skipped with a
--      NOTICE; none of those involve people or companies.
BEGIN;
CREATE OR REPLACE FUNCTION public._hmrc_vat_submission_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: VAT submissions are kept forever' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'submitting' OR NEW.completed_at IS NOT NULL OR NEW.processing_date IS NOT NULL OR NEW.form_bundle_number IS NOT NULL
       OR NEW.charge_ref_number IS NOT NULL OR NEW.payment_indicator IS NOT NULL OR NEW.http_status IS NOT NULL OR NEW.error_code IS NOT NULL OR NEW.error_message IS NOT NULL THEN
      RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: a submission starts as submitting, with no result' USING ERRCODE = '42501';
    END IF;
    NEW.submitted_at := now();
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.period_key IS DISTINCT FROM OLD.period_key OR NEW.period_start IS DISTINCT FROM OLD.period_start OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.figures IS DISTINCT FROM OLD.figures OR NEW.figures_hash IS DISTINCT FROM OLD.figures_hash OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_by_name IS DISTINCT FROM OLD.submitted_by_name
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.vrn_last3 IS DISTINCT FROM OLD.vrn_last3 OR NEW.test_scenario IS DISTINCT FROM OLD.test_scenario THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: what was sent can never change' USING ERRCODE = '42501';
  END IF;
  IF NOT ((OLD.status = 'submitting' AND NEW.status IN ('accepted', 'rejected', 'unknown'))
          OR (OLD.status = 'unknown' AND NEW.status IN ('accepted', 'rejected'))) THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: % can''t become %', OLD.status, NEW.status USING ERRCODE = '42501';
  END IF;
  IF (OLD.processing_date IS NOT NULL AND NEW.processing_date IS DISTINCT FROM OLD.processing_date)
     OR (OLD.payment_indicator IS NOT NULL AND NEW.payment_indicator IS DISTINCT FROM OLD.payment_indicator)
     OR (OLD.form_bundle_number IS NOT NULL AND NEW.form_bundle_number IS DISTINCT FROM OLD.form_bundle_number)
     OR (OLD.charge_ref_number IS NOT NULL AND NEW.charge_ref_number IS DISTINCT FROM OLD.charge_ref_number)
     OR (OLD.http_status IS NOT NULL AND NEW.http_status IS DISTINCT FROM OLD.http_status)
     OR (OLD.error_code IS NOT NULL AND OLD.status <> 'unknown' AND NEW.error_code IS DISTINCT FROM OLD.error_code) THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: a result already recorded can''t change' USING ERRCODE = '42501';
  END IF;
  NEW.completed_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ai_credit_ledger_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.user_id is null and old.user_id is not null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  if tg_op = 'DELETE' and coalesce(current_setting('app.ai_ledger_purge', true), '') = 'on' then
    return old;
  end if;
  raise exception 'ai_credit_ledger is append-only' using errcode = '42501';
end;
$function$;
ALTER TABLE public.ai_credit_ledger ADD COLUMN IF NOT EXISTS user_id uuid;
DROP TRIGGER IF EXISTS ai_credit_ledger_append_only ON public.ai_credit_ledger;
CREATE TRIGGER ai_credit_ledger_append_only BEFORE DELETE OR UPDATE ON public.ai_credit_ledger FOR EACH ROW EXECUTE FUNCTION public.ai_credit_ledger_append_only();

-- Person and company columns as in production (types simplified to nullable uuid where the skeleton lacks them).
ALTER TABLE public.organization_invitations ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.project_time_entries ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.rota_leave_allowances ADD COLUMN IF NOT EXISTS company_id uuid, ADD COLUMN IF NOT EXISTS set_by uuid;
ALTER TABLE public.rota_leave_requests ADD COLUMN IF NOT EXISTS company_id uuid, ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS decided_by uuid, ADD COLUMN IF NOT EXISTS requester_user_id uuid;
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS assigned_to uuid, ADD COLUMN IF NOT EXISTS reporter_id uuid;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS owner_id uuid, ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.rota_shifts ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.rota_employees ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.organization_billing ADD COLUMN IF NOT EXISTS set_by uuid;

-- public.hmrc_integrations exactly as in production (the same definition rollback.sql recreates), so the apply and
-- rollback round trip compares like with like.
DROP TABLE IF EXISTS public.hmrc_integrations;
CREATE TABLE public.hmrc_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  token_type text DEFAULT 'Bearer'::text,
  scope text,
  is_connected boolean DEFAULT true,
  connected_at timestamp with time zone DEFAULT now(),
  last_refreshed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hmrc_integrations_pkey PRIMARY KEY (id),
  CONSTRAINT hmrc_integrations_user_id_organization_id_key UNIQUE (user_id, organization_id),
  CONSTRAINT hmrc_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT hmrc_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_hmrc_integrations_user_id ON public.hmrc_integrations USING btree (user_id);
CREATE INDEX idx_hmrc_integrations_org_id ON public.hmrc_integrations USING btree (organization_id);
ALTER TABLE public.hmrc_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hmrc_integrations FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON public.hmrc_integrations TO service_role;
CREATE POLICY "Users can delete their own HMRC integrations" ON public.hmrc_integrations FOR DELETE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own HMRC integrations" ON public.hmrc_integrations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can update their own HMRC integrations" ON public.hmrc_integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK ((auth.uid() = user_id) AND ((organization_id IS NULL) OR public.user_is_organization_member(organization_id, auth.uid())));
CREATE POLICY "Users can view their own HMRC integrations" ON public.hmrc_integrations FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_integrations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR DELETE OR UPDATE ON public.hmrc_integrations FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER update_hmrc_integrations_updated_at BEFORE UPDATE ON public.hmrc_integrations FOR EACH ROW EXECUTE FUNCTION public.update_hmrc_updated_at();


-- public.organizations: RLS and its policies as in production (the skeleton had none).
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
CREATE POLICY "Users can view organizations they belong to" ON public.organizations FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_members.organization_id = organizations.id
                   AND organization_members.user_id = auth.uid() AND organization_members.is_active = true));
DROP POLICY IF EXISTS "Organization owners can update their organization" ON public.organizations;
CREATE POLICY "Organization owners can update their organization" ON public.organizations FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_members.organization_id = organizations.id
                   AND organization_members.user_id = auth.uid() AND organization_members.role = ANY (ARRAY['owner'::text, 'admin'::text])
                   AND organization_members.is_active = true));
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS require_aal2_if_enrolled ON public.organizations;
CREATE POLICY require_aal2_if_enrolled ON public.organizations AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- Todos, their history and time entries: the columns and the two production triggers that fire when an account goes
-- (log_todo_changes writes history with auth.uid() when assigned_to changes; _time_entry_guard refuses any owner change).
ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS status text, ADD COLUMN IF NOT EXISTS priority text, ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.todo_history ADD COLUMN IF NOT EXISTS todo_id uuid, ADD COLUMN IF NOT EXISTS field_name text,
  ADD COLUMN IF NOT EXISTS old_value text, ADD COLUMN IF NOT EXISTS new_value text, ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.todo_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.project_time_entries ADD COLUMN IF NOT EXISTS paused_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz, ADD COLUMN IF NOT EXISTS hourly_rate_pence integer;
CREATE OR REPLACE FUNCTION public.log_todo_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status, NEW.status);
  END IF;
  
  -- Log priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority, NEW.priority);
  END IF;
  
  -- Log assignment changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
  END IF;
  
  -- Log project changes
  IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
    INSERT INTO public.todo_history (todo_id, user_id, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'project_id', OLD.project_id::TEXT, NEW.project_id::TEXT);
  END IF;
  
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS log_todo_changes_trigger ON public.todos;
CREATE TRIGGER log_todo_changes_trigger BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.log_todo_changes();
CREATE OR REPLACE FUNCTION public._time_entry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE via_timer boolean := COALESCE(current_setting('app.time_rpc', true), '') = 'on';
        proj_org uuid;
BEGIN
  IF NOT via_timer THEN
    IF TG_OP = 'INSERT' AND NEW.end_time IS NULL THEN
      RAISE EXCEPTION 'TIME_RUNNING_VIA_TIMER_ONLY' USING ERRCODE = '22023', HINT = 'Use Start to begin a running timer.';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.paused_at IS NOT NULL THEN
      RAISE EXCEPTION 'TIME_PAUSE_VIA_TIMER_ONLY' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'TIME_OWNER_FIXED' USING ERRCODE = '22023';
      END IF;
      IF OLD.end_time IS NULL AND (NEW.start_time, NEW.end_time, NEW.paused_seconds, NEW.paused_at)
                                IS DISTINCT FROM (OLD.start_time, OLD.end_time, OLD.paused_seconds, OLD.paused_at) THEN
        RAISE EXCEPTION 'TIME_RUNNING_VIA_TIMER_ONLY' USING ERRCODE = '22023', HINT = 'Stop the timer first.';
      END IF;
      IF NEW.paused_at IS DISTINCT FROM OLD.paused_at THEN
        RAISE EXCEPTION 'TIME_PAUSE_VIA_TIMER_ONLY' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF (TG_OP = 'INSERT' OR (NEW.start_time, NEW.end_time) IS DISTINCT FROM (OLD.start_time, OLD.end_time))
       AND (NEW.start_time > now() OR NEW.end_time > now()) THEN
      RAISE EXCEPTION 'TIME_IN_FUTURE' USING ERRCODE = '22023', HINT = 'Entries cannot be in the future.';
    END IF;
  END IF;
  NEW.description := NULLIF(btrim(COALESCE(NEW.description, '')), '');
  IF NEW.project_id IS NOT NULL THEN
    SELECT p.organization_id INTO proj_org FROM public.projects p WHERE p.id = NEW.project_id;
    IF proj_org IS NOT NULL THEN NEW.company_id := proj_org; END IF;
  END IF;
  IF NEW.hourly_rate_pence IS NULL AND NEW.hourly_rate IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate) THEN
    NEW.hourly_rate_pence := round(NEW.hourly_rate * 100)::integer;
  END IF;
  NEW.hourly_rate := CASE WHEN NEW.hourly_rate_pence IS NULL THEN NULL ELSE NEW.hourly_rate_pence / 100.0 END;
  NEW.duration_minutes := CASE WHEN NEW.end_time IS NULL THEN 0
    ELSE GREATEST(0, floor((extract(epoch FROM NEW.end_time - NEW.start_time) - NEW.paused_seconds) / 60))::integer END;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS time_entry_guard ON public.project_time_entries;
CREATE TRIGGER time_entry_guard BEFORE INSERT OR UPDATE ON public.project_time_entries FOR EACH ROW EXECUTE FUNCTION public._time_entry_guard();
-- hmrc_settings: one row per person and company, as in production.
ALTER TABLE public.hmrc_settings DROP CONSTRAINT IF EXISTS hmrc_settings_user_id_organization_id_key;
ALTER TABLE public.hmrc_settings ADD CONSTRAINT hmrc_settings_user_id_organization_id_key UNIQUE (user_id, organization_id);

DO $fx$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advertisements_user_id_fkey' AND conrelid = 'public.advertisements'::regclass) THEN
    BEGIN ALTER TABLE public.advertisements ADD CONSTRAINT advertisements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP advertisements_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_credit_ledger_user_id_fkey' AND conrelid = 'public.ai_credit_ledger'::regclass) THEN
    BEGIN ALTER TABLE public.ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_credit_ledger_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_credit_lots_pack_id_fkey' AND conrelid = 'public.ai_credit_lots'::regclass) THEN
    BEGIN ALTER TABLE public.ai_credit_lots ADD CONSTRAINT ai_credit_lots_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.ai_topup_packs(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_credit_lots_pack_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_credit_lots_user_id_fkey' AND conrelid = 'public.ai_credit_lots'::regclass) THEN
    BEGIN ALTER TABLE public.ai_credit_lots ADD CONSTRAINT ai_credit_lots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_credit_lots_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_topup_checkouts_pack_id_fkey' AND conrelid = 'public.ai_topup_checkouts'::regclass) THEN
    BEGIN ALTER TABLE public.ai_topup_checkouts ADD CONSTRAINT ai_topup_checkouts_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.ai_topup_packs(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_topup_checkouts_pack_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_topup_checkouts_user_id_fkey' AND conrelid = 'public.ai_topup_checkouts'::regclass) THEN
    BEGIN ALTER TABLE public.ai_topup_checkouts ADD CONSTRAINT ai_topup_checkouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_topup_checkouts_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_workspaces_user_id_fkey' AND conrelid = 'public.ai_workspaces'::regclass) THEN
    BEGIN ALTER TABLE public.ai_workspaces ADD CONSTRAINT ai_workspaces_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP ai_workspaces_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bank_transactions_bank_account_id_fkey' AND conrelid = 'public.bank_transactions'::regclass) THEN
    BEGIN ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP bank_transactions_bank_account_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_organization_id_fkey' AND conrelid = 'public.bills'::regclass) THEN
    BEGIN ALTER TABLE public.bills ADD CONSTRAINT bills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP bills_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bills_user_id_fkey' AND conrelid = 'public.bills'::regclass) THEN
    BEGIN ALTER TABLE public.bills ADD CONSTRAINT bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP bills_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_created_by_fkey' AND conrelid = 'public.companies'::regclass) THEN
    BEGIN ALTER TABLE public.companies ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP companies_created_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_deals_contact_id_fkey' AND conrelid = 'public.crm_deals'::regclass) THEN
    BEGIN ALTER TABLE public.crm_deals ADD CONSTRAINT crm_deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.crm_contacts(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP crm_deals_contact_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'demo_readonly_users_user_id_fkey' AND conrelid = 'public.demo_readonly_users'::regclass) THEN
    BEGIN ALTER TABLE public.demo_readonly_users ADD CONSTRAINT demo_readonly_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP demo_readonly_users_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_email_log_user_id_fkey' AND conrelid = 'public.document_email_log'::regclass) THEN
    BEGIN ALTER TABLE public.document_email_log ADD CONSTRAINT document_email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP document_email_log_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_user_id_fkey' AND conrelid = 'public.documents'::regclass) THEN
    BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP documents_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_optouts_user_id_fkey' AND conrelid = 'public.email_optouts'::regclass) THEN
    BEGIN ALTER TABLE public.email_optouts ADD CONSTRAINT email_optouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP email_optouts_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_organization_id_fkey' AND conrelid = 'public.expenses'::regclass) THEN
    BEGIN ALTER TABLE public.expenses ADD CONSTRAINT expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP expenses_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_supplier_id_fkey' AND conrelid = 'public.expenses'::regclass) THEN
    BEGIN ALTER TABLE public.expenses ADD CONSTRAINT expenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP expenses_supplier_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_requests_user_id_fkey' AND conrelid = 'public.feedback_requests'::regclass) THEN
    BEGIN ALTER TABLE public.feedback_requests ADD CONSTRAINT feedback_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP feedback_requests_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forum_replies_post_id_fkey' AND conrelid = 'public.forum_replies'::regclass) THEN
    BEGIN ALTER TABLE public.forum_replies ADD CONSTRAINT forum_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP forum_replies_post_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'free_tool_items_user_id_fkey' AND conrelid = 'public.free_tool_items'::regclass) THEN
    BEGIN ALTER TABLE public.free_tool_items ADD CONSTRAINT free_tool_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP free_tool_items_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_connections_company_id_fkey' AND conrelid = 'public.hmrc_connections'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_connections ADD CONSTRAINT hmrc_connections_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_connections_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_connections_connected_by_fkey' AND conrelid = 'public.hmrc_connections'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_connections ADD CONSTRAINT hmrc_connections_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_connections_connected_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_integrations_organization_id_fkey' AND conrelid = 'public.hmrc_integrations'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_integrations ADD CONSTRAINT hmrc_integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_integrations_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_integrations_user_id_fkey' AND conrelid = 'public.hmrc_integrations'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_integrations ADD CONSTRAINT hmrc_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_integrations_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_oauth_states_company_id_fkey' AND conrelid = 'public.hmrc_oauth_states'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_oauth_states ADD CONSTRAINT hmrc_oauth_states_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_oauth_states_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_oauth_states_user_id_fkey' AND conrelid = 'public.hmrc_oauth_states'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_oauth_states ADD CONSTRAINT hmrc_oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_oauth_states_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_settings_organization_id_fkey' AND conrelid = 'public.hmrc_settings'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_settings ADD CONSTRAINT hmrc_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_settings_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_settings_user_id_fkey' AND conrelid = 'public.hmrc_settings'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_settings ADD CONSTRAINT hmrc_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_settings_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_submission_logs_organization_id_fkey' AND conrelid = 'public.hmrc_submission_logs'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_submission_logs ADD CONSTRAINT hmrc_submission_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_submission_logs_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_submission_logs_user_id_fkey' AND conrelid = 'public.hmrc_submission_logs'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_submission_logs ADD CONSTRAINT hmrc_submission_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_submission_logs_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hmrc_vat_submissions_organization_id_fkey' AND conrelid = 'public.hmrc_vat_submissions'::regclass) THEN
    BEGIN ALTER TABLE public.hmrc_vat_submissions ADD CONSTRAINT hmrc_vat_submissions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP hmrc_vat_submissions_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_organization_id_fkey' AND conrelid = 'public.invoices'::regclass) THEN
    BEGIN ALTER TABLE public.invoices ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP invoices_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_postings_company_id_fkey' AND conrelid = 'public.job_postings'::regclass) THEN
    BEGIN ALTER TABLE public.job_postings ADD CONSTRAINT job_postings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP job_postings_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketing_campaigns_audience_id_fkey' AND conrelid = 'public.marketing_campaigns'::regclass) THEN
    BEGIN ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_audience_id_fkey FOREIGN KEY (audience_id) REFERENCES public.marketing_audiences(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP marketing_campaigns_audience_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketing_consents_user_id_fkey' AND conrelid = 'public.marketing_consents'::regclass) THEN
    BEGIN ALTER TABLE public.marketing_consents ADD CONSTRAINT marketing_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP marketing_consents_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketing_content_items_campaign_id_fkey' AND conrelid = 'public.marketing_content_items'::regclass) THEN
    BEGIN ALTER TABLE public.marketing_content_items ADD CONSTRAINT marketing_content_items_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP marketing_content_items_campaign_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketing_content_items_todo_id_fkey' AND conrelid = 'public.marketing_content_items'::regclass) THEN
    BEGIN ALTER TABLE public.marketing_content_items ADD CONSTRAINT marketing_content_items_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todos(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP marketing_content_items_todo_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_access_user_id_fkey' AND conrelid = 'public.master_access'::regclass) THEN
    BEGIN ALTER TABLE public.master_access ADD CONSTRAINT master_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP master_access_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_categories_parent_id_fkey' AND conrelid = 'public.note_categories'::regclass) THEN
    BEGIN ALTER TABLE public.note_categories ADD CONSTRAINT note_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.note_categories(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP note_categories_parent_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_category_id_fkey' AND conrelid = 'public.notes'::regclass) THEN
    BEGIN ALTER TABLE public.notes ADD CONSTRAINT notes_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.note_categories(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP notes_category_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_type_prefs_user_id_fkey' AND conrelid = 'public.notification_type_prefs'::regclass) THEN
    BEGIN ALTER TABLE public.notification_type_prefs ADD CONSTRAINT notification_type_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP notification_type_prefs_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey' AND conrelid = 'public.notifications'::regclass) THEN
    BEGIN ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP notifications_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_email_outbox_organization_id_fkey' AND conrelid = 'public.onboarding_email_outbox'::regclass) THEN
    BEGIN ALTER TABLE public.onboarding_email_outbox ADD CONSTRAINT onboarding_email_outbox_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP onboarding_email_outbox_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_billing_billing_user_id_fkey' AND conrelid = 'public.organization_billing'::regclass) THEN
    BEGIN ALTER TABLE public.organization_billing ADD CONSTRAINT organization_billing_billing_user_id_fkey FOREIGN KEY (billing_user_id) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_billing_billing_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_billing_organization_id_fkey' AND conrelid = 'public.organization_billing'::regclass) THEN
    BEGIN ALTER TABLE public.organization_billing ADD CONSTRAINT organization_billing_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_billing_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_invitations_invited_by_fkey' AND conrelid = 'public.organization_invitations'::regclass) THEN
    BEGIN ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_invitations_invited_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_invitations_organization_id_fkey' AND conrelid = 'public.organization_invitations'::regclass) THEN
    BEGIN ALTER TABLE public.organization_invitations ADD CONSTRAINT organization_invitations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_invitations_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_invited_by_fkey' AND conrelid = 'public.organization_members'::regclass) THEN
    BEGIN ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_members_invited_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_organization_id_fkey' AND conrelid = 'public.organization_members'::regclass) THEN
    BEGIN ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_members_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_id_fkey' AND conrelid = 'public.organization_members'::regclass) THEN
    BEGIN ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organization_members_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_created_by_fkey' AND conrelid = 'public.organizations'::regclass) THEN
    BEGIN ALTER TABLE public.organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP organizations_created_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outgoings_supplier_id_fkey' AND conrelid = 'public.outgoings'::regclass) THEN
    BEGIN ALTER TABLE public.outgoings ADD CONSTRAINT outgoings_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP outgoings_supplier_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_notifications_payment_id_fkey' AND conrelid = 'public.payment_notifications'::regclass) THEN
    BEGIN ALTER TABLE public.payment_notifications ADD CONSTRAINT payment_notifications_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP payment_notifications_payment_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_user_id_fkey' AND conrelid = 'public.payments'::regclass) THEN
    BEGIN ALTER TABLE public.payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP payments_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_run_items_employee_id_fkey' AND conrelid = 'public.payroll_run_items'::regclass) THEN
    BEGIN ALTER TABLE public.payroll_run_items ADD CONSTRAINT payroll_run_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.payroll_employees(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP payroll_run_items_employee_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_run_items_run_id_fkey' AND conrelid = 'public.payroll_run_items'::regclass) THEN
    BEGIN ALTER TABLE public.payroll_run_items ADD CONSTRAINT payroll_run_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP payroll_run_items_run_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_submissions_run_id_fkey' AND conrelid = 'public.payroll_submissions'::regclass) THEN
    BEGIN ALTER TABLE public.payroll_submissions ADD CONSTRAINT payroll_submissions_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP payroll_submissions_run_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_plan_prices_plan_key_fkey' AND conrelid = 'public.platform_plan_prices'::regclass) THEN
    BEGIN ALTER TABLE public.platform_plan_prices ADD CONSTRAINT platform_plan_prices_plan_key_fkey FOREIGN KEY (plan_key) REFERENCES public.platform_plans(key) ON UPDATE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP platform_plan_prices_plan_key_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_post_id_fkey' AND conrelid = 'public.post_comments'::regclass) THEN
    BEGIN ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP post_comments_post_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_likes_post_id_fkey' AND conrelid = 'public.post_likes'::regclass) THEN
    BEGIN ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP post_likes_post_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey' AND conrelid = 'public.profiles'::regclass) THEN
    BEGIN ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP profiles_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_activities_project_id_fkey' AND conrelid = 'public.project_activities'::regclass) THEN
    BEGIN ALTER TABLE public.project_activities ADD CONSTRAINT project_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_activities_project_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_fkey' AND conrelid = 'public.project_members'::regclass) THEN
    BEGIN ALTER TABLE public.project_members ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_members_project_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_user_id_fkey' AND conrelid = 'public.project_members'::regclass) THEN
    BEGIN ALTER TABLE public.project_members ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_members_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_share_logs_project_id_fkey' AND conrelid = 'public.project_share_logs'::regclass) THEN
    BEGIN ALTER TABLE public.project_share_logs ADD CONSTRAINT project_share_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_share_logs_project_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_time_entries_company_id_fkey' AND conrelid = 'public.project_time_entries'::regclass) THEN
    BEGIN ALTER TABLE public.project_time_entries ADD CONSTRAINT project_time_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_time_entries_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_time_entries_project_id_fkey' AND conrelid = 'public.project_time_entries'::regclass) THEN
    BEGIN ALTER TABLE public.project_time_entries ADD CONSTRAINT project_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_time_entries_project_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_time_entries_user_id_fkey' AND conrelid = 'public.project_time_entries'::regclass) THEN
    BEGIN ALTER TABLE public.project_time_entries ADD CONSTRAINT project_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP project_time_entries_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_organization_id_fkey' AND conrelid = 'public.projects'::regclass) THEN
    BEGIN ALTER TABLE public.projects ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP projects_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_employees_organization_id_fkey' AND conrelid = 'public.rota_employees'::regclass) THEN
    BEGIN ALTER TABLE public.rota_employees ADD CONSTRAINT rota_employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_employees_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_employees_user_id_fkey' AND conrelid = 'public.rota_employees'::regclass) THEN
    BEGIN ALTER TABLE public.rota_employees ADD CONSTRAINT rota_employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_employees_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_allowances_company_id_fkey' AND conrelid = 'public.rota_leave_allowances'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_allowances ADD CONSTRAINT rota_leave_allowances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_allowances_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_allowances_employee_id_fkey' AND conrelid = 'public.rota_leave_allowances'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_allowances ADD CONSTRAINT rota_leave_allowances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.rota_employees(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_allowances_employee_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_allowances_set_by_fkey' AND conrelid = 'public.rota_leave_allowances'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_allowances ADD CONSTRAINT rota_leave_allowances_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_allowances_set_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_requests_cancelled_by_fkey' AND conrelid = 'public.rota_leave_requests'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_requests ADD CONSTRAINT rota_leave_requests_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_requests_cancelled_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_requests_company_id_fkey' AND conrelid = 'public.rota_leave_requests'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_requests ADD CONSTRAINT rota_leave_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_requests_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_requests_decided_by_fkey' AND conrelid = 'public.rota_leave_requests'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_requests ADD CONSTRAINT rota_leave_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_requests_decided_by_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_requests_employee_id_fkey' AND conrelid = 'public.rota_leave_requests'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_requests ADD CONSTRAINT rota_leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.rota_employees(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_requests_employee_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_leave_requests_requester_user_id_fkey' AND conrelid = 'public.rota_leave_requests'::regclass) THEN
    BEGIN ALTER TABLE public.rota_leave_requests ADD CONSTRAINT rota_leave_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_leave_requests_requester_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_shifts_employee_id_fkey' AND conrelid = 'public.rota_shifts'::regclass) THEN
    BEGIN ALTER TABLE public.rota_shifts ADD CONSTRAINT rota_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.rota_employees(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_shifts_employee_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_shifts_organization_id_fkey' AND conrelid = 'public.rota_shifts'::regclass) THEN
    BEGIN ALTER TABLE public.rota_shifts ADD CONSTRAINT rota_shifts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_shifts_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rota_week_publications_organization_id_fkey' AND conrelid = 'public.rota_week_publications'::regclass) THEN
    BEGIN ALTER TABLE public.rota_week_publications ADD CONSTRAINT rota_week_publications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP rota_week_publications_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_posts_company_id_fkey' AND conrelid = 'public.social_posts'::regclass) THEN
    BEGIN ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP social_posts_company_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_posts_user_id_fkey' AND conrelid = 'public.social_posts'::regclass) THEN
    BEGIN ALTER TABLE public.social_posts ADD CONSTRAINT social_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP social_posts_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staking_rewards_stake_id_fkey' AND conrelid = 'public.staking_rewards'::regclass) THEN
    BEGIN ALTER TABLE public.staking_rewards ADD CONSTRAINT staking_rewards_stake_id_fkey FOREIGN KEY (stake_id) REFERENCES public.user_stakes(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP staking_rewards_stake_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staking_rewards_user_id_fkey' AND conrelid = 'public.staking_rewards'::regclass) THEN
    BEGIN ALTER TABLE public.staking_rewards ADD CONSTRAINT staking_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP staking_rewards_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staking_transactions_stake_id_fkey' AND conrelid = 'public.staking_transactions'::regclass) THEN
    BEGIN ALTER TABLE public.staking_transactions ADD CONSTRAINT staking_transactions_stake_id_fkey FOREIGN KEY (stake_id) REFERENCES public.user_stakes(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP staking_transactions_stake_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscribers_user_id_fkey' AND conrelid = 'public.subscribers'::regclass) THEN
    BEGIN ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP subscribers_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_agents_organization_id_fkey' AND conrelid = 'public.support_agents'::regclass) THEN
    BEGIN ALTER TABLE public.support_agents ADD CONSTRAINT support_agents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_agents_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_attachments_message_id_fkey' AND conrelid = 'public.support_attachments'::regclass) THEN
    BEGIN ALTER TABLE public.support_attachments ADD CONSTRAINT support_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.support_messages(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_attachments_message_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_attachments_ticket_id_fkey' AND conrelid = 'public.support_attachments'::regclass) THEN
    BEGIN ALTER TABLE public.support_attachments ADD CONSTRAINT support_attachments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_attachments_ticket_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_categories_organization_id_fkey' AND conrelid = 'public.support_categories'::regclass) THEN
    BEGIN ALTER TABLE public.support_categories ADD CONSTRAINT support_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_categories_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_customers_organization_id_fkey' AND conrelid = 'public.support_customers'::regclass) THEN
    BEGIN ALTER TABLE public.support_customers ADD CONSTRAINT support_customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_customers_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_email_outbox_message_id_fkey' AND conrelid = 'public.support_email_outbox'::regclass) THEN
    BEGIN ALTER TABLE public.support_email_outbox ADD CONSTRAINT support_email_outbox_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.support_messages(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_email_outbox_message_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_email_outbox_ticket_id_fkey' AND conrelid = 'public.support_email_outbox'::regclass) THEN
    BEGIN ALTER TABLE public.support_email_outbox ADD CONSTRAINT support_email_outbox_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_email_outbox_ticket_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_messages_ticket_id_fkey' AND conrelid = 'public.support_messages'::regclass) THEN
    BEGIN ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_messages_ticket_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_notification_prefs_organization_id_fkey' AND conrelid = 'public.support_notification_prefs'::regclass) THEN
    BEGIN ALTER TABLE public.support_notification_prefs ADD CONSTRAINT support_notification_prefs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_notification_prefs_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_settings_organization_id_fkey' AND conrelid = 'public.support_settings'::regclass) THEN
    BEGIN ALTER TABLE public.support_settings ADD CONSTRAINT support_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_settings_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_ticket_feedback_organization_id_fkey' AND conrelid = 'public.support_ticket_feedback'::regclass) THEN
    BEGIN ALTER TABLE public.support_ticket_feedback ADD CONSTRAINT support_ticket_feedback_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_ticket_feedback_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_ticket_feedback_ticket_id_fkey' AND conrelid = 'public.support_ticket_feedback'::regclass) THEN
    BEGIN ALTER TABLE public.support_ticket_feedback ADD CONSTRAINT support_ticket_feedback_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_ticket_feedback_ticket_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_category_id_fkey' AND conrelid = 'public.support_tickets'::regclass) THEN
    BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.support_categories(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_tickets_category_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_organization_id_fkey' AND conrelid = 'public.support_tickets'::regclass) THEN
    BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP support_tickets_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_team_id_fkey' AND conrelid = 'public.team_members'::regclass) THEN
    BEGIN ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP team_members_team_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_fkey' AND conrelid = 'public.team_members'::regclass) THEN
    BEGIN ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP team_members_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_organization_id_fkey' AND conrelid = 'public.teams'::regclass) THEN
    BEGIN ALTER TABLE public.teams ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP teams_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teams_owner_id_fkey' AND conrelid = 'public.teams'::regclass) THEN
    BEGIN ALTER TABLE public.teams ADD CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP teams_owner_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'template_applications_organization_id_fkey' AND conrelid = 'public.template_applications'::regclass) THEN
    BEGIN ALTER TABLE public.template_applications ADD CONSTRAINT template_applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP template_applications_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_tracker_settings_user_id_fkey' AND conrelid = 'public.time_tracker_settings'::regclass) THEN
    BEGIN ALTER TABLE public.time_tracker_settings ADD CONSTRAINT time_tracker_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP time_tracker_settings_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_comments_todo_id_fkey' AND conrelid = 'public.todo_comments'::regclass) THEN
    BEGIN ALTER TABLE public.todo_comments ADD CONSTRAINT todo_comments_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todos(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todo_comments_todo_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_comments_user_id_fkey' AND conrelid = 'public.todo_comments'::regclass) THEN
    BEGIN ALTER TABLE public.todo_comments ADD CONSTRAINT todo_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todo_comments_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_history_todo_id_fkey' AND conrelid = 'public.todo_history'::regclass) THEN
    BEGIN ALTER TABLE public.todo_history ADD CONSTRAINT todo_history_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todos(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todo_history_todo_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_history_user_id_fkey' AND conrelid = 'public.todo_history'::regclass) THEN
    BEGIN ALTER TABLE public.todo_history ADD CONSTRAINT todo_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todo_history_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_subtasks_todo_id_fkey' AND conrelid = 'public.todo_subtasks'::regclass) THEN
    BEGIN ALTER TABLE public.todo_subtasks ADD CONSTRAINT todo_subtasks_todo_id_fkey FOREIGN KEY (todo_id) REFERENCES public.todos(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todo_subtasks_todo_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_assigned_to_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_assigned_to_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_organization_id_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_organization_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_parent_id_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.todos(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_parent_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_project_id_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_project_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_reporter_id_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_reporter_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todos_user_id_fkey' AND conrelid = 'public.todos'::regclass) THEN
    BEGIN ALTER TABLE public.todos ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP todos_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_email_log_outbox_id_fkey' AND conrelid = 'public.trial_email_log'::regclass) THEN
    BEGIN ALTER TABLE public.trial_email_log ADD CONSTRAINT trial_email_log_outbox_id_fkey FOREIGN KEY (outbox_id) REFERENCES public.trial_email_outbox(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP trial_email_log_outbox_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_email_log_user_id_fkey' AND conrelid = 'public.trial_email_log'::regclass) THEN
    BEGIN ALTER TABLE public.trial_email_log ADD CONSTRAINT trial_email_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP trial_email_log_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_email_outbox_user_id_fkey' AND conrelid = 'public.trial_email_outbox'::regclass) THEN
    BEGIN ALTER TABLE public.trial_email_outbox ADD CONSTRAINT trial_email_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP trial_email_outbox_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_documents_document_id_fkey' AND conrelid = 'public.user_documents'::regclass) THEN
    BEGIN ALTER TABLE public.user_documents ADD CONSTRAINT user_documents_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_documents_document_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_documents_user_id_fkey' AND conrelid = 'public.user_documents'::regclass) THEN
    BEGIN ALTER TABLE public.user_documents ADD CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_documents_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorite_tools_user_id_fkey' AND conrelid = 'public.user_favorite_tools'::regclass) THEN
    BEGIN ALTER TABLE public.user_favorite_tools ADD CONSTRAINT user_favorite_tools_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_favorite_tools_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorites_document_id_fkey' AND conrelid = 'public.user_favorites'::regclass) THEN
    BEGIN ALTER TABLE public.user_favorites ADD CONSTRAINT user_favorites_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_favorites_document_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_favorites_user_id_fkey' AND conrelid = 'public.user_favorites'::regclass) THEN
    BEGIN ALTER TABLE public.user_favorites ADD CONSTRAINT user_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id); EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_favorites_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_integrations_user_id_fkey' AND conrelid = 'public.user_integrations'::regclass) THEN
    BEGIN ALTER TABLE public.user_integrations ADD CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_integrations_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_preferences_user_id_fkey' AND conrelid = 'public.user_notification_preferences'::regclass) THEN
    BEGIN ALTER TABLE public.user_notification_preferences ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_notification_preferences_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey' AND conrelid = 'public.user_roles'::regclass) THEN
    BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_roles_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_stakes_user_id_fkey' AND conrelid = 'public.user_stakes'::regclass) THEN
    BEGIN ALTER TABLE public.user_stakes ADD CONSTRAINT user_stakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_stakes_user_id_fkey: %', SQLERRM; END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_stakes_wallet_link_id_fkey' AND conrelid = 'public.user_stakes'::regclass) THEN
    BEGIN ALTER TABLE public.user_stakes ADD CONSTRAINT user_stakes_wallet_link_id_fkey FOREIGN KEY (wallet_link_id) REFERENCES public.staking_wallet_links(id) ON DELETE SET NULL; EXCEPTION WHEN undefined_column OR undefined_table OR invalid_foreign_key OR datatype_mismatch THEN RAISE NOTICE 'FIXTURE_SKIP user_stakes_wallet_link_id_fkey: %', SQLERRM; END;
  END IF;
END $fx$;
COMMIT;
