/**
 * Business overview (Phase 4). Pure functions over records the page loads; nothing is estimated.
 *
 * Scope: money (invoices, expenses) and CRM (deals, contacts) are the signed-in user's own
 * records; projects and tasks are company-wide for the active organisation. No number mixes the two.
 * Money is per currency and never converted. Revenue = paid invoices only (never quotes), dated by
 * paid date (invoice date if none was recorded). Overdue uses the shared invoice status helper.
 * Archived invoices are left out. Expenses have no currency: they are in the account currency.
 * The `bills` table is not read: nothing in the app writes to it (Phase 4c); money to pay out is unpaid expenses.
 */
import { activeOnly } from '@/lib/archive';
import { CLOSED_PROJECT_STATUSES, isOpen, isoDay } from '@/lib/dashboardData';
import { isClosedStage } from '@/lib/dashboardWidgets';
import { lastMonths, monthOf } from '@/lib/crmAnalytics';
import { stageKey } from '@/lib/dealBoard';
import { FinDoc, invoiceStatus, paidDateOf, splitByCurrency, statusCounts, topCustomers } from '@/lib/financeSummary';
import { normalizeCurrency } from '@/lib/money';
import { statusLabel } from '@/components/data/StatusBadge';

/** Expense status: 'pending' (database default), 'approved' or 'paid'. A missing status is treated as pending, as on the Expenses tab. */
export interface OvExpense { amount: number | string | null; date: string | null; status?: string | null }
export interface OvDeal { stage: string | null; value: number | string | null; currency: string | null }
export interface OvContact { status: string | null; created_at: string | null }
export interface OvProject { status: string | null }
export interface OvTask { status: string | null; due_date: string | null }

/* ---------- Period ---------- */

export type Period = 'month' | '30d' | 'quarter' | 'year' | 'all';
export const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];
const pad = (n: number) => String(n).padStart(2, '0');

/** First day of the period (YYYY-MM-DD, local calendar) and today; `from` is null for All time. */
export function periodRange(period: Period, now = new Date()): { from: string | null; to: string } {
  const to = isoDay(now);
  const y = now.getFullYear(), m = now.getMonth();
  switch (period) {
    case 'month': return { from: `${y}-${pad(m + 1)}-01`, to };
    case '30d': { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: isoDay(d), to }; }
    case 'quarter': return { from: `${y}-${pad(Math.floor(m / 3) * 3 + 1)}-01`, to };
    case 'year': return { from: `${y}-01-01`, to };
    default: return { from: null, to };
  }
}
const dayOf = (v: string | null | undefined) => (!v ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : isoDay(new Date(v)));
export const inRange = (v: string | null | undefined, r: { from: string | null; to: string }) => {
  const d = dayOf(v);
  return !!d && (!r.from || d >= r.from) && d <= r.to;
};
/** Months shown in the money chart for a period: 12 for This year and All time, otherwise 6. */
export const chartMonths = (p: Period) => (p === 'year' || p === 'all' ? 12 : 6);

/* ---------- Cards ---------- */

const num = (v: number | string | null | undefined) => Number(v) || 0;
const sum = <T>(rows: T[], f: (r: T) => number | string | null | undefined) => Math.round(rows.reduce((n, r) => n + num(f(r)), 0) * 100) / 100;

export interface OverviewInput {
  invoices: FinDoc[]; expenses: OvExpense[]; deals: OvDeal[];
  contacts: OvContact[]; projects: OvProject[]; tasks: OvTask[];
}

/**
 * Headline figures for one currency and period.
 * - moneyIn: paid invoices whose paid date (or invoice date) falls in the period.
 * - moneyOut: expenses dated in the period, only when the chosen currency is the account currency
 *   (expenses have no currency of their own); null otherwise.
 * - expensesToPay: every expense not marked paid (pending or approved), as of today, not period-based;
 *   account currency only, like moneyOut; null otherwise.
 * - outstanding / overdue / openPipeline / tasks / projects / contacts: as of today.
 */
