import { describe, expect, it } from 'vitest';
import {
  excludedDocsNote, financeReportCsv, financeReportCsvFor, financeSummary, invoiceStatus, moneyInMinusOut, monthlyInvoicedPaid, needsAttention,
  quoteStatus, recentDocuments, statusCounts, topCustomers,
} from './financeSummary';

const now = new Date(2026, 9, 17, 12); // 17 Oct 2026
const today = '2026-10-17';
let n = 0;
const inv = (status: string | null, total: number, currency: string | null, created_at = '2026-10-10T09:00:00Z', due_date: string | null = null, client_name = 'Acme') =>
  ({ id: `i${++n}`, status, total_amount: total, currency, created_at, due_date, client_name });
const quote = (status: string | null, total: number, currency: string | null) => ({ id: `q${++n}`, status, total_amount: total, currency, created_at: '2026-10-01T09:00:00Z' });

describe('invoiceStatus', () => {
  it('maps stored values to chips and works out overdue in the app', () => {
    expect(invoiceStatus({ status: 'paid', due_date: '2020-01-01' }, today)).toBe('paid');
    expect(invoiceStatus({ status: 'Cancelled', due_date: '2020-01-01' }, today)).toBe('cancelled');
    expect(invoiceStatus({ status: 'draft', due_date: '2020-01-01' }, today)).toBe('draft');
    expect(invoiceStatus({ status: null, due_date: null }, today)).toBe('draft');
    expect(invoiceStatus({ status: 'sent', due_date: '2026-10-16' }, today)).toBe('overdue');
    expect(invoiceStatus({ status: 'sent', due_date: today }, today)).toBe('sent');
    expect(invoiceStatus({ status: 'pending', due_date: null }, today)).toBe('sent');
    expect(invoiceStatus({ status: 'overdue', due_date: '2026-12-01' }, today)).toBe('sent');
    expect(quoteStatus({ status: 'sent' })).toBe('sent');
    expect(quoteStatus({ status: 'accepted' })).toBe('other');
  });
});

describe('financeSummary', () => {
  it('keeps currencies apart and never converts', () => {
    const s = financeSummary([inv('sent', 100, 'GBP'), inv('sent', 50, 'usd'), inv('sent', 25, 'GBP')], [], [], now);
    expect(s.outstanding).toEqual([{ currency: 'GBP', amount: 125, count: 2 }, { currency: 'USD', amount: 50, count: 1 }]);
  });

  it('overdue rule: due before today and not paid; part of outstanding', () => {
    const s = financeSummary([inv('sent', 100, 'GBP', undefined, '2026-10-01'), inv('paid', 70, 'GBP', undefined, '2026-10-01'), inv('draft', 9, 'GBP', undefined, '2026-10-01')], [], [], now);
    expect(s.overdue).toEqual([{ currency: 'GBP', amount: 100, count: 1 }]);
    expect(s.outstanding).toEqual([{ currency: 'GBP', amount: 100, count: 1 }]);
    expect(s.drafts).toEqual([{ currency: 'GBP', amount: 9, count: 1 }]);
  });

  it('revenue is paid invoices only; quotes never count as revenue', () => {
    const s = financeSummary([inv('paid', 200, 'GBP'), inv('sent', 99, 'GBP')], [quote('sent', 5000, 'GBP'), quote('paid', 7000, 'GBP')], [], now);
    expect(s.revenue).toEqual([{ currency: 'GBP', amount: 200, count: 1 }]);
    expect(s.quotesOpen).toEqual([{ currency: 'GBP', amount: 5000, count: 1 }]);
  });

  it('paid last 30 days and this month go by invoice date', () => {
    const s = financeSummary([
      inv('paid', 10, 'GBP', '2026-10-01T00:00:00Z'),
      inv('paid', 20, 'GBP', '2026-09-20T00:00:00Z'),
      inv('paid', 40, 'GBP', '2026-09-01T00:00:00Z'),
    ], [], [], now);
    expect(s.paidLast30).toEqual([{ currency: 'GBP', amount: 30, count: 2 }]);
    expect(s.paidThisMonth).toEqual([{ currency: 'GBP', amount: 10, count: 1 }]);
  });

  it('money out this month counts expenses dated this month', () => {
    const s = financeSummary([], [], [{ amount: 30, date: '2026-10-02' }, { amount: 5, date: '2026-09-30' }, { amount: null, date: null }], now);
    expect(s.moneyOutThisMonth).toEqual({ amount: 30, count: 1 });
  });

  it('empty data gives empty totals, not zero-filled fakes', () => {
    const s = financeSummary([], [], [], now);
    expect(s.outstanding).toEqual([]);
    expect(s.revenue).toEqual([]);
    expect(s.moneyOutThisMonth).toEqual({ amount: 0, count: 0 });
  });
});

