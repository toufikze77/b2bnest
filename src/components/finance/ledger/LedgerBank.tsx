// Finance phase 3c-1: the "Bank" section of the Ledger tab (docs/ledger-bank/README.md). Bank accounts, statement import,
// automatic and manual matching to payments already in the ledger, and a reconciliation summary. Members can read;
// owners and admins act. Nothing here posts to the ledger. Every rule is decided by the database.
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssuranceContext } from '@/hooks/useAssurance';
import { formatPence, ledgerMessage } from '@/lib/ledger';
import { codeOf, type LedgerApi, type Result } from '@/lib/ledgerApi';
import { AUTO_MFA_MESSAGE } from '@/lib/ledgerAuto';
import {
  BANK_DIFFERENCE_NOTE, BANK_INTRO, BANK_MANAGER_ONLY, BANK_NEVER_POSTS, BANK_NO_STATEMENT_BALANCE, BANK_SHARED_NOTE, IGNORE_REASON_LABELS,
  importDoneText, paymentText, suggestionText, type BankLine, type BankOverview, type IgnoreReason,
} from '@/lib/ledgerBank';
import { LedgerBankImport } from './LedgerBankImport';

type State = { kind: 'loading' } | { kind: 'not_available' } | { kind: 'error'; message: string } | { kind: 'ready'; data: BankOverview };
type Review = 'unmatched' | 'matched' | 'ignored' | 'attention';
const today = () => new Date().toISOString().slice(0, 10);

