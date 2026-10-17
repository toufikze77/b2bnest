/**
 * Invoices & quotes figures (Phase 2). Pure functions over the documents the page already loads.
 *
 * Rules
 * - Every money total is per stored currency and never converted (CurrencyTotals from dashboardWidgets).
 * - Revenue = paid invoices only. Quotes never count as revenue.
 * - "Overdue" is worked out here (due date before today, not paid/cancelled/draft) and never written back.
 * - Paid periods use `paid_at` (set by "Mark as paid", Phase 4). Invoices marked paid before that
 *   have no paid_at: they still count as paid revenue but are dated by invoice date (created_at),
 *   and pages say how many (`paidWithoutDate`). updated_at is never used as a paid date.
 * - Archived documents (archived_at set) are left out of everything (`activeOnly`).
 * - Expenses have no currency column: they are in the account currency.
 */
import { CurrencyTotals, sumByCurrency } from '@/lib/dashboardWidgets';
import { lastMonths, monthOf, toCsv } from '@/lib/crmAnalytics';
import { normalizeCurrency } from '@/lib/money';
import { addDaysIso, isoDay } from '@/lib/dashboardData';
import { activeOnly } from '@/lib/archive';

export interface FinDoc {
  id: string;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  created_at: string;
  client_name?: string | null;
  due_date?: string | null;
  /** When the invoice was marked paid; null for invoices marked paid before Phase 4. */
  paid_at?: string | null;
  archived_at?: string | null;
}
export interface FinExpense { amount: number | null; date: string | null }

/* ---------- Status vocabulary ---------- */

export type InvoiceChip = 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled';
export type QuoteChip = 'draft' | 'sent' | 'other';

export const CHIP_LABEL: Record<InvoiceChip | QuoteChip, string> = {
  draft: 'Draft', sent: 'Sent', overdue: 'Overdue', paid: 'Paid', cancelled: 'Cancelled', other: 'Other',
};

/**
 * Stored invoice status → chip:
 *   'paid' → Paid · 'cancelled' / 'canceled' / 'void' → Cancelled · 'draft' or empty → Draft ·
 *   'sent', 'pending', 'overdue' and anything else → Sent, which becomes Overdue when the due date
 *   is before today. A draft is never overdue (it was never sent).
 */
export function invoiceStatus(inv: Pick<FinDoc, 'status' | 'due_date'>, today: string = isoDay(new Date())): InvoiceChip {
  const s = (inv.status || '').trim().toLowerCase();
  if (s === 'paid') return 'paid';
  if (s === 'cancelled' || s === 'canceled' || s === 'void') return 'cancelled';
  if (s === '' || s === 'draft') return 'draft';
  const due = (inv.due_date || '').slice(0, 10);
  return due && due < today ? 'overdue' : 'sent';
}

/** Stored quote status → chip: 'draft' or empty → Draft · 'sent' → Sent · anything else → its own word (via statusLabel). */
export function quoteStatus(q: Pick<FinDoc, 'status'>): QuoteChip {
  const s = (q.status || '').trim().toLowerCase();
  if (s === '' || s === 'draft') return 'draft';
  if (s === 'sent') return 'sent';
  return 'other';
}

/* ---------- Summary ---------- */

const inMonth = (iso: string | null | undefined, key: string) => monthOf(iso) === key;
const dayOf = (iso: string | null | undefined) => (iso ? (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : isoDay(new Date(iso))) : null);
const money = (docs: FinDoc[]) => sumByCurrency(docs, (d) => d.total_amount, (d) => d.currency);

/** The date a paid invoice counts on: its paid date, or its invoice date if none was recorded. */
export const paidDateOf = (d: Pick<FinDoc, 'paid_at' | 'created_at'>) => d.paid_at || d.created_at;

/** Paid invoices with no paid date recorded (dated by invoice date). Archived ones are not counted. */
export function paidWithoutDate(invoices: FinDoc[], today: string = isoDay(new Date())) {
  return activeOnly(invoices).filter((d) => invoiceStatus(d, today) === 'paid' && !d.paid_at).length;
}
/** "2 paid invoices have no paid date recorded (dated by invoice date)", or null. */
export function paidWithoutDateNote(n: number): string | null {
  if (!n) return null;
  return `${n} paid ${n === 1 ? 'invoice has' : 'invoices have'} no paid date recorded (dated by invoice date).`;
}

