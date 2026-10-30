-- Phase 22 test fixture: the tables the three Admin functions read (only the columns they use), and the three
-- functions copied VERBATIM from production (pg_get_functiondef, read 30 Oct 2026), so proposal.sql's body-hash guards
-- are tested against the real definitions. _access_entitled is verbatim too. _access_state_for is a STUB that reads a
-- fixture table (the real one is Phase 12/12b/12c and is not changed here; its live md5 is 04e43521f4bda5d55de1bc1f1d0ee481).
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, last_sign_in_at timestamptz);
CREATE TABLE public.user_roles (user_id uuid, role text, created_at timestamptz DEFAULT now());
CREATE FUNCTION public.is_super_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = 'super_admin') $$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, email text, display_name text, full_name text, company text, created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true, is_trial_active boolean DEFAULT false, trial_ends_at timestamptz);
CREATE TABLE public.organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, created_by uuid, created_at timestamptz DEFAULT now(), is_active boolean DEFAULT true, status text);
CREATE TABLE public.organization_members (organization_id uuid, user_id uuid, role text, joined_at timestamptz, is_active boolean DEFAULT true);
CREATE TABLE public.subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid, email text, stripe_customer_id text, subscribed boolean DEFAULT false NOT NULL,
  subscription_tier text, subscription_end timestamptz, updated_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(),
  ai_credits_remaining integer DEFAULT 10, ai_credits_limit integer DEFAULT 10, ai_credits_reset_date timestamptz,
  stripe_subscription_id text, stripe_price_id text, plan_key text, billing_interval text, subscription_status text,
  current_period_start timestamptz, current_period_end timestamptz, cancel_at_period_end boolean, canceled_at timestamptz, payment_status text, stripe_state_at bigint);
CREATE TABLE public.platform_plans (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, key text, name text, monthly_price numeric NOT NULL DEFAULT 0, annual_price numeric, is_active boolean DEFAULT true);
INSERT INTO public.platform_plans (key, name, monthly_price, annual_price) VALUES
  ('starter','Solo',19,190), ('professional_legacy','Business (earlier price)',35,350), ('professional','Business',59,590),
  ('enterprise_legacy','Scale (earlier price)',85,850), ('enterprise','Scale',89,890);
CREATE TABLE public.payments (amount integer, status text, created_at timestamptz DEFAULT now());
CREATE TABLE public.ai_conversations (user_id uuid, conversation_type text, created_at timestamptz DEFAULT now());
CREATE TABLE public.projects (id uuid DEFAULT gen_random_uuid(), user_id uuid, status text, deleted_at timestamptz, archived_at timestamptz);
CREATE TABLE public.documents (id uuid DEFAULT gen_random_uuid(), user_id uuid, file_size bigint, created_at timestamptz DEFAULT now());
CREATE TABLE public.feedback_requests (status text);
CREATE TABLE public.social_posts (created_at timestamptz DEFAULT now());
CREATE TABLE public.forum_posts (id int);

CREATE OR REPLACE FUNCTION public._access_entitled(_status text, _subscribed boolean)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN _status IS NULL THEN coalesce(_subscribed, false)
              ELSE _status IN ('active','trialing','past_due','unpaid') END $function$;

-- STUB of the Phase 12 access function: reads the state from a fixture table.
CREATE TABLE public.fixture_access (user_id uuid PRIMARY KEY, state text, plan_key text, via text DEFAULT 'self');
CREATE FUNCTION public._access_state_for(_uid uuid)
RETURNS TABLE(state text, trial_ends_at timestamptz, days_left integer, plan_key text, subscription_status text, via text, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS
  $$ SELECT f.state, NULL::timestamptz, 0, f.plan_key, NULL::text, f.via, NULL::text FROM public.fixture_access f WHERE f.user_id = _uid $$;
REVOKE ALL ON FUNCTION public._access_state_for(uuid) FROM PUBLIC, anon, authenticated;

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
