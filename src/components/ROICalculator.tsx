import { useMemo, useState } from 'react';
import { Download, Save, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChartCard, ColumnChart } from '@/components/charts';
import { BROWSER_ONLY_NOTE } from '@/lib/freeTools';
import {
  annualisedText, bestByRoi, calculate, EMPTY_FORM, loadScenarios, MAX_SCENARIOS, money, monthsText, percent, RESULT_NOTE, saveScenarios,
  scenariosCsv, validate, verdict, type RoiForm, type RoiResult, type Scenario,
} from '@/lib/roi';

const CARD = 'rounded-card border border-border bg-card p-4 text-card-foreground sm:p-5';

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ROWS: { label: string; value: (r: RoiResult) => string }[] = [
  { label: 'Total cost', value: (r) => money(r.totalCost) },
  { label: 'Total return', value: (r) => money(r.totalReturn) },
  { label: 'Net profit', value: (r) => money(r.netProfit) },
  { label: 'ROI', value: (r) => percent(r.roiPercent) },
  { label: 'Payback', value: (r) => (r.paybackMonths === null ? 'Not paid back in time' : monthsText(r.paybackMonths)) },
  { label: 'Annualised ROI', value: (r) => (r.annualisedRoiPercent === null ? 'Not shown (under a year)' : percent(r.annualisedRoiPercent)) },
  { label: 'Break-even monthly return', value: (r) => money(r.breakEvenMonthlyReturn) },
  { label: 'Net present value', value: (r) => (r.npv === null ? 'No discount rate' : money(r.npv)) },
];

