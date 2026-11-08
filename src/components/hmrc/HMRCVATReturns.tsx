import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Download, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useDemoMode } from '@/contexts/demoModeState';
import { fetchHmrcStatus, HMRC_PLAN_MESSAGE, messageFor, type HmrcStatus } from '@/lib/hmrcConnection';
import { getVatObligations, isoDay, lastYear, PRODUCTION_NOT_AVAILABLE, rangeDays, ukDay, type VatObligation } from '@/lib/hmrcVat';
import { fetchReturnPreview, NOT_AVAILABLE_YET, ONLY_ADMINS, previousQuarter, type PreviewFailure } from '@/lib/vatReturnPreview';
import {
  BOX_NUMBERS, BOX_TITLES, boxValue, computeReturnBoxes, explainBox, formatBox, isUnsupportedBox, LEFT_OUT_TEXT, returnPreviewCsv,
  VAT_TREATMENT_SHORT, type LeftOut, type ReturnBoxes, type TreatmentTotal,
} from '@/lib/vat';
import { HMRCFilingBanner } from '@/components/hmrc/filingStatus';
import HMRCVATSubmit, { type SubmitAccess } from '@/components/hmrc/HMRCVATSubmit';

const FINANCE = '/business-tools?tool=business-finance-assistant';
const linkCls = 'font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const money = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SOURCE_NOUN: Record<LeftOut['source'], [string, string]> = { invoices: ['invoice', 'invoices'], expenses: ['expense', 'expenses'], bills: ['bill', 'bills'] };

/** Where the person can fix what was left out (null: nothing to fix, or no screen for it). */
function fixLink(l: LeftOut): { to: string; text: string } | null {
  if (l.reason === 'no_company') return { to: `${FINANCE}&tab=company-records`, text: 'Finance → Company records' };
  if (l.source === 'bills') return null; // bills have no screen in B2BNEST
  if (l.reason === 'not_recorded' || l.reason === 'not_gbp' || l.reason === 'draft' || l.reason === 'archived') {
    return l.source === 'invoices' ? { to: `${FINANCE}&tab=invoices`, text: 'Finance → Invoices' } : { to: `${FINANCE}&tab=expenses`, text: 'Finance → Expenses' };
  }
  return null;
}

const failureText = (k: PreviewFailure, company: string): string => ({
  not_available: NOT_AVAILABLE_YET,
  denied: ONLY_ADMINS,
  plan: HMRC_PLAN_MESSAGE,
  two_step: messageFor('two_step_required'),
  demo: 'This is a demo account, so there is no VAT return here.',
  invalid: 'Choose a start date on or before the end date.',
  error: `We couldn't work out the preview for ${company}. Please try again.`,
}[k]);

/**
 * HMRC P5: the VAT return PREVIEW. The nine boxes for a period, worked out from the company's VAT-recorded invoices,
 * expenses and bills (public.vat_company_return_preview: totals only), how each box was built, and what was left out
 * and why. Nothing is sent to HMRC, nothing is stored, and there is no submit button. Standard scheme only; the rules
 * are not verified against HMRC (src/lib/vat/returnRules.ts).
 */
