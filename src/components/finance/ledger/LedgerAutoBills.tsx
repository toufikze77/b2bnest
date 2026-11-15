// Finance phase 3b: the "Bills and expenses" card of Automatic postings (docs/ledger-auto-bills/README.md): the second
// switch, its preview, the catch-up with a confirmation, and the category mapping (read only in this release). Every
// rule is decided by the database; this card only shows what it is told. Before the 3b SQL is applied it says so.
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AssuranceContext } from '@/hooks/useAssurance';
import { formatPence, LEDGER_POSTED_WARNING, ledgerMessage, type LedgerAccount } from '@/lib/ledger';
import { codeOf, type LedgerApi, type Result } from '@/lib/ledgerApi';
import {
  AUTO_MFA_MESSAGE, AUTO_VAT_SCHEME_NOTE, BILLS_OFF_CONFIRM, BILLS_OFF_DONE, BILLS_ON_DONE, BILLS_SWITCH_LABEL, billPosting, categoryLabel, issueReason, UNMAPPED_CATEGORIES,
  type AutoStatus, type CategoryMapRow, type RecordsPreview,
} from '@/lib/ledgerAuto';

const NAMES: Record<string, string> = { expense: 'the expense account', vat_control: 'VAT control', creditors: 'Creditors', bank: 'Bank' };
// The worked example comes from the same rule the tests check.
const EXAMPLE = billPosting({ status: 'pending', currency: 'GBP', amount: '120.00', net_amount: '100.00', vat_amount: '20.00', vat_status: 'recorded', vat_reclaimable: true });
const exampleText = 'lines' in EXAMPLE ? EXAMPLE.lines.map((l) => `${l.debit ? 'Dr' : 'Cr'} ${NAMES[l.account]} ${formatPence(l.debit || l.credit)}`).join(', ') : '';