/** Phase 38: a proper ROI calculator. The maths is in src/lib/roi.ts; this only displays it. Browser only. */
export default function ROICalculator() {
  const [form, setForm] = useState<RoiForm>(EMPTY_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof RoiForm, boolean>>>({});
  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios);
  const [notice, setNotice] = useState('');
  const { inputs, errors } = useMemo(() => validate(form), [form]);
  const result = inputs ? calculate(inputs) : null;
  const set = (k: keyof RoiForm, v: string) => { setForm((f) => ({ ...f, [k]: v })); setTouched((t) => ({ ...t, [k]: true })); };
  const err = (k: keyof RoiForm) => (touched[k] ? errors[k] : undefined);
  const aria = (k: keyof RoiForm) => ({ 'aria-invalid': !!err(k), 'aria-describedby': err(k) ? `roi-${k}-error` : undefined });

  const persist = (list: Scenario[], said: string) => {
    setScenarios(list);
    setNotice(saveScenarios(list) ? said : `${said} This browser wouldn't keep it, so it will be gone when you leave the page.`);
  };
  const saveScenario = () => {
    setTouched({ investment: true, totalReturn: true, monthlyReturn: true, months: true, monthlyCost: true, residual: true, discountRate: true, name: true });
    if (!inputs) { setNotice('Fix the fields marked above first.'); return; }
    if (scenarios.length >= MAX_SCENARIOS) { setNotice(`You can compare up to ${MAX_SCENARIOS} scenarios. Delete one first.`); return; }
    const name = form.name.trim() || `Scenario ${scenarios.length + 1}`;
    persist([...scenarios, { id: `${Date.now()}`, name, form, savedAt: new Date().toISOString() }], `Saved "${name}" to compare.`);
  };
  const compared = scenarios.map((s) => { const v = validate(s.form); return v.inputs ? calculate(v.inputs) : null; }).filter((r): r is RoiResult => !!r);
  const best = bestByRoi(compared);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><TrendingUp className="h-6 w-6 text-primary" aria-hidden />ROI Calculator</h1>
        <p className="text-sm text-muted-foreground">Work out the return on an investment: net profit, ROI, payback, annualised ROI, break-even and (with a discount rate) net present value.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form className={`${CARD} space-y-4`} aria-label="ROI inputs" noValidate onSubmit={(e) => { e.preventDefault(); saveScenario(); }}>
          <Field id="roi-name" label="Project name (optional)" error={err('name')}>
            <Input id="roi-name" value={form.name} maxLength={80} placeholder="For example: new delivery van" onChange={(e) => set('name', e.target.value)} {...aria('name')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="roi-investment" label="Initial investment (£)" error={err('investment')}>
              <Input id="roi-investment" inputMode="decimal" value={form.investment} onChange={(e) => set('investment', e.target.value)} {...aria('investment')} />
            </Field>
            <Field id="roi-monthlyCost" label="Ongoing monthly cost (£, optional)" error={err('monthlyCost')}>
              <Input id="roi-monthlyCost" inputMode="decimal" value={form.monthlyCost} onChange={(e) => set('monthlyCost', e.target.value)} {...aria('monthlyCost')} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Expected return</legend>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="roi-mode" checked={form.mode === 'total'} onChange={() => setForm({ ...form, mode: 'total' })} />Total over the timeframe</label>
              <label className="flex items-center gap-2"><input type="radio" name="roi-mode" checked={form.mode === 'monthly'} onChange={() => setForm({ ...form, mode: 'monthly' })} />Each month</label>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {form.mode === 'total' ? (
              <Field id="roi-totalReturn" label="Expected total return (£)" hint="Spread evenly over the months for the payback." error={err('totalReturn')}>
                <Input id="roi-totalReturn" inputMode="decimal" value={form.totalReturn} onChange={(e) => set('totalReturn', e.target.value)} {...aria('totalReturn')} />
              </Field>
            ) : (
              <Field id="roi-monthlyReturn" label="Expected monthly return (£)" error={err('monthlyReturn')}>
                <Input id="roi-monthlyReturn" inputMode="decimal" value={form.monthlyReturn} onChange={(e) => set('monthlyReturn', e.target.value)} {...aria('monthlyReturn')} />
              </Field>
            )}
            <Field id="roi-months" label="Timeframe (months)" error={err('months')}>
              <Input id="roi-months" inputMode="numeric" value={form.months} onChange={(e) => set('months', e.target.value)} {...aria('months')} />
            </Field>
            <Field id="roi-residual" label="Resale or residual value at the end (£, optional)" error={err('residual')}>
              <Input id="roi-residual" inputMode="decimal" value={form.residual} onChange={(e) => set('residual', e.target.value)} {...aria('residual')} />
            </Field>
            <Field id="roi-discountRate" label="Discount rate (% a year, optional)" hint="For net present value. Leave empty for none." error={err('discountRate')}>
              <Input id="roi-discountRate" inputMode="decimal" value={form.discountRate} onChange={(e) => set('discountRate', e.target.value)} {...aria('discountRate')} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={scenarios.length >= MAX_SCENARIOS}><Save className="mr-1 h-4 w-4" aria-hidden />Save to compare ({scenarios.length} of {MAX_SCENARIOS})</Button>
            <Button type="button" variant="ghost" onClick={() => { setForm(EMPTY_FORM); setTouched({}); }}>Clear the form</Button>
          </div>
          <p className="text-xs text-muted-foreground">{BROWSER_ONLY_NOTE}</p>
        </form>

        <section className={CARD} aria-labelledby="roi-results-title">
          <h2 id="roi-results-title" className="text-card-title">Results</h2>
          <div aria-live="polite" data-testid="roi-results">
            {!result ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="roi-empty">Enter the initial investment, the expected return and the timeframe to see the results.</p>
            ) : (
              <>
                <p className="mt-2 font-semibold text-foreground" data-testid="roi-verdict">{verdict(result, inputs!.months)}</p>
                <dl className="mt-3 divide-y divide-border text-sm">
                  {[
                    ['Net profit', money(result.netProfit), 'Total return minus total cost.'],
                    ['ROI', percent(result.roiPercent), `Net profit as a share of the total cost (${money(result.totalCost)}: the investment plus ongoing costs).`],
                    ['Payback period', result.paybackMonths === null ? 'Not paid back within the timeframe' : monthsText(result.paybackMonths), 'How long until the money back covers the investment.'],
                    ['Annualised ROI', result.annualisedRoiPercent === null ? 'Not shown' : percent(result.annualisedRoiPercent), annualisedText(result)],
                    ['Monthly break-even return', money(result.breakEvenMonthlyReturn), 'The monthly return needed just to cover the cost.'],
                    ...(result.npv === null ? [] : [['Net present value', money(result.npv), `Today's value of the money in and out at ${percent(inputs!.discountRate ?? 0)} a year.`]]),
                  ].map(([k, v, why]) => (
                    <div key={k} className="py-2">
                      <dt className="flex justify-between gap-3"><span className="font-medium">{k}</span><span className="tabular-nums">{v}</span></dt>
                      <dd className="text-xs text-muted-foreground">{why}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <p className="mt-3 text-xs text-muted-foreground">{RESULT_NOTE}</p>
          </div>
        </section>
      </div>

      <p aria-live="polite" className="text-sm" data-testid="roi-notice">{notice}</p>

      <section className={CARD} aria-labelledby="roi-compare-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="roi-compare-title" className="text-card-title">Compare scenarios</h2>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={scenarios.length === 0} onClick={() => download('roi-scenarios.csv', scenariosCsv(scenarios))}>
              <Download className="mr-1 h-4 w-4" aria-hidden />Export CSV
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={scenarios.length === 0}
              onClick={() => { if (window.confirm('Delete all saved scenarios from this browser?')) persist([], 'All scenarios deleted.'); }}>Clear all</Button>
          </div>
        </div>
        {scenarios.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="roi-no-scenarios">No scenarios saved yet. Fill in the form and choose "Save to compare" (up to {MAX_SCENARIOS}).</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm" data-testid="roi-compare">
              <caption className="sr-only">Saved scenarios side by side</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-2">Measure</th>
                  {scenarios.map((s, i) => (
                    <th key={s.id} scope="col" className="py-2 pr-2 align-top">
                      <span className="block">{s.name}{i === best && scenarios.length > 1 ? ' (best ROI)' : ''}</span>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-1" aria-label={`Delete ${s.name}`} onClick={() => persist(scenarios.filter((x) => x.id !== s.id), `Deleted "${s.name}".`)}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-2 pr-2 text-left font-medium">{row.label}</th>
                    {compared.map((r, i) => <td key={scenarios[i].id} className="py-2 pr-2 tabular-nums">{row.value(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {scenarios.length > 0 && (
        <ChartCard
          title="ROI by scenario" subtitle="Net profit as a share of the total cost."
          summary={`ROI by scenario: ${scenarios.map((s, i) => `${s.name} ${percent(compared[i]?.roiPercent ?? 0)}`).join(', ')}.`}
          table={{ caption: 'ROI by scenario', columns: ['Scenario', 'ROI'], rows: scenarios.map((s, i) => [s.name, percent(compared[i]?.roiPercent ?? 0)]) }}
        >
          <ColumnChart data={scenarios.map((s, i) => ({ label: s.name, value: compared[i]?.roiPercent ?? 0 }))} seriesLabel="ROI" format={(n) => percent(n)} axisTitle="ROI (%)" />
        </ChartCard>
      )}
    </div>
  );
}
