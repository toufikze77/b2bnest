-- =====================================================================================================================
-- HMRC P7b: customer data export, account and company closure, retention purge, old table clean-up.
-- PREPARED, NOT APPLIED. ORDER (docs/hmrc-p7b/README.md): 1 the owner reviews this; 2 it is applied after approval;
-- 3 the owner deploys data-export, account-delete and company-close; 4 the front end is published.
--
-- Owner decisions this follows (not reopened here):
--   * The duty to keep VAT records for 6 years is the customer's: they export first, then delete. Deletion is never
--     refused "because the law says so".
--   * B2BNEST keeps its own minimal HMRC trail (hmrc_vat_submissions, hmrc_audit_log) for 6 years. Both stay immutable;
--     the ONLY new ways to change them are the two narrow, gated paths below (purge after 6 years; "Deleted user" name).
--
-- What it does (one transaction; any check failing changes nothing):
--   1. Refuses unless production is exactly as read on 9 Nov 2026 (147 tables, the functions it relies on, the
--      immutability triggers, the empty legacy table).
--   2. DROPS public.hmrc_integrations: 0 rows, no foreign key into it, no view or function uses it, no code reads it
--      (src and supabase/functions searched). Plain-text token columns. docs/hmrc-p7b/rollback.sql recreates it empty.
--   3. public.organizations.closed_at (new, nullable). A closed company keeps a shell row named "Closed company":
--      no members, no business rows, no HMRC connection, no new submissions; hidden from every signed-in person
--      (restrictive policy); its row can't change again and can only be deleted by the purge.
--   4. public._data_rights_gate: a private table (no grants to anyone) holding "this transaction may do X". Only the
--      SECURITY DEFINER functions below write to it, and they remove their row before returning. The two immutability
--      guards and the organizations guard consult it with public._data_rights_gate_is_open(kind), which is true only
--      inside the same transaction that opened it. A direct DELETE or UPDATE by anyone (service_role included) finds no
--      row for its own transaction and is refused exactly as before.
--   5. public._hmrc_vat_submission_guard and public._hmrc_audit_append_only: the production bodies, plus ONE extra
--      opening each: DELETE when the 'hmrc_purge' gate is open; for submissions also the single UPDATE that replaces
--      submitted_by_name with 'Deleted user' and changes nothing else, when the 'anonymise' gate is open. TRUNCATE and
--      every other change stay refused for everyone.
--   6. public.data_rights_requests: one row per export, account deletion or company closure (who, which company, what,
--      result code, when). Read by the person themselves; written only by the Edge Functions (service role).
--   7. Functions, all SECURITY DEFINER, SET search_path = '', EXECUTE for service_role only:
--        data_rights_take_slot(user, company, kind, limit)   rate limit (per person and kind, per hour) + the request row
--        data_rights_finish(request, status, reason)         started -> done | refused | failed, once
--        data_rights_company_role(company, user)             owner | admin | member | not_member | closed
--        data_rights_delete_account(user, request, check)    refusals, then the deletion (see below)
--        data_rights_close_company(company, user, request, check)
--        hmrc_purge_expired_audit(dry_run DEFAULT true)      counts only unless dry_run = false; not scheduled
--      The Edge Functions check the session (JWT), two-step sign-in (aal2 when enrolled), a fresh password or
--      authenticator code, the typed confirmation, demo accounts and the rate limit BEFORE calling these; the functions
--      repeat the demo, membership and refusal checks themselves (they are the last line).
--
-- Account deletion (data_rights_delete_account): refused when the person is the last active owner of a company that has
-- other active members, pays for a company that stays open (organization_billing), or has an active Stripe
-- subscription not set to cancel. Otherwise, in one transaction: companies where they are the only member and an owner
-- are closed (as above); in companies that stay, the records they created there (invoices, expenses, bills, projects,
-- todos, teams, HMRC settings and logs) move to another active owner, admin or member, so the company
-- keeps its books (time entries are not moved: they record who did the work); tasks assigned to them are unassigned;
-- every other row of theirs is deleted; references that must stay (organizations.created_by, invited_by,
-- created_by in rota and teams, organization_billing.set_by, payment_audit_logs) are set to NULL; their name on HMRC
-- submissions becomes "Deleted user" (the opaque id stays: see the README, UK GDPR Article 17(3)(b), adviser to confirm);
-- AI credit, top-up and payment records keep the row without the person (their foreign keys already SET NULL); finally
-- auth.users is deleted. hmrc_audit_log and data_rights_requests keep the opaque id only.
--
-- Production facts this was written against (read-only, 9 Nov 2026, HMRC P0-P6 applied): 147 tables in public
-- (md5 of the sorted names 8d3fe32d0d61218e3b079b9953c4c090); md5(prosrc) _hmrc_audit_append_only
-- 8f283e3f58f0d54343cff1e44a86a49e, _hmrc_vat_submission_guard 9f0f119b78a033245b1ef8875e4a31d4, demo_readonly_guard
-- 087b5fe2695b95b8ba2ba6eb195ba995, mfa_ok 20516f2ec203220b3ac08d1230c7c306, ai_credit_ledger_append_only
-- a54399ea2a9c9459257cfd3cacd02480; hmrc_integrations has 0 rows and nothing depends on it. Anything else: refused.
-- Rollback: docs/hmrc-p7b/rollback.sql. Tests: docs/hmrc-p7b/run-test.sh (disposable local Postgres).
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.data_rights_requests') IS NOT NULL OR to_regclass('public._data_rights_gate') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.organizations'::regclass AND attname = 'closed_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'HMRC P7b already exists (applied twice?)';
  END IF;
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p')) <> 147
     OR (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
        IS DISTINCT FROM '8d3fe32d0d61218e3b079b9953c4c090' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 9 Nov 2026';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public._hmrc_audit_append_only()', '8f283e3f58f0d54343cff1e44a86a49e'),
      ('public._hmrc_vat_submission_guard()', '9f0f119b78a033245b1ef8875e4a31d4'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'),
      ('public.ai_credit_ledger_append_only()', 'a54399ea2a9c9459257cfd3cacd02480')) v(fn, h) LOOP
    IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = to_regprocedure(r.fn)) IS DISTINCT FROM r.h THEN
      RAISE EXCEPTION '% differs from production (or is missing: apply HMRC P0-P6 first)', r.fn;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid = 'public._hmrc_vat_submission_guard()'::regprocedure
        AND tgrelid = 'public.hmrc_vat_submissions'::regclass) <> 2
     OR (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid = 'public._hmrc_audit_append_only()'::regprocedure
        AND tgrelid = 'public.hmrc_audit_log'::regclass) <> 3 THEN
    RAISE EXCEPTION 'the HMRC immutability triggers differ from production';
  END IF;
  -- The legacy table: empty, nothing points at it, nothing reads it.
  IF (SELECT count(*) FROM public.hmrc_integrations) <> 0 THEN RAISE EXCEPTION 'hmrc_integrations is not empty: not dropped'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = 'public.hmrc_integrations'::regclass) THEN
    RAISE EXCEPTION 'a foreign key points at hmrc_integrations';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_rewrite rw ON rw.oid = d.objid WHERE d.refobjid = 'public.hmrc_integrations'::regclass
               AND rw.ev_class <> 'public.hmrc_integrations'::regclass) THEN
    RAISE EXCEPTION 'a view uses hmrc_integrations';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE prosrc ILIKE '%hmrc_integrations%') THEN
    RAISE EXCEPTION 'a function mentions hmrc_integrations';
  END IF;
