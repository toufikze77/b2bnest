// Finance phase 3a: automatic ledger postings for invoices (docs/ledger-auto/README.md). Pure helpers only. The
// database decides what posts (docs/ledger-auto/proposal.sql); invoicePosting() mirrors its rules so the screen can
// explain them, and is tested in integer pence (never a float comparison).
import { toPence } from '@/lib/ledger';

export const AUTO_SWITCH_LABEL = 'Post invoices to the ledger automatically';
export const AUTO_ON_DONE = 'Automatic postings are on.';
export const AUTO_OFF_DONE = 'Automatic postings are off. Existing journals are kept.';
export const AUTO_OFF_CONFIRM = 'Stop automatic postings? Existing journals are kept.';
export const AUTO_MFA_MESSAGE = 'Confirm with your authenticator app, then try again.';
export const AUTO_NOT_AVAILABLE = 'Automatic postings are not available yet.';
export const AUTO_VAT_SCHEME_NOTE =
  "VAT scheme rules (such as cash accounting or the flat rate scheme) are not applied yet: each journal posts the VAT the invoice records.";

export interface AutoStatus {
  access: string;
  can_manage: boolean;
  set_up: boolean;
  invoices_enabled: boolean;
  enabled_at: string | null;
  waiting: number;
  open_issues: number;
  /** Finance phase 3b (absent before its SQL is applied). */
  bills_enabled?: boolean;
}
export interface AutoPreview {
  invoices_to_post: number;
  invoices_total: number;
  payments_to_post: number;
  payments_total: number;
  to_reverse: number;
  already_posted: number;
  not_issued: number;
  skipped: Record<string, number>;
  /** Finance phase 3b (absent before its SQL is applied). */
  bills_and_expenses?: RecordsPreview;
}
export interface AutoRun { processed: number; failed: number; dropped: number; remaining: number }
export type PostingKind = 'invoice_issued' | 'invoice_paid' | 'bill_received' | 'bill_paid' | 'expense';
export type PostingSource = 'invoices' | 'bills' | 'expenses';
export interface PostingLink { entry_id: string; reversal_entry_id: string | null; source_label: string | null; kind: PostingKind }
export interface PostingIssue { id: string; source_table?: PostingSource; source_id: string; source_label: string | null; kind: PostingKind; reason_code: string; created_at: string }
/** Finance phase 3b: the bills-and-expenses part of ledger_auto_preview (whole pence). */
export interface RecordsPreview {
  bills_to_post: number; bills_total: number; bill_payments_to_post: number; bill_payments_total: number;
  expenses_to_post: number; expenses_total: number; to_reverse: number; already_posted: number; not_posted: number; skipped: Record<string, number>;
}
export interface CategoryMapRow { category_key: string; account_id: string | null; is_default: boolean }

/** Plain reasons for the needs-attention list (the reason codes of ledger_post_issues). */
export const ISSUE_REASONS: Record<string, string> = {
  before_start: 'Dated before the ledger start date.',
  period_locked: 'Dated in a locked period.',
  amounts_do_not_add_up: "The subtotal and VAT don't add up to the total.",
  amounts_missing: 'The subtotal or total is missing.',
  not_whole_pence: 'An amount is not a whole number of pence.',
  zero_total: 'The total is zero.',
  negative_amount: 'An amount is negative (credit notes are not posted yet).',
  currency_not_gbp: 'Not in pounds (GBP). Only GBP invoices are posted.',
  paid_date_missing: 'Marked paid, but with no paid date.',
  issue_not_posted: "The payment can't post because the record itself isn't posted.",
  reversal_period_locked: "The record changed, but its journal is in a locked period, so it can't be reversed.",
  processing_failed: "Couldn't be posted after several tries. Check the record, then save it again.",
  // Finance phase 3b (bills and expenses)
  vat_details_missing: 'Its VAT details are not recorded yet (Company records helps add them).',
  category_not_mapped: 'Its category has no ledger account yet.',
  category_account_missing: "Its category's ledger account was deleted.",
  category_account_inactive: "Its category's ledger account is inactive.",
};
export const issueReason = (code: string) => ISSUE_REASONS[code] ?? 'Needs checking.';
export const ISSUE_KIND_LABELS: Record<string, string> = {
  invoice_issued: 'Invoice', invoice_paid: 'Payment', bill_received: 'Bill', bill_paid: 'Bill payment', expense: 'Expense:',
};
const FINANCE = '/business-tools?tool=business-finance-assistant';
/** Where to fix a record: invoices and expenses have their own tab; bills are edited in Company records. */
export const SOURCE_LINKS: Record<PostingSource, { to: string; text: string }> = {
  invoices: { to: `${FINANCE}&tab=invoices`, text: 'Open invoices' },
  expenses: { to: `${FINANCE}&tab=expenses`, text: 'Open expenses' },
  bills: { to: `${FINANCE}&tab=company-records`, text: 'Open company records' },
};
export const sourceOfKind = (k: string): PostingSource => (k.startsWith('bill') ? 'bills' : k === 'expense' ? 'expenses' : 'invoices');

