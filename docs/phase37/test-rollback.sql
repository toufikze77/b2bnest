-- Phase 37 rollback tests. run-test.sh runs this after test.sql and after checking that rollback.sql refuses without
-- app.phase37_force while lots exist.
\set ON_ERROR_STOP 1
\i docs/phase37/test-helpers.sql
CREATE TEMP TABLE t_ledger AS SELECT count(*) AS n FROM public.ai_credit_ledger;
SET app.phase37_force = 'on';
\i docs/phase37/rollback.sql
RESET app.phase37_force;
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT string_agg(p.oid::regprocedure::text || '=' || md5(p.prosrc), ' ' ORDER BY p.proname)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname IN ('check_and_deduct_ai_credit','get_ai_credits_info','refund_ai_credit'))
    = 'check_and_deduct_ai_credit(uuid,integer,text,uuid)=659fcdfaeb9073f49f1661316465e459 get_ai_credits_info(uuid)=f6869e2ac74c56c9439f34e670508a79 refund_ai_credit(uuid,integer,text,uuid)=538c31c2514b2cad8aa83e1dc205517f',
    'rollback: the three functions are the exact Phase 35 bodies again');
  PERFORM pg_temp.ok((SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = 'public.refund_ai_credit(uuid,integer,text,uuid)'::regprocedure)) x)
                     = ARRAY['postgres=X/postgres','service_role=X/postgres'], 'rollback: refund_ai_credit still service role only');
  PERFORM pg_temp.ok(NOT has_function_privilege('anon', 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
                     AND has_function_privilege('authenticated', 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)', 'EXECUTE')
                     AND has_function_privilege('authenticated', 'public.get_ai_credits_info(uuid)', 'EXECUTE'), 'rollback: user function privileges as before');
  PERFORM pg_temp.ok((SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.check_and_deduct_ai_credit(uuid,integer,text,uuid)') = '659fcdfaeb9073f49f1661316465e459'
                     AND (SELECT new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.get_ai_credits_info(uuid)') = 'f6869e2ac74c56c9439f34e670508a79'
                     AND NOT EXISTS (SELECT 1 FROM public.phase25_mfa_guard_log WHERE fn ~ 'topup'), 'rollback: guard log rows restored, new rows removed');
  PERFORM pg_temp.ok(to_regclass('public.ai_credit_lots') IS NULL AND to_regclass('public.ai_topup_packs') IS NULL AND to_regclass('public.ai_topup_checkouts') IS NULL
                     AND to_regclass('public.phase37_function_backup') IS NULL AND to_regprocedure('public.grant_ai_topup(uuid,text,text,text,integer)') IS NULL
                     AND to_regprocedure('public._ai_topup_balance(uuid)') IS NULL, 'rollback: tables and functions removed');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_credit_ledger' AND column_name IN ('topup_credits', 'topup_lots'))
                     AND (SELECT count(*) FROM public.ai_credit_ledger) = (SELECT n FROM t_ledger), 'rollback: ledger columns dropped, every row kept');
END $$;
SET request.jwt.claims = '{"role":"service_role"}';
SET ROLE service_role;
DO $$ DECLARE j json; BEGIN
  j := public.check_and_deduct_ai_credit('d0000000-0000-4000-8000-000000000001', 1, 'ai_assistant', 'c7000000-0000-4000-8000-000000000010');
  PERFORM pg_temp.ok((j ->> 'success')::boolean AND j ->> 'topup_credits' IS NULL, 'after rollback the Phase 35 function works as before');
END $$;
RESET ROLE; RESET request.jwt.claims;

\echo '== apply again'
\i docs/phase37/proposal.sql
DO $$ BEGIN
  PERFORM pg_temp.ok(to_regclass('public.ai_credit_lots') IS NOT NULL AND (SELECT count(*) FROM public.ai_topup_packs) = 3
                     AND (SELECT count(*) FROM public.phase25_mfa_guard_log WHERE fn ~ 'topup') = 5, 're-apply after rollback works');
END $$;
