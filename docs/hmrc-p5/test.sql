-- HMRC P5 tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p5/run-test.sh after production's shape and
-- docs/hmrc-p5/proposal.sql. One transaction, rolled back. Fictional people and companies only.
-- People: A owns company X (Business plan); D is an admin of X; C is a plain member of X; B owns company Y;
-- S owns company Z on a plan without HMRC tools; M is the demo account (admin of X).
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES
  ('f8000000-0000-4000-8000-00000000000a', 'a@example.test'), ('f8000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('f8000000-0000-4000-8000-00000000000c', 'c@example.test'), ('f8000000-0000-4000-8000-00000000000d', 'd@example.test'),
  ('f8000000-0000-4000-8000-0000000000e5', 's@example.test'), ('f8000000-0000-4000-8000-0000000000e6', 'm@example.test');
INSERT INTO public.profiles (id, email, full_name, currency_code) VALUES
  ('f8000000-0000-4000-8000-00000000000a', 'a@example.test', 'A', 'GBP'), ('f8000000-0000-4000-8000-00000000000b', 'b@example.test', 'B', 'GBP'),
  ('f8000000-0000-4000-8000-00000000000c', 'c@example.test', 'C', 'USD'), ('f8000000-0000-4000-8000-00000000000d', 'd@example.test', 'D', 'GBP'),
  ('f8000000-0000-4000-8000-0000000000e5', 's@example.test', 'S', 'GBP'), ('f8000000-0000-4000-8000-0000000000e6', 'm@example.test', 'M', 'GBP');
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES
  ('f8000000-0000-4000-8000-00000000000a', 'a@example.test', true, 'active', 'professional'),
  ('f8000000-0000-4000-8000-00000000000b', 'b@example.test', true, 'active', 'enterprise'),
  ('f8000000-0000-4000-8000-0000000000e5', 's@example.test', true, 'active', 'starter');
INSERT INTO public.organizations (id, name, created_by) VALUES
  ('0a800000-0000-4000-8000-000000000001', 'Company X', 'f8000000-0000-4000-8000-00000000000a'),
  ('0b800000-0000-4000-8000-000000000001', 'Company Y', 'f8000000-0000-4000-8000-00000000000b'),
  ('0c800000-0000-4000-8000-000000000001', 'Company Z', 'f8000000-0000-4000-8000-0000000000e5');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000a', 'owner', true),
  ('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000d', 'admin', true),
  ('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000c', 'member', true),
  ('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000e6', 'admin', true),
  ('0b800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000b', 'owner', true),
  ('0c800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000e5', 'owner', true);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0a800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000a'), ('0b800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-00000000000b'),
  ('0c800000-0000-4000-8000-000000000001', 'f8000000-0000-4000-8000-0000000000e5');
INSERT INTO public.demo_readonly_users (user_id) VALUES ('f8000000-0000-4000-8000-0000000000e6');

CREATE FUNCTION pg_temp.line(t text, rate numeric, net numeric, vat numeric) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('description', 'x', 'quantity', 1, 'rate', net, 'amount', net, 'vat_treatment', t, 'vat_rate', rate, 'net', net, 'vat', vat, 'gross', net + vat) $$;
-- Rows written as the database owner (the triggers allow it). Period under test: October 2026.
-- Company X sales: a mixed invoice (standard 100/20, reduced 10/0.50, outside scope 30/0) and a zero + exempt invoice.
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, currency, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date, created_at) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-MIX', 'sent', 'GBP',
   jsonb_build_array(pg_temp.line('standard', 20, 100, 20), pg_temp.line('reduced', 5, 10, 0.50), pg_temp.line('outside_scope', 0, 30, 0)), 140, 20.50, 160.50, 'recorded', '2026-10-01', '2026-10-01'),
  ('f8000000-0000-4000-8000-00000000000c', '0a800000-0000-4000-8000-000000000001', 'X-ZE', 'paid', 'GBP',
   jsonb_build_array(pg_temp.line('zero', 0, 40, 0), pg_temp.line('exempt', 0, 5, 0)), 45, 0, 45, 'recorded', '2026-10-31', '2026-10-31'),
  -- left out: USD, draft, archived, the day after the period, a tax point outside the period but dated inside, not recorded
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-USD', 'sent', 'USD', jsonb_build_array(pg_temp.line('standard', 20, 50, 10)), 50, 10, 60, 'recorded', '2026-10-10', '2026-10-10'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-DRAFT', 'draft', 'GBP', jsonb_build_array(pg_temp.line('standard', 20, 70, 14)), 70, 14, 84, 'recorded', '2026-10-11', '2026-10-11'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-NOV', 'sent', 'GBP', jsonb_build_array(pg_temp.line('standard', 20, 900, 180)), 900, 180, 1080, 'recorded', '2026-11-01', '2026-11-01'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-TP-SEP', 'sent', 'GBP', jsonb_build_array(pg_temp.line('standard', 20, 60, 12)), 60, 12, 72, 'recorded', '2026-09-30', '2026-10-02');
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, currency, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date, created_at, archived_at) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-ARCH', 'sent', 'GBP', jsonb_build_array(pg_temp.line('standard', 20, 80, 16)), 80, 16, 96, 'recorded', '2026-10-12', '2026-10-12', now());
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, currency, subtotal, tax_amount, total_amount, created_at) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'X-OLD', 'sent', 'GBP', 10, 2, 12, '2026-10-05'),
  ('f8000000-0000-4000-8000-00000000000a', NULL, 'A-NOCO', 'sent', 'GBP', 10, 2, 12, '2026-10-06');
