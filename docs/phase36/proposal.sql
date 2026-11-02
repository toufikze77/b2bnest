-- =====================================================================================================================
-- Phase 36: Platform Overview analytics (PREPARED, NOT APPLIED).
--
-- ONE new read-only function for the super-admin metric pages, for the four things no existing admin_* RPC can answer:
--   admin_overview_series('trials_ending', _)  companies whose owner's trial ends in the next 7 days and who have no
--                                              active subscription: company, owner email, trial end, days left (max 25)
--   admin_overview_series('ai_by_plan', days)  AI credits / requests / OpenAI cost in the window by plan, with the number
--                                              of active subscribers on each plan and its monthly list price
--   admin_overview_series('ai_top_users', days) the 10 heaviest AI users in the window: name, email, company, credits,
--                                              requests, cost, credits left / monthly limit, plan
--   admin_overview_series('ai_daily', days)    per day: requests, refunded requests, credits spent / refunded, cost
-- Nothing existing is changed. It returns nothing beyond what the admin screens already show (name, email, company
-- name) and never any prompt, answer or document text (the ledger holds none).
--
-- Same rules as every admin RPC (Phase 25): SECURITY DEFINER, search_path '', require_aal2_admin() as the first line
-- (logged in public.phase25_mfa_guard_log the same way as the others) and is_super_admin(auth.uid()). Executable by
-- authenticated and service_role only (as admin_ai_stats / admin_ai_ledger_summary); never anon.
--
-- ORDER: apply this, then publish the frontend. The frontend works without it: the four sections then say
-- "Not available until the Phase 36 database update is applied" and everything else is unaffected.
-- Rollback: docs/phase36/rollback.sql. Tests: docs/phase36/run-test.sh (disposable local Postgres).
-- =====================================================================================================================
BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.admin_overview_series(text,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 36 already exists (applied twice?)';
  END IF;
  IF to_regclass('public.ai_credit_ledger') IS NULL THEN RAISE EXCEPTION 'Phase 35 (ai_credit_ledger) is not applied'; END IF;
  IF to_regprocedure('public.require_aal2_admin()') IS NULL OR to_regclass('public.phase25_mfa_guard_log') IS NULL THEN
    RAISE EXCEPTION 'Phase 25 is not applied';
  END IF;
  IF to_regprocedure('public._access_entitled(text,boolean)') IS NULL OR to_regclass('public.plan_prices') IS NULL
     OR to_regprocedure('public.is_super_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'A dependency is missing (_access_entitled, plan_prices or is_super_admin)';
  END IF;
END $$;

CREATE FUNCTION public.admin_overview_series(_metric text, _days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(_days, 30), 1), 365);
  v_from timestamptz;
BEGIN
  PERFORM public.require_aal2_admin(); -- phase25 mfa guard
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_from := date_trunc('day', now()) - ((v_days - 1) || ' days')::interval;

  IF _metric = 'trials_ending' THEN
    RETURN (SELECT COALESCE(jsonb_agg(t ORDER BY t.trial_ends_at, t.company), '[]'::jsonb) FROM (
      SELECT o.id AS company_id, o.name AS company, p.email AS owner_email, p.trial_ends_at,
             GREATEST(0, ceil(extract(epoch FROM (p.trial_ends_at - now())) / 86400))::integer AS days_left
        FROM public.organizations o
        JOIN public.profiles p ON p.id = o.created_by
       WHERE p.trial_ends_at > now() AND p.trial_ends_at <= now() + interval '7 days'
         AND COALESCE(o.status, 'active') NOT IN ('suspended', 'cancelled') AND COALESCE(o.is_active, true)
         AND NOT EXISTS (SELECT 1 FROM public.subscribers s
                          WHERE s.user_id = p.id AND public._access_entitled(s.subscription_status, s.subscribed))
       ORDER BY p.trial_ends_at, o.name
       LIMIT 25) t);

  ELSIF _metric = 'ai_by_plan' THEN
    RETURN (SELECT COALESCE(jsonb_agg(x ORDER BY x.plan_key), '[]'::jsonb) FROM (
      WITH w AS (
        SELECT COALESCE(NULLIF(lower(l.plan_key), ''), 'none') AS plan_key, l.event, l.credits, l.cost_usd_micros
          FROM public.ai_credit_ledger l WHERE l.created_at >= v_from),
      keys AS (
        SELECT DISTINCT w.plan_key FROM w
        UNION SELECT DISTINCT lower(pp.plan_key) FROM public.plan_prices pp WHERE NOT pp.legacy)
      SELECT k.plan_key,
             (SELECT count(*) FROM w WHERE w.plan_key = k.plan_key AND w.event = 'reserve') AS requests,
             COALESCE((SELECT sum(-w.credits) FROM w WHERE w.plan_key = k.plan_key AND w.event = 'reserve'), 0)
               - COALESCE((SELECT sum(w.credits) FROM w WHERE w.plan_key = k.plan_key AND w.event = 'refund'), 0) AS credits,
             round(COALESCE((SELECT sum(w.cost_usd_micros) FROM w WHERE w.plan_key = k.plan_key AND w.event = 'usage'), 0) / 1000000.0, 6) AS cost_usd,
             (SELECT count(*) FROM public.subscribers s
               WHERE lower(COALESCE(NULLIF(s.plan_key, ''), s.subscription_tier, '')) = k.plan_key
                 AND public._access_entitled(s.subscription_status, s.subscribed)) AS subscribers,
             (SELECT pp.amount_pence FROM public.plan_prices pp
               WHERE lower(pp.plan_key) = k.plan_key AND pp.billing_interval = 'month' AND NOT pp.legacy LIMIT 1) AS monthly_price_pence
        FROM keys k) x);

  ELSIF _metric = 'ai_top_users' THEN
    RETURN (SELECT COALESCE(jsonb_agg(u ORDER BY u.credits DESC, u.requests DESC), '[]'::jsonb) FROM (
      WITH w AS (SELECT l.* FROM public.ai_credit_ledger l WHERE l.created_at >= v_from AND l.event IN ('reserve', 'refund', 'usage')),
      agg AS (
        SELECT w.user_id,
               COALESCE(sum(-w.credits) FILTER (WHERE w.event = 'reserve'), 0)
                 - COALESCE(sum(w.credits) FILTER (WHERE w.event = 'refund'), 0) AS credits,
               count(*) FILTER (WHERE w.event = 'reserve') AS requests,
               round(COALESCE(sum(w.cost_usd_micros) FILTER (WHERE w.event = 'usage'), 0) / 1000000.0, 6) AS cost_usd
          FROM w GROUP BY w.user_id ORDER BY 2 DESC, 3 DESC LIMIT 10)
      SELECT a.user_id,
             CASE WHEN a.user_id IS NULL THEN 'Deleted account' ELSE COALESCE(p.display_name, p.full_name, p.email) END AS name,
             p.email,
             COALESCE((SELECT o.name FROM public.organizations o WHERE o.created_by = a.user_id ORDER BY o.created_at LIMIT 1), NULLIF(p.company, '')) AS company,
             a.credits, a.requests, a.cost_usd,
             s.ai_credits_remaining AS credits_remaining, s.ai_credits_limit AS credits_limit,
             COALESCE(NULLIF(s.plan_key, ''), s.subscription_tier) AS plan
        FROM agg a
        LEFT JOIN public.profiles p ON p.id = a.user_id
        LEFT JOIN public.subscribers s ON s.user_id = a.user_id) u);

  ELSIF _metric = 'ai_daily' THEN
    RETURN (SELECT COALESCE(jsonb_agg(d ORDER BY d.day), '[]'::jsonb) FROM (
      WITH w AS (SELECT l.* FROM public.ai_credit_ledger l WHERE l.created_at >= v_from)
      SELECT to_char(g.day, 'YYYY-MM-DD') AS day,
             (SELECT count(*) FROM w WHERE w.event = 'reserve' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day') AS requests,
             (SELECT count(*) FROM w WHERE w.event = 'refund' AND w.credits > 0 AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day') AS refunded_requests,
             COALESCE((SELECT sum(-w.credits) FROM w WHERE w.event = 'reserve' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0) AS credits_spent,
             COALESCE((SELECT sum(w.credits) FROM w WHERE w.event = 'refund' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0) AS credits_refunded,
             round(COALESCE((SELECT sum(w.cost_usd_micros) FROM w WHERE w.event = 'usage' AND w.created_at >= g.day AND w.created_at < g.day + interval '1 day'), 0) / 1000000.0, 6) AS cost_usd
        FROM generate_series(v_from, date_trunc('day', now()), interval '1 day') AS g(day)) d);

  ELSE
    RAISE EXCEPTION 'Unknown metric' USING errcode = '22023';
  END IF;
END;
$function$;
-- Same privileges as admin_ai_stats / admin_ai_ledger_summary.
REVOKE ALL ON FUNCTION public.admin_overview_series(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview_series(text, integer) TO service_role, authenticated;

-- Phase 25 guard log row, recorded like the others (docs/phase25/rollback.sql strips exactly this line).
DO $$
DECLARE
  admin_snip constant text := E'\n  PERFORM public.require_aal2_admin(); -- phase25 mfa guard';
  src text;
BEGIN
  SELECT prosrc INTO src FROM pg_proc WHERE oid = to_regprocedure('public.admin_overview_series(text,integer)');
  IF position(admin_snip in src) = 0 THEN RAISE EXCEPTION 'admin_overview_series has no guard line'; END IF;
  INSERT INTO public.phase25_mfa_guard_log (fn, kind, old_md5, new_md5)
  VALUES ('public.admin_overview_series(text,integer)', 'admin', md5(replace(src, admin_snip, '')), md5(src));
END $$;

-- Final checks.
DO $$
BEGIN
  IF (SELECT array_agg(x ORDER BY x) FROM unnest((SELECT proacl::text[] FROM pg_proc WHERE oid = to_regprocedure('public.admin_overview_series(text,integer)'))) x)
       IS DISTINCT FROM ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres'] THEN
    RAISE EXCEPTION 'admin_overview_series privileges are not as intended';
  END IF;
  IF has_function_privilege('anon', 'public.admin_overview_series(text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute admin_overview_series';
  END IF;
  IF NOT (SELECT proconfig @> ARRAY['search_path=""'] FROM pg_proc WHERE oid = to_regprocedure('public.admin_overview_series(text,integer)')) THEN
    RAISE EXCEPTION 'admin_overview_series is not pinned to search_path ''''';
  END IF;
END $$;

COMMIT;

-- =====================================================================================================================
-- CHECKS AFTER APPLYING (read-only, SQL editor as postgres):
--   SELECT p.oid::regprocedure, p.proacl, p.proconfig FROM pg_proc p WHERE p.proname = 'admin_overview_series';
--   SELECT fn, kind, old_md5, new_md5 FROM public.phase25_mfa_guard_log WHERE fn = 'public.admin_overview_series(text,integer)';
--   -- As a super admin with aal2 (simplest: from the Platform Overview pages). From the SQL editor:
--   --   BEGIN;
--   --   SET LOCAL request.jwt.claims = '{"sub":"<super admin uuid>","role":"authenticated","aal":"aal2"}';
--   --   SET LOCAL role authenticated;
--   --   SELECT public.admin_overview_series('trials_ending', 30);
--   --   SELECT public.admin_overview_series('ai_by_plan', 30);
--   --   SELECT public.admin_overview_series('ai_top_users', 30);
--   --   SELECT jsonb_array_length(public.admin_overview_series('ai_daily', 30));   -- 30
--   --   ROLLBACK;
-- =====================================================================================================================
