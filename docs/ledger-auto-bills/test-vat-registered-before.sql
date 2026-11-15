-- Finance phase 3b follow-up 2 tests, part 1 (DISPOSABLE local Postgres only): companies for the backfill rule,
-- committed before vat-registered.sql is applied. Fictional people only.
--  V1 an HMRC connection row (sandbox, disconnected)   V2 a saved VAT number   V3 an invoice with recorded VAT > 0
--  V4 a bill with recorded VAT > 0                      V5 an expense with recorded VAT > 0
--  V6 only VAT-not-recorded records (stays No)          V7 a recorded bill with zero VAT (stays No)
--  V8 a saved VAT number but closed (left alone)        V9 a blank VAT number (stays No)
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('fe000000-0000-4000-8000-000000000001', 'v1@example.test');
INSERT INTO public.profiles (id, email, full_name, is_active, currency_code) VALUES ('fe000000-0000-4000-8000-000000000001', 'v1@example.test', 'Vat Owner', true, 'GBP')
ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP';
INSERT INTO public.organizations (id, name, slug, created_by)
SELECT ('0fe10000-0000-4000-8000-00000000000' || x)::uuid, 'Vat ' || x, 'vat-co-' || x, 'fe000000-0000-4000-8000-000000000001' FROM generate_series(1, 9) x;
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
SELECT ('0fe10000-0000-4000-8000-00000000000' || x)::uuid, 'fe000000-0000-4000-8000-000000000001', 'owner', true FROM generate_series(1, 9) x;
INSERT INTO public.hmrc_connections (company_id, environment, status) VALUES ('0fe10000-0000-4000-8000-000000000001', 'sandbox', 'disconnected');
INSERT INTO public.hmrc_settings (user_id, organization_id, vat_number) VALUES
  ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000002', 'GB123456789'),
  ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000008', 'GB987654321'),
  ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000009', '   ');
INSERT INTO public.invoices (user_id, organization_id, invoice_number, status, subtotal, tax_amount, total_amount, currency, vat_status, items, tax_point_date)
VALUES ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000003', 'V3-1', 'sent', 100, 20, 120, 'GBP', 'recorded',
        '[{"vat_treatment": "standard", "vat_rate": 20, "net": 100, "vat": 20, "gross": 120}]'::jsonb, '2026-02-01');
INSERT INTO public.bills (user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                          currency, issue_date, due_date, tax_point_date, status, category)
VALUES ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000004', 'V4-1', 'Acme', 'x', 120, 100, 20, 20, 'standard', 'recorded', 'GBP', '2026-02-01', '2026-03-01', '2026-02-01', 'pending', 'Software'),
       ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000007', 'V7-1', 'Acme', 'x', 100, 100, 0, 0, 'zero', 'recorded', 'GBP', '2026-02-01', '2026-03-01', '2026-02-01', 'pending', 'Software');
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
VALUES ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000005', 'transport', 'Taxi', 12, 10, 2, 20, 'standard', 'recorded', '2026-02-01', '2026-02-01', 'approved');
INSERT INTO public.expenses (user_id, organization_id, category, description, amount, date, status)
VALUES ('fe000000-0000-4000-8000-000000000001', '0fe10000-0000-4000-8000-000000000006', 'transport', 'Bus', 3, '2026-02-01', 'approved');
SELECT public.data_rights_close_company('0fe10000-0000-4000-8000-000000000008', 'fe000000-0000-4000-8000-000000000001', NULL, false);
