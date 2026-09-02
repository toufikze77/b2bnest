-- 1. Company status (additive)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

UPDATE public.organizations SET status = CASE WHEN COALESCE(is_active,true) THEN 'active' ELSE 'suspended' END
WHERE status IS NULL OR status = 'active';

-- 2. Companies list with filters
CREATE OR REPLACE FUNCTION public.admin_list_companies(
  _search text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0,
  _status text DEFAULT NULL, _plan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE rows jsonb; total integer;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  WITH base AS (
    SELECT o.id, o.name,
      COALESCE(NULLIF(o.subscription_tier,''),'free') AS plan,
      COALESCE(o.is_active,true) AS is_active,
      o.created_at, o.suspended_at, o.suspension_reason,
      owner.id AS owner_id,
      COALESCE(owner.display_name, owner.full_name, owner.email) AS owner,
      owner.email AS owner_email,
      (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = o.id) AS members,
      (SELECT count(*) FROM public.projects p WHERE p.organization_id = o.id AND p.deleted_at IS NULL) AS projects,
      (SELECT max(p.updated_at) FROM public.projects p WHERE p.organization_id = o.id) AS last_activity,
      CASE
        WHEN o.status IN ('suspended','cancelled') THEN o.status
        WHEN COALESCE(o.is_active,true) = false THEN 'suspended'
        WHEN EXISTS (SELECT 1 FROM public.subscribers s WHERE s.user_id = o.created_by AND s.subscribed = true) THEN 'active'
        WHEN COALESCE(owner.is_trial_active,false) THEN 'trial'
        ELSE COALESCE(NULLIF(o.status,''),'active')
      END AS status,
      (SELECT s.subscribed FROM public.subscribers s WHERE s.user_id = o.created_by ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS subscribed,
      (SELECT s.subscription_tier FROM public.subscribers s WHERE s.user_id = o.created_by ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS subscription_plan,
      (SELECT s.subscription_end FROM public.subscribers s WHERE s.user_id = o.created_by ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) AS renewal_date
    FROM public.organizations o
    LEFT JOIN public.profiles owner ON owner.id = o.created_by
    WHERE (_search IS NULL OR _search = ''
       OR o.name ILIKE '%'||_search||'%'
       OR COALESCE(owner.email,'') ILIKE '%'||_search||'%'
       OR COALESCE(owner.display_name, owner.full_name,'') ILIKE '%'||_search||'%'
       OR o.id::text = _search)
  ), filtered AS (
    SELECT * FROM base
    WHERE (_status IS NULL OR _status = 'all' OR status = _status)
      AND (_plan IS NULL OR _plan = 'all' OR lower(COALESCE(subscription_plan, plan)) = lower(_plan))
  )
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC),'[]'::jsonb), (SELECT count(*) FROM filtered)
  INTO rows, total
  FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT GREATEST(_limit,1) OFFSET GREATEST(_offset,0)) t;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END; $function$;

