-- HMRC P4 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p4/run-test.sh after production's shape and
-- docs/hmrc-p4/proposal.sql. Everything runs in one transaction and is rolled back. Fictional people only.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('f5000000-0000-4000-8000-000000000001', 'a@example.test'), ('f5000000-0000-4000-8000-000000000002', 'b@example.test'),
                                          ('f5000000-0000-4000-8000-000000000003', 'demo@example.test');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('f5000000-0000-4000-8000-000000000003');
-- "Old" rows written before P4 (no VAT details).
INSERT INTO public.invoices (id, user_id, invoice_number, subtotal, tax_rate, tax_amount, total_amount, status, currency, items) VALUES
  ('a5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'OLD-1', 100, 20, 20, 120, 'sent', 'GBP', '[{"description":"Old","quantity":1,"rate":100,"amount":100}]'),
  ('a5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000001', 'OLD-2', 50, 0, 0, 50, 'draft', 'GBP', '[]'),
  ('a5000000-0000-4000-8000-000000000003', 'f5000000-0000-4000-8000-000000000002', 'OLD-B', 10, 0, 0, 10, 'sent', 'GBP', '[]');
INSERT INTO public.expenses (id, user_id, category, description, amount, date) VALUES
  ('b5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'travel', 'Old train', 12.00, '2026-10-01'),
  ('b5000000-0000-4000-8000-000000000002', 'f5000000-0000-4000-8000-000000000002', 'travel', 'B train', 5.00, '2026-10-01');
INSERT INTO public.bills (id, user_id, vendor_name, description, amount, issue_date, due_date) VALUES
  ('c5000000-0000-4000-8000-000000000001', 'f5000000-0000-4000-8000-000000000001', 'Vendor', 'Old bill', 240, '2026-10-01', '2026-10-31');

\echo '== old rows'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT bool_and(vat_status = 'not_recorded' AND vat_scheme = 'standard' AND tax_point_date IS NULL) FROM public.invoices), 'old invoices: not_recorded, standard, no tax point (nothing back-filled)');
  PERFORM pg_temp.ok((SELECT bool_and(vat_status = 'not_recorded' AND vat_amount IS NULL AND net_amount IS NULL AND vat_reclaimable) FROM public.expenses), 'old expenses: not_recorded, no VAT guessed');
  PERFORM pg_temp.ok((SELECT bool_and(vat_status = 'not_recorded' AND vat_amount IS NULL) FROM public.bills), 'old bills: not_recorded, no VAT guessed');
  PERFORM pg_temp.ok((SELECT subtotal = 100 AND tax_amount = 20 AND total_amount = 120 FROM public.invoices WHERE invoice_number = 'OLD-1'), 'old amounts untouched');
END $$;

\echo '== invoices: valid recorded rows (each treatment, mixed rates)'
CREATE FUNCTION pg_temp.line(t text, rate numeric, net numeric, vat numeric) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('description', t, 'quantity', 1, 'rate', net, 'amount', net, 'vat_treatment', t, 'vat_rate', rate, 'net', net, 'vat', vat, 'gross', net + vat) $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['standard', 'reduced', 'zero', 'exempt', 'outside_scope'] LOOP
    INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, status, currency, vat_status, tax_point_date)
    SELECT 'f5000000-0000-4000-8000-000000000001', 'P4-' || t, jsonb_build_array(l), (l ->> 'net')::numeric, (l ->> 'vat')::numeric, (l ->> 'gross')::numeric, 'sent', 'GBP', 'recorded', '2026-11-07'
      FROM (SELECT CASE t WHEN 'standard' THEN pg_temp.line(t, 20, 100.01, 20.00) WHEN 'reduced' THEN pg_temp.line(t, 5, 9.99, 0.50) ELSE pg_temp.line(t, 0, 33.33, 0) END AS l) s;
    PERFORM pg_temp.ok(true, 'a recorded ' || t || ' invoice is accepted');
  END LOOP;
  INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, status, currency, vat_status, tax_point_date) VALUES
    ('f5000000-0000-4000-8000-000000000001', 'P4-MIXED', jsonb_build_array(pg_temp.line('standard', 20, 0.03, 0.01), pg_temp.line('standard', 20, 0.03, 0.01), pg_temp.line('reduced', 5, 10.10, 0.51), pg_temp.line('zero', 0, 5, 0), pg_temp.line('exempt', 0, 2, 0)),
     17.16, 0.53, 17.69, 'sent', 'GBP', 'recorded', '2026-11-07');
  PERFORM pg_temp.ok(true, 'a mixed-rate invoice (VAT per line, rounded, then summed) is accepted');
