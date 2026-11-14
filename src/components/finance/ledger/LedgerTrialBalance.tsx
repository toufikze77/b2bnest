import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPence, ledgerMessage, trialBalance } from '@/lib/ledger';
import { codeOf, type LedgerApi } from '@/lib/ledgerApi';

const today = () => new Date().toISOString().slice(0, 10);

/** The trial balance at any date: each account's balance on its side, and whether the totals agree. */
export function LedgerTrialBalance({ api, organizationId, refreshKey = 0 }: { api: LedgerApi; organizationId: string; refreshKey?: number }) {
  const [asOf, setAsOf] = useState(today());
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; tb: ReturnType<typeof trialBalance> }>({ kind: 'loading' });

  const load = useCallback(async (date: string) => {
    setState({ kind: 'loading' });
    const r = await api.trialBalance(organizationId, date);
    setState(r.ok ? { kind: 'ok', tb: trialBalance(r.data ?? []) } : { kind: 'error', message: ledgerMessage(codeOf(r)) });
  }, [api, organizationId]);

  useEffect(() => { if (asOf) void load(asOf); }, [asOf, load, refreshKey]);

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <Label htmlFor="tb-date">As at</Label>
        <Input id="tb-date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="max-w-xs" />
      </div>
      {state.kind === 'loading' && <p role="status">Loading…</p>}
      {state.kind === 'error' && <p role="alert" className="text-destructive">{state.message}</p>}
      {state.kind === 'ok' && (
        <>
          {state.tb.lines.length === 0 ? <p className="text-muted-foreground">No balances at this date.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]" aria-label="Trial balance">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Account</th><th className="py-1 pr-2 font-medium">Debit</th><th className="py-1 font-medium">Credit</th></tr></thead>
                <tbody>
                  {state.tb.lines.map((l) => (
                    <tr key={l.account_id}><td className="py-1 pr-2">{l.code} {l.name}</td><td className="py-1 pr-2">{l.debit ? formatPence(l.debit) : ''}</td><td className="py-1">{l.credit ? formatPence(l.credit) : ''}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="font-medium"><td className="py-1 pr-2">Totals</td><td className="py-1 pr-2" data-testid="tb-debit">{formatPence(state.tb.totalDebit)}</td><td className="py-1" data-testid="tb-credit">{formatPence(state.tb.totalCredit)}</td></tr></tfoot>
              </table>
            </div>
          )}
          <p role="status" data-testid="tb-check" className={state.tb.balanced ? 'font-medium text-green-700' : 'font-medium text-destructive'}>
            {state.tb.balanced ? 'Debits and credits agree.' : "Debits and credits don't agree. Please tell us at info@b2bnest.online."}
          </p>
        </>
      )}
    </div>
  );
}
