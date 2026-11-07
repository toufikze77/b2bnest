-- HMRC P4b tests (DISPOSABLE local Postgres only). Run by docs/hmrc-p4b/run-test.sh after production's shape and
-- docs/hmrc-p4b/proposal.sql. One transaction, rolled back. Fictional people and companies only.
-- People: A owns company X; C is a plain member of X; D is an admin of X; B owns company Y; L left X (inactive);
-- M is the demo account (member of X).
\set ON_ERROR_STOP 1
BEGIN;
\i docs/phase37/test-helpers.sql
INSERT INTO auth.users (id, email) VALUES
  ('f6000000-0000-4000-8000-00000000000a', 'a@example.test'), ('f6000000-0000-4000-8000-00000000000b', 'b@example.test'),
  ('f6000000-0000-4000-8000-00000000000c', 'c@example.test'), ('f6000000-0000-4000-8000-00000000000d', 'd@example.test'),
  ('f6000000-0000-4000-8000-0000000000e1', 'l@example.test'), ('f6000000-0000-4000-8000-0000000000e2', 'm@example.test');
INSERT INTO public.organizations (id, name) VALUES ('0a600000-0000-4000-8000-000000000001', 'Company X'), ('0b600000-0000-4000-8000-000000000001', 'Company Y');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0a600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-00000000000a', 'owner', true),
  ('0a600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-00000000000c', 'member', true),
  ('0a600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-00000000000d', 'admin', true),
  ('0a600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000e1', 'member', false),
  ('0a600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-0000000000e2', 'member', true),
  ('0b600000-0000-4000-8000-000000000001', 'f6000000-0000-4000-8000-00000000000b', 'owner', true);
INSERT INTO public.demo_readonly_users (user_id) VALUES ('f6000000-0000-4000-8000-0000000000e2');
-- "Old" rows written before P4b (no company), as the database owner: one invoice, one expense and one bill per person,
-- plus an expense already recorded before P4b (allowed to exist with no company).
INSERT INTO public.invoices (id, user_id, invoice_number, subtotal, tax_amount, total_amount, status, currency, items) VALUES
  ('a6000000-0000-4000-8000-00000000000a', 'f6000000-0000-4000-8000-00000000000a', 'A-OLD', 100, 0, 100, 'sent', 'GBP', '[]'),
  ('a6000000-0000-4000-8000-00000000000b', 'f6000000-0000-4000-8000-00000000000b', 'B-OLD', 10, 0, 10, 'sent', 'GBP', '[]'),
  ('a6000000-0000-4000-8000-0000000000a2', 'f6000000-0000-4000-8000-00000000000a', 'A-DRAFT', 5, 0, 5, 'draft', 'GBP', '[]');
INSERT INTO public.expenses (id, user_id, category, description, amount, date) VALUES
  ('b6000000-0000-4000-8000-00000000000a', 'f6000000-0000-4000-8000-00000000000a', 'travel', 'A old train', 12, '2026-10-01'),
  ('b6000000-0000-4000-8000-00000000000b', 'f6000000-0000-4000-8000-00000000000b', 'travel', 'B old train', 5, '2026-10-01'),
  ('b6000000-0000-4000-8000-0000000000e1', 'f6000000-0000-4000-8000-0000000000e1', 'travel', 'L old train', 5, '2026-10-01');
INSERT INTO public.expenses (id, user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES
  ('b6000000-0000-4000-8000-0000000000a9', 'f6000000-0000-4000-8000-00000000000a', 'office', 'A recorded before P4b', 12, '2026-10-02', 10, 2, 'standard', 20, 'recorded', '2026-10-02');
INSERT INTO public.bills (id, user_id, vendor_name, description, amount, issue_date, due_date) VALUES
  ('c6000000-0000-4000-8000-00000000000a', 'f6000000-0000-4000-8000-00000000000a', 'V', 'A old bill', 24, '2026-10-01', '2026-10-31');

CREATE FUNCTION pg_temp.as_user(u text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'aal', 'aal1')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(text) TO PUBLIC;

\echo '== old rows untouched'
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT bool_and(organization_id IS NULL) FROM public.invoices) AND (SELECT bool_and(organization_id IS NULL) FROM public.expenses)
                     AND (SELECT bool_and(organization_id IS NULL) FROM public.bills), 'every existing row has no company (nothing assigned automatically)');
  PERFORM pg_temp.ok((SELECT vat_status FROM public.expenses WHERE description = 'A recorded before P4b') = 'recorded', 'a row recorded before P4b with no company still exists');
