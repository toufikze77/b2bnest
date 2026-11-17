// Finance phase 4: reports from the ledger (docs/ledger-reports/README.md). Pure functions, no I/O: grouping, totals in
// whole pence (never floats), quick date ranges (UK tax year 6 April to 5 April), CSV text, and the completeness wording.
// The figures come from the ledger_report_* functions, which read the ledger only.
import { formatPence, LEDGER_DISCLAIMER, penceToDecimal, toPence, type LedgerAccount } from '@/lib/ledger';

export interface PlRow { account_id: string; code: string; name: string; type: 'income' | 'expense'; is_active?: boolean; amount: number | string }
export interface BsRow { account_id: string | null; code: string; name: string; type: 'asset' | 'liability' | 'equity'; is_active?: boolean; balance: number | string; balanced?: boolean }
export interface DetailRow {
  entry_id: string; entry_date: string; source_type: string; source_label: string | null; memo: string | null; description: string | null;
  line_no: number; debit: number | string; credit: number | string; balance: number | string;
}
export interface AccountDetail {
  account: { id: string; code: string; name: string; type: string; normal_side: 'debit' | 'credit'; is_active: boolean };
  from: string; to: string; opening_balance: number | string; closing_balance: number | string; total_debit: number | string; total_credit: number | string;
  line_count: number; truncated: boolean; rows: DetailRow[];
}
export interface Completeness {
  set_up: boolean; start_date: string | null; locked_through: string | null; invoices_auto_on: boolean; bills_auto_on: boolean;
  waiting: number; open_issues: number; last_posting_at: string | null; bank_unmatched: number;
}

export type ReportView = 'profit-loss' | 'balance-sheet' | 'account';
export const REPORT_VIEWS: ReportView[] = ['profit-loss', 'balance-sheet', 'account'];
export const REPORT_VIEW_LABELS: Record<ReportView, string> = { 'profit-loss': 'Profit and loss', 'balance-sheet': 'Balance sheet', account: 'Account detail' };
export const PL_ROW_CODE = 'PL';
export const PL_ROW_EXPLAINED = 'There is no year-end close yet, so the profit or loss made since your books started is shown here, as part of equity. It is what makes the balance sheet balance.';
export const REPORTS_EMPTY = 'No postings in this period yet.';
export const BS_AGREE = 'Assets and liabilities agree.';
export const BS_DISAGREE = "Assets and liabilities don't agree. Please tell us at info@b2bnest.online.";
export const DETAIL_TRUNCATED = 'This period has more than 2,000 lines, so only the first 2,000 are shown. Choose a shorter period to see the rest. The totals cover the whole period.';

// ------------------------------------------------------------------ dates

/** dd/mm/yyyy from 'YYYY-MM-DD' (UK order, as on screen and in the CSV files). */
export function ukDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
const isoOf = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];

/** The UK tax year (6 April to 5 April) that contains the date. */
export function taxYearOf(iso: string): { from: string; to: string } {
  const [y, m, d] = parts(iso);
  const start = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return { from: isoOf(start, 4, 6), to: isoOf(start + 1, 4, 5) };
}

export type QuickRange = 'this-month' | 'last-month' | 'this-quarter' | 'this-tax-year' | 'last-tax-year' | 'since-start';
export const QUICK_RANGE_LABELS: Record<QuickRange, string> = {
  'this-month': 'This month', 'last-month': 'Last month', 'this-quarter': 'This quarter', 'this-tax-year': 'This tax year',
  'last-tax-year': 'Last tax year', 'since-start': 'Since the books started',
};
/** The dates of a quick choice, as at "today". Quarters are calendar quarters (Jan–Mar, Apr–Jun, …). */
export function quickRange(q: QuickRange, today: string, startDate: string | null): { from: string; to: string } {
  const [y, m] = parts(today);
  switch (q) {
    case 'this-month': return { from: isoOf(y, m, 1), to: isoOf(y, m + 1, 0) };
    case 'last-month': return { from: isoOf(y, m - 1, 1), to: isoOf(y, m, 0) };
    case 'this-quarter': { const s = Math.floor((m - 1) / 3) * 3 + 1; return { from: isoOf(y, s, 1), to: isoOf(y, s + 3, 0) }; }
    case 'this-tax-year': return taxYearOf(today);
    case 'last-tax-year': { const t = taxYearOf(today); const [ty] = parts(t.from); return { from: isoOf(ty - 1, 4, 6), to: isoOf(ty, 4, 5) }; }
    case 'since-start': return { from: startDate ?? isoOf(y, 1, 1), to: today };
  }
}
/** The ledger refuses ranges longer than 5 years (LEDGER_BAD_RANGE); the screen checks first. */
export function rangeProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'The start date is after the end date.';
  const [y, m, d] = parts(from);
  if (to >= isoOf(y + 5, m, d)) return 'Choose a period of 5 years or less.';
  return null;
}
export const startsBeforeBooks = (from: string, startDate: string | null) => !!startDate && from < startDate;
export const beforeBooksText = (startDate: string) => `Your books start on ${ukDate(startDate)}, so earlier figures are not included.`;

