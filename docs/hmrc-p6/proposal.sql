-- =====================================================================================================================
-- HMRC P6: VAT return submissions to HMRC's TEST environment (sandbox), with an immutable record. PREPARED, NOT APPLIED.
-- ORDER (docs/hmrc-p6/README.md): 1 the owner reviews this; 2 it is applied after review; 3 the confirmation-token
-- secret is set; 4 hmrc-vat-submit is deployed; 5 the frontend is published.
--
-- Why a new table: public.hmrc_submission_logs (the old per-user log) can be written and changed from the browser and
-- has no company rule (docs/hmrc-vat-audit §5 item 5), so it can't be the record of what was sent. It is left as it is.
-- public.hmrc_audit_log (append-only since P0) is reused for the events.
--
-- What it adds (one transaction; any check failing changes nothing):
--   1. public.hmrc_vat_submissions: one row per attempt (company, environment 'sandbox' only, period key and dates,
--      the nine boxes exactly as sent and their SHA-256, request id, who and when, HMRC's receipt, HTTP status, a short
--      error code and message, the last 3 digits of the VAT number, the sandbox test scenario). Never a token, a bearer
--      value, a full VAT number or an HMRC response body.
--   2. One live submission per company, environment and period: a partial unique index over rows that are
--      'submitting', 'accepted' or 'unknown'. A 'rejected' attempt may be followed by a new one.
--   3. Immutable (trigger, for EVERYONE including service_role): no DELETE, no TRUNCATE; an INSERT must start as
--      'submitting' with no receipt; an UPDATE may only move submitting → accepted | rejected | unknown, or
--      unknown → accepted | rejected (after a check), set the receipt / result fields that are still empty, and
--      nothing else. Accepted and rejected rows stay forever.
--   4. RLS: owners and admins of the company (public.user_is_organization_admin) can SELECT their company's rows; the
--      Phase 25 restrictive require_aal2_if_enrolled policy applies; the browser can't INSERT, UPDATE or DELETE
--      (no grant). The Edge Function writes with the service role. Demo guard trigger (a0_demo_readonly_guard).
--   5. public.hmrc_begin_vat_submission(...): service role only. Under a per-company advisory lock it checks the rate
--      limit (5 attempts an hour per company), inserts the 'submitting' row (the unique index refuses a second live
--      one) and writes the vat_submit_start audit row, all in one transaction. Returns ok + the row id, 'limit' or
--      'already_live'.
--   6. hmrc_audit_log.event also allows vat_submit_start, vat_submit_result, vat_submit_unknown, vat_submit_check and
--      fraud_validate (codes only; hal_reason unchanged).
-- Not changed: hmrc_connections, hmrc_settings, hmrc_submission_logs, any existing policy or function.
--
-- Production facts this was written against (read-only, 8 Nov 2026, HMRC P0-P5 applied): 146 tables in public, no
-- hmrc_vat_submissions; hal_event = the ten P0-P3 events; md5(prosrc) _hmrc_audit_append_only
-- 8f283e3f58f0d54343cff1e44a86a49e, hmrc_manage_allowed 9304f069f05402aab62d343b3626cd65, user_is_organization_admin
-- c6dd628541413ec82565a6676a55a767, mfa_ok 20516f2ec203220b3ac08d1230c7c306, demo_readonly_guard
-- 087b5fe2695b95b8ba2ba6eb195ba995, hmrc_take_obligations_slot 58c7d543191e1960d2e6bd01ca643b0b,
-- vat_company_return_preview 9046b04074a9edd2adb2a45c838bb389. Anything else: refused.
-- Rollback: docs/hmrc-p6/rollback.sql (refuses while any submission exists). Tests: docs/hmrc-p6/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v_def text;
BEGIN
  IF to_regclass('public.hmrc_vat_submissions') IS NOT NULL OR to_regprocedure('public.hmrc_begin_vat_submission(uuid,uuid,text,text,date,date,jsonb,text,uuid,text,text,text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC P6 already exists (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 146 THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 8 Nov 2026';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public._hmrc_audit_append_only()', '8f283e3f58f0d54343cff1e44a86a49e'),
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'),
      ('public.user_is_organization_admin(uuid,uuid)', 'c6dd628541413ec82565a6676a55a767'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public.hmrc_take_obligations_slot(uuid,uuid,text,text,integer)', '58c7d543191e1960d2e6bd01ca643b0b'),
      ('public.vat_company_return_preview(uuid,date,date)', '9046b04074a9edd2adb2a45c838bb389')) v(fn, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from production (or is missing: apply HMRC P0-P5 first)', r.fn;
    END IF;
  END LOOP;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint WHERE conrelid = 'public.hmrc_audit_log'::regclass AND conname = 'hal_event';
  IF regexp_replace(COALESCE(v_def, ''), ' NOT VALID$', '') IS DISTINCT FROM
     'CHECK ((event = ANY (ARRAY[''connect_started''::text, ''connected''::text, ''refreshed''::text, ''refresh_failed''::text, ''disconnected''::text, ''refused''::text, ''test_call''::text, ''test_result''::text, ''obligations_call''::text, ''obligations_result''::text])))' THEN
    RAISE EXCEPTION 'hmrc_audit_log event rule differs from production';
  END IF;
  IF has_table_privilege('authenticated', 'public.hmrc_audit_log', 'SELECT') OR has_table_privilege('service_role', 'public.hmrc_audit_log', 'UPDATE')
     OR NOT has_table_privilege('service_role', 'public.hmrc_audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'hmrc_audit_log privileges differ from production';
  END IF;
END $$;

-- 1. The record of every attempt.
CREATE TABLE public.hmrc_vat_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  environment text NOT NULL DEFAULT 'sandbox' CONSTRAINT hvs_environment CHECK (environment = 'sandbox'),
  period_key text NOT NULL CONSTRAINT hvs_period_key CHECK (period_key ~ '^[A-Za-z0-9#]{4}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'submitting' CONSTRAINT hvs_status CHECK (status IN ('submitting', 'accepted', 'rejected', 'unknown')),
  figures jsonb NOT NULL CONSTRAINT hvs_figures CHECK (jsonb_typeof(figures) = 'object'),
  figures_hash text NOT NULL CONSTRAINT hvs_figures_hash CHECK (figures_hash ~ '^[0-9a-f]{64}$'),
  request_id uuid NOT NULL CONSTRAINT hvs_request_id UNIQUE,
  submitted_by uuid NOT NULL,
  submitted_by_name text CONSTRAINT hvs_submitted_by_name CHECK (submitted_by_name IS NULL OR length(submitted_by_name) <= 120),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  processing_date timestamptz,
  payment_indicator text CONSTRAINT hvs_payment_indicator CHECK (payment_indicator IS NULL OR payment_indicator IN ('DD', 'BANK')),
  form_bundle_number text CONSTRAINT hvs_form_bundle CHECK (form_bundle_number IS NULL OR form_bundle_number ~ '^[A-Za-z0-9]{1,40}$'),
  charge_ref_number text CONSTRAINT hvs_charge_ref CHECK (charge_ref_number IS NULL OR charge_ref_number ~ '^[A-Za-z0-9]{1,40}$'),
  http_status integer CONSTRAINT hvs_http_status CHECK (http_status IS NULL OR http_status BETWEEN 0 AND 599),
  error_code text CONSTRAINT hvs_error_code CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,60}$'),
  error_message text CONSTRAINT hvs_error_message CHECK (error_message IS NULL OR length(error_message) <= 300),
  vrn_last3 text CONSTRAINT hvs_vrn_last3 CHECK (vrn_last3 IS NULL OR vrn_last3 ~ '^[0-9]{3}$'),
  test_scenario text CONSTRAINT hvs_test_scenario CHECK (test_scenario IS NULL OR test_scenario ~ '^[A-Z0-9_]{1,60}$'),
  CONSTRAINT hvs_period CHECK (period_end >= period_start)
);
-- One live submission per company, environment and period (the idempotency guard): a rejected attempt may be retried.
CREATE UNIQUE INDEX hmrc_vat_submissions_one_live ON public.hmrc_vat_submissions (organization_id, environment, period_key)
  WHERE status IN ('submitting', 'accepted', 'unknown');
CREATE INDEX hmrc_vat_submissions_company ON public.hmrc_vat_submissions (organization_id, submitted_at DESC);

-- 2. Immutable: only the result can be completed, once; nothing is ever deleted (for everyone, service role included).
CREATE FUNCTION public._hmrc_vat_submission_guard()
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
  -- UPDATE: the identity and the figures never change.
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.period_key IS DISTINCT FROM OLD.period_key OR NEW.period_start IS DISTINCT FROM OLD.period_start OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.figures IS DISTINCT FROM OLD.figures OR NEW.figures_hash IS DISTINCT FROM OLD.figures_hash OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_by_name IS DISTINCT FROM OLD.submitted_by_name
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.vrn_last3 IS DISTINCT FROM OLD.vrn_last3 OR NEW.test_scenario IS DISTINCT FROM OLD.test_scenario THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: what was sent can never change' USING ERRCODE = '42501';
  END IF;
  -- The only moves: submitting -> accepted | rejected | unknown; unknown -> accepted | rejected (after a check).
  IF NOT ((OLD.status = 'submitting' AND NEW.status IN ('accepted', 'rejected', 'unknown'))
          OR (OLD.status = 'unknown' AND NEW.status IN ('accepted', 'rejected'))) THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: % can''t become %', OLD.status, NEW.status USING ERRCODE = '42501';
  END IF;
  -- Result fields are written once: a value already set can't be changed.
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
REVOKE ALL ON FUNCTION public._hmrc_vat_submission_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hmrc_vat_submissions FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER hmrc_vat_submissions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.hmrc_vat_submissions FOR EACH ROW EXECUTE FUNCTION public._hmrc_vat_submission_guard();
CREATE TRIGGER hmrc_vat_submissions_no_truncate BEFORE TRUNCATE ON public.hmrc_vat_submissions FOR EACH STATEMENT EXECUTE FUNCTION public._hmrc_vat_submission_guard();

-- 3. Access: owners and admins read their company's rows; the browser writes nothing; the Edge Function (service role)
--    inserts and completes rows (no DELETE grant for anyone).
ALTER TABLE public.hmrc_vat_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hmrc_vat_submissions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.hmrc_vat_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.hmrc_vat_submissions TO service_role;
CREATE POLICY "Company owners and admins can read VAT submissions" ON public.hmrc_vat_submissions FOR SELECT TO authenticated
  USING (public.user_is_organization_admin(organization_id, (SELECT auth.uid())));
CREATE POLICY require_aal2_if_enrolled ON public.hmrc_vat_submissions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));

