-- Phase 36 test fixture (DISPOSABLE local Postgres only). Runs after the Phase 35 shim, fixture and proposal
-- (docs/phase36/run-test.sh), so the ledger and its functions are exactly as in production.
-- Adds what admin_overview_series reads, with the production columns (information_schema, 2 Nov 2026), the production
-- plan_prices rows, and public._access_entitled copied verbatim from production.
ALTER TABLE public.profiles ADD COLUMN company text, ADD COLUMN trial_ends_at timestamptz;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text, description text, logo_url text,
  settings jsonb, subscription_tier text, is_active boolean DEFAULT true, created_by uuid, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(), status text, suspended_at timestamptz, suspension_reason text
);

CREATE TABLE public.plan_prices (
  lookup_key text PRIMARY KEY, plan_key text NOT NULL, billing_interval text NOT NULL, amount_pence integer NOT NULL,
  legacy boolean NOT NULL DEFAULT false, stripe_price_id text
);
INSERT INTO public.plan_prices (lookup_key, plan_key, billing_interval, amount_pence, legacy) VALUES
  ('b2bnest_starter_monthly_gbp', 'starter', 'month', 1900, false), ('b2bnest_starter_annual_gbp', 'starter', 'year', 19000, false),
  ('b2bnest_business_monthly_gbp', 'professional', 'month', 5900, false), ('b2bnest_business_annual_gbp', 'professional', 'year', 59000, false),
  ('b2bnest_professional_monthly_gbp', 'professional', 'month', 3500, true), ('b2bnest_professional_annual_gbp', 'professional', 'year', 35000, true),
  ('b2bnest_scale_monthly_gbp', 'enterprise', 'month', 8900, false), ('b2bnest_scale_annual_gbp', 'enterprise', 'year', 89000, false),
  ('b2bnest_enterprise_monthly_gbp', 'enterprise', 'month', 8500, true), ('b2bnest_enterprise_annual_gbp', 'enterprise', 'year', 85000, true);

CREATE OR REPLACE FUNCTION public._access_entitled(_status text, _subscribed boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN _status IS NULL THEN coalesce(_subscribed, false)
              ELSE _status IN ('active','trialing','past_due','unpaid') END $function$;
