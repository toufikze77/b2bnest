
-- 1. Super admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;

-- 2. Admin audit log (append-only for admins)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON public.admin_audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "super admins read audit" ON public.admin_audit_logs;
CREATE POLICY "super admins read audit" ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admins append audit" ON public.admin_audit_logs;
CREATE POLICY "super admins append audit" ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND admin_id = auth.uid());

-- 3. Platform plans
CREATE TABLE IF NOT EXISTS public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL DEFAULT 0,
  annual_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_credit_limit integer NOT NULL DEFAULT 0,
  storage_limit_mb integer NOT NULL DEFAULT 0,
  member_limit integer NOT NULL DEFAULT 0,
  project_limit integer NOT NULL DEFAULT 0,
  document_limit integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plans TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can view active plans" ON public.platform_plans;
CREATE POLICY "anyone can view active plans" ON public.platform_plans FOR SELECT
  USING (is_active = true OR public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admins manage plans insert" ON public.platform_plans;
CREATE POLICY "super admins manage plans insert" ON public.platform_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admins manage plans update" ON public.platform_plans;
CREATE POLICY "super admins manage plans update" ON public.platform_plans FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Platform tools registry
CREATE TABLE IF NOT EXISTS public.platform_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_tools TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_tools TO authenticated;
GRANT ALL ON public.platform_tools TO service_role;
ALTER TABLE public.platform_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can view tools" ON public.platform_tools;
CREATE POLICY "anyone can view tools" ON public.platform_tools FOR SELECT USING (true);
DROP POLICY IF EXISTS "super admins insert tools" ON public.platform_tools;
CREATE POLICY "super admins insert tools" ON public.platform_tools FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admins update tools" ON public.platform_tools;
CREATE POLICY "super admins update tools" ON public.platform_tools FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. Platform settings (non-sensitive config)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read settings" ON public.platform_settings;
CREATE POLICY "anyone can read settings" ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "super admins insert settings" ON public.platform_settings;
CREATE POLICY "super admins insert settings" ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "super admins update settings" ON public.platform_settings;
CREATE POLICY "super admins update settings" ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.platform_settings(key, value) VALUES
  ('platform', '{"name":"B2BNest","status":"operational","maintenance_mode":false,"registration_open":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_tools(key, name, category) VALUES
  ('web_development','Professional Web Development Services','services'),
  ('hr_management','HR Management System','operations'),
  ('marketing_campaigns','Marketing Campaign Manager','marketing'),
  ('support_portal','Customer Support Portal','support'),
  ('event_management','Event Management Platform','operations'),
  ('financial_dashboard','Financial Dashboard','finance'),
  ('inventory_control','Inventory Control System','operations'),
  ('workflow_automation','Workflow Automation Suite','automation'),
  ('resource_planning','Resource Planning Dashboard','operations'),
  ('merchant_integration','Merchant Integration Service','integrations'),
  ('seo_analytics','SEO & Analytics Optimization Service','marketing'),
  ('ai_tools','AI-powered business tools','ai'),
  ('templates','Business templates and documents','documents'),
  ('crm','CRM','sales'),
  ('lead_generation','Lead Generation & Prospecting','sales'),
  ('rota','Employee Rota & Scheduling','operations'),
  ('project_management','Project Management','operations')
ON CONFLICT (key) DO NOTHING;

-- 6. Audit logging helper
CREATE OR REPLACE FUNCTION public.admin_log_action(_action text, _target_type text DEFAULT NULL, _target_id text DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb, _status text DEFAULT 'success')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.admin_audit_logs(admin_id, admin_email, action, target_type, target_id, details, status)
  VALUES (auth.uid(), (SELECT email FROM public.profiles WHERE id = auth.uid()), _action, _target_type, _target_id, COALESCE(_details,'{}'::jsonb), COALESCE(_status,'success'))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_log_action(text,text,text,jsonb,text) FROM anon;

-- 7. Overview stats
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'new_users_prev_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days'),
    'active_users', (SELECT count(*) FROM public.profiles WHERE COALESCE(is_active, true)),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE is_active = false),
    'total_companies', (SELECT count(*) FROM public.organizations),
    'active_companies', (SELECT count(*) FROM public.organizations WHERE COALESCE(is_active,true)),
    'total_subscribers', (SELECT count(*) FROM public.subscribers),
    'active_subscriptions', (SELECT count(*) FROM public.subscribers WHERE subscribed = true),
    'trials', (SELECT count(*) FROM public.profiles WHERE is_trial_active = true),
    'free_users', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.subscribers s WHERE s.user_id = p.id AND s.subscribed = true)),
    'mrr', (SELECT COALESCE(sum(pl.monthly_price),0) FROM public.subscribers s LEFT JOIN public.platform_plans pl ON lower(pl.key) = lower(COALESCE(s.subscription_tier,'')) WHERE s.subscribed = true),
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
REVOKE EXECUTE ON FUNCTION public.admin_overview_stats() FROM anon;

