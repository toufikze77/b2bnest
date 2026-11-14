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
}
export interface AutoRun { processed: number; failed: number; dropped: number; remaining: number }
export interface PostingLink { entry_id: string; reversal_entry_id: string | null; source_label: string | null; kind: 'invoice_issued' | 'invoice_paid' }
export interface PostingIssue { id: string; source_id: string; source_label: string | null; kind: 'invoice_issued' | 'invoice_paid'; reason_code: string; created_at: string }

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
  issue_not_posted: "The payment can't post because the invoice itself isn't posted.",
  reversal_period_locked: "The invoice changed, but its journal is in a locked period, so it can't be reversed.",
  processing_failed: "Couldn't be posted after several tries. Check the invoice, then save it again.",
};
export const issueReason = (code: string) => ISSUE_REASONS[code] ?? 'Needs checking.';
export const ISSUE_KIND_LABELS: Record<string, string> = { invoice_issued: 'Invoice', invoice_paid: 'Payment' };

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
    const label = `Invoice ${l.source_label ?? ''}`.trim();
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