-- 3. Suspend / reactivate a company
CREATE OR REPLACE FUNCTION public.admin_set_company_status(_org_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _status NOT IN ('active','trial','suspended','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.organizations
  SET status = _status,
      is_active = (_status <> 'suspended'),
      suspended_at = CASE WHEN _status = 'suspended' THEN now() ELSE NULL END,
      suspension_reason = CASE WHEN _status = 'suspended' THEN _reason ELSE NULL END,
      updated_at = now()
  WHERE id = _org_id;
  PERFORM public.admin_log_action('company.status_changed','organization',_org_id::text,
    jsonb_build_object('status',_status,'reason',_reason),'success');
  RETURN true;
END; $function$;

-- 4. Rename a company (edit)
CREATE OR REPLACE FUNCTION public.admin_update_company(_org_id uuid, _name text DEFAULT NULL, _plan text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.organizations
  SET name = COALESCE(NULLIF(_name,''), name),
      subscription_tier = COALESCE(NULLIF(_plan,''), subscription_tier),
      updated_at = now()
  WHERE id = _org_id;
  PERFORM public.admin_log_action('company.updated','organization',_org_id::text,
    jsonb_build_object('name',_name,'plan',_plan),'success');
  RETURN true;
END; $function$;

-- 5. Full company detail
CREATE OR REPLACE FUNCTION public.admin_company_detail(_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result jsonb; v_owner uuid; v_member_ids uuid[]; v_plan record;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT created_by INTO v_owner FROM public.organizations WHERE id = _org_id;
  SELECT COALESCE(array_agg(DISTINCT uid),'{}') INTO v_member_ids FROM (
    SELECT m.user_id AS uid FROM public.organization_members m WHERE m.organization_id = _org_id
    UNION SELECT v_owner WHERE v_owner IS NOT NULL
  ) x WHERE uid IS NOT NULL;

  SELECT pl.* INTO v_plan FROM public.platform_plans pl
   WHERE lower(pl.key) = lower(COALESCE(
     (SELECT s.subscription_tier FROM public.subscribers s WHERE s.user_id = v_owner ORDER BY s.updated_at DESC NULLS LAST LIMIT 1),
     (SELECT o.subscription_tier FROM public.organizations o WHERE o.id = _org_id), ''))
   LIMIT 1;

  SELECT jsonb_build_object(
    'company', (SELECT to_jsonb(c) FROM (
        SELECT o.id, o.name, o.slug, o.description, o.created_at, o.updated_at,
               COALESCE(o.is_active,true) AS is_active, o.status, o.suspended_at, o.suspension_reason,
               COALESCE(NULLIF(o.subscription_tier,''),'free') AS plan_key,
               COALESCE(p.display_name, p.full_name, p.email) AS owner_name, p.email AS owner_email, p.id AS owner_id
        FROM public.organizations o LEFT JOIN public.profiles p ON p.id = o.created_by WHERE o.id = _org_id) c),
    'users', (SELECT COALESCE(jsonb_agg(u ORDER BY u.joined_at NULLS LAST),'[]'::jsonb) FROM (
        SELECT pr.id, pr.email, COALESCE(pr.display_name, pr.full_name) AS name,
               CASE WHEN pr.id = v_owner THEN 'COMPANY_OWNER' ELSE upper(COALESCE(m.role,'member')) END AS company_role,
               COALESCE(pr.is_active,true) AS is_active, m.joined_at, pr.created_at,
               (SELECT au.last_sign_in_at FROM auth.users au WHERE au.id = pr.id) AS last_login
        FROM public.profiles pr
        LEFT JOIN public.organization_members m ON m.user_id = pr.id AND m.organization_id = _org_id
        WHERE pr.id = ANY(v_member_ids)) u),
    'subscription', (SELECT to_jsonb(s2) FROM (
        SELECT s.subscribed, s.subscription_tier, s.subscription_end AS renewal_date, s.updated_at,
               COALESCE(pr.is_trial_active,false) AS is_trial_active, pr.trial_ends_at,
               s.ai_credits_remaining, s.ai_credits_limit
        FROM public.profiles pr LEFT JOIN public.subscribers s ON s.user_id = pr.id
        WHERE pr.id = v_owner ORDER BY s.updated_at DESC NULLS LAST LIMIT 1) s2),
    'plan', CASE WHEN v_plan.id IS NULL THEN NULL ELSE jsonb_build_object(
        'key', v_plan.key, 'name', v_plan.name, 'monthly_price', v_plan.monthly_price,
        'annual_price', v_plan.annual_price, 'currency', v_plan.currency,
        'member_limit', v_plan.member_limit, 'project_limit', v_plan.project_limit,
        'ai_credit_limit', v_plan.ai_credit_limit, 'storage_limit_mb', v_plan.storage_limit_mb,
        'document_limit', v_plan.document_limit) END,
    'usage', jsonb_build_object(
        'users', cardinality(v_member_ids),
        'projects', (SELECT count(*) FROM public.projects p WHERE p.organization_id = _org_id AND p.deleted_at IS NULL),
        'tasks', (SELECT count(*) FROM public.todos t WHERE t.user_id = ANY(v_member_ids)),
        'crm_contacts', (SELECT count(*) FROM public.crm_contacts c WHERE c.user_id = ANY(v_member_ids)),
        'crm_deals', (SELECT count(*) FROM public.crm_deals d WHERE d.user_id = ANY(v_member_ids)),
        'invoices', (SELECT count(*) FROM public.invoices i WHERE i.user_id = ANY(v_member_ids)),
        'invoice_total', (SELECT COALESCE(sum(i.total_amount),0) FROM public.invoices i WHERE i.user_id = ANY(v_member_ids)),
        'quotes', (SELECT count(*) FROM public.quotes q WHERE q.user_id = ANY(v_member_ids)),
        'documents', (SELECT count(*) FROM public.documents d WHERE d.user_id = ANY(v_member_ids)),
        'storage_bytes', (SELECT COALESCE(sum(d.file_size),0) FROM public.documents d WHERE d.user_id = ANY(v_member_ids)),
        'ai_conversations', (SELECT count(*) FROM public.ai_conversations a WHERE a.user_id = ANY(v_member_ids)),
        'ai_workflows', (SELECT count(*) FROM public.ai_workflows w WHERE w.user_id = ANY(v_member_ids))),
    'activity', (SELECT COALESCE(jsonb_agg(a ORDER BY a.created_at DESC),'[]'::jsonb) FROM (
        SELECT pa.action, pa.created_at, pa.user_id, p.name AS project_name
        FROM public.project_activities pa
        JOIN public.projects p ON p.id = pa.project_id
        WHERE p.organization_id = _org_id ORDER BY pa.created_at DESC LIMIT 20) a),
    'security', (SELECT COALESCE(jsonb_agg(s ORDER BY s.created_at DESC),'[]'::jsonb) FROM (
        SELECT sa.event_type, sa.created_at, sa.user_id
        FROM public.security_audit_logs sa WHERE sa.user_id = ANY(v_member_ids)
        ORDER BY sa.created_at DESC LIMIT 20) s),
    'admin_actions', (SELECT COALESCE(jsonb_agg(al ORDER BY al.created_at DESC),'[]'::jsonb) FROM (
        SELECT l.action, l.admin_email, l.created_at, l.details
        FROM public.admin_audit_logs l
        WHERE l.target_id = _org_id::text OR l.target_id = ANY(SELECT unnest(v_member_ids)::text)
        ORDER BY l.created_at DESC LIMIT 20) al)
  ) INTO result;
  RETURN result;
END; $function$;

-- 6. Users list: add company + last login + plan filter
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 25, _offset integer DEFAULT 0,
  _plan text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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

-- 7. Overview stats: company statuses + ARR
CREATE OR REPLACE FUNCTION public.admin_overview_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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