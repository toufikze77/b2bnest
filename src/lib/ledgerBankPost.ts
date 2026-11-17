// Finance phase 3c-2: posting unmatched bank statement lines to the ledger (docs/ledger-bank-post/README.md). Pure
// functions: which counter accounts are allowed (the database checks the same rule), a suggestion from the description
// (a suggestion only: a person always chooses and confirms), and the one-line effect in plain words. Whole pence only.
import { formatPence, type LedgerAccount } from '@/lib/ledger';

/** Accounts driven by invoices, bills, payroll and returns (and the bank itself): never a bank line's counter account. */
export const BLOCKED_SYSTEM_KEYS = ['bank', 'debtors', 'creditors', 'vat_control', 'paye_ni', 'corporation_tax'] as const;
export const MAX_POST_MANY = 50;

export const POST_BLOCKED_HINT = "Debtors, Creditors, VAT control, PAYE and NI and Corporation Tax aren't listed here. Use a manual journal for this.";
export const POST_EXPENSES_HINT = 'Expenses and invoices posted there match your bank lines automatically.';
export const POST_NO_VAT = 'No VAT is added here.';
export const POST_SUGGESTED = 'Suggested from the description';
export const POST_DONE = 'Posted. Your ledger bank balance now includes this line.';
export const UNPOST_CONFIRM = 'This reverses the journal. Nothing is deleted.';
export { BANK_NEVER_POSTS as BANK_POSTING_NOTE } from '@/lib/ledgerBank';

export const isBlocked = (a: Pick<LedgerAccount, 'system_key'>) => (BLOCKED_SYSTEM_KEYS as readonly string[]).includes(a.system_key ?? '');
/** The accounts a line may be posted to: active, not blocked; in code order. */
export function allowedAccounts(accounts: LedgerAccount[]): LedgerAccount[] {
  return accounts.filter((a) => a.is_active && !isBlocked(a)).sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }));
}

/** A suggestion from the description, looked up by code in the company's own allowed accounts. Transfers: none. */
export function suggestAccount(description: string, amountPence: number, allowed: LedgerAccount[]): LedgerAccount | null {
  const d = description.toLowerCase();
  const byCode = (code: string) => allowed.find((a) => a.code === code) ?? null;
  if (/\b(transfer|tfr)\b|own account/.test(d)) return null;
  if (/\b(fees?|charges?|commission)\b/.test(d)) return byCode('7900');
  if (/\binterest\b/.test(d)) return byCode(amountPence > 0 ? '4900' : '8200');
  return null;
}

/** "Money out £5.50: Bank charges (7900) debit, Bank credit". */
export function effectText(amountPence: number, account: Pick<LedgerAccount, 'code' | 'name'> | null): string {
  const target = account ? `${account.name} (${account.code})` : 'the account you choose';
  return amountPence < 0
    ? `Money out ${formatPence(-amountPence)}: ${target} debit, Bank credit`
    : `Money in ${formatPence(amountPence)}: Bank debit, ${target} credit`;
}

/** Signed total of the chosen lines (whole pence). */
export const linesTotal = (lines: { amount_pence: number }[]) => lines.reduce((s, l) => s + l.amount_pence, 0);

/** Filters accounts by what was typed: code or name, any case. */
export function searchAccounts(accounts: LedgerAccount[], q: string): LedgerAccount[] {
  const t = q.trim().toLowerCase();
  return t ? accounts.filter((a) => a.code.toLowerCase().includes(t) || a.name.toLowerCase().includes(t)) : accounts;
}