export function LedgerBank({ api, organizationId, refreshKey = 0 }: { api: LedgerApi; organizationId: string; refreshKey?: number }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [account, setAccount] = useState<string | null>(null);
  const [asAt, setAsAt] = useState(today());
  const [review, setReview] = useState<Review>('unmatched');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const assurance = useContext(AssuranceContext);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [last4, setLast4] = useState('');

  const load = useCallback(async () => {
    const r = await api.bankOverview(organizationId, account, asAt);
    if (!r.ok) {
      const code = codeOf(r);
      setState(code === 'NOT_AVAILABLE' ? { kind: 'not_available' } : { kind: 'error', message: code === 'MFA_REQUIRED' ? AUTO_MFA_MESSAGE : ledgerMessage(code) });
      return;
    }
    setState({ kind: 'ready', data: r.data });
  }, [api, organizationId, account, asAt]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const showError = (code: string) => {
    if (code === 'MFA_REQUIRED') { setError(AUTO_MFA_MESSAGE); void assurance?.refresh().catch(() => undefined); } else setError(ledgerMessage(code));
  };
  /** One call at a time: a second click while one is running is ignored. */
  const act = async <T,>(fn: () => Promise<Result<T>>, done: (r: T) => string | null) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setMessage(null);
    try {
      const r = await fn();
      if (!('data' in r)) { showError(codeOf(r)); return; }
      setMessage(done(r.data));
      await load();
    } finally { inFlight.current = false; setBusy(false); }
  };

  if (state.kind === 'loading') return <p role="status">Loading…</p>;
  if (state.kind === 'not_available') return <p data-testid="bank-not-available">Bank statement import is not available yet.</p>;
  if (state.kind === 'error') return <p role="alert" className="text-destructive">{state.message}</p>;
  const d = state.data;
  if (d.access !== 'ok') return <p>{ledgerMessage(d.access.toUpperCase())}</p>;
  const can = d.can_manage;
  const current = d.accounts.find((a) => a.id === d.bank_account_id) ?? null;
  const counts = d.counts ?? { unmatched: 0, matched: 0, ignored: 0, needs_attention: 0 };
  const rec = d.reconciliation;

  const addAccount = () => {
    void act(() => api.bankAccountSave(organizationId, { name, last4 }), (r) => {
      setAdding(false); setName(''); setLast4(''); setAccount(r.id);
      return 'Bank account added.';
    });
  };
  const amount = (p: number) => <span className={`whitespace-nowrap tabular-nums ${p < 0 ? '' : 'text-success'}`}>{p > 0 ? '+' : ''}{formatPence(p)}</span>;
  const lineHead = (l: BankLine) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span><span className="whitespace-nowrap text-muted-foreground">{l.line_date}</span> <span className="font-medium">{l.description}</span>
        {l.external_ref ? <span className="text-muted-foreground"> · {l.external_ref}</span> : null}</span>
      {amount(l.amount_pence)}
    </div>
  );
  const ignoreButtons = (l: BankLine) => (Object.keys(IGNORE_REASON_LABELS) as IgnoreReason[]).map((r) => (
    <Button key={r} size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankIgnore(organizationId, l.id, r), () => `Ignored: ${IGNORE_REASON_LABELS[r].toLowerCase()}.`); }}>
      Ignore: {IGNORE_REASON_LABELS[r].toLowerCase()}
    </Button>
  ));

  return (
    <div className="space-y-4 text-sm" data-testid="ledger-bank">
      <Card>
        <CardContent className="space-y-1 pt-4">
          <p>{BANK_INTRO}</p>
          <p className="font-medium" data-testid="bank-never-posts">{BANK_NEVER_POSTS}</p>
          {!can && <p className="text-muted-foreground">{BANK_MANAGER_ONLY}</p>}
        </CardContent>
      </Card>
      {message && <p role="status" data-testid="bank-message">{message}</p>}
      {error && <p role="alert" className="text-destructive" data-testid="bank-error">{error}</p>}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Bank accounts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {d.accounts.length === 0 && <p>No bank accounts yet.{can ? ' Add one to import its statement.' : ''}</p>}
          {d.accounts.length > 1 && (
            <label className="flex flex-wrap items-center gap-2">
              <span>Bank account</span>
              <select aria-label="Bank account" value={d.bank_account_id ?? ''} onChange={(e) => setAccount(e.target.value)} className="rounded-md border bg-background px-2 py-1">
                {d.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.last4 ? ` (…${a.last4})` : ''}{a.is_active ? '' : ' (inactive)'}</option>)}
              </select>
            </label>
          )}
          {current && (
            <div className="flex flex-wrap items-center gap-2" data-testid="bank-current">
              <span className="font-medium">{current.name}{current.last4 ? ` (ending ${current.last4})` : ''}</span>
              {!current.is_active && <span className="text-muted-foreground">Inactive</span>}
              {can && (
                <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => { void act(() => api.bankAccountSave(organizationId, { id: current.id, name: current.name, last4: current.last4, active: !current.is_active }),
                    () => (current.is_active ? 'Bank account made inactive.' : 'Bank account made active.')); }}>
                  {current.is_active ? 'Make inactive' : 'Make active'}
                </Button>
              )}
            </div>
          )}
          {can && !adding && <Button variant="outline" disabled={busy} onClick={() => setAdding(true)}>Add bank account</Button>}
          {can && adding && (
            <div className="flex flex-wrap items-end gap-2" data-testid="bank-add">
              <label className="flex flex-col gap-1"><span>Name</span><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Name" /></label>
              <label className="flex flex-col gap-1"><span>Last 4 digits (optional)</span>
                <Input value={last4} inputMode="numeric" maxLength={4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Last 4 digits (optional)" /></label>
              <Button disabled={busy || !name.trim()} onClick={addAccount}>Save bank account</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setAdding(false)}>Cancel</Button>
              <p className="w-full text-muted-foreground">Never enter the full account number or sort code.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {current && rec && (
        <Card data-testid="bank-summary">
          <CardHeader className="pb-2"><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <label className="flex flex-wrap items-center gap-2"><span>As at</span>
              <Input type="date" className="w-auto" value={asAt} onChange={(e) => setAsAt(e.target.value || today())} aria-label="As at" /></label>
            <dl className="grid gap-1 sm:grid-cols-3">
              <div><dt className="text-muted-foreground">Ledger bank balance</dt><dd className="font-medium tabular-nums" data-testid="bank-ledger-balance">{formatPence(rec.ledger_balance_pence)}</dd></div>
              <div><dt className="text-muted-foreground">Statement balance</dt>
                <dd className="font-medium tabular-nums" data-testid="bank-statement-balance">{rec.statement_balance_pence == null ? '—' : `${formatPence(rec.statement_balance_pence)} (${rec.statement_balance_date})`}</dd></div>
              <div><dt className="text-muted-foreground">Difference</dt><dd className="font-medium tabular-nums" data-testid="bank-difference">{rec.difference_pence == null ? '—' : formatPence(rec.difference_pence)}</dd></div>
            </dl>
            {rec.statement_balance_pence == null ? <p className="text-muted-foreground">{BANK_NO_STATEMENT_BALANCE}</p> : <p className="text-muted-foreground">{BANK_DIFFERENCE_NOTE}</p>}
            {rec.shared_ledger_account && <p className="text-muted-foreground">{BANK_SHARED_NOTE}</p>}
            <p data-testid="bank-counts">{counts.unmatched} unmatched, {counts.matched} matched, {counts.ignored} ignored{counts.needs_attention ? `, ${counts.needs_attention} need attention` : ''}.</p>
            {can && (
              <Button variant="outline" disabled={busy} onClick={() => { void act(() => api.bankMatchRun(organizationId, current.id), (r) =>
                `Matched ${r.matched} line${r.matched === 1 ? '' : 's'} automatically.${r.unlinked ? ` ${r.unlinked} link${r.unlinked === 1 ? '' : 's'} to a reversed payment cleared.` : ''}`); }}>
                Match again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {current && can && current.is_active && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Import statement</CardTitle></CardHeader>
          <CardContent>
            <LedgerBankImport api={api} organizationId={organizationId} bankAccountId={current.id} busy={busy} setBusy={setBusy}
              onError={showError} onDone={(r) => { setError(null); setMessage(importDoneText(r)); void load(); }} />
          </CardContent>
        </Card>
      )}

      {current && (
        <Tabs value={review} onValueChange={(v) => setReview(v as Review)}>
          <TabsList aria-label="Statement lines">
            <TabsTrigger value="unmatched">Unmatched ({counts.unmatched})</TabsTrigger>
            <TabsTrigger value="matched">Matched ({counts.matched})</TabsTrigger>
            <TabsTrigger value="ignored">Ignored ({counts.ignored})</TabsTrigger>
            <TabsTrigger value="attention">Needs attention ({counts.needs_attention})</TabsTrigger>
          </TabsList>
          <TabsContent value="unmatched" className="mt-3 space-y-2">
            {(d.unmatched ?? []).length === 0 && <p>No unmatched lines.</p>}
            {counts.unmatched > (d.unmatched ?? []).length && <p className="text-muted-foreground">Showing the newest {(d.unmatched ?? []).length} of {counts.unmatched}.</p>}
            <ul className="space-y-2" data-testid="bank-unmatched">
              {(d.unmatched ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  {(l.suggestions ?? []).length === 0 ? <p className="text-muted-foreground">No payment in the ledger matches this amount within 31 days.</p> : (
                    <ul className="mt-1 space-y-1">
                      {(l.suggestions ?? []).map((s) => (
                        <li key={s.posting_id} className="flex flex-wrap items-center gap-2">
                          <span>{suggestionText(s)}</span>
                          {can && <Button size="sm" disabled={busy} onClick={() => { void act(() => api.bankMatch(organizationId, l.id, s.posting_id), () => 'Matched.'); }}>Match</Button>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {can && <div className="mt-1 flex flex-wrap gap-1">{ignoreButtons(l)}</div>}
                </li>
              ))}
            </ul>
            {(d.unmatched_payments ?? []).length > 0 && (
              <div className="pt-2" data-testid="bank-open-payments">
                <p className="font-medium">Payments in the ledger not found on the statement{d.covered_from ? ` (${d.covered_from} to ${d.covered_to})` : ''}</p>
                <ul className="list-disc pl-5">{(d.unmatched_payments ?? []).map((p) => <li key={p.posting_id}>{paymentText(p)}: {formatPence(p.amount_pence)}</li>)}</ul>
              </div>
            )}
          </TabsContent>
          <TabsContent value="matched" className="mt-3">
            {(d.matched ?? []).length === 0 && <p>No matched lines yet.</p>}
            <ul className="space-y-2" data-testid="bank-matched">
              {(d.matched ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">{paymentText(l)} · {l.match_kind === 'auto' ? 'matched automatically' : 'matched by hand'}</span>
                    {can && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankUnmatch(organizationId, l.id), () => 'Unmatched.'); }}>Unmatch</Button>}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="ignored" className="mt-3">
            {(d.ignored ?? []).length === 0 && <p>No ignored lines.</p>}
            <ul className="space-y-2" data-testid="bank-ignored">
              {(d.ignored ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Ignored: {IGNORE_REASON_LABELS[l.ignore_reason]?.toLowerCase()}</span>
                    {can && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankUnignore(organizationId, l.id), () => 'Back in Unmatched.'); }}>Un-ignore</Button>}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="attention" className="mt-3">
            {(d.needs_attention ?? []).length === 0 && <p>Nothing needs attention.</p>}
            {(d.needs_attention ?? []).length > 0 && (
              <p className="mb-2 text-muted-foreground">The payment these lines were matched to was reversed in the ledger (for example, its invoice changed).
                Press "Match again" to look for the new payment, or unmatch the line.</p>
            )}
            <ul className="space-y-2" data-testid="bank-attention">
              {(d.needs_attention ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Was matched to {paymentText(l)} (reversed)</span>
                    {can && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankUnmatch(organizationId, l.id), () => 'Unmatched.'); }}>Unmatch</Button>}
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