END $$;

\echo '== tagging as a member (through RLS)'
SET ROLE authenticated;
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000a');
DO $$ BEGIN
  INSERT INTO public.invoices (user_id, invoice_number, status, currency, organization_id) VALUES ('f6000000-0000-4000-8000-00000000000a', 'A-NEW-X', 'draft', 'GBP', '0a600000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok(true, 'a member can save a new invoice with their own company');
  INSERT INTO public.expenses (user_id, category, description, amount, date, organization_id, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date)
  VALUES ('f6000000-0000-4000-8000-00000000000a', 'office', 'A new recorded', 12, '2026-11-07', '0a600000-0000-4000-8000-000000000001', 10, 2, 'standard', 20, 'recorded', '2026-11-07');
  PERFORM pg_temp.ok(true, 'a recorded expense with the company is accepted');
  INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date, organization_id) VALUES ('f6000000-0000-4000-8000-00000000000a', 'V', 'A new bill', 1, '2026-11-01', '2026-11-30', '0a600000-0000-4000-8000-000000000001');
  INSERT INTO public.invoices (user_id, invoice_number, status, currency) VALUES ('f6000000-0000-4000-8000-00000000000a', 'A-NEW-NULL', 'draft', 'GBP');
  PERFORM pg_temp.ok(true, 'bills too; and no company (NULL) is still allowed for a record that is not VAT-recorded');
  UPDATE public.expenses SET organization_id = '0a600000-0000-4000-8000-000000000001' WHERE description = 'A old train';
  PERFORM pg_temp.ok((SELECT organization_id FROM public.expenses WHERE description = 'A old train') = '0a600000-0000-4000-8000-000000000001', 'the owner of an old record can assign it to their company');
  UPDATE public.expenses SET description = 'A recorded before P4b (edited)' WHERE description = 'A recorded before P4b';
  PERFORM pg_temp.ok(true, 'a row recorded before P4b with no company can still be edited');
END $$;
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, organization_id) VALUES ('f6000000-0000-4000-8000-00000000000a', 'A-Y', '0b600000-0000-4000-8000-000000000001')$$, 'FINANCE_COMPANY_NOT_MEMBER', 'a new invoice cannot be tagged to another company');
SELECT pg_temp.fails($$UPDATE public.bills SET organization_id = '0b600000-0000-4000-8000-000000000001' WHERE description = 'A old bill'$$, 'FINANCE_COMPANY_NOT_MEMBER', 'an old bill cannot be moved to another company');
SELECT pg_temp.fails($$UPDATE public.invoices SET organization_id = 'ffffffff-0000-4000-8000-000000000001' WHERE invoice_number = 'A-OLD'$$, 'FINANCE_COMPANY_NOT_MEMBER', 'a made-up company id is refused');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, net_amount, vat_amount, vat_treatment, vat_rate, vat_status, tax_point_date) VALUES ('f6000000-0000-4000-8000-00000000000a', 'office', 'no company', 12, '2026-11-07', 10, 2, 'standard', 20, 'recorded', '2026-11-07')$$, 'FINANCE_COMPANY_REQUIRED', 'a new recorded expense needs a company');
SELECT pg_temp.fails($$UPDATE public.bills SET net_amount = 20, vat_amount = 4, vat_treatment = 'standard', vat_rate = 20, vat_status = 'recorded', tax_point_date = '2026-10-01' WHERE description = 'A old bill'$$, 'FINANCE_COMPANY_REQUIRED', 'an old bill becoming recorded needs a company');
SELECT pg_temp.fails($$UPDATE public.expenses SET organization_id = NULL WHERE description = 'A new recorded'$$, 'keeps its company', 'a recorded expense cannot have its company removed');
DO $$ BEGIN
  UPDATE public.bills SET organization_id = '0a600000-0000-4000-8000-000000000001', net_amount = 20, vat_amount = 4, vat_treatment = 'standard', vat_rate = 20, vat_status = 'recorded', tax_point_date = '2026-10-01' WHERE description = 'A old bill';
  PERFORM pg_temp.ok((SELECT vat_status FROM public.bills WHERE description = 'A old bill') = 'recorded', 'assigning the company and recording the VAT in one save works (the bulk VAT helper)');
END $$;

