-- =====================================================================================================================
-- HMRC P7b ROLLBACK. Puts production back exactly as before docs/hmrc-p7b/proposal.sql, in one transaction:
-- the two immutability guards get their production bodies back (no gate), the new triggers, policy, functions and
-- tables go, organizations.closed_at goes, and public.hmrc_integrations is recreated EMPTY with its original columns,
-- keys, indexes, policies, triggers and grants (it had 0 rows when it was dropped).
-- REFUSES (changes nothing) while a company is closed, or after an account deletion or company closure was completed:
-- those can't be undone, and their record (data_rights_requests) must not be thrown away. There is no force switch.
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.data_rights_requests') IS NULL THEN RAISE EXCEPTION 'HMRC P7b is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.organizations WHERE closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'a company is closed: rolling back would reopen an empty shell. Not rolled back.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.data_rights_requests WHERE kind IN ('account_delete', 'company_close') AND status = 'done') THEN
    RAISE EXCEPTION 'an account deletion or company closure has been completed: its permanent record stays. Not rolled back.';
  END IF;
END $$;

DROP POLICY data_rights_hide_closed ON public.organizations;
DROP TRIGGER data_rights_org_guard ON public.organizations;
DROP TRIGGER data_rights_closed_company ON public.organization_members;
DROP TRIGGER data_rights_closed_company ON public.organization_invitations;
DROP TRIGGER data_rights_closed_company ON public.hmrc_connections;
DROP TRIGGER data_rights_closed_company ON public.hmrc_oauth_states;
DROP TRIGGER data_rights_closed_company ON public.hmrc_vat_submissions;

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

CREATE OR REPLACE FUNCTION public._hmrc_audit_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'HMRC_AUDIT_APPEND_ONLY' USING ERRCODE = '42501', HINT = 'The HMRC audit log can only be added to.';
END;
$function$;

DROP FUNCTION public.hmrc_purge_expired_audit(boolean);
DROP FUNCTION public.data_rights_delete_account(uuid, uuid, boolean);
DROP FUNCTION public.data_rights_close_company(uuid, uuid, uuid, boolean);
DROP FUNCTION public._data_rights_close_org(uuid, uuid);
DROP FUNCTION public._data_rights_company_tables();
DROP FUNCTION public.data_rights_company_role(uuid, uuid);
DROP FUNCTION public.data_rights_finish(uuid, text, text);
DROP FUNCTION public.data_rights_take_slot(uuid, uuid, text, integer);
DROP FUNCTION public._data_rights_closed_company_guard();
DROP FUNCTION public._data_rights_org_guard();
DROP FUNCTION public._data_rights_gate_set(text, boolean);
DROP FUNCTION public._data_rights_gate_is_open(text);
DROP TABLE public.data_rights_requests;
DROP TABLE public._data_rights_gate;
ALTER TABLE public.organizations DROP COLUMN closed_at;

-- public.hmrc_integrations, empty, exactly as it was (read-only from production, 9 Nov 2026).
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

COMMIT;