-- Another company's invoice in the same period (never counted for X).
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, currency, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date, created_at) VALUES
  ('f8000000-0000-4000-8000-00000000000b', '0b800000-0000-4000-8000-000000000001', 'Y-1', 'sent', 'GBP', jsonb_build_array(pg_temp.line('standard', 20, 1000, 200)), 1000, 200, 1200, 'recorded', '2026-10-15', '2026-10-15');
-- Company X purchases. Expenses: A (GBP account) standard 50/10 reclaimable, entertainment 25/5 not reclaimable, exempt 8;
-- C's account currency is USD: left out as not GBP. Bills: standard 200/40, a USD bill, a cancelled bill, an outside-scope bill.
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date, vat_reclaimable) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'office', 'e1', 60, '2026-10-03', 50, 10, 'standard', 20, 'recorded', '2026-10-03', true),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'entertainment', 'e2', 30, '2026-10-04', 25, 5, 'standard', 20, 'recorded', '2026-10-04', false),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'insurance', 'e3', 8, '2026-10-05', 8, 0, 'exempt', 0, 'recorded', '2026-10-05', true),
  ('f8000000-0000-4000-8000-00000000000c', '0a800000-0000-4000-8000-000000000001', 'office', 'c-usd', 12, '2026-10-06', 10, 2, 'standard', 20, 'recorded', '2026-10-06', true);
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, date) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'travel', 'not recorded', 9, '2026-10-07'),
  ('f8000000-0000-4000-8000-00000000000d', NULL, 'travel', 'D no company', 9, '2026-10-08'),
  ('f8000000-0000-4000-8000-00000000000a', NULL, 'travel', 'A no company, September', 9, '2026-09-08');
INSERT INTO public.bills (user_id, organization_id, vendor_name, description, amount, currency, issue_date, due_date, status, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'V', 'b1', 240, 'GBP', '2026-10-20', '2026-11-20', 'pending', 200, 40, 'standard', 20, 'recorded', '2026-10-20'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'V', 'b-usd', 120, 'USD', '2026-10-21', '2026-11-21', 'pending', 100, 20, 'standard', 20, 'recorded', '2026-10-21'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'V', 'b-cancelled', 120, 'GBP', '2026-10-22', '2026-11-22', 'cancelled', 100, 20, 'standard', 20, 'recorded', '2026-10-22'),
  ('f8000000-0000-4000-8000-00000000000a', '0a800000-0000-4000-8000-000000000001', 'V', 'b-out', 15, 'GBP', '2026-10-23', '2026-11-23', 'paid', 15, 0, 'outside_scope', 0, 'recorded', '2026-10-23');