\echo '== a person who left the company'
SELECT pg_temp.as_user('f6000000-0000-4000-8000-0000000000e1');
SELECT pg_temp.fails($$UPDATE public.expenses SET organization_id = '0a600000-0000-4000-8000-000000000001' WHERE description = 'L old train'$$, 'FINANCE_COMPANY_NOT_MEMBER', 'an inactive member cannot tag to the company they left');

\echo '== cross-company isolation (RLS unchanged: own rows only)'
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000b');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.invoices WHERE user_id <> 'f6000000-0000-4000-8000-00000000000b') = 0
                     AND (SELECT count(*) FROM public.expenses WHERE user_id <> 'f6000000-0000-4000-8000-00000000000b') = 0
                     AND (SELECT count(*) FROM public.bills WHERE user_id <> 'f6000000-0000-4000-8000-00000000000b') = 0, 'user B (company Y) cannot read A''s rows');
  UPDATE public.expenses SET description = 'hacked' WHERE user_id = 'f6000000-0000-4000-8000-00000000000a';
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.expenses WHERE description = 'hacked'), 'user B cannot change A''s rows');
END $$;
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000c');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.expenses) = 0 AND (SELECT count(*) FROM public.invoices) = 0, 'member C of company X cannot read A''s company-X rows (members'' rows stay private)');
END $$;
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000d');
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.expenses) = 0, 'admin D of company X cannot read A''s rows either until the owner decides (no new policy)');
END $$;

\echo '== the attention counts'
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000a');
DO $$ DECLARE r record; c jsonb := '{}'; BEGIN
  FOR r IN SELECT * FROM public.vat_records_needing_attention() LOOP c := c || jsonb_build_object(r.scope || ':' || r.record_type, r.needing); END LOOP;
  PERFORM pg_temp.ok(c = '{"all:invoices":1,"all:expenses":1,"all:bills":1}'::jsonb, 'the old call (no company) works and counts as before: ' || c::text);
  c := '{}';
  FOR r IN SELECT * FROM public.vat_records_needing_attention('0a600000-0000-4000-8000-000000000001') LOOP c := c || jsonb_build_object(r.scope || ':' || r.record_type, r.needing); END LOOP;
  PERFORM pg_temp.ok(c = '{"company:invoices":0,"company:expenses":1,"company:bills":1,"unassigned:invoices":1,"unassigned:expenses":0,"unassigned:bills":0}'::jsonb,
    'with a company: that company''s records and the unassigned ones, separately: ' || c::text);
END $$;
SELECT pg_temp.as_user('f6000000-0000-4000-8000-00000000000d');
DO $$ DECLARE n bigint; BEGIN
  SELECT sum(needing) INTO n FROM public.vat_records_needing_attention('0a600000-0000-4000-8000-000000000001');
  PERFORM pg_temp.ok(n = 0, 'an admin of X sees only their own counts, never other members''');
END $$;

\echo '== the demo account'
SELECT pg_temp.as_user('f6000000-0000-4000-8000-0000000000e2');
SELECT pg_temp.fails($$INSERT INTO public.invoices (user_id, invoice_number, organization_id) VALUES ('f6000000-0000-4000-8000-0000000000e2', 'M1', '0a600000-0000-4000-8000-000000000001')$$, 'This is a demo account', 'demo: invoices refused (with a company)');
SELECT pg_temp.fails($$INSERT INTO public.expenses (user_id, category, description, amount, date, organization_id) VALUES ('f6000000-0000-4000-8000-0000000000e2', 'x', 'x', 1, '2026-11-07', '0a600000-0000-4000-8000-000000000001')$$, 'This is a demo account', 'demo: expenses refused');
SELECT pg_temp.fails($$INSERT INTO public.bills (user_id, vendor_name, description, amount, issue_date, due_date, organization_id) VALUES ('f6000000-0000-4000-8000-0000000000e2', 'V', 'x', 1, '2026-11-01', '2026-11-30', '0a600000-0000-4000-8000-000000000001')$$, 'This is a demo account', 'demo: bills refused');
RESET ROLE;

\echo '== server writes and anon'
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SET ROLE service_role;
DO $$ BEGIN
  UPDATE public.invoices SET organization_id = '0b600000-0000-4000-8000-000000000001' WHERE invoice_number = 'B-OLD';
  PERFORM pg_temp.ok(true, 'service_role writes are not checked by the trigger');
END $$;
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.fails($$SELECT * FROM public.vat_records_needing_attention()$$, 'permission denied', 'anon cannot call the attention counts');
RESET ROLE;
ROLLBACK;
