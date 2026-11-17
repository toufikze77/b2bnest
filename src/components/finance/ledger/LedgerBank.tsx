// Finance phase 3c-1: the "Bank" section of the Ledger tab (docs/ledger-bank/README.md). Bank accounts, statement import,
// automatic and manual matching to payments already in the ledger, and a reconciliation summary. Members can read;
// owners and admins act. Importing and matching post nothing; phase 3c-2 lets a manager post a line they choose (and undo
// it). Every rule is decided by the database.
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssuranceContext } from '@/hooks/useAssurance';
import { formatPence, ledgerMessage, type LedgerAccount } from '@/lib/ledger';
import { codeOf, type LedgerApi, type Result } from '@/lib/ledgerApi';
import { AUTO_MFA_MESSAGE } from '@/lib/ledgerAuto';
import {
  BANK_DIFFERENCE_NOTE, BANK_INTRO, BANK_MANAGER_ONLY, BANK_NO_STATEMENT_BALANCE, BANK_SHARED_NOTE, IGNORE_REASON_LABELS,
  importDoneText, paymentText, suggestionText, type BankLine, type BankOverview, type IgnoreReason,
} from '@/lib/ledgerBank';
import {
  allowedAccounts, BANK_POSTING_NOTE, effectText, linesTotal, MAX_POST_MANY, POST_BLOCKED_HINT, POST_DONE, POST_EXPENSES_HINT, POST_NO_VAT, POST_SUGGESTED, searchAccounts, suggestAccount,
  UNPOST_CONFIRM,
} from '@/lib/ledgerBankPost';
import { LedgerBankImport } from './LedgerBankImport';

