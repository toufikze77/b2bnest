-- =====================================================================================================================
-- HMRC P4: VAT data model (standard scheme, per-line VAT, "VAT not recorded" flag). PREPARED, NOT APPLIED.
-- Nothing is filed and nothing calls HMRC. ORDER (docs/hmrc-p4/README.md): 1 the owner reviews this; 2 it is applied
-- after review; 3 the frontend is published (it also works before this is applied).
--
-- What it adds (one transaction; any check failing changes nothing). Additive only: no column dropped or retyped, no
-- RLS policy changed, no row back-filled. Every existing row becomes vat_status = 'not_recorded' by the column default.
--   invoices: tax_point_date date, vat_scheme ('standard' only), vat_status ('recorded' | 'not_recorded').
--     Per-line VAT stays in items (each line: vat_treatment, vat_rate, net, vat, gross). Trigger vat_invoice_lines_check
--     (public.vat_check_invoice_lines, SECURITY INVOKER, search_path '') checks a 'recorded' invoice: every line has one of
--     the five treatments; gross = net + vat; zero / exempt / outside_scope have rate 0 and VAT 0; standard / reduced have
--     a rate above 0 and VAT = round(net x rate / 100, 2) (half away from zero, per line); the line nets add up to
--     subtotal and the line VAT to tax_amount, to the penny; total_amount = subtotal + tax_amount; a tax-point date.
--   expenses and bills: net_amount, vat_amount (numeric(12,2)), vat_treatment (the five), vat_rate (numeric(5,2)),
--     vat_status, vat_scheme ('standard' only), tax_point_date, vat_reclaimable (default true). A 'recorded' row must
--     have them all, net + VAT = amount exactly, VAT >= 0, zero / exempt / outside_scope with rate 0 and VAT 0, and for
--     standard / reduced a rate above 0 and VAT within 1p of round(net x rate / 100, 2) (supplier-invoice rounding).
--   public.vat_records_needing_attention(): SECURITY INVOKER (the caller's own RLS applies), counts of rows still
--     'not_recorded': invoices that are not drafts, all expenses, bills that are not cancelled.
--   The rates themselves (20, 5) live in the app (src/lib/vat/treatments.ts); the database checks that the stored rate
--   and VAT agree with each other and with the treatment, so a rate change needs no SQL.
-- Not changed: outgoings, quotes, bank_transactions, any hmrc_* table or function, any policy.
--
-- Production facts this was written against (read-only, 7 Nov 2026): column signatures (md5) invoices
-- cb44a4bc14a5d689fc380a4d0587849e, expenses 2b4cb452066a866d220cd8929c4a4d71, bills 40d858b9fe7f9b39af7f0bcd4933248b;
-- the triggers and policies listed in the checks below; md5(prosrc) handle_updated_at da5ac28a58c8b4bb30209bf0d3d7082c,
-- demo_readonly_guard 087b5fe2695b95b8ba2ba6eb195ba995. Anything else: refused.
-- Rollback: docs/hmrc-p4/rollback.sql. Tests: docs/hmrc-p4/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regprocedure('public.vat_records_needing_attention()') IS NOT NULL OR to_regprocedure('public.vat_check_invoice_lines()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('invoices', 'expenses', 'bills') AND column_name IN ('vat_status', 'vat_scheme', 'tax_point_date')) THEN
    RAISE EXCEPTION 'HMRC P4 already exists (applied twice?)';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('invoices', 'cb44a4bc14a5d689fc380a4d0587849e'), ('expenses', '2b4cb452066a866d220cd8929c4a4d71'), ('bills', '40d858b9fe7f9b39af7f0bcd4933248b')) x(t, h) LOOP
    SELECT md5(string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') || ':' || a.attnotnull::text, ',' ORDER BY a.attnum))
      INTO v FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = format('public.%I', r.t)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    IF v IS DISTINCT FROM r.h THEN RAISE EXCEPTION 'public.% columns differ from production as read on 7 Nov 2026', r.t; END IF;
  END LOOP;
  SELECT string_agg(c.relname || '.' || t.tgname || '>' || t.tgfoid::regprocedure::text, ',' ORDER BY c.relname, t.tgname) INTO v
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.oid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass) AND NOT t.tgisinternal;
  IF v IS DISTINCT FROM 'bills.a0_demo_readonly_guard>demo_readonly_guard(),bills.update_bills_updated_at>update_bills_updated_at(),expenses.a0_demo_readonly_guard>demo_readonly_guard(),expenses.update_expenses_updated_at>handle_updated_at(),invoices.a0_demo_readonly_guard>demo_readonly_guard(),invoices.invoices_notify_paid>notify_invoice_paid(),invoices.update_invoices_updated_at>handle_updated_at()' THEN
    RAISE EXCEPTION 'The triggers on invoices, expenses and bills differ from production: %', v;
  END IF;
  SELECT string_agg(tablename || '.' || policyname || ':' || cmd, ',' ORDER BY tablename, policyname) INTO v FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('invoices', 'expenses', 'bills');
  IF v IS DISTINCT FROM 'bills.Users can create their own bills:INSERT,bills.Users can delete their own bills:DELETE,bills.Users can update their own bills:UPDATE,bills.Users can view their own bills:SELECT,bills.require_aal2_if_enrolled:ALL,expenses.Users can manage their own expenses:ALL,expenses.require_aal2_if_enrolled:ALL,invoices.Users can create their own invoices:INSERT,invoices.Users can delete their own invoices:DELETE,invoices.Users can update their own invoices:UPDATE,invoices.Users can view their own invoices:SELECT,invoices.require_aal2_if_enrolled:ALL' THEN
    RAISE EXCEPTION 'The policies on invoices, expenses and bills differ from production: %', v;
  END IF;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.handle_updated_at()')) IS DISTINCT FROM 'da5ac28a58c8b4bb30209bf0d3d7082c'
     OR (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.demo_readonly_guard()')) IS DISTINCT FROM '087b5fe2695b95b8ba2ba6eb195ba995' THEN
    RAISE EXCEPTION 'handle_updated_at() or demo_readonly_guard() differs from production';
  END IF;
END $$;

-- 1. invoices: the tax point, the scheme and the flag. Per-line VAT is in items.
ALTER TABLE public.invoices
  ADD COLUMN tax_point_date date,
  ADD COLUMN vat_scheme text NOT NULL DEFAULT 'standard' CONSTRAINT invoices_vat_scheme_check CHECK (vat_scheme IN ('standard')),
  ADD COLUMN vat_status text NOT NULL DEFAULT 'not_recorded' CONSTRAINT invoices_vat_status_check CHECK (vat_status IN ('recorded', 'not_recorded')),
  ADD CONSTRAINT invoices_vat_tax_point_check CHECK (vat_status <> 'recorded' OR tax_point_date IS NOT NULL);

CREATE FUNCTION public.vat_check_invoice_lines()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE l jsonb; v_t text; v_rate numeric; v_net numeric; v_vat numeric; v_gross numeric; v_sum_net numeric := 0; v_sum_vat numeric := 0;
BEGIN
  IF NEW.vat_status IS DISTINCT FROM 'recorded' THEN RETURN NEW; END IF;
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'VAT_INVOICE_INVALID: a recorded invoice needs at least one line' USING ERRCODE = '23514';
  END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    v_t := l ->> 'vat_treatment';
    IF v_t IS NULL OR v_t NOT IN ('standard', 'reduced', 'zero', 'exempt', 'outside_scope') THEN
      RAISE EXCEPTION 'VAT_INVOICE_INVALID: a line has no valid VAT treatment' USING ERRCODE = '23514';
    END IF;
    IF jsonb_typeof(l -> 'net') IS DISTINCT FROM 'number' OR jsonb_typeof(l -> 'vat') IS DISTINCT FROM 'number'
       OR jsonb_typeof(l -> 'gross') IS DISTINCT FROM 'number' OR jsonb_typeof(l -> 'vat_rate') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'VAT_INVOICE_INVALID: a line is missing net, VAT, gross or rate' USING ERRCODE = '23514';
    END IF;
    v_rate := (l ->> 'vat_rate')::numeric; v_net := (l ->> 'net')::numeric; v_vat := (l ->> 'vat')::numeric; v_gross := (l ->> 'gross')::numeric;
    IF v_net <> round(v_net, 2) OR v_vat <> round(v_vat, 2) OR v_gross <> v_net + v_vat THEN
      RAISE EXCEPTION 'VAT_INVOICE_INVALID: a line does not add up (net + VAT = gross, to the penny)' USING ERRCODE = '23514';
    END IF;
    IF v_t IN ('zero', 'exempt', 'outside_scope') THEN
      IF v_rate <> 0 OR v_vat <> 0 THEN RAISE EXCEPTION 'VAT_INVOICE_INVALID: a % line must have no VAT', v_t USING ERRCODE = '23514'; END IF;
    ELSIF v_rate <= 0 OR v_vat <> round(v_net * v_rate / 100, 2) THEN
      RAISE EXCEPTION 'VAT_INVOICE_INVALID: a % line''s VAT is not its net at its rate, rounded to the penny', v_t USING ERRCODE = '23514';
    END IF;
    v_sum_net := v_sum_net + v_net; v_sum_vat := v_sum_vat + v_vat;
  END LOOP;
  IF NEW.subtotal IS DISTINCT FROM v_sum_net OR NEW.tax_amount IS DISTINCT FROM v_sum_vat OR NEW.total_amount IS DISTINCT FROM v_sum_net + v_sum_vat THEN
    RAISE EXCEPTION 'VAT_INVOICE_INVALID: the lines do not add up to the subtotal, VAT and total' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.vat_check_invoice_lines() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER vat_invoice_lines_check BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.vat_check_invoice_lines();

-- 2. expenses and bills: VAT on the record.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['expenses', 'bills'] LOOP
    EXECUTE format($sql$
      ALTER TABLE public.%1$I
        ADD COLUMN net_amount numeric(12,2),
        ADD COLUMN vat_amount numeric(12,2),
        ADD COLUMN vat_treatment text CONSTRAINT %1$s_vat_treatment_check CHECK (vat_treatment IS NULL OR vat_treatment IN ('standard', 'reduced', 'zero', 'exempt', 'outside_scope')),
        ADD COLUMN vat_rate numeric(5,2),
        ADD COLUMN vat_status text NOT NULL DEFAULT 'not_recorded' CONSTRAINT %1$s_vat_status_check CHECK (vat_status IN ('recorded', 'not_recorded')),
        ADD COLUMN vat_scheme text NOT NULL DEFAULT 'standard' CONSTRAINT %1$s_vat_scheme_check CHECK (vat_scheme IN ('standard')),
        ADD COLUMN tax_point_date date,
        ADD COLUMN vat_reclaimable boolean NOT NULL DEFAULT true,
        ADD CONSTRAINT %1$s_vat_recorded_check CHECK (vat_status <> 'recorded' OR (
          vat_treatment IS NOT NULL AND net_amount IS NOT NULL AND vat_amount IS NOT NULL AND vat_rate IS NOT NULL AND tax_point_date IS NOT NULL
          AND net_amount + vat_amount = amount AND vat_amount >= 0 AND vat_rate >= 0
          AND ((vat_treatment IN ('zero', 'exempt', 'outside_scope') AND vat_amount = 0 AND vat_rate = 0)
            OR (vat_treatment IN ('standard', 'reduced') AND vat_rate > 0 AND abs(vat_amount - round(net_amount * vat_rate / 100, 2)) <= 0.01))))
    $sql$, t);
  END LOOP;
END $$;

-- 3. How many records still need VAT details (the caller's own rows, by their RLS).
CREATE FUNCTION public.vat_records_needing_attention()
 RETURNS TABLE(record_type text, needing bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 'invoices'::text, count(*) FROM public.invoices WHERE vat_status = 'not_recorded' AND coalesce(status, '') <> 'draft'
  UNION ALL
  SELECT 'expenses'::text, count(*) FROM public.expenses WHERE vat_status = 'not_recorded'
  UNION ALL
  SELECT 'bills'::text, count(*) FROM public.bills WHERE vat_status = 'not_recorded' AND status <> 'cancelled';
$function$;
REVOKE ALL ON FUNCTION public.vat_records_needing_attention() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vat_records_needing_attention() TO authenticated, service_role;

DO $$
BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.vat_records_needing_attention()'::regprocedure)
     OR (SELECT prosecdef FROM pg_proc WHERE oid = 'public.vat_check_invoice_lines()'::regprocedure)
     OR has_function_privilege('anon', 'public.vat_records_needing_attention()', 'EXECUTE')
     OR (SELECT count(*) FROM pg_trigger WHERE tgname = 'a0_demo_readonly_guard' AND tgrelid IN ('public.invoices'::regclass, 'public.expenses'::regclass, 'public.bills'::regclass)) <> 3 THEN
    RAISE EXCEPTION 'functions, privileges or the demo guard are not as intended';
  END IF;
END $$;

COMMIT;
