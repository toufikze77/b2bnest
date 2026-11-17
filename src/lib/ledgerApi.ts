// Finance phase 2: the browser side of the ledger (docs/ledger/README.md). Every write goes through an RPC in
// docs/ledger/proposal.sql (the tables have no write grants); reads use RLS (members of the company only).
// Before the SQL is applied every call answers { ok: false, code: 'NOT_AVAILABLE' }, so the screens say
// "The ledger is not available yet." instead of failing.
import { supabase } from '@/integrations/supabase/client';
import { ledgerCode, type AccountType, type LedgerAccount, type TrialBalanceRow } from '@/lib/ledger';
import type { AutoPreview, AutoRun, AutoStatus, CategoryMapRow, PostingIssue, PostingLink } from '@/lib/ledgerAuto';
import type { BankImportResult, BankOverview, IgnoreReason } from '@/lib/ledgerBank';
import type { BankRow } from '@/lib/bankCsv';
import type { AccountDetail, BsRow, Completeness, PlRow } from '@/lib/ledgerReports';

type DbError = { code?: string; message?: string } | null;
type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: DbError }>;
type Query = {
  select: (cols: string) => Query;
  eq: (col: string, v: unknown) => Query;
  in: (col: string, v: unknown[]) => Query;
  is: (col: string, v: null) => Query;
  order: (col: string, o?: { ascending?: boolean }) => Query;
  limit: (n: number) => Query;
  then: Promise<{ data: unknown; error: DbError }>['then'];
};
export interface LedgerClient { rpc: Rpc; from: (t: string) => Query }

export type Result<T> = { ok: true; data: T } | { ok: false; code: string };
/** The error code of a failed result ('ERROR' if it somehow has none). */
export const codeOf = (r: Result<unknown>): string => ('code' in r ? r.code : 'ERROR');

export interface LedgerStatus {
  access: 'ok' | 'demo' | 'plan_not_included' | 'trial_ended' | 'suspended' | string;
  can_post: boolean;
  set_up: boolean;
  start_date: string | null;
  opening_mode: 'fresh' | 'import' | null;
  locked_through: string | null;
  base_currency: string;
}
export interface JournalEntry {
  id: string;
  entry_date: string;
  memo: string;
  reason: string | null;
  source_type: 'manual' | 'opening_balance' | 'reversal' | 'auto_invoice' | 'auto_invoice_payment' | 'auto_bill' | 'auto_bill_payment' | 'auto_expense' | 'bank_line';
  source_id?: string | null;
  reverses_entry_id: string | null;
  posted_by_name: string | null;
  posted_at: string;
}
export interface JournalLine { id: string; entry_id: string; account_id: string; line_no: number; debit: number | string; credit: number | string; description: string | null }
export type PostLine = { account_code?: string; account_id?: string; debit: string; credit: string; description?: string };

const fail = (error: DbError): { ok: false; code: string } => ({ ok: false, code: ledgerCode(error) });

