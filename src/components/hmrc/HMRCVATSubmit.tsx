import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, CalendarClock, CheckCircle2, Download, HelpCircle, Loader2, Send, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import HMRCTestTools from '@/components/hmrc/HMRCTestTools';
import { getVatObligations, ukDay, type VatObligation } from '@/lib/hmrcVat';
import { messageFor } from '@/lib/hmrcConnection';
import {
  checkReturn, DECLARATION, fetchSubmissions, FIGURE_ROWS, prepareReturn, receiptCsv, submitReturn, SUBMIT_SCENARIOS, TEST_ENV_BANNER,
  type Prepared, type SubmissionRecord, type Submitted,
} from '@/lib/hmrcVatSubmit';
import { LEFT_OUT_TEXT } from '@/lib/vat';

const linkCls = 'font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const STATUS_TEXT: Record<SubmissionRecord['status'], string> = { submitting: 'Submitting', accepted: 'Accepted', rejected: 'Rejected', unknown: 'Unknown: check with HMRC' };
const fmtFigure = (n: number, v: unknown) => (typeof v !== 'number' ? '' : n <= 5 ? v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toLocaleString('en-GB'));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export type SubmitAccess = 'ready' | 'not_connected' | 'scope_missing';

/**
 * HMRC P6: submit a VAT return to HMRC's TEST environment (sandbox) for an open obligation. The server recomputes the
 * figures, checks a signed confirmation, and records every attempt permanently (hmrc_vat_submissions). Owners and
 * admins only (the parent screen shows this only to them); nothing here is filed with HMRC for real.
 */
