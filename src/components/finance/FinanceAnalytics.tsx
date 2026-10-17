import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChartCard, Donut, TrendChart } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import { RangeControl, ReportCurrencyControl } from '@/components/crm/AnalyticsTab';
import { useReportCurrency } from '@/hooks/useReportCurrency';
import { isoDay } from '@/lib/dashboardData';
import { excludedDocsNote, FinDoc, monthlyInvoicedPaid, splitByCurrency, statusCounts, topCustomers } from '@/lib/financeSummary';
import { currencySymbol, formatMoney } from '@/lib/money';

interface Props {
  invoices: FinDoc[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onNewInvoice: () => void;
}

/**
 * Invoices & quotes analytics: invoiced vs paid per month, invoice status, top customers.
 * One currency at a time (account currency by default), nothing converted. Quotes are not revenue
 * and are left out. There is no paid/sent conversion trend: invoices have no paid date and "sent"
 * is only what the form saved, so such a rate would not be honest.
 */
export function FinanceAnalytics({ invoices, loading, error, onRetry, onNewInvoice }: Props) {
  const rc = useReportCurrency('finance');
  const { currency } = rc;
  const [range, setRange] = useState(6);
  const today = isoDay(new Date());
  const money = (n: number) => formatMoney(n, currency);
  const sym = currencySymbol(currency);

  const monthly = useMemo(() => monthlyInvoicedPaid(invoices, currency, range), [invoices, currency, range]);
  const statuses = useMemo(() => statusCounts(invoices, today), [invoices, today]);
  const top = useMemo(() => topCustomers(invoices, currency, 5, today), [invoices, currency, today]);
  const inCurrency = splitByCurrency(invoices, currency);
  const note = excludedDocsNote(inCurrency.excluded);
  const anyInRange = monthly.rows.some((r) => r.invoicedCount > 0);
  const base = (s: 'loading' | 'error' | 'empty' | 'ready') => (loading ? 'loading' : error ? 'error' : s);
  const newAction = <Button size="sm" variant="outline" className="min-h-touch md:min-h-0" onClick={onNewInvoice}>Create an invoice</Button>;
  const topMax = top[0]?.amount || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-card-title text-foreground">Analytics</h2>
          <p className="text-small text-muted-foreground">Worked out from your own invoices. Money figures use one currency and are never converted. Quotes are not counted.</p>
        </div>
        <ReportCurrencyControl deals={invoices} rc={rc} />
      </div>
      {!currency && <p role="note" className="rounded-control border border-border bg-muted p-3 text-small text-foreground">Your account has no currency set yet, so money charts are empty. Choose a currency above, or set one in Settings.</p>}
      {note && !loading && !error && <p className="text-small text-muted-foreground">{note}</p>}

      <ChartCard
        title="Invoiced and paid per month"
        subtitle={`By invoice date, ${currency || 'no currency chosen'} only. Invoiced = sent, overdue or paid; drafts are left out.`}
        controls={<RangeControl value={range} onChange={setRange} label="Months shown for invoiced and paid" />}
        state={base(!currency || !anyInRange ? 'empty' : 'ready')}
        onRetry={onRetry}
        empty={{ message: invoices.length === 0 ? 'No data yet. Invoices you send show up here.' : `No sent or paid invoices in ${currency || 'this currency'} dated in the last ${range} months.`, action: newAction }}
        summary={`Invoiced and paid per month in ${currency}: ${monthly.rows.filter((r) => r.invoicedCount).map((r) => `${r.label} invoiced ${money(r.invoiced)}, paid ${money(r.paid)}`).join('; ')}.`}
        table={{ caption: `Invoiced and paid per month in ${currency}`, columns: ['Month', `Invoiced (${currency})`, 'Invoices', `Paid (${currency})`, 'Paid invoices'], rows: monthly.rows.map((r) => [r.label, money(r.invoiced), r.invoicedCount, money(r.paid), r.paidCount]) }}
        footer={<p>Invoices have no paid date, so paid amounts sit in the month the invoice is dated.</p>}
      >
        <TrendChart data={monthly.rows.map((r) => ({ label: r.label, invoiced: r.invoiced, paid: r.paid }))} series={[{ key: 'invoiced', label: 'Invoiced' }, { key: 'paid', label: 'Paid' }]}
          format={money} axisTitle={`Amount${sym ? ` (${sym})` : ''}`} integer={false} />
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Invoices by status"
          subtitle="All your invoices, every currency. Counts, not amounts."
          state={base(invoices.length === 0 ? 'empty' : 'ready')}
          onRetry={onRetry}
          empty={{ message: 'No data yet. Create an invoice to see its status here.', action: newAction }}
          summary={`${invoices.length} invoices: ${statuses.map((s) => `${s.label} ${s.count}`).join(', ')}.`}
          table={{ caption: 'Invoices by status', columns: ['Status', 'Invoices', 'Share'], rows: statuses.map((s) => [s.label, s.count, pct(s.count / invoices.length)]) }}
        >
          <Donut data={statuses.map((s) => ({ label: s.label, value: s.count }))} totalLabel="invoices" />
        </ChartCard>

        <ChartCard
          title="Top customers by invoiced amount"
          subtitle={`Sent, overdue and paid invoices in ${currency || 'no currency chosen'}, all time.`}
          state={base(!currency || top.length === 0 ? 'empty' : 'ready')}
          onRetry={onRetry}
          empty={{ message: invoices.length === 0 ? 'No data yet.' : `No sent or paid invoices in ${currency || 'this currency'} yet.`, action: newAction }}
          summary={`Top customers in ${currency}: ${top.map((t) => `${t.name} ${money(t.amount)}`).join('; ')}.`}
          table={{ caption: `Top customers by invoiced amount in ${currency}`, columns: ['Customer', `Invoiced (${currency})`, 'Invoices'], rows: top.map((t) => [t.name, money(t.amount), t.count]) }}
          footer={<p>Customers are grouped by the client name on the invoice.</p>}
        >
          <ol className="space-y-3">
            {top.map((t, i) => (
              <li key={t.name} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-body">
                  <span className="min-w-0 truncate"><span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span><span className="font-semibold">{t.name}</span></span>
                  <span className="shrink-0 tabular-nums">{money(t.amount)} <span className="text-small text-muted-foreground">· {t.count} {t.count === 1 ? 'invoice' : 'invoices'}</span></span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (t.amount / topMax) * 100)}%`, background: 'var(--chart-1)' }} />
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>
      </div>
    </div>
  );
}
