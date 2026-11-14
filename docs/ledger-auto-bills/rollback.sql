-- Finance phase 3b rollback (one transaction): removes bill and expense postings, puts the five replaced functions back to
-- their exact phase 3a bodies, and the CHECKs and ledger_auto_settings back to phase 3a. Refuses while any bill or
-- expense posting, automatic bill/expense journal or needs-attention row exists: they are business records, and the
-- phase 3a CHECKs would no longer hold. (Switching bills and expenses off is the way to stop them; it keeps every journal.)
-- Waiting queue rows for bills and expenses are short-lived and are removed.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ledger_category_map') IS NULL THEN RAISE EXCEPTION 'Finance phase 3b is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_postings WHERE source_table IN ('bills', 'expenses'))
     OR EXISTS (SELECT 1 FROM public.ledger_post_issues WHERE source_table IN ('bills', 'expenses'))
     OR EXISTS (SELECT 1 FROM public.journal_entries WHERE source_type IN ('auto_bill', 'auto_bill_payment', 'auto_expense')) THEN
    RAISE EXCEPTION 'the ledger holds bill or expense postings: rollback refused (switch bills and expenses off instead)';
  END IF;
END $$;

DELETE FROM public.ledger_post_queue WHERE source_table IN ('bills', 'expenses');
DROP TRIGGER ledger_auto_record ON public.bills;
DROP TRIGGER ledger_auto_record ON public.expenses;