export interface InvoiceAmounts { status: string | null; currency: string | null; subtotal: number | string | null; tax_amount: number | string | null; total_amount: number | string | null }
export type PostingLine = { account: 'debtors' | 'sales' | 'vat_control' | 'bank'; debit: number; credit: number };

/**
 * The issue journal for an invoice (accrual): Dr Debtors = total; Cr Sales = subtotal; Cr VAT control = VAT (no line
 * when the VAT is zero). Or the reason it can't post. Dates and locks are checked by the database.
 */
export function invoicePosting(i: InvoiceAmounts): { lines: PostingLine[] } | { reason: string } | { none: true } {
  const status = (i.status ?? '').trim().toLowerCase();
  if (!['sent', 'overdue', 'paid'].includes(status)) return { none: true };
  if ((i.currency ?? '').trim().toUpperCase() !== 'GBP') return { reason: 'currency_not_gbp' };
  if (i.subtotal === null || i.subtotal === '' || i.total_amount === null || i.total_amount === '') return { reason: 'amounts_missing' };
  const sub = exactPence(i.subtotal); const tax = exactPence(i.tax_amount ?? 0); const total = exactPence(i.total_amount);
  if (sub === null || tax === null || total === null) return { reason: 'not_whole_pence' };
  if (sub < 0 || tax < 0 || total < 0) return { reason: 'negative_amount' };
  if (total === 0) return { reason: 'zero_total' };
  if (sub + tax !== total) return { reason: 'amounts_do_not_add_up' };
  const lines: PostingLine[] = [{ account: 'debtors', debit: total, credit: 0 }, { account: 'sales', debit: 0, credit: sub }];
  if (tax > 0) lines.push({ account: 'vat_control', debit: 0, credit: tax });
  return { lines };
}

/** The payment journal: Dr Bank = total; Cr Debtors = total. */
export const paymentPosting = (totalPence: number): PostingLine[] => [{ account: 'bank', debit: totalPence, credit: 0 }, { account: 'debtors', debit: 0, credit: totalPence }];

/** Whole pence, or null when the value has more than two decimal places (a float is read through its decimal text). */
export function exactPence(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return 0;
  const s = typeof v === 'number' ? String(v) : String(v).trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = (m[3] ?? '').replace(/0+$/, '');
  if (frac.length > 2) return null;
  return toPence(s);
}

/** "Invoice INV-0012" for automatic journals and for reversals of them (from ledger_postings); null otherwise. */
export function journalSources(links: PostingLink[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const l of links) {
    const name = l.source_label ?? '';
    const label = (l.kind === 'expense' ? `Expense: ${name}` : l.kind.startsWith('bill') ? `Bill ${name}` : `Invoice ${name}`).trim();
    m.set(l.entry_id, label);
    if (l.reversal_entry_id) m.set(l.reversal_entry_id, label);
  }
  return m;
}

