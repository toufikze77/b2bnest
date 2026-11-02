import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Download, Pause, Pencil, Play, Plus, RefreshCw, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChartCard, ColumnChart, StatTile } from '@/components/charts';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrganization } from '@/contexts/OrganizationContext';
import {
  customRange, dateInput, DESCRIPTION_MAX, entriesCsv, entryValue, errorText, formatClock, formatDate, formatDay, formatDuration, formatPence,
  formatTime, isMissingFeature, localDateTime, manualEntryError, NOT_AVAILABLE, OLD_TRACKER_NOTE, OVERLAP_TEXT, overlappingIds, parseDuration,
  parseRate, parseSummary, projectLabel, rangeFor, rateInput, rangeLabel, timeInput, timerState, workedSeconds,
  type ProjectOption, type Range, type RangeKind, type TimeEntry, type TimeSummary,
} from '@/lib/timeTracker';
import * as api from '@/lib/timeTrackerApi';

const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const RANGES: { kind: RangeKind; label: string }[] = [
  { kind: 'today', label: 'Today' }, { kind: 'week', label: 'This week' }, { kind: 'month', label: 'This month' }, { kind: 'custom', label: 'Custom range' },
];

/** Ticks every second while `on` (only to redraw the clock; elapsed time always comes from the stored times). */
function useNow(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

interface EditorState {
  id: string | null; date: string; start: string; mode: 'end' | 'duration'; end: string; duration: string;
  projectId: string; description: string; billable: boolean; rate: string; timesChanged: boolean;
}

/**
 * Phase 31: the Business Tools Time Tracker, saved to the account (public.project_time_entries). A running timer
 * survives a refresh, a closed tab and another device; only one runs at a time (the database enforces it).
 */
export default function TimeTracker() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { organizationId } = useActiveOrganization();
  const [available, setAvailable] = useState<'checking' | 'yes' | 'no'>('checking');
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [defaults, setDefaults] = useState<{ rate: number | null; billable: boolean }>({ rate: null, billable: true });
  const [form, setForm] = useState({ projectId: '', description: '', billable: true, rate: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [shortStop, setShortStop] = useState<number | null>(null);
  const [over24, setOver24] = useState<{ start: string; date: string; time: string } | null>(null);
  const [rangeKind, setRangeKind] = useState<RangeKind>('week');
  const [custom, setCustom] = useState(() => ({ from: dateInput(new Date()), to: dateInput(new Date()) }));
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ rate: '', billable: true });
  const now = useNow(!!running && timerState(running) === 'running');

  const range: Range | string = useMemo(
    () => (rangeKind === 'custom' ? customRange(custom.from, custom.to) : rangeFor(rangeKind, new Date())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeKind, custom.from, custom.to, reloadKey],
  );
  const projectNames = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // The running timer, projects and defaults.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    (async () => {
      const [r, p, s] = await Promise.all([api.loadRunning(userId), api.loadProjects(), api.loadSettings(userId)]);
      if (!live) return;
      if (isMissingFeature(r.error) || isMissingFeature(s.error)) { setAvailable('no'); return; }
      setAvailable('yes');
      if (r.error) setMessage(errorText(r.error)); else setRunning(r.data ?? null);
      setProjects(p.data ?? []);
      const d = { rate: s.data?.default_rate_pence ?? null, billable: s.data?.default_billable ?? true };
      setDefaults(d);
      setForm((f) => ({ ...f, billable: d.billable, rate: rateInput(d.rate) }));
      setSettingsForm({ rate: rateInput(d.rate), billable: d.billable });
    })();
    return () => { live = false; };
  }, [userId, reloadKey]);

  // The entries and totals for the chosen range.
  useEffect(() => {
    if (!userId || available !== 'yes' || typeof range === 'string') return;
    let live = true;
    setListState('loading');
    Promise.all([api.loadEntries(userId, range), api.timeSummary(range)]).then(([e, s]) => {
      if (!live) return;
      if (e.error || s.error) { setListState('error'); return; }
      setEntries(e.data ?? []);
      setSummary(parseSummary(s.data));
      setListState('ready');
    }).catch(() => { if (live) setListState('error'); });
    return () => { live = false; };
  }, [userId, available, range]);

  /** Runs one write; shows the server's reason in plain words when it is refused. */
  const run = async (fn: () => PromiseLike<{ data: unknown; error: api.DbError }>, said?: string): Promise<{ ok: boolean; data: unknown }> => {
    setBusy(true); setMessage(null);
    try {
      const { data, error } = await fn();
      if (error) { setMessage(errorText(error)); return { ok: false, data: null }; }
      if (said) setAnnounce(said);
      return { ok: true, data };
    } catch {
      setMessage(errorText(null));
      return { ok: false, data: null };
    } finally {
      setBusy(false);
    }
  };

  const start = async (e: FormEvent) => {
    e.preventDefault();
    const rate = parseRate(form.rate);
    if (rate === 'invalid') { setMessage('Enter an hourly rate between £0 and £10,000, for example 45 or 45.50.'); return; }
    if (!form.projectId && !form.description.trim()) { setMessage('Choose a project or describe the task.'); return; }
    const data = await run(() => api.timeStart({
      projectId: form.projectId || null, description: form.description.trim(), billable: form.billable, ratePence: rate, companyId: organizationId ?? null,
    }), 'Timer started');
    if (data.ok) { setRunning(data.data as TimeEntry); setForm((f) => ({ ...f, description: '' })); }
  };
  const pause = async () => { const r = await run(api.timePause, 'Timer paused'); if (r.ok) setRunning(r.data as TimeEntry); };
  const resume = async () => { const r = await run(api.timeResume, 'Timer resumed'); if (r.ok) setRunning(r.data as TimeEntry); };
  const stop = async (confirmShort = false, endedAt: string | null = null) => {
    const r = await run(() => api.timeStop(confirmShort, endedAt));
    const d = r.data as { success?: boolean; needs_confirmation?: boolean; worked_seconds?: number; error?: string; start_time?: string; entry?: TimeEntry } | null;
    if (!r.ok || !d) return;
    if (d.needs_confirmation) { setShortStop(d.worked_seconds ?? 0); return; }
    if (d.error === 'over_24_hours' && d.start_time) {
      const s = new Date(d.start_time);
      setOver24({ start: d.start_time, date: dateInput(s), time: timeInput(new Date(s.getTime() + 8 * 3600 * 1000)) });
      return;
    }
    if (d.success && d.entry) {
      setRunning(null); setShortStop(null); setOver24(null);
      setAnnounce(`Timer stopped. ${formatDuration(workedSeconds(d.entry, Date.now()))} saved.`);
      refresh();
    }
  };
  const discard = async () => {
    if (!running) return;
    const r = await run(() => api.deleteEntry(running.id), 'Timer discarded. Nothing was saved.');
    if (r.ok) { setRunning(null); setShortStop(null); refresh(); }
  };
  const stopAt = async () => {
    if (!over24) return;
    const end = localDateTime(over24.date, over24.time);
    const err = manualEntryError(new Date(over24.start), end, Date.now());
    if (err) { setMessage(err); return; }
    await stop(true, end!.toISOString());
  };

  // Manual entries and edits.
  const openEditor = (e?: TimeEntry) => {
    setEditorError(null);
    if (e) {
      const s = new Date(e.start_time); const en = new Date(e.end_time!);
      setEditor({ id: e.id, date: dateInput(s), start: timeInput(s), mode: 'end', end: timeInput(en), duration: formatDuration(workedSeconds(e, Date.now())),
        projectId: e.project_id ?? '', description: e.description ?? '', billable: e.is_billable, rate: rateInput(e.hourly_rate_pence), timesChanged: false });
    } else {
      const s = new Date(Date.now() - 3600 * 1000);
      setEditor({ id: null, date: dateInput(s), start: timeInput(s), mode: 'end', end: timeInput(new Date()), duration: '1h 00m',
        projectId: '', description: '', billable: defaults.billable, rate: rateInput(defaults.rate), timesChanged: true });
    }
  };
  const saveEditor = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!editor || !user) return;
    const start = localDateTime(editor.date, editor.start);
    let end: Date | null = null;
    if (editor.mode === 'end') {
      end = localDateTime(editor.date, editor.end);
      if (start && end && end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // ends after midnight
    } else {
      const secs = parseDuration(editor.duration);
      if (secs === null) { setEditorError('Enter a duration such as 1h 05m, 1:05 or 65m.'); return; }
      end = start ? new Date(start.getTime() + secs * 1000) : null;
    }
    const err = manualEntryError(start, end, Date.now());
    if (err) { setEditorError(err); return; }
    if (!editor.projectId && !editor.description.trim()) { setEditorError('Choose a project or describe the task.'); return; }
    const rate = parseRate(editor.rate);
    if (rate === 'invalid') { setEditorError('Enter an hourly rate between £0 and £10,000, for example 45 or 45.50.'); return; }
    const fields: api.EntryFields = {
      project_id: editor.projectId || null, description: editor.description.trim() || null, start_time: start!.toISOString(), end_time: end!.toISOString(),
      is_billable: editor.billable, hourly_rate_pence: rate,
    };
    // Changing the times replaces the recorded pauses: the entry is then exactly start to end.
    const { error } = editor.id
      ? await api.updateEntry(editor.id, editor.timesChanged ? { ...fields, paused_seconds: 0 } : { ...fields, start_time: undefined, end_time: undefined })
      : await api.createEntry(user.id, organizationId ?? null, fields);
    if (error) { setEditorError(errorText(error)); return; }
    setAnnounce(editor.id ? 'Entry updated' : 'Entry added');
    setEditor(null);
    refresh();
  };
  const remove = async (id: string) => {
    const r = await run(() => api.deleteEntry(id), 'Entry deleted');
    setConfirmDelete(null);
    if (r.ok) refresh();
  };
  const saveSettings = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    const rate = parseRate(settingsForm.rate);
    if (rate === 'invalid') { setMessage('Enter a default rate between £0 and £10,000.'); return; }
    const r = await run(() => api.saveSettings(user.id, rate, settingsForm.billable), 'Defaults saved');
    if (r.ok) { setDefaults({ rate, billable: settingsForm.billable }); setForm((f) => ({ ...f, rate: rateInput(rate), billable: settingsForm.billable })); setSettingsOpen(false); }
  };
  const exportCsv = () => {
    if (typeof range === 'string') return;
    const blob = new Blob([entriesCsv(entries, projectNames, Date.now())], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `time-${dateInput(range.from)}-to-${dateInput(new Date(range.to.getTime() - 1))}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const overlaps = useMemo(() => overlappingIds(running ? [...entries, running] : entries, Date.now()), [entries, running]);

  if (available === 'checking') return <p className="p-6 text-sm text-muted-foreground" role="status">Loading your time…</p>;
  if (available === 'no') {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div role="alert" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm text-foreground" data-testid="time-not-available">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />{NOT_AVAILABLE}
        </div>
      </div>
    );
  }

  const state = running ? timerState(running) : 'stopped';
  const elapsed = running ? workedSeconds(running, now) : 0;
  const runningLabel = running ? [running.project_id ? projectLabel(running.project_id, projectNames.get(running.project_id)) : null, running.description].filter(Boolean).join(' · ') : '';
  const unrated = summary?.unrated_billable_seconds ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <p aria-live="polite" className="sr-only" data-testid="timer-announce">{announce}</p>
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Clock className="h-6 w-6 text-primary" aria-hidden />Time Tracker</h2>
        <p className="text-sm text-muted-foreground">{OLD_TRACKER_NOTE}</p>
      </header>

      {message && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />{message}
        </div>
      )}

      {/* Timer */}
      <section aria-labelledby="timer-title" className="rounded-card border border-border bg-card p-4 sm:p-5">
        <h3 id="timer-title" className="mb-3 text-card-title text-foreground">Timer</h3>
        {running ? (
          <div className="space-y-4" data-testid="timer-running">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{runningLabel}</p>
                <p className="font-mono text-4xl font-bold tabular-nums text-foreground" data-testid="timer-clock" aria-label={`Elapsed ${formatDuration(elapsed)}`}>{formatClock(elapsed)}</p>
                <p className="text-xs text-muted-foreground">
                  Started {formatDate(running.start_time)} at {formatTime(running.start_time)}{state === 'paused' ? ' · Paused' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {state === 'paused'
                  ? <Button type="button" onClick={() => void resume()} disabled={busy}><Play className="mr-1 h-4 w-4" aria-hidden />Resume</Button>
                  : <Button type="button" variant="outline" onClick={() => void pause()} disabled={busy}><Pause className="mr-1 h-4 w-4" aria-hidden />Pause</Button>}
                <Button type="button" variant="destructive" onClick={() => void stop()} disabled={busy}><Square className="mr-1 h-4 w-4" aria-hidden />Stop</Button>
              </div>
            </div>
            {shortStop !== null && (
              <div role="alertdialog" aria-labelledby="short-title" className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="short-stop">
                <p id="short-title">This entry is under a minute ({shortStop} seconds). Save it anyway?</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void stop(true)}>Save anyway</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void discard()}>Discard</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShortStop(null)}>Keep timing</Button>
                </div>
              </div>
            )}
            {over24 && (
              <div role="alertdialog" aria-labelledby="over-title" className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm" data-testid="over-24">
                <p id="over-title">This timer has been running for more than 24 hours, and an entry can be at most 24 hours. When did you stop?</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div><Label htmlFor="over-date">Date</Label><input id="over-date" type="date" className={FIELD} value={over24.date} onChange={(e) => setOver24({ ...over24, date: e.target.value })} /></div>
                  <div><Label htmlFor="over-time">Time (24-hour)</Label><input id="over-time" type="time" className={FIELD} value={over24.time} onChange={(e) => setOver24({ ...over24, time: e.target.value })} /></div>
                  <Button type="button" size="sm" onClick={() => void stopAt()}>Stop at this time</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void start(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_auto_auto_auto]" aria-label="Start a timer">
            <div><Label htmlFor="tt-project">Project</Label>
              <select id="tt-project" className={FIELD} value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><Label htmlFor="tt-description">What are you working on?</Label>
              <Input id="tt-description" value={form.description} maxLength={DESCRIPTION_MAX} placeholder="Describe the task" onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div><Label htmlFor="tt-rate">Rate (£ an hour)</Label>
              <Input id="tt-rate" inputMode="decimal" className="w-28" value={form.rate} placeholder="None" onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />Billable</label>
            <Button type="submit" className="self-end" disabled={busy}><Play className="mr-1 h-4 w-4" aria-hidden />Start</Button>
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">Choose a project, describe the task, or both. One timer runs at a time; it keeps running if you close the page.</p>
          </form>
        )}
      </section>

      {/* Range */}
      <section aria-labelledby="range-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="range-title" className="text-card-title text-foreground">{typeof range === 'string' ? 'Your time' : rangeLabel(range)}</h3>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => openEditor()}><Plus className="mr-1 h-4 w-4" aria-hidden />Add entry</Button>
            <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0 || listState !== 'ready'}><Download className="mr-1 h-4 w-4" aria-hidden />Export CSV</Button>
            <Button type="button" variant="ghost" size="sm" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((o) => !o)}>Defaults</Button>
          </div>
        </div>
        <div role="group" aria-label="Date range" className="flex flex-wrap items-end gap-2">
          {RANGES.map((r) => (
            <Button key={r.kind} type="button" size="sm" variant={rangeKind === r.kind ? 'default' : 'outline'} aria-pressed={rangeKind === r.kind} onClick={() => setRangeKind(r.kind)}>{r.label}</Button>
          ))}
          {rangeKind === 'custom' && (
            <>
              <div><Label htmlFor="range-from">From</Label><input id="range-from" type="date" className={FIELD} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></div>
              <div><Label htmlFor="range-to">To</Label><input id="range-to" type="date" className={FIELD} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
            </>
          )}
        </div>
        {typeof range === 'string' && <p role="alert" className="text-sm text-destructive">{range}</p>}

        {settingsOpen && (
          <form onSubmit={(e) => void saveSettings(e)} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3" aria-label="Defaults">
            <div><Label htmlFor="set-rate">Default rate (£ an hour)</Label><Input id="set-rate" inputMode="decimal" className="w-32" value={settingsForm.rate} placeholder="None" onChange={(e) => setSettingsForm({ ...settingsForm, rate: e.target.value })} /></div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={settingsForm.billable} onChange={(e) => setSettingsForm({ ...settingsForm, billable: e.target.checked })} />New entries are billable</label>
            <Button type="submit" size="sm" disabled={busy}>Save defaults</Button>
          </form>
        )}

        {editor && (
          <form onSubmit={(e) => void saveEditor(e)} className="grid gap-3 rounded-card border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={editor.id ? 'Edit entry' : 'Add entry'} data-testid="entry-editor">
            <h4 className="font-semibold sm:col-span-2 lg:col-span-4">{editor.id ? 'Edit entry' : 'Add entry'}</h4>
            <div><Label htmlFor="ed-date">Date</Label><input id="ed-date" type="date" className={FIELD} value={editor.date} onChange={(e) => setEditor({ ...editor, date: e.target.value, timesChanged: true })} /></div>
            <div><Label htmlFor="ed-start">Start (24-hour)</Label><input id="ed-start" type="time" className={FIELD} value={editor.start} onChange={(e) => setEditor({ ...editor, start: e.target.value, timesChanged: true })} /></div>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Finish</legend>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="ed-mode" checked={editor.mode === 'end'} onChange={() => setEditor({ ...editor, mode: 'end', timesChanged: true })} />End time</label>
                <label className="flex items-center gap-1 text-sm"><input type="radio" name="ed-mode" checked={editor.mode === 'duration'} onChange={() => setEditor({ ...editor, mode: 'duration', timesChanged: true })} />Duration</label>
                {editor.mode === 'end'
                  ? <input aria-label="End (24-hour)" type="time" className={`${FIELD} w-32`} value={editor.end} onChange={(e) => setEditor({ ...editor, end: e.target.value, timesChanged: true })} />
                  : <Input aria-label="Duration" className="w-32" value={editor.duration} placeholder="1h 05m" onChange={(e) => setEditor({ ...editor, duration: e.target.value, timesChanged: true })} />}
              </div>
            </fieldset>
            <div><Label htmlFor="ed-project">Project</Label>
              <select id="ed-project" className={FIELD} value={editor.projectId} onChange={(e) => setEditor({ ...editor, projectId: e.target.value })}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="ed-description">Description</Label><Input id="ed-description" maxLength={DESCRIPTION_MAX} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></div>
            <div><Label htmlFor="ed-rate">Rate (£ an hour)</Label><Input id="ed-rate" inputMode="decimal" value={editor.rate} placeholder="None" onChange={(e) => setEditor({ ...editor, rate: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={editor.billable} onChange={(e) => setEditor({ ...editor, billable: e.target.checked })} />Billable</label>
            {editorError && <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">{editorError}</p>}
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">Save entry</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditor(null)}>Cancel</Button>
            </div>
          </form>
        )}

        {listState === 'error' ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Couldn't load your time.<Button type="button" size="sm" variant="outline" onClick={refresh}><RefreshCw className="mr-1 h-4 w-4" aria-hidden />Try again</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Hours" value={summary ? formatDuration(summary.total_seconds) : null} loading={listState === 'loading'} hint={summary ? `${summary.entries} ${summary.entries === 1 ? 'entry' : 'entries'}` : undefined} />
              <StatTile label="Billable hours" value={summary ? formatDuration(summary.billable_seconds) : null} loading={listState === 'loading'} />
              <StatTile label="Billable value" value={summary ? formatPence(summary.billable_value_pence) : null} loading={listState === 'loading'}
                hint={unrated > 0 ? `${formatDuration(unrated)} billable with no rate, not valued` : 'Billable hours x your rate'} />
            </div>

            <ChartCard
              title="Hours per day" subtitle="Finished entries; a running timer is added when you stop it."
              state={listState === 'loading' ? 'loading' : !summary || summary.total_seconds === 0 ? 'empty' : 'ready'}
              empty={{ message: 'No time recorded in this range yet.' }}
              summary={summary ? `Hours per day: ${formatDuration(summary.total_seconds)} in total over ${summary.by_day.length} days.` : 'Hours per day.'}
              table={summary ? { caption: 'Hours per day', columns: ['Day', 'Hours', 'Billable hours', 'Billable value'],
                rows: summary.by_day.map((d) => [formatDay(d.day), formatDuration(d.seconds), formatDuration(d.billable_seconds), formatPence(d.value_pence)]) } : undefined}
            >
              <ColumnChart data={(summary?.by_day ?? []).map((d) => ({ label: formatDay(d.day).replace(/ \d{4}$/, ''), value: Math.round((d.seconds / 3600) * 100) / 100 }))}
                seriesLabel="Hours" format={(h) => formatDuration(h * 3600)} axisTitle="Hours" />
            </ChartCard>

            {summary && summary.by_project.length > 0 && (
              <div className="overflow-x-auto rounded-card border border-border bg-card p-4">
                <table className="w-full text-sm">
                  <caption className="mb-2 text-left font-semibold text-foreground">By project</caption>
                  <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-2">Project</th><th scope="col" className="py-2 pr-2 text-right">Hours</th>
                    <th scope="col" className="py-2 pr-2 text-right">Billable</th><th scope="col" className="py-2 text-right">Value</th></tr></thead>
                  <tbody>
                    {summary.by_project.map((p) => (
                      <tr key={p.project_id ?? 'none'} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-2">{projectLabel(p.project_id, p.project_name)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatDuration(p.seconds)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{formatDuration(p.billable_seconds)}</td>
                        <td className="py-2 text-right tabular-nums">{formatPence(p.value_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <section aria-labelledby="entries-title" className="rounded-card border border-border bg-card p-4">
              <h4 id="entries-title" className="mb-2 font-semibold text-foreground">Entries</h4>
              {listState === 'ready' && entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground" data-testid="entries-empty">No entries in this range. Start the timer or add an entry.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {entries.map((e) => {
                    const secs = workedSeconds(e, now);
                    const value = entryValue(e, now);
                    const label = [e.project_id ? projectLabel(e.project_id, projectNames.get(e.project_id)) : 'No project', e.description].filter(Boolean).join(' · ');
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="entry-row">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(e.start_time)} · {formatTime(e.start_time)} to {e.end_time ? formatTime(e.end_time) : ''}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant={e.is_billable ? 'default' : 'secondary'}>{e.is_billable ? 'Billable' : 'Not billable'}</Badge>
                            {overlaps.has(e.id) && <Badge variant="outline" className="border-warning text-foreground">{OVERLAP_TEXT}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{formatDuration(secs)}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">{!e.is_billable ? '' : value === null ? 'No rate' : formatPence(value)}</p>
                          </div>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Edit entry: ${label}`} onClick={() => openEditor(e)}><Pencil className="h-4 w-4" aria-hidden /></Button>
                          {confirmDelete === e.id ? (
                            <span className="flex gap-1">
                              <Button type="button" size="sm" variant="destructive" onClick={() => void remove(e.id)}>Delete</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                            </span>
                          ) : (
                            <Button type="button" size="icon" variant="ghost" aria-label={`Delete entry: ${label}`} onClick={() => setConfirmDelete(e.id)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