export default function HMRCVATReturns() {
  const { organizationId, organization, memberships, loading: orgLoading } = useActiveOrganization();
  const { isDemo } = useDemoMode();
  const company = organization?.name ?? 'this company';
  const isAdmin = organization?.role === 'owner' || organization?.role === 'admin';
  const [status, setStatus] = useState<HmrcStatus | null>(null);
  const [mode, setMode] = useState<'dates' | 'obligation'>('dates');
  const [range, setRange] = useState(previousQuarter());
  const [obligations, setObligations] = useState<VatObligation[] | null>(null);
  const [obligationKey, setObligationKey] = useState('');
  const [obligationsBusy, setObligationsBusy] = useState(false);
  const [obligationsNote, setObligationsNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<PreviewFailure | null>(null);
  const [result, setResult] = useState<{ boxes: ReturnBoxes; from: string; to: string; confirmed: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    setStatus(null); setResult(null); setFailure(null); setObligations(null); setObligationKey('');
    if (organizationId && !isDemo) void fetchHmrcStatus(organizationId).then((s) => { if (live) setStatus(s); });
    return () => { live = false; };
  }, [organizationId, isDemo]);

  const connected = status?.kind === 'ok' && !status.production && !!status.connection && status.connection.status === 'connected'
    && status.connection.scopes.includes('read:vat') && status.canManage;
  const conn = status?.kind === 'ok' && !status.production ? status.connection : null;
  const submitAccess: SubmitAccess = !conn || conn.status !== 'connected' ? 'not_connected'
    : conn.scopes.includes('read:vat') && conn.scopes.includes('write:vat') ? 'ready' : 'scope_missing';
  const chosen = obligations?.find((o) => o.periodKey === obligationKey) ?? null;
  const period = mode === 'obligation' && chosen ? { from: chosen.start, to: chosen.end } : range;
  const days = rangeDays(period.from, period.to);
  const periodError = days === null || days < 1 ? 'Choose a start date on or before the end date.' : '';

  const loadObligations = async () => {
    if (!organizationId) return;
    setObligationsBusy(true); setObligationsNote('');
    const [open, done] = await Promise.all([getVatObligations(organizationId, { status: 'O' }), getVatObligations(organizationId, { status: 'F', ...lastYear() })]);
    setObligationsBusy(false);
    const list = [...(open.ok ? open.obligations ?? [] : []), ...(done.ok ? done.obligations ?? [] : [])].sort((a, b) => b.start.localeCompare(a.start));
    if (!open.ok && !done.ok) { setObligationsNote(`HMRC's obligations couldn't be read (${open.message ?? messageFor(open.code)}). Choose dates instead: the period is then not confirmed by HMRC.`); return; }
    setObligations(list);
    if (!list.length) setObligationsNote('HMRC returned no VAT obligations. Choose dates instead: the period is then not confirmed by HMRC.');
    else setObligationKey(list[0].periodKey);
  };

  const show = async () => {
    if (!organizationId || periodError) return;
    setBusy(true); setFailure(null); setResult(null);
    const r = await fetchReturnPreview(organizationId, period.from, period.to);
    setBusy(false);
    if ('kind' in r) { setFailure(r.kind); return; }
    setResult({ boxes: computeReturnBoxes(r.rows), from: period.from, to: period.to, confirmed: mode === 'obligation' && !!chosen });
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([returnPreviewCsv(result.boxes, { from: result.from, to: result.to })], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vat-return-preview_${result.from}_${result.to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const gate = (): JSX.Element | null => {
    if (orgLoading) return <p className="text-sm text-muted-foreground" data-testid="vatr-loading">Loading…</p>;
    if (!organizationId || memberships.length === 0) return <p className="text-sm text-muted-foreground" data-testid="vatr-no-company">Create or join a company to see its VAT return.</p>;
    if (isDemo) return <p className="text-sm" data-testid="vatr-demo">This is a demo account, so there is no VAT return here.</p>;
    if (!status) return <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="vatr-checking"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking access…</p>;
    if (status.kind === 'ended') {
      return (
        <p className="text-sm" data-testid="vatr-plan">
          {status.reason === 'plan_not_included' ? HMRC_PLAN_MESSAGE : messageFor(status.reason)}{' '}
          {status.reason !== 'suspended' && <Link to="/pricing" className={linkCls}>See plans</Link>}
        </p>
      );
    }
    if (status.kind === 'two_step') return <p className="text-sm" data-testid="vatr-two-step">{messageFor('two_step_required')}</p>;
    if (status.kind === 'ok' && status.production) return <p className="text-sm" data-testid="vatr-production">{PRODUCTION_NOT_AVAILABLE}</p>;
    if (!isAdmin || status.kind === 'no_access' || (status.kind === 'ok' && !status.canManage)) return <p className="text-sm" data-testid="vatr-member">{ONLY_ADMINS}</p>;
    return null;
  };

  const blocked = gate();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">VAT return</h2>
        <p className="text-muted-foreground">A preview of the nine VAT return boxes for {company}, worked out from your VAT-recorded invoices, expenses and bills. Standard scheme only.</p>
      </div>

      <HMRCFilingBanner
        description="Preview only: nothing is sent to HMRC. These figures come from your records in B2BNEST; nothing is filed or stored. The rules used are not verified against HMRC's guidance: check the figures with your accountant before you file with HMRC yourself." />

      {blocked ?? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Period</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="flex flex-wrap gap-4">
                <legend className="sr-only">How to choose the period</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="vatr-mode" checked={mode === 'dates'} onChange={() => setMode('dates')} />Choose dates
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="vatr-mode" checked={mode === 'obligation'} onChange={() => setMode('obligation')} disabled={!connected} />
                  Use an HMRC obligation{!connected && ' (connect this company to HMRC first)'}
                </label>
              </fieldset>
              {mode === 'dates' ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
                  <div className="space-y-1"><Label htmlFor="vatr-from">From</Label><Input id="vatr-from" type="date" aria-invalid={!!periodError} aria-describedby={periodError ? 'vatr-period-error' : undefined} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
                  <div className="space-y-1"><Label htmlFor="vatr-to">To</Label><Input id="vatr-to" type="date" aria-invalid={!!periodError} aria-describedby={periodError ? 'vatr-period-error' : undefined} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
                </div>
              ) : (
                <div className="space-y-2 lg:max-w-xl">
                  <Button type="button" variant="outline" onClick={() => { void loadObligations(); }} disabled={obligationsBusy} data-testid="vatr-get-obligations">
                    {obligationsBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CalendarClock className="mr-2 h-4 w-4" aria-hidden />}Get obligations from HMRC (test environment)
                  </Button>
                  {obligations && obligations.length > 0 && (
                    <div className="space-y-1">
                      <Label htmlFor="vatr-obligation">Obligation</Label>
                      <select id="vatr-obligation" className={selectCls} value={obligationKey} onChange={(e) => setObligationKey(e.target.value)}>
                        {obligations.map((o) => <option key={o.periodKey} value={o.periodKey}>{ukDay(o.start)} to {ukDay(o.end)} ({o.status === 'F' ? 'fulfilled' : 'open'}, due {ukDay(o.due)})</option>)}
                      </select>
                    </div>
                  )}
                  {obligationsNote && <p className="text-sm" role="status" data-testid="vatr-obligations-note">{obligationsNote}</p>}
                </div>
              )}
              {mode === 'dates' && <p className="text-xs text-muted-foreground" data-testid="vatr-not-confirmed">Dates you choose are not confirmed by HMRC.</p>}
              {periodError && <p id="vatr-period-error" role="alert" className="text-sm text-destructive" data-testid="vatr-period-error">{periodError}</p>}
              <Button type="button" onClick={() => { void show(); }} disabled={busy || !!periodError || (mode === 'obligation' && !chosen)} data-testid="vatr-show">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Show the preview
              </Button>
            </CardContent>
          </Card>

          {failure && (
            <Alert role="alert" data-testid={`vatr-failure-${failure}`}>
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <AlertDescription>
                {failureText(failure, company)}
                {failure === 'error' && <Button variant="link" className="h-auto p-0 pl-2" onClick={() => { void show(); }}>Try again</Button>}
              </AlertDescription>
            </Alert>
          )}
          {result && <Preview result={result} onDownload={download} />}
          {/* HMRC P6: submitting to HMRC's TEST environment (owners and admins; production is never offered). */}
          {organizationId && <HMRCVATSubmit companyId={organizationId} companyName={company} access={submitAccess} />}
        </>
      )}
    </div>
  );
}

