import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { checkManualJournal, formatPence, LEDGER_POSTED_WARNING, ledgerMessage, linesForRpc, newIdempotencyKey, reverseReasonOk, toPence, type DraftLine, type LedgerAccount, emptyLine } from '@/lib/ledger';
import { codeOf, type JournalEntry, type JournalLine, type LedgerApi } from '@/lib/ledgerApi';
import { JournalGrid } from './JournalGrid';

const SOURCE_LABELS: Record<JournalEntry['source_type'], string> = { manual: 'Manual', opening_balance: 'Opening balances', reversal: 'Reversal' };
const today = () => new Date().toISOString().slice(0, 10);

/** The journals: list, detail, a new manual journal and Reverse. There is no edit or delete. */
export function LedgerJournals({ api, organizationId, accounts, canPost, journals, onChanged }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; canPost: boolean; journals: JournalEntry[]; onChanged: () => void;
}) {
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'detail'; id: string }>({ kind: 'list' });
  const reversedIds = useMemo(() => new Set(journals.map((j) => j.reverses_entry_id).filter(Boolean) as string[]), [journals]);

  if (view.kind === 'new') {
    return <NewJournal api={api} organizationId={organizationId} accounts={accounts} onCancel={() => setView({ kind: 'list' })}
      onPosted={() => { setView({ kind: 'list' }); onChanged(); }} />;
  }
  if (view.kind === 'detail') {
    const entry = journals.find((j) => j.id === view.id);
    if (entry) {
      return <JournalDetail api={api} entry={entry} accounts={accounts} canReverse={canPost && entry.source_type !== 'reversal' && !reversedIds.has(entry.id)}
        reversed={reversedIds.has(entry.id)} onBack={() => setView({ kind: 'list' })} onReversed={() => { setView({ kind: 'list' }); onChanged(); }} />;
    }
  }
  return (
    <div className="space-y-4">
      {canPost && <Button onClick={() => setView({ kind: 'new' })}>New journal</Button>}
      {journals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No journals yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm" aria-label="Journals">
            <thead><tr className="text-left text-muted-foreground"><th className="py-2 pr-2 font-medium">Date</th><th className="py-2 pr-2 font-medium">Description</th><th className="py-2 pr-2 font-medium">Type</th><th className="py-2 font-medium">Posted by</th></tr></thead>
            <tbody className="divide-y">
              {journals.map((j) => (
                <tr key={j.id}>
                  <td className="py-2 pr-2">{j.entry_date}</td>
                  <td className="py-2 pr-2">
                    <button type="button" className="text-left text-primary underline" onClick={() => setView({ kind: 'detail', id: j.id })}>{j.memo}</button>
                    {reversedIds.has(j.id) && <Badge variant="outline" className="ml-2">Reversed</Badge>}
                  </td>
                  <td className="py-2 pr-2">{SOURCE_LABELS[j.source_type] ?? j.source_type}</td>
                  <td className="py-2">{j.posted_by_name ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewJournal({ api, organizationId, accounts, onCancel, onPosted }: {
  api: LedgerApi; organizationId: string; accounts: LedgerAccount[]; onCancel: () => void; onPosted: () => void;
}) {
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per form: pressing Post twice (or a retry after a lost answer) can't post twice.
  const key = useRef(newIdempotencyKey());
  const options = accounts.filter((a) => a.is_active).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const check = checkManualJournal({ date, memo, reason, lines }, new Set(options.map((o) => o.value)));

  const post = async () => {
    setBusy(true); setError(null);
    const r = await api.post(organizationId, { date, memo, reason, lines: linesForRpc(lines, 'account_id'), key: key.current });
    setBusy(false);
    if (r.ok) onPosted(); else setError(ledgerMessage(codeOf(r)));
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">New journal</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="j-date">Date</Label><Input id="j-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="j-memo">Description</Label><Input id="j-memo" value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="j-reason">Reason (required)</Label>
          <Textarea id="j-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
        <JournalGrid idPrefix="journal" lines={lines} onChange={setLines} accounts={options} />
        {check.errors.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground" aria-label="Before you post">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <Alert><AlertDescription>{LEDGER_POSTED_WARNING}</AlertDescription></Alert>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={() => { void post(); }} disabled={busy || !check.ok}>{busy ? 'Posting…' : 'Post journal'}</Button>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function JournalDetail({ api, entry, accounts, canReverse, reversed, onBack, onReversed }: {
  api: LedgerApi; entry: JournalEntry; accounts: LedgerAccount[]; canReverse: boolean; reversed: boolean; onBack: () => void; onReversed: () => void;
}) {
  const [lines, setLines] = useState<JournalLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  useEffect(() => {
    let live = true;
    void api.lines(entry.id).then((r) => { if (!live) return; if (r.ok) setLines(r.data); else setLoadError(ledgerMessage(codeOf(r))); });
    return () => { live = false; };
  }, [api, entry.id]);

  const reverse = async () => {
    setBusy(true); setError(null);
    const r = await api.reverse(entry.id, reason);
    setBusy(false);
    if (r.ok) onReversed(); else setError(ledgerMessage(codeOf(r)));
  };
  const totals = (lines ?? []).reduce((t, l) => ({ d: t.d + toPence(l.debit), c: t.c + toPence(l.credit) }), { d: 0, c: 0 });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{entry.memo}</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p><strong>Date:</strong> {entry.entry_date}</p>
          <p><strong>Type:</strong> {SOURCE_LABELS[entry.source_type] ?? entry.source_type}{reversed ? ' (reversed)' : ''}</p>
          {entry.reason && <p><strong>Reason:</strong> {entry.reason}</p>}
          {entry.posted_by_name && <p><strong>Posted by:</strong> {entry.posted_by_name}</p>}
        </div>
        {loadError && <p role="alert" className="text-destructive">{loadError}</p>}
        {lines && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]" aria-label="Journal lines">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2 font-medium">Account</th><th className="py-1 pr-2 font-medium">Debit</th><th className="py-1 font-medium">Credit</th></tr></thead>
              <tbody>
                {lines.map((l) => {
                  const a = byId.get(l.account_id);
                  return <tr key={l.id}><td className="py-1 pr-2">{a ? `${a.code} ${a.name}` : l.account_id}</td><td className="py-1 pr-2">{formatPence(toPence(l.debit))}</td><td className="py-1">{formatPence(toPence(l.credit))}</td></tr>;
                })}
              </tbody>
              <tfoot><tr className="font-medium"><td className="py-1 pr-2">Totals</td><td className="py-1 pr-2">{formatPence(totals.d)}</td><td className="py-1">{formatPence(totals.c)}</td></tr></tfoot>
            </table>
          </div>
        )}
        {reversing ? (
          <div className="space-y-2 rounded-md border p-3">
            <p>Reversing posts a new journal with the debits and credits swapped, dated today. This journal stays as it is.</p>
            <Label htmlFor="rev-reason">Reason for reversing (required)</Label>
            <Textarea id="rev-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            {error && <p role="alert" className="text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="destructive" disabled={busy || !reverseReasonOk(reason)} onClick={() => { void reverse(); }}>{busy ? 'Reversing…' : 'Post the reversal'}</Button>
              <Button variant="outline" disabled={busy} onClick={() => { setReversing(false); setError(null); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>Back to journals</Button>
            {canReverse && <Button variant="outline" onClick={() => setReversing(true)}>Reverse</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