export function overviewCards(input: OverviewInput, currency: string, account: string, period: Period, now = new Date()) {
  const today = isoDay(now);
  const range = periodRange(period, now);
  const cur = normalizeCurrency(currency);
  const invoices = activeOnly(input.invoices);
  const { included, excluded } = splitByCurrency(invoices, cur);
  const chip = (d: FinDoc) => invoiceStatus(d, today);
  const paid = included.filter((d) => chip(d) === 'paid' && inRange(paidDateOf(d), range));
  const open = included.filter((d) => chip(d) === 'sent' || chip(d) === 'overdue');
  const overdue = included.filter((d) => chip(d) === 'overdue');
  const inAccount = !!cur && cur === normalizeCurrency(account);
  const expensesHere = inAccount ? input.expenses.filter((e) => inRange(e.date, range)) : null;
  const unpaidExpenses = inAccount ? input.expenses.filter((e) => (e.status || 'pending').toLowerCase() !== 'paid') : null;
  const deals = input.deals.filter((d) => !isClosedStage(d.stage) && normalizeCurrency(d.currency) === cur);
  const openTasks = input.tasks.filter((t) => isOpen(t.status || ''));
  return {
    moneyIn: { amount: sum(paid, (d) => d.total_amount), count: paid.length },
    moneyOut: expensesHere ? { amount: sum(expensesHere, (e) => e.amount), count: expensesHere.length } : null,
    outstanding: { amount: sum(open, (d) => d.total_amount), count: open.length },
    overdue: { amount: sum(overdue, (d) => d.total_amount), count: overdue.length },
    openPipeline: { amount: sum(deals, (d) => d.value), count: deals.length },
    expensesToPay: unpaidExpenses ? { amount: sum(unpaidExpenses, (e) => e.amount), count: unpaidExpenses.length } : null,
    openTasks: openTasks.length,
    overdueTasks: openTasks.filter((t) => { const d = dayOf(t.due_date); return !!d && d < today; }).length,
    activeProjects: input.projects.filter((p) => !CLOSED_PROJECT_STATUSES.includes((p.status || '').toLowerCase())).length,
    contacts: input.contacts.length,
    /** Invoices in other currencies, left out of every money card. */
    excludedInvoices: excluded,
    otherCurrencyDeals: input.deals.filter((d) => !isClosedStage(d.stage) && normalizeCurrency(d.currency) !== cur).length,
  };
}

/** Where each card goes. Every card opens the screen that manages its records. */
export const CARD_LINKS = {
  moneyIn: { to: '/business-tools?tool=business-finance-assistant&tab=invoices', place: 'Invoices' },
  outstanding: { to: '/business-tools?tool=business-finance-assistant&tab=invoices', place: 'Invoices' },
  overdue: { to: '/business-tools?tool=business-finance-assistant&tab=invoices', place: 'Invoices' },
  moneyOut: { to: '/business-tools?tool=business-finance-assistant&tab=expenses', place: 'Expenses' },
  openPipeline: { to: '/crm?tab=deals', place: 'the CRM sales pipeline' },
  contacts: { to: '/crm', place: 'CRM contacts' },
  activeProjects: { to: '/project-management', place: 'Projects' },
  openTasks: { to: '/project-management?view=list', place: 'Tasks' },
  expensesToPay: { to: '/business-tools?tool=business-finance-assistant&tab=expenses', place: 'Expenses' },
} as const;

/* ---------- Sections ---------- */

