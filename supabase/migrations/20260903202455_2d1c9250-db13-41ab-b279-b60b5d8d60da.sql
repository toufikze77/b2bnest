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
        SELECT COALESCE(pa.title, pa.activity_type) AS action, pa.created_at, pa.user_id, p.name AS project_name
        FROM public.project_activities pa
        JOIN public.projects p ON p.id = pa.project_id
        WHERE p.organization_id = _org_id ORDER BY pa.created_at DESC LIMIT 20) a),
    'security', (SELECT COALESCE(jsonb_agg(s ORDER BY s.created_at DESC),'[]'::jsonb) FROM (
        SELECT sa.action AS event_type, sa.created_at, sa.user_id
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