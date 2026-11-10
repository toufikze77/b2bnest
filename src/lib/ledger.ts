// Finance phase 2: the ledger foundation (docs/ledger/README.md). Pure helpers only: money in integer pence (never a
// float comparison), the opening-balance CSV, the balance check, the trial balance and the chart rules. The database
// (docs/ledger/proposal.sql) is the real check: every rule here is repeated there, and these only give early feedback.

export const LEDGER_DISCLAIMER = 'Bookkeeping tool. Not accounting, tax or legal advice.';
export const LEDGER_NOT_AVAILABLE = 'The ledger is not available yet.';
export const LEDGER_PLAN_MESSAGE = 'The ledger is included in the Business and Scale plans, and during the 14-day trial.';
export const LEDGER_POSTED_WARNING = 'Once posted, a journal cannot be edited or deleted. It can only be reversed.';
export const MAX_LINES = 200;
/** Twelve digits of pounds, as the database allows (numeric(14,2)). */
const MAX_PENCE = 999_999_999_999_99;

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense'];
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses',
};

export interface LedgerAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  is_system: boolean;
  system_key: string | null;
  is_active: boolean;
}

/**
 * The standard chart that ledger_seed_chart() creates (docs/ledger/proposal.sql). Used before setup, when the
 * company has no accounts yet, to check opening-balance codes. src/lib/ledger.test.ts checks it matches the SQL.
 */
export const DEFAULT_CHART: { code: string; name: string; type: AccountType; system: boolean }[] = [
  { code: '0010', name: 'Fixed assets', type: 'asset', system: true },
  { code: '0050', name: 'Accumulated depreciation', type: 'asset', system: false },
  { code: '1000', name: 'Stock', type: 'asset', system: true },
  { code: '1100', name: 'Debtors', type: 'asset', system: true },
  { code: '1200', name: 'Bank', type: 'asset', system: true },
  { code: '1210', name: 'Cash', type: 'asset', system: false },
  { code: '1300', name: 'Prepayments', type: 'asset', system: false },
  { code: '2100', name: 'Creditors', type: 'liability', system: true },
  { code: '2109', name: 'Accruals', type: 'liability', system: false },
  { code: '2200', name: 'VAT control', type: 'liability', system: true },
  { code: '2210', name: 'PAYE and NI', type: 'liability', system: true },
  { code: '2220', name: 'Corporation Tax', type: 'liability', system: true },
  { code: '2300', name: 'Loans', type: 'liability', system: true },
  { code: '2310', name: "Directors' loan account", type: 'liability', system: false },
  { code: '3000', name: 'Share capital', type: 'equity', system: true },
  { code: '3200', name: 'Retained earnings', type: 'equity', system: true },
  { code: '4000', name: 'Sales', type: 'income', system: true },
  { code: '4900', name: 'Other income', type: 'income', system: true },
  { code: '5000', name: 'Cost of sales', type: 'expense', system: true },
  { code: '7000', name: 'Wages and salaries', type: 'expense', system: true },
  { code: '7100', name: 'Rent and rates', type: 'expense', system: false },
  { code: '7200', name: 'Utilities', type: 'expense', system: false },
  { code: '7400', name: 'Travel', type: 'expense', system: false },
  { code: '7500', name: 'Office costs', type: 'expense', system: false },
  { code: '7600', name: 'Professional fees', type: 'expense', system: false },
  { code: '7700', name: 'Software and subscriptions', type: 'expense', system: false },
  { code: '7900', name: 'Bank charges', type: 'expense', system: false },
  { code: '8000', name: 'Depreciation', type: 'expense', system: true },
  { code: '8200', name: 'Other overheads', type: 'expense', system: false },
  { code: '9999', name: 'Suspense', type: 'asset', system: true },
];

// ------------------------------------------------------------------ money (integer pence)

/**
 * Parses what a person typed ("1,234.5", "£12", "0.07") into whole pence, or null when it isn't a plain, non-negative
 * amount with at most two decimal places. Empty means 0. Never goes through a float.
 */
export function parsePence(input: string | null | undefined): number | null {
  const t = (input ?? '').trim().replace(/^£\s*/, '');
  if (t === '') return 0;
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{0,2})?$/.test(t)) return null;
  const [whole, frac = ''] = t.replace(/,/g, '').split('.');
  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  if (wholeDigits.length > 12) return null;
  const pence = Number(wholeDigits) * 100 + Number((frac + '00').slice(0, 2));
  return pence <= MAX_PENCE ? pence : null;
}

