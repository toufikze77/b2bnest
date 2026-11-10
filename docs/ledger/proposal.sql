-- =====================================================================================================================
-- Finance phase 2: ledger foundation (chart of accounts, accounting start, balanced journals, opening balances).
-- PREPARED, NOT APPLIED. ORDER (docs/ledger/README.md): 1 the owner reviews this; 2 the owner's assistant applies it
-- after approval; 3 the owner redeploys data-export; 4 the front end is published.
--
-- What it adds (one transaction; any check failing changes nothing; nothing existing is altered except one line in
-- data_rights_delete_account, see 11):
--   1. ledger_settings   one row per company: start date, 'fresh' or 'import', GBP only, an optional lock date.
--   2. ledger_accounts   the chart of accounts; a standard UK small-company set is seeded at setup.
--   3. journal_entries + journal_lines   posted journals, append-only for everyone (service role included). A mistake is
--      corrected only by a reversing entry. The only ways round it are the P7b gate paths: company closure and account
--      deletion empty a closed company ('company_close'); account deletion sets posted_by_name to "Deleted user"
--      ('anonymise').
--   4. The balance rule in the database: a deferred constraint trigger fails the transaction unless every entry has at
--      least two lines and equal debits and credits. Each line has exactly one of debit or credit, never negative.
--   5. RLS: company members read their company's rows; nobody can insert, update or delete directly (writes only through
--      the functions below); restrictive aal2 (Phase 25) and closed-company policies; demo guard triggers; anon nothing.
--   6. Functions (SECURITY DEFINER, SET search_path = ''): ledger_setup, ledger_post_journal, ledger_reverse_journal,
--      ledger_add_account, ledger_update_account, ledger_delete_account, ledger_status, ledger_trial_balance; internal
--      ledger_seed_chart, _ledger_post, _ledger_rule, _ledger_require_writer, _ledger_org_open and the trigger guards.
--      Writers: owners and admins, with the plan rule of the existing helper hmrc_manage_allowed (Business, Scale and
--      the trial; Solo and an ended trial refused), aal2 when enrolled, demo accounts and closed companies refused.
--   7. Every posting writes one row in the person's own audit_logs.
--  11. data_rights_delete_account: the P7b body plus one statement (posted_by_name -> 'Deleted user', inside the
--      existing 'anonymise' gate). Company closure needs no change: it already empties every table with
--      organization_id, and the guards above let it through the 'company_close' gate.
--
-- Production facts this was written against: read from the repository (docs/*/proposal.sql as applied, and
-- src/integrations/supabase/types.ts, 10 Nov 2026): 148 tables in public (md5 of the sorted names
-- ca2f5c858ee858f9b3f7c14131e00b9f), and the md5(prosrc) of the helpers it depends on below. A body is also accepted
-- with its whole-line comments removed (production keeps some bodies that way). THE OWNER'S ASSISTANT RE-VERIFIES THESE
-- AGAINST PRODUCTION BEFORE APPLYING; anything else: refused.
-- Rollback: docs/ledger/rollback.sql (refuses while any ledger row exists). Tests: docs/ledger/run-test.sh.
-- =====================================================================================================================
BEGIN;

DO $$
DECLARE r record; v text;
BEGIN
  IF to_regclass('public.journal_entries') IS NOT NULL OR to_regclass('public.ledger_accounts') IS NOT NULL
     OR to_regclass('public.ledger_settings') IS NOT NULL OR to_regclass('public.journal_lines') IS NOT NULL THEN
    RAISE EXCEPTION 'Finance phase 2 ledger already exists (applied twice?)';
  END IF;
  IF (SELECT md5(string_agg(relname, ',' ORDER BY relname)) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p'))
     IS DISTINCT FROM 'ca2f5c858ee858f9b3f7c14131e00b9f' THEN
    RAISE EXCEPTION 'the tables in public differ from production as read on 10 Nov 2026';
  END IF;
  FOR r IN SELECT * FROM (VALUES
      ('public.hmrc_manage_allowed(uuid,uuid)', '9304f069f05402aab62d343b3626cd65'),
      ('public.user_is_organization_member(uuid,uuid)', '1fb55538d44b2451875f8baf1b6e4388'),
      ('public.require_aal2_if_enrolled()', '10b2ae7bd2f9a94ea20598f19b8aebf2'),
      ('public.mfa_ok()', '20516f2ec203220b3ac08d1230c7c306'),
      ('public.demo_readonly_guard()', '087b5fe2695b95b8ba2ba6eb195ba995'),
      ('public._data_rights_gate_is_open(text)', 'b22b22eda6bd86e8ff363a6a58bfe3a3'),
      ('public._data_rights_closed_company_guard()', '2ec2d8630e284aed65d010c61a442a53'),
      ('public._data_rights_company_tables()', 'c4497fd5fa0245618d1168f9c19bffe1'),
      ('public._data_rights_close_org(uuid,uuid)', '6c379a1d11b0e469c13ec57e4f054678'),
      ('public.data_rights_delete_account(uuid,uuid,boolean)', '6cb32ccf51387b535ab6aebf2e748417')) x(fn, h) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure(r.fn)
                    AND r.h IN (md5(prosrc), md5(regexp_replace(prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')))) THEN
      RAISE EXCEPTION '% differs from the body this was written against (or is missing)', r.fn;
    END IF;
  END LOOP;
  IF (SELECT md5(regexp_replace(prosrc, E'\\n[ \\t]*--[^\\n]*', '', 'g')) FROM pg_proc WHERE oid = 'public.data_rights_delete_account(uuid,uuid,boolean)'::regprocedure)
     IS DISTINCT FROM '6cb32ccf51387b535ab6aebf2e748417' THEN
    RAISE EXCEPTION 'data_rights_delete_account differs from HMRC P7b';
  END IF;
  SELECT string_agg(column_name, ',' ORDER BY column_name) INTO v FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name IN ('action', 'details', 'resource_id', 'resource_type', 'user_id');
  IF v IS DISTINCT FROM 'action,details,resource_id,resource_type,user_id' THEN RAISE EXCEPTION 'audit_logs columns differ (%)', v; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'closed_at') THEN
    RAISE EXCEPTION 'organizations.closed_at is missing: apply HMRC P7b first';
  END IF;
END $$;

-- 1. Settings: one row per company, created once by ledger_setup.
CREATE TABLE public.ledger_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
  start_date date NOT NULL CONSTRAINT ls_start_date CHECK (start_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
  opening_mode text NOT NULL CONSTRAINT ls_opening_mode CHECK (opening_mode IN ('fresh', 'import')),
  base_currency text NOT NULL DEFAULT 'GBP' CONSTRAINT ls_base_currency CHECK (base_currency = 'GBP'),
  locked_through date CONSTRAINT ls_locked_through CHECK (locked_through IS NULL OR locked_through >= start_date - 1),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ledger_settings IS 'Finance phase 2: the company ledger start date and opening mode. Written only by ledger_setup. created_by is an opaque id (no foreign key), kept after account deletion.';

-- 2. Chart of accounts.
CREATE TABLE public.ledger_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  code text NOT NULL CONSTRAINT la_code CHECK (code ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$'),
  name text NOT NULL CONSTRAINT la_name CHECK (length(btrim(name)) BETWEEN 1 AND 80 AND name = btrim(name)),
  type text NOT NULL CONSTRAINT la_type CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_side text NOT NULL CONSTRAINT la_normal_side CHECK (normal_side = CASE WHEN type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END),
  is_system boolean NOT NULL DEFAULT false,
  system_key text CONSTRAINT la_system_key CHECK ((system_key IS NOT NULL) = is_system AND (system_key IS NULL OR system_key ~ '^[a-z_]{2,40}$')),
  is_active boolean NOT NULL DEFAULT true,
  parent_id uuid REFERENCES public.ledger_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT la_code_unique UNIQUE (organization_id, code),
  CONSTRAINT la_not_own_parent CHECK (parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX ledger_accounts_system_key ON public.ledger_accounts (organization_id, system_key) WHERE system_key IS NOT NULL;
COMMENT ON TABLE public.ledger_accounts IS 'Finance phase 2: the chart of accounts. System accounts keep their code and type; an account used by a journal line can only be deactivated.';

-- 3. Journals (append-only).
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  entry_date date NOT NULL,
  memo text NOT NULL CONSTRAINT je_memo CHECK (length(btrim(memo)) BETWEEN 1 AND 200),
  reason text CONSTRAINT je_reason CHECK (reason IS NULL OR length(reason) <= 500),
  source_type text NOT NULL CONSTRAINT je_source_type CHECK (source_type IN ('manual', 'opening_balance', 'reversal')),
  source_id uuid,
  reverses_entry_id uuid UNIQUE REFERENCES public.journal_entries(id),
  idempotency_key text CONSTRAINT je_idempotency_key CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9_-]{8,80}$'),
  posted_by uuid NOT NULL,
  posted_by_name text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT je_reversal CHECK ((source_type = 'reversal') = (reverses_entry_id IS NOT NULL))
);
CREATE UNIQUE INDEX journal_entries_idempotency ON public.journal_entries (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX journal_entries_one_opening ON public.journal_entries (organization_id) WHERE source_type = 'opening_balance';
CREATE INDEX journal_entries_org_date ON public.journal_entries (organization_id, entry_date, posted_at);
COMMENT ON TABLE public.journal_entries IS 'Finance phase 2: posted journals. Append-only for everyone: a mistake is corrected by a reversing entry. posted_by is an opaque id (no foreign key); on account deletion posted_by_name becomes "Deleted user".';

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  account_id uuid NOT NULL REFERENCES public.ledger_accounts(id),
  line_no integer NOT NULL CONSTRAINT jl_line_no CHECK (line_no BETWEEN 1 AND 200),
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  description text CONSTRAINT jl_description CHECK (description IS NULL OR length(description) <= 200),
  CONSTRAINT jl_amounts CHECK (debit >= 0 AND credit >= 0 AND ((debit > 0) <> (credit > 0))),
  CONSTRAINT jl_line_unique UNIQUE (entry_id, line_no)
);
CREATE INDEX journal_lines_org_account ON public.journal_lines (organization_id, account_id);
COMMENT ON TABLE public.journal_lines IS 'Finance phase 2: journal lines, exactly one of debit or credit, never negative. Append-only, like journal_entries.';

-- 4. Guards. The P7b gate (_data_rights_gate_is_open) is the only way round them: 'company_close' (company closure and
--    account deletion empty a company) and 'anonymise' (posted_by_name -> 'Deleted user').
CREATE FUNCTION public._ledger_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posted journals are never removed' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posted journals are never deleted; post a reversing entry' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'journal_entries' THEN
    IF to_jsonb(NEW) ->> 'posted_by_name' = 'Deleted user' AND to_jsonb(OLD) ->> 'posted_by_name' IS DISTINCT FROM 'Deleted user'
       AND (to_jsonb(NEW) - 'posted_by_name') = (to_jsonb(OLD) - 'posted_by_name') AND public._data_rights_gate_is_open('anonymise') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'LEDGER_APPEND_ONLY: posted journals can''t be changed; post a reversing entry' USING ERRCODE = '42501';
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_append_only() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public._ledger_append_only();
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public._ledger_append_only();
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON public.journal_entries FOR EACH STATEMENT EXECUTE FUNCTION public._ledger_append_only();
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON public.journal_lines FOR EACH STATEMENT EXECUTE FUNCTION public._ledger_append_only();

-- A new entry: the company is set up, the date is open (on or after the start date, after the lock), an opening
-- balance is dated the start date, a reversal reverses an entry of the same company that is not itself a reversal.
CREATE FUNCTION public._ledger_entry_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s public.ledger_settings; v_rev public.journal_entries;
BEGIN
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF NEW.entry_date < s.start_date THEN RAISE EXCEPTION 'LEDGER_BEFORE_START' USING ERRCODE = '22023'; END IF;
  IF s.locked_through IS NOT NULL AND NEW.entry_date <= s.locked_through THEN RAISE EXCEPTION 'LEDGER_PERIOD_LOCKED' USING ERRCODE = '22023'; END IF;
  IF NEW.source_type = 'opening_balance' AND NEW.entry_date <> s.start_date THEN RAISE EXCEPTION 'LEDGER_OPENING_DATE' USING ERRCODE = '22023'; END IF;
  IF NEW.reverses_entry_id IS NOT NULL THEN
    SELECT * INTO v_rev FROM public.journal_entries WHERE id = NEW.reverses_entry_id;
    IF NOT FOUND OR v_rev.organization_id <> NEW.organization_id THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
    IF v_rev.source_type = 'reversal' THEN RAISE EXCEPTION 'LEDGER_REVERSAL_OF_REVERSAL' USING ERRCODE = '22023'; END IF;
  END IF;
  NEW.posted_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_entry_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_entry_guard BEFORE INSERT ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public._ledger_entry_guard();

-- A new line: same company as its entry and its account, the account active, and only while that entry is being
-- posted (the posting function names the entry for this transaction; nobody else can insert at all).
CREATE FUNCTION public._ledger_line_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_org uuid; a public.ledger_accounts;
BEGIN
  IF COALESCE(current_setting('ledger.posting_entry', true), '') IS DISTINCT FROM NEW.entry_id::text THEN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: lines are added only while their journal is posted' USING ERRCODE = '42501';
  END IF;
  SELECT e.organization_id INTO v_org FROM public.journal_entries e WHERE e.id = NEW.entry_id;
  SELECT * INTO a FROM public.ledger_accounts WHERE id = NEW.account_id;
  IF v_org IS DISTINCT FROM NEW.organization_id OR a.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'LEDGER_WRONG_COMPANY' USING ERRCODE = '42501';
  END IF;
  -- A reversal mirrors the original lines, so it may use an account deactivated since; new journals may not.
  IF NOT a.is_active AND NOT EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = NEW.entry_id AND e.source_type = 'reversal') THEN
    RAISE EXCEPTION 'LEDGER_ACCOUNT_INACTIVE' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_line_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_line_guard BEFORE INSERT ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public._ledger_line_guard();

-- The balance rule, checked when the transaction commits: every entry has at least two lines and its debits equal
-- its credits.
CREATE FUNCTION public._ledger_balance_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_entry uuid := (to_jsonb(NEW) ->> CASE WHEN TG_TABLE_NAME = 'journal_entries' THEN 'id' ELSE 'entry_id' END)::uuid; v_n integer; v_dr numeric; v_cr numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE id = v_entry) THEN RETURN NULL; END IF;
  SELECT count(*), COALESCE(sum(debit), 0), COALESCE(sum(credit), 0) INTO v_n, v_dr, v_cr FROM public.journal_lines WHERE entry_id = v_entry;
  IF v_n < 2 THEN RAISE EXCEPTION 'LEDGER_TOO_FEW_LINES: a journal needs at least two lines' USING ERRCODE = '23514'; END IF;
  IF v_dr <> v_cr THEN RAISE EXCEPTION 'LEDGER_UNBALANCED: debits % and credits % differ', v_dr, v_cr USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_balance_check() FROM PUBLIC, anon, authenticated, service_role;
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON public.journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._ledger_balance_check();
CREATE CONSTRAINT TRIGGER ledger_balanced AFTER INSERT ON public.journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public._ledger_balance_check();

-- Accounts: system accounts keep code, type and key; nothing moves between companies; an account is deleted only if
-- it isn't a system account and no line uses it (company closure through the gate excepted).
CREATE FUNCTION public._ledger_account_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    IF OLD.is_system THEN RAISE EXCEPTION 'LEDGER_SYSTEM_ACCOUNT: system accounts can''t be deleted' USING ERRCODE = '42501'; END IF;
    IF EXISTS (SELECT 1 FROM public.journal_lines l WHERE l.account_id = OLD.id) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_USED: an account used by a journal can only be deactivated' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.is_system IS DISTINCT FROM OLD.is_system OR NEW.system_key IS DISTINCT FROM OLD.system_key
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_FIXED' USING ERRCODE = '42501';
    END IF;
    IF OLD.is_system AND (NEW.type IS DISTINCT FROM OLD.type OR NEW.code IS DISTINCT FROM OLD.code OR NOT NEW.is_active) THEN
      RAISE EXCEPTION 'LEDGER_SYSTEM_ACCOUNT: a system account keeps its code and type and stays active' USING ERRCODE = '42501';
    END IF;
    IF NEW.type IS DISTINCT FROM OLD.type AND EXISTS (SELECT 1 FROM public.journal_lines l WHERE l.account_id = OLD.id) THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_USED: the type of a used account can''t change' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_accounts p WHERE p.id = NEW.parent_id AND p.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'LEDGER_WRONG_COMPANY' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_account_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_account_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_accounts FOR EACH ROW EXECUTE FUNCTION public._ledger_account_guard();

-- Settings: the start date can't change once a journal exists; the row goes only with the company.
CREATE FUNCTION public._ledger_settings_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public._data_rights_gate_is_open('company_close') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'LEDGER_SETTINGS_FIXED: ledger settings go only with the company' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.opening_mode IS DISTINCT FROM OLD.opening_mode
     OR NEW.base_currency IS DISTINCT FROM OLD.base_currency OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'LEDGER_SETTINGS_FIXED' USING ERRCODE = '42501';
  END IF;
  IF NEW.start_date IS DISTINCT FROM OLD.start_date AND EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.organization_id = OLD.organization_id) THEN
    RAISE EXCEPTION 'LEDGER_START_DATE_FIXED: the start date can''t change once a journal exists' USING ERRCODE = '42501';
  END IF;
  IF NEW.locked_through IS DISTINCT FROM OLD.locked_through AND OLD.locked_through IS NOT NULL
     AND (NEW.locked_through IS NULL OR NEW.locked_through < OLD.locked_through) THEN
    RAISE EXCEPTION 'LEDGER_LOCK_BACKWARDS: a locked period stays locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_settings_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ledger_settings_guard BEFORE UPDATE OR DELETE ON public.ledger_settings FOR EACH ROW EXECUTE FUNCTION public._ledger_settings_guard();

-- No new ledger rows for a closed company (the P7b guard), and demo accounts are read only (the demo guard).
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.ledger_settings FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT OR UPDATE ON public.ledger_accounts FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER data_rights_closed_company BEFORE INSERT ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public._data_rights_closed_company_guard('organization_id');
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_settings FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ledger_accounts FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();
CREATE TRIGGER a0_demo_readonly_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.demo_readonly_guard();

-- 5. Who may read and who may do what.
-- An open company (not closed). SECURITY DEFINER so it sees closed companies, which the P7b policy hides.
CREATE FUNCTION public._ledger_org_open(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org AND o.closed_at IS NULL);
$function$;
REVOKE ALL ON FUNCTION public._ledger_org_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._ledger_org_open(uuid) TO authenticated, service_role;

-- The access rule: the existing HMRC plan helper (Business, Scale and the trial; owner or admin). 'not_admin' means
-- the plan allows it and the person is a member: they may read, not post. Demo and closed companies first.
CREATE FUNCTION public._ledger_rule(p_org uuid, p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_user IS NULL THEN RETURN 'not_signed_in'; END IF;
  IF EXISTS (SELECT 1 FROM public.demo_readonly_users d WHERE d.user_id = p_user) THEN RETURN 'demo'; END IF;
  IF p_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p_org) THEN RETURN 'not_member'; END IF;
  IF NOT public._ledger_org_open(p_org) THEN RETURN 'closed'; END IF;
  RETURN public.hmrc_manage_allowed(p_org, p_user);
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_rule(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Raises the plain code for the browser unless the caller may write (owner or admin, plan included, not demo).
CREATE FUNCTION public._ledger_require_writer(p_org uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule <> 'ok' THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_require_writer(uuid) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.ledger_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ledger_settings, public.ledger_accounts, public.journal_entries, public.journal_lines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ledger_settings, public.ledger_accounts, public.journal_entries, public.journal_lines TO authenticated, service_role;
CREATE POLICY "Company members can read the ledger settings" ON public.ledger_settings FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())));
CREATE POLICY "Company members can read the chart of accounts" ON public.ledger_accounts FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())));
CREATE POLICY "Company members can read journals" ON public.journal_entries FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())));
CREATE POLICY "Company members can read journal lines" ON public.journal_lines FOR SELECT TO authenticated
  USING (public.user_is_organization_member(organization_id, (SELECT auth.uid())));
CREATE POLICY require_aal2_if_enrolled ON public.ledger_settings AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.ledger_accounts AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.journal_entries AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY require_aal2_if_enrolled ON public.journal_lines AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()));
CREATE POLICY ledger_hide_closed ON public.ledger_settings AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id));
CREATE POLICY ledger_hide_closed ON public.ledger_accounts AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id));
CREATE POLICY ledger_hide_closed ON public.journal_entries AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id));
CREATE POLICY ledger_hide_closed ON public.journal_lines AS RESTRICTIVE FOR SELECT TO authenticated USING (public._ledger_org_open(organization_id));

-- 6. Posting. Internal: validates and writes one journal; the callers below check who may do it.
CREATE FUNCTION public._ledger_post(p_org uuid, p_entry_date date, p_memo text, p_reason text, p_lines jsonb, p_source_type text,
                                    p_idempotency_key text, p_reverses uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_existing uuid; v_entry uuid; v_line jsonb; v_i integer := 0; v_dr numeric(14,2); v_cr numeric(14,2);
  v_sum_dr numeric := 0; v_sum_cr numeric := 0; v_account uuid; v_name text; v_raw_dr text; v_raw_cr text;
BEGIN
  IF p_entry_date IS NULL THEN RAISE EXCEPTION 'LEDGER_BAD_DATE' USING ERRCODE = '22023'; END IF;
  IF p_memo IS NULL OR length(btrim(p_memo)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'LEDGER_BAD_MEMO' USING ERRCODE = '22023'; END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN RAISE EXCEPTION 'LEDGER_BAD_REASON' USING ERRCODE = '22023'; END IF;
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key !~ '^[A-Za-z0-9_-]{8,80}$' THEN RAISE EXCEPTION 'LEDGER_BAD_KEY' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  IF p_idempotency_key IS NOT NULL THEN
    SELECT e.id INTO v_existing FROM public.journal_entries e WHERE e.organization_id = p_org AND e.idempotency_key = p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('result', 'existing', 'entry_id', v_existing); END IF;
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) < 2 THEN RAISE EXCEPTION 'LEDGER_TOO_FEW_LINES' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(p_lines) > 200 THEN RAISE EXCEPTION 'LEDGER_TOO_MANY_LINES' USING ERRCODE = '22023'; END IF;
  -- Check every line before writing anything.
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_raw_dr := COALESCE(v_line ->> 'debit', '0'); v_raw_cr := COALESCE(v_line ->> 'credit', '0');
    IF v_raw_dr !~ '^\d{1,12}(\.\d{1,2})?$' OR v_raw_cr !~ '^\d{1,12}(\.\d{1,2})?$' THEN RAISE EXCEPTION 'LEDGER_BAD_AMOUNT' USING ERRCODE = '22023'; END IF;
    v_dr := v_raw_dr::numeric; v_cr := v_raw_cr::numeric;
    IF (v_dr > 0) = (v_cr > 0) THEN RAISE EXCEPTION 'LEDGER_ONE_SIDE: each line has a debit or a credit, not both' USING ERRCODE = '22023'; END IF;
    IF v_line ? 'description' AND v_line ->> 'description' IS NOT NULL AND length(v_line ->> 'description') > 200 THEN RAISE EXCEPTION 'LEDGER_BAD_DESCRIPTION' USING ERRCODE = '22023'; END IF;
    v_sum_dr := v_sum_dr + v_dr; v_sum_cr := v_sum_cr + v_cr;
  END LOOP;
  IF v_sum_dr <> v_sum_cr THEN RAISE EXCEPTION 'LEDGER_UNBALANCED: debits % and credits % differ', v_sum_dr, v_sum_cr USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')) INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.journal_entries (organization_id, entry_date, memo, reason, source_type, reverses_entry_id, idempotency_key, posted_by, posted_by_name)
  VALUES (p_org, p_entry_date, btrim(p_memo), NULLIF(btrim(p_reason), ''), p_source_type, p_reverses, p_idempotency_key, auth.uid(), left(v_name, 120))
  RETURNING id INTO v_entry;
  PERFORM set_config('ledger.posting_entry', v_entry::text, true);
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    v_i := v_i + 1;
    v_account := NULL;
    IF v_line ? 'account_id' AND v_line ->> 'account_id' ~ '^[0-9a-fA-F-]{36}$' THEN
      SELECT a.id INTO v_account FROM public.ledger_accounts a WHERE a.id = (v_line ->> 'account_id')::uuid AND a.organization_id = p_org;
    ELSIF v_line ? 'account_code' THEN
      SELECT a.id INTO v_account FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.code = v_line ->> 'account_code';
    END IF;
    IF v_account IS NULL THEN RAISE EXCEPTION 'LEDGER_UNKNOWN_ACCOUNT: line %', v_i USING ERRCODE = '22023'; END IF;
    INSERT INTO public.journal_lines (entry_id, organization_id, account_id, line_no, debit, credit, description)
    VALUES (v_entry, p_org, v_account, v_i, COALESCE(v_line ->> 'debit', '0')::numeric, COALESCE(v_line ->> 'credit', '0')::numeric, NULLIF(btrim(v_line ->> 'description'), ''));
  END LOOP;
  PERFORM set_config('ledger.posting_entry', '', true);
  -- One audit row in the person's own log (no amounts beyond the total; the journal itself is the record).
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'ledger.journal_' || p_source_type, 'journal_entry', v_entry::text,
          jsonb_build_object('organization_id', p_org, 'entry_date', p_entry_date, 'lines', v_i, 'total', v_sum_dr));
  RETURN jsonb_build_object('result', 'ok', 'entry_id', v_entry);
END;
$function$;
REVOKE ALL ON FUNCTION public._ledger_post(uuid, date, text, text, jsonb, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- The browser's manual journal. A reason is required; p_source_type is 'manual' (opening balances come from
-- ledger_setup, reversals from ledger_reverse_journal).
CREATE FUNCTION public.ledger_post_journal(p_org uuid, p_entry_date date, p_memo text, p_reason text, p_lines jsonb,
                                           p_source_type text DEFAULT 'manual', p_idempotency_key text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF COALESCE(p_source_type, 'manual') <> 'manual' THEN RAISE EXCEPTION 'LEDGER_BAD_SOURCE' USING ERRCODE = '22023'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'LEDGER_REASON_REQUIRED' USING ERRCODE = '22023'; END IF;
  RETURN public._ledger_post(p_org, p_entry_date, p_memo, p_reason, p_lines, 'manual', p_idempotency_key);
END;
$function$;

-- Reverses a journal: the mirror entry (debits and credits swapped), dated today or the given open date. Once only.
CREATE FUNCTION public.ledger_reverse_journal(p_entry uuid, p_reason text, p_entry_date date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE e public.journal_entries; v_lines jsonb;
BEGIN
  SELECT * INTO e FROM public.journal_entries WHERE id = p_entry;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  PERFORM public._ledger_require_writer(e.organization_id);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'LEDGER_REASON_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF e.source_type = 'reversal' THEN RAISE EXCEPTION 'LEDGER_REVERSAL_OF_REVERSAL' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries r WHERE r.reverses_entry_id = e.id) THEN RAISE EXCEPTION 'LEDGER_ALREADY_REVERSED' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('account_id', l.account_id, 'debit', l.credit::text, 'credit', l.debit::text, 'description', l.description) ORDER BY l.line_no)
    INTO v_lines FROM public.journal_lines l WHERE l.entry_id = e.id;
  RETURN public._ledger_post(e.organization_id, COALESCE(p_entry_date, current_date), left('Reversal: ' || e.memo, 200), p_reason, v_lines, 'reversal', NULL, e.id);
END;
$function$;

-- 7. The standard UK small-company chart. Internal: called by ledger_setup. Codes follow the common 4-digit layout.
CREATE FUNCTION public.ledger_seed_chart(p_org uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.ledger_accounts (organization_id, code, name, type, normal_side, is_system, system_key)
  SELECT p_org, c.code, c.name, c.type, CASE WHEN c.type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END, c.sys IS NOT NULL, c.sys
    FROM (VALUES
      ('0010', 'Fixed assets', 'asset', 'fixed_assets'),
      ('0050', 'Accumulated depreciation', 'asset', NULL),
      ('1000', 'Stock', 'asset', 'stock'),
      ('1100', 'Debtors', 'asset', 'debtors'),
      ('1200', 'Bank', 'asset', 'bank'),
      ('1210', 'Cash', 'asset', NULL),
      ('1300', 'Prepayments', 'asset', NULL),
      ('2100', 'Creditors', 'liability', 'creditors'),
      ('2109', 'Accruals', 'liability', NULL),
      ('2200', 'VAT control', 'liability', 'vat_control'),
      ('2210', 'PAYE and NI', 'liability', 'paye_ni'),
      ('2220', 'Corporation Tax', 'liability', 'corporation_tax'),
      ('2300', 'Loans', 'liability', 'loans'),
      ('2310', 'Directors'' loan account', 'liability', NULL),
      ('3000', 'Share capital', 'equity', 'share_capital'),
      ('3200', 'Retained earnings', 'equity', 'retained_earnings'),
      ('4000', 'Sales', 'income', 'sales'),
      ('4900', 'Other income', 'income', 'other_income'),
      ('5000', 'Cost of sales', 'expense', 'cost_of_sales'),
      ('7000', 'Wages and salaries', 'expense', 'wages'),
      ('7100', 'Rent and rates', 'expense', NULL),
      ('7200', 'Utilities', 'expense', NULL),
      ('7400', 'Travel', 'expense', NULL),
      ('7500', 'Office costs', 'expense', NULL),
      ('7600', 'Professional fees', 'expense', NULL),
      ('7700', 'Software and subscriptions', 'expense', NULL),
      ('7900', 'Bank charges', 'expense', NULL),
      ('8000', 'Depreciation', 'expense', 'depreciation'),
      ('8200', 'Other overheads', 'expense', NULL),
      ('9999', 'Suspense', 'asset', 'suspense')
    ) AS c(code, name, type, sys);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;
REVOKE ALL ON FUNCTION public.ledger_seed_chart(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- 8. Setup, once per company: settings, the chart, and in import mode one balanced opening journal at the start date.
CREATE FUNCTION public.ledger_setup(p_org uuid, p_start_date date, p_mode text, p_opening jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_accounts integer; v_post jsonb;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF p_mode IS NULL OR p_mode NOT IN ('fresh', 'import') THEN RAISE EXCEPTION 'LEDGER_BAD_MODE' USING ERRCODE = '22023'; END IF;
  IF p_start_date IS NULL OR p_start_date NOT BETWEEN DATE '2000-01-01' AND current_date + 366 THEN RAISE EXCEPTION 'LEDGER_BAD_DATE' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_org::text, 0));
  IF EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_ALREADY_SET_UP' USING ERRCODE = '22023'; END IF;
  IF p_mode = 'fresh' AND p_opening IS NOT NULL AND jsonb_typeof(p_opening) = 'array' AND jsonb_array_length(p_opening) > 0 THEN
    RAISE EXCEPTION 'LEDGER_BAD_MODE: starting fresh takes no opening balances' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ledger_settings (organization_id, start_date, opening_mode, created_by) VALUES (p_org, p_start_date, p_mode, auth.uid());
  v_accounts := public.ledger_seed_chart(p_org);
  IF p_mode = 'import' THEN
    v_post := public._ledger_post(p_org, p_start_date, 'Opening balances', 'Opening balances at the start date', p_opening, 'opening_balance', NULL);
  END IF;
  RETURN jsonb_build_object('result', 'ok', 'accounts', v_accounts, 'opening_entry_id', v_post -> 'entry_id');
END;
$function$;

-- 9. Accounts: add, rename / recode (non-system), activate / deactivate, delete (unused, non-system).
CREATE FUNCTION public.ledger_add_account(p_org uuid, p_code text, p_name text, p_type text, p_parent uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  PERFORM public._ledger_require_writer(p_org);
  IF NOT EXISTS (SELECT 1 FROM public.ledger_settings s WHERE s.organization_id = p_org) THEN RAISE EXCEPTION 'LEDGER_NOT_SET_UP' USING ERRCODE = '22023'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('asset', 'liability', 'equity', 'income', 'expense') THEN RAISE EXCEPTION 'LEDGER_BAD_TYPE' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.organization_id = p_org AND a.code = btrim(p_code)) THEN RAISE EXCEPTION 'LEDGER_CODE_TAKEN' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.ledger_accounts (organization_id, code, name, type, normal_side, parent_id)
  VALUES (p_org, btrim(p_code), btrim(p_name), p_type, CASE WHEN p_type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END, p_parent)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.ledger_update_account(p_account uuid, p_name text DEFAULT NULL, p_code text DEFAULT NULL, p_is_active boolean DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.ledger_accounts;
BEGIN
  SELECT * INTO a FROM public.ledger_accounts WHERE id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  PERFORM public._ledger_require_writer(a.organization_id);
  IF a.is_system AND (p_code IS NOT NULL AND btrim(p_code) <> a.code OR p_is_active IS FALSE) THEN
    RAISE EXCEPTION 'LEDGER_SYSTEM_ACCOUNT: a system account keeps its code and stays active' USING ERRCODE = '42501';
  END IF;
  IF p_code IS NOT NULL AND btrim(p_code) <> a.code AND EXISTS (SELECT 1 FROM public.ledger_accounts x WHERE x.organization_id = a.organization_id AND x.code = btrim(p_code)) THEN
    RAISE EXCEPTION 'LEDGER_CODE_TAKEN' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ledger_accounts SET name = COALESCE(btrim(p_name), name), code = COALESCE(btrim(p_code), code), is_active = COALESCE(p_is_active, is_active)
   WHERE id = p_account;
END;
$function$;

CREATE FUNCTION public.ledger_delete_account(p_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE a public.ledger_accounts;
BEGIN
  SELECT * INTO a FROM public.ledger_accounts WHERE id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_NOT_FOUND' USING ERRCODE = '22023'; END IF;
  PERFORM public._ledger_require_writer(a.organization_id);
  DELETE FROM public.ledger_accounts WHERE id = p_account;
END;
$function$;

-- 10. What the screen needs to decide (read): the rule, whether set up, and the trial balance.
CREATE FUNCTION public.ledger_status(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text; s public.ledger_settings;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule IN ('not_signed_in', 'not_member', 'closed') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.ledger_settings WHERE organization_id = p_org;
  RETURN jsonb_build_object(
    'access', CASE WHEN v_rule IN ('ok', 'not_admin') THEN 'ok' ELSE v_rule END,
    'can_post', v_rule = 'ok',
    'set_up', s.organization_id IS NOT NULL,
    'start_date', s.start_date, 'opening_mode', s.opening_mode, 'locked_through', s.locked_through, 'base_currency', COALESCE(s.base_currency, 'GBP'));
END;
$function$;

CREATE FUNCTION public.ledger_trial_balance(p_org uuid, p_as_of date)
 RETURNS TABLE(account_id uuid, code text, name text, type text, is_active boolean, debit numeric, credit numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_rule text;
BEGIN
  PERFORM public.require_aal2_if_enrolled();
  v_rule := public._ledger_rule(p_org, auth.uid());
  IF v_rule NOT IN ('ok', 'not_admin') THEN RAISE EXCEPTION 'LEDGER_%', upper(v_rule) USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT a.id, a.code, a.name, a.type, a.is_active, COALESCE(sum(l.debit), 0)::numeric, COALESCE(sum(l.credit), 0)::numeric
      FROM public.ledger_accounts a
      LEFT JOIN public.journal_lines l ON l.account_id = a.id
       AND EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = l.entry_id AND e.entry_date <= COALESCE(p_as_of, current_date))
     WHERE a.organization_id = p_org
     GROUP BY a.id, a.code, a.name, a.type, a.is_active
     ORDER BY a.code;
END;
$function$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.ledger_post_journal(uuid,date,text,text,jsonb,text,text)', 'public.ledger_reverse_journal(uuid,text,date)',
    'public.ledger_setup(uuid,date,text,jsonb)', 'public.ledger_add_account(uuid,text,text,text,uuid)', 'public.ledger_update_account(uuid,text,text,boolean)',
    'public.ledger_delete_account(uuid)', 'public.ledger_status(uuid)', 'public.ledger_trial_balance(uuid,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- 11. Account deletion: the P7b body plus one statement for journals (inside the existing 'anonymise' gate).
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
  -- Finance phase 2: journals they posted keep the opaque id; the name becomes "Deleted user" (the same gated change).
  UPDATE public.journal_entries SET posted_by_name = 'Deleted user' WHERE posted_by = p_user AND posted_by_name IS DISTINCT FROM 'Deleted user';
  PERFORM public._data_rights_gate_set('anonymise', false);
  -- 7. The person.
  DELETE FROM public.profiles WHERE id = p_user;
  DELETE FROM auth.users WHERE id = p_user;
  IF p_request IS NOT NULL THEN PERFORM public.data_rights_finish(p_request, 'done', 'account_deleted'); END IF;
  RETURN jsonb_build_object('result', 'deleted', 'companies_closed', cardinality(v_close), 'closed_ids', to_jsonb(v_close), 'rows', v_rows);
END;
$function$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.journal_entries', 'INSERT') OR has_table_privilege('service_role', 'public.journal_lines', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ledger_accounts', 'UPDATE') OR has_table_privilege('anon', 'public.journal_entries', 'SELECT')
     OR has_function_privilege('anon', 'public.ledger_post_journal(uuid,date,text,text,jsonb,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ledger_seed_chart(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.ledger_setup(uuid,date,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'privileges are not as intended';
  END IF;
END $$;

COMMIT;