function Preview({ result, onDownload }: { result: { boxes: ReturnBoxes; from: string; to: string; confirmed: boolean }; onDownload: () => void }) {
  const b = result.boxes;
  const left = (reason: LeftOut['reason']) => b.leftOut.filter((l) => l.reason === reason).reduce((n, l) => n + l.records, 0);
  const notClosed = result.to >= isoDay(new Date());
  const empty = b.included.sales + b.included.purchases === 0;
  const warnings = useMemo(() => [
    left('not_recorded') ? `${plural(left('not_recorded'), 'record')} dated in this period ${left('not_recorded') === 1 ? 'has' : 'have'} no VAT details and ${left('not_recorded') === 1 ? 'is' : 'are'} left out.` : null,
    left('no_company') ? `${plural(left('no_company'), 'record')} by members of this company ${left('no_company') === 1 ? 'is' : 'are'} not linked to a company and left out.` : null,
    left('not_gbp') ? `${plural(left('not_gbp'), 'record')} not in GBP ${left('not_gbp') === 1 ? 'is' : 'are'} left out (no currency conversion yet).` : null,
    notClosed ? 'This period has not ended yet: records can still be added.' : null,
    'Boxes 2, 8 and 9 (EU and Northern Ireland trade) are not supported yet and show 0.',
    'B2BNEST has no credit notes: a return that needs credit notes or bad debt relief is not supported.',
  ].filter(Boolean) as string[], [b, notClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4" data-testid="vatr-result">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Preview: {ukDay(result.from)} to {ukDay(result.to)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{result.confirmed ? 'HMRC obligation (test environment)' : 'Not confirmed by HMRC'}</Badge>
            <Button variant="outline" size="sm" onClick={onDownload} data-testid="vatr-download"><Download className="mr-2 h-4 w-4" aria-hidden />Download preview (CSV)</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {empty && <p className="text-sm" data-testid="vatr-empty">No VAT-recorded records for this company in this period, so every box is 0.</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <caption className="sr-only">The nine VAT return boxes</caption>
              <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-2 pr-2">Box</th><th scope="col" className="py-2 pr-2">What it is</th><th scope="col" className="py-2 text-right">Figure (£)</th></tr></thead>
              <tbody>
                {BOX_NUMBERS.map((n) => (
                  <tr key={n} className="border-b align-top" data-testid={`vatr-box-${n}`}>
                    <th scope="row" className="py-2 pr-2 font-semibold">{n}</th>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{BOX_TITLES[n]}</span>
                      {isUnsupportedBox(n) && <Badge variant="outline" className="ml-2 text-xs">not supported yet</Badge>}
                      <span className="block text-xs text-muted-foreground">{explainBox(n)}</span>
                    </td>
                    <td className="whitespace-nowrap py-2 text-right font-mono tabular-nums">
                      {formatBox(n, boxValue(b, n))}
                      {n === 5 && <span className="block text-xs font-sans" data-testid="vatr-direction">{b.netDirection === 'to_pay' ? 'to pay' : b.netDirection === 'to_reclaim' ? 'to reclaim' : 'nothing to pay'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="rounded-md border p-3" data-testid="vatr-how">
            <summary className="cursor-pointer text-sm font-medium">How this was worked out</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <TreatmentTable title={`Sales (${plural(b.included.sales, 'invoice')})`} rows={b.sales} />
              <TreatmentTable title={`Purchases (${plural(b.included.purchases, 'expense or bill', 'expenses and bills')})`} rows={b.purchases} purchases />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Totals only: VAT-recorded records of this company, in GBP, with the tax point in the period. Sales are counted per invoice line.</p>
          </details>
        </CardContent>
      </Card>

      <Card data-testid="vatr-left-out">
        <CardHeader><CardTitle className="text-lg">Left out of these figures</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {b.leftOut.length === 0 ? <p className="text-sm text-muted-foreground">Nothing was left out.</p> : (
            <ul className="space-y-2 text-sm">
              {b.leftOut.map((l) => {
                const fix = fixLink(l);
                return (
                  <li key={`${l.source}-${l.reason}`} data-testid={`vatr-left-${l.source}-${l.reason}`}>
                    <strong>{plural(l.records, SOURCE_NOUN[l.source][0], SOURCE_NOUN[l.source][1])}</strong>: {LEFT_OUT_TEXT[l.reason]}
                    {l.reason === 'vat_not_reclaimable' && <> ({money(l.vat)} of VAT)</>}
                    {fix && <> · <Link to={fix.to} className={linkCls}>{fix.text}</Link></>}
                    {l.source === 'bills' && l.reason !== 'vat_not_reclaimable' && l.reason !== 'no_company' && <> · bills have no screen in B2BNEST yet</>}
                  </li>
                );
              })}
            </ul>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="vatr-warnings">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function TreatmentTable({ title, rows, purchases }: { title: string; rows: TreatmentTotal[]; purchases?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="pb-1 text-left text-sm font-medium">{title}</caption>
        <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-1 pr-2">Treatment</th><th scope="col" className="py-1 pr-2 text-right">Records</th><th scope="col" className="py-1 pr-2 text-right">Net</th><th scope="col" className="py-1 text-right">VAT</th>{purchases && <th scope="col" className="py-1 pl-2 text-right">Not reclaimable</th>}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={purchases ? 5 : 4} className="py-1 text-muted-foreground">None</td></tr> : rows.map((t) => (
            <tr key={t.treatment} className="border-b">
              <th scope="row" className="py-1 pr-2 font-normal">{VAT_TREATMENT_SHORT[t.treatment]}</th>
              <td className="py-1 pr-2 text-right tabular-nums">{t.records}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{money(t.net)}</td>
              <td className="py-1 text-right tabular-nums">{money(t.vat)}</td>
              {purchases && <td className="py-1 pl-2 text-right tabular-nums">{money(t.vatNotReclaimable)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