export function financeSummary(allInvoices: FinDoc[], allQuotes: FinDoc[], expenses: FinExpense[], now = new Date()) {
  const invoices = activeOnly(allInvoices);
  const quotes = activeOnly(allQuotes);
  const today = isoDay(now);
  const thisMonth = today.slice(0, 7);
  const from30 = addDaysIso(today, -29);
  const withChip = invoices.map((d) => ({ d, chip: invoiceStatus(d, today) }));
  const pick = (...chips: InvoiceChip[]) => withChip.filter((x) => chips.includes(x.chip)).map((x) => x.d);
  const paid = pick('paid');
  const paid30 = paid.filter((d) => { const day = dayOf(paidDateOf(d)); return !!day && day >= from30 && day <= today; });
  const openQuotes = quotes.filter((q) => quoteStatus(q) !== 'other');
  const outThisMonth = expenses.filter((e) => inMonth(e.date, thisMonth));
  return {
    outstanding: money(pick('sent', 'overdue')),
    overdue: money(pick('overdue')),
    paidLast30: money(paid30),
    paidThisMonth: money(paid.filter((d) => inMonth(paidDateOf(d), thisMonth))),
    paidWithoutDate: paid.filter((d) => !d.paid_at).length,
    revenue: money(paid),
    drafts: money(pick('draft')),
    quotesOpen: money(openQuotes),
    moneyOutThisMonth: { amount: outThisMonth.reduce((n, e) => n + (Number(e.amount) || 0), 0), count: outThisMonth.length },
    moneyOutTotal: expenses.reduce((n, e) => n + (Number(e.amount) || 0), 0),
  };
}

export const countOf = (t: CurrencyTotals) => t.reduce((n, x) => n + x.count, 0);

/** Overdue invoices, oldest due date first. */
export function needsAttention<D extends FinDoc>(invoices: D[], today: string = isoDay(new Date())) {
  return activeOnly(invoices).filter((d) => invoiceStatus(d, today) === 'overdue')
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
}

/** Newest quotes and invoices together, newest first. */
export function recentDocuments<Q extends FinDoc, I extends FinDoc>(quotes: Q[], invoices: I[], limit = 6) {
  return [...activeOnly(quotes).map((d) => ({ kind: 'quote' as const, doc: d })), ...activeOnly(invoices).map((d) => ({ kind: 'invoice' as const, doc: d }))]
    .sort((a, b) => b.doc.created_at.localeCompare(a.doc.created_at))
    .slice(0, limit);
}

/* ---------- Analytics ---------- */

/** Documents stored in `currency`, and a count of the rest per stored currency ('' = not set). */
export function splitByCurrency<D extends { currency: string | null }>(docs: D[], currency: string) {
  const cur = normalizeCurrency(currency);
  const included: D[] = [];
  const other = new Map<string, number>();
  for (const d of docs) {
    const c = normalizeCurrency(d.currency);
    if (cur && c === cur) included.push(d); else other.set(c, (other.get(c) ?? 0) + 1);
  }
  return { included, excluded: [...other.entries()].map(([c, count]) => ({ currency: c, count })).sort((a, b) => b.count - a.count) };
}

/** "1 invoice in USD is not included…" or null. */
export function excludedDocsNote(excluded: { currency: string; count: number }[], noun = 'invoice'): string | null {
  if (!excluded.length) return null;
  const parts = excluded.map(({ currency, count }) => `${count} ${count === 1 ? noun : `${noun}s`} ${currency ? `in ${currency}` : 'with no currency set'}`);
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const total = excluded.reduce((n, e) => n + e.count, 0);
  return `${text} ${total === 1 ? 'is' : 'are'} not included, because there is no exchange-rate data and nothing is converted.`;
}

/**
 * Per month in one currency: invoiced (sent, overdue or paid) by invoice date, and paid by paid date
 * (invoice date when no paid date was recorded).
 */
