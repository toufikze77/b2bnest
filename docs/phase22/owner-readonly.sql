-- Phase 22: READ-ONLY queries for the owner (no changes). Run in the Supabase SQL editor.
-- A. Confirm production still has the function bodies this PR was prepared against (all three must say "same").
SELECT p.proname, CASE md5(pg_get_functiondef(p.oid))
         WHEN '28ee18513e9010929d93f70c89dfa7da' THEN 'same' WHEN 'f8061f10eb397748969715af30661310' THEN 'same'
         WHEN '24265c01d545e12517a1f15edebf0d5b' THEN 'same' ELSE 'CHANGED' END AS vs_prepared
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('admin_overview_stats', 'admin_list_subscriptions', 'admin_list_users');

-- B. What the active subscription(s) really pay, by plan and interval (counts only). Compare with today's MRR tile.
SELECT plan_key, billing_interval, subscription_status, count(*) AS rows,
       count(DISTINCT stripe_price_id) AS distinct_prices
  FROM public.subscribers
 WHERE public._access_entitled(subscription_status, subscribed)
 GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;

-- C. How the 'cancelled' rows came about (status from Stripe; counts only). 'incomplete_expired' = never paid.
SELECT coalesce(subscription_status, '(none)') AS stripe_status, subscribed, (subscription_end < now()) AS ended, count(*)
  FROM public.subscribers GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