-- 8. Users list
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT p.id, p.email, COALESCE(p.display_name, p.full_name) AS name, p.company, p.created_at,
           COALESCE(p.is_active, true) AS is_active, p.is_trial_active, p.trial_ends_at,
           (SELECT s.subscription_tier FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS plan,
           (SELECT s.subscribed FROM public.subscribers s WHERE s.user_id = p.id ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS subscribed,
           (SELECT count(*) FROM public.projects pr WHERE pr.user_id = p.id AND pr.deleted_at IS NULL) AS projects,
           (SELECT count(*) FROM public.documents d WHERE d.user_id = p.id) AS documents,
           (SELECT count(*) FROM public.ai_conversations ac WHERE ac.user_id = p.id) AS ai_usage,
           (SELECT r.role::text FROM public.user_roles r WHERE r.user_id = p.id ORDER BY r.created_at LIMIT 1) AS role
    FROM public.profiles p
    WHERE (_search IS NULL OR _search = '' OR p.email ILIKE '%'||_search||'%' OR COALESCE(p.display_name,p.full_name,'') ILIKE '%'||_search||'%' OR COALESCE(p.company,'') ILIKE '%'||_search||'%')
  ), filtered AS (
    SELECT * FROM base WHERE _status IS NULL OR _status = 'all'
      OR (_status = 'active' AND is_active)
      OR (_status = 'suspended' AND NOT is_active)
      OR (_status = 'paid' AND subscribed)
      OR (_status = 'free' AND COALESCE(subscribed,false) = false)
      OR (_status = 'trial' AND is_trial_active)
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text,text,integer,integer) FROM anon;

-- 9. Companies list
CREATE OR REPLACE FUNCTION public.admin_list_companies(_search text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT o.id, o.name, o.subscription_tier AS plan, COALESCE(o.is_active,true) AS is_active, o.created_at,
      (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = o.created_by) AS owner,
      (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = o.id) AS members,
      (SELECT count(*) FROM public.projects p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) AS projects,
      (SELECT max(p.updated_at) FROM public.projects p WHERE p.organization_id = o.id) AS last_activity
    FROM public.organizations o
    WHERE (_search IS NULL OR _search = '' OR o.name ILIKE '%'||_search||'%')
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM base)
  INTO rows, total
  FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_companies(text,integer,integer) FROM anon;

-- 10. Subscriptions list
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(_status text DEFAULT NULL, _search text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_subscriptions(text,text,integer,integer) FROM anon;

-- 11. Projects list
CREATE OR REPLACE FUNCTION public.admin_list_projects(_search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT p.id, p.name, p.status, p.progress, p.deadline, p.created_at, p.updated_at, p.archived_at,
      (SELECT o.name FROM public.organizations o WHERE o.id = p.organization_id) AS company,
      (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = p.user_id) AS owner,
      (SELECT count(*) FROM public.todos t WHERE t.project_id = p.id) AS tasks
    FROM public.projects p
    WHERE p.deleted_at IS NULL
      AND (_search IS NULL OR _search='' OR p.name ILIKE '%'||_search||'%')
      AND (_status IS NULL OR _status='all' OR COALESCE(p.status,'active') = _status)
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM base)
  INTO rows, total
  FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_projects(text,text,integer,integer) FROM anon;

-- 12. Documents summary (metadata only)
CREATE OR REPLACE FUNCTION public.admin_documents_summary(_limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb; total integer; cats jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb) INTO rows FROM (
    SELECT d.id, d.title, d.category, d.file_size, d.created_at,
      (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = d.user_id) AS owner
    FROM public.documents d ORDER BY d.created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  SELECT count(*) INTO total FROM public.documents;
  SELECT COALESCE(jsonb_agg(c),'[]'::jsonb) INTO cats FROM (
    SELECT COALESCE(category,'uncategorised') AS category, count(*) AS count FROM public.documents GROUP BY 1 ORDER BY 2 DESC LIMIT 10) c;
  RETURN jsonb_build_object('rows', rows, 'total', total, 'categories', cats,
    'this_month', (SELECT count(*) FROM public.documents WHERE created_at > date_trunc('month', now())),
    'storage_bytes', (SELECT COALESCE(sum(file_size),0) FROM public.documents));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_documents_summary(integer,integer) FROM anon;

-- 13. AI stats
CREATE OR REPLACE FUNCTION public.admin_ai_stats(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public.ai_conversations),
    'today', (SELECT count(*) FROM public.ai_conversations WHERE created_at > date_trunc('day', now())),
    'this_month', (SELECT count(*) FROM public.ai_conversations WHERE created_at > date_trunc('month', now())),
    'credits_used', (SELECT COALESCE(sum(GREATEST(ai_credits_limit - ai_credits_remaining,0)),0) FROM public.subscribers),
    'by_feature', (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (
        SELECT COALESCE(conversation_type,'other') AS feature, count(*) AS count
        FROM public.ai_conversations GROUP BY 1 ORDER BY 2 DESC) x),
    'by_user', (SELECT COALESCE(jsonb_agg(y),'[]'::jsonb) FROM (
        SELECT (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = ac.user_id) AS user_name,
               count(*) AS count
        FROM public.ai_conversations ac GROUP BY ac.user_id ORDER BY 2 DESC LIMIT 10) y),
    'series', (SELECT COALESCE(jsonb_agg(z ORDER BY z.day),'[]'::jsonb) FROM (
        SELECT to_char(d.day,'YYYY-MM-DD') AS day,
          (SELECT count(*) FROM public.ai_conversations ac WHERE ac.created_at::date = d.day) AS count
        FROM generate_series((now() - (GREATEST(_days,1) || ' days')::interval)::date, now()::date, interval '1 day') AS d(day)) z)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_ai_stats(integer) FROM anon;

-- 14. Analytics series
CREATE OR REPLACE FUNCTION public.admin_analytics_series(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(z ORDER BY z.day),'[]'::jsonb) FROM (
    SELECT to_char(d.day,'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM public.profiles p WHERE p.created_at::date = d.day) AS users,
      (SELECT count(*) FROM public.projects pr WHERE pr.created_at::date = d.day) AS projects,
      (SELECT count(*) FROM public.documents dc WHERE dc.created_at::date = d.day) AS documents,
      (SELECT count(*) FROM public.ai_conversations ac WHERE ac.created_at::date = d.day) AS ai,
      (SELECT count(*) FROM public.social_posts sp WHERE sp.created_at::date = d.day) AS social,
      (SELECT COALESCE(sum(pay.amount),0)/100.0 FROM public.payments pay WHERE pay.created_at::date = d.day AND pay.status IN ('paid','succeeded','complete','completed')) AS revenue
    FROM generate_series((now() - (GREATEST(_days,1) || ' days')::interval)::date, now()::date, interval '1 day') AS d(day)) z);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_series(integer) FROM anon;

-- 15. Social stats and moderation
CREATE OR REPLACE FUNCTION public.admin_social_stats(_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'total_posts', (SELECT count(*) FROM public.social_posts),
    'posts_today', (SELECT count(*) FROM public.social_posts WHERE created_at > date_trunc('day', now())),
    'posts_week', (SELECT count(*) FROM public.social_posts WHERE created_at > now() - interval '7 days'),
    'comments', (SELECT count(*) FROM public.post_comments),
    'likes', (SELECT count(*) FROM public.post_likes),
    'forum_posts', (SELECT count(*) FROM public.forum_posts),
    'active_authors', (SELECT count(DISTINCT user_id) FROM public.social_posts WHERE created_at > now() - interval '30 days'),
    'top_authors', (SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) FROM (
      SELECT (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = sp.user_id) AS author, count(*) AS posts
      FROM public.social_posts sp GROUP BY sp.user_id ORDER BY 2 DESC LIMIT 10) x),
    'recent_posts', (SELECT COALESCE(jsonb_agg(y ORDER BY y.created_at DESC),'[]'::jsonb) FROM (
      SELECT sp.id, left(sp.content, 240) AS content, sp.like_count, sp.comment_count, sp.is_public, sp.created_at,
        (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = sp.user_id) AS author
      FROM public.social_posts sp ORDER BY sp.created_at DESC LIMIT GREATEST(_limit,1)) y)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_social_stats(integer) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_moderate_post(_post_id uuid, _hide boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.social_posts SET is_public = NOT _hide, updated_at = now() WHERE id = _post_id;
  PERFORM public.admin_log_action(CASE WHEN _hide THEN 'social.post_hidden' ELSE 'social.post_restored' END, 'social_post', _post_id::text, '{}'::jsonb, 'success');
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_post(uuid, boolean) FROM anon;

-- 16. Support tickets
CREATE OR REPLACE FUNCTION public.admin_support_overview(_status text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT f.id, f.title, f.type, f.category, f.priority, f.status, f.created_at, f.updated_at, f.admin_response,
      (SELECT COALESCE(pr.display_name, pr.full_name, pr.email) FROM public.profiles pr WHERE pr.id = f.user_id) AS requester
    FROM public.feedback_requests f
    WHERE _status IS NULL OR _status='all' OR COALESCE(f.status,'open') = _status
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM base)
  INTO rows, total
  FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total,
    'open', (SELECT count(*) FROM public.feedback_requests WHERE COALESCE(status,'open')='open'),
    'pending', (SELECT count(*) FROM public.feedback_requests WHERE status='pending'),
    'resolved', (SELECT count(*) FROM public.feedback_requests WHERE status IN ('resolved','closed')),
    'urgent', (SELECT count(*) FROM public.feedback_requests WHERE priority IN ('urgent','high')));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_support_overview(text,integer,integer) FROM anon;

-- 17. Tool usage
CREATE OR REPLACE FUNCTION public.admin_tools_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(x ORDER BY x.name),'[]'::jsonb) FROM (
    SELECT t.id, t.key, t.name, t.category, t.is_active,
      CASE t.key
        WHEN 'crm' THEN (SELECT count(*) FROM public.crm_contacts)
        WHEN 'project_management' THEN (SELECT count(*) FROM public.projects WHERE deleted_at IS NULL)
        WHEN 'ai_tools' THEN (SELECT count(*) FROM public.ai_conversations)
        WHEN 'templates' THEN (SELECT count(*) FROM public.documents)
        WHEN 'rota' THEN (SELECT count(*) FROM public.rota_shifts)
        WHEN 'financial_dashboard' THEN (SELECT count(*) FROM public.invoices)
        WHEN 'workflow_automation' THEN (SELECT count(*) FROM public.ai_workflows)
        ELSE 0 END AS usage,
      CASE t.key
        WHEN 'crm' THEN (SELECT count(DISTINCT user_id) FROM public.crm_contacts)
        WHEN 'project_management' THEN (SELECT count(DISTINCT user_id) FROM public.projects)
        WHEN 'ai_tools' THEN (SELECT count(DISTINCT user_id) FROM public.ai_conversations)
        WHEN 'templates' THEN (SELECT count(DISTINCT user_id) FROM public.documents)
        WHEN 'financial_dashboard' THEN (SELECT count(DISTINCT user_id) FROM public.invoices)
        WHEN 'workflow_automation' THEN (SELECT count(DISTINCT user_id) FROM public.ai_workflows)
        ELSE 0 END AS users
    FROM public.platform_tools t) x);
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_tools_overview() FROM anon;

-- 18. User admin actions
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own status'; END IF;
  UPDATE public.profiles SET is_active = _active, updated_at = now() WHERE id = _user_id;
  PERFORM public.admin_log_action(CASE WHEN _active THEN 'user.reactivated' ELSE 'user.suspended' END, 'user', _user_id::text, '{}'::jsonb, 'success');
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, boolean) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role) ON CONFLICT DO NOTHING;
  PERFORM public.admin_log_action('user.role_changed', 'user', _user_id::text, jsonb_build_object('role', _role::text), 'success');
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role) FROM anon;

-- 19. System health (no secrets)
CREATE OR REPLACE FUNCTION public.admin_system_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'database', 'healthy',
    'auth_users', (SELECT count(*) FROM public.profiles),
    'payments_configured', (SELECT count(*) > 0 FROM public.payments),
    'ai_configured', (SELECT count(*) > 0 FROM public.ai_conversations),
    'integrations_connected', (SELECT count(*) FROM public.user_integrations WHERE is_connected = true),
    'storage_bytes', (SELECT COALESCE(sum(file_size),0) FROM public.documents),
    'recent_admin_errors', (SELECT count(*) FROM public.admin_audit_logs WHERE status <> 'success' AND created_at > now() - interval '7 days'),
    'checked_at', to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_system_health() FROM anon;