// ------------------------------------------------------------------ grouping (whole pence)

/** Leading digits of an account code as a number ('0010' -> 10); codes without digits sort last. */
const codeNumber = (code: string) => { const m = /^\d+/.exec(code); return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER; };
export interface Line { account_id: string | null; code: string; name: string; pence: number; is_active?: boolean }
const sum = (xs: Line[]) => xs.reduce((s, x) => s + x.pence, 0);
const byCode = (a: Line, b: Line) => a.code.localeCompare(b.code, 'en', { numeric: true });

export interface ProfitLoss {
  sales: Line[]; otherIncome: Line[]; costOfSales: Line[]; overheads: Line[];
  totalSales: number; totalOtherIncome: number; totalIncome: number; totalCostOfSales: number; grossProfit: number; totalOverheads: number; net: number;
}
/** Income: Sales (4xxx except 49xx) and Other income (49xx, or any income account outside 4xxx). Cost of sales: expense 5xxx.
 * Overheads: every other expense account. With showEmpty, the chart's active income and expense accounts with no activity
 * are added at 0.00. */
export function groupProfitLoss(rows: PlRow[], chart: LedgerAccount[] = [], showEmpty = false): ProfitLoss {
  const lines = rows.map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, type: r.type, is_active: r.is_active, pence: toPence(r.amount) }));
  if (showEmpty) {
    for (const a of chart) {
      if ((a.type === 'income' || a.type === 'expense') && a.is_active && !lines.some((l) => l.account_id === a.id)) {
        lines.push({ account_id: a.id, code: a.code, name: a.name, type: a.type, is_active: true, pence: 0 });
      }
    }
  }
  const income = lines.filter((l) => l.type === 'income');
  const expense = lines.filter((l) => l.type === 'expense');
  const isOther = (c: string) => !c.startsWith('4') || c.startsWith('49');
  const sales = income.filter((l) => !isOther(l.code)).sort(byCode);
  const otherIncome = income.filter((l) => isOther(l.code)).sort(byCode);
  const costOfSales = expense.filter((l) => l.code.startsWith('5')).sort(byCode);
  const overheads = expense.filter((l) => !l.code.startsWith('5')).sort(byCode);
  const totalSales = sum(sales); const totalOtherIncome = sum(otherIncome); const totalCostOfSales = sum(costOfSales); const totalOverheads = sum(overheads);
  const totalIncome = totalSales + totalOtherIncome;
  const grossProfit = totalIncome - totalCostOfSales;
  return { sales, otherIncome, costOfSales, overheads, totalSales, totalOtherIncome, totalIncome, totalCostOfSales, grossProfit, totalOverheads, net: grossProfit - totalOverheads };
}

export interface BalanceSheet {
  fixedAssets: Line[]; currentAssets: Line[]; liabilities: Line[]; equity: Line[];
  totalFixed: number; totalCurrent: number; totalAssets: number; totalLiabilities: number; netAssets: number; totalEquity: number; balanced: boolean;
}
/** Fixed assets: asset accounts with a code below 1000. Current assets: the other assets. Liabilities: every liability
 * account (all current in the standard chart). Equity: equity accounts and the PL row (last). */
