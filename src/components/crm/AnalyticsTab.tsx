import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChartCard, ColumnChart, Donut, StatTile, TrendChart } from '@/components/charts';
import { pct } from '@/components/charts/chartTheme';
import {
  AnalyticsContact, AnalyticsDeal, averageWonDeal, contactsAdded, dealsInCurrency, excludedNote, isWon, leadSources, monthlyWon, winRate,
} from '@/lib/crmAnalytics';
import { currencySymbol, formatMoney, normalizeCurrency } from '@/lib/money';
import { useReportCurrency } from '@/hooks/useReportCurrency';
import CurrencySelector from './CurrencySelector';

interface AnalyticsTabProps {
  contacts: AnalyticsContact[];
  deals: AnalyticsDeal[];
  error?: boolean;
  onRetry?: () => void;
  /** Switch CRM tab (for "Add your first contact / deal"). */
  onOpenTab?: (tab: string) => void;
}

/** 6 or 12 months, as a segmented control. */
export function RangeControl({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-control border bg-muted p-1">
      {[6, 12].map((n) => (
        <Button key={n} size="sm" variant={value === n ? 'default' : 'ghost'} aria-pressed={value === n} className="min-h-touch md:min-h-0" onClick={() => onChange(n)}>{n} months</Button>
      ))}
    </div>
  );
}