END $$;
-- 20% of 0.03 = 0.006 -> 0.01 per line (half away from zero); two lines 0.02, not round(0.06 x 20%) = 0.01.

\echo '== invoices: refused'
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, vat_scheme) VALUES ('f5000000-0000-4000-8000-000000000001', 'X1', 'flat_rate')$$, 'invoices_vat_scheme_check', 'only the standard scheme');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, vat_status) VALUES ('f5000000-0000-4000-8000-000000000001', 'X2', 'maybe')$$, 'invoices_vat_status_check', 'vat_status is recorded or not_recorded');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status) VALUES ('f5000000-0000-4000-8000-000000000001', 'X3', jsonb_build_array(pg_temp.line('standard', 20, 10, 2)), 10, 2, 12, 'recorded')$$, 'invoices_vat_tax_point_check', 'recorded needs a tax-point date');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X4', jsonb_build_array(pg_temp.line('luxury', 30, 10, 3)), 10, 3, 13, 'recorded', '2026-11-07')$$, 'no valid VAT treatment', 'a bad treatment');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X5', jsonb_build_array(pg_temp.line('zero', 0, 10, 2)), 10, 2, 12, 'recorded', '2026-11-07')$$, 'must have no VAT', 'zero-rated with VAT above 0');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X6', jsonb_build_array(pg_temp.line('exempt', 20, 10, 0)), 10, 0, 10, 'recorded', '2026-11-07')$$, 'must have no VAT', 'exempt with a rate');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X7', jsonb_build_array(pg_temp.line('standard', 20, 10, 1.99)), 10, 1.99, 11.99, 'recorded', '2026-11-07')$$, 'not its net at its rate', 'standard VAT that is not 20% of the net');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X8', jsonb_build_array(pg_temp.line('standard', 20, 10, 2)), 10, 2.01, 12.01, 'recorded', '2026-11-07')$$, 'do not add up', 'totals not adding up');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X9', '[]', 0, 0, 0, 'recorded', '2026-11-07')$$, 'at least one line', 'no lines');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'X10', '[{"vat_treatment":"standard","vat_rate":20,"net":10}]', 10, 2, 12, 'recorded', '2026-11-07')$$, 'missing net, VAT, gross or rate', 'a line without VAT figures');
SELECT pg_temp.fails($$UPDATE public.invoices SET vat_status = 'recorded', tax_point_date = '2026-11-07' WHERE invoice_number = 'OLD-1'$$, 'VAT_INVOICE_INVALID', 'an old invoice cannot be marked recorded without a VAT breakdown');
DO $$ BEGIN
  UPDATE public.invoices SET notes = 'edited' WHERE invoice_number = 'OLD-1';
  PERFORM pg_temp.ok((SELECT vat_status FROM public.invoices WHERE invoice_number = 'OLD-1') = 'not_recorded', 'an old invoice can still be edited as before (stays not_recorded)');
END $$;