export function groupBalanceSheet(rows: BsRow[]): BalanceSheet {
  const lines = rows.map((r) => ({ account_id: r.account_id, code: r.code, name: r.name, type: r.type, is_active: r.is_active, pence: toPence(r.balance) }));
  const assets = lines.filter((l) => l.type === 'asset');
  const fixedAssets = assets.filter((l) => codeNumber(l.code) < 1000).sort(byCode);
  const currentAssets = assets.filter((l) => codeNumber(l.code) >= 1000).sort(byCode);
  const liabilities = lines.filter((l) => l.type === 'liability').sort(byCode);
  const equity = [...lines.filter((l) => l.type === 'equity' && l.code !== PL_ROW_CODE).sort(byCode), ...lines.filter((l) => l.code === PL_ROW_CODE)];
  const totalFixed = sum(fixedAssets); const totalCurrent = sum(currentAssets); const totalLiabilities = sum(liabilities); const totalEquity = sum(equity);
  const totalAssets = totalFixed + totalCurrent;
  const netAssets = totalAssets - totalLiabilities;
  const serverBalanced = rows.every((r) => r.balanced !== false);
  return { fixedAssets, currentAssets, liabilities, equity, totalFixed, totalCurrent, totalAssets, totalLiabilities, netAssets, totalEquity,
    balanced: serverBalanced && netAssets === totalEquity };
}

/** "Net profit" / "Net loss" etc.: a plain word, never colour alone. */
export const profitWord = (pence: number, profit = 'Net profit', loss = 'Net loss') => (pence < 0 ? loss : profit);
export const money = (pence: number) => formatPence(pence);

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual journal', opening_balance: 'Opening balance', reversal: 'Reversal', auto_invoice: 'Invoice', auto_invoice_payment: 'Invoice payment',
  auto_bill: 'Bill', auto_bill_payment: 'Bill payment', auto_expense: 'Expense', bank_line: 'Bank statement line',
};
/** "Invoice INV-12", "Manual journal", "Reversal". */
export const sourceText = (r: Pick<DetailRow, 'source_type' | 'source_label'>) =>
  `${SOURCE_TYPE_LABELS[r.source_type] ?? 'Journal'}${r.source_label ? ` ${r.source_label}` : ''}`;

// ------------------------------------------------------------------ CSV

/** A text cell: quoted when needed, and a leading apostrophe on anything a spreadsheet would run as a formula. */
export function csvText(v: string | null | undefined): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
/** A money cell: a plain number with two decimals ("-1234.56"), no £, no thousands separator. */
export const csvMoney = (pence: number) => penceToDecimal(pence);