-- The five replaced functions, exactly as phase 3a (docs/ledger-auto/proposal.sql) created them.
CREATE OR REPLACE FUNCTION public.ledger_process_queue(p_org uuid DEFAULT NULL, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE q record; v_processed integer := 0; v_failed integer := 0; v_dropped integer := 0; v_n integer; v_state text; v_label text;
BEGIN
  p_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
  -- Companies that may not run: their rows go.
  WITH gone AS (
    DELETE FROM public.ledger_post_queue q2 WHERE (p_org IS NULL OR q2.organization_id = p_org)
       AND NOT public._ledger_auto_org_ready(q2.organization_id) RETURNING 1)
  SELECT count(*) INTO v_dropped FROM gone;
  FOR q IN SELECT q3.organization_id, q3.source_id, max(q3.id) AS last_id, max(q3.attempts) AS attempts
             FROM public.ledger_post_queue q3 WHERE p_org IS NULL OR q3.organization_id = p_org
            GROUP BY q3.organization_id, q3.source_id ORDER BY min(q3.id) LIMIT p_limit LOOP
    BEGIN
      PERFORM public._ledger_auto_apply(q.organization_id, q.source_id);
      DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_state := SQLSTATE;
      v_failed := v_failed + 1;
      IF q.attempts + 1 >= 5 THEN
        DELETE FROM public.ledger_post_queue WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
        SELECT left(i.invoice_number, 120) INTO v_label FROM public.invoices i WHERE i.id = q.source_id;
        BEGIN
          PERFORM public._ledger_auto_issue(q.organization_id, q.source_id, v_label, 'invoice_issued', 'processing_failed');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      ELSE
        UPDATE public.ledger_post_queue SET attempts = q.attempts + 1, last_error = v_state
         WHERE organization_id = q.organization_id AND source_id = q.source_id AND id <= q.last_id;
      END IF;
    END;
  END LOOP;
  SELECT count(DISTINCT (organization_id, source_id)) INTO v_n FROM public.ledger_post_queue WHERE p_org IS NULL OR organization_id = p_org;
  RETURN jsonb_build_object('processed', v_processed, 'failed', v_failed, 'dropped', v_dropped, 'remaining', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_auto_status(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; a public.ledger_auto_settings;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule IN ('not_signed_in', 'not_member', 'closed') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO a FROM public.ledger_auto_settings WHERE organization_id = p_org;
  RETURN jsonb_build_object(
    'access', CASE WHEN v_rule IN ('ok', 'not_admin') THEN 'ok' ELSE v_rule END,
    'can_manage', v_rule = 'ok',
    'set_up', EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org),
    'invoices_enabled', COALESCE(a.invoices_enabled, false),
    'enabled_at', a.enabled_at,
    'waiting', (SELECT count(DISTINCT source_id) FROM public.ledger_post_queue q WHERE q.organization_id = p_org),
    'open_issues', (SELECT count(*) FROM public.ledger_post_issues i WHERE i.organization_id = p_org AND i.resolved_at IS NULL));
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_auto_set(p_org uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_was boolean;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_enabled IS NULL THEN RAISE EXCEPTION 'LEDGER_BAD_REQUEST' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  SELECT invoices_enabled INTO v_was FROM public.ledger_auto_settings WHERE organization_id = p_org;
  INSERT INTO public.ledger_auto_settings AS cur (organization_id, invoices_enabled, enabled_at, enabled_by, updated_at)
  VALUES (p_org, p_enabled, CASE WHEN p_enabled THEN now() END, CASE WHEN p_enabled THEN auth.uid() END, now())
  ON CONFLICT (organization_id) DO UPDATE SET invoices_enabled = EXCLUDED.invoices_enabled,
    enabled_at = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN now()
                      WHEN EXCLUDED.invoices_enabled THEN cur.enabled_at END,
    enabled_by = CASE WHEN EXCLUDED.invoices_enabled AND NOT cur.invoices_enabled THEN auth.uid()
                      WHEN EXCLUDED.invoices_enabled THEN cur.enabled_by END,
    updated_at = now();
  IF NOT p_enabled THEN DELETE FROM public.ledger_post_queue WHERE organization_id = p_org; END IF;
  IF v_was IS DISTINCT FROM p_enabled THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), CASE WHEN p_enabled THEN 'ledger.auto_invoices_on' ELSE 'ledger.auto_invoices_off' END, 'ledger_auto_settings', p_org::text,
            jsonb_build_object('organization_id', p_org));
  END IF;
  RETURN public.ledger_auto_status(p_org);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_auto_preview(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_rule text; r record; v_plan jsonb; v_k text; v_want jsonb; l public.ledger_postings; v_issue_live boolean;
  v_inv integer := 0; v_inv_p bigint := 0; v_pay integer := 0; v_pay_p bigint := 0; v_rev integer := 0; v_done integer := 0; v_none integer := 0;
  v_skip jsonb := '{}'::jsonb; v_reason text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT i.id FROM public.invoices i WHERE i.organization_id = p_org
           UNION SELECT p.source_id FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.reversed_at IS NULL LOOP
    v_plan := public._ledger_auto_plan(p_org, r.id);
    IF NOT (v_plan #>> '{issue,want}')::boolean AND v_plan #>> '{issue,reason}' IS NULL AND NOT EXISTS (
         SELECT 1 FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_id = r.id AND p.reversed_at IS NULL) THEN
      v_none := v_none + 1;
      CONTINUE;
    END IF;
    v_issue_live := false;
    FOREACH v_k IN ARRAY ARRAY['invoice_issued', 'invoice_paid'] LOOP
      v_want := v_plan -> CASE v_k WHEN 'invoice_paid' THEN 'payment' ELSE 'issue' END;
      SELECT * INTO l FROM public.ledger_postings p WHERE p.organization_id = p_org AND p.source_table = 'invoices' AND p.source_id = r.id AND p.kind = v_k AND p.reversed_at IS NULL;
      IF FOUND THEN
        IF (v_want ->> 'want')::boolean AND v_want ->> 'hash' = l.version_hash THEN
          v_done := v_done + 1;
          IF v_k = 'invoice_issued' THEN v_issue_live := true; END IF;
          CONTINUE;
        END IF;
        v_rev := v_rev + 1;
      END IF;
      IF (v_want ->> 'want')::boolean THEN
        IF v_k = 'invoice_issued' THEN v_inv := v_inv + 1; v_inv_p := v_inv_p + (v_want ->> 'total')::bigint; v_issue_live := true;
        ELSE v_pay := v_pay + 1; v_pay_p := v_pay_p + (v_want ->> 'total')::bigint; END IF;
      ELSIF v_want ->> 'reason' IS NOT NULL THEN
        v_reason := v_want ->> 'reason';
        v_skip := jsonb_set(v_skip, ARRAY[v_reason], to_jsonb(COALESCE((v_skip ->> v_reason)::integer, 0) + 1));
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('invoices_to_post', v_inv, 'invoices_total', v_inv_p, 'payments_to_post', v_pay, 'payments_total', v_pay_p,
    'to_reverse', v_rev, 'already_posted', v_done, 'not_issued', v_none, 'skipped', v_skip);
END;
$function$;

CREATE OR REPLACE FUNCTION public.ledger_auto_run(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_auto_settings a WHERE a.organization_id = p_org AND a.invoices_enabled) THEN
    RAISE EXCEPTION 'LEDGER_AUTO_OFF' USING ERRCODE = '22023';
  END IF;
  RETURN public.ledger_process_queue(p_org, 200);
END;
$function$;

DROP FUNCTION public.ledger_auto_catch_up(uuid, text);
DROP FUNCTION public.ledger_auto_set(uuid, boolean, text);
DROP FUNCTION public._ledger_auto_preview_records(uuid);
DROP FUNCTION public._ledger_auto_record_changed();
DROP FUNCTION public._ledger_auto_source_ready(uuid, text);
DROP FUNCTION public._ledger_auto_apply_record(uuid, text, uuid);
DROP FUNCTION public._ledger_auto_flag(uuid, text, uuid, text, text, text);
DROP FUNCTION public._ledger_auto_record_plan(uuid, text, uuid);
DROP FUNCTION public._ledger_auto_expense_plan(uuid, uuid);
DROP FUNCTION public._ledger_auto_bill_plan(uuid, uuid);
DROP FUNCTION public._ledger_auto_want(text, date, text, text, jsonb, bigint, text, text);
DROP FUNCTION public._ledger_auto_category_account(uuid, text);
DROP FUNCTION public._ledger_auto_seed_category_map(uuid);
DROP FUNCTION public._ledger_auto_default_categories();
DROP FUNCTION public._ledger_auto_category_key(text);
DROP TABLE public.ledger_category_map;
ALTER TABLE public.ledger_auto_settings DROP COLUMN bills_enabled;

ALTER TABLE public.journal_entries DROP CONSTRAINT je_source_type;
ALTER TABLE public.journal_entries ADD CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal', 'auto_invoice', 'auto_invoice_payment'));
ALTER TABLE public.ledger_post_queue DROP CONSTRAINT lpq_source_table;
ALTER TABLE public.ledger_post_queue ADD CONSTRAINT lpq_source_table CHECK (source_table = 'invoices');
ALTER TABLE public.ledger_postings DROP CONSTRAINT lp_source_table, DROP CONSTRAINT lp_kind;
ALTER TABLE public.ledger_postings ADD CONSTRAINT lp_source_table CHECK (source_table = 'invoices'),
  ADD CONSTRAINT lp_kind CHECK (kind IN ('invoice_issued', 'invoice_paid'));
ALTER TABLE public.ledger_post_issues DROP CONSTRAINT lpi_source_table, DROP CONSTRAINT lpi_kind, DROP CONSTRAINT lpi_reason;
ALTER TABLE public.ledger_post_issues ADD CONSTRAINT lpi_source_table CHECK (source_table = 'invoices'),
  ADD CONSTRAINT lpi_kind CHECK (kind IN ('invoice_issued', 'invoice_paid')),
  ADD CONSTRAINT lpi_reason CHECK (reason_code IN ('before_start', 'period_locked', 'amounts_do_not_add_up', 'amounts_missing',
    'not_whole_pence', 'zero_total', 'negative_amount', 'currency_not_gbp', 'paid_date_missing', 'issue_not_posted', 'reversal_period_locked', 'processing_failed'));

COMMIT;
