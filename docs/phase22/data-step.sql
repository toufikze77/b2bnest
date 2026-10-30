-- Phase 22 data step (OWNER, after proposal.sql). Maps each catalogue price to its Stripe Price id so MRR/ARR/Value use
-- exactly what each subscriber pays (legacy £35/£85 prices included). Until a price is mapped, its subscribers are
-- valued at TODAY's price for their plan and interval and Admin says how many are estimates.
--
-- 1. In the Stripe dashboard (Product catalogue → each product → Pricing), copy the Price id (price_...) for each lookup
--    key below. Prices without a lookup key: match them by amount and interval. Only the ones that exist are needed.
-- 2. Replace each 'price_...' placeholder and run this file. Rows left as placeholders are skipped.
BEGIN;
UPDATE public.plan_prices p SET stripe_price_id = v.price_id
  FROM (VALUES
    ('b2bnest_starter_monthly_gbp',      'price_REPLACE_ME'),
    ('b2bnest_starter_annual_gbp',       'price_REPLACE_ME'),
    ('b2bnest_business_monthly_gbp',     'price_REPLACE_ME'),
    ('b2bnest_business_annual_gbp',      'price_REPLACE_ME'),
    ('b2bnest_professional_monthly_gbp', 'price_REPLACE_ME'),  -- legacy Business £35
    ('b2bnest_professional_annual_gbp',  'price_REPLACE_ME'),  -- legacy Business £350
    ('b2bnest_scale_monthly_gbp',        'price_REPLACE_ME'),
    ('b2bnest_scale_annual_gbp',         'price_REPLACE_ME'),
    ('b2bnest_enterprise_monthly_gbp',   'price_REPLACE_ME'),  -- legacy Scale £85
    ('b2bnest_enterprise_annual_gbp',    'price_REPLACE_ME')   -- legacy Scale £850
  ) AS v(lookup_key, price_id)
 WHERE p.lookup_key = v.lookup_key AND v.price_id <> 'price_REPLACE_ME';
COMMIT;

-- 3. Read-only check: subscribers whose price is still not mapped (counts only; no emails or ids).
SELECT count(*) FILTER (WHERE public._access_entitled(s.subscription_status, s.subscribed)) AS entitled_unmapped,
       count(*) AS all_unmapped
  FROM public.subscribers s
 WHERE s.stripe_price_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.plan_prices pp WHERE pp.stripe_price_id = s.stripe_price_id);