/** UTF-8 BOM, a title line, the disclaimer, a blank line, then the table. */
export function buildCsv(title: string, header: string[], rows: string[][]): string {
  const lines = [csvText(title), csvText(LEDGER_DISCLAIMER), '', header.map(csvText).join(','), ...rows.map((r) => r.join(','))];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function profitLossCsv(pl: ProfitLoss, from: string, to: string): string {
  const rows: string[][] = [];
  const section = (name: string, xs: Line[], totalName: string, total: number) => {
    xs.forEach((l) => rows.push([csvText(name), csvText(l.code), csvText(l.name), csvMoney(l.pence)]));
    rows.push([csvText(name), '', csvText(totalName), csvMoney(total)]);
  };
  section('Income', pl.sales, 'Total sales', pl.totalSales);
  section('Income', pl.otherIncome, 'Total other income', pl.totalOtherIncome);
  section('Cost of sales', pl.costOfSales, 'Total cost of sales', pl.totalCostOfSales);
  rows.push(['', '', csvText(profitWord(pl.grossProfit, 'Gross profit', 'Gross loss')), csvMoney(pl.grossProfit)]);
  section('Overheads', pl.overheads, 'Total overheads', pl.totalOverheads);
  rows.push(['', '', csvText(`${profitWord(pl.net)} for the period`), csvMoney(pl.net)]);
  return buildCsv(`Profit and loss ${ukDate(from)} to ${ukDate(to)}`, ['Section', 'Code', 'Account', 'Amount (GBP)'], rows);
}

export function balanceSheetCsv(bs: BalanceSheet, asOf: string): string {
  const rows: string[][] = [];
  const section = (name: string, xs: Line[], totalName: string, total: number) => {
    xs.forEach((l) => rows.push([csvText(name), csvText(l.code === PL_ROW_CODE ? '' : l.code), csvText(l.name), csvMoney(l.pence)]));
    rows.push([csvText(name), '', csvText(totalName), csvMoney(total)]);
  };
  section('Fixed assets', bs.fixedAssets, 'Total fixed assets', bs.totalFixed);
  section('Current assets', bs.currentAssets, 'Total current assets', bs.totalCurrent);
  section('Current liabilities', bs.liabilities, 'Total current liabilities', bs.totalLiabilities);
  rows.push(['', '', csvText('Net assets'), csvMoney(bs.netAssets)]);
  section('Equity', bs.equity, 'Total equity', bs.totalEquity);
  return buildCsv(`Balance sheet as at ${ukDate(asOf)}`, ['Section', 'Code', 'Account', 'Balance (GBP)'], rows);
}

export function accountDetailCsv(d: AccountDetail): string {
  const rows: string[][] = [[csvText(ukDate(d.from)), csvText('Opening balance'), '', '', '', csvMoney(toPence(d.opening_balance))]];
  d.rows.forEach((r) => rows.push([csvText(ukDate(r.entry_date)), csvText(sourceText(r)), csvText(r.description || r.memo || ''),
    csvMoney(toPence(r.debit)), csvMoney(toPence(r.credit)), csvMoney(toPence(r.balance))]));
  rows.push([csvText(ukDate(d.to)), csvText('Closing balance'), '', csvMoney(toPence(d.total_debit)), csvMoney(toPence(d.total_credit)), csvMoney(toPence(d.closing_balance))]);
  return buildCsv(`Account ${d.account.code} ${d.account.name}, ${ukDate(d.from)} to ${ukDate(d.to)}`, ['Date', 'Source', 'Description', 'Debit', 'Credit', 'Balance'], rows);
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, '-');
export const profitLossFileName = (from: string, to: string) => `profit-and-loss-${from}-to-${to}.csv`;
export const balanceSheetFileName = (asOf: string) => `balance-sheet-${asOf}.csv`;
export const accountFileName = (code: string, from: string, to: string) => `account-${safe(code)}-${from}-to-${to}.csv`;

// ------------------------------------------------------------------ completeness

export interface CompletenessNote { text: string; link: 'automatic' | 'bank' }
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Plain notes on what may be missing from the figures. Never blocks a report. */
export function completenessNotes(c: Completeness | null): CompletenessNote[] {
  if (!c) return [];
  const out: CompletenessNote[] = [];
  if (!c.invoices_auto_on) out.push({ link: 'automatic', text: "Invoices are not posted to the ledger automatically for this company, so sales shown here only include what you've posted. Turn it on under Automatic postings." });
  if (!c.bills_auto_on) out.push({ link: 'automatic', text: "Bills and expenses are not posted to the ledger automatically for this company, so costs shown here only include what you've posted. Turn it on under Automatic postings." });
  if (c.waiting > 0) out.push({ link: 'automatic', text: `${plural(c.waiting, 'record is', 'records are')} waiting to be posted. They post within a few minutes, or you can post them now under Automatic postings.` });
  if (c.open_issues > 0) out.push({ link: 'automatic', text: `${plural(c.open_issues, 'record is', 'records are')} held and not in the ledger yet (for example, VAT details missing). See Automatic postings.` });
  if (c.bank_unmatched > 0) out.push({ link: 'bank', text: `${plural(c.bank_unmatched, 'bank statement line doesn\'t', 'bank statement lines don\'t')} match anything in the ledger yet, so some money in or out may not be shown here. See Bank.` });
  return out;
}

// ------------------------------------------------------------------ URL (?ledger=reports&report=…)

export interface ReportParams { view: ReportView; from?: string; to?: string; asOf?: string; account?: string }
export function reportParamsFromSearch(search: string): ReportParams {
  const p = new URLSearchParams(search);
  const v = p.get('report') as ReportView | null;
  const iso = (k: string) => { const x = p.get(k); return x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : undefined; };
  return { view: v && REPORT_VIEWS.includes(v) ? v : 'profit-loss', from: iso('from'), to: iso('to'), asOf: iso('as_of'), account: p.get('account') ?? undefined };
}
/** The query string for a report; every other param (tab=, ledger=, …) is kept. */
export function searchWithReport(search: string, r: ReportParams): string {
  const p = new URLSearchParams(search);
  p.set('ledger', 'reports'); p.set('report', r.view);
  for (const [k, v] of [['from', r.from], ['to', r.to], ['as_of', r.asOf], ['account', r.account]] as const) { if (v) p.set(k, v); else p.delete(k); }
  return p.toString();
}
