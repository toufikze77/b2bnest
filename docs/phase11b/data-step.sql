-- Phase 11b data step — PREPARED, NOT APPLIED. Separate approval, after proposal.sql, and BEFORE the new Business/Scale
-- prices are created in Stripe (so every Business/Scale price id in use today is an earlier price).
-- Before running: open each price id from mapping.sql in the Stripe dashboard and confirm it is £35/£350 (Business) or
-- £85/£850 (Scale). Records those ids in platform_plan_prices so the subscribers keep the earlier price's limits.
-- Changes no subscriber row. Undo: data-step-rollback.sql.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_plans WHERE key='professional_legacy') THEN RAISE EXCEPTION 'apply proposal.sql first'; END IF;
  -- At most four earlier prices exist (Business and Scale, monthly and annual).
  IF (SELECT count(DISTINCT s.stripe_price_id) FROM public.subscribers s
       WHERE s.subscribed AND s.plan_key IN ('professional','enterprise') AND s.stripe_price_id IS NOT NULL) > 4 THEN
    RAISE EXCEPTION 'more than 4 Business/Scale price ids in use: a new price may already be live; stop and check mapping.sql';
  END IF;
END $$;
INSERT INTO public.platform_plan_prices(stripe_price_id, plan_key, note)
SELECT DISTINCT s.stripe_price_id, s.plan_key || '_legacy', 'earlier price recorded by phase11b data-step'
  FROM public.subscribers s
 WHERE s.subscribed AND s.plan_key IN ('professional','enterprise') AND s.stripe_price_id IS NOT NULL
ON CONFLICT (stripe_price_id) DO NOTHING;
COMMIT;
