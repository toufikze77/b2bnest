/** Pure aggregation for the extra Dashboard widgets. Only real rows go in; nothing is estimated. */

/** One total per currency. A missing currency stays '' and is shown as a plain number, never guessed. */
export type CurrencyTotals = { currency: string; amount: number; count: number }[];

export function sumByCurrency<T>(rows: T[], amount: (r: T) => number | string | null | undefined, currency: (r: T) => string | null | undefined): CurrencyTotals {
  const m = new Map<string, { amount: number; count: number }>();
  for (const r of rows) {
    const n = Number(amount(r) ?? 0);
    const c = (currency(r) || '').toUpperCase();
    const cur = m.get(c) ?? { amount: 0, count: 0 };
    cur.amount += Number.isFinite(n) ? n : 0;
    cur.count++;
    m.set(c, cur);
  }
  return [...m.entries()].map(([c, v]) => ({ currency: c, ...v })).sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
}

export const formatMoney = (amount: number, currency: string) => {
  if (!currency) return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount);
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
  }
};

export interface InvoiceRow { status: string | null; total_amount: number | null; currency: string | null }
export interface BillRow { status: string | null; amount: number | null; currency: string | null }

const lc = (s: string | null | undefined) => (s || '').toLowerCase();

/** Invoices: paid vs outstanding (sent, pending or overdue; drafts and cancelled are left out). Bills: anything not paid or cancelled. */
export function summarizeMoney(invoices: InvoiceRow[], bills: BillRow[]) {
  const paid = invoices.filter((i) => lc(i.status) === 'paid');
  const outstanding = invoices.filter((i) => ['sent', 'pending', 'overdue'].includes(lc(i.status)));
  const unpaidBills = bills.filter((b) => !['paid', 'cancelled'].includes(lc(b.status)));
  return {
    paid: sumByCurrency(paid, (i) => i.total_amount, (i) => i.currency),
    outstanding: sumByCurrency(outstanding, (i) => i.total_amount, (i) => i.currency),
    bills: sumByCurrency(unpaidBills, (b) => b.amount, (b) => b.currency),
    outstandingCount: outstanding.length,
    billsCount: unpaidBills.length,
  };
}

export interface DealRow { stage: string | null; value: number | null; currency: string | null }

export const isClosedStage = (stage: string | null | undefined) => /\b(won|lost|closed)\b/.test(lc(stage).replace(/[-_]/g, ' '));

/** Open deals grouped by stage, in order of first appearance. */
export function summarizePipeline(deals: DealRow[]) {
  const open = deals.filter((d) => !isClosedStage(d.stage));
  const stages = new Map<string, DealRow[]>();
  for (const d of open) {
    const k = lc(d.stage) || 'no stage';
    stages.set(k, [...(stages.get(k) ?? []), d]);
  }
  return {
    openCount: open.length,
    total: sumByCurrency(open, (d) => d.value, (d) => d.currency),
    stages: [...stages.entries()].map(([stage, rows]) => ({ stage, count: rows.length, total: sumByCurrency(rows, (d) => d.value, (d) => d.currency) })),
  };
}

/** Counts rows by a lower-cased key; missing values count as ''. */
export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) { const k = lc(key(r)); m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
}

export interface ShiftRow { id: string; employee_id: string; start_time: string; end_time: string; role: string | null; status: string }
export interface EmployeeRow { id: string; full_name: string }

/** Today's shifts, earliest first, with the employee's name when it was loaded. */
export function rotaToday(shifts: ShiftRow[], employees: EmployeeRow[]) {
  const names = new Map(employees.map((e) => [e.id, e.full_name]));
  return [...shifts]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s) => ({ ...s, name: names.get(s.employee_id) ?? 'Unnamed employee', start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }));
}