-- 4. More audit events (codes only).
ALTER TABLE public.hmrc_audit_log DROP CONSTRAINT hal_event;
ALTER TABLE public.hmrc_audit_log ADD CONSTRAINT hal_event CHECK (event IN ('connect_started', 'connected', 'refreshed', 'refresh_failed', 'disconnected', 'refused',
  'test_call', 'test_result', 'obligations_call', 'obligations_result',
  'vat_submit_start', 'vat_submit_result', 'vat_submit_unknown', 'vat_submit_check', 'fraud_validate'));

-- 5. Rate limit + the 'submitting' row + the start event, in one transaction.
CREATE FUNCTION public.hmrc_begin_vat_submission(p_company uuid, p_user uuid, p_environment text, p_period_key text, p_period_start date, p_period_end date,
  p_figures jsonb, p_figures_hash text, p_request_id uuid, p_vrn_last3 text, p_test_scenario text, p_user_name text, p_limit integer DEFAULT 5)
 RETURNS TABLE(result text, submission_id uuid)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_company IS NULL OR p_user IS NULL THEN RETURN QUERY SELECT 'bad_request'::text, NULL::uuid; RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('hmrc_vat_submit:' || p_company::text, 0));
  IF (SELECT count(*) FROM public.hmrc_vat_submissions s WHERE s.organization_id = p_company AND s.submitted_at > now() - interval '1 hour')
     >= least(greatest(COALESCE(p_limit, 5), 1), 20) THEN
    RETURN QUERY SELECT 'limit'::text, NULL::uuid; RETURN;
  END IF;
  BEGIN
    INSERT INTO public.hmrc_vat_submissions (organization_id, environment, period_key, period_start, period_end, figures, figures_hash, request_id,
      submitted_by, submitted_by_name, vrn_last3, test_scenario)
    VALUES (p_company, p_environment, p_period_key, p_period_start, p_period_end, p_figures, p_figures_hash, p_request_id,
      p_user, left(nullif(btrim(p_user_name), ''), 120), p_vrn_last3, p_test_scenario)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT 'already_live'::text, NULL::uuid; RETURN;
  END;
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason) VALUES (p_company, p_user, p_environment, 'vat_submit_start', 'submitting');
  RETURN QUERY SELECT 'ok'::text, v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.hmrc_begin_vat_submission(uuid, uuid, text, text, date, date, jsonb, text, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hmrc_begin_vat_submission(uuid, uuid, text, text, date, date, jsonb, text, uuid, text, text, text, integer) TO service_role;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.hmrc_vat_submissions', 'INSERT') OR has_table_privilege('authenticated', 'public.hmrc_vat_submissions', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.hmrc_vat_submissions', 'DELETE') OR has_table_privilege('anon', 'public.hmrc_vat_submissions', 'SELECT')
     OR has_table_privilege('service_role', 'public.hmrc_vat_submissions', 'DELETE')
     OR has_function_privilege('authenticated', 'public.hmrc_begin_vat_submission(uuid,uuid,text,text,date,date,jsonb,text,uuid,text,text,text,integer)', 'EXECUTE')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.hmrc_vat_submissions'::regclass) THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