export default function HMRCVATSubmit({ companyId, companyName, access }: { companyId: string; companyName: string; access: SubmitAccess }) {
  const [obligations, setObligations] = useState<VatObligation[] | null>(null);
  const [loadingOb, setLoadingOb] = useState(false);
  const [periodKey, setPeriodKey] = useState('');
  const [scenario, setScenario] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [declared, setDeclared] = useState(false);
  const [typedKey, setTypedKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const sending = useRef(false);
  const [result, setResult] = useState<Submitted | null>(null);
  const [said, setSaid] = useState('');
  const [checking, setChecking] = useState(false);
  // P7a (WCAG 2.4.3): the submit button disappears once a result arrives, so focus moves to the result instead of being lost.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);
  const [history, setHistory] = useState<{ rows: SubmissionRecord[]; notAvailable?: boolean; error?: boolean } | null>(null);

  const loadHistory = useCallback(async () => { setHistory(await fetchSubmissions(companyId)); }, [companyId]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const download = (row: SubmissionRecord) => {
    const url = URL.createObjectURL(new Blob([receiptCsv(row)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `vat-submission_${row.period_key.replace(/#/g, '-')}_${row.submitted_at.slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const historyBlock = <History history={history} onReload={() => { void loadHistory(); }} onDownload={download} />;

  if (access === 'not_connected') {
    return (
      <Section>
        <p className="text-sm" data-testid="vats-not-connected">Connect {companyName} to HMRC's test environment first in <Link to="/settings?tab=hmrc" className={linkCls}>Settings → HMRC</Link>.</p>
        {historyBlock}
      </Section>
    );
  }
  if (access === 'scope_missing') {
    return (
      <Section>
        <p className="text-sm" data-testid="vats-scope-missing">Connect to HMRC again: submitting a VAT return needs one more permission (test environment only). <Link to="/settings?tab=hmrc" className={linkCls}>Settings → HMRC</Link></p>
        {historyBlock}
      </Section>
    );
  }

  const loadObligations = async () => {
    setLoadingOb(true); setSaid('');
    const r = await getVatObligations(companyId, { status: 'O' });
    setLoadingOb(false);
    if (!r.ok) { setSaid(r.message ?? messageFor(r.code)); return; }
    const open = (r.obligations ?? []).filter((o) => o.status === 'O');
    setObligations(open);
    setPeriodKey(open[0]?.periodKey ?? '');
    if (!open.length) setSaid('HMRC shows no open VAT obligations for this company.');
  };

  const prepare = async () => {
    if (!periodKey) return;
    setPreparing(true); setSaid(''); setPrepared(null); setResult(null); setDeclared(false); setTypedKey('');
    const r = await prepareReturn(companyId, periodKey);
    setPreparing(false);
    if (!r.ok) { setSaid(r.message ?? messageFor(r.code)); return; }
    setPrepared(r);
  };

  const ready = !!prepared?.confirmation_token && declared && typedKey.trim() === periodKey;
  const submit = async () => {
    if (!ready || sending.current || !prepared?.confirmation_token) return;
    sending.current = true; // one submission per click sequence, however fast the clicks
    setSubmitting(true); setSaid('');
    const r = await submitReturn(companyId, periodKey, prepared.confirmation_token, scenario || null);
    setSubmitting(false);
    sending.current = false;
    if (!r.ok) setSaid(r.message ?? messageFor(r.code));
    else { setResult(r); setPrepared(null); }
    void loadHistory();
  };

  const check = async (confirmNotReceived = false) => {
    setChecking(true); setSaid('');
    const r = await checkReturn(companyId, periodKey, confirmNotReceived);
    setChecking(false);
    if (!r.ok) setSaid(r.message ?? messageFor(r.code));
    else setResult(r);
    void loadHistory();
  };

  return (
    <Section>
      <div className="space-y-3">
        <Button type="button" variant="outline" onClick={() => { void loadObligations(); }} disabled={loadingOb} data-testid="vats-get-obligations">
          {loadingOb ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <CalendarClock className="mr-2 h-4 w-4" aria-hidden />}Get open obligations from HMRC
        </Button>
        {obligations && obligations.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <div className="space-y-1">
              <Label htmlFor="vats-obligation">Open obligation</Label>
              <select id="vats-obligation" className={selectCls} value={periodKey} onChange={(e) => { setPeriodKey(e.target.value); setPrepared(null); setResult(null); }}>
                {obligations.map((o) => <option key={o.periodKey} value={o.periodKey}>{o.periodKey}: {ukDay(o.start)} to {ukDay(o.end)} (due {ukDay(o.due)})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vats-scenario">Test scenario (test environment only)</Label>
              <select id="vats-scenario" className={selectCls} value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="">None: a normal test submission</option>
                {SUBMIT_SCENARIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
        {obligations && obligations.length > 0 && (
          <Button type="button" onClick={() => { void prepare(); }} disabled={!periodKey || preparing} data-testid="vats-prepare">
            {preparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Prepare the return
          </Button>
        )}
        {said && <p className="text-sm" role="status" data-testid="vats-said">{said}</p>}
      </div>

      {prepared?.figures && (
        <div className="space-y-4 rounded-md border p-4" data-testid="vats-prepared">
          <p className="text-sm font-medium">Return for {prepared.obligation?.periodKey}: {prepared.obligation && `${ukDay(prepared.obligation.start)} to ${ukDay(prepared.obligation.end)}`}</p>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">The nine boxes that would be sent</caption>
            <tbody>
              {FIGURE_ROWS.map(([k, n, label]) => (
                <tr key={k} className="border-b" data-testid={`vats-box-${n}`}><th scope="row" className="py-1 pr-2 font-normal">{n}. {label}</th><td className="py-1 text-right font-mono tabular-nums">{fmtFigure(n, prepared.figures?.[k])}</td></tr>
              ))}
            </tbody>
          </table>
          {prepared.boxes?.leftOut && prepared.boxes.leftOut.length > 0 && (
            <ul className="list-disc pl-5 text-sm" data-testid="vats-left-out">
              {prepared.boxes.leftOut.map((l) => <li key={`${l.source}-${l.reason}`}>{l.records} {l.source}: {LEFT_OUT_TEXT[l.reason]}</li>)}
            </ul>
          )}
          {prepared.blocking && prepared.blocking.length > 0 ? (
            <Alert role="alert" data-testid="vats-blocking">
              <AlertOctagon className="h-4 w-4" aria-hidden />
              <AlertTitle>This return can't be submitted yet</AlertTitle>
              <AlertDescription><ul className="list-disc pl-5">{(prepared.blocking_messages ?? prepared.blocking).map((m) => <li key={m}>{m}</li>)}</ul></AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={declared} onChange={(e) => setDeclared(e.target.checked)} data-testid="vats-declaration" />
                <span>{DECLARATION}</span>
              </label>
              <div className="space-y-1 sm:max-w-xs">
                <Label htmlFor="vats-typed-key">Type the period key ({periodKey}) to confirm</Label>
                <Input id="vats-typed-key" value={typedKey} onChange={(e) => setTypedKey(e.target.value)} autoComplete="off" />
              </div>
              {!ready && !submitting && <p id="vats-submit-hint" className="text-xs text-muted-foreground" data-testid="vats-submit-hint">Tick the declaration and type the period key to turn on the submit button.</p>}
              <Button type="button" onClick={() => { void submit(); }} disabled={!ready || submitting} aria-describedby={!ready && !submitting ? 'vats-submit-hint' : undefined} data-testid="vats-submit">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-2 h-4 w-4" aria-hidden />}
                {submitting ? 'Submitting to the test environment…' : 'Submit to HMRC (test environment)'}
              </Button>
            </div>
          )}
        </div>
      )}

      {result && <div ref={resultRef} tabIndex={-1} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="vats-result"><ResultCard result={result} checking={checking} onCheck={(c) => { void check(c); }} /></div>}

      <details className="rounded-md border p-3" data-testid="vats-fraud">
        <summary className="cursor-pointer text-sm font-medium">Validate fraud prevention headers (test environment)</summary>
        <p className="mt-2 text-xs text-muted-foreground">Sends the same headers to HMRC's test checker and shows its feedback. No VAT figures are sent.</p>
        <div className="mt-2"><HMRCTestTools companyId={companyId} /></div>
      </details>

      {historyBlock}
    </Section>
  );
}

function History({ history, onReload, onDownload }: { history: { rows: SubmissionRecord[]; notAvailable?: boolean; error?: boolean } | null; onReload: () => void; onDownload: (r: SubmissionRecord) => void }) {
  return (
      <div className="space-y-2" data-testid="vats-history">
        <h4 className="text-sm font-semibold">Submission history (test environment)</h4>
        {!history ? <p className="text-sm text-muted-foreground">Loading…</p>
          : history.notAvailable ? <p className="text-sm text-muted-foreground" data-testid="vats-history-unavailable">Submission history arrives with a database update.</p>
          : history.error ? <p className="text-sm" data-testid="vats-history-error">The submission history couldn't be loaded. <Button variant="link" className="h-auto p-0" onClick={() => { onReload(); }}>Try again</Button></p>
          : history.rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="vats-history-empty">No submissions yet.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">VAT return submissions to HMRC's test environment</caption>
                <thead><tr className="border-b text-muted-foreground"><th scope="col" className="py-1 pr-2">Period</th><th scope="col" className="py-1 pr-2">Submitted</th><th scope="col" className="py-1 pr-2">By</th><th scope="col" className="py-1 pr-2">Status</th><th scope="col" className="py-1 pr-2">Receipt</th><th scope="col" className="py-1 pr-2">Scenario</th><th scope="col" className="py-1"><span className="sr-only">Download</span></th></tr></thead>
                <tbody>
                  {history.rows.map((r) => (
                    <tr key={r.id} className="border-b align-top" data-testid="vats-history-row">
                      <td className="py-1 pr-2 font-mono">{r.period_key}</td>
                      <td className="py-1 pr-2">{when(r.submitted_at)}</td>
                      <td className="py-1 pr-2">{r.submitted_by_name ?? '—'}</td>
                      <td className="py-1 pr-2"><Badge variant="outline">{STATUS_TEXT[r.status]}</Badge>{r.status === 'rejected' && r.error_message && <span className="block text-xs text-muted-foreground">{r.error_message}</span>}</td>
                      <td className="py-1 pr-2 text-xs">{r.form_bundle_number ? <>Form bundle {r.form_bundle_number}{r.processing_date && <> · {when(r.processing_date)}</>}{r.payment_indicator && <> · {r.payment_indicator}</>}</> : '—'}</td>
                      <td className="py-1 pr-2 text-xs">{r.test_scenario ?? '—'}</td>
                      <td className="py-1"><Button variant="ghost" size="sm" onClick={() => onDownload(r)} aria-label={`Download receipt for ${r.period_key}`}><Download className="h-4 w-4" aria-hidden /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="vats-section">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">Submit to HMRC (test environment)</CardTitle>
        <Alert role="note" className="border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50" data-testid="vats-banner">
          <AlertOctagon className="h-4 w-4" aria-hidden />
          <AlertTitle>{TEST_ENV_BANNER}</AlertTitle>
          <AlertDescription>Submissions go to HMRC's sandbox with test data. Every attempt is recorded permanently in the history below.</AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

function ResultCard({ result, checking, onCheck }: { result: Submitted; checking: boolean; onCheck: (confirmNotReceived: boolean) => void }) {
  if (result.status === 'accepted') {
    return (
      <Alert role="status" data-testid="vats-accepted" className="border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-50">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        <AlertTitle>HMRC's test environment accepted the return</AlertTitle>
        <AlertDescription>
          {result.receipt ? (
            <ul className="space-y-0.5">
              <li>Processing date: {when(result.receipt.processing_date) || '—'}</li>
              <li>Form bundle number: {result.receipt.form_bundle_number ?? '—'}</li>
              <li>Payment indicator: {result.receipt.payment_indicator ?? '—'}</li>
              {result.receipt.charge_ref_number && <li>Charge reference: {result.receipt.charge_ref_number}</li>}
              {result.receipt_complete === false && result.message && <li data-testid="vats-receipt-incomplete">{result.message}</li>}
            </ul>
          ) : <p>{result.message}</p>}
        </AlertDescription>
      </Alert>
    );
  }
  if (result.status === 'rejected') {
    return (
      <Alert role="alert" data-testid="vats-rejected">
        <XCircle className="h-4 w-4" aria-hidden />
        <AlertTitle>Not accepted</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }
  // unknown, or still open after a check
  return (
    <Alert role="alert" data-testid="vats-unknown" className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
      <HelpCircle className="h-4 w-4" aria-hidden />
      <AlertTitle>{result.status === 'still_open' ? 'HMRC still shows this period as open' : "We don't know if HMRC received it"}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{result.status === 'still_open' ? result.message : 'Do not submit again. Check with HMRC.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onCheck(false)} disabled={checking} data-testid="vats-check">
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Check with HMRC
          </Button>
          {result.status === 'still_open' && (
            <Button size="sm" variant="outline" onClick={() => onCheck(true)} disabled={checking} data-testid="vats-not-received">Record that HMRC did not receive it</Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