export function ledgerApi(client: LedgerClient = supabase as unknown as LedgerClient) {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> => {
    try {
      const { data, error } = await client.rpc(fn, args);
      return error ? fail(error) : { ok: true, data: data as T };
    } catch {
      return { ok: false, code: 'ERROR' };
    }
  };
  const read = async <T>(q: Query): Promise<Result<T>> => {
    try {
      const { data, error } = await q;
      return error ? fail(error) : { ok: true, data: (data ?? []) as T };
    } catch {
      return { ok: false, code: 'ERROR' };
    }
  };

  return {
    status: (org: string) => call<LedgerStatus>('ledger_status', { p_org: org }),
    setup: (org: string, startDate: string, mode: 'fresh' | 'import', opening: PostLine[] | null) =>
      call<{ result: string; accounts: number; opening_entry_id: string | null }>('ledger_setup', { p_org: org, p_start_date: startDate, p_mode: mode, p_opening: mode === 'import' ? opening : null }),
    post: (org: string, f: { date: string; memo: string; reason: string; lines: PostLine[]; key: string }) =>
      call<{ result: 'ok' | 'existing'; entry_id: string }>('ledger_post_journal', {
        p_org: org, p_entry_date: f.date, p_memo: f.memo.trim(), p_reason: f.reason.trim(), p_lines: f.lines, p_source_type: 'manual', p_idempotency_key: f.key,
      }),
    reverse: (entry: string, reason: string, date?: string) =>
      call<{ result: string; entry_id: string }>('ledger_reverse_journal', { p_entry: entry, p_reason: reason.trim(), ...(date ? { p_entry_date: date } : {}) }),
    addAccount: (org: string, f: { code: string; name: string; type: AccountType }) =>
      call<string>('ledger_add_account', { p_org: org, p_code: f.code.trim(), p_name: f.name.trim(), p_type: f.type }),
    updateAccount: (account: string, f: { name?: string; is_active?: boolean }) =>
      call<null>('ledger_update_account', { p_account: account, ...(f.name !== undefined ? { p_name: f.name.trim() } : {}), ...(f.is_active !== undefined ? { p_is_active: f.is_active } : {}) }),
    trialBalance: (org: string, asOf: string) => call<TrialBalanceRow[]>('ledger_trial_balance', { p_org: org, p_as_of: asOf }),
    accounts: (org: string) => read<LedgerAccount[]>(client.from('ledger_accounts').select('id,code,name,type,is_system,system_key,is_active')
      .eq('organization_id', org).order('code')),
    journals: (org: string) => read<JournalEntry[]>(client.from('journal_entries')
      .select('id,entry_date,memo,reason,source_type,source_id,reverses_entry_id,posted_by_name,posted_at')
      .eq('organization_id', org).order('entry_date', { ascending: false }).order('posted_at', { ascending: false }).limit(500)),
    lines: (entry: string) => read<JournalLine[]>(client.from('journal_lines').select('id,entry_id,account_id,line_no,debit,credit,description')
      .eq('entry_id', entry).order('line_no')),
    // Finance phase 3a: automatic postings (docs/ledger-auto). Before that SQL is applied these answer NOT_AVAILABLE.
    autoStatus: (org: string) => call<AutoStatus>('ledger_auto_status', { p_org: org }),
    /** 'invoices' uses the phase 3a call unchanged; 'bills_and_expenses' (phase 3b) names the switch. */
    autoSet: (org: string, enabled: boolean, which: 'invoices' | 'bills_and_expenses' = 'invoices') =>
      call<AutoStatus>('ledger_auto_set', which === 'invoices' ? { p_org: org, p_enabled: enabled } : { p_org: org, p_enabled: enabled, p_switch: which }),
    autoPreview: (org: string) => call<AutoPreview>('ledger_auto_preview', { p_org: org }),
    autoCatchUp: (org: string, which: 'invoices' | 'bills_and_expenses' = 'invoices') =>
      call<AutoRun & { queued: number }>('ledger_auto_catch_up', which === 'invoices' ? { p_org: org } : { p_org: org, p_switch: which }),
    autoRun: (org: string) => call<AutoRun>('ledger_auto_run', { p_org: org }),
    /** Finance phase 3b follow-up 2: is this company VAT registered (and from when)? */
    vatRegisteredSet: (org: string, registered: boolean, from?: string | null) =>
      call<AutoStatus>('ledger_vat_registered_set', { p_org: org, p_registered: registered, ...(registered && from ? { p_from: from } : {}) }),
    postings: (org: string) => read<PostingLink[]>(client.from('ledger_postings').select('entry_id,reversal_entry_id,source_label,kind')
      .eq('organization_id', org).limit(5000)),
    issues: (org: string) => read<PostingIssue[]>(client.from('ledger_post_issues').select('id,source_table,source_id,source_label,kind,reason_code,created_at')
      .eq('organization_id', org).is('resolved_at', null).order('created_at', { ascending: false }).limit(500)),
    // Finance phase 3b: which account each bill and expense category posts to (read only in this release).
    categoryMap: (org: string) => read<CategoryMapRow[]>(client.from('ledger_category_map').select('category_key,account_id,is_default')
      .eq('organization_id', org).order('category_key')),
    // Finance phase 4: reports from the ledger (docs/ledger-reports), read only. Before that SQL is applied: NOT_AVAILABLE.
    reportProfitLoss: (org: string, from: string, to: string) => call<PlRow[]>('ledger_report_profit_loss', { p_org: org, p_from: from, p_to: to }),
    reportBalanceSheet: (org: string, asOf: string) => call<BsRow[]>('ledger_report_balance_sheet', { p_org: org, p_as_of: asOf }),
    reportAccountDetail: (org: string, account: string, from: string, to: string) =>
      call<AccountDetail>('ledger_report_account_detail', { p_org: org, p_account: account, p_from: from, p_to: to }),
    reportCompleteness: (org: string) => call<Completeness>('ledger_report_completeness', { p_org: org }),
    // Finance phase 3c-1: bank statements (docs/ledger-bank). Before that SQL is applied these answer NOT_AVAILABLE.
    bankOverview: (org: string, account?: string | null, asAt?: string | null, page = 0) =>
      call<BankOverview>('ledger_bank_overview', { p_org: org, p_bank_account: account ?? null, p_as_at: asAt ?? null, p_page: page }),
    bankAccountSave: (org: string, f: { id?: string | null; name: string; last4?: string | null; active?: boolean | null }) =>
      call<{ result: 'created' | 'updated' | 'unchanged'; id: string }>('ledger_bank_account_save', {
        p_org: org, p_id: f.id ?? null, p_name: f.name.trim(), p_last4: f.last4?.trim() || null, p_active: f.active ?? null,
      }),
    bankImport: (org: string, account: string, fileName: string, rows: BankRow[]) =>
      call<BankImportResult>('ledger_bank_import', { p_org: org, p_bank_account: account, p_file_name: fileName, p_rows: rows }),
    bankMatchRun: (org: string, account: string) => call<{ matched: number; unlinked: number; unposted?: number }>('ledger_bank_match_run', { p_org: org, p_bank_account: account }),
    bankMatch: (org: string, line: string, posting: string) => call<{ result: string }>('ledger_bank_match', { p_org: org, p_line: line, p_posting: posting }),
    bankUnmatch: (org: string, line: string) => call<{ result: string }>('ledger_bank_unmatch', { p_org: org, p_line: line }),
    bankIgnore: (org: string, line: string, reason: IgnoreReason) => call<{ result: string }>('ledger_bank_ignore', { p_org: org, p_line: line, p_reason: reason }),
    bankUnignore: (org: string, line: string) => call<{ result: string }>('ledger_bank_unignore', { p_org: org, p_line: line }),
    // Finance phase 3c-2: post unmatched lines to the ledger (docs/ledger-bank-post).
    bankPost: (org: string, line: string, account: string, key?: string) =>
      call<{ result: 'posted' | 'unchanged'; line_id: string; entry_id: string }>('ledger_bank_post', { p_org: org, p_line: line, p_account: account, p_idempotency_key: key ?? null }),
    bankPostMany: (org: string, account: string, lines: string[]) =>
      call<{ result: string; posted: number; unchanged: number; entry_ids: string[] }>('ledger_bank_post_many', { p_org: org, p_account: account, p_lines: lines }),
    bankUnpost: (org: string, line: string) =>
      call<{ result: string; how: 'reversed' | 'already_reversed'; reversal_date: string | null; reversal_dated: 'line_date' | 'today' | null }>('ledger_bank_unpost', { p_org: org, p_line: line }),
  };
}
export type LedgerApi = ReturnType<typeof ledgerApi>;
