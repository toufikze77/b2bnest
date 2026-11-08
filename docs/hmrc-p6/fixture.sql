-- HMRC P6 local fixture: public.vat_company_return_preview exactly as applied in production (read 8 Nov 2026). It is
-- docs/hmrc-p5/proposal.sql's function without one comment line, which was dropped when it was applied
-- (md5(prosrc) 9046b04074a9edd2adb2a45c838bb389). Same logic. Loaded after the HMRC P5 proposal.
BEGIN;
CREATE OR REPLACE FUNCTION public.vat_company_return_preview(p_organization_id uuid, p_from date, p_to date)
 RETURNS TABLE(row_kind text, source text, treatment text, reason text, records bigint, net numeric, vat numeric, vat_not_reclaimable numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'VAT_PREVIEW_DENIED: sign in first' USING ERRCODE = '42501'; END IF;
  IF NOT public.mfa_ok() THEN RAISE EXCEPTION 'VAT_PREVIEW_DENIED: enter your authenticator code first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'VAT_PREVIEW_DENIED: the demo account has no VAT return' USING ERRCODE = '42501';
  END IF;
  v_rule := public.hmrc_manage_allowed(p_organization_id, auth.uid());
  IF v_rule IN ('trial_ended', 'suspended', 'plan_not_included') THEN
    RAISE EXCEPTION 'VAT_PREVIEW_PLAN: %', v_rule USING ERRCODE = '42501';
  END IF;
  IF v_rule IS DISTINCT FROM 'ok' THEN
    RAISE EXCEPTION 'VAT_PREVIEW_DENIED: only an owner or admin of this company can see its VAT return' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN RAISE EXCEPTION 'VAT_PREVIEW_INVALID: choose a valid period' USING ERRCODE = '22023'; END IF;

  RETURN QUERY
  WITH inv AS (
    SELECT i.id, i.items, i.vat_status, upper(btrim(coalesce(i.currency, ''))) AS cur, coalesce(i.status, '') AS st, i.archived_at,
           i.tax_point_date AS tp, (i.created_at AT TIME ZONE 'UTC')::date AS nd
      FROM public.invoices i WHERE i.organization_id = p_organization_id
  ), inv_in AS (
    SELECT * FROM inv WHERE vat_status = 'recorded' AND st <> 'draft' AND archived_at IS NULL AND cur = 'GBP' AND tp BETWEEN p_from AND p_to
  ), exp AS (
    SELECT e.id, e.vat_status, e.vat_treatment, e.net_amount, e.vat_amount, e.vat_reclaimable, e.tax_point_date AS tp, e.date AS nd,
           upper(btrim(coalesce(p.currency_code, ''))) AS cur
      FROM public.expenses e LEFT JOIN public.profiles p ON p.id = e.user_id WHERE e.organization_id = p_organization_id
  ), bil AS (
    SELECT b.id, b.vat_status, b.vat_treatment, b.net_amount, b.vat_amount, b.vat_reclaimable, b.tax_point_date AS tp, b.issue_date AS nd,
           upper(btrim(coalesce(b.currency, ''))) AS cur, b.status AS st
      FROM public.bills b WHERE b.organization_id = p_organization_id
  ), pur AS (
    SELECT 'expenses'::text AS src, x.id, x.vat_status, x.vat_treatment, x.net_amount, x.vat_amount, x.vat_reclaimable, x.tp, x.nd, x.cur, ''::text AS st FROM exp x
    UNION ALL
    SELECT 'bills'::text, y.id, y.vat_status, y.vat_treatment, y.net_amount, y.vat_amount, y.vat_reclaimable, y.tp, y.nd, y.cur, y.st FROM bil y
  ), pur_in AS (
    SELECT * FROM pur WHERE vat_status = 'recorded' AND st <> 'cancelled' AND cur = 'GBP' AND tp BETWEEN p_from AND p_to
  ), left_out AS (
    SELECT 'invoices'::text AS src,
           CASE WHEN archived_at IS NOT NULL THEN 'archived' WHEN st = 'draft' THEN 'draft' WHEN vat_status IS DISTINCT FROM 'recorded' THEN 'not_recorded'
                WHEN cur <> 'GBP' THEN 'not_gbp' ELSE 'outside_period' END AS why
      FROM inv
     WHERE (coalesce(tp, nd) BETWEEN p_from AND p_to OR nd BETWEEN p_from AND p_to) AND id NOT IN (SELECT id FROM inv_in)
    UNION ALL
    SELECT src, CASE WHEN st = 'cancelled' THEN 'cancelled' WHEN vat_status IS DISTINCT FROM 'recorded' THEN 'not_recorded'
                     WHEN cur <> 'GBP' THEN 'not_gbp' ELSE 'outside_period' END
      FROM pur
     WHERE (coalesce(tp, nd) BETWEEN p_from AND p_to OR nd BETWEEN p_from AND p_to) AND (src, id) NOT IN (SELECT src, id FROM pur_in)
    UNION ALL
    SELECT 'invoices'::text, 'no_company'::text FROM public.invoices i
     WHERE i.organization_id IS NULL AND i.archived_at IS NULL
       AND i.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = p_organization_id AND om.is_active)
       AND (coalesce(i.tax_point_date, (i.created_at AT TIME ZONE 'UTC')::date) BETWEEN p_from AND p_to OR (i.created_at AT TIME ZONE 'UTC')::date BETWEEN p_from AND p_to)
    UNION ALL
    SELECT 'expenses'::text, 'no_company'::text FROM public.expenses e
     WHERE e.organization_id IS NULL
       AND e.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = p_organization_id AND om.is_active)
       AND (coalesce(e.tax_point_date, e.date) BETWEEN p_from AND p_to OR e.date BETWEEN p_from AND p_to)
    UNION ALL
    SELECT 'bills'::text, 'no_company'::text FROM public.bills b
     WHERE b.organization_id IS NULL AND b.status <> 'cancelled'
       AND b.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = p_organization_id AND om.is_active)
       AND (coalesce(b.tax_point_date, b.issue_date) BETWEEN p_from AND p_to OR b.issue_date BETWEEN p_from AND p_to)
  )
  SELECT 'included'::text, 'invoices'::text, l.value ->> 'vat_treatment', NULL::text, count(DISTINCT v.id),
         coalesce(sum((l.value ->> 'net')::numeric), 0), coalesce(sum((l.value ->> 'vat')::numeric), 0), 0::numeric
    FROM inv_in v CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(v.items) = 'array' THEN v.items ELSE '[]'::jsonb END) l
   GROUP BY l.value ->> 'vat_treatment'
  UNION ALL
  SELECT 'included'::text, p.src, p.vat_treatment, NULL::text, count(*),
         coalesce(sum(p.net_amount), 0), coalesce(sum(p.vat_amount) FILTER (WHERE p.vat_reclaimable), 0), coalesce(sum(p.vat_amount) FILTER (WHERE NOT p.vat_reclaimable), 0)
    FROM pur_in p GROUP BY p.src, p.vat_treatment
  UNION ALL
  SELECT 'left_out'::text, o.src, NULL::text, o.why, count(*), 0::numeric, 0::numeric, 0::numeric FROM left_out o GROUP BY o.src, o.why
  UNION ALL
  SELECT 'left_out'::text, p.src, NULL::text, 'vat_not_reclaimable'::text, count(*), 0::numeric, 0::numeric, coalesce(sum(p.vat_amount), 0)
    FROM pur_in p WHERE NOT p.vat_reclaimable AND p.vat_amount > 0 GROUP BY p.src;
END;
$function$;
COMMIT;
