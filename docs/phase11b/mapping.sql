-- Phase 11b: READ-ONLY. Which plan row each active subscriber maps to. Run any time; changes nothing.
-- Every Business/Scale subscriber TODAY pays an earlier price (the new £59/£89 prices don't exist in Stripe until the
-- owner creates them), so their Stripe price ids are the legacy ones data-step.sql records.
SELECT s.plan_key, s.billing_interval, s.subscription_status, s.stripe_price_id,
       CASE WHEN s.plan_key IN ('professional','enterprise') THEN s.plan_key || '_legacy' ELSE s.plan_key END AS proposed_plan_row,
       count(*) AS subscribers
  FROM public.subscribers s
 WHERE s.subscribed
 GROUP BY 1,2,3,4,5
 ORDER BY 1,2;
