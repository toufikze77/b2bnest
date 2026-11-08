-- =====================================================================================================================
-- HMRC P5: VAT return preview. PREPARED, NOT APPLIED. Nothing is filed, nothing is stored, nothing calls HMRC.
-- ORDER (docs/hmrc-p5/README.md): 1 the owner reviews this; 2 it is applied after review; 3 the frontend is published
-- (before step 2 the VAT return tab says "Not available yet").
--
-- Adds ONE read-only function, public.vat_company_return_preview(company, from, to). SECURITY DEFINER, search_path ''.
-- Gates, in order (any failure: an error, no data):
--   1 signed in; 2 public.mfa_ok() (two-step code entered when the person has an authenticator, the rule of every
--   finance table); 3 not the demo account (public.demo_readonly_users); 4 public.hmrc_manage_allowed(company, caller)
--   = 'ok', the one rule every HMRC feature uses since P0: an active member of the company, on Business
--   ('professional'), Scale ('enterprise'), the trial or an owner account, not suspended, and an owner or admin of the
--   company; 5 a valid period (from <= to).
-- What it returns: TOTALS ONLY, never a row, name, address, note or a single record's amount.
--   row_kind 'included' (one row per source and VAT treatment present):
--     source 'invoices' (sales; per LINE, from items: vat_treatment, net, vat), 'expenses' or 'bills' (purchases);
--     records (distinct records), net, vat (purchases: reclaimable VAT only), vat_not_reclaimable (purchases).
--   row_kind 'left_out' (one row per source and reason, with a count; 'vat_not_reclaimable' also carries the VAT):
--     archived / draft (invoices), cancelled (bills), not_recorded, not_gbp, outside_period (recorded, but the tax
--     point is outside the period although the record's own date is inside), no_company (records of this company's
--     active members, dated in the period, not linked to any company), vat_not_reclaimable (included purchases).
--     Left-out counts only look at records dated in the period (tax point, or the record's own date: invoice created,
--     expense date, bill issue date).
-- What counts (the P5 rule, docs/hmrc-p4b/README.md): vat_status = 'recorded', organization_id = the company, the tax
--   point inside the period (inclusive). Invoices: not draft, not archived, currency GBP. Bills: not cancelled, currency
--   GBP. Expenses have no currency: they count when their owner's account currency (profiles.currency_code) is GBP.
--   Sums of the stored amounts, in numeric: nothing is recalculated. quotes, outgoings and bank_transactions are never
--   read. No table, policy or other function is changed.
--
-- Production facts this was written against (read-only, 8 Nov 2026, HMRC P4, P4b and P4b option B applied):
-- column signatures (md5) invoices 79eeb7cdeb4efb8c7dab0ae680785010, expenses 97783f9a3d884194e1b37f30c9680734,
-- bills 76a2289e3944ffdfb82380fee4eb8c4a, organization_members 9196ca32cb304ecfdc12de1d4a249001;
-- profiles.currency_code text; md5(prosrc) hmrc_manage_allowed 9304f069f05402aab62d343b3626cd65,
-- mfa_ok 20516f2ec203220b3ac08d1230c7c306, user_is_organization_member 1fb55538d44b2451875f8baf1b6e4388,
-- vat_company_records_summary 67733fe724545b1ea4942835dae47281. Anything else: refused.
-- Rollback: docs/hmrc-p5/rollback.sql. Tests: docs/hmrc-p5/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regprocedure('public.vat_company_return_preview(uuid,date,date)') IS NOT NULL THEN
    RAISE EXCEPTION 'HMRC P5 already exists (applied twice?)';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('invoices', '79eeb7cdeb4efb8c7dab0ae680785010'), ('expenses', '97783f9a3d884194e1b37f30c9680734'),
                                 ('bills', '76a2289e3944ffdfb82380fee4eb8c4a'), ('organization_members', '9196ca32cb304ecfdc12de1d4a249001')) x(t, h) LOOP
    SELECT md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' ORDER BY a.attnum))
      INTO v FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = format('public.%I', r.t)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    IF v IS DISTINCT FROM r.h THEN RAISE EXCEPTION 'public.% columns differ from production as read on 8 Nov 2026', r.t; END IF;
  END LOOP;
  IF (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'currency_code' AND NOT attisdropped) IS DISTINCT FROM 'text'
     OR to_regclass('public.demo_readonly_users') IS NULL THEN
    RAISE EXCEPTION 'profiles.currency_code or public.demo_readonly_users differs from production';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'), ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'),
                                 ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388'),
                                 ('public.vat_company_records_summary(uuid,date,date)', '67733fe724545b1ea4942835dae47281')) x(f, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.f)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from production (or is missing: apply HMRC P0, P4, P4b and P4b option B first)', r.f;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.vat_company_return_preview(p_organization_id uuid, p_from date, p_to date)
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
    -- Records of this company's active members, dated in the period, not linked to any company yet.
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
REVOKE ALL ON FUNCTION public.vat_company_return_preview(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_company_return_preview(uuid, date, date) TO authenticated;

DO $$
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.vat_company_return_preview(uuid,date,date)'::regprocedure)
     OR (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.vat_company_return_preview(uuid,date,date)'::regprocedure) IS DISTINCT FROM 'search_path=""'
     OR has_function_privilege('anon', 'public.vat_company_return_preview(uuid,date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'vat_company_return_preview is not as intended';
  END IF;
END $$;

COMMIT;