/** Money in (paid invoices by paid date) and money out (expenses by date) per month, one currency. */
export function moneyInOutByMonth(input: Pick<OverviewInput, 'invoices' | 'expenses'>, currency: string, account: string, months: number, now = new Date()) {
  const today = isoDay(now);
  const cur = normalizeCurrency(currency);
  const withOut = !!cur && cur === normalizeCurrency(account);
  const rows = lastMonths(months, now).map((m) => ({ ...m, moneyIn: 0, moneyOut: withOut ? 0 : null as number | null }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const { included, excluded } = splitByCurrency(activeOnly(input.invoices), cur);
  for (const d of included) {
    if (invoiceStatus(d, today) !== 'paid') continue;
    const r = byKey.get(monthOf(paidDateOf(d)) || '');
    if (r) r.moneyIn = Math.round((r.moneyIn + num(d.total_amount)) * 100) / 100;
  }
  if (withOut) {
    for (const e of input.expenses) {
      const r = byKey.get(monthOf(e.date) || '');
      if (r) r.moneyOut = Math.round(((r.moneyOut ?? 0) + num(e.amount)) * 100) / 100;
    }
  }
  return { rows, excluded, expensesIncluded: withOut };
}

/** Invoice status counts for invoices dated in the period (all currencies; counts, not amounts). */
export function invoiceStatusInPeriod(invoices: FinDoc[], period: Period, now = new Date()) {
  const range = periodRange(period, now);
  return statusCounts(activeOnly(invoices).filter((d) => inRange(d.created_at, range)), isoDay(now));
}

/** Open deals by stage in one currency (won, lost and closed stages are left out). */
export function pipelineByStage(deals: OvDeal[], currency: string) {
  const cur = normalizeCurrency(currency);
  const m = new Map<string, { stage: string; value: number; count: number }>();
  let otherCurrency = 0;
  for (const d of deals) {
    if (isClosedStage(d.stage)) continue;
    if (normalizeCurrency(d.currency) !== cur) { otherCurrency++; continue; }
    const key = stageKey(d.stage) || 'no stage';
    const g = m.get(key) ?? { stage: d.stage ? statusLabel(d.stage) : 'No stage', value: 0, count: 0 };
    g.value = Math.round((g.value + num(d.value)) * 100) / 100; g.count++;
    m.set(key, g);
  }
  return { rows: [...m.values()].sort((a, b) => b.value - a.value || b.count - a.count), otherCurrency };
}

/** Tasks per status (company-wide) and how many open ones are past their due date. */
export function tasksByStatus(tasks: OvTask[], now = new Date()) {
  const today = isoDay(now);
  const m = new Map<string, number>();
  for (const t of tasks) { const s = statusLabel(t.status || 'todo'); m.set(s, (m.get(s) ?? 0) + 1); }
  const overdue = tasks.filter((t) => isOpen(t.status || '') && !!dayOf(t.due_date) && dayOf(t.due_date)! < today).length;
  return { rows: [...m.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count), overdue };
}

export function projectsByStatus(projects: OvProject[]) {
  const m = new Map<string, number>();
  for (const p of projects) { const s = statusLabel(p.status || 'planning'); m.set(s, (m.get(s) ?? 0) + 1); }
  return [...m.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}

/** Top customers by invoiced amount for invoices dated in the period, one currency. */
export function topCustomersInPeriod(invoices: FinDoc[], currency: string, period: Period, limit = 5, now = new Date()) {
  const range = periodRange(period, now);
  return topCustomers(activeOnly(invoices).filter((d) => inRange(d.created_at, range)), currency, limit, isoDay(now));
}

/* ---------- Customise: which sections show ---------- */

export const SECTIONS = [
  { id: 'cards', label: 'Summary cards' },
  { id: 'moneyInOut', label: 'Money in and money out' },
  { id: 'invoiceStatus', label: 'Invoices by status' },
  { id: 'pipeline', label: 'Sales pipeline by stage' },
  { id: 'tasks', label: 'Tasks by status' },
  { id: 'projects', label: 'Projects by status' },
  { id: 'contacts', label: 'New contacts per month' },
  { id: 'topCustomers', label: 'Top customers' },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];
export type SectionPrefs = Record<SectionId, boolean>;
export const defaultSections = (): SectionPrefs => Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as SectionPrefs;

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): KV | null => { try { return window.localStorage; } catch { return null; } };
export const sectionsKey = (userId: string, orgId: string) => `b2bnest.overview.sections.v1.${userId}.${orgId}`;

/** Saved per user and organisation; anything missing or broken falls back to "all sections on". */
export function loadSections(userId?: string | null, orgId?: string | null, s: KV | null = store()): SectionPrefs {
  const base = defaultSections();
  if (!userId || !orgId || !s) return base;
  try {
    const raw = JSON.parse(s.getItem(sectionsKey(userId, orgId)) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    for (const { id } of SECTIONS) if (typeof raw[id] === 'boolean') base[id] = raw[id];
    return base;
  } catch { return base; }
}
export function saveSections(userId: string | null | undefined, orgId: string | null | undefined, prefs: SectionPrefs, s: KV | null = store()) {
  if (!userId || !orgId || !s) return false;
  try { s.setItem(sectionsKey(userId, orgId), JSON.stringify(prefs)); return true; } catch { return false; }
}
