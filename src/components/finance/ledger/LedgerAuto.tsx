// Finance phase 3a: the "Automatic postings" section of the Ledger tab (docs/ledger-auto/README.md). The switch, a
// preview of what posting existing invoices would do, the catch-up with a confirmation, and the needs-attention list.
// Every rule is decided by the database; this screen only shows what it is told.
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AssuranceContext } from '@/hooks/useAssurance';
import { formatPence, LEDGER_POSTED_WARNING, ledgerMessage } from '@/lib/ledger';
import { codeOf, type LedgerApi, type Result } from '@/lib/ledgerApi';
import {
  AUTO_MFA_MESSAGE, AUTO_NOT_AVAILABLE, AUTO_OFF_CONFIRM, AUTO_OFF_DONE, AUTO_ON_DONE, AUTO_SWITCH_LABEL, AUTO_VAT_SCHEME_NOTE, autoStateText, invoicePosting, ISSUE_KIND_LABELS, issueReason,
  type AutoPreview, type AutoStatus, type PostingIssue,
} from '@/lib/ledgerAuto';

const INVOICES_LINK = '/business-tools?tool=business-finance-assistant&tab=invoices';
const ACCOUNT_NAMES: Record<string, string> = { debtors: 'Debtors', sales: 'Sales', vat_control: 'VAT control', bank: 'Bank' };

// The worked example on the screen comes from the same rule the tests check.
const EXAMPLE = invoicePosting({ status: 'sent', currency: 'GBP', subtotal: '100.00', tax_amount: '20.00', total_amount: '120.00' });
const exampleText = 'lines' in EXAMPLE
  ? EXAMPLE.lines.map((l) => `${l.debit ? 'Dr' : 'Cr'} ${ACCOUNT_NAMES[l.account]} ${formatPence(l.debit || l.credit)}`).join(', ')
  : '';

type State =
  | { kind: 'loading' }
  | { kind: 'not_available' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; status: AutoStatus; preview: AutoPreview | null; issues: PostingIssue[] };

