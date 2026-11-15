// Finance phase 3c-1: bank statement import and matching (docs/ledger-bank/README.md). Types and wording for the Bank
// section of the Ledger tab. Every rule (who may act, what matches) is decided by the database; this only shows it.
import { importResultText } from '@/lib/bankCsv';

export interface BankAccountRow { id: string; name: string; last4: string | null; is_active: boolean; unmatched: number; lines: number }
export interface BankSuggestion { posting_id: string; kind: PaymentKind; source_label: string | null; entry_date: string; amount_pence: number; days_apart: number }
export interface BankLine { id: string; line_date: string; description: string; amount_pence: number; balance_pence?: number | null; external_ref?: string | null; suggestions?: BankSuggestion[] }
export interface MatchedLine extends BankLine { match_kind: 'auto' | 'manual'; posting_id: string; kind: PaymentKind; source_label: string | null; entry_date: string }
export interface IgnoredLine extends BankLine { ignore_reason: IgnoreReason }
export interface BrokenLine extends BankLine { reason: 'match_broken'; posting_id: string; kind: PaymentKind; source_label: string | null; entry_date: string }
export interface OpenPayment { posting_id: string; kind: PaymentKind; source_label: string | null; entry_date: string; amount_pence: number }
export interface Reconciliation {
  as_at: string; ledger_balance_pence: number; statement_balance_pence: number | null; statement_balance_date: string | null;
  difference_pence: number | null; shared_ledger_account: boolean;
}
export interface BankOverview {
  access: string; can_manage: boolean; set_up: boolean; accounts: BankAccountRow[]; bank_account_id?: string | null; as_at?: string;
  counts?: { unmatched: number; matched: number; ignored: number; needs_attention: number };
  unmatched?: BankLine[]; matched?: MatchedLine[]; ignored?: IgnoredLine[]; needs_attention?: BrokenLine[]; unmatched_payments?: OpenPayment[];
  imports?: { id: string; file_name: string | null; row_count: number; first_date: string; last_date: string; created_at: string }[];
  covered_from?: string | null; covered_to?: string | null; reconciliation?: Reconciliation;
}
export interface BankImportResult {
  result: 'ok' | 'rejected'; import_id?: string; imported: number; skipped_duplicates: number; rejected: number;
  problems: { row: number; reason: string }[]; imported_before?: boolean; matched?: number;
}
export type PaymentKind = 'invoice_paid' | 'bill_paid' | 'expense';
export type IgnoreReason = 'not_business' | 'handle_later';

export const BANK_INTRO = 'Import your bank statement and match each line to a payment already in your ledger.';
export const BANK_NEVER_POSTS = 'Importing and matching never changes your ledger. Lines that match nothing stay here until a later release lets you post them.';
export const BANK_FILE_PRIVACY = 'The file is read in your browser. Only each line\'s date, description, amount, balance and reference are saved; the file itself is not uploaded.';
export const BANK_DIFFERENCE_NOTE = 'The difference includes anything not yet imported or not yet in the ledger, for example bank fees, interest, or a payment recorded on another date.';
export const BANK_SHARED_NOTE = 'Your bank accounts share one Bank account in the ledger, so the ledger balance covers all of them.';
export const BANK_NO_STATEMENT_BALANCE = 'No statement balance on or before this date (the imported lines carry no balance).';
export const BANK_MANAGER_ONLY = 'You can view bank statements. Only an owner or admin can import, match or ignore lines.';
export const BANK_IMPORTED_BEFORE = 'This file looks like one imported before. Lines already imported were skipped, so nothing is counted twice.';

export const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = { invoice_paid: 'Invoice payment', bill_paid: 'Bill payment', expense: 'Expense' };
export const IGNORE_REASON_LABELS: Record<IgnoreReason, string> = { not_business: 'Not a business transaction', handle_later: 'Handle later' };

/** "Invoice payment INV-12, 3 Mar (1 day apart)". */
export function suggestionText(s: BankSuggestion): string {
  const days = s.days_apart === 0 ? 'same day' : `${s.days_apart} day${s.days_apart === 1 ? '' : 's'} apart`;
  return `${PAYMENT_KIND_LABELS[s.kind] ?? 'Payment'}${s.source_label ? ` ${s.source_label}` : ''}, ${s.entry_date} (${days})`;
}
export const paymentText = (p: { kind: PaymentKind; source_label: string | null; entry_date: string }) =>
  `${PAYMENT_KIND_LABELS[p.kind] ?? 'Payment'}${p.source_label ? ` ${p.source_label}` : ''}, ${p.entry_date}`;

/** What a whole import (all its parts) did. */
export type ImportDone = { imported: number; skipped: number; rejected: number; importedBefore: boolean };
export const importDoneText = (r: ImportDone) => `${importResultText(r)}.${r.importedBefore ? ` ${BANK_IMPORTED_BEFORE}` : ''}`;
