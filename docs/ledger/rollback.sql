-- =====================================================================================================================
-- Finance phase 2 rollback (one transaction): removes the ledger tables and functions, and puts data_rights_delete_account
-- back to its HMRC P7b body. Unpublish the Ledger tab first.
--
-- !!! It REFUSES while any ledger row exists: journals are a company's books, and dropping them would lose them. There is
-- !!! no force switch. Export the companies' data first (Settings > Your data) if this is ever needed.
-- =====================================================================================================================
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.journal_entries') IS NULL THEN RAISE EXCEPTION 'Finance phase 2 ledger is not applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_settings) OR EXISTS (SELECT 1 FROM public.ledger_accounts) OR EXISTS (SELECT 1 FROM public.journal_entries) THEN
    RAISE EXCEPTION 'The ledger holds company records: rollback refused (they would be lost)';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.data_rights_delete_account(p_user uuid, p_request uuid DEFAULT NULL, p_check_only boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  m record; r record; v_others integer; v_successor uuid;
  v_close uuid[] := '{}'; v_leave uuid[] := '{}'; v_stay uuid[] := '{}';
  v_last_owner text[] := '{}'; v_billing text[] := '{}'; v_reasons text[] := '{}';
  v_has_org boolean; v_org_col text; v_n integer; v_rows integer := 0; v_claims text;
BEGIN
  IF p_user IS NULL THEN RETURN jsonb_build_object('result', 'bad_request'); END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user) THEN RETURN jsonb_build_object('result', 'not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = p_user) THEN RETURN jsonb_build_object('result', 'demo'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('data_rights_account:' || p_user::text, 0));

  -- A live, paid subscription: cancel it in the billing portal first (no Stripe call is made from here).
  IF EXISTS (SELECT 1 FROM public.subscribers s WHERE s.user_id = p_user AND s.stripe_subscription_id IS NOT NULL
               AND COALESCE(s.subscription_status, '') IN ('active', 'trialing', 'past_due', 'unpaid', 'incomplete')
               AND NOT COALESCE(s.cancel_at_period_end, false)) THEN
    v_reasons := v_reasons || 'paid_subscription'::text;
  END IF;

  FOR m IN SELECT om.organization_id, om.role, o.name FROM public.organization_members om JOIN public.organizations o ON o.id = om.organization_id
            WHERE om.user_id = p_user AND om.is_active AND o.closed_at IS NULL ORDER BY o.name LOOP
    SELECT count(*) INTO v_others FROM public.organization_members x WHERE x.organization_id = m.organization_id AND x.is_active AND x.user_id <> p_user;
    IF v_others = 0 THEN
      IF m.role = 'owner' THEN v_close := v_close || m.organization_id; ELSE v_leave := v_leave || m.organization_id; END IF;
    ELSIF m.role = 'owner' AND NOT EXISTS (SELECT 1 FROM public.organization_members x WHERE x.organization_id = m.organization_id
                                             AND x.is_active AND x.role = 'owner' AND x.user_id <> p_user) THEN
      v_last_owner := v_last_owner || m.name;
    ELSE
      v_stay := v_stay || m.organization_id;
    END IF;
  END LOOP;
  IF cardinality(v_last_owner) > 0 THEN v_reasons := v_reasons || 'last_owner'::text; END IF;
  SELECT COALESCE(array_agg(o.name ORDER BY o.name), '{}') INTO v_billing FROM public.organization_billing b JOIN public.organizations o ON o.id = b.organization_id
   WHERE b.billing_user_id = p_user AND b.organization_id <> ALL (v_close) AND o.closed_at IS NULL;
  IF cardinality(v_billing) > 0 THEN v_reasons := v_reasons || 'billing_user'::text; END IF;

  IF cardinality(v_reasons) > 0 THEN
    RETURN jsonb_build_object('result', 'refused', 'reasons', to_jsonb(v_reasons), 'last_owner_of', to_jsonb(v_last_owner), 'pays_for', to_jsonb(v_billing));
  END IF;
  IF p_check_only THEN
    RETURN jsonb_build_object('result', 'ok',
      'companies_closed', (SELECT COALESCE(jsonb_agg(o.name ORDER BY o.name), '[]'::jsonb) FROM public.organizations o WHERE o.id = ANY (v_close)),
      'companies_left', (SELECT COALESCE(jsonb_agg(o.name ORDER BY o.name), '[]'::jsonb) FROM public.organizations o WHERE o.id = ANY (v_stay || v_leave)));
  END IF;

  PERFORM public._data_rights_gate_set('anonymise', true);
  PERFORM public._data_rights_gate_set('company_close', true);
  -- 1. Companies where they are the only member and an owner: closed.
  FOREACH v_successor IN ARRAY v_close LOOP
    v_rows := v_rows + public._data_rights_close_org(v_successor, p_user);
  END LOOP;
  PERFORM public._data_rights_gate_set('company_close', false);
  -- 2. Companies that stay: the records they created there pass to another active owner, admin or member.
  --    (Time entries are not moved: they record who did the work, and production refuses an owner change on them.)
  FOR r IN SELECT s.org, (SELECT x.user_id FROM public.organization_members x WHERE x.organization_id = s.org AND x.is_active AND x.user_id <> p_user
                           ORDER BY CASE x.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, x.joined_at NULLS LAST, x.created_at LIMIT 1) AS heir
             FROM unnest(v_stay) AS s(org) LOOP
    -- One HMRC settings row per person and company: if the successor already has one, theirs stays and this one goes.
    DELETE FROM public.hmrc_settings h WHERE h.user_id = p_user AND h.organization_id = r.org
       AND EXISTS (SELECT 1 FROM public.hmrc_settings h2 WHERE h2.organization_id = r.org AND h2.user_id = r.heir);
    FOR v_org_col, v_has_org IN SELECT * FROM (VALUES ('invoices', true), ('expenses', true), ('bills', true), ('projects', true), ('todos', true),
                                                      ('hmrc_settings', true), ('hmrc_submission_logs', true)) t(n, o) LOOP
      IF to_regclass('public.' || v_org_col) IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET user_id = $1 WHERE %I = $2 AND user_id = $3', v_org_col, CASE WHEN v_has_org THEN 'organization_id' ELSE 'company_id' END)
          USING r.heir, r.org, p_user;
      END IF;
    END LOOP;
    UPDATE public.teams SET owner_id = r.heir WHERE organization_id = r.org AND owner_id = p_user;
  END LOOP;
  -- 3. References that stay with company records lose the person (their foreign keys would otherwise block or cascade).
  UPDATE public.organizations SET created_by = NULL WHERE created_by = p_user;
  UPDATE public.organization_members SET invited_by = NULL WHERE invited_by = p_user;
  UPDATE public.organization_invitations SET invited_by = NULL WHERE invited_by = p_user;
  UPDATE public.organization_billing SET set_by = NULL WHERE set_by = p_user;
  UPDATE public.companies SET created_by = NULL WHERE created_by = p_user;
  UPDATE public.teams SET created_by = NULL WHERE created_by = p_user;
  UPDATE public.rota_shifts SET created_by = NULL WHERE created_by = p_user;
  UPDATE public.rota_employees SET created_by = NULL WHERE created_by = p_user;
  UPDATE public.payment_audit_logs SET user_id = NULL WHERE user_id = p_user;
  -- 4. Their own rows: every table with user_id, except company records that stay (organization_id set) and the
  --    records that keep the row without the person (the HMRC trail, the request log, AI credits, top-ups, payments).
  FOR r IN SELECT c.oid::regclass AS tbl, c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id' AND NOT a.attisdropped
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND c.relname NOT IN ('hmrc_audit_log', 'data_rights_requests', 'ai_credit_ledger', 'ai_credit_lots', 'ai_topup_checkouts', 'payments', 'payment_audit_logs')
            ORDER BY c.relname LOOP
    v_has_org := EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = r.tbl AND a.attname = 'organization_id' AND NOT a.attisdropped);
    v_org_col := CASE WHEN v_has_org THEN 'organization_id'
                      WHEN EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = r.tbl AND a.attname = 'company_id' AND NOT a.attisdropped) THEN 'company_id' END;
    IF r.relname IN ('support_customers', 'support_agents', 'support_notification_prefs', 'hmrc_oauth_states', 'organization_members') OR v_org_col IS NULL THEN
      EXECUTE format('DELETE FROM %s WHERE user_id::text = $1', r.tbl) USING p_user::text;
    ELSE
      EXECUTE format('DELETE FROM %s WHERE user_id::text = $1 AND %I IS NULL', r.tbl, v_org_col) USING p_user::text;
    END IF;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_rows := v_rows + v_n;
  END LOOP;
  -- 5. Tasks still assigned to them are unassigned first. The task history needs a person for each change, and the
  --    foreign key's own SET NULL would run with no signed-in person, so each change is recorded under the task's owner.
  v_claims := current_setting('request.jwt.claims', true);
  FOR r IN SELECT t.id, t.user_id FROM public.todos t WHERE t.assigned_to = p_user AND t.user_id IS DISTINCT FROM p_user LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'service_role')::text, true);
    UPDATE public.todos SET assigned_to = NULL WHERE id = r.id;
  END LOOP;
  PERFORM set_config('request.jwt.claims', COALESCE(v_claims, ''), true);
  -- 6. The HMRC trail keeps the opaque id only; the name becomes "Deleted user" (the one gated change).
  UPDATE public.hmrc_vat_submissions SET submitted_by_name = 'Deleted user' WHERE submitted_by = p_user AND submitted_by_name IS DISTINCT FROM 'Deleted user';
  PERFORM public._data_rights_gate_set('anonymise', false);
  -- 7. The person.
  DELETE FROM public.profiles WHERE id = p_user;
  DELETE FROM auth.users WHERE id = p_user;
  IF p_request IS NOT NULL THEN PERFORM public.data_rights_finish(p_request, 'done', 'account_deleted'); END IF;
  RETURN jsonb_build_object('result', 'deleted', 'companies_closed', cardinality(v_close), 'closed_ids', to_jsonb(v_close), 'rows', v_rows);