type State = { kind: 'loading' } | { kind: 'not_available' } | { kind: 'error'; message: string } | { kind: 'ready'; data: BankOverview };
type Review = 'unmatched' | 'matched' | 'ignored' | 'posted' | 'attention';
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
  // Finance phase 3c-2: posting. The company's accounts (for the picker), the line being posted, the chosen account,
  // the lines ticked for "Post selected", and the line whose Undo is being confirmed.
  const [chart, setChart] = useState<LedgerAccount[]>([]);
  const [posting, setPosting] = useState<string | null>(null);
  const [postAccount, setPostAccount] = useState('');
  const [suggested, setSuggested] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);

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
  useEffect(() => {
    let live = true;
    void api.accounts(organizationId).then((r) => { if (live) setChart(r.ok ? r.data : []); });
    return () => { live = false; };
  }, [api, organizationId, refreshKey]);

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
  // Posting (phase 3c-2) is offered only once the database reports posted lines (its SQL is applied).
  const canPost = can && d.counts?.posted !== undefined;
  const counts = { unmatched: 0, matched: 0, ignored: 0, needs_attention: 0, posted: 0, ...d.counts };
  const allowed = allowedAccounts(chart);
  const unmatched = d.unmatched ?? [];
  const chosen = unmatched.filter((l) => selected.includes(l.id));
  const openPost = (l: BankLine) => {
    const s = suggestAccount(l.description, l.amount_pence, allowed);
    setPosting(l.id); setSuggested(s?.id ?? null); setPostAccount(s?.id ?? ''); setSearch(''); setBulkOpen(false);
  };
  const toggle = (id: string) => setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length >= MAX_POST_MANY ? xs : [...xs, id]));
  const accountName = (id: string) => allowed.find((a) => a.id === id) ?? null;
  const picker = (id: string) => (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1"><span>Search accounts</span>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search accounts" className="w-48" /></label>
      <label className="flex flex-col gap-1"><span>Account</span>
        <select aria-label="Account" id={id} value={postAccount} onChange={(e) => setPostAccount(e.target.value)} className="rounded-md border bg-background px-2 py-1">
          <option value="">Choose an account</option>
          {searchAccounts(allowed, search).concat(postAccount && !searchAccounts(allowed, search).some((a) => a.id === postAccount) && accountName(postAccount) ? [accountName(postAccount) as LedgerAccount] : [])
            .map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
        </select>
      </label>
    </div>
  );
  const unpostText = (r: { how: string; reversal_date: string | null; reversal_dated: string | null }) => (r.how === 'already_reversed'
    ? 'Undone. The journal had already been reversed, so the line is back in Unmatched.'
    : `Undone. A reversal journal dated ${r.reversal_date}${r.reversal_dated === 'today' ? " (today: the line's date is locked or before your books start)" : ''} was posted, and the line is back in Unmatched.`);
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
          <p className="font-medium" data-testid="bank-never-posts">{BANK_POSTING_NOTE}</p>
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
            <p data-testid="bank-counts">{counts.unmatched} unmatched, {counts.matched} matched, {counts.ignored} ignored{d.counts?.posted !== undefined ? `, ${counts.posted} posted` : ''}{counts.needs_attention ? `, ${counts.needs_attention} need attention` : ''}.</p>
            {can && (
              <Button variant="outline" disabled={busy} onClick={() => { void act(() => api.bankMatchRun(organizationId, current.id), (r) =>
                `Matched ${r.matched} line${r.matched === 1 ? '' : 's'} automatically.${r.unlinked ? ` ${r.unlinked} link${r.unlinked === 1 ? '' : 's'} to a reversed payment cleared.` : ''}${r.unposted ? ` ${r.unposted} line${r.unposted === 1 ? '' : 's'} whose journal was reversed ${r.unposted === 1 ? 'is' : 'are'} back in Unmatched.` : ''}`); }}>
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
            {d.counts?.posted !== undefined && <TabsTrigger value="posted">Posted ({counts.posted})</TabsTrigger>}
            <TabsTrigger value="attention">Needs attention ({counts.needs_attention})</TabsTrigger>
          </TabsList>
          <TabsContent value="unmatched" className="mt-3 space-y-2">
            {(d.unmatched ?? []).length === 0 && <p>No unmatched lines.</p>}
            {counts.unmatched > (d.unmatched ?? []).length && <p className="text-muted-foreground">Showing the newest {(d.unmatched ?? []).length} of {counts.unmatched}.</p>}
            {canPost && chosen.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" data-testid="bank-selection">
                <span>{chosen.length} selected{selected.length >= MAX_POST_MANY ? ` (at most ${MAX_POST_MANY})` : ''}</span>
                <Button size="sm" disabled={busy} onClick={() => { setBulkOpen(true); setPosting(null); setPostAccount(''); setSearch(''); setSuggested(null); }}>Post selected</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setSelected([]); setBulkOpen(false); }}>Clear</Button>
              </div>
            )}
            {canPost && bulkOpen && chosen.length > 0 && (
              <div className="space-y-2 rounded-md border p-3" data-testid="bank-bulk-panel">
                <p className="font-medium">Post {chosen.length} line{chosen.length === 1 ? '' : 's'} to one account</p>
                <ul className="list-disc pl-5">{chosen.map((l) => <li key={l.id}>{l.line_date} {l.description}: {formatPence(l.amount_pence)}</li>)}</ul>
                <p data-testid="bank-bulk-total">Total {formatPence(linesTotal(chosen))}</p>
                {picker('bulk-account')}
                <p className="text-muted-foreground">{POST_EXPENSES_HINT} {POST_NO_VAT}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || !postAccount} onClick={() => { void act(() => api.bankPostMany(organizationId, postAccount, chosen.map((l) => l.id)), (r) => {
                    setSelected([]); setBulkOpen(false);
                    return `Posted ${r.posted} line${r.posted === 1 ? '' : 's'}. Your ledger bank balance now includes ${r.posted === 1 ? 'it' : 'them'}.`;
                  }); }}>Post {chosen.length} line{chosen.length === 1 ? '' : 's'}</Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setBulkOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <ul className="space-y-2" data-testid="bank-unmatched">
              {(d.unmatched ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  <div className="flex items-start gap-2">
                    {canPost && <input type="checkbox" aria-label={`Select ${l.description}`} checked={selected.includes(l.id)} disabled={busy || (!selected.includes(l.id) && selected.length >= MAX_POST_MANY)}
                      onChange={() => toggle(l.id)} className="mt-1" />}
                    <div className="flex-1">{lineHead(l)}</div>
                  </div>
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
                  {can && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {canPost && <Button size="sm" variant="outline" disabled={busy} onClick={() => openPost(l)}>Post to ledger</Button>}
                      {ignoreButtons(l)}
                    </div>
                  )}
                  {canPost && posting === l.id && (
                    <div className="mt-2 space-y-2 rounded-md border p-3" data-testid="bank-post-panel">
                      <p className="font-medium" data-testid="bank-post-effect">{effectText(l.amount_pence, accountName(postAccount))}</p>
                      {picker(`post-account-${l.id}`)}
                      {suggested && postAccount === suggested && <p className="text-muted-foreground" data-testid="bank-post-suggested">{POST_SUGGESTED}</p>}
                      <p className="text-muted-foreground">{POST_EXPENSES_HINT} {POST_NO_VAT}</p>
                      <p className="text-muted-foreground">{POST_BLOCKED_HINT}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={busy || !postAccount} onClick={() => { void act(() => api.bankPost(organizationId, l.id, postAccount), () => { setPosting(null); setSelected((xs) => xs.filter((x) => x !== l.id)); return POST_DONE; }); }}>Post</Button>
                        <Button variant="ghost" disabled={busy} onClick={() => setPosting(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
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
          <TabsContent value="posted" className="mt-3">
            {(d.posted ?? []).length === 0 && <p>No posted lines.</p>}
            <ul className="space-y-2" data-testid="bank-posted">
              {(d.posted ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground">Posted to {l.account_code} {l.account_name}</span>
                    {can && undoing !== l.id && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setUndoing(l.id)}>Undo</Button>}
                  </div>
                  {can && undoing === l.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border p-2" role="alertdialog" aria-label="Undo posting" data-testid="bank-undo-confirm">
                      <span>{UNPOST_CONFIRM}</span>
                      <Button size="sm" disabled={busy} onClick={() => { void act(() => api.bankUnpost(organizationId, l.id), (r) => { setUndoing(null); return unpostText(r); }); }}>Undo posting</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setUndoing(null)}>Cancel</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="attention" className="mt-3">
            {(d.needs_attention ?? []).length === 0 && <p>Nothing needs attention.</p>}
            {(d.needs_attention ?? []).length > 0 && (
              <p className="mb-2 text-muted-foreground">Something these lines depended on was reversed in the ledger (a matched payment whose invoice changed, or a posted
                line's journal reversed on the Journals screen). Press "Match again" to sort them out, or use the button on the line.</p>
            )}
            <ul className="space-y-2" data-testid="bank-attention">
              {(d.needs_attention ?? []).map((l) => (
                <li key={l.id} className="rounded-md border p-2">
                  {lineHead(l)}
                  {l.reason === 'post_broken' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Was posted to {l.account_code} {l.account_name}; that journal was reversed on the Journals screen</span>
                      {can && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankUnpost(organizationId, l.id), (r) => unpostText(r)); }}>Back to Unmatched</Button>}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Was matched to {paymentText({ kind: l.kind ?? 'invoice_paid', source_label: l.source_label ?? null, entry_date: l.entry_date ?? '' })} (reversed)</span>
                      {can && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { void act(() => api.bankUnmatch(organizationId, l.id), () => 'Unmatched.'); }}>Unmatch</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