/** "On since 3 March 2026" or "Off". */
export function autoStateText(s: Pick<AutoStatus, 'invoices_enabled' | 'enabled_at'>): string {
  if (!s.invoices_enabled) return 'Off';
  if (!s.enabled_at) return 'On';
  const d = new Date(s.enabled_at);
  return Number.isNaN(d.getTime()) ? 'On' : `On since ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })}`;
}

// ------------------------------------------------------------------ Finance phase 3b: bills and expenses

export const BILLS_SWITCH_LABEL = 'Post bills and expenses to the ledger automatically';
export const BILLS_ON_DONE = 'Bills and expenses now post automatically.';
export const BILLS_OFF_DONE = 'Bills and expenses no longer post automatically. Existing journals are kept.';
export const BILLS_OFF_CONFIRM = 'Stop posting bills and expenses? Existing journals are kept.';

/** "Software and subscriptions" -> software_and_subscriptions (the database's _ledger_auto_category_key). */
export const categoryKey = (c: string | null | undefined) =>
  (c ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);

export interface MoneyOutAmounts {
  status: string | null; amount: number | string | null; net_amount: number | string | null; vat_amount: number | string | null;
  vat_status: string | null; vat_reclaimable: boolean;
}
export type CostLine = { account: 'expense' | 'vat_control' | 'creditors' | 'bank'; debit: number; credit: number };

/** The shared rule for a bill or an expense: Dr expense = net (+ VAT if not reclaimable), Dr VAT control = reclaimable VAT, Cr `credit` = gross. */
function costPosting(r: MoneyOutAmounts, credit: 'creditors' | 'bank'): { lines: CostLine[] } | { reason: string } {
  if (r.amount === null || r.amount === '') return { reason: 'amounts_missing' };
  if (r.vat_status !== 'recorded' || r.net_amount === null || r.vat_amount === null || r.net_amount === '' || r.vat_amount === '') return { reason: 'vat_details_missing' };
  const gross = exactPence(r.amount); const net = exactPence(r.net_amount); const vat = exactPence(r.vat_amount);
  if (gross === null || net === null || vat === null) return { reason: 'not_whole_pence' };
  if (gross < 0 || net < 0 || vat < 0) return { reason: 'negative_amount' };
  if (gross === 0) return { reason: 'zero_total' };
  if (net + vat !== gross) return { reason: 'amounts_do_not_add_up' };
  const reclaim = r.vat_reclaimable && vat > 0;
  const lines: CostLine[] = [
    { account: 'expense', debit: net + (reclaim ? 0 : vat), credit: 0 },
    { account: 'vat_control', debit: reclaim ? vat : 0, credit: 0 },
    { account: credit, debit: 0, credit: gross },
  ];
  return { lines: lines.filter((l) => l.debit > 0 || l.credit > 0) };
}

/** A bill as received (pending, overdue or paid): Cr Creditors = gross. Cancelled bills never post. */
export function billPosting(b: MoneyOutAmounts & { currency: string | null }): { lines: CostLine[] } | { reason: string } | { none: true } {
  if (!['pending', 'overdue', 'paid'].includes((b.status ?? '').trim().toLowerCase())) return { none: true };
  if ((b.currency ?? '').trim().toUpperCase() !== 'GBP') return { reason: 'currency_not_gbp' };
  return costPosting(b, 'creditors');
}

/** An approved or paid expense (money already spent): Cr Bank = gross. Pending, rejected and other expenses never post. */
export function expensePosting(e: MoneyOutAmounts, accountCurrency: string | null): { lines: CostLine[] } | { reason: string } | { none: true } {
  if (!['approved', 'paid'].includes((e.status ?? '').trim().toLowerCase())) return { none: true };
  if ((accountCurrency ?? '').trim().toUpperCase() !== 'GBP') return { reason: 'currency_not_gbp' };
  return costPosting(e, 'bank');
}