CREATE FUNCTION pg_temp.as_user(u text, aal text DEFAULT 'aal1') RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', aal)::text, true) $$;
-- The preview as one JSON object: 'invoices:standard' => [records, net, vat, vat_not_reclaimable], 'left:invoices:draft' => n.
CREATE FUNCTION pg_temp.preview(f date, t date) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_object_agg(CASE WHEN row_kind = 'included' THEN source || ':' || treatment ELSE 'left:' || source || ':' || reason END,
           CASE WHEN row_kind = 'included' THEN jsonb_build_array(records, net, vat, vat_not_reclaimable)
                WHEN reason = 'vat_not_reclaimable' THEN jsonb_build_array(records, vat_not_reclaimable) ELSE to_jsonb(records) END), '{}'::jsonb)
    FROM public.vat_company_return_preview('0a800000-0000-4000-8000-000000000001', f, t) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text, text), pg_temp.preview(date, date) TO PUBLIC;

SET ROLE authenticated;
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000a');

\echo '== sales, per line and treatment'
DO $$ DECLARE p jsonb := pg_temp.preview('2026-10-01', '2026-10-31'); BEGIN
  PERFORM pg_temp.ok(p -> 'invoices:standard' = '[1, 100, 20, 0]', 'mixed invoice: the standard line (100 net, 20 VAT): ' || (p -> 'invoices:standard')::text);
  PERFORM pg_temp.ok(p -> 'invoices:reduced' = '[1, 10, 0.50, 0]', 'mixed invoice: the reduced line (10 net, 0.50 VAT)');
  PERFORM pg_temp.ok(p -> 'invoices:outside_scope' = '[1, 30, 0, 0]', 'the outside-scope line is its own line (net 30, no VAT)');
  PERFORM pg_temp.ok(p -> 'invoices:zero' = '[1, 40, 0, 0]' AND p -> 'invoices:exempt' = '[1, 5, 0, 0]', 'zero-rated and exempt lines, separately');
  PERFORM pg_temp.ok(p -> 'left:invoices:not_gbp' = '1' AND p -> 'left:invoices:draft' = '1' AND p -> 'left:invoices:archived' = '1', 'USD, draft and archived invoices are left out, counted');
  PERFORM pg_temp.ok(p -> 'left:invoices:outside_period' = '1', 'dated in the period but with its tax point in September: left out (outside the period)');
  PERFORM pg_temp.ok(p -> 'left:invoices:not_recorded' = '1', 'an invoice without VAT details: left out (not recorded)');
  PERFORM pg_temp.ok(p -> 'left:invoices:no_company' = '1', 'a member''s invoice with no company, dated in the period: counted as left out, never included');
  PERFORM pg_temp.ok(NOT (p::text LIKE '%1000%') AND NOT (p::text LIKE '%900%'), 'company Y''s invoice and the November invoice are not counted anywhere');
  PERFORM pg_temp.ok(NOT (p::text ~ 'X-|Y-|A-NOCO|e1|b1|description'), 'totals only: no number, name or description in the result');
END $$;

\echo '== purchases'
DO $$ DECLARE p jsonb := pg_temp.preview('2026-10-01', '2026-10-31'); BEGIN
  PERFORM pg_temp.ok(p -> 'expenses:standard' = '[2, 75, 10, 5]', 'expenses, standard: 2 records, net 75, reclaimable VAT 10, not reclaimable 5: ' || (p -> 'expenses:standard')::text);
  PERFORM pg_temp.ok(p -> 'expenses:exempt' = '[1, 8, 0, 0]', 'an exempt expense');
  PERFORM pg_temp.ok(p -> 'left:expenses:vat_not_reclaimable' = '[1, 5]', 'VAT not reclaimable: one expense, 5.00, shown in the left-out list');
  PERFORM pg_temp.ok(p -> 'left:expenses:not_gbp' = '1', 'an expense whose owner''s account currency is USD: left out (not GBP)');
  PERFORM pg_temp.ok(p -> 'left:expenses:not_recorded' = '1', 'an expense without VAT details: left out');
  PERFORM pg_temp.ok(p -> 'left:expenses:no_company' = '1', 'a member''s expense with no company in the period counted; the September one is not');
  PERFORM pg_temp.ok(p -> 'bills:standard' = '[1, 200, 40, 0]' AND p -> 'bills:outside_scope' = '[1, 15, 0, 0]', 'bills: standard 200/40, outside scope 15');
  PERFORM pg_temp.ok(p -> 'left:bills:not_gbp' = '1' AND p -> 'left:bills:cancelled' = '1', 'USD and cancelled bills left out');