/** A database numeric (PostgREST sends it as a JSON number or a string) as whole pence. */
export function toPence(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = typeof v === 'number' ? v.toFixed(2) : String(v).trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,}))?$/.exec(s);
  if (!m) return 0;
  const pence = Number(m[2]) * 100 + Number(((m[3] ?? '') + '00').slice(0, 2));
  return m[1] ? -pence : pence;
}

/** Whole pence as the exact decimal string the database takes ("1234.56"). */
export function penceToDecimal(p: number): string {
  const sign = p < 0 ? '-' : '';
  const a = Math.abs(Math.trunc(p));
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** Whole pence for people: "£1,234.56". */
export function formatPence(p: number): string {
  const sign = p < 0 ? '-' : '';
  const a = Math.abs(Math.trunc(p));
  const pounds = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}£${pounds}.${String(a % 100).padStart(2, '0')}`;
}

// ------------------------------------------------------------------ journal lines and the balance check

export interface DraftLine { account: string; debit: string; credit: string; description?: string }
export interface LineProblem { line: number; message: string }
export interface BalanceCheck {
  debit: number;
  credit: number;
  /** debit - credit, in pence. 0 when balanced. */
  difference: number;
  problems: LineProblem[];
  /** Lines with an amount (blank rows are ignored). */
  used: number;
  ok: boolean;
}

export const emptyLine = (): DraftLine => ({ account: '', debit: '', credit: '' });

const isBlank = (l: DraftLine) => !l.account.trim() && !l.debit.trim() && !l.credit.trim() && !(l.description ?? '').trim();

/** Checks a grid of lines: each used line has an account and exactly one side; totals must match; at least two lines. */
export function checkBalance(lines: DraftLine[], knownAccounts?: Set<string>): BalanceCheck {
  let debit = 0; let credit = 0; let used = 0;
  const problems: LineProblem[] = [];
  lines.forEach((l, i) => {
    if (isBlank(l)) return;
    used++;
    const n = i + 1;
    const d = parsePence(l.debit); const c = parsePence(l.credit);
    if (!l.account.trim()) problems.push({ line: n, message: 'Choose an account.' });
    else if (knownAccounts && !knownAccounts.has(l.account.trim())) problems.push({ line: n, message: `Unknown account ${l.account.trim()}.` });
    if (d === null || c === null) { problems.push({ line: n, message: 'Amounts are numbers with up to 2 decimal places, not negative.' }); return; }
    if ((d > 0) === (c > 0)) problems.push({ line: n, message: 'Enter a debit or a credit, not both.' });
    if ((l.description ?? '').length > 200) problems.push({ line: n, message: 'The description is up to 200 characters.' });
    debit += d; credit += c;
  });
  if (used > MAX_LINES) problems.push({ line: 0, message: `A journal has at most ${MAX_LINES} lines.` });
  const difference = debit - credit;
  const ok = used >= 2 && problems.length === 0 && difference === 0 && debit > 0;
  return { debit, credit, difference, problems, used, ok };
}

/** "Balanced", or what is left to balance it, for the running difference under the grid. */
export function differenceText(c: BalanceCheck): string {
  if (c.difference === 0) return c.debit > 0 ? 'Balanced' : 'Enter the amounts';
  return c.difference > 0 ? `Debits are ${formatPence(c.difference)} more than credits` : `Credits are ${formatPence(-c.difference)} more than debits`;
}

/** The lines for ledger_post_journal / ledger_setup: blank rows dropped, amounts as exact decimal strings. */
export function linesForRpc(lines: DraftLine[], by: 'account_code' | 'account_id' = 'account_code') {
  return lines.filter((l) => !isBlank(l)).map((l) => ({
    [by]: l.account.trim(),
    debit: penceToDecimal(parsePence(l.debit) ?? 0),
    credit: penceToDecimal(parsePence(l.credit) ?? 0),
    ...(l.description?.trim() ? { description: l.description.trim() } : {}),
  }));
}

/** A manual journal's form: memo, reason (required, 3 characters or more) and the lines. */
export function checkManualJournal(f: { memo: string; reason: string; date: string; lines: DraftLine[] }, knownAccounts?: Set<string>) {
  const errors: string[] = [];
  if (!f.date) errors.push('Choose a date.');
  if (!f.memo.trim()) errors.push('Add a description.');
  if (f.memo.trim().length > 200) errors.push('The description is up to 200 characters.');
  if (f.reason.trim().length < 3) errors.push('Add a reason (at least 3 characters).');
  if (f.reason.length > 500) errors.push('The reason is up to 500 characters.');
  const balance = checkBalance(f.lines, knownAccounts);
  if (balance.used < 2) errors.push('A journal needs at least two lines.');
  return { errors, balance, ok: errors.length === 0 && balance.ok };
}

/** A reversal needs a reason of 3 characters or more (as the database). */
export const reverseReasonOk = (reason: string) => reason.trim().length >= 3 && reason.length <= 500;

// ------------------------------------------------------------------ opening balances from CSV

/**
 * Reads "account_code,debit,credit" (a header row is optional; extra columns are ignored). Returns the lines and the
 * problems by CSV line number. Nothing is posted from here: the preview shows both.
 */
export function parseOpeningCsv(text: string, knownCodes: Set<string>): { lines: DraftLine[]; problems: LineProblem[] } {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const lines: DraftLine[] = [];
  const problems: LineProblem[] = [];
  rows.forEach((raw, i) => {
    const n = i + 1;
    if (!raw.trim()) return;
    const cells = splitCsvRow(raw);
    if (i === 0 && /^account[_ ]?code$/i.test((cells[0] ?? '').trim())) return;
    if (cells.length < 3) { problems.push({ line: n, message: 'Expected account_code,debit,credit.' }); return; }
    const [code, debit, credit] = cells.map((c) => c.trim());
    const d = parsePence(debit); const c = parsePence(credit);
    if (!code) problems.push({ line: n, message: 'The account code is missing.' });
    else if (!knownCodes.has(code)) problems.push({ line: n, message: `Unknown account code ${code}.` });
    if (d === null || c === null) problems.push({ line: n, message: 'Amounts are numbers with up to 2 decimal places, not negative.' });
    else if ((d > 0) === (c > 0)) problems.push({ line: n, message: 'Enter a debit or a credit, not both.' });
    lines.push({ account: code, debit: debit ?? '', credit: credit ?? '' });
  });
  if (lines.length > MAX_LINES) problems.push({ line: 0, message: `At most ${MAX_LINES} lines.` });
  return { lines, problems };
}

function splitCsvRow(row: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (q) {
      if (ch === '"' && row[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

// ------------------------------------------------------------------ trial balance

export interface TrialBalanceRow { account_id: string; code: string; name: string; type: AccountType; is_active: boolean; debit: number | string; credit: number | string }
export interface TrialBalanceLine { account_id: string; code: string; name: string; type: AccountType; debit: number; credit: number }

/** Each account's balance on its own side (accounts with no balance left out), and whether the totals agree. */
export function trialBalance(rows: TrialBalanceRow[]) {
  const lines: TrialBalanceLine[] = [];
  let totalDebit = 0; let totalCredit = 0;
  for (const r of rows) {
    const net = toPence(r.debit) - toPence(r.credit);
    if (net === 0) continue;
    const line = { account_id: r.account_id, code: r.code, name: r.name, type: r.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
    totalDebit += line.debit; totalCredit += line.credit;
    lines.push(line);
  }
  return { lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

// ------------------------------------------------------------------ chart rules

export function groupAccounts(accounts: LedgerAccount[]): { type: AccountType; label: string; accounts: LedgerAccount[] }[] {
  return ACCOUNT_TYPES.map((type) => ({
    type, label: ACCOUNT_TYPE_LABELS[type],
    accounts: accounts.filter((a) => a.type === type).sort((a, b) => a.code.localeCompare(b.code)),
  })).filter((g) => g.accounts.length > 0);
}

/** What the chart screen offers for one account (the database enforces the same). */
export function accountActions(a: LedgerAccount, canPost: boolean) {
  return {
    rename: canPost && !a.is_system,
    deactivate: canPost && !a.is_system && a.is_active,
    reactivate: canPost && !a.is_system && !a.is_active,
  };
}

export const ACCOUNT_CODE_RE = /^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/;
export function checkNewAccount(f: { code: string; name: string; type: string }, existingCodes: Set<string>): string[] {
  const errors: string[] = [];
  const code = f.code.trim();
  if (!ACCOUNT_CODE_RE.test(code)) errors.push('The code is 1 to 16 letters or numbers (and . _ -), starting with a letter or number.');
  else if (existingCodes.has(code)) errors.push('That code is already used.');
  const name = f.name.trim();
  if (name.length < 1 || name.length > 80) errors.push('The name is 1 to 80 characters.');
  if (!ACCOUNT_TYPES.includes(f.type as AccountType)) errors.push('Choose a type.');
  return errors;
}

// ------------------------------------------------------------------ errors from the database

export const LEDGER_MESSAGES: Record<string, string> = {
  NOT_AVAILABLE: LEDGER_NOT_AVAILABLE,
  MFA_REQUIRED: 'Two-step sign-in is on for your account. Sign out, sign in again with your 6-digit code, then try again.',
  DEMO: 'This is a demo account. It is view only.',
  NOT_SIGNED_IN: 'Please sign in again.',
  NOT_MEMBER: "You don't have access to this company's ledger.",
  NOT_ADMIN: 'Only an owner or admin of this company can change the ledger.',
  CLOSED: 'This company is closed.',
  PLAN_NOT_INCLUDED: LEDGER_PLAN_MESSAGE,
  TRIAL_ENDED: 'Your trial has ended. Choose a plan to use the ledger.',
  SUSPENDED: 'Your account is suspended.',
  NOT_SET_UP: 'Set up the ledger first.',
  ALREADY_SET_UP: 'The ledger is already set up for this company.',
  BAD_MODE: 'Choose how to start: fresh, or with opening balances.',
  BAD_DATE: 'Choose a valid date.',
  BEFORE_START: 'The date is before the ledger start date.',
  PERIOD_LOCKED: 'That date is in a locked period.',
  OPENING_DATE: 'Opening balances are dated the start date.',
  BAD_MEMO: 'Add a description of up to 200 characters.',
  BAD_REASON: 'The reason is up to 500 characters.',
  REASON_REQUIRED: 'Add a reason (at least 3 characters).',
  BAD_AMOUNT: 'Amounts are numbers with up to 2 decimal places, not negative.',
  ONE_SIDE: 'Each line has a debit or a credit, not both.',
  UNBALANCED: 'Debits and credits must be equal.',
  TOO_FEW_LINES: 'A journal needs at least two lines.',
  TOO_MANY_LINES: `A journal has at most ${MAX_LINES} lines.`,
  UNKNOWN_ACCOUNT: "One of the accounts isn't in this company's chart.",
  ACCOUNT_INACTIVE: 'One of the accounts is inactive.',
  ALREADY_REVERSED: 'This journal has already been reversed.',
  REVERSAL_OF_REVERSAL: "A reversal can't be reversed. Post a new journal instead.",
  CODE_TAKEN: 'That code is already used.',
  BAD_TYPE: 'Choose a type.',
  SYSTEM_ACCOUNT: 'A system account keeps its code and stays active.',
  ACCOUNT_FIXED: "This account's type can't change.",
  ACCOUNT_USED: 'This account has journal lines, so it can only be made inactive.',
  NOT_FOUND: "That wasn't found. Refresh and try again.",
  APPEND_ONLY: 'Posted journals cannot be edited or deleted. Reverse them instead.',
};

type DbError = { code?: string; message?: string } | null | undefined;

/** True when the ledger SQL isn't applied yet (the function or table doesn't exist). */
export function isNotAvailable(e: DbError): boolean {
  if (!e) return false;
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(e.code ?? '')
    || /could not find the (function|table)|does not exist/i.test(e.message ?? '');
}

/** The short code from a database error: "LEDGER_UNBALANCED: debits…" → "UNBALANCED". */
export function ledgerCode(e: DbError): string {
  if (!e) return 'ERROR';
  if (isNotAvailable(e)) return 'NOT_AVAILABLE';
  const m = e.message ?? '';
  if (/MFA_REQUIRED/.test(m)) return 'MFA_REQUIRED';
  if (/demo account/i.test(m)) return 'DEMO';
  const x = /LEDGER_([A-Z_]+)/.exec(m);
  return x ? x[1] : 'ERROR';
}

export const ledgerMessage = (code: string) => LEDGER_MESSAGES[code] ?? 'Something went wrong. Please try again.';

/** A fresh key so pressing Post twice can't post twice (ledger_post_journal's p_idempotency_key). */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '');
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