\echo '== expenses and bills'
DO $$ BEGIN
  INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES
    ('f5000000-0000-4000-8000-000000000001', 'office', 'Std', 12.00, '2026-11-07', 10.00, 2.00, 'standard', 20, 'recorded', '2026-11-07'),
    ('f5000000-0000-4000-8000-000000000001', 'office', 'Red', 10.50, '2026-11-07', 10.00, 0.50, 'reduced', 5, 'recorded', '2026-11-07'),
    ('f5000000-0000-4000-8000-000000000001', 'office', 'Zero', 8.00, '2026-11-07', 8.00, 0, 'zero', 0, 'recorded', '2026-11-07'),
    ('f5000000-0000-4000-8000-000000000001', 'office', 'Ex', 7.00, '2026-11-07', 7.00, 0, 'exempt', 0, 'recorded', '2026-11-07'),
    ('f5000000-0000-4000-8000-000000000001', 'office', 'Out', 6.00, '2026-11-07', 6.00, 0, 'outside_scope', 0, 'recorded', '2026-11-07');
  PERFORM pg_temp.ok(true, 'a recorded expense is accepted for each of the five treatments');
  INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date, vat_reclaimable) VALUES
    ('f5000000-0000-4000-8000-000000000001', 'entertainment', 'Supplier rounding', 12.01, '2026-11-07', 10.00, 2.01, 'standard', 20, 'recorded', '2026-11-07', false);
  PERFORM pg_temp.ok(true, 'supplier-invoice rounding within 1p is accepted; not reclaimable is stored');
  INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES
    ('f5000000-0000-4000-8000-000000000001', 'Vendor', 'Std bill', 240, '2026-11-01', '2026-11-30', 200, 40, 'standard', 20, 'recorded', '2026-11-01'),
    ('f5000000-0000-4000-8000-000000000001', 'Vendor', 'Ex bill', 99.99, '2026-11-01', '2026-11-30', 99.99, 0, 'exempt', 0, 'recorded', '2026-11-01');
  PERFORM pg_temp.ok(true, 'recorded bills are accepted');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, vat_treatment) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 1, '2026-11-07', 'luxury')$$, 'expenses_vat_treatment_check', 'expenses: a bad treatment');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, vat_scheme) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 1, '2026-11-07', 'cash')$$, 'expenses_vat_scheme_check', 'expenses: only the standard scheme');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 12, '2026-11-07', 10, 2, 'zero', 0, 'recorded', '2026-11-07')$$, 'expenses_vat_recorded_check', 'expenses: zero-rated with VAT above 0');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 12.50, '2026-11-07', 10, 2, 'standard', 20, 'recorded', '2026-11-07')$$, 'expenses_vat_recorded_check', 'expenses: net + VAT is not the amount');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 12.02, '2026-11-07', 10, 2.02, 'standard', 20, 'recorded', '2026-11-07')$$, 'expenses_vat_recorded_check', 'expenses: VAT 2p off the rate is beyond the 1p tolerance');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 12, '2026-11-07', 10, 2, 'standard', 20, 'recorded')$$, 'expenses_vat_recorded_check', 'expenses: recorded needs a tax-point date');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'x', 'x', 8, '2026-11-07', 10, -2, 'standard', 20, 'recorded', '2026-11-07')$$, 'expenses_vat_recorded_check', 'expenses: negative VAT');
SELECT pg_temp.fails($$INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f5000000-0000-4000-8000-000000000001', 'V', 'x', 12, '2026-11-01', '2026-11-30', 10, 2, 'outside_scope', 0, 'recorded', '2026-11-01')$$, 'bills_vat_recorded_check', 'bills: outside scope with VAT above 0');
SELECT pg_temp.fails($$INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date, vat_status) VALUES ('f5000000-0000-4000-8000-000000000001', 'V', 'x', 12, '2026-11-01', '2026-11-30', 'recorded')$$, 'bills_vat_recorded_check', 'bills: recorded without VAT details');

\echo '== RLS unchanged, the attention counts, the demo person'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"f5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
DO $$ DECLARE r record; c jsonb := '{}'; BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE user_id = 'f5000000-0000-4000-8000-000000000002') = 0
                     AND (SELECT count(*) FROM public.expenses WHERE user_id = 'f5000000-0000-4000-8000-000000000002') = 0, 'user A cannot see user B''s invoices or expenses');
  FOR r IN SELECT * FROM public.vat_records_needing_attention() LOOP c := c || jsonb_build_object(r.record_type, r.needing); END LOOP;
  PERFORM pg_temp.ok(c = '{"invoices":1,"expenses":1,"bills":1}'::jsonb, 'attention counts: A''s own not-recorded rows only (drafts left out): ' || c::text);
  INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date)
  VALUES ('f5000000-0000-4000-8000-000000000001', 'office', 'From the app', 1.20, '2026-11-07', 1.00, 0.20, 'standard', 20, 'recorded', '2026-11-07');
  PERFORM pg_temp.ok(true, 'a signed-in person saves a recorded expense through RLS');
END $$;
SELECT pg_temp.fails($$UPDATE public.expenses SET vat_status = 'recorded' WHERE user_id = 'f5000000-0000-4000-8000-000000000001' AND description = 'Old train'$$, 'expenses_vat_recorded_check', 'an old expense cannot be marked recorded without its VAT details');
SELECT set_config('request.jwt.claims', '{"sub":"f5000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, vat_status) VALUES ('f5000000-0000-4000-8000-000000000003', 'D1', 'not_recorded')$$, 'This is a demo account', 'demo: invoices still refused with the new columns');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, vat_treatment) VALUES ('f5000000-0000-4000-8000-000000000003', 'x', 'x', 1, '2026-11-07', 'standard')$$, 'This is a demo account', 'demo: expenses still refused');
SELECT pg_temp.fails($$INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date) VALUES ('f5000000-0000-4000-8000-000000000003', 'V', 'x', 1, '2026-11-01', '2026-11-30')$$, 'This is a demo account', 'demo: bills still refused');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.vat_records_needing_attention()$$, 'permission denied', 'anon cannot call the attention counts');
RESET ROLE;
ROLLBACK;
