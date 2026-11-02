-- =====================================================================================================================
-- Phase 37 rollback (one transaction). Restores check_and_deduct_ai_credit, refund_ai_credit and get_ai_credits_info to
-- the exact Phase 35 bodies (from public.phase37_function_backup, checked by hash), their privileges and Phase 25 guard
-- log rows, then removes everything Phase 37 added.
--
-- !!! MONEY: this DROPS public.ai_credit_lots. Customers who paid for credits would lose them. It REFUSES while any lot
-- !!! exists, unless you first export the lots and decide how to make those customers whole, and then run it with
-- !!!   SET LOCAL app.phase37_force = 'on';   (inside the same transaction, after BEGIN)
-- !!! Roll back the Edge Functions first (create-ai-topup-checkout off, previous stripe-webhook), so no new purchase lands.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.phase37_function_backup') IS NULL THEN RAISE EXCEPTION 'Phase 37 is not applied'; END IF;
  IF (SELECT count(*) FROM public.phase37_function_backup) <> 3 OR (SELECT count(*) FROM public.phase37_guard_log_backup) <> 2 THEN
    RAISE EXCEPTION 'Phase 37 backup is incomplete';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_credit_lots) AND COALESCE(current_setting('app.phase37_force', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Customers have bought AI credits (% lot(s)). Export public.ai_credit_lots and decide how to make them whole first; then SET LOCAL app.phase37_force = ''on''.',
      (SELECT count(*) FROM public.ai_credit_lots);
  END IF;
END $$;

DROP FUNCTION public.admin_ai_topup_summary(integer);
DROP FUNCTION public.void_ai_topup(text, text, text);
DROP FUNCTION public.grant_ai_topup(uuid, text, text, text, integer);
DROP FUNCTION public.attach_ai_topup_session(uuid, text);
DROP FUNCTION public.begin_ai_topup_checkout(uuid, text);

-- The saved Phase 35 bodies (CREATE OR REPLACE keeps the privileges; checked below).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.phase37_function_backup ORDER BY fn LOOP
    EXECUTE r.def;
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure('public.' || r.fn)) IS DISTINCT FROM r.src_md5 THEN
      RAISE EXCEPTION '% did not return to its saved body', r.fn;
    END IF;
    IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure('public.' || r.fn))) x)
       IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(r.acl::text[]) x) THEN
      RAISE EXCEPTION '% privileges differ from the saved ones', r.fn;
    END IF;
  END LOOP;
END $$;
DROP FUNCTION public._ai_topup_balance(uuid);

DELETE FROM public.phase25_mfa_guard_log
 WHERE fn IN ('public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'public.get_ai_credits_info(uuid)',
              'public.begin_ai_topup_checkout(uuid,text)', 'public.attach_ai_topup_session(uuid,text)',
              'public.grant_ai_topup(uuid,text,text,text,integer)', 'public.void_ai_topup(text,text,text)',
              'public.admin_ai_topup_summary(integer)');
INSERT INTO public.phase25_mfa_guard_log SELECT * FROM public.phase37_guard_log_backup;

ALTER TABLE public.ai_credit_ledger DROP COLUMN topup_lots, DROP COLUMN topup_credits;
DROP TABLE public.ai_topup_checkouts;
DROP TABLE public.ai_credit_lots;
DROP TABLE public.ai_topup_packs;
DROP TABLE public.phase37_guard_log_backup;
DROP TABLE public.phase37_function_backup;
COMMIT;
