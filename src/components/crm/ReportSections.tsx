import { ReactNode, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, ChevronRight, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCard, ColumnChart, StatTile, TrendChart } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import { statusLabel } from '@/components/data/StatusBadge';
import { excludedNote } from '@/lib/crmAnalytics';
import { crmRecordSearch } from '@/lib/crmTab';
import {
  leadSourceReport, MIN_FOR_RATE, needsAttention, NO_SOURCE, pipelineByStage, ReportContact, ReportDeal, STALE_DAYS, winLoss,
} from '@/lib/crmReports';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

export type SectionState = 'loading' | 'error' | 'ready';
type Bounds = { from: string | null; to: string | null };

/** One report section: heading, one-sentence description, which date it is filtered by, CSV button, and the states. */
export function ReportSection({ title, description, filteredBy, onExport, state, onRetry, empty, children }: {
  title: string; description: string; filteredBy: string; onExport?: () => void; state: SectionState; onRetry?: () => void;
  /** When set (and ready), shown instead of the content: what to do next. */
  empty?: { message: string; action?: ReactNode } | null;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-t`} className="report-section min-w-0 space-y-4 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="text-card-title text-foreground">{title}</h3>
          <p className="text-small text-muted-foreground">{description}</p>
          <p className="mt-1 text-small font-semibold text-foreground">{filteredBy}</p>
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={state !== 'ready'} className="min-h-touch print:hidden md:min-h-0" aria-label={`Download ${title} as CSV`}>
            <FileDown className="h-4 w-4" aria-hidden="true" />Download CSV
          </Button>
        )}
      </div>
      {state === 'loading' ? (
        <div role="status" aria-label={`Loading ${title}`} className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-4 w-1/2" /><span className="sr-only">Loading…</span></div>
      ) : state === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-destructive/40 bg-destructive/5 p-4 text-body">
          <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />{title} couldn't be loaded. This is a loading problem, not missing data.</p>
          {onRetry && <Button size="sm" variant="outline" className="min-h-touch md:min-h-0" onClick={onRetry}>Try again</Button>}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-3 rounded-control border border-dashed border-border p-6 text-center text-body text-muted-foreground">
          <p>{empty.message}</p>
          {empty.action}
        </div>
      ) : children}
    </section>
  );
}

/** A table that scrolls inside its own box, never the page. */
function ReportTable({ caption, columns, rows, foot }: { caption: string; columns: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <div className="overflow-x-auto rounded-control border border-border">
      <table className="w-full min-w-[32rem] text-body">
        <caption className="sr-only">{caption}</caption>
        <thead><tr className="border-b border-border bg-muted/50 text-left text-small text-muted-foreground">
          {columns.map((c, i) => <th key={c} scope="col" className={cn('px-3 py-2 font-semibold', i > 0 && 'text-right')}>{c}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((v, j) => (j === 0 ? <th key={j} scope="row" className="px-3 py-2 text-left font-medium">{v}</th> : <td key={j} className="px-3 py-2 text-right tabular-nums">{v}</td>))}
            </tr>
          ))}
        </tbody>
        {foot && <tfoot><tr className="border-t-2 border-border font-semibold">
          {foot.map((v, j) => (j === 0 ? <th key={j} scope="row" className="px-3 py-2 text-left">{v}</th> : <td key={j} className="px-3 py-2 text-right tabular-nums">{v}</td>))}
        </tr></tfoot>}
      </table>
    </div>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
interface Common { currency: string; rangeText: string; /** The range inside a sentence, e.g. "in the last 30 days". */ rangePhrase: string; state: SectionState; onRetry?: () => void; onExport?: () => void; onOpenTab?: (tab: string) => void }
const openTab = (onOpenTab: Common['onOpenTab'], tab: string, text: string) =>
  onOpenTab ? <Button size="sm" variant="outline" className="min-h-touch md:min-h-0" onClick={() => onOpenTab(tab)}>{text}</Button> : undefined;

/* ---------- 1. Pipeline by stage ---------- */

export function PipelineSection({ deals, bounds, currency, rangeText, rangePhrase, state, onRetry, onExport, onOpenTab }: Common & { deals: ReportDeal[]; bounds: Bounds }) {
  const money = (n: number) => formatMoney(n, currency);
  const p = pipelineByStage(deals, currency, bounds);
  const note = excludedNote(p.excluded);
  const empty = deals.length === 0 ? { message: 'No deals yet, so there is no pipeline to report. Add a deal in the Sales Pipeline tab.', action: openTab(onOpenTab, 'deals', 'Open Sales Pipeline') }
    : !currency ? { message: 'Choose a currency above to see pipeline values.' }
    : p.openInRange === 0 ? { message: `No open deals were created ${rangePhrase}. Choose a longer date range, or add a deal in the Sales Pipeline tab.`, action: openTab(onOpenTab, 'deals', 'Open Sales Pipeline') }
    : p.rows.length === 0 ? { message: `None of the ${plural(p.openInRange, 'open deal')} created ${rangePhrase} is stored in ${currency}. ${note ?? ''}` }
    : null;
  return (
    <ReportSection title="Pipeline by stage" description="Open deals (not won or lost) grouped by stage, with a weighted forecast, from your deals as entered."
      filteredBy={`Filtered by created date: ${rangeText}. Money in ${currency || 'no currency chosen'}.`} state={state} onRetry={onRetry} onExport={onExport} empty={empty}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Open deals" value={p.totals.count.toLocaleString('en-GB')} hint={`In ${currency}.`} />
        <StatTile label="Open value" value={money(p.totals.value)} hint="Total value of these deals." />
        <StatTile label="Weighted forecast" value={p.totals.withProbability ? money(p.totals.weighted) : null}
          hint={p.totals.withProbability ? `Value × probability, for ${plural(p.totals.withProbability, 'deal')} with a probability.` : 'No open deal here has a probability yet.'} />
      </div>
      <ReportTable caption={`Open deals by stage in ${currency}`} columns={['Stage', 'Deals', `Total value (${currency})`, `Weighted forecast (${currency})`, 'No probability']}
        rows={p.rows.map((r) => [r.stage, r.count, money(r.value), r.withProbability ? money(r.weighted) : '—', r.noProbability])}
        foot={['Total', p.totals.count, money(p.totals.value), p.totals.withProbability ? money(p.totals.weighted) : '—', p.totals.noProbability]} />
      <ChartCard title="Open value by stage" subtitle={`${currency}, open deals created ${rangePhrase}.`}
        summary={`Open value by stage in ${currency}: ${p.rows.map((r) => `${r.stage} ${money(r.value)} (${plural(r.count, 'deal')})`).join('; ')}.`}
        table={{ caption: `Open value by stage in ${currency}`, columns: ['Stage', 'Deals', `Value (${currency})`, `Weighted (${currency})`], rows: p.rows.map((r) => [r.stage, r.count, money(r.value), r.withProbability ? money(r.weighted) : '—']) }}>
        <ColumnChart data={p.rows.map((r) => ({ label: r.stage, value: r.value }))} seriesLabel="Open value" format={money} axisTitle={`Value (${currency})`} />
      </ChartCard>
      <div className="space-y-1 text-small text-muted-foreground">
        <p><strong className="text-foreground">Weighted forecast</strong> is each deal's value × its probability ÷ 100: a guide to what the pipeline may bring in, not a promise.</p>
        {p.totals.noProbability > 0 && <p>{plural(p.totals.noProbability, 'open deal has', 'open deals have')} no probability, so {p.totals.noProbability === 1 ? 'it is' : 'they are'} left out of the weighted forecast (not counted as 0% or 100%). Their value is in the open value.</p>}
        {note && <p>{note}</p>}
      </div>
    </ReportSection>
  );
}

/* ---------- 2. Win and loss ---------- */

export function WinLossSection({ deals, bounds, currency, rangeText, rangePhrase, state, onRetry, onExport, onOpenTab }: Common & { deals: ReportDeal[]; bounds: Bounds }) {
  const money = (n: number) => formatMoney(n, currency);
  const w = winLoss(deals, currency, bounds);
  const note = excludedNote(w.excluded);
  const anyInCurrency = w.rows.some((r) => r.wonCount || r.lostCount);
  const empty = deals.length === 0 ? { message: 'No deals yet, so there is nothing won or lost to report. Add a deal in the Sales Pipeline tab.', action: openTab(onOpenTab, 'deals', 'Open Sales Pipeline') }
    : w.won + w.lost === 0 ? { message: `No deals were marked won or lost with a close date ${rangePhrase}. When a deal ends, set its stage to won or lost and its close date in the Sales Pipeline tab.${w.noCloseDate ? ` ${plural(w.noCloseDate, 'won or lost deal has', 'won or lost deals have')} no close date.` : ''}`, action: openTab(onOpenTab, 'deals', 'Open Sales Pipeline') }
    : null;
  return (
    <ReportSection title="Win and loss" description="Deals marked won or lost, by the month they closed, from your deals as entered."
      filteredBy={`Filtered by close date: ${rangeText}. Money in ${currency || 'no currency chosen'}; counts include every currency.`} state={state} onRetry={onRetry} onExport={onExport} empty={empty}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Won" value={w.won.toLocaleString('en-GB')} hint="Deals, every currency." />
        <StatTile label="Lost" value={w.lost.toLocaleString('en-GB')} hint="Deals, every currency." />
        <StatTile label="Win rate" value={w.rate == null ? null : pct(w.rate)} hint="Won ÷ (won + lost)." />
        <StatTile label="Average sales cycle" value={w.cycle.averageDays == null ? null : plural(w.cycle.averageDays, 'day')}
          hint={w.cycle.count ? `Created to close date, ${plural(w.cycle.count, 'won deal')}.` : 'No won deal has usable dates.'} />
      </div>
      {!currency ? <p className="text-small text-muted-foreground">Choose a currency above to see won and lost values.</p> : !anyInCurrency ? (
        <p className="rounded-control border border-dashed border-border p-4 text-small text-muted-foreground">None of the deals won or lost {rangePhrase} is stored in {currency}, so there are no values to chart. {note}</p>
      ) : (
        <ChartCard title="Won and lost per month" subtitle={`Deals by close month. Values in ${currency}.`}
          summary={`Won and lost deals per month in ${currency}: ${w.rows.filter((r) => r.wonCount || r.lostCount).map((r) => `${r.label} ${r.wonCount} won (${money(r.wonValue)}), ${r.lostCount} lost (${money(r.lostValue)})`).join('; ')}.`}
          table={{ caption: `Won and lost per month in ${currency}`, columns: ['Month', 'Won', `Won value (${currency})`, 'Lost', `Lost value (${currency})`], rows: w.rows.map((r) => [r.label, r.wonCount, money(r.wonValue), r.lostCount, money(r.lostValue)]) }}>
          <TrendChart data={w.rows.map((r) => ({ label: r.label, won: r.wonCount, lost: r.lostCount }))} series={[{ key: 'won', label: 'Won' }, { key: 'lost', label: 'Lost' }]} axisTitle="Deals" />
        </ChartCard>
      )}
      <div className="space-y-1 text-small text-muted-foreground">
        {w.cycle.skipped > 0 && <p>{plural(w.cycle.skipped, 'won deal was', 'won deals were')} left out of the sales cycle because the close date is missing or earlier than the date the deal was created.</p>}
        {w.noCloseDate > 0 && <p>{plural(w.noCloseDate, 'won or lost deal has', 'won or lost deals have')} no close date, so {w.noCloseDate === 1 ? 'it is' : 'they are'} not counted here.</p>}
        {w.capped && <p>Showing the latest 24 months. The CSV has every month.</p>}
        {anyInCurrency && note && <p>{note}</p>}
      </div>
    </ReportSection>
  );
}

/* ---------- 3. Lead sources ---------- */

export function LeadSourcesSection({ contacts, deals, bounds, currency, rangeText, rangePhrase, state, onRetry, onExport, onOpenTab }: Common & { contacts: ReportContact[]; deals: ReportDeal[]; bounds: Bounds }) {
  const money = (n: number) => formatMoney(n, currency);
  const r = leadSourceReport(contacts, deals, currency, bounds);
  const small = r.rows.some((x) => x.rate == null);
  const empty = contacts.length === 0 ? { message: 'No contacts yet, so there are no lead sources to report. Add a contact in the Contacts tab.', action: openTab(onOpenTab, 'contacts', 'Open Contacts') }
    : r.contactsInRange === 0 ? { message: `No contacts were added ${rangePhrase}. Choose a longer date range.` }
    : null;
  return (
    <ReportSection title="Lead sources" description="Where your contacts came from, and how many of them went on to have a deal or win one, from your records as entered."
      filteredBy={`Filtered by the date each contact was added: ${rangeText}. Deals of any date count. Won value in ${currency || 'no currency chosen'}.`} state={state} onRetry={onRetry} onExport={onExport} empty={empty}>
      <ReportTable caption="Contacts and deals by lead source"
        columns={['Source', 'Contacts', 'With a deal', 'With a won deal', `Won value (${currency || '—'})`, 'Won rate']}
        rows={r.rows.map((x) => [x.label === NO_SOURCE ? <span className="italic">{x.label}</span> : x.label, x.contacts, x.withDeal, x.withWon, currency ? money(x.wonValue) : '—', x.rate == null ? <span title={`Fewer than ${MIN_FOR_RATE} contacts`}>Counts only</span> : pct(x.rate)])} />
      <div className="space-y-1 text-small text-muted-foreground">
        <p><strong className="text-foreground">Won rate</strong> is contacts with a won deal ÷ contacts from that source.{small && ` It is not shown for sources with fewer than ${MIN_FOR_RATE} contacts ("Counts only"), because a percentage of so few people would mislead.`}</p>
        {r.wonElsewhere > 0 && <p>{plural(r.wonElsewhere, 'won deal is', 'won deals are')} in another currency, so {r.wonElsewhere === 1 ? 'it is' : 'they are'} counted in "With a won deal" but not in the won value. Nothing is converted.</p>}
        {r.unlinkedDeals > 0 && <p>{plural(r.unlinkedDeals, 'deal is', 'deals are')} not linked to a contact, so {r.unlinkedDeals === 1 ? 'it is' : 'they are'} not counted against any source.</p>}
      </div>
    </ReportSection>
  );
}

/* ---------- 4. Needs attention ---------- */

const CAP = 10;
function AttentionList<T>({ title, emptyText, items, row }: { title: string; emptyText: string; items: T[]; row: (x: T) => { key: string; to: string; name: string; detail: string } }) {
  const id = useId();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, CAP);
  return (
    <div className="min-w-0 rounded-control border border-border">
      <h4 id={id} className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2 text-body font-semibold text-foreground">
        <span>{title}</span><span className="text-small font-normal text-muted-foreground">{plural(items.length, 'item')}</span>
      </h4>
      {items.length === 0 ? <p className="px-3 py-3 text-small text-muted-foreground">{emptyText}</p> : (
        <ul aria-labelledby={id} className="divide-y divide-border">
          {shown.map((x) => { const r = row(x); return (
            <li key={r.key}>
              <Link to={r.to} className="flex min-h-touch items-center justify-between gap-3 px-3 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring">
                <span className="min-w-0"><span className="block truncate font-medium text-foreground">{r.name}</span><span className="block text-small text-muted-foreground">{r.detail}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground print:hidden" aria-hidden="true" />
              </Link>
            </li>
          ); })}
        </ul>
      )}
      {items.length > CAP && (
        <div className="border-t border-border px-3 py-2 print:hidden">
          <Button variant="ghost" size="sm" className="min-h-touch md:min-h-0" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? `Show first ${CAP}` : `Show all (${items.length})`}</Button>
        </div>
      )}
    </div>
  );
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function NeedsAttentionSection({ contacts, deals, state, onRetry, onExport, onOpenTab, today }: Omit<Common, 'currency' | 'rangeText' | 'rangePhrase'> & { contacts: ReportContact[]; deals: ReportDeal[]; today?: Date }) {
  const { search } = useLocation();
  const n = needsAttention(contacts, deals, today);
  const dealMoney = (d: ReportDeal) => formatMoney(Number(d.value) || 0, d.currency ?? '');
  const empty = contacts.length === 0 && deals.length === 0 ? { message: 'No contacts or deals yet, so nothing needs attention. Add contacts and deals to see follow-ups here.', action: openTab(onOpenTab, 'contacts', 'Open Contacts') } : null;
  return (
    <ReportSection title="Needs attention" description="Open deals and contacts that may need a follow-up, from your records as entered."
      filteredBy="As of today. Not filtered by the date range." state={state} onRetry={onRetry} onExport={onExport} empty={empty}>
      <div className="grid gap-3 lg:grid-cols-3">
        <AttentionList title="Close date has passed" emptyText="No open deal is past its close date." items={n.overdue}
          row={(x) => ({ key: x.deal.id, to: crmRecordSearch(search, 'deal', x.deal.id), name: x.deal.title, detail: `${statusLabel(x.deal.stage)} · closed ${fmtDay(x.day)} (${plural(x.days, 'day')} ago) · ${dealMoney(x.deal)}` })} />
        <AttentionList title={`Not updated for ${STALE_DAYS} days or more`} emptyText={`Every open deal was updated in the last ${STALE_DAYS} days.`} items={n.stale}
          row={(x) => ({ key: x.deal.id, to: crmRecordSearch(search, 'deal', x.deal.id), name: x.deal.title, detail: `${statusLabel(x.deal.stage)} · last updated ${fmtDay(x.day)} (${plural(x.days, 'day')} ago)` })} />
        <AttentionList title={`Leads and prospects not contacted for over ${STALE_DAYS} days`} emptyText={`Every lead and prospect was contacted in the last ${STALE_DAYS} days.`} items={n.cold}
          row={(x) => ({ key: x.contact.id, to: crmRecordSearch(search, 'contact', x.contact.id), name: x.contact.name, detail: `${statusLabel(x.contact.status)} · ${x.day ? `last contact ${fmtDay(x.day)} (${plural(x.days!, 'day')} ago)` : 'no contact recorded'}` })} />
      </div>
    </ReportSection>
  );
}