export function LedgerAuto({ api, organizationId, onPosted, refreshKey = 0 }: {
  api: LedgerApi; organizationId: string; onPosted: () => void; refreshKey?: number;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  // One call at a time, whatever the screen shows: a second click (or a change event fired twice) is ignored.
  const inFlight = useRef(false);
  // The app's own two-step step-up (Phase 25): re-checking the session shows the authenticator code screen when needed.
  const assurance = useContext(AssuranceContext);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await api.autoStatus(organizationId);
    if (!s.ok) {
      const code = codeOf(s);
      setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: ledgerMessage(code) });
      return;
    }
    const [p, i] = await Promise.all([api.autoPreview(organizationId), api.issues(organizationId)]);
    setState({ kind: 'ready', status: s.data, preview: p.ok ? p.data : null, issues: i.ok ? i.data : [] });
  }, [api, organizationId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  /** posts: the call may have posted journals, so the whole Ledger reloads (quietly); otherwise only this screen. */
  const act = async <T,>(fn: () => Promise<Result<T>>, done: (r: T) => string | null, posts: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null); setMessage(null);
    try {
      const r = await fn();
      if (!('data' in r)) {
        const code = codeOf(r);
        if (code === 'MFA_REQUIRED') { setError(AUTO_MFA_MESSAGE); void assurance?.refresh().catch(() => undefined); } else setError(ledgerMessage(code));
        return;
      }
      setMessage(done(r.data));
      if (posts) onPosted(); else await load();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const setSwitch = (on: boolean) => {
    if (inFlight.current || busy) return;
    if (!on) { setConfirmOff(true); return; } // switching off asks first; switching on doesn't
    void act(() => api.autoSet(organizationId, true), () => AUTO_ON_DONE, false);
  };

  if (state.kind === 'loading') return <p role="status">Loading…</p>;
  if (state.kind === 'not_available') return <p data-testid="auto-not-available">{AUTO_NOT_AVAILABLE}</p>;
  if (state.kind === 'error') return <p role="alert" className="text-destructive">{state.message}</p>;
  const { status, preview, issues } = state;
  const canRun = status.can_manage && status.invoices_enabled;
  const toPost = preview ? preview.invoices_to_post + preview.payments_to_post + preview.to_reverse : 0;

  const runText = (x: { processed?: number; remaining?: number }) => {
    const waiting = x.remaining ?? 0;
    return `Looked at ${x.processed ?? 0} invoices.${waiting > 0 ? ` ${waiting} still waiting: they post within a few minutes, or press "Post now".` : ''}`;
  };

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="auto-invoices" checked={status.invoices_enabled} disabled={!status.can_manage || busy || confirmOff} aria-busy={busy}
              onCheckedChange={setSwitch} />
            <label htmlFor="auto-invoices" className="font-medium">{AUTO_SWITCH_LABEL}</label>
            <span data-testid="auto-state" className="text-muted-foreground">{busy ? 'Saving…' : autoStateText(status)}</span>
          </div>
          {confirmOff && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border p-3" data-testid="auto-off-confirm">
              <span>{AUTO_OFF_CONFIRM}</span>
              <Button size="sm" variant="destructive" disabled={busy}
                onClick={() => { setConfirmOff(false); void act(() => api.autoSet(organizationId, false), () => AUTO_OFF_DONE, false); }}>Stop</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmOff(false)}>Keep on</Button>
            </div>
          )}
          <p>
            When this is on, sending an invoice posts it to the ledger, and marking it paid posts the payment. For example, an invoice of
            {' '}£100.00 plus £20.00 VAT posts: {exampleText}. Drafts are never posted. If an invoice changes after it was posted, its journal
            is reversed and the new version is posted; nothing is edited or deleted. Switching this off stops new postings and keeps every journal.
          </p>
          <p className="text-muted-foreground">{AUTO_VAT_SCHEME_NOTE}</p>
          {!status.can_manage && <p className="text-muted-foreground">Only an owner or admin of this company can change this.</p>}
          {status.waiting > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p data-testid="auto-waiting">{status.waiting} invoice{status.waiting === 1 ? '' : 's'} waiting to be posted.</p>
              {status.can_manage && <Button size="sm" variant="outline" disabled={busy} onClick={() => { void act(() => api.autoRun(organizationId), runText, true); }}>Post now</Button>}
            </div>
          )}
          {message && <p role="status" className="text-green-700">{message}</p>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Existing invoices</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p>Invoices dated on or after the ledger start date can be posted now. Invoices dated before it are never posted.</p>
          {preview ? (
            <table className="w-full max-w-lg" aria-label="What would be posted" data-testid="auto-preview">
              <tbody className="divide-y">
                <tr><td className="py-1 pr-2">Invoices to post</td><td className="py-1 pr-2 text-right">{preview.invoices_to_post}</td><td className="py-1 text-right">{formatPence(preview.invoices_total)}</td></tr>
                <tr><td className="py-1 pr-2">Payments to post</td><td className="py-1 pr-2 text-right">{preview.payments_to_post}</td><td className="py-1 text-right">{formatPence(preview.payments_total)}</td></tr>
                <tr><td className="py-1 pr-2">Journals to reverse (invoice changed)</td><td className="py-1 pr-2 text-right">{preview.to_reverse}</td><td /></tr>
                <tr><td className="py-1 pr-2">Already posted</td><td className="py-1 pr-2 text-right">{preview.already_posted}</td><td /></tr>
                {Object.entries(preview.skipped).map(([reason, n]) => (
                  <tr key={reason}><td className="py-1 pr-2">Skipped: {issueReason(reason)}</td><td className="py-1 pr-2 text-right">{n}</td><td /></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-muted-foreground">The preview isn't available right now.</p>}
          {canRun && !confirming && (
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || toPost === 0} onClick={() => setConfirming(true)}>Post existing invoices</Button>
            </div>
          )}
          {status.can_manage && !status.invoices_enabled && <p className="text-muted-foreground">Switch automatic postings on to post existing invoices.</p>}
          {confirming && preview && (
            <div className="space-y-2 rounded-md border p-3" data-testid="auto-confirm">
              <p>
                This posts {preview.invoices_to_post} invoice journal{preview.invoices_to_post === 1 ? '' : 's'} ({formatPence(preview.invoices_total)}) and
                {' '}{preview.payments_to_post} payment journal{preview.payments_to_post === 1 ? '' : 's'} ({formatPence(preview.payments_total)})
                {preview.to_reverse > 0 ? `, and reverses ${preview.to_reverse}` : ''}.
              </p>
              <Alert><AlertDescription>{LEDGER_POSTED_WARNING}</AlertDescription></Alert>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => { setConfirming(false); void act(() => api.autoCatchUp(organizationId), runText, true); }}>{busy ? 'Posting…' : 'Yes, post them'}</Button>
                <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Needs attention</CardTitle></CardHeader>
        <CardContent>
          {issues.length === 0 ? <p className="text-muted-foreground">Nothing needs attention.</p> : (
            <>
              <p className="mb-2">These invoices were not posted. Fix the invoice and it is looked at again automatically.</p>
              <ul className="divide-y" aria-label="Needs attention">
                {issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{ISSUE_KIND_LABELS[i.kind] ?? 'Invoice'} {i.source_label ?? ''}</span>
                    <span className="flex-1">{issueReason(i.reason_code)}</span>
                    <Link to={INVOICES_LINK} className="text-primary underline">Open invoices<span className="sr-only"> for {i.source_label ?? 'this invoice'}</span></Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