/** Currency picker for Reports and Analytics. The tab owns the state (one useReportCurrency per tab) and passes it in. */
export function ReportCurrencyControl({ deals, rc }: { deals: { currency?: string | null }[]; rc: ReturnType<typeof useReportCurrency> }) {
  const { currency, setCurrency, reset, isCustom, account } = rc;
  const stored = Array.from(new Set(deals.map((d) => normalizeCurrency(d.currency)).filter(Boolean)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="report-currency" className="text-small font-semibold text-foreground">Currency</label>
      <CurrencySelector id="report-currency" value={currency} onValueChange={setCurrency} extraCodes={stored} className="h-11 w-56 md:h-10" />
      {isCustom && (
        <button type="button" onClick={reset} className="min-h-touch rounded-sm text-small font-semibold text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0">
          Reset to account currency ({account})
        </button>
      )}
    </div>
  );
}

const AnalyticsTab = ({ contacts, deals, error, onRetry, onOpenTab }: AnalyticsTabProps) => {
  const rc = useReportCurrency();
  const { currency } = rc;
  const [wonRange, setWonRange] = useState(6);
  const [addedRange, setAddedRange] = useState(6);
  const money = (n: number) => formatMoney(n, currency);
  const state = error ? 'error' as const : 'ready' as const;

  const sources = useMemo(() => leadSources(contacts), [contacts]);
  const won = useMemo(() => monthlyWon(deals, currency, wonRange), [deals, currency, wonRange]);
  const added = useMemo(() => contactsAdded(contacts, addedRange), [contacts, addedRange]);
  const rate = useMemo(() => winRate(deals), [deals]);
  const avg = useMemo(() => averageWonDeal(deals), [deals]);
  const avgHere = avg.find((a) => a.currency === currency);
  const wonInCurrency = dealsInCurrency(deals.filter((d) => isWon(d.stage)), currency);
  const note = excludedNote(wonInCurrency.excluded);
  const sym = currencySymbol(currency);
  const addAction = (tab: 'contacts' | 'deals', text: string) => onOpenTab && <Button size="sm" variant="outline" onClick={() => onOpenTab(tab)}>{text}</Button>;
  const anyWonInRange = won.rows.some((r) => r.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-card-title text-foreground">Analytics</h2>
          <p className="text-small text-muted-foreground">Worked out from your own contacts and deals. Money figures use one currency and are never converted.</p>
        </div>
        <ReportCurrencyControl deals={deals} rc={rc} />
      </div>
      {!currency && <p role="note" className="rounded-control border border-border bg-muted p-3 text-small text-foreground">Your account has no currency set yet, so money charts are empty. Choose a currency above, or set one in Settings.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
        <StatTile label="Win rate" value={rate.rate == null ? null : pct(rate.rate)} hint={rate.rate == null ? 'Needs at least one won or lost deal.' : `${rate.won} won of ${rate.won + rate.lost} won or lost deals.`} />
        <StatTile label={`Average won deal${currency ? ` (${currency})` : ''}`} value={avgHere ? money(avgHere.average) : null} hint={avgHere ? `Across ${avgHere.count} won ${avgHere.count === 1 ? 'deal' : 'deals'} in ${currency}.` : `No won deals in ${currency || 'this currency'} yet.`} />
        <StatTile label="Won deals" value={String(wonInCurrency.included.length)} hint={`Stored in ${currency || 'the chosen currency'}.`} />
        <StatTile label="Contacts" value={String(contacts.length)} hint="Your own CRM contacts." />
      </div>
      {note && <p className="text-small text-muted-foreground">{note}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Lead sources"
          subtitle="Where your contacts came from, by the Source field."
          state={error ? 'error' : contacts.length === 0 ? 'empty' : 'ready'}
          onRetry={onRetry}
          empty={{ message: 'No contacts yet, so there are no lead sources to show.', action: addAction('contacts', 'Add your first contact') }}
          summary={`Lead sources for ${contacts.length} contacts. ${sources.slice(0, 3).map((s) => `${s.label}: ${s.count}`).join('; ')}.`}
          table={{ caption: 'Lead sources', columns: ['Source', 'Contacts', 'Share'], rows: sources.map((s) => [s.label, s.count, pct(s.share)]) }}
        >
          <Donut data={sources.map((s) => ({ label: s.label, value: s.count }))} totalLabel="contacts" />
        </ChartCard>

        <ChartCard
          title="Won deals per month"
          subtitle={`By close date, ${currency || 'no currency chosen'} only.`}
          controls={<RangeControl value={wonRange} onChange={setWonRange} label="Months shown for won deals" />}
          state={error ? 'error' : !currency || !anyWonInRange ? 'empty' : state}
          onRetry={onRetry}
          empty={{ message: deals.length === 0 ? 'No deals yet.' : `No won deals in ${currency || 'this currency'} with a close date in the last ${wonRange} months.`, action: addAction('deals', deals.length === 0 ? 'Add your first deal' : 'Open the pipeline') }}
          summary={`Won deals by close month in ${currency}: ${won.rows.filter((r) => r.count).map((r) => `${r.label} ${r.count} worth ${money(r.value)}`).join('; ')}.`}
          table={{ caption: `Won deals per month in ${currency}`, columns: ['Month', `Value (${currency})`, 'Deals'], rows: won.rows.map((r) => [r.label, money(r.value), r.count]) }}
          footer={<>
            {won.noCloseDate > 0 && <p>{won.noCloseDate} won {won.noCloseDate === 1 ? 'deal has' : 'deals have'} no close date, so {won.noCloseDate === 1 ? 'it is' : 'they are'} not placed in a month.</p>}
            {won.outsideRange > 0 && <p>{won.outsideRange} won {won.outsideRange === 1 ? 'deal closed' : 'deals closed'} before this range.</p>}
          </>}
        >
          <div className="space-y-4">
            <ColumnChart data={won.rows.map((r) => ({ label: r.label, value: r.value }))} seriesLabel="Value" format={money} axisTitle={`Value${sym ? ` (${sym})` : ''}`} height={180} />
            <TrendChart data={won.rows.map((r) => ({ label: r.label, deals: r.count }))} series={[{ key: 'deals', label: 'Won deals' }]} axisTitle="Number of won deals" height={130} />
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Contacts added and how many became customers"
        subtitle="By the month each contact was added. “Customers now” is today’s status: there is no record of when a contact converted."
        controls={<RangeControl value={addedRange} onChange={setAddedRange} label="Months shown for contacts added" />}
        state={error ? 'error' : contacts.length === 0 ? 'empty' : 'ready'}
        onRetry={onRetry}
        empty={{ message: 'No contacts yet.', action: addAction('contacts', 'Add your first contact') }}
        summary={`Contacts added per month over the last ${addedRange} months, and how many of them are customers now.`}
        table={{ caption: 'Contacts added per month', columns: ['Month', 'Added', 'Customers now', 'Share now'], rows: added.rows.map((r) => [r.label, r.added, r.customersNow, r.rate == null ? '—' : pct(r.rate)]) }}
        footer={<>
          {added.rows.some((r) => r.rate != null)
            ? <p>Share that are customers now: {added.rows.filter((r) => r.rate != null).map((r) => `${r.label} ${pct(r.rate!)}`).join(' · ')}. Shown only for months with at least 5 new contacts.</p>
            : <p>A customer share is shown for months with at least 5 new contacts; none has that many yet.</p>}
          {added.noDate > 0 && <p>{added.noDate} {added.noDate === 1 ? 'contact has' : 'contacts have'} no created date and {added.noDate === 1 ? 'is' : 'are'} not counted.</p>}
        </>}
      >
        <TrendChart data={added.rows.map((r) => ({ label: r.label, added: r.added, customers: r.customersNow }))} series={[{ key: 'added', label: 'Contacts added' }, { key: 'customers', label: 'Of those, customers now' }]} axisTitle="Contacts" />
      </ChartCard>
    </div>
  );
};

export default AnalyticsTab;