END;
$function$;

DROP FUNCTION public.ledger_trial_balance(uuid, date);
DROP FUNCTION public.ledger_status(uuid);
DROP FUNCTION public.ledger_delete_account(uuid);
DROP FUNCTION public.ledger_update_account(uuid, text, text, boolean);
DROP FUNCTION public.ledger_add_account(uuid, text, text, text, uuid);
DROP FUNCTION public.ledger_setup(uuid, date, text, jsonb);
DROP FUNCTION public.ledger_seed_chart(uuid);
DROP FUNCTION public.ledger_reverse_journal(uuid, text, date);
DROP FUNCTION public.ledger_post_journal(uuid, date, text, text, jsonb, text, text);
DROP FUNCTION public._ledger_post(uuid, date, text, text, jsonb, text, text, uuid);
DROP TABLE public.journal_lines;
DROP TABLE public.journal_entries;
DROP TABLE public.ledger_accounts;
DROP TABLE public.ledger_settings;
DROP FUNCTION public._ledger_require_writer(uuid);
DROP FUNCTION public._ledger_rule(uuid, uuid);
DROP FUNCTION public._ledger_org_open(uuid);
DROP FUNCTION public._ledger_settings_guard();
DROP FUNCTION public._ledger_account_guard();
DROP FUNCTION public._ledger_balance_check();
DROP FUNCTION public._ledger_line_guard();
DROP FUNCTION public._ledger_entry_guard();
DROP FUNCTION public._ledger_append_only();
COMMIT;
