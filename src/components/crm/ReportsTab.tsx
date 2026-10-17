import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StatTile } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import {
  AnalyticsContact, AnalyticsDeal, averageWonDeal, dealsInCurrency, excludedNote, reportRows, toCsv, totalsByCurrency, winRate,
} from '@/lib/crmAnalytics';
import { formatMoney } from '@/lib/money';
import { useReportCurrency } from '@/hooks/useReportCurrency';
import { ReportCurrencyControl } from './AnalyticsTab';

interface ReportsTabProps {
  contacts: AnalyticsContact[];
  deals: AnalyticsDeal[];
  error?: boolean;
  onRetry?: () => void;
}

const ReportsTab = ({ contacts, deals, error, onRetry }: ReportsTabProps) => {
  const rc = useReportCurrency();
  const { currency } = rc;
  const { toast } = useToast();
  const money = (n: number) => formatMoney(n, currency);
  const { included, excluded } = useMemo(() => dealsInCurrency(deals, currency), [deals, currency]);
  const totals = totalsByCurrency(included)[0];
  const avg = averageWonDeal(included)[0];
  const rate = winRate(deals);
  const note = excludedNote(excluded);

  const exportCsv = () => {
    try {
      const csv = toCsv(reportRows(contacts, deals));
      const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Report downloaded', description: 'The CSV has your real figures, one row per currency where money is involved.' });
    } catch {
      toast({ title: "Couldn't create the report", description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-card-title text-foreground">Reports</h2>
          <p className="text-small text-muted-foreground">The same real figures as Analytics, ready to download.</p>
        </div>
        <ReportCurrencyControl deals={deals} rc={rc} />
      </div>

      <section aria-labelledby="sales-performance" className="space-y-4 rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="sales-performance" className="text-card-title text-foreground">Sales performance</h3>
            <p className="text-small text-muted-foreground">{currency ? `Money figures in ${currency}, from deals stored in ${currency}.` : 'Choose a currency to see money figures.'}</p>
          </div>
          <Button onClick={exportCsv} disabled={error} className="min-h-touch md:min-h-0"><FileDown className="h-4 w-4" aria-hidden="true" />Export detailed report (CSV)</Button>
        </div>
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-4 text-body">
            <p>Your CRM data couldn't be loaded, so there is nothing to report yet. This is a loading problem, not missing data.</p>
            {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
          </div>
        ) : deals.length === 0 ? (
          <p className="rounded-control border border-dashed border-border p-6 text-center text-body text-muted-foreground">No deals yet, so there are no sales figures to report. Add a deal in the Sales Pipeline tab.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Open pipeline" value={totals ? money(totals.open) : money(0)} hint={`${totals?.openCount ?? 0} open ${totals?.openCount === 1 ? 'deal' : 'deals'} (not won or lost).`} />
              <StatTile label="Won value" value={totals ? money(totals.won) : money(0)} hint={`${totals?.wonCount ?? 0} won ${totals?.wonCount === 1 ? 'deal' : 'deals'}, all time.`} />
              <StatTile label="Average won deal" value={avg ? money(avg.average) : null} hint={avg ? `Across ${avg.count} won ${avg.count === 1 ? 'deal' : 'deals'}.` : 'No won deals in this currency yet.'} />
              <StatTile label="Win rate" value={rate.rate == null ? null : pct(rate.rate)} hint={rate.rate == null ? 'Needs at least one won or lost deal.' : `${rate.won} won, ${rate.lost} lost (all currencies).`} />
            </div>
            {note && <p className="text-small text-muted-foreground">{note}</p>}
            {included.length === 0 && currency && <p className="text-small text-muted-foreground">None of your deals is stored in {currency}.</p>}
          </>
        )}
        <p className="text-small text-muted-foreground">The CSV covers every currency separately, with lead sources, win rate and contacts added per month. Nothing is converted.</p>
      </section>

      <p className="text-small text-muted-foreground">
        Want to use this data in another tool? See <Link to="/business-tools?tool=integrations" className="font-semibold text-link underline underline-offset-2">Integrations</Link>.
      </p>
    </div>
  );
};

export default ReportsTab;
