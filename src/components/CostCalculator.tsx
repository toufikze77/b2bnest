import { useMemo, useState } from 'react';
import { Calculator, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LINKS_NOTE } from '@/data/ukOfficialLinks';
import { COST_ITEMS, costsCsv, NO_FIGURES_NOTE, parseAmount, STRUCTURES, totals, type Structure } from '@/lib/costCalculator';

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Phase 38: UK business start-up costs (sole trader, partnership, limited company, LLP). Browser only, nothing saved. */
export default function CostCalculator() {
  const [structure, setStructure] = useState<Structure | ''>('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const items = useMemo(() => (structure ? COST_ITEMS[structure] : []), [structure]);
  const t = totals(items, amounts, included);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([costsCsv(items, amounts, included)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `start-up-costs-${structure}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Calculator className="h-6 w-6 text-primary" aria-hidden />Business set-up cost calculator (UK)</h2>
        <p className="text-sm text-muted-foreground">List what it costs to start as a sole trader, a partnership, a limited company or an LLP, and add up the amounts.</p>
        <p className="mt-2 text-sm">{NO_FIGURES_NOTE}</p>
      </header>

      <div className="max-w-sm">
        <Label htmlFor="cc-structure">Business structure</Label>
        <select id="cc-structure" className={FIELD} value={structure} onChange={(e) => { setStructure(e.target.value as Structure | ''); setIncluded({}); }}>
          <option value="">Choose a structure</option>
          {STRUCTURES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {structure && <a className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline" href={STRUCTURES.find((s) => s.id === structure)!.link} target="_blank" rel="noopener noreferrer">About this structure on GOV.UK<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
      </div>

      {!structure ? <p className="text-sm text-muted-foreground" data-testid="cc-empty">Choose a structure to see the steps and costs.</p> : (
        <>
          <ul className="divide-y divide-border rounded-card border border-border bg-card" data-testid="cc-items">
            {items.map((it) => {
              const a = parseAmount(amounts[it.id] ?? '');
              return (
                <li key={it.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_9rem] sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!it.required && (
                        <input type="checkbox" className="h-4 w-4 accent-primary" aria-label={`Include ${it.name}`} checked={!!included[it.id]} onChange={(e) => setIncluded({ ...included, [it.id]: e.target.checked })} />
                      )}
                      <span className="font-medium">{it.name}</span>
                      <Badge variant={it.required ? 'default' : 'outline'}>{it.required ? 'Required' : 'Optional'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{it.note}</p>
                    {it.link && <a className="inline-flex items-center gap-1 text-xs text-primary underline" href={it.link} target="_blank" rel="noopener noreferrer">Official page on GOV.UK<ExternalLink className="h-3 w-3" aria-hidden /></a>}
                  </div>
                  <div>
                    <Label htmlFor={`cc-${it.id}`} className="sr-only">Amount for {it.name} (£)</Label>
                    <Input id={`cc-${it.id}`} inputMode="decimal" placeholder="£ amount" value={amounts[it.id] ?? ''} aria-invalid={a === 'invalid'}
                      onChange={(e) => setAmounts({ ...amounts, [it.id]: e.target.value })} />
                    {a === 'invalid' && <p className="mt-1 text-xs text-destructive">Enter an amount in pounds, for example 120 or 120.50.</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <section aria-live="polite" className="rounded-card border border-border bg-card p-4" data-testid="cc-totals">
            <h3 className="font-semibold">Total of the amounts you entered</h3>
            <p className="text-2xl font-bold tabular-nums">{GBP.format(t.totalPence / 100)}</p>
            <p className="text-sm">Required: {GBP.format(t.requiredPence / 100)} · Optional (included): {GBP.format(t.optionalPence / 100)}</p>
            {t.requiredMissing > 0 && <p className="text-sm text-muted-foreground">{t.requiredMissing} required {t.requiredMissing === 1 ? 'item has' : 'items have'} no amount yet.</p>}
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={exportCsv}><Download className="mr-1 h-4 w-4" aria-hidden />Export CSV</Button>
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">{LINKS_NOTE} General information, not legal, tax or financial advice.</p>
    </div>
  );
}
