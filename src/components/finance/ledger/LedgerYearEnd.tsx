// Finance phase 5: the "Year end" section of the Ledger tab (docs/ledger-year-end/README.md). Members can read it; only
// an owner or admin (the database decides: can_manage) sets the year end, closes a year or re-opens the latest one.
// Every rule is enforced by the RPCs; this screen shows the preview and asks for a clear confirmation first.
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatPence, LEDGER_DISCLAIMER, ledgerMessage, toPence } from '@/lib/ledger';
import { codeOf, type LedgerApi } from '@/lib/ledgerApi';
import { AUTO_MFA_MESSAGE } from '@/lib/ledgerAuto';
import { profitWord, ukDate } from '@/lib/ledgerReports';
import {
  daysInPeriod, firstYearEnd, lockAfterReopen, lockConfirmText, maxDay, MONTHS, PROBLEM_TEXT, profitPence, reopenConfirmText, validYearEnd,
  warningCount, warningTexts, YEAR_END_EXPLAINED, yearEndLabel, type YearEndPreview, type YearEndStatus, type YearEndWarnings,
} from '@/lib/ledgerYearEnd';

type Load<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ok'; data: T };
const message = (code: string) => (code === 'MFA_REQUIRED' ? AUTO_MFA_MESSAGE : code === 'NOT_AVAILABLE' ? 'Year end is not available yet.' : ledgerMessage(code));
const resultText = (pence: number) => `${profitWord(pence)} ${formatPence(Math.abs(pence))}`;

