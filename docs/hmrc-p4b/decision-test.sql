-- HMRC P4b owner-decision tests (DISPOSABLE local Postgres only). Run by run-test.sh with :option set to a or b, after
-- the matching decision file. One transaction, rolled back.
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES ('f7000000-0000-4000-8000-00000000000a', 'a@example.test'), ('f7000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('f7000000-0000-4000-8000-00000000000c', 'c@example.test'), ('f7000000-0000-4000-8000-00000000000d', 'd@example.test'), ('f7000000-0000-4000-8000-0000000000f1', 'f@example.test');
INSERT INTO public.organizations (id, name) VALUES ('0a700000-0000-4000-8000-000000000001', 'Company X'), ('0b700000-0000-4000-8000-000000000001', 'Company Y');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000a', 'owner', true),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000c', 'member', true),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000d', 'admin', true),
  ('0a700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-0000000000f1', 'owner', true),
  ('0b700000-0000-4000-8000-000000000001', 'f7000000-0000-4000-8000-00000000000b', 'owner', true);
-- F has a verified authenticator but this session is aal1.
INSERT INTO auth.mfa_factors (user_id, status) VALUES ('f7000000-0000-4000-8000-0000000000f1', 'verified');
-- Member C's records: tagged to X (recorded, GBP), one not recorded, one in USD; one with no company.
INSERT INTO public.invoices (user_id, invoice_number, status, currency, organization_id, items, subtotal, tax_amount, total_amount, vat_status, tax_point_date) VALUES
  ('f7000000-0000-4000-8000-00000000000c', 'C-1', 'sent', 'GBP', '0a700000-0000-4000-8000-000000000001',
   '[{"description":"w","quantity":1,"rate":100,"amount":100,"vat_treatment":"standard","vat_rate":20,"net":100,"vat":20,"gross":120}]', 100, 20, 120, 'recorded', '2026-11-03'),
  ('f7000000-0000-4000-8000-00000000000c', 'C-USD', 'sent', 'USD', '0a700000-0000-4000-8000-000000000001',
   '[{"description":"w","quantity":1,"rate":50,"amount":50,"vat_treatment":"zero","vat_rate":0,"net":50,"vat":0,"gross":50}]', 50, 0, 50, 'recorded', '2026-11-03');
INSERT INTO public.invoices (user_id, invoice_number, status, currency, organization_id) VALUES
  ('f7000000-0000-4000-8000-00000000000c', 'C-OLD', 'sent', 'GBP', '0a700000-0000-4000-8000-000000000001'),
  ('f7000000-0000-4000-8000-00000000000c', 'C-NONE', 'sent', 'GBP', NULL);
INSERT INTO public.expenses (user_id, category, description, amount, date, organization_id, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES
  ('f7000000-0000-4000-8000-00000000000c', 'office', 'C paper', 12, '2026-11-04', '0a700000-0000-4000-8000-000000000001', 10, 2, 'standard', 20, 'recorded', '2026-11-04');
INSERT INTO public.expenses (user_id, category, description, amount, date, organization_id) VALUES
  ('f7000000-0000-4000-8000-00000000000b', 'office', 'B paper (company Y)', 12, '2026-11-04', '0b700000-0000-4000-8000-000000000001');
CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text) TO PUBLIC;
SET ROLE authenticated;

\if :{?option_a}
\echo '== option A: read policy'
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000a');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE user_id = 'f7000000-0000-4000-8000-00000000000c') = 3, 'A: the owner of X reads the 3 X-tagged invoices member C wrote');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = 'C-NONE'), 'A: C''s records with no company stay private');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.expenses WHERE description LIKE 'B paper%'), 'A: the owner of X cannot read company Y''s records');
  UPDATE public.invoices SET notes = 'changed' WHERE invoice_number = 'C-1';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.invoices WHERE notes = 'changed'), 'A: read only: the owner cannot change C''s invoice');
END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000d');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.expenses) = 1, 'A: an admin of X reads C''s X expense'); END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000c');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices) = 4 AND (SELECT count(*) FROM public.expenses) = 1, 'A: a plain member still sees only their own rows'); END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000b');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices) = 0, 'A: the owner of Y cannot read X''s records'); END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-0000000000f1');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices) = 0, 'A: an owner with an authenticator who has not entered the code reads nothing (aal2)'); END $$;
\endif

\if :{?option_b}
\echo '== option B: summary function'
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000a');
DO $$ DECLARE r record; c jsonb := '{}'; BEGIN
  FOR r IN SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30') LOOP
    c := c || jsonb_build_object(r.record_type, jsonb_build_array(r.included, r.net, r.vat, r.left_out_not_recorded, r.left_out_not_gbp));
  END LOOP;
  PERFORM pg_temp.ok(c = '{"invoices":[1,100,20,1,1],"expenses":[1,10,2,0,0],"bills":[0,0,0,0,0]}'::jsonb,
    'B: the owner gets totals of everyone''s X records: recorded GBP only, with the left-out counts: ' || c::text);
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices) = 0, 'B: no rows of other members become readable');
END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000d');
DO $$ BEGIN PERFORM pg_temp.ok((SELECT sum(included) FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30')) = 2, 'B: an admin of X gets the totals'); END $$;
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000c');
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30')$$, 'only an owner or admin', 'B: a plain member is refused');
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000b');
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30')$$, 'only an owner or admin', 'B: the owner of another company is refused');
SELECT pg_temp.as_user('f7000000-0000-4000-8000-0000000000f1');
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30')$$, 'authenticator code', 'B: an owner with an authenticator at aal1 is refused');
SELECT pg_temp.as_user('f7000000-0000-4000-8000-00000000000a');
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-30', '2026-11-01')$$, 'valid period', 'B: a back-to-front period is refused');
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.vat_company_records_summary('0a700000-0000-4000-8000-000000000001', '2026-11-01', '2026-11-30')$$, 'permission denied', 'B: anon cannot call it');
\endif
RESET ROLE;
ROLLBACK;
