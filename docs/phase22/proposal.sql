-- Phase 22: Admin shows real plan names, no "free" tier, and MRR/ARR/Value from what each subscriber really pays.
-- PREPARED, not applied. One transaction.
--
-- Before (live on 30 Oct 2026, read from production with pg_get_functiondef; the repo's migrations match):
--  * MRR = sum of platform_plans.monthly_price for every subscribers row with subscribed = true, matched on the TIER
--    name. A legacy Business subscriber (£35) counted as £59, a Scale one (£85) as £89, and an annual subscriber as the
--    monthly price (Business £590/year counted as £59 a month, not £49.17). ARR = MRR x 12.
--  * Value (per row) = the same fixed monthly price, shown even on cancelled rows.
--  * Status: 'active' if subscribed; 'trial' from the old profiles.is_trial_active flag; 'cancelled' whenever
--    subscription_end is in the past (also a checkout that was started and never paid: Stripe "incomplete_expired");
--    otherwise 'free'. "free_users" counted every profile without subscribed = true.
-- After:
--  * public.plan_prices: the plan catalogue's prices (supabase/functions/_shared/plans.ts: 6 current, 4 legacy). The
--    owner fills stripe_price_id from the Stripe dashboard (data-step.sql); src/test/planCatalogue.test.ts fails if
--    these rows ever disagree with the catalogue.
--  * public._subscriber_monthly_value(): 0 unless the subscription is entitled (public._access_entitled, the same rule
--    as access); else the price the row's stripe_price_id maps to (annual / 12); if that price id isn't mapped yet, an
--    ESTIMATE at today's price for its plan and interval, counted separately (mrr_estimated) so Admin can say so.
--  * Status: active / not_completed (checkout never paid) / cancelled / no_plan. "free" is accepted as an old filter
--    value and means no_plan. Each row also carries access_state from public._access_state_for() (trial, trial_ended,
--    suspended, owner, subscribed): the same single source the app uses. "free_users" is still returned (same number,
--    now named no_plan_users) so the old screen keeps working until the new one is published.
-- Nobody's entitlement changes: these functions only report. Guarded by the live body hashes of the three functions.
BEGIN;

DO $$
DECLARE h text;
BEGIN
  SELECT md5(pg_get_functiondef('public.admin_overview_stats()'::regprocedure)) INTO h;
  IF h <> '28ee18513e9010929d93f70c89dfa7da' THEN RAISE EXCEPTION 'Phase 22: admin_overview_stats has changed since this was prepared (md5 %); nothing applied', h; END IF;
  SELECT md5(pg_get_functiondef('public.admin_list_subscriptions(text,text,integer,integer)'::regprocedure)) INTO h;
  IF h <> 'f8061f10eb397748969715af30661310' THEN RAISE EXCEPTION 'Phase 22: admin_list_subscriptions has changed since this was prepared (md5 %); nothing applied', h; END IF;
  SELECT md5(pg_get_functiondef('public.admin_list_users(text,text,integer,integer,text)'::regprocedure)) INTO h;
  IF h <> '24265c01d545e12517a1f15edebf0d5b' THEN RAISE EXCEPTION 'Phase 22: admin_list_users has changed since this was prepared (md5 %); nothing applied', h; END IF;
  IF to_regprocedure('public._access_entitled(text,boolean)') IS NULL OR to_regprocedure('public._access_state_for(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Phase 22: the Phase 12 access functions are missing; nothing applied';
  END IF;
  IF to_regclass('public.plan_prices') IS NOT NULL THEN RAISE EXCEPTION 'Phase 22: public.plan_prices already exists (applied twice?)'; END IF;
END $$;

-- ---------------------------------------------------------------- the catalogue's prices ----------------------------
CREATE TABLE public.plan_prices (
  lookup_key text PRIMARY KEY,
  plan_key text NOT NULL CHECK (plan_key IN ('starter', 'professional', 'enterprise')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  legacy boolean NOT NULL,
  -- The Stripe Price id (price_...) for this lookup key. Filled by the owner (data-step.sql). NULL = not mapped yet.
  stripe_price_id text UNIQUE
);
COMMENT ON TABLE public.plan_prices IS
  'Phase 22: plan catalogue prices (same as supabase/functions/_shared/plans.ts), used by Admin MRR/ARR/Value. Admin functions only.';
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;  -- no policies: only SECURITY DEFINER functions read it
REVOKE ALL ON public.plan_prices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.plan_prices TO service_role;

INSERT INTO public.plan_prices (lookup_key, plan_key, billing_interval, amount_pence, legacy) VALUES
  ('b2bnest_starter_monthly_gbp',      'starter',      'month',  1900, false),
  ('b2bnest_starter_annual_gbp',       'starter',      'year',  19000, false),
  ('b2bnest_business_monthly_gbp',     'professional', 'month',  5900, false),
  ('b2bnest_business_annual_gbp',      'professional', 'year',  59000, false),
  ('b2bnest_professional_monthly_gbp', 'professional', 'month',  3500, true),
  ('b2bnest_professional_annual_gbp',  'professional', 'year',  35000, true),
  ('b2bnest_scale_monthly_gbp',        'enterprise',   'month',  8900, false),
  ('b2bnest_scale_annual_gbp',         'enterprise',   'year',  89000, false),
  ('b2bnest_enterprise_monthly_gbp',   'enterprise',   'month',  8500, true),
  ('b2bnest_enterprise_annual_gbp',    'enterprise',   'year',  85000, true);

-- ---------------------------------------------------------------- one subscriber's monthly value ---------------------
CREATE FUNCTION public._subscriber_monthly_value(_status text, _subscribed boolean, _price_id text, _plan_key text,
                                                 _tier text, _interval text)
RETURNS TABLE(monthly numeric, basis text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_amount integer; v_interval text; v_key text;
BEGIN
  IF NOT public._access_entitled(_status, _subscribed) THEN RETURN QUERY SELECT 0::numeric, 'none'::text; RETURN; END IF;
  SELECT pp.amount_pence, pp.billing_interval INTO v_amount, v_interval
    FROM public.plan_prices pp WHERE _price_id IS NOT NULL AND pp.stripe_price_id = _price_id;
  IF FOUND THEN
    RETURN QUERY SELECT round(v_amount / 100.0 / CASE WHEN v_interval = 'year' THEN 12 ELSE 1 END, 2), 'stripe_price'::text; RETURN;
  END IF;
  -- Not mapped yet: today's price for the plan and interval, reported as an estimate.
  v_key := lower(COALESCE(NULLIF(_plan_key, ''), _tier, ''));
  SELECT pp.amount_pence, pp.billing_interval INTO v_amount, v_interval
    FROM public.plan_prices pp
   WHERE pp.plan_key = v_key AND pp.billing_interval = COALESCE(NULLIF(_interval, ''), 'month') AND NOT pp.legacy;
  IF FOUND THEN
    RETURN QUERY SELECT round(v_amount / 100.0 / CASE WHEN v_interval = 'year' THEN 12 ELSE 1 END, 2), 'estimate'::text; RETURN;
  END IF;
  RETURN QUERY SELECT 0::numeric, 'unknown'::text;
END $$;
REVOKE ALL ON FUNCTION public._subscriber_monthly_value(text, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- subscriptions list --------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(_status text DEFAULT NULL, _search text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows jsonb; total integer; v_status text := CASE WHEN _status = 'free' THEN 'no_plan' ELSE _status END;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT s.id, s.email, s.subscription_tier AS plan, s.plan_key, s.billing_interval, s.subscription_status, s.subscribed,
      s.subscription_end, s.created_at, s.updated_at, s.ai_credits_remaining, s.ai_credits_limit,
      p.company, COALESCE(p.is_trial_active,false) AS is_trial_active,
      (SELECT a.state FROM public._access_state_for(s.user_id) a) AS access_state,
      v.monthly AS value, v.basis AS value_basis,
      CASE WHEN public._access_entitled(s.subscription_status, s.subscribed) THEN 'active'
           WHEN s.subscription_status IN ('incomplete', 'incomplete_expired') THEN 'not_completed'
           WHEN s.subscription_status = 'canceled' OR (s.subscription_end IS NOT NULL AND s.subscription_end < now()) THEN 'cancelled'
           ELSE 'no_plan' END AS status
    FROM public.subscribers s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    CROSS JOIN LATERAL public._subscriber_monthly_value(s.subscription_status, s.subscribed, s.stripe_price_id, s.plan_key,
                                                        s.subscription_tier, s.billing_interval) v
    WHERE (_search IS NULL OR _search = '' OR s.email ILIKE '%'||_search||'%')
  ), filtered AS (
    SELECT * FROM base WHERE v_status IS NULL OR v_status = 'all' OR status = v_status
      OR (v_status = 'trial' AND access_state = 'trial')
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $$;

-- ---------------------------------------------------------------- users list ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0, _plan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows jsonb; total integer;
  v_status text := CASE WHEN _status = 'free' THEN 'no_plan' ELSE _status END;
  v_plan text := CASE WHEN lower(_plan) = 'free' THEN 'no_plan' ELSE lower(_plan) END;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT p.id, p.email, COALESCE(p.display_name, p.full_name) AS name, p.company, p.created_at,
           COALESCE(p.is_active, true) AS is_active, p.is_trial_active, p.trial_ends_at,
           (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = p.id) AS last_login,
           (SELECT o.name FROM public.organizations o WHERE o.created_by = p.id ORDER BY o.created_at LIMIT 1) AS owned_company,
           (SELECT o.id FROM public.organizations o
              JOIN public.organization_members m ON m.organization_id = o.id AND m.user_id = p.id
              ORDER BY m.joined_at NULLS LAST LIMIT 1) AS organization_id,
           (SELECT o.name FROM public.organizations o
              JOIN public.organization_members m ON m.organization_id = o.id AND m.user_id = p.id
              ORDER BY m.joined_at NULLS LAST LIMIT 1) AS organization_name,
           (SELECT upper(m.role) FROM public.organization_members m WHERE m.user_id = p.id ORDER BY m.joined_at NULLS LAST LIMIT 1) AS company_role,
           (SELECT s.subscription_tier FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS plan,
           (SELECT s.plan_key FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS plan_key,
           (SELECT public._access_entitled(s.subscription_status, s.subscribed) FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS subscribed,
           (SELECT a.state FROM public._access_state_for(p.id) a) AS access_state,
           (SELECT a.plan_key FROM public._access_state_for(p.id) a) AS access_plan_key,
           (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id AND pr.deleted_at IS NULL) AS projects,
           (SELECT count(*) FROM public.documents d WHERE d.user_id = p.id) AS documents,
           (SELECT count(*) FROM public.ai_conversations ac WHERE ac.user_id = p.id) AS ai_usage,
           (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id ORDER BY r.created_at LIMIT 1) AS role
    FROM public.profiles p
    WHERE (_search IS NULL OR _search = '' OR p.email ILIKE '%'||_search||'%' OR COALESCE(p.display_name,p.full_name,'') ILIKE '%'||_search||'%' OR COALESCE(p.company,'') ILIKE '%'||_search||'%')
  ), filtered AS (
    SELECT * FROM base WHERE (v_status IS NULL OR v_status = 'all'
      OR (v_status = 'active' AND is_active)
      OR (v_status = 'suspended' AND (NOT is_active OR access_state = 'suspended'))
      OR (v_status = 'paid' AND COALESCE(subscribed,false))
      OR (v_status = 'no_plan' AND COALESCE(subscribed,false) = false)
      OR (v_status IN ('trial', 'trial_ended', 'owner') AND access_state = v_status))
    AND (v_plan IS NULL OR v_plan = 'all'
      OR (v_plan = 'no_plan' AND COALESCE(subscribed,false) = false)
      OR (COALESCE(subscribed,false) AND lower(COALESCE(NULLIF(plan_key,''), plan, '')) = v_plan))
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $$;

-- ---------------------------------------------------------------- overview tiles ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; v_mrr numeric; v_estimated integer; v_no_plan bigint;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(sum(v.monthly),0), count(*) FILTER (WHERE v.basis = 'estimate') INTO v_mrr, v_estimated
    FROM public.subscribers s
    CROSS JOIN LATERAL public._subscriber_monthly_value(s.subscription_status, s.subscribed, s.stripe_price_id, s.plan_key,
                                                        s.subscription_tier, s.billing_interval) v;
  SELECT count(*) INTO v_no_plan FROM public.profiles p
   WHERE NOT EXISTS (SELECT 1 FROM public.subscribers s WHERE s.user_id = p.id AND public._access_entitled(s.subscription_status, s.subscribed));
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'new_users_prev_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days'),
    'active_users', (SELECT count(*) FROM public.profiles WHERE COALESCE(is_active, true)),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE is_active = false),
    'total_companies', (SELECT count(*) FROM public.organizations),
    'active_companies', (SELECT count(*) FROM public.organizations WHERE COALESCE(is_active,true) AND COALESCE(status,'active') NOT IN ('suspended','cancelled')),
    'trial_companies', (SELECT count(*) FROM public.organizations o JOIN public.profiles p ON p.id = o.created_by
                         WHERE COALESCE(p.is_trial_active,false) AND COALESCE(o.status,'active') NOT IN ('suspended','cancelled')),
    'suspended_companies', (SELECT count(*) FROM public.organizations WHERE status = 'suspended' OR is_active = false),
    'cancelled_companies', (SELECT count(*) FROM public.organizations WHERE status = 'cancelled'),
    'new_companies_30d', (SELECT count(*) FROM public.organizations WHERE created_at > now() - interval '30 days'),
    'total_subscribers', (SELECT count(*) FROM public.subscribers),
    'active_subscriptions', (SELECT count(*) FROM public.subscribers s WHERE public._access_entitled(s.subscription_status, s.subscribed)),
    'trials', (SELECT count(*) FROM public.profiles p WHERE (SELECT a.state FROM public._access_state_for(p.id) a) = 'trial'),
    'no_plan_users', v_no_plan,
    'free_users', v_no_plan,  -- old name, same number: kept only so the screen published before Phase 22 keeps working
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'mrr_estimated', v_estimated,
    'total_revenue', (SELECT COALESCE(sum(amount),0)/100.0 FROM public.payments WHERE status IN ('paid','succeeded','complete','completed')),
    'revenue_30d', (SELECT COALESCE(sum(amount),0)/100.0 FROM public.payments WHERE status IN ('paid','succeeded','complete','completed') AND created_at > now() - interval '30 days'),
    'revenue_prev_30d', (SELECT COALESCE(sum(amount),0)/100.0 FROM public.payments WHERE status IN ('paid','succeeded','complete','completed') AND created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days'),
    'ai_requests', (SELECT count(*) FROM public.ai_conversations),
    'ai_requests_30d', (SELECT count(*) FROM public.ai_conversations WHERE created_at > now() - interval '30 days'),
    'total_projects', (SELECT count(*) FROM public.projects WHERE deleted_at IS NULL),
    'active_projects', (SELECT count(*) FROM public.projects WHERE deleted_at IS NULL AND archived_at IS NULL AND COALESCE(status,'active') <> 'completed'),
    'documents', (SELECT count(*) FROM public.documents),
    'documents_30d', (SELECT count(*) FROM public.documents WHERE created_at > now() - interval '30 days'),
    'storage_bytes', (SELECT COALESCE(sum(file_size),0) FROM public.documents),
    'support_open', (SELECT count(*) FROM public.feedback_requests WHERE COALESCE(status,'open') NOT IN ('resolved','closed')),
    'support_total', (SELECT count(*) FROM public.feedback_requests),
    'social_posts', (SELECT count(*) FROM public.social_posts),
    'social_posts_7d', (SELECT count(*) FROM public.social_posts WHERE created_at > now() - interval '7 days'),
    'forum_posts', (SELECT count(*) FROM public.forum_posts)
  ) INTO result;
  RETURN result;
END; $$;

-- Same callers as before: signed-in users may call; the bodies refuse anyone who isn't a super admin.
REVOKE ALL ON FUNCTION public.admin_list_subscriptions(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(text,text,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(text,text,integer,integer), public.admin_list_users(text,text,integer,integer,text),
  public.admin_overview_stats() TO authenticated, service_role;

COMMIT;
