import { useEffect, useState } from 'react';
import { BellRing, Loader2, Printer, Scale, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messageFor, type VatObligation } from '@/lib/hmrcConnection';
import { ukDay } from '@/lib/hmrcVat';
import {
  deadlineReminder, gbp, getLiabilities, getPayments, getPenalties, isAmountField, last365, LIABILITY_SCENARIOS, NOT_AVAILABLE, PAYMENT_SCENARIOS,
  PENALTIES_NOTE, PENALTY_LABELS, PENALTY_SCENARIOS, rangeProblem, reminderText, SANDBOX_DATA_NOTE, SENT_VIA, viewReturn, type ReadResult,
} from '@/lib/hmrcVatReads';
import { FIGURE_ROWS, type SubmissionRecord } from '@/lib/hmrcVatSubmit';

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const fmtBox = (n: number, v: unknown) => (typeof v !== 'number' ? '—' : n <= 5 ? v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toLocaleString('en-GB'));
const failText = (r: ReadResult) => (r.code === 'not_available' ? NOT_AVAILABLE : r.message ?? messageFor(r.code));

/** HMRC P8: an in-app reminder when an open return is due within 14, 7 or 1 days, or is overdue. No HMRC call. */
export function HMRCDeadlineBanner({ obligations, today }: { obligations: VatObligation[] | null; today?: string }) {
  const r = deadlineReminder(obligations, today);
  if (!r) return null;
  const urgent = r.level === 'overdue' || r.level === 'due_1';
  return (
    <Alert role={urgent ? 'alert' : 'status'} data-testid={`vatr-reminder-${r.level}`}
      className={urgent ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50'}>
      <BellRing className="h-4 w-4" aria-hidden />
      <AlertTitle>{r.level === 'overdue' ? 'A VAT return is overdue' : 'A VAT return is due soon'}</AlertTitle>
      <AlertDescription>
        {reminderText(r, ukDay(r.due))} This comes from the obligations HMRC's test environment showed on this page.
      </AlertDescription>
    </Alert>
  );
}

/** HMRC P8: "Check what HMRC holds" for one accepted submission: matches, or the boxes that differ. */
export function CheckWithHmrc({ companyId, row }: { companyId: string; row: SubmissionRecord }) {
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ReadResult | null>(null);
  const check = async () => { setBusy(true); setR(null); setR(await viewReturn(companyId, row.period_key)); setBusy(false); };
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" onClick={() => { void check(); }} disabled={busy} data-testid="vats-hmrc-check">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Search className="mr-2 h-4 w-4" aria-hidden />}Check what HMRC holds
      </Button>
      <div role="status" aria-live="polite">
        {r && !r.ok && <p className="text-xs" data-testid={`vats-hmrc-check-${r.code === 'not_available' ? 'not-available' : 'error'}`}>{failText(r)}</p>}
        {r?.ok && r.matches && <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200" data-testid="vats-hmrc-matches">Matches what you sent.</p>}
        {r?.ok && !r.matches && (
          <div className="text-xs" data-testid="vats-hmrc-differs">
            <p className="font-medium">HMRC holds different figures for {r.differences?.length === 1 ? 'one box' : `${r.differences?.length} boxes`}:</p>
            <ul className="list-disc pl-4">
              {(r.differences ?? []).map((d) => <li key={d.box}>Box {d.box}: you sent {fmtBox(d.box, d.ours)}, HMRC holds {fmtBox(d.box, d.hmrc)}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** HMRC P8: the receipt for an accepted submission, from our stored row only (no HMRC call). Prints as a PDF. */
export function HMRCVATReceipt({ row, companyName, onClose }: { row: SubmissionRecord; companyName: string; onClose: () => void }) {
  const print = () => {
    document.body.classList.add('print-hmrc-receipt');
    const done = () => { document.body.classList.remove('print-hmrc-receipt'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };
  useEffect(() => () => { document.body.classList.remove('print-hmrc-receipt'); }, []);
  return (
    <section id="hmrc-receipt" aria-labelledby="hmrc-receipt-title" className="space-y-3 rounded-md border bg-background p-4 text-foreground" data-testid="vats-receipt">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 id="hmrc-receipt-title" className="text-base font-semibold">VAT return receipt: {row.period_key}</h4>
          <p className="text-sm font-medium" data-testid="vats-receipt-test">HMRC TEST ENVIRONMENT (sandbox): nothing was filed with HMRC for real.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={print} data-testid="vats-receipt-print"><Printer className="mr-2 h-4 w-4" aria-hidden />Print or save as PDF</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto,1fr]">
        <dt className="text-muted-foreground">Company</dt><dd>{companyName}</dd>
        <dt className="text-muted-foreground">VAT number ends</dt><dd>{row.vrn_last3 ? `…${row.vrn_last3}` : '—'}</dd>
        <dt className="text-muted-foreground">Period</dt><dd>{ukDay(row.period_start)} to {ukDay(row.period_end)} ({row.period_key})</dd>
        <dt className="text-muted-foreground">Submitted</dt><dd>{when(row.submitted_at)}{row.submitted_by_name ? ` by ${row.submitted_by_name}` : ''}</dd>
        <dt className="text-muted-foreground">HMRC processing date</dt><dd>{when(row.processing_date) || '—'}</dd>
        <dt className="text-muted-foreground">Form bundle number</dt><dd className="font-mono" data-testid="vats-receipt-bundle">{row.form_bundle_number ?? '—'}</dd>
        {row.payment_indicator && <><dt className="text-muted-foreground">Payment indicator</dt><dd>{row.payment_indicator}</dd></>}
        {row.charge_ref_number && <><dt className="text-muted-foreground">Charge reference</dt><dd className="font-mono">{row.charge_ref_number}</dd></>}
      </dl>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">The nine boxes sent</caption>
        <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-1 pr-2">Box</th><th scope="col" className="py-1 text-right">Sent (£)</th></tr></thead>
        <tbody>
          {FIGURE_ROWS.map(([k, n, label]) => (
            <tr key={k} className="border-b"><th scope="row" className="py-1 pr-2 font-normal">{n}. {label}</th><td className="py-1 text-right font-mono tabular-nums" data-testid={`vats-receipt-box-${n}`}>{fmtBox(n, row.figures?.[k])}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm font-medium">{SENT_VIA} (test environment).</p>
    </section>
  );
}

/** HMRC P8: "What you owe and what HMRC received" (liabilities and payments) and the penalties HMRC shows. */
export default function HMRCVATAccount({ companyId, ready }: { companyId: string; ready: boolean }) {
  const [range, setRange] = useState(last365());
  const [lScenario, setLScenario] = useState('');
  const [pScenario, setPScenario] = useState('');
  const [busy, setBusy] = useState(false);
  const [owe, setOwe] = useState<{ l: ReadResult; p: ReadResult } | null>(null);
  const [penScenario, setPenScenario] = useState('');
  const [penBusy, setPenBusy] = useState(false);
  const [pen, setPen] = useState<ReadResult | null>(null);
  const problem = rangeProblem(range.from, range.to);

  const load = async () => {
    if (problem) return;
    setBusy(true); setOwe(null);
    const [l, p] = await Promise.all([getLiabilities(companyId, range.from, range.to, lScenario || undefined), getPayments(companyId, range.from, range.to, pScenario || undefined)]);
    setOwe({ l, p }); setBusy(false);
  };
  const loadPen = async () => { setPenBusy(true); setPen(null); setPen(await getPenalties(companyId, penScenario || undefined)); setPenBusy(false); };

  if (!ready) {
    return (
      <Card data-testid="vata-section">
        <CardHeader><CardTitle className="text-lg">What you owe and what HMRC received (test environment)</CardTitle></CardHeader>
        <CardContent><p className="text-sm" data-testid="vata-not-connected">Connect this company to HMRC's test environment in Settings → HMRC first.</p></CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <Card data-testid="vata-section">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">What you owe and what HMRC received (test environment)</CardTitle>
          <p className="text-sm text-muted-foreground" data-testid="vata-sandbox-note">{SANDBOX_DATA_NOTE} Read live each time; nothing is stored in B2BNEST.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-1"><Label htmlFor="vata-from">From</Label><Input id="vata-from" type="date" value={range.from} aria-invalid={!!problem} aria-describedby={problem ? 'vata-range-error' : undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="vata-to">To</Label><Input id="vata-to" type="date" value={range.to} aria-invalid={!!problem} aria-describedby={problem ? 'vata-range-error' : undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label htmlFor="vata-l-scenario">Liabilities test scenario</Label>
              <select id="vata-l-scenario" className={selectCls} value={lScenario} onChange={(e) => setLScenario(e.target.value)}>
                <option value="">None</option>{LIABILITY_SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vata-p-scenario">Payments test scenario</Label>
              <select id="vata-p-scenario" className={selectCls} value={pScenario} onChange={(e) => setPScenario(e.target.value)}>
                <option value="">None</option>{PAYMENT_SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">HMRC's sandbox scenarios use dates in 2017 and 2018: choose those dates to see their test data.</p>
          {problem && <p id="vata-range-error" role="alert" className="text-sm text-destructive" data-testid="vata-range-error">{problem}</p>}
          <Button type="button" onClick={() => { void load(); }} disabled={busy || !!problem} data-testid="vata-load">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Scale className="mr-2 h-4 w-4" aria-hidden />}Get liabilities and payments from HMRC
          </Button>
          {owe && (
            <div className="grid gap-4 md:grid-cols-2" role="status" aria-live="polite">
              <div data-testid="vata-liabilities">
                <h4 className="mb-1 text-sm font-semibold">What HMRC says you owe</h4>
                {!owe.l.ok ? <p className="text-sm" data-testid="vata-liabilities-error">{failText(owe.l)}</p>
                  : !(owe.l.liabilities ?? []).length ? <p className="text-sm text-muted-foreground" data-testid="vata-liabilities-empty">HMRC shows no liabilities for these dates.</p>
                  : (
                    <div className="overflow-x-auto"><table className="w-full min-w-[360px] text-left text-sm">
                      <caption className="sr-only">VAT liabilities from HMRC's test environment</caption>
                      <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-1 pr-2">What</th><th scope="col" className="py-1 pr-2">Due</th><th scope="col" className="py-1 pr-2 text-right">Charged</th><th scope="col" className="py-1 text-right">Still owed</th></tr></thead>
                      <tbody>{(owe.l.liabilities ?? []).map((x, i) => (
                        <tr key={i} className="border-b align-top" data-testid="vata-liability-row">
                          <td className="py-1 pr-2">{x.type}{x.taxPeriod && <span className="block text-xs text-muted-foreground">{ukDay(x.taxPeriod.from)} to {ukDay(x.taxPeriod.to)}</span>}</td>
                          <td className="py-1 pr-2">{x.due ? ukDay(x.due) : '—'}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{gbp(x.originalAmount)}</td>
                          <td className="py-1 text-right tabular-nums">{gbp(x.outstandingAmount)}</td>
                        </tr>))}</tbody>
                    </table></div>
                  )}
              </div>
              <div data-testid="vata-payments">
                <h4 className="mb-1 text-sm font-semibold">What HMRC received</h4>
                {!owe.p.ok ? <p className="text-sm" data-testid="vata-payments-error">{failText(owe.p)}</p>
                  : !(owe.p.payments ?? []).length ? <p className="text-sm text-muted-foreground" data-testid="vata-payments-empty">HMRC shows no payments for these dates.</p>
                  : (
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">VAT payments from HMRC's test environment</caption>
                      <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-1 pr-2">Received</th><th scope="col" className="py-1 text-right">Amount</th></tr></thead>
                      <tbody>{(owe.p.payments ?? []).map((x, i) => (
                        <tr key={i} className="border-b" data-testid="vata-payment-row"><td className="py-1 pr-2">{x.received ? ukDay(x.received) : '—'}</td><td className="py-1 text-right tabular-nums">{gbp(x.amount)}</td></tr>))}</tbody>
                    </table>
                  )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="vatp-section">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Penalties (test environment)</CardTitle>
          <p className="text-sm" data-testid="vatp-note">{PENALTIES_NOTE}</p>
          <p className="text-xs text-muted-foreground">{SANDBOX_DATA_NOTE}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 sm:max-w-sm">
            <Label htmlFor="vatp-scenario">Test scenario</Label>
            <select id="vatp-scenario" className={selectCls} value={penScenario} onChange={(e) => setPenScenario(e.target.value)}>
              <option value="">None</option>{PENALTY_SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => { void loadPen(); }} disabled={penBusy} data-testid="vatp-load">
            {penBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Get penalties from HMRC
          </Button>
          <div role="status" aria-live="polite">
            {pen && !pen.ok && <p className="text-sm" data-testid="vatp-error">{failText(pen)}</p>}
            {pen?.ok && pen.penalties && <PenaltyView p={pen.penalties} />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FlatList({ o, testid }: { o: Record<string, string | number | boolean>; testid: string }) {
  const keys = Object.keys(o);
  if (!keys.length) return null;
  return (
    <dl className="grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-[auto,1fr]" data-testid={testid}>
      {keys.map((k) => <div key={k} className="contents"><dt className="text-muted-foreground">{PENALTY_LABELS[k] ?? k}</dt><dd className="tabular-nums">{typeof o[k] === 'number' && isAmountField(k) ? gbp(o[k] as number) : String(o[k])}</dd></div>)}
    </dl>
  );
}
function PenaltyView({ p }: { p: NonNullable<ReadResult['penalties']> }) {
  const none = !Object.keys(p.totalisations).length && !Object.keys(p.lateSubmission.summary).length && !p.lateSubmission.details.length && !p.latePayment.details.length;
  if (none) return <p className="text-sm" data-testid="vatp-none">HMRC shows no penalties.</p>;
  return (
    <div className="space-y-4" data-testid="vatp-result">
      <FlatList o={p.totalisations} testid="vatp-totals" />
      {(Object.keys(p.lateSubmission.summary).length > 0 || p.lateSubmission.details.length > 0) && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Late submission</h4>
          <FlatList o={p.lateSubmission.summary} testid="vatp-lsp-summary" />
          {p.lateSubmission.details.map((d, i) => <details key={i} className="rounded border p-2"><summary className="cursor-pointer text-sm">Late submission penalty {String(d.penaltyNumber ?? i + 1)}</summary><FlatList o={d} testid="vatp-lsp-detail" /></details>)}
        </div>
      )}
      {p.latePayment.details.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Late payment</h4>
          {p.latePayment.details.map((d, i) => <details key={i} className="rounded border p-2"><summary className="cursor-pointer text-sm">Late payment penalty {String(d.penaltyChargeReference ?? d.principalChargeReference ?? i + 1)}</summary><FlatList o={d} testid="vatp-lpp-detail" /></details>)}
        </div>
      )}
    </div>
  );
}
