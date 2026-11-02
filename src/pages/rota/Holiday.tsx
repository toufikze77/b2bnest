import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Download } from 'lucide-react';
import RotaLayout from './RotaLayout';
import { useRota } from '@/hooks/useRota';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  addDays, awayCsv, balanceLines, countDays, daysText, errorText, formatDay, HOLIDAY_FAQ, isMissingFeature, KIND_LABEL, MONTH_NAMES, NOT_AVAILABLE,
  NOT_LINKED, NOTE_MAX, othersOff, othersOffText, rangeText, requestError, STATUTORY_HINT, statusLine, today, WORKING_DAYS_NOTE,
  type AwayEntry, type Half, type LeaveBalance, type LeaveKind, type LeaveRequest,
} from '@/lib/rotaLeave';
import * as api from '@/lib/rotaLeaveApi';

const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CARD = 'rounded-card border border-border bg-card p-4 text-card-foreground';
const AHEAD_DAYS = 90;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const leaveYearOf = (day: string, startMonth: number) => {
  const [y, m] = day.split('-').map(Number);
  return m >= startMonth ? y : y - 1;
};

/** Phase 32: Rota → Holiday. Staff ask; the company's owner and admins decide. */
export default function Holiday() {
  const { user, organizationId, employees, isLeaveManager } = useRota();
  const userId = user?.id ?? null;
  const todayDay = today();
  const [available, setAvailable] = useState<'checking' | 'yes' | 'no'>('checking');
  const [me, setMe] = useState<{ id: string; full_name: string } | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [away, setAway] = useState<AwayEntry[]>([]);
  const [bal, setBal] = useState<LeaveBalance | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState({ employeeId: '', start: '', end: '', startHalf: 'full' as Half, endHalf: 'full' as Half, kind: 'annual' as LeaveKind, note: '' });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  // Managers only.
  const [startMonth, setStartMonth] = useState(1);
  const [allowance, setAllowance] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<api.LinkCandidate[]>([]);
  const [linkPick, setLinkPick] = useState<Record<string, string>>({});
  const [exportRange, setExportRange] = useState({ from: todayDay, to: addDays(todayDay, 30) });

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const names = useMemo(() => new Map(employees.map((e) => [e.id, e.full_name])), [employees]);
  const leaveYear = leaveYearOf(todayDay, startMonth);

  useEffect(() => {
    if (!organizationId || !userId) return;
    let live = true;
    (async () => {
      const [mine, list, cal] = await Promise.all([api.myEmployee(organizationId, userId), api.listRequests(organizationId), api.calendar(organizationId, todayDay, addDays(todayDay, AHEAD_DAYS))]);
      if (!live) return;
      if (isMissingFeature(list.error) || isMissingFeature(cal.error)) { setAvailable('no'); return; }
      setAvailable('yes');
      if (list.error || cal.error) setMessage(errorText(list.error ?? cal.error));
      setMe(mine.data ?? null);
      setRequests(list.data ?? []);
      setAway(cal.data ?? []);
      setForm((f) => ({ ...f, employeeId: f.employeeId || mine.data?.id || '' }));
      if (mine.data) { const b = await api.balance(mine.data.id); if (live) setBal(b.error ? null : b.data); }
      if (isLeaveManager) {
        const m = await api.leaveYearStartMonth(organizationId);
        const [al, cands] = await Promise.all([api.allowances(organizationId, leaveYearOf(todayDay, m)), api.linkCandidates(organizationId)]);
        if (!live) return;
        setStartMonth(m);
        setAllowance(Object.fromEntries((al.data ?? []).map((a) => [a.employee_id, String(a.days)])));
        setCandidates(cands.data ?? []);
        setLinkPick(Object.fromEntries((cands.data ?? []).filter((c) => !c.linked_employee_id).map((c) => [c.user_id, c.suggested_employee_id ?? ''])));
      }
    })();
    return () => { live = false; };
  }, [organizationId, userId, isLeaveManager, reload, todayDay]);

  const run = async (fn: () => PromiseLike<{ error: api.DbError }>, said: string) => {
    setBusy(true); setMessage(null);
    try {
      const { error } = await fn();
      if (error) { setMessage(errorText(error)); return false; }
      setAnnounce(said); refresh(); return true;
    } catch { setMessage(errorText(null)); return false; } finally { setBusy(false); }
  };

  const draft = { employee_id: form.employeeId, start_date: form.start, end_date: form.end || form.start, start_half: form.startHalf, end_half: form.start && (form.end || form.start) === form.start ? form.startHalf : form.endHalf };
  const draftDays = draft.start_date && draft.end_date >= draft.start_date ? countDays(draft) : null;
  const draftOthers = draft.start_date ? othersOffText(othersOff(draft, away)) : null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.employee_id) { setMessage('Choose who the holiday is for.'); return; }
    const err = requestError(draft, todayDay, isLeaveManager);
    if (err) { setMessage(err); return; }
    const ok = await run(() => api.createRequest({ employeeId: draft.employee_id, start: draft.start_date, end: draft.end_date, startHalf: draft.start_half, endHalf: draft.end_half, kind: form.kind, note: form.note.trim() }),
      'Request sent. A manager will decide it.');
    if (ok) setForm((f) => ({ ...f, start: '', end: '', startHalf: 'full', endHalf: 'full', note: '' }));
  };

  if (!organizationId) return <RotaLayout><p className="text-sm text-muted-foreground">Choose a company from the drop-down in the top bar first.</p></RotaLayout>;
  if (available === 'checking') return <RotaLayout><p className="text-sm text-muted-foreground" role="status">Loading holiday…</p></RotaLayout>;
  if (available === 'no') {
    return (
      <RotaLayout>
        <div role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm text-foreground" data-testid="leave-not-available">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />{NOT_AVAILABLE}
        </div>
      </RotaLayout>
    );
  }

  const mine = me ? requests.filter((r) => r.employee_id === me.id) : [];
  const pending = requests.filter((r) => r.status === 'pending');
  const b = balanceLines(bal);
  const canAsk = !!me || isLeaveManager;
  const activeEmployees = employees.filter((e) => e.is_active);

  return (
    <RotaLayout>
      <p aria-live="polite" className="sr-only" data-testid="leave-announce">{announce}</p>
      <div className="space-y-6">
        {message && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />{message}
          </div>
        )}
        {!me && <p className="rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="leave-not-linked">{NOT_LINKED}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          {canAsk && (
            <form onSubmit={(e) => void submit(e)} className={`${CARD} space-y-3`} aria-labelledby="ask-title">
              <h2 id="ask-title" className="text-card-title">Ask for holiday</h2>
              {isLeaveManager && (
                <div><Label htmlFor="lv-emp">For</Label>
                  <select id="lv-emp" className={FIELD} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">Choose a person</option>
                    {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.full_name}{me?.id === e.id ? ' (you)' : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="lv-start">First day</Label><input id="lv-start" type="date" className={FIELD} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
                <div><Label htmlFor="lv-end">Last day (leave empty for one day)</Label><input id="lv-end" type="date" className={FIELD} value={form.end} min={form.start || undefined} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
                <div><Label htmlFor="lv-sh">{draft.start_date === draft.end_date ? 'Day' : 'First day'}</Label>
                  <select id="lv-sh" className={FIELD} value={form.startHalf} onChange={(e) => setForm({ ...form, startHalf: e.target.value as Half })}>
                    <option value="full">Full day</option>
                    {draft.start_date === draft.end_date && <option value="am">Morning only</option>}
                    <option value="pm">Afternoon only</option>
                  </select>
                </div>
                {draft.start_date !== draft.end_date && (
                  <div><Label htmlFor="lv-eh">Last day</Label>
                    <select id="lv-eh" className={FIELD} value={form.endHalf} onChange={(e) => setForm({ ...form, endHalf: e.target.value as Half })}>
                      <option value="full">Full day</option><option value="am">Morning only</option>
                    </select>
                  </div>
                )}
                <div><Label htmlFor="lv-kind">Type</Label>
                  <select id="lv-kind" className={FIELD} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as LeaveKind })}>
                    {(Object.keys(KIND_LABEL) as LeaveKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                  </select>
                </div>
              </div>
              <div><Label htmlFor="lv-note">Note (optional; only you and managers see it)</Label>
                <textarea id="lv-note" className={`${FIELD} h-20 py-2`} maxLength={NOTE_MAX} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                <p className="text-xs text-muted-foreground">{form.note.length} of {NOTE_MAX} characters</p>
              </div>
              {draftDays && (
                <p className="text-sm" data-testid="leave-preview">
                  Working days: {daysText(draftDays.working)} ({daysText(draftDays.calendar)} in the calendar){draftOthers ? `. ${draftOthers}.` : '.'}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{WORKING_DAYS_NOTE}</p>
              <Button type="submit" disabled={busy}>Send request</Button>
            </form>
          )}

          {me && (
            <section className={CARD} aria-labelledby="bal-title" data-testid="leave-balance">
              <h2 id="bal-title" className="text-card-title">Your holiday</h2>
              <p className="text-xs text-muted-foreground">{b.title}</p>
              <ul className="mt-2 space-y-1 text-sm">{b.lines.map((l) => <li key={l}>{l}</li>)}</ul>
              <p className="mt-2 text-xs text-muted-foreground">{STATUTORY_HINT}</p>
              <h3 className="mt-4 font-semibold">Your requests</h3>
              {mine.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="my-empty">You haven't asked for any holiday yet.</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {mine.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="my-request">
                      <div><p className="text-sm font-medium">{rangeText(r)} · {KIND_LABEL[r.kind]}</p><p className="text-xs text-muted-foreground">{statusLine(r)}</p></div>
                      {(r.status === 'pending' || (r.status === 'approved' && r.start_date > todayDay)) && (
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api.cancelRequest(r.id), 'Request cancelled.')}>Cancel request</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {isLeaveManager && (
          <section className={CARD} aria-labelledby="queue-title" data-testid="leave-queue">
            <h2 id="queue-title" className="text-card-title">Waiting for a decision <Badge variant="secondary">{pending.length}</Badge></h2>
            {pending.length === 0 ? <p className="mt-2 text-sm text-muted-foreground" data-testid="queue-empty">No requests waiting.</p> : (
              <ul className="mt-2 divide-y divide-border">
                {pending.map((r) => {
                  const days = countDays(r); const others = othersOffText(othersOff(r, away));
                  return (
                    <li key={r.id} className="space-y-2 py-3" data-testid="queue-item">
                      <p className="text-sm font-medium">{names.get(r.employee_id) ?? 'Employee'}: {rangeText(r)} · {KIND_LABEL[r.kind]} · {daysText(days.working)} working</p>
                      {r.note && <p className="text-sm text-muted-foreground">Note: {r.note}</p>}
                      {others && <p className="text-sm text-foreground"><strong>{others}</strong></p>}
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[14rem] flex-1"><Label htmlFor={`why-${r.id}`}>Reason (optional, shown to them)</Label>
                          <input id={`why-${r.id}`} className={FIELD} maxLength={NOTE_MAX} value={reasons[r.id] ?? ''} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })} /></div>
                        <Button type="button" size="sm" disabled={busy} onClick={() => void run(() => api.decideRequest(r.id, 'approve', reasons[r.id] ?? ''), 'Request approved.')}>Approve</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api.decideRequest(r.id, 'change', reasons[r.id] ?? ''), 'Asked for a change.')}>Ask for a change</Button>
                        <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void run(() => api.decideRequest(r.id, 'decline', reasons[r.id] ?? ''), 'Request declined.')}>Decline</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className={CARD} aria-labelledby="away-title" data-testid="leave-away">
          <h2 id="away-title" className="flex items-center gap-2 text-card-title"><CalendarDays className="h-4 w-4" aria-hidden />Who is away (next {AHEAD_DAYS} days)</h2>
          {away.length === 0 ? <p className="mt-2 text-sm text-muted-foreground" data-testid="away-empty">No approved holiday in the next {AHEAD_DAYS} days.</p> : (
            <ul className="mt-2 divide-y divide-border">
              {away.map((a) => (
                <li key={a.request_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-medium">{a.full_name}</span><span>{rangeText(a)}</span>
                  {isLeaveManager && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.cancelRequest(a.request_id), 'Holiday cancelled.')}>Cancel</Button>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isLeaveManager && (
          <>
            <section className={`${CARD} space-y-3`} aria-labelledby="allow-title">
              <h2 id="allow-title" className="text-card-title">Allowances</h2>
              <div className="flex flex-wrap items-end gap-2">
                <div><Label htmlFor="lv-month">Leave year starts in</Label>
                  <select id="lv-month" className={FIELD} value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run(() => api.setLeaveYearStart(organizationId, startMonth), 'Leave year saved.')}>Save leave year</Button>
              </div>
              <p className="text-xs text-muted-foreground">Days of annual holiday per person for the leave year starting {formatDay(`${leaveYear}-${String(startMonth).padStart(2, '0')}-01`)}. Leave empty for no allowance (then no balance is shown). {STATUTORY_HINT}</p>
              <ul className="divide-y divide-border">
                {activeEmployees.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-end justify-between gap-2 py-2">
                    <Label htmlFor={`al-${e.id}`} className="text-sm font-medium">{e.full_name}</Label>
                    <div className="flex items-end gap-2">
                      <input id={`al-${e.id}`} inputMode="decimal" className={`${FIELD} w-24`} placeholder="None" value={allowance[e.id] ?? ''} onChange={(ev) => setAllowance({ ...allowance, [e.id]: ev.target.value })} />
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => {
                        const raw = (allowance[e.id] ?? '').trim();
                        const days = raw === '' ? null : Number(raw);
                        if (days !== null && (!Number.isFinite(days) || days < 0 || days > 366 || Math.round(days * 10) !== days * 10)) { setMessage('Enter between 0 and 366 days, to one decimal place.'); return; }
                        void run(() => api.setAllowance(e.id, leaveYear, days), `Allowance saved for ${e.full_name}.`);
                      }}>Save</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${CARD} space-y-2`} aria-labelledby="link-title">
              <h2 id="link-title" className="text-card-title">Link team members to the rota</h2>
              <p className="text-xs text-muted-foreground">Staff can ask for holiday once their account is linked to their employee row. A suggestion appears only when exactly one employee has the member's email; nothing is linked until you choose Link.</p>
              {candidates.length === 0 ? <p className="text-sm text-muted-foreground">No members found.</p> : (
                <ul className="divide-y divide-border">
                  {candidates.map((c) => (
                    <li key={c.user_id} className="flex flex-wrap items-end justify-between gap-2 py-2" data-testid="link-row">
                      <div><p className="text-sm font-medium">{c.name ?? c.email ?? 'Member'}</p><p className="text-xs text-muted-foreground">{c.email}</p></div>
                      {c.linked_employee_id ? (
                        <div className="flex items-center gap-2 text-sm">Linked to {names.get(c.linked_employee_id) ?? 'an employee'}
                          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => api.linkEmployee(c.linked_employee_id!, null), 'Link removed.')}>Unlink</Button></div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <select aria-label={`Employee for ${c.name ?? c.email ?? 'member'}`} className={`${FIELD} w-48`} value={linkPick[c.user_id] ?? ''} onChange={(e) => setLinkPick({ ...linkPick, [c.user_id]: e.target.value })}>
                            <option value="">Choose an employee</option>
                            {activeEmployees.filter((e) => !e.user_id).map((e) => <option key={e.id} value={e.id}>{e.full_name}{c.suggested_employee_id === e.id ? ' (suggested: same email)' : ''}</option>)}
                          </select>
                          <Button type="button" size="sm" disabled={busy || !linkPick[c.user_id]} onClick={() => void run(() => api.linkEmployee(linkPick[c.user_id], c.user_id), 'Member linked.')}>Link</Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${CARD} space-y-2`} aria-labelledby="export-title">
              <h2 id="export-title" className="text-card-title">Export approved holiday</h2>
              <div className="flex flex-wrap items-end gap-2">
                <div><Label htmlFor="ex-from">From</Label><input id="ex-from" type="date" className={FIELD} value={exportRange.from} onChange={(e) => setExportRange({ ...exportRange, from: e.target.value })} /></div>
                <div><Label htmlFor="ex-to">To</Label><input id="ex-to" type="date" className={FIELD} value={exportRange.to} onChange={(e) => setExportRange({ ...exportRange, to: e.target.value })} /></div>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={async () => {
                  const { data, error } = await api.calendar(organizationId, exportRange.from, exportRange.to);
                  if (error) { setMessage(errorText(error)); return; }
                  download(`holiday-${exportRange.from}-to-${exportRange.to}.csv`, awayCsv(data ?? []));
                  setAnnounce('Export downloaded.');
                }}><Download className="mr-1 h-4 w-4" aria-hidden />Export CSV</Button>
              </div>
            </section>
          </>
        )}
        <p className="text-xs text-muted-foreground">{HOLIDAY_FAQ.answer}</p>
      </div>
    </RotaLayout>
  );
}
