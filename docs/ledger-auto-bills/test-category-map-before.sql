-- Finance phase 3b follow-up tests, part 1 (DISPOSABLE local Postgres only): the state before the follow-up, committed.
-- Run by docs/ledger-auto-bills/run-test.sh on a fresh copy with phase 3b applied. Fictional people only.
--  F (0fd…1): owner fd…1 paying Business, bills and expenses on. G (0fd…2): owner fd…2 on the trial, bills and expenses
--  switched on, used, then switched off again.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('fd000000-0000-4000-8000-000000000001', 'm1@example.test'), ('fd000000-0000-4000-8000-000000000002', 'm2@example.test');
INSERT INTO public.profiles (id, email, full_name, trial_ends_at, is_active, currency_code) VALUES
  ('fd000000-0000-4000-8000-000000000001', 'm1@example.test', 'Map One', NULL, true, 'GBP'),
  ('fd000000-0000-4000-8000-000000000002', 'm2@example.test', 'Map Two', now() + interval '5 days', true, 'GBP')
ON CONFLICT (id) DO UPDATE SET currency_code = 'GBP', trial_ends_at = EXCLUDED.trial_ends_at;
INSERT INTO public.subscribers (user_id, email, subscribed, subscription_status, plan_key) VALUES ('fd000000-0000-4000-8000-000000000001', 'm1@example.test', true, 'active', 'professional');
INSERT INTO public.organizations (id, name, slug, created_by) VALUES
  ('0fd00000-0000-4000-8000-000000000001', 'Map F', 'map-f', 'fd000000-0000-4000-8000-000000000001'),
  ('0fd00000-0000-4000-8000-000000000002', 'Map G', 'map-g', 'fd000000-0000-4000-8000-000000000002');
INSERT INTO public.organization_members (organization_id, user_id, role, is_active) VALUES
  ('0fd00000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-000000000001', 'owner', true),
  ('0fd00000-0000-4000-8000-000000000002', 'fd000000-0000-4000-8000-000000000002', 'owner', true);
INSERT INTO public.organization_billing (organization_id, billing_user_id) VALUES
  ('0fd00000-0000-4000-8000-000000000001', 'fd000000-0000-4000-8000-000000000001'), ('0fd00000-0000-4000-8000-000000000002', 'fd000000-0000-4000-8000-000000000002');

SELECT set_config('request.jwt.claims', '{"sub":"fd000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_setup('0fd00000-0000-4000-8000-000000000001', '2026-01-01', 'fresh', NULL);
SELECT public.ledger_auto_set('0fd00000-0000-4000-8000-000000000001', true, 'bills_and_expenses');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"fd000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_setup('0fd00000-0000-4000-8000-000000000002', '2026-01-01', 'fresh', NULL);
SELECT public.ledger_auto_set('0fd00000-0000-4000-8000-000000000002', true, 'bills_and_expenses');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);

-- The company's own edits (no edit screen yet, so written directly here): rent re-pointed, fuel added by hand.
UPDATE public.ledger_category_map SET account_id = (SELECT id FROM public.ledger_accounts WHERE organization_id = '0fd00000-0000-4000-8000-000000000001' AND code = '8200'), is_default = false
 WHERE organization_id = '0fd00000-0000-4000-8000-000000000001' AND category_key = 'rent';
INSERT INTO public.ledger_category_map (organization_id, category_key, account_id, is_default)
VALUES ('0fd00000-0000-4000-8000-000000000001', 'fuel', (SELECT id FROM public.ledger_accounts WHERE organization_id = '0fd00000-0000-4000-8000-000000000001' AND code = '7500'), false);

-- Expenses and a bill, VAT recorded.
INSERT INTO public.expenses (id, user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
SELECT ('0fe00000-0000-4000-8000-00000000000' || n)::uuid, 'fd000000-0000-4000-8000-000000000001', '0fd00000-0000-4000-8000-000000000001', c, 'Test ' || c,
       12.00, 10.00, 2.00, 20, 'standard', 'recorded', '2026-02-14', '2026-02-14', 'approved'
  FROM (VALUES (1, 'Travel'), (2, 'office_costs'), (3, 'transport'), (4, 'wages_salaries'), (5, 'equipment_tools'), (6, 'taxes_duties')) v(n, c);
INSERT INTO public.bills (id, user_id, organization_id, bill_number, vendor_name, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status,
                          currency, issue_date, due_date, tax_point_date, status, category)
VALUES ('0fe00000-0000-4000-8000-000000000009', 'fd000000-0000-4000-8000-000000000001', '0fd00000-0000-4000-8000-000000000001', 'EQ-1', 'Kit Ltd', 'Drill',
        120.00, 100.00, 20.00, 20, 'standard', 'recorded', 'GBP', '2026-02-14', '2026-03-14', '2026-02-14', 'pending', 'Equipment');
-- Company G: a transport expense held, then G switches bills and expenses off.
INSERT INTO public.expenses (id, user_id, organization_id, category, description, amount, net_amount, vat_amount, vat_rate, vat_treatment, vat_status, date, tax_point_date, status)
VALUES ('0fe00000-0000-4000-8000-000000000008', 'fd000000-0000-4000-8000-000000000002', '0fd00000-0000-4000-8000-000000000002', 'transport', 'Taxi',
        12.00, 10.00, 2.00, 20, 'standard', 'recorded', '2026-02-14', '2026-02-14', 'approved');
SELECT public.ledger_process_queue();
SELECT set_config('request.jwt.claims', '{"sub":"fd000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}', false);
SET ROLE authenticated;
SELECT public.ledger_auto_set('0fd00000-0000-4000-8000-000000000002', false, 'bills_and_expenses');
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
