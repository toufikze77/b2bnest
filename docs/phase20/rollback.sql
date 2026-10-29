-- Phase 20 rollback: removes public.refund_ai_credit. check_and_deduct_ai_credit was never changed, so nothing else
-- needs restoring. Credits already given back stay given back. One transaction.
BEGIN;
DROP FUNCTION IF EXISTS public.refund_ai_credit(uuid, integer);
COMMIT;