describe('lists', () => {
  it('needs attention: overdue only, oldest due date first', () => {
    const a = inv('sent', 1, 'GBP', undefined, '2026-10-10'), b = inv('sent', 1, 'GBP', undefined, '2026-09-01'), c = inv('sent', 1, 'GBP', undefined, '2026-11-01');
    expect(needsAttention([a, b, c], today).map((d) => d.id)).toEqual([b.id, a.id]);
  });
  it('recent documents: quotes and invoices together, newest first', () => {
    const r = recentDocuments([quote('draft', 1, 'GBP')], [inv('sent', 1, 'GBP', '2026-10-15T00:00:00Z')], 5);
    expect(r.map((x) => x.kind)).toEqual(['invoice', 'quote']);
  });
});

describe('analytics', () => {
  it('invoiced vs paid per month in one currency; drafts out; other currencies listed', () => {
    const r = monthlyInvoicedPaid([
      inv('paid', 100, 'GBP', '2026-10-05T00:00:00Z'),
      inv('sent', 50, 'GBP', '2026-10-06T00:00:00Z'),
      inv('draft', 999, 'GBP', '2026-10-06T00:00:00Z'),
      inv('paid', 80, 'GBP', '2026-08-06T00:00:00Z'),
      inv('paid', 70, 'USD', '2026-10-06T00:00:00Z'),
    ], 'GBP', 6, now);
    const oct = r.rows.at(-1)!, aug = r.rows.at(-3)!;
    expect([oct.invoiced, oct.paid, oct.invoicedCount, oct.paidCount]).toEqual([150, 100, 2, 1]);
    expect([aug.invoiced, aug.paid]).toEqual([80, 80]);
    expect(r.excluded).toEqual([{ currency: 'USD', count: 1 }]);
    expect(excludedDocsNote(r.excluded)).toBe('1 invoice in USD is not included, because there is no exchange-rate data and nothing is converted.');
  });
  it('status counts and top customers', () => {
    const docs = [inv('paid', 100, 'GBP', undefined, null, 'Acme'), inv('sent', 300, 'GBP', undefined, null, ' acme '), inv('sent', 50, 'GBP', undefined, '2026-01-01', 'Beta'), inv('draft', 9999, 'GBP', undefined, null, 'Gamma'), inv('sent', 1, 'USD', undefined, null, 'Delta')];
    expect(statusCounts(docs, today)).toEqual([{ chip: 'sent', label: 'Sent', count: 2 }, { chip: 'draft', label: 'Draft', count: 1 }, { chip: 'overdue', label: 'Overdue', count: 1 }, { chip: 'paid', label: 'Paid', count: 1 }]);
    expect(topCustomers(docs, 'GBP', 5, today)).toEqual([{ name: 'Acme', amount: 400, count: 2 }, { name: 'Beta', amount: 50, count: 1 }]);
  });
  it('money in minus money out: account currency only, other currencies listed, null without a currency', () => {
    const r = moneyInMinusOut([inv('paid', 500, 'GBP'), inv('paid', 70, 'USD'), inv('sent', 999, 'GBP')], [{ amount: 120, date: '2026-10-01' }], 'GBP', today)!;
    expect([r.moneyIn, r.moneyOut, r.net]).toEqual([500, 120, 380]);
    expect(r.excluded).toEqual([{ currency: 'USD', count: 1 }]);
    expect(moneyInMinusOut([], [], '', today)).toBeNull();
  });
  it('CSV holds the computed figures per currency with correct quoting and no profit label', () => {
    const csv = financeReportCsv([inv('paid', 100, 'GBP'), inv('sent', 40, 'USD', undefined, '2026-01-01', 'Smith, Jones')], [], [], 'GBP', now);
    expect(csv).toContain('"Paid invoices, all time",GBP,100,1,Revenue = paid invoices only');
    expect(csv).toContain('Overdue invoices,USD,40,1,"Due date before today, not paid"');
    expect(csv).toContain('Overdue invoices,USD,40,1');
    expect(csv).toContain('Money in minus money out (rough),GBP,100');
    expect(csv).not.toMatch(/Net Profit/i);
  });
  it('per-currency CSV keeps only that currency; expenses only in the account currency file', () => {
    const invs = [inv('paid', 100, 'GBP'), inv('sent', 40, 'USD')];
    const exp = [{ amount: 30, date: '2026-10-02' }];
    const usd = financeReportCsvFor(invs, [], exp, 'USD', 'GBP', now);
    expect(usd).toContain('Outstanding (sent and overdue invoices),USD,40,1');
    expect(usd).not.toContain('GBP');
    expect(usd).not.toMatch(/Money out|Money in minus/);
    expect(usd).toContain('Overdue invoices,USD,0,0');
    const gbp = financeReportCsvFor(invs, [], exp, 'GBP', 'GBP', now);
    expect(gbp).toContain('Money in minus money out (rough),GBP,70');
    expect(gbp).not.toContain('USD');
  });
});
