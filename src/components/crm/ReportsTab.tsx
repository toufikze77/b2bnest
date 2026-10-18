import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StatTile } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import {
  AnalyticsContact, AnalyticsDeal, averageWonDeal, dealsInCurrency, excludedNote, reportRows, toCsv, totalsByCurrency, winRate,
} from '@/lib/crmAnalytics';
import { formatMoney } from '@/lib/money';
import { useReportCurrency } from '@/hooks/useReportCurrency';
import { useReportRange } from '@/hooks/useReportRange';
import {
  csvFileName, isoDay, leadSourcesCsvRows, rangePhrase, needsAttentionCsvRows, pipelineCsvRows, rangeBounds, rangeLabel, REPORT_RANGES, ReportContact, ReportDeal, winLossCsvRows,
} from '@/lib/crmReports';
import { ReportCurrencyControl } from './AnalyticsTab';
import { LeadSourcesSection, NeedsAttentionSection, PipelineSection, SectionState, WinLossSection } from './ReportSections';

interface ReportsTabProps {
  /** The CRM tab's own contacts and deals (row-level security applies); nothing else is loaded here. */
  contacts: (AnalyticsContact & Partial<ReportContact>)[];
  deals: (AnalyticsDeal & Partial<ReportDeal>)[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Switch CRM tab (for "Open Sales Pipeline" / "Open Contacts"). */
  onOpenTab?: (tab: string) => void;
  /** Fixed "today" for tests. */
  today?: Date;
}

/** Date range for Reports, as a segmented control. */
function ReportRangeControl({ value, onChange }: { value: ReturnType<typeof useReportRange>['range']; onChange: (r: ReturnType<typeof useReportRange>['range']) => void }) {
  return (
    <div role="group" aria-label="Date range" className="flex flex-wrap gap-1 rounded-control border bg-muted p-1">
      {REPORT_RANGES.map((r) => (
        <Button key={r.value} size="sm" variant={value === r.value ? 'default' : 'ghost'} aria-pressed={value === r.value} className="min-h-touch md:min-h-0" onClick={() => onChange(r.value)}>{r.label}</Button>
      ))}
    </div>
  );
}

const ReportsTab = ({ contacts: rawContacts, deals: rawDeals, loading, error, onRetry, onOpenTab, today }: ReportsTabProps) => {
  const rc = useReportCurrency();
  const { currency } = rc;
  const { range, setRange } = useReportRange();
  const { toast } = useToast();
  // Records exactly as loaded; a missing field stays missing (it is never filled with an invented value).
  const contacts: ReportContact[] = useMemo(() => rawContacts.map((c, i) => ({ ...c, id: c.id ?? `contact-${i}`, name: c.name ?? 'No name', last_contact: c.last_contact ?? null })), [rawContacts]);
  const deals: ReportDeal[] = useMemo(() => rawDeals.map((d, i) => ({ ...d, id: d.id ?? `deal-${i}`, title: d.title ?? 'Untitled deal', probability: d.probability ?? null, contact_id: d.contact_id ?? null, created_at: d.created_at ?? null, updated_at: d.updated_at ?? null })), [rawDeals]);
  const now = today ?? new Date();
  const bounds = rangeBounds(range, now);
  const rangeText = rangeLabel(range);
  const phrase = rangePhrase(range);
  const sectionState: SectionState = loading ? 'loading' : error ? 'error' : 'ready';
  const money = (n: number) => formatMoney(n, currency);
  const { included, excluded } = useMemo(() => dealsInCurrency(deals, currency), [deals, currency]);
  const totals = totalsByCurrency(included)[0];
  const avg = averageWonDeal(included)[0];
  const rate = winRate(deals);
  const note = excludedNote(excluded);

  /** UTF-8 with a byte-order mark (so spreadsheets read £ and accents), header row always present. */
  const download = (rows: (string | number | null | undefined)[][], file: string, what: string) => {
    try {
      const blob = new Blob(['\ufeff', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${what} downloaded`, description: 'The CSV has your real figures, one row per currency where money is involved.' });
    } catch {
      toast({ title: "Couldn't create the report", description: 'Please try again.', variant: 'destructive' });
    }
  };
  const exportCsv = () => download(reportRows(contacts, deals), `crm-report-${isoDay(now)}.csv`, 'Report');

  // Print: only the report is printed (navigation and buttons are hidden by the print styles in index.css).
  const print = () => {
    document.body.classList.add('print-crm-report');
    const done = () => { document.body.classList.remove('print-crm-report'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    try { window.print(); } finally { setTimeout(done, 1000); }
  };

  return (
    <div id="crm-reports" className="min-w-0 space-y-6">
      <div className="hidden print:block">
        <p className="text-card-title text-foreground">CRM report — {rangeText}</p>
        <p className="text-small">Money in {currency || 'no currency chosen'}, never converted; deals in other currencies are listed as not included. From your deals as entered. Printed {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-card-title text-foreground">Reports</h2>
          <p className="text-small text-muted-foreground">Worked out from your own contacts and deals, as entered. Money uses one currency and is never converted.</p>
        </div>
        <Button variant="outline" onClick={print} className="min-h-touch md:min-h-0"><Printer className="h-4 w-4" aria-hidden="true" />Print this page</Button>
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 print:hidden">
        <div className="space-y-1">
          <p className="text-small font-semibold text-foreground" id="report-range-label">Date range</p>
          <ReportRangeControl value={range} onChange={setRange} />
        </div>
        <ReportCurrencyControl deals={deals} rc={rc} />
      </div>
      <p className="text-small text-muted-foreground print:hidden">Each section says which date it is filtered by. "Sales performance" below is always all time.</p>

      <section aria-labelledby="sales-performance" className="space-y-4 rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="sales-performance" className="text-card-title text-foreground">Sales performance</h3>
            <p className="text-small text-muted-foreground">{currency ? `Money figures in ${currency}, from deals stored in ${currency}.` : 'Choose a currency to see money figures.'}</p>
            <p className="mt-1 text-small font-semibold text-foreground">All time (not filtered by the date range).</p>
          </div>
          <Button onClick={exportCsv} disabled={error || loading} className="min-h-touch print:hidden md:min-h-0"><FileDown className="h-4 w-4" aria-hidden="true" />Export detailed report (CSV)</Button>
        </div>
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-4 text-body">
            <p>Your CRM data couldn't be loaded, so there is nothing to report yet. This is a loading problem, not missing data.</p>
            {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
          </div>
        ) : loading ? (
          <div role="status" aria-label="Loading sales performance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}<span className="sr-only">Loading…</span></div>
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

      <PipelineSection deals={deals} bounds={bounds} currency={currency} rangeText={rangeText} rangePhrase={phrase} state={sectionState} onRetry={onRetry} onOpenTab={onOpenTab}
        onExport={() => download(pipelineCsvRows(deals, currency, range, now), csvFileName('pipeline', now), 'Pipeline by stage')} />
      <WinLossSection deals={deals} bounds={bounds} currency={currency} rangeText={rangeText} rangePhrase={phrase} state={sectionState} onRetry={onRetry} onOpenTab={onOpenTab}
        onExport={() => download(winLossCsvRows(deals, currency, range, now), csvFileName('win-loss', now), 'Win and loss')} />
      <LeadSourcesSection contacts={contacts} deals={deals} bounds={bounds} currency={currency} rangeText={rangeText} rangePhrase={phrase} state={sectionState} onRetry={onRetry} onOpenTab={onOpenTab}
        onExport={() => download(leadSourcesCsvRows(contacts, deals, currency, range, now), csvFileName('lead-sources', now), 'Lead sources')} />
      <NeedsAttentionSection contacts={contacts} deals={deals} today={now} state={sectionState} onRetry={onRetry} onOpenTab={onOpenTab}
        onExport={() => download(needsAttentionCsvRows(contacts, deals, now), csvFileName('needs-attention', now), 'Needs attention')} />

      <p className="text-small text-muted-foreground print:hidden">
        Want to use this data in another tool? See <Link to="/business-tools?tool=integrations" className="inline-flex min-h-touch items-center rounded-sm font-semibold text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">Integrations</Link>.
      </p>
    </div>
  );
};

export default ReportsTab;