export function LedgerAutoBills({ api, organizationId, status, preview, onChanged, onPosted }: {
  api: LedgerApi; organizationId: string; status: AutoStatus; preview: RecordsPreview | null | undefined;
  /** Reload this screen (the switch changed). */ onChanged: () => Promise<void>;
  /** Journals may have been posted: reload the whole Ledger quietly. */ onPosted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<{ rows: CategoryMapRow[]; accounts: LedgerAccount[] } | null>(null);
  const inFlight = useRef(false);
  const assurance = useContext(AssuranceContext);
  const enabled = !!status.bills_enabled;

  const loadMap = useCallback(async () => {
    const [m, a] = await Promise.all([api.categoryMap(organizationId), api.accounts(organizationId)]);
    setMap(m.ok && a.ok ? { rows: m.data, accounts: a.data } : null);
  }, [api, organizationId]);
  useEffect(() => { void loadMap(); }, [loadMap, enabled]);

  const act = async <T,>(fn: () => Promise<Result<T>>, done: (r: T) => string, posts: boolean) => {
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
      if (posts) onPosted(); else await onChanged();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const setSwitch = (on: boolean) => {
    if (inFlight.current || busy) return;
    if (!on) { setConfirmOff(true); return; }
    void act(() => api.autoSet(organizationId, true, 'bills_and_expenses'), () => BILLS_ON_DONE, false);
  };
  const runText = (x: { processed?: number; remaining?: number }) =>
    `Looked at ${x.processed ?? 0} bills and expenses.${(x.remaining ?? 0) > 0 ? ` ${x.remaining} still waiting: they post within a few minutes, or press "Post now".` : ''}`;
  const toPost = preview ? preview.bills_to_post + preview.bill_payments_to_post + preview.expenses_to_post + preview.to_reverse : 0;
  const accountName = (id: string | null) => {
    const a = id ? map?.accounts.find((x) => x.id === id) : undefined;
    return a ? `${a.code} ${a.name}${a.is_active ? '' : ' (inactive)'}` : 'Not mapped';
  };

  return (
    <Card data-testid="auto-bills">
      <CardHeader className="pb-2"><CardTitle className="text-base">Bills and expenses</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Switch id="auto-bills" checked={enabled} disabled={!status.can_manage || busy || confirmOff} aria-busy={busy} onCheckedChange={setSwitch} />
          <label htmlFor="auto-bills" className="font-medium">{BILLS_SWITCH_LABEL}</label>
          <span data-testid="auto-bills-state" className="text-muted-foreground">{busy ? 'Saving…' : enabled ? 'On' : 'Off'}</span>
        </div>
        {confirmOff && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3" data-testid="auto-bills-off-confirm">
            <span>{BILLS_OFF_CONFIRM}</span>
            <Button size="sm" variant="destructive" disabled={busy}
              onClick={() => { setConfirmOff(false); void act(() => api.autoSet(organizationId, false, 'bills_and_expenses'), () => BILLS_OFF_DONE, false); }}>Stop</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmOff(false)}>Keep on</Button>
          </div>
        )}
        <p>
          When this is on, a bill posts to the ledger when it is received (pending, overdue or paid), and its payment posts when it is
          marked paid. An expense posts when it is approved or paid, as money already spent; pending expenses wait until they are
          approved. For example, a bill of £100.00 plus £20.00 VAT posts: {exampleText}. If the VAT can't be reclaimed, it is added to the
          cost instead. Changes are reversed and posted again; nothing is edited or deleted.
        </p>
        <p className="text-muted-foreground">{AUTO_VAT_SCHEME_NOTE}</p>
        {!status.can_manage && <p className="text-muted-foreground">Only an owner or admin of this company can change this.</p>}
        {message && <p role="status" className="text-green-700">{message}</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}

        {preview ? (
          <table className="w-full max-w-lg" aria-label="Bills and expenses that would be posted" data-testid="auto-bills-preview">
            <tbody className="divide-y">
              <tr><td className="py-1 pr-2">Bills to post</td><td className="py-1 pr-2 text-right">{preview.bills_to_post}</td><td className="py-1 text-right">{formatPence(preview.bills_total)}</td></tr>
              <tr><td className="py-1 pr-2">Bill payments to post</td><td className="py-1 pr-2 text-right">{preview.bill_payments_to_post}</td><td className="py-1 text-right">{formatPence(preview.bill_payments_total)}</td></tr>
              <tr><td className="py-1 pr-2">Expenses to post</td><td className="py-1 pr-2 text-right">{preview.expenses_to_post}</td><td className="py-1 text-right">{formatPence(preview.expenses_total)}</td></tr>
              <tr><td className="py-1 pr-2">Journals to reverse (record changed)</td><td className="py-1 pr-2 text-right">{preview.to_reverse}</td><td /></tr>
              <tr><td className="py-1 pr-2">Already posted</td><td className="py-1 pr-2 text-right">{preview.already_posted}</td><td /></tr>
              {Object.entries(preview.skipped).map(([reason, n]) => (
                <tr key={reason}><td className="py-1 pr-2">Skipped: {issueReason(reason)}</td><td className="py-1 pr-2 text-right">{n}</td><td /></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-muted-foreground">The preview isn't available right now.</p>}
        {status.can_manage && enabled && !confirming && (
          <Button disabled={busy || toPost === 0} onClick={() => setConfirming(true)}>Post existing bills and expenses</Button>
        )}
        {status.can_manage && !enabled && <p className="text-muted-foreground">Switch this on to post existing bills and expenses.</p>}
        {confirming && preview && (
          <div className="space-y-2 rounded-md border p-3" data-testid="auto-bills-confirm">
            <p>
              This posts {preview.bills_to_post} bill journal{preview.bills_to_post === 1 ? '' : 's'} ({formatPence(preview.bills_total)}),
              {' '}{preview.bill_payments_to_post} bill payment{preview.bill_payments_to_post === 1 ? '' : 's'} ({formatPence(preview.bill_payments_total)}) and
              {' '}{preview.expenses_to_post} expense journal{preview.expenses_to_post === 1 ? '' : 's'} ({formatPence(preview.expenses_total)})
              {preview.to_reverse > 0 ? `, and reverses ${preview.to_reverse}` : ''}.
            </p>
            <Alert><AlertDescription>{LEDGER_POSTED_WARNING}</AlertDescription></Alert>
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => { setConfirming(false); void act(() => api.autoCatchUp(organizationId, 'bills_and_expenses'), runText, true); }}>Yes, post them</Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <h3 className="font-medium">Category mapping</h3>
          <p className="text-muted-foreground">
            Which ledger account each bill and expense category posts to. Read only for now. A category that isn't listed, or whose account
            was deleted or made inactive, is not posted: it shows under Needs attention.
          </p>
          {map === null ? <p className="text-muted-foreground">The mapping isn't available right now.</p>
            : map.rows.length === 0 ? <p className="text-muted-foreground">The standard mapping is set up when you switch this on.</p> : (
              <table className="w-full max-w-lg" aria-label="Category mapping">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Category</th><th className="py-1 font-medium">Account</th></tr></thead>
                <tbody className="divide-y">
                  {map.rows.map((r) => (
                    <tr key={r.category_key}>
                      <td className="py-1 pr-2">{categoryLabel(r.category_key)} <span className="text-muted-foreground">({r.category_key})</span></td>
                      <td className="py-1">{accountName(r.account_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          <div className="text-muted-foreground" data-testid="auto-bills-unmapped">
            <p>Deliberately not mapped (records in these categories wait under Needs attention until someone decides):</p>
            <ul className="list-disc pl-5">
              {Object.entries(UNMAPPED_CATEGORIES).map(([key, why]) => <li key={key}>{why} <span>({key})</span></li>)}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
