-- Phase 22 rollback: puts the three Admin functions back exactly as they were live on 30 Oct 2026 (bodies copied from
-- pg_get_functiondef), then removes the helper and the price table. One transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(_status text DEFAULT NULL::text, _search text DEFAULT NULL::text, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT s.id, s.email, s.subscription_tier AS plan, s.subscribed, s.subscription_end, s.created_at, s.updated_at,
      s.ai_credits_remaining, s.ai_credits_limit,
      p.company, COALESCE(p.is_trial_active,false) AS is_trial_active,
      COALESCE((SELECT pl.monthly_price FROM public.platform_plans pl WHERE lower(pl.key) = lower(COALESCE(s.subscription_tier,''))),0) AS value,
      CASE WHEN s.subscribed THEN 'active'
           WHEN COALESCE(p.is_trial_active,false) THEN 'trial'
           WHEN s.subscription_end IS NOT NULL AND s.subscription_end < now() THEN 'cancelled'
           ELSE 'free' END AS status
    FROM public.subscribers s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    WHERE (_search IS NULL OR _search = '' OR s.email ILIKE '%'||_search||'%')
  ), filtered AS (SELECT * FROM base WHERE _status IS NULL OR _status='all' OR status = _status)
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $function$;
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _limit integer DEFAULT 25, _offset integer DEFAULT 0, _plan text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE rows jsonb; total integer;
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
           (SELECT s.subscribed FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS subscribed,
           (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id AND pr.deleted_at IS NULL) AS projects,
           (SELECT count(*) FROM public.documents d WHERE d.user_id = p.id) AS documents,
           (SELECT count(*) FROM public.ai_conversations ac WHERE ac.user_id = p.id) AS ai_usage,
           (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id ORDER BY r.created_at LIMIT 1) AS role
    FROM public.profiles p
    WHERE (_search IS NULL OR _search = '' OR p.email ILIKE '%'||_search||'%' OR COALESCE(p.display_name,p.full_name,'') ILIKE '%'||_search||'%' OR COALESCE(p.company,'') ILIKE '%'||_search||'%')
  ), filtered AS (
    SELECT * FROM base WHERE (_status IS NULL OR _status = 'all'
      OR (_status = 'active' AND is_active)
      OR (_status = 'suspended' AND NOT is_active)
      OR (_status = 'paid' AND subscribed)
      OR (_status = 'free' AND COALESCE(subscribed,false) = false)
      OR (_status = 'trial' AND is_trial_active))
    AND (_plan IS NULL OR _plan = 'all' OR lower(COALESCE(plan,'free')) = lower(_plan))
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $function$;
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb; v_mrr numeric;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(sum(pl.monthly_price),0) INTO v_mrr
    FROM public.subscribers s LEFT JOIN public.platform_plans pl ON lower(pl.key) = lower(COALESCE(s.subscription_tier,''))
   WHERE s.subscribed = true;
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
    'active_subscriptions', (SELECT count(*) FROM public.subscribers WHERE subscribed = true),
    'trials', (SELECT count(*) FROM public.profiles WHERE is_trial_active = true),
    'free_users', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.subscribers s WHERE s.user_id = p.id AND s.subscribed = true)),
    'mrr', v_mrr,
    'arr', v_mrr * 12,
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
END; $function$;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions(text,text,integer,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(text,text,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(text,text,integer,integer), public.admin_list_users(text,text,integer,integer,text),
  public.admin_overview_stats() TO authenticated, service_role;
DROP FUNCTION IF EXISTS public._subscriber_monthly_value(text, boolean, text, text, text, text);
DROP TABLE IF EXISTS public.plan_prices;
COMMIT;