END $$;

-- 1. The legacy table with plain-text token columns (empty; recreated empty by rollback.sql).
DROP TABLE public.hmrc_integrations;

-- 2. Closed companies.
ALTER TABLE public.organizations ADD COLUMN closed_at timestamptz;
COMMENT ON COLUMN public.organizations.closed_at IS
  'HMRC P7b: set once by data_rights_close_company. A closed company is an empty shell named "Closed company", hidden and unusable, kept until hmrc_purge_expired_audit removes it.';

-- 3. The gate: "this transaction may do <kind>". No grants: only the definer functions below write to it.
CREATE TABLE public._data_rights_gate (
  txid bigint NOT NULL,
  kind text NOT NULL CONSTRAINT drg_kind CHECK (kind IN ('hmrc_purge', 'anonymise', 'company_close')),
  PRIMARY KEY (txid, kind)
);
COMMENT ON TABLE public._data_rights_gate IS 'HMRC P7b: transaction-scoped permission for the purge, the "Deleted user" name and company closure. Written only by SECURITY DEFINER functions, which remove their row before returning. Never granted to anyone.';
ALTER TABLE public._data_rights_gate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._data_rights_gate FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public._data_rights_gate FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();

CREATE FUNCTION public._data_rights_gate_is_open(p_kind text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public._data_rights_gate g WHERE g.txid = txid_current() AND g.kind = p_kind);
$function$;
-- Called from triggers that run as whoever made the change, so everyone may ask; it says yes only inside the
-- transaction of a definer function that opened the gate.
REVOKE ALL ON FUNCTION public._data_rights_gate_is_open(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._data_rights_gate_is_open(text) TO PUBLIC;

CREATE FUNCTION public._data_rights_gate_set(p_kind text, p_open boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_open THEN
    INSERT INTO public._data_rights_gate (txid, kind) VALUES (txid_current(), p_kind) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public._data_rights_gate WHERE txid = txid_current() AND kind = p_kind;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._data_rights_gate_set(text, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- 4. The immutability guards: production bodies plus one gated opening each.
CREATE OR REPLACE FUNCTION public._hmrc_vat_submission_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- HMRC P7b: the only two exceptions, each needing a gate opened by a reviewed definer function in this transaction.
  IF TG_OP = 'DELETE' AND public._data_rights_gate_is_open('hmrc_purge') THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.submitted_by_name = 'Deleted user' AND OLD.submitted_by_name IS DISTINCT FROM 'Deleted user'
     AND (to_jsonb(NEW) - 'submitted_by_name') = (to_jsonb(OLD) - 'submitted_by_name') AND public._data_rights_gate_is_open('anonymise') THEN
    RETURN NEW;
  END IF;
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: VAT submissions are kept forever' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'submitting' OR NEW.completed_at IS NOT NULL OR NEW.processing_date IS NOT NULL OR NEW.form_bundle_number IS NOT NULL
       OR NEW.charge_ref_number IS NOT NULL OR NEW.payment_indicator IS NOT NULL OR NEW.http_status IS NOT NULL OR NEW.error_code IS NOT NULL OR NEW.error_message IS NOT NULL THEN
      RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: a submission starts as submitting, with no result' USING ERRCODE = '42501';
    END IF;
    NEW.submitted_at := now();
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.environment IS DISTINCT FROM OLD.environment
     OR NEW.period_key IS DISTINCT FROM OLD.period_key OR NEW.period_start IS DISTINCT FROM OLD.period_start OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.figures IS DISTINCT FROM OLD.figures OR NEW.figures_hash IS DISTINCT FROM OLD.figures_hash OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.submitted_by_name IS DISTINCT FROM OLD.submitted_by_name
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR NEW.vrn_last3 IS DISTINCT FROM OLD.vrn_last3 OR NEW.test_scenario IS DISTINCT FROM OLD.test_scenario THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: what was sent can never change' USING ERRCODE = '42501';
  END IF;
  IF NOT ((OLD.status = 'submitting' AND NEW.status IN ('accepted', 'rejected', 'unknown'))
          OR (OLD.status = 'unknown' AND NEW.status IN ('accepted', 'rejected'))) THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: % can''t become %', OLD.status, NEW.status USING ERRCODE = '42501';
  END IF;
  IF (OLD.processing_date IS NOT NULL AND NEW.processing_date IS DISTINCT FROM OLD.processing_date)
     OR (OLD.payment_indicator IS NOT NULL AND NEW.payment_indicator IS DISTINCT FROM OLD.payment_indicator)
     OR (OLD.form_bundle_number IS NOT NULL AND NEW.form_bundle_number IS DISTINCT FROM OLD.form_bundle_number)
     OR (OLD.charge_ref_number IS NOT NULL AND NEW.charge_ref_number IS DISTINCT FROM OLD.charge_ref_number)
     OR (OLD.http_status IS NOT NULL AND NEW.http_status IS DISTINCT FROM OLD.http_status)
     OR (OLD.error_code IS NOT NULL AND OLD.status <> 'unknown' AND NEW.error_code IS DISTINCT FROM OLD.error_code) THEN
    RAISE EXCEPTION 'HMRC_VAT_SUBMISSION_IMMUTABLE: a result already recorded can''t change' USING ERRCODE = '42501';
  END IF;
  NEW.completed_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._hmrc_audit_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  -- HMRC P7b: rows older than 6 years may be deleted by hmrc_purge_expired_audit only (gate opened in its transaction).
  IF TG_OP = 'DELETE' AND public._data_rights_gate_is_open('hmrc_purge') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'HMRC_AUDIT_APPEND_ONLY' USING ERRCODE = '42501', HINT = 'The HMRC audit log can only be added to.';
END;
$function$;

-- 5. Closed companies can't be used again.
CREATE FUNCTION public._data_rights_org_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.closed_at IS NOT NULL AND NOT public._data_rights_gate_is_open('hmrc_purge') THEN
      RAISE EXCEPTION 'COMPANY_CLOSED: a closed company is removed only by the retention purge' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.closed_at IS NOT NULL THEN
    -- Only change allowed: forgetting who created it, when that person deletes their account.
    IF NEW.created_by IS NULL AND OLD.created_by IS NOT NULL AND (to_jsonb(NEW) - 'created_by') = (to_jsonb(OLD) - 'created_by')
       AND public._data_rights_gate_is_open('anonymise') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'COMPANY_CLOSED: this company is closed' USING ERRCODE = '42501';
  END IF;
  IF NEW.closed_at IS NOT NULL AND NOT public._data_rights_gate_is_open('company_close') THEN
    RAISE EXCEPTION 'COMPANY_CLOSED: a company is closed only through data_rights_close_company' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._data_rights_org_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER data_rights_org_guard BEFORE UPDATE OR DELETE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public._data_rights_org_guard();

-- No new member, invitation, HMRC connection, HMRC sign-in or submission for a closed company. TG_ARGV[0]: the column.
CREATE FUNCTION public._data_rights_closed_company_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_org uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
BEGIN
  IF v_org IS NOT NULL AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_org AND o.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'COMPANY_CLOSED: this company is closed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._data_rights_closed_company_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.organization_invitations FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.hmrc_connections FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('company_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.hmrc_oauth_states FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('company_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT ON public.hmrc_vat_submissions FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');

-- Hidden from every signed-in person (restrictive: it narrows the existing policies, never widens them).
CREATE POLICY data_rights_hide_closed ON public.organizations AS RESTRICTIVE FOR SELECT TO authenticated USING (closed_at IS NULL);

-- 6. The record of every request (export, deletion, closure). No foreign keys on purpose: it outlives the person.
CREATE TABLE public.data_rights_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  kind text NOT NULL CONSTRAINT drr_kind CHECK (kind IN ('export_account', 'export_company', 'account_delete', 'company_close')),
  status text NOT NULL DEFAULT 'started' CONSTRAINT drr_status CHECK (status IN ('started', 'done', 'refused', 'failed')),
  reason text CONSTRAINT drr_reason CHECK (reason IS NULL OR reason ~ '^[a-z0-9_]{1,60}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT drr_company CHECK ((kind IN ('export_company', 'company_close')) = (organization_id IS NOT NULL))
);
COMMENT ON TABLE public.data_rights_requests IS 'HMRC P7b: one row per data export, account deletion or company closure (codes only). Opaque ids, no foreign keys: kept after the account is deleted as the record that the request was handled.';
CREATE INDEX data_rights_requests_user ON public.data_rights_requests (user_id, kind, created_at DESC);
ALTER TABLE public.data_rights_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.data_rights_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.data_rights_requests TO authenticated;
GRANT SELECT ON public.data_rights_requests TO service_role;
CREATE POLICY "People can read their own data requests" ON public.data_rights_requests FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY require_aal2_if_enrolled ON public.data_rights_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.data_rights_requests FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();

-- 7. Functions (service role only).
CREATE FUNCTION public.data_rights_take_slot(p_user uuid, p_company uuid, p_kind text, p_limit integer DEFAULT 3)
 RETURNS TABLE(result text, request_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF p_user IS NULL OR p_kind IS NULL OR p_kind NOT IN ('export_account', 'export_company', 'account_delete', 'company_close')
     OR ((p_kind IN ('export_company', 'company_close')) <> (p_company IS NOT NULL)) THEN
    RETURN QUERY SELECT 'bad_request'::text, NULL::uuid; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = p_user) THEN
    RETURN QUERY SELECT 'demo'::text, NULL::uuid; RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('data_rights:' || p_user::text || ':' || p_kind, 0));
  IF (SELECT count(*) FROM public.data_rights_requests r WHERE r.user_id = p_user AND r.kind = p_kind AND r.created_at > now() - interval '1 hour')
     >= least(greatest(COALESCE(p_limit, 3), 1), 10) THEN
    RETURN QUERY SELECT 'limit'::text, NULL::uuid; RETURN;
  END IF;
  INSERT INTO public.data_rights_requests (user_id, organization_id, kind) VALUES (p_user, p_company, p_kind) RETURNING id INTO v_id;
  RETURN QUERY SELECT 'ok'::text, v_id;
END;
$function$;

CREATE FUNCTION public.data_rights_finish(p_request uuid, p_status text, p_reason text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_status NOT IN ('done', 'refused', 'failed') THEN RETURN false; END IF;
  UPDATE public.data_rights_requests SET status = p_status, reason = left(nullif(p_reason, ''), 60), finished_at = now()
   WHERE id = p_request AND status = 'started';
  RETURN FOUND;
END;
$function$;

CREATE FUNCTION public.data_rights_company_role(p_company uuid, p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_company) THEN 'not_member'
    WHEN EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_company AND o.closed_at IS NOT NULL) THEN 'closed'
    ELSE COALESCE((SELECT CASE WHEN m.role IN ('owner', 'admin') THEN m.role ELSE 'member' END FROM public.organization_members m
                    WHERE m.organization_id = p_company AND m.user_id = p_user AND m.is_active ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1),
                  'not_member')
  END;
$function$;

-- The company tables: every public table with organization_id, or a company_id that references organizations.
-- The HMRC trail, the request log, the gate and organizations itself are never touched here.
CREATE FUNCTION public._data_rights_company_tables()
 RETURNS TABLE(tbl regclass, col text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT c.oid::regclass, a.attname::text
    FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
     AND c.relname NOT IN ('organizations', 'hmrc_vat_submissions', 'hmrc_audit_log', 'data_rights_requests', '_data_rights_gate')
     AND (a.attname = 'organization_id'
          OR (a.attname = 'company_id' AND NOT EXISTS (SELECT 1 FROM pg_attribute a2 WHERE a2.attrelid = c.oid AND a2.attname = 'organization_id' AND NOT a2.attisdropped)
              AND EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f' AND k.confrelid = 'public.organizations'::regclass
                            AND k.conkey = ARRAY[a.attnum])))
   ORDER BY c.relname;
$function$;
REVOKE ALL ON FUNCTION public._data_rights_company_tables() FROM PUBLIC, anon, authenticated, service_role;

-- Empties a company and leaves the closed shell. Internal: called only by the two functions below (gate already open).
CREATE FUNCTION public._data_rights_close_org(p_company uuid, p_actor uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r record; v_rows integer := 0; v_n integer;
BEGIN
  -- HMRC: tokens go with the connection row (as disconnect does), and the trail records it.
  INSERT INTO public.hmrc_audit_log (company_id, user_id, environment, event, reason)
    SELECT h.company_id, p_actor, h.environment, 'disconnected', 'company_closed' FROM public.hmrc_connections h WHERE h.company_id = p_company;
  FOR r IN SELECT * FROM public._data_rights_company_tables() LOOP
    EXECUTE format('DELETE FROM %s WHERE %I = $1', r.tbl, r.col) USING p_company;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_rows := v_rows + v_n;
  END LOOP;
  UPDATE public.organizations
     SET closed_at = now(), name = 'Closed company', slug = 'closed-' || id::text, description = NULL, logo_url = NULL,
         settings = '{}'::jsonb, created_by = NULL, is_active = false, updated_at = now()
   WHERE id = p_company;
  RETURN v_rows;
END;
$function$;
REVOKE ALL ON FUNCTION public._data_rights_close_org(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.data_rights_close_company(p_company uuid, p_user uuid, p_request uuid DEFAULT NULL, p_check_only boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_role text; v_rows integer;
BEGIN
  IF p_company IS NULL OR p_user IS NULL THEN RETURN jsonb_build_object('result', 'bad_request'); END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = p_user) THEN RETURN jsonb_build_object('result', 'demo'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('data_rights_company:' || p_company::text, 0));
  v_role := public.data_rights_company_role(p_company, p_user);
  IF v_role = 'closed' THEN RETURN jsonb_build_object('result', 'already_closed'); END IF;
  IF v_role IS DISTINCT FROM 'owner' THEN RETURN jsonb_build_object('result', 'not_owner'); END IF;
  IF p_check_only THEN
    RETURN jsonb_build_object('result', 'ok',
      'name', (SELECT o.name FROM public.organizations o WHERE o.id = p_company),
      'members', (SELECT count(*) FROM public.organization_members m WHERE m.organization_id = p_company AND m.is_active),
      'hmrc_connected', EXISTS (SELECT 1 FROM public.hmrc_connections h WHERE h.company_id = p_company AND h.status <> 'disconnected'),
      'hmrc_submissions', (SELECT count(*) FROM public.hmrc_vat_submissions s WHERE s.organization_id = p_company));
  END IF;
  PERFORM public._data_rights_gate_set('company_close', true);
  v_rows := public._data_rights_close_org(p_company, p_user);
  PERFORM public._data_rights_gate_set('company_close', false);
  IF p_request IS NOT NULL THEN PERFORM public.data_rights_finish(p_request, 'done', 'company_closed'); END IF;
  RETURN jsonb_build_object('result', 'closed', 'rows', v_rows);
END;
$function$;

CREATE FUNCTION public.data_rights_delete_account(p_user uuid, p_request uuid DEFAULT NULL, p_check_only boolean DEFAULT true)
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

-- Retention purge: NOT scheduled. Dry run by default (counts only).
CREATE FUNCTION public.hmrc_purge_expired_audit(p_dry_run boolean DEFAULT true)
 RETURNS TABLE(item text, rows bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_subs bigint; v_audit bigint; v_orgs bigint;
BEGIN
  SELECT count(*) INTO v_subs FROM public.hmrc_vat_submissions s
   WHERE (s.environment = 'sandbox' AND s.period_end < current_date - interval '12 months')
      OR (s.environment <> 'sandbox' AND s.period_end < current_date - interval '6 years');
  SELECT count(*) INTO v_audit FROM public.hmrc_audit_log a WHERE a.created_at < now() - interval '6 years';
  SELECT count(*) INTO v_orgs FROM public.organizations o WHERE o.closed_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.hmrc_vat_submissions s WHERE s.organization_id = o.id
                       AND NOT ((s.environment = 'sandbox' AND s.period_end < current_date - interval '12 months')
                             OR (s.environment <> 'sandbox' AND s.period_end < current_date - interval '6 years')));
  IF COALESCE(p_dry_run, true) THEN
    RETURN QUERY VALUES ('vat_submissions'::text, v_subs), ('audit_log'::text, v_audit), ('closed_companies'::text, v_orgs), ('dry_run'::text, 1::bigint);
    RETURN;
  END IF;
  PERFORM public._data_rights_gate_set('hmrc_purge', true);
  DELETE FROM public.hmrc_vat_submissions s
   WHERE (s.environment = 'sandbox' AND s.period_end < current_date - interval '12 months')
      OR (s.environment <> 'sandbox' AND s.period_end < current_date - interval '6 years');
  GET DIAGNOSTICS v_subs = ROW_COUNT;
  DELETE FROM public.hmrc_audit_log a WHERE a.created_at < now() - interval '6 years';
  GET DIAGNOSTICS v_audit = ROW_COUNT;
  DELETE FROM public.organizations o WHERE o.closed_at IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.hmrc_vat_submissions s WHERE s.organization_id = o.id);
  GET DIAGNOSTICS v_orgs = ROW_COUNT;
  PERFORM public._data_rights_gate_set('hmrc_purge', false);
  RETURN QUERY VALUES ('vat_submissions'::text, v_subs), ('audit_log'::text, v_audit), ('closed_companies'::text, v_orgs), ('dry_run'::text, 0::bigint);
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.data_rights_take_slot(uuid,uuid,text,integer)', 'public.data_rights_finish(uuid,text,text)',
      'public.data_rights_company_role(uuid,uuid)', 'public.data_rights_close_company(uuid,uuid,uuid,boolean)',
      'public.data_rights_delete_account(uuid,uuid,boolean)', 'public.hmrc_purge_expired_audit(boolean)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.hmrc_purge_expired_audit(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.hmrc_purge_expired_audit(boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.data_rights_delete_account(uuid,uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.data_rights_close_company(uuid,uuid,uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._data_rights_gate_set(text,boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public._data_rights_close_org(uuid,uuid)', 'EXECUTE')
     OR has_table_privilege('service_role', 'public._data_rights_gate', 'INSERT') OR has_table_privilege('authenticated', 'public._data_rights_gate', 'SELECT')
     OR has_table_privilege('authenticated', 'public.data_rights_requests', 'INSERT') OR has_table_privilege('service_role', 'public.data_rights_requests', 'DELETE')
     OR has_table_privilege('service_role', 'public.hmrc_vat_submissions', 'DELETE')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.data_rights_requests'::regclass)
     OR to_regclass('public.hmrc_integrations') IS NOT NULL THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
