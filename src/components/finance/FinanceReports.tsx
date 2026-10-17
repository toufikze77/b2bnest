import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { useAccountCurrency } from '@/hooks/useAccountCurrency';
import { CurrencyTotals } from '@/lib/dashboardWidgets';
import { isoDay } from '@/lib/dashboardData';
import { excludedDocsNote, FinDoc, FinExpense, financeReportCsvFor, financeSummary, moneyInMinusOut, paidWithoutDateNote, quoteStatus, statusCounts } from '@/lib/financeSummary';
import { formatMoney, normalizeCurrency } from '@/lib/money';

interface Props {
  quotes: FinDoc[];
  invoices: FinDoc[];
  expenses: FinExpense[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const METRICS: { key: 'outstanding' | 'overdue' | 'revenue' | 'paidLast30' | 'drafts' | 'quotesOpen'; label: string; note?: string }[] = [
  { key: 'outstanding', label: 'Outstanding', note: 'Sent and overdue invoices' },
  { key: 'overdue', label: 'Overdue', note: 'Due date before today, not paid' },
  { key: 'revenue', label: 'Paid, all time', note: 'Revenue = paid invoices only' },
  { key: 'paidLast30', label: 'Paid, last 30 days', note: 'By the date marked paid' },
  { key: 'drafts', label: 'Draft invoices' },
  { key: 'quotesOpen', label: 'Open quotes', note: 'Draft or sent. Quotes are not revenue' },
];

const cell = (t: CurrencyTotals, c: string) => t.find((x) => x.currency === c);

/** Reports: real figures per currency, the rough money-in-minus-money-out line, and a CSV per currency. */
export function FinanceReports({ quotes, invoices, expenses, loading, error, onRetry }: Props) {
  const account = useAccountCurrency();
  const today = isoDay(new Date());
  const s = useMemo(() => financeSummary(invoices, quotes, expenses), [invoices, quotes, expenses]);
  const mm = useMemo(() => moneyInMinusOut(invoices, expenses, account, today), [invoices, expenses, account, today]);
  const statuses = useMemo(() => statusCounts(invoices, today), [invoices, today]);
  const currencies = useMemo(() => {
    const set = new Set([...invoices, ...quotes].map((d) => normalizeCurrency(d.currency)));
    return [...set].sort((a, b) => (a === account ? -1 : b === account ? 1 : a.localeCompare(b)));
  }, [invoices, quotes, account]);
  const quoteCounts = { draft: quotes.filter((q) => quoteStatus(q) === 'draft').length, sent: quotes.filter((q) => quoteStatus(q) === 'sent').length };

  const download = (cur: string) => {
    try {
      const csv = financeReportCsvFor(invoices, quotes, expenses, cur, account);
      const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-report-${cur || 'no-currency'}-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${cur || 'No-currency'} report downloaded`);
    } catch {
      toast.error("Couldn't create the report. Please try again.");
    }
  };

  if (loading) return <LoadingRows label="Loading reports" rows={5} />;
  if (error) return <ErrorState title="Reports couldn't be loaded" description="This is a loading problem, not missing data." onRetry={onRetry} className="rounded-card" />;

  const none = !invoices.length && !quotes.length;
  const label = (c: string) => c || 'No currency set';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-card-title text-foreground">Reports</h2>
        <p className="text-small text-muted-foreground">Real figures from your quotes, invoices and expenses. One column per stored currency, never converted.</p>
      </div>

      <section aria-labelledby="fin-summary" className="rounded-card border border-border bg-card p-5">
        <h3 id="fin-summary" className="text-card-title">Invoices and quotes</h3>
        {none ? (
          <p className="mt-3 text-body text-muted-foreground">No data yet. Create an invoice or quote and its figures appear here.</p>
        ) : (
          <>
          {/* Phones: one list per currency instead of a wide table. */}
          <div className="mt-3 space-y-4 md:hidden">
            {currencies.map((c) => (
              <div key={c}>
                <h4 className="text-body font-semibold">{label(c)}</h4>
                <dl className="mt-1 divide-y divide-border">
                  {METRICS.map((m) => {
                    const v = cell(s[m.key], c);
                    return (
                      <div key={m.key} className="flex justify-between gap-3 py-2 text-body">
                        <dt>{m.label}{m.note && <span className="block text-small text-muted-foreground">{m.note}</span>}</dt>
                        <dd className="shrink-0 text-right tabular-nums">{v ? <>{formatMoney(v.amount, c, { cents: true })}<span className="block text-small text-muted-foreground">{v.count} {v.count === 1 ? 'document' : 'documents'}</span></> : <span className="text-muted-foreground">—</span>}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[480px] text-body">
              <caption className="sr-only">Invoice and quote totals per currency</caption>
              <thead>
                <tr className="border-b border-border text-left text-small text-muted-foreground">
                  <th scope="col" className="px-2 py-2 font-semibold">Figure</th>
                  {currencies.map((c) => <th key={c} scope="col" className="px-2 py-2 text-right font-semibold">{label(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.key} className="border-b border-border last:border-0">
                    <th scope="row" className="px-2 py-2 text-left font-medium">
                      {m.label}{m.note && <span className="block text-small font-normal text-muted-foreground">{m.note}</span>}
                    </th>
                    {currencies.map((c) => {
                      const v = cell(s[m.key], c);
                      return <td key={c} className="px-2 py-2 text-right tabular-nums">{v ? <>{formatMoney(v.amount, c, { cents: true })}<span className="block text-small text-muted-foreground">{v.count} {v.count === 1 ? 'document' : 'documents'}</span></> : <span className="text-muted-foreground">—</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      {paidWithoutDateNote(s.paidWithoutDate) && <p className="mt-3 text-small text-muted-foreground">{paidWithoutDateNote(s.paidWithoutDate)}</p>}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-labelledby="fin-net" className="rounded-card border border-border bg-card p-5">
          <h3 id="fin-net" className="text-card-title">Money in minus money out (rough)</h3>
          {mm ? (
            <dl className="mt-3 space-y-2 text-body">
              <div className="flex justify-between gap-3"><dt>Money in: paid invoices in {mm.currency}</dt><dd className="tabular-nums">{formatMoney(mm.moneyIn, mm.currency, { cents: true })}</dd></div>
              <div className="flex justify-between gap-3"><dt>Money out: all expenses</dt><dd className="tabular-nums">{formatMoney(mm.moneyOut, mm.currency, { cents: true })}</dd></div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold"><dt>Difference</dt><dd className="tabular-nums">{formatMoney(mm.net, mm.currency, { cents: true })}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-body text-muted-foreground">Set your account currency in Settings to see this. Expenses have no currency of their own, so they are counted in the account currency.</p>
          )}
          <p className="mt-3 text-small text-muted-foreground">
            This is not an accounting profit: no tax, no accruals, no unpaid bills, and nothing in other currencies.
            {mm && mm.excluded.length > 0 && <> {excludedDocsNote(mm.excluded, 'paid invoice')}</>}
          </p>
        </section>

        <section aria-labelledby="fin-counts" className="rounded-card border border-border bg-card p-5">
          <h3 id="fin-counts" className="text-card-title">Document status</h3>
          <dl className="mt-3 space-y-2 text-body">
            <div className="flex justify-between"><dt>Draft quotes</dt><dd className="tabular-nums">{quoteCounts.draft}</dd></div>
            <div className="flex justify-between"><dt>Sent quotes</dt><dd className="tabular-nums">{quoteCounts.sent}</dd></div>
            {statuses.length === 0 && <div className="flex justify-between"><dt>Invoices</dt><dd className="tabular-nums">0</dd></div>}
            {statuses.map((x) => <div key={x.chip} className="flex justify-between"><dt>{x.label} invoices</dt><dd className="tabular-nums">{x.count}</dd></div>)}
            <div className="flex justify-between border-t border-border pt-2"><dt>Expenses this month</dt><dd className="tabular-nums">{formatMoney(s.moneyOutThisMonth.amount, account, { cents: true })} <span className="text-small text-muted-foreground">({s.moneyOutThisMonth.count})</span></dd></div>
          </dl>
        </section>
      </div>

      <section aria-labelledby="fin-export" className="rounded-card border border-border bg-card p-5">
        <h3 id="fin-export" className="text-card-title">Download</h3>
        <p className="mt-1 text-small text-muted-foreground">One CSV per currency with the figures above. Expenses are only in the {account || 'account currency'} file.</p>
        {currencies.length === 0 ? (
          <p className="mt-3 text-body text-muted-foreground">No data yet, so there is nothing to download.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {currencies.map((c) => (
              <Button key={c} variant="outline" className="min-h-touch md:min-h-0" onClick={() => download(c)}>
                <Download className="h-4 w-4" aria-hidden="true" />{c ? `${c} CSV` : 'No-currency CSV'}
              </Button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