export function LedgerYearEnd({ api, organizationId, refreshKey = 0, onChanged }: {
  api: LedgerApi; organizationId: string; refreshKey?: number; onChanged?: () => void;
}) {
  const [state, setState] = useState<Load<YearEndStatus>>({ kind: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api.yearEndStatus(organizationId);
    setState(r.ok ? { kind: 'ok', data: r.data } : { kind: 'error', message: message(codeOf(r)) });
  }, [api, organizationId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const changed = (text: string) => { setNotice(text); void load(); onChanged?.(); };

  if (state.kind === 'loading') return <p role="status">Loading…</p>;
  if (state.kind === 'error') return <p role="alert" className="text-destructive">{state.message}</p>;
  const s = state.data;
  if (!s.set_up) return <p>Set up the ledger first.</p>;
  const closed = s.closed_years ?? [];
  const hasYearEnd = !!s.year_end_month && !!s.year_end_day;

  return (
    <div className="space-y-6 text-sm" data-testid="ledger-year-end">
      <p className="text-muted-foreground">{YEAR_END_EXPLAINED}</p>
      {!s.can_manage && <p data-testid="ye-read-only">You can view the year end. Only an owner or admin can set it, close a year or re-open one.</p>}
      {notice && <p role="status" className="font-medium text-green-700">{notice}</p>}

      <YearEndSetting api={api} organizationId={organizationId} status={s} onSaved={(t) => changed(t)} />

      <section className="space-y-2" aria-labelledby="ye-closed">
        <h3 id="ye-closed" className="font-semibold">Closed years</h3>
        {closed.length === 0 ? <p className="text-muted-foreground">No year is closed yet.</p> : (
          <ClosedYears api={api} organizationId={organizationId} status={s} onReopened={(t) => changed(t)} />
        )}
      </section>

      {hasYearEnd && s.next_year_end && (
        <CloseYear key={s.next_year_end} api={api} organizationId={organizationId} status={s} onClosed={(t) => changed(t)} />
      )}
      <p className="text-xs text-muted-foreground">{LEDGER_DISCLAIMER}</p>
    </div>
  );
}

function YearEndSetting({ api, organizationId, status, onSaved }: { api: LedgerApi; organizationId: string; status: YearEndStatus; onSaved: (t: string) => void }) {
  const [month, setMonth] = useState<number>(status.year_end_month ?? 0);
  const [day, setDay] = useState<number>(status.year_end_day ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSet = !!status.year_end_month && !!status.year_end_day;
  const fixed = !!status.locked_through && (status.closed_years ?? []).length > 0;
  const canEdit = status.can_manage && !status.locked_through;
  const start = status.start_date ?? null;
  const preview = validYearEnd(month, day) && start ? firstYearEnd(start, month, day) : null;
  const unchanged = month === status.year_end_month && day === status.year_end_day;
  const save = async () => {
    setBusy(true); setError(null);
    const r = await api.yearEndSet(organizationId, month, day);
    setBusy(false);
    if (r.ok) onSaved(r.data.result === 'unchanged' ? 'Nothing changed.' : `Financial year end saved: ${yearEndLabel(month, day)}.`);
    else setError(message(codeOf(r)));
  };
  return (
    <section className="space-y-2" aria-labelledby="ye-setting">
      <h3 id="ye-setting" className="font-semibold">Financial year end</h3>
      <p data-testid="ye-current">{isSet ? `${yearEndLabel(status.year_end_month as number, status.year_end_day as number)}.` : 'Not set yet. There is no default: enter the date your company\'s financial year ends.'}</p>
      {fixed && <p className="text-muted-foreground">It can't change while a year is closed.</p>}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">Day
            <select aria-label="Day" value={day || ''} onChange={(e) => setDay(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2">
              <option value="">Day</option>
              {Array.from({ length: month ? maxDay(month) : 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Month
            <select aria-label="Month" value={month || ''} onChange={(e) => { const m = Number(e.target.value); setMonth(m); if (m && day > maxDay(m)) setDay(maxDay(m)); }}
              className="h-9 rounded-md border bg-background px-2">
              <option value="">Month</option>
              {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </select>
          </label>
          <Button disabled={busy || !validYearEnd(month, day) || unchanged} onClick={() => { void save(); }}>{busy ? 'Saving…' : 'Save year end'}</Button>
        </div>
      )}
      {canEdit && preview && start && !unchanged && (
        <p className="text-muted-foreground" data-testid="ye-first-year">
          Your first year would run from {ukDate(start)} to {ukDate(preview)} ({daysInPeriod(start, preview)} days).
        </p>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </section>
  );
}

function ClosedYears({ api, organizationId, status, onReopened }: { api: LedgerApi; organizationId: string; status: YearEndStatus; onReopened: (t: string) => void }) {
  const closed = status.closed_years ?? [];
  const latest = closed[closed.length - 1];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reopen = async () => {
    setBusy(true); setError(null);
    const r = await api.yearEndReopen(organizationId, latest.year_end);
    setBusy(false);
    if (r.ok) { setConfirming(false); onReopened(`The year ending ${ukDate(latest.year_end)} is open again.`); } else setError(message(codeOf(r)));
  };
  return (
    <div className="space-y-2">
      <table className="w-full max-w-2xl text-left" data-testid="ye-closed-table">
        <thead><tr className="border-b"><th className="py-1 pr-2">Year</th><th className="py-1 pr-2">Result</th><th className="py-1 pr-2">Close journal</th><th className="py-1" /></tr></thead>
        <tbody>
          {closed.map((y) => (
            <tr key={y.year_end} className="border-b">
              <td className="py-1 pr-2">{ukDate(y.year_start)} to {ukDate(y.year_end)}</td>
              <td className="py-1 pr-2">{resultText(profitPence(y))}</td>
              <td className="py-1 pr-2">{y.entry_id ? 'Posted' : 'None (nothing to move)'}</td>
              <td className="py-1">
                {status.can_manage && y === latest && !confirming && <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>Re-open year</Button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {confirming && (
        <div className="space-y-2 rounded-md border p-3" role="group" aria-label="Re-open year">
          <p>{reopenConfirmText(latest.year_end, lockAfterReopen(status))}</p>
          <div className="flex gap-2">
            <Button variant="destructive" disabled={busy} onClick={() => { void reopen(); }}>{busy ? 'Re-opening…' : 'Re-open the year'}</Button>
            <Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}

function CloseYear({ api, organizationId, status, onClosed }: { api: LedgerApi; organizationId: string; status: YearEndStatus; onClosed: (t: string) => void }) {
  const ye = status.next_year_end as string;
  const [preview, setPreview] = useState<Load<YearEndPreview> | null>(null);
  const [acks, setAcks] = useState<Partial<Record<keyof YearEndWarnings, boolean>>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const show = async () => {
    setPreview({ kind: 'loading' }); setAcks({}); setConfirmed(false); setError(null);
    const r = await api.yearEndPreview(organizationId, ye);
    setPreview(r.ok ? { kind: 'ok', data: r.data } : { kind: 'error', message: message(codeOf(r)) });
  };
  const p = preview?.kind === 'ok' ? preview.data : null;
  const warnings = p ? warningTexts(p.warnings) : [];
  const allAcked = warnings.every((w) => acks[w.key]);
  const close = async () => {
    if (!p) return;
    setBusy(true); setError(null);
    const r = await api.yearEndClose(organizationId, ye, warningCount(p.warnings) > 0);
    setBusy(false);
    if (r.ok) onClosed(r.data.result === 'unchanged' ? 'That year was already closed.' : `The year ending ${ukDate(ye)} is closed and the books are locked through ${ukDate(ye)}.`);
    else setError(message(codeOf(r)));
  };
  const profit = p ? profitPence(p) : 0;
  return (
    <section className="space-y-3" aria-labelledby="ye-close">
      <h3 id="ye-close" className="font-semibold">Close the next year</h3>
      <p>Next year end: {ukDate(ye)}{status.next_year_start ? ` (the year from ${ukDate(status.next_year_start)} to ${ukDate(ye)})` : ''}.</p>
      {!status.can_close_now && <p className="text-muted-foreground">This year hasn't ended yet. You can preview it, but it can only be closed after {ukDate(ye)}.</p>}
      <Button variant="outline" onClick={() => { void show(); }}>{preview ? 'Refresh the preview' : 'Preview the close'}</Button>
      {preview?.kind === 'loading' && <p role="status">Loading…</p>}
      {preview?.kind === 'error' && <p role="alert" className="text-destructive">{preview.message}</p>}
      {p && (
        <div className="space-y-3" data-testid="ye-preview">
          {p.lines.length === 0 ? <p>There is no income or spending in this year, so no journal is posted. Closing only locks the books.</p> : (
            <table className="w-full max-w-2xl text-left">
              <caption className="mb-1 text-left text-muted-foreground">The close journal, dated {ukDate(p.year_end)}</caption>
              <thead><tr className="border-b"><th className="py-1 pr-2">Account</th><th className="py-1 pr-2 text-right">Debit</th><th className="py-1 text-right">Credit</th></tr></thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.account_id} className="border-b">
                    <td className="py-1 pr-2">{l.code} {l.name}{l.is_active ? '' : ' (inactive)'}</td>
                    <td className="py-1 pr-2 text-right">{toPence(String(l.debit)) ? formatPence(toPence(String(l.debit))) : ''}</td>
                    <td className="py-1 text-right">{toPence(String(l.credit)) ? formatPence(toPence(String(l.credit))) : ''}</td>
                  </tr>
                ))}
                {profit !== 0 && (
                  <tr className="border-b font-medium">
                    <td className="py-1 pr-2">3200 Retained earnings</td>
                    <td className="py-1 pr-2 text-right">{profit < 0 ? formatPence(-profit) : ''}</td>
                    <td className="py-1 text-right">{profit > 0 ? formatPence(profit) : ''}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <p className="font-medium" data-testid="ye-result">{resultText(profit)} for the year {ukDate(p.year_start)} to {ukDate(p.year_end)}.</p>
          {p.problem && <p role="alert" className="text-destructive" data-testid="ye-problem">{PROBLEM_TEXT[p.problem]}</p>}
          {warnings.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-300 p-3" data-testid="ye-warnings">
              <p className="font-medium">Before you close this year</p>
              {warnings.map((w) => (
                <div key={w.key} className="space-y-1">
                  <p>{w.text}</p>
                  {status.can_manage && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={!!acks[w.key]} onChange={(e) => setAcks((a) => ({ ...a, [w.key]: e.target.checked }))} />{w.ack}
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
          {status.can_manage && !p.problem && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{lockConfirmText(p.lock_date)}
              </label>
              <Button variant="destructive" disabled={busy || !confirmed || !allAcked} onClick={() => { void close(); }}>{busy ? 'Closing…' : 'Close year'}</Button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </section>
  );
}