export function monthlyInvoicedPaid(invoices: FinDoc[], currency: string, months: number, now = new Date()) {
  const today = isoDay(now);
  const { included, excluded } = splitByCurrency(activeOnly(invoices), currency);
  const rows = lastMonths(months, now).map((m) => ({ ...m, invoiced: 0, paid: 0, invoicedCount: 0, paidCount: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const d of included) {
    const chip = invoiceStatus(d, today);
    if (chip === 'draft' || chip === 'cancelled') continue;
    const v = Number(d.total_amount) || 0;
    const r = byKey.get(monthOf(d.created_at) || '');
    if (r) { r.invoiced += v; r.invoicedCount++; }
    const p = chip === 'paid' ? byKey.get(monthOf(paidDateOf(d)) || '') : undefined;
    if (p) { p.paid += v; p.paidCount++; }
  }
  return { rows, excluded };
}

/** Count of invoices per chip, for the status donut (largest first, empty chips left out). */
export function statusCounts(allInvoices: FinDoc[], today: string = isoDay(new Date())) {
  const invoices = activeOnly(allInvoices);
  const order: InvoiceChip[] = ['draft', 'sent', 'overdue', 'paid', 'cancelled'];
  const counts = new Map<InvoiceChip, number>();
  for (const d of invoices) { const c = invoiceStatus(d, today); counts.set(c, (counts.get(c) ?? 0) + 1); }
  return order.filter((c) => counts.get(c)).map((c) => ({ chip: c, label: CHIP_LABEL[c], count: counts.get(c)! }))
    .sort((a, b) => b.count - a.count);
}

/** Customers ranked by invoiced amount (sent, overdue or paid) in one currency. Names grouped ignoring case and spaces. */
export function topCustomers(invoices: FinDoc[], currency: string, limit = 5, today: string = isoDay(new Date())) {
  const { included } = splitByCurrency(activeOnly(invoices), currency);
  const m = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of included) {
    const chip = invoiceStatus(d, today);
    if (chip === 'draft' || chip === 'cancelled') continue;
    const name = (d.client_name || '').trim() || 'No client name';
    const key = name.toLowerCase();
    const cur = m.get(key) ?? { name, amount: 0, count: 0 };
    cur.amount += Number(d.total_amount) || 0; cur.count++;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, limit);
}

/**
 * Paid invoices in the account currency minus all expenses (expenses are in the account currency).
 * Not an accounting profit: no tax, no accruals, nothing in other currencies.
 */
export function moneyInMinusOut(invoices: FinDoc[], expenses: FinExpense[], account: string, today: string = isoDay(new Date())) {
  const cur = normalizeCurrency(account);
  if (!cur) return null;
  const paid = activeOnly(invoices).filter((d) => invoiceStatus(d, today) === 'paid');
  const { included, excluded } = splitByCurrency(paid, cur);
  const moneyIn = included.reduce((n, d) => n + (Number(d.total_amount) || 0), 0);
  const moneyOut = expenses.reduce((n, e) => n + (Number(e.amount) || 0), 0);
  return { currency: cur, moneyIn, moneyOut, net: moneyIn - moneyOut, excluded };
}

/* ---------- Report CSV ---------- */

/** The CSV for one currency: documents stored in `currency`; expenses only when it is the account currency. */
export function financeReportCsvFor(invoices: FinDoc[], quotes: FinDoc[], expenses: FinExpense[], currency: string, account: string, now = new Date()) {
  const cur = normalizeCurrency(currency);
  const isAccount = !!cur && cur === normalizeCurrency(account);
  const only = (docs: FinDoc[]) => docs.filter((d) => normalizeCurrency(d.currency) === cur);
  return financeReportCsv(only(invoices), only(quotes), expenses, cur, now, { expenses: isAccount, currency: cur || 'Not set' });
}

export function financeReportCsv(invoices: FinDoc[], quotes: FinDoc[], expenses: FinExpense[], account: string, now = new Date(), opts: { expenses?: boolean; currency?: string } = {}) {
  const s = financeSummary(invoices, quotes, expenses, now);
  const rows: (string | number)[][] = [['Metric', 'Currency', 'Amount', 'Count', 'Note']];
  const add = (metric: string, totals: CurrencyTotals, note = '') => {
    if (!totals.length) rows.push([metric, opts.currency ?? '', 0, 0, note]);
    for (const t of totals) rows.push([metric, t.currency || 'Not set', Math.round(t.amount * 100) / 100, t.count, note]);
  };
  add('Outstanding (sent and overdue invoices)', s.outstanding);
  add('Overdue invoices', s.overdue, 'Due date before today, not paid');
  add('Paid invoices, all time', s.revenue, 'Revenue = paid invoices only');
  add('Paid invoices, last 30 days', s.paidLast30, 'By paid date (invoice date if none recorded)');
  add('Draft invoices', s.drafts);
  add('Open quotes (draft or sent)', s.quotesOpen, 'Quotes are not revenue');
  if (opts.expenses !== false) {
    rows.push(['Money out this month (expenses)', normalizeCurrency(account) || 'Account currency', Math.round(s.moneyOutThisMonth.amount * 100) / 100, s.moneyOutThisMonth.count, 'Expenses have no currency of their own']);
    const mm = moneyInMinusOut(invoices, expenses, account, isoDay(now));
    if (mm) rows.push(['Money in minus money out (rough)', mm.currency, Math.round(mm.net * 100) / 100, '', `Paid ${mm.currency} invoices minus all expenses; not an accounting profit${mm.excluded.length ? '; other currencies excluded' : ''}`]);
  }
  if (s.paidWithoutDate) rows.push(['Paid invoices with no paid date recorded', '', '', s.paidWithoutDate, 'Dated by invoice date']);
  for (const c of statusCounts(invoices, isoDay(now))) rows.push([`Invoices: ${c.label}`, '', '', c.count, '']);
  return toCsv(rows);
}