END $$;

\echo '== period edges (inclusive)'
DO $$ DECLARE p jsonb; BEGIN
  p := pg_temp.preview('2026-10-01', '2026-10-01');
  PERFORM pg_temp.ok(p -> 'invoices:standard' = '[1, 100, 20, 0]' AND p -> 'invoices:zero' IS NULL, 'the first day is included; the last day''s invoice is not in a one-day period');
  p := pg_temp.preview('2026-10-31', '2026-10-31');
  PERFORM pg_temp.ok(p -> 'invoices:zero' = '[1, 40, 0, 0]' AND p -> 'invoices:standard' IS NULL, 'the last day is included');
  p := pg_temp.preview('2026-11-01', '2026-11-30');
  PERFORM pg_temp.ok(p -> 'invoices:standard' = '[1, 900, 180, 0]', 'the next period has the November invoice only');
END $$;
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_return_preview('0a800000-0000-4000-8000-000000000001', '2026-10-31', '2026-10-01')$$, 'VAT_PREVIEW_INVALID', 'a back-to-front period is refused');

\echo '== who may see it'
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000d');
DO $$ BEGIN PERFORM pg_temp.ok(pg_temp.preview('2026-10-01', '2026-10-31') -> 'invoices:standard' = '[1, 100, 20, 0]', 'an admin of X sees the same totals (everyone''s records of X)'); END $$;
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000c');
SELECT pg_temp.fails($$SELECT pg_temp.preview('2026-10-01', '2026-10-31')$$, 'only an owner or admin', 'a plain member is refused');
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000b');
SELECT pg_temp.fails($$SELECT pg_temp.preview('2026-10-01', '2026-10-31')$$, 'only an owner or admin', 'the owner of another company is refused');
SELECT pg_temp.as_user('f8000000-0000-4000-8000-0000000000e5');
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_return_preview('0c800000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-31')$$, 'VAT_PREVIEW_PLAN', 'a plan without HMRC tools is refused');
SELECT pg_temp.as_user('f8000000-0000-4000-8000-0000000000e6');
SELECT pg_temp.fails($$SELECT pg_temp.preview('2026-10-01', '2026-10-31')$$, 'demo account', 'the demo account is refused');
RESET ROLE;
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('f8000000-0000-4000-8000-00000000000d', 'verified');
SET ROLE authenticated;
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000d', 'aal1');
SELECT pg_temp.fails($$SELECT pg_temp.preview('2026-10-01', '2026-10-31')$$, 'authenticator code', 'an admin with an authenticator who has not entered the code is refused');
SELECT pg_temp.as_user('f8000000-0000-4000-8000-00000000000d', 'aal2');
DO $$ BEGIN PERFORM pg_temp.ok(pg_temp.preview('2026-10-01', '2026-10-31') -> 'bills:standard' = '[1, 200, 40, 0]', 'the same admin after entering the code (aal2) sees the totals'); END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT pg_temp.fails($$SELECT pg_temp.preview('2026-10-01', '2026-10-31')$$, 'sign in first', 'no signed-in person: refused');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_return_preview('0a800000-0000-4000-8000-000000000001', '2026-10-01', '2026-10-31')$$, 'permission denied', 'anon cannot execute it');
RESET ROLE;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE invoice_number LIKE 'X-%') = 8, 'nothing was written by the preview');
END $$;
ROLLBACK;
