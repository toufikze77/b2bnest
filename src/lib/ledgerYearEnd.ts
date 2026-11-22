// Finance phase 5: financial year end (docs/ledger-year-end/README.md). The database decides everything (which year can
// close, what the close journal holds, who may act); these helpers only mirror its date rules for the screen, word the
// warnings and build the confirmation text. Dates are 'YYYY-MM-DD'; money is whole pence.
import { toPence } from '@/lib/ledger';
import { ukDate } from '@/lib/ledgerReports';

export interface ClosedYear { year_end: string; year_start: string; entry_id: string | null; profit: number | string }
export interface YearEndStatus {
  set_up: boolean;
  can_manage: boolean;
  start_date?: string | null;
  locked_through?: string | null;
  year_end_month?: number | null;
  year_end_day?: number | null;
  first_year_end?: string | null;
  closed_years?: ClosedYear[];
  next_year_end?: string | null;
  next_year_start?: string | null;
  can_close_now?: boolean;
  latest_closed?: string | null;
}
export interface YearEndPreviewLine { account_id: string; code: string; name: string; type: 'income' | 'expense'; is_active: boolean; debit: number | string; credit: number | string }
export interface YearEndWarnings { waiting: number; held: number; bank_unmatched: number }
export type YearEndProblem = 'already_closed' | 'out_of_order' | 'future' | 'inactive_account' | 'no_retained_earnings' | null;
export interface YearEndPreview {
  year_start: string;
  year_end: string;
  lock_date: string;
  lines: YearEndPreviewLine[];
  profit: number | string;
  retained_earnings: { debit: number | string; credit: number | string };
  warnings: YearEndWarnings;
  needs_acknowledgement: boolean;
  problem: YearEndProblem;
  can_manage: boolean;
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The most days a month can have as a year end (29 February means the last day of February). */
export const maxDay = (month: number) => (month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31);
export const validYearEnd = (month: number, day: number) =>
  Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= maxDay(month);
/** "31 March"; 29 February reads "29 February (28 February in other years)". */
export function yearEndLabel(month: number, day: number): string {
  const base = `${day} ${MONTHS[month - 1]}`;
  return month === 2 && day === 29 ? `${base} (28 February when it isn't a leap year)` : base;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const yearOf = (iso: string) => Number(iso.slice(0, 4));
/** The year end in a calendar year (29 February becomes 28 February outside leap years), as the database does. */
export function yearEndIn(year: number, month: number, day: number): string {
  const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
  return `${year}-${pad(month)}-${pad(d)}`;
}
/** The day after a date. */
export function dayAfter(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
/** The first year end after the books start: the first year can be shorter than twelve months. */
export function firstYearEnd(start: string, month: number, day: number): string {
  const same = yearEndIn(yearOf(start), month, day);
  return same > start ? same : yearEndIn(yearOf(start) + 1, month, day);
}
/** The year end after a given one. */
export const followingYearEnd = (ye: string, month: number, day: number) => yearEndIn(yearOf(ye) + 1, month, day);
/** When the financial year ending on ye starts (the start date for the first year). */
export function yearStartOf(ye: string, start: string, month: number, day: number): string {
  return ye === firstYearEnd(start, month, day) ? start : dayAfter(yearEndIn(yearOf(ye) - 1, month, day));
}
/** Days in a period, both ends included (to show how long the first year is). */
export function daysInPeriod(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
/** The financial year containing a date (the first year starts at the books' start date). */
export function financialYearOf(iso: string, start: string, month: number, day: number): { from: string; to: string } {
  let ye = firstYearEnd(start, month, day);
  if (iso > ye) {
    ye = yearEndIn(yearOf(iso), month, day);
    if (ye < iso) ye = yearEndIn(yearOf(iso) + 1, month, day);
  }
  return { from: yearStartOf(ye, start, month, day), to: ye };
}
/** "This financial year" and "Last financial year" for the Profit and loss quick choices (last is null in the first year). */
export function financialYearRanges(today: string, start: string, month: number, day: number) {
  const thisYear = financialYearOf(today, start, month, day);
  const prevEnd = yearEndIn(yearOf(thisYear.to) - 1, month, day);
  const lastYear = thisYear.from === start ? null : { from: yearStartOf(prevEnd, start, month, day), to: prevEnd };
  return { thisYear, lastYear };
}

/** Profit (positive) or loss (negative) in pence. */
export const profitPence = (p: Pick<YearEndPreview, 'profit'> | Pick<ClosedYear, 'profit'>) => toPence(String(p.profit));
export const warningCount = (w: YearEndWarnings | null | undefined) => (w ? (w.waiting ?? 0) + (w.held ?? 0) + (w.bank_unmatched ?? 0) : 0);

/** One plain sentence per kind of warning, each with its own acknowledgement box. */
export function warningTexts(w: YearEndWarnings): { key: keyof YearEndWarnings; text: string; ack: string }[] {
  const out: { key: keyof YearEndWarnings; text: string; ack: string }[] = [];
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (w.waiting > 0) out.push({ key: 'waiting', text: `${n(w.waiting, 'invoice, bill or expense dated in this year is', 'invoices, bills or expenses dated in this year are')} still waiting to be posted.`, ack: 'I understand these will not be in this year once it is closed.' });
  if (w.held > 0) out.push({ key: 'held', text: `${n(w.held, 'automatic posting for this year is', 'automatic postings for this year are')} held (see Automatic postings).`, ack: 'I understand held postings for this year will not be in it once it is closed.' });
  if (w.bank_unmatched > 0) out.push({ key: 'bank_unmatched', text: `${n(w.bank_unmatched, 'bank statement line in this year is', 'bank statement lines in this year are')} not matched or posted.`, ack: 'I understand unmatched bank lines in this year will stay outside it.' });
  return out;
}

export const PROBLEM_TEXT: Record<Exclude<YearEndProblem, null>, string> = {
  already_closed: 'This year is already closed.',
  out_of_order: 'Close the earlier year first. Years close in order.',
  future: "This year hasn't ended yet.",
  inactive_account: 'An inactive income or expense account has a balance in this year. Make it active again in Chart of accounts, then close the year.',
  no_retained_earnings: 'The Retained earnings account (3200) is missing or inactive.',
};

export const lockConfirmText = (ye: string) => `This locks the books through ${ukDate(ye)}. You can re-open the most recent year.`;
export const reopenConfirmText = (ye: string, prev: string | null) =>
  `Re-open the year ending ${ukDate(ye)}? The close journal is reversed on ${ukDate(ye)} and the books are ${prev ? `locked through ${ukDate(prev)} again` : 'no longer locked'}.`;
/** The lock after re-opening the most recent closed year: the year end before it, or none. */
export function lockAfterReopen(status: YearEndStatus): string | null {
  const closed = status.closed_years ?? [];
  return closed.length > 1 ? closed[closed.length - 2].year_end : null;
}

export const YEAR_END_EXPLAINED = 'Closing a year posts one journal on the year-end date that moves that year\'s income and spending to Retained earnings (3200), then locks the books through that date. Profit and loss still shows the year\'s real figures.';
export const TB_AFTER_CLOSE_NOTE = 'After a year is closed, the trial balance includes the year-end close journal, so income and expense accounts show nil at that year end.';
