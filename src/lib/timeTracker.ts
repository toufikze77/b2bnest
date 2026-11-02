// Phase 31: the Business Tools Time Tracker. Pure helpers (tested in timeTracker.test.ts). Entries live in
// public.project_time_entries (docs/phase31/proposal.sql); the server clock sets every timer timestamp, so elapsed
// time is always computed from the stored times and the clock, never from a counter in the browser.
import { tableToCsv, type Cell, type Column } from '@/lib/adminMetricsCore';

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  company_id: string | null;
  description: string | null;
  start_time: string;
  end_time: string | null;
  paused_seconds: number;
  paused_at: string | null;
  is_billable: boolean;
  hourly_rate_pence: number | null;
}

export interface ProjectOption { id: string; name: string; organization_id: string | null }

export type TimerState = 'running' | 'paused' | 'stopped';
export const timerState = (e: Pick<TimeEntry, 'end_time' | 'paused_at'>): TimerState =>
  e.end_time ? 'stopped' : e.paused_at ? 'paused' : 'running';

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Seconds worked: from start to end (or to now while running), less the stored pauses and, while paused, the pause so
 * far. Works the same after a refresh or on another device because it only uses the stored times and the clock.
 */
export function workedSeconds(e: Pick<TimeEntry, 'start_time' | 'end_time' | 'paused_seconds' | 'paused_at'>, nowMs: number): number {
  const end = e.end_time ? ms(e.end_time) : nowMs;
  const openPause = !e.end_time && e.paused_at ? Math.max(0, Math.floor((nowMs - ms(e.paused_at)) / 1000)) : 0;
  const total = Math.floor((end - ms(e.start_time)) / 1000) - (e.paused_seconds ?? 0) - openPause;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "1h 05m" (minutes rounded down). Never NaN. */
export function formatDuration(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
}
/** The live timer: "1:05:09". */
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
/** Hours as a number for spreadsheets: 1.08 for 1h 05m. */
export const decimalHours = (seconds: number) => Math.round((Math.max(0, seconds) / 3600) * 100) / 100;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2 Nov 2026" (local time). */
export function formatDate(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? '' : `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
/** "2 Nov 2026" for a "2026-11-02" day (no time zone shift). */
export function formatDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
/** "09:05" (24-hour, local time). */
export function formatTime(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(x.getTime()) ? '' : `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
/** "£1,234.56". */
export const formatPence = (pence: number) => GBP.format((Number.isFinite(pence) ? pence : 0) / 100);

/** Value of billable time: hours x rate, rounded to the penny. Null when there is no rate (never guessed). */
export function valuePence(seconds: number, ratePence: number | null | undefined): number | null {
  if (ratePence === null || ratePence === undefined || !Number.isFinite(ratePence)) return null;
  return Math.round((Math.max(0, seconds) * ratePence) / 3600);
}
export const entryValue = (e: TimeEntry, nowMs: number) => (e.is_billable ? valuePence(workedSeconds(e, nowMs), e.hourly_rate_pence) : null);

export const MAX_RATE_PENCE = 1_000_000; // £10,000 an hour (the database cap)
export const DESCRIPTION_MAX = 500;

/** "45" or "45.50" → 4550. Empty → null (no rate). Anything else → 'invalid'. */
export function parseRate(input: string): number | null | 'invalid' {
  const t = input.trim().replace(/^£/, '').replace(/,/g, '');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'invalid';
  const pence = Math.round(Number(t) * 100);
  return pence > MAX_RATE_PENCE ? 'invalid' : pence;
}
export const rateInput = (pence: number | null | undefined) => (pence === null || pence === undefined ? '' : (pence / 100).toFixed(2));

/** Ids of entries that overlap another of the same list (allowed, but flagged). A running entry counts up to now. */
export function overlappingIds(entries: Pick<TimeEntry, 'id' | 'start_time' | 'end_time'>[], nowMs: number): Set<string> {
  const spans = entries.map((e) => ({ id: e.id, a: ms(e.start_time), b: e.end_time ? ms(e.end_time) : nowMs })).sort((x, y) => x.a - y.a);
  const out = new Set<string>();
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length && spans[j].a < spans[i].b; j++) {
      if (spans[j].b > spans[i].a) { out.add(spans[i].id); out.add(spans[j].id); }
    }
  }
  return out;
}
export const OVERLAP_TEXT = 'Overlaps another entry';

/** The same rules the database enforces, checked before saving so the message is clear. */
export function manualEntryError(start: Date | null, end: Date | null, nowMs: number): string | null {
  if (!start || Number.isNaN(start.getTime())) return 'Enter a start date and time.';
  if (!end || Number.isNaN(end.getTime())) return 'Enter an end time or a duration.';
  if (end.getTime() <= start.getTime()) return 'The end must be after the start.';
  if (start.getTime() > nowMs || end.getTime() > nowMs) return "Entries can't be in the future.";
  if (end.getTime() - start.getTime() > 24 * 3600 * 1000) return "An entry can't be longer than 24 hours.";
  return null;
}
/** "1h 05m", "1:05", "65m", "1.5h" or "90" (minutes) → seconds; null when not understood. */
export function parseDuration(input: string): number | null {
  const t = input.trim().toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})h\s*(\d{1,2})m?$/.exec(t))) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(t))) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  if ((m = /^(\d+(?:\.\d+)?)h$/.exec(t))) return Math.round(Number(m[1]) * 3600);
  if ((m = /^(\d{1,4})m?$/.exec(t))) return Number(m[1]) * 60;
  return null;
}
/** A local date ("2026-11-02") and time ("09:30") → Date, or null. */
export function localDateTime(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date); const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const x = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return Number.isNaN(x.getTime()) ? null : x;
}
export const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Ranges (local time; weeks start on Monday).
export type RangeKind = 'today' | 'week' | 'month' | 'custom';
export interface Range { from: Date; to: Date }
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export function rangeFor(kind: Exclude<RangeKind, 'custom'>, now: Date): Range {
  const today = startOfDay(now);
  if (kind === 'today') return { from: today, to: addDays(today, 1) };
  if (kind === 'week') { const from = addDays(today, -((today.getDay() + 6) % 7)); return { from, to: addDays(from, 7) }; }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
}
export const MAX_RANGE_DAYS = 400;
/** A custom range from two dates, both days included. */
export function customRange(fromDay: string, toDay: string): Range | string {
  const a = localDateTime(fromDay, '00:00'); const b = localDateTime(toDay, '00:00');
  if (!a || !b) return 'Choose both dates.';
  if (b < a) return 'The end date must be on or after the start date.';
  const to = addDays(b, 1);
  if ((to.getTime() - a.getTime()) / 86400000 > MAX_RANGE_DAYS) return `Choose at most ${MAX_RANGE_DAYS} days.`;
  return { from: a, to };
}
export function rangeLabel(r: Range): string {
  const last = addDays(r.to, -1);
  return r.from.getTime() === last.getTime() ? formatDate(r.from) : `${formatDate(r.from)} to ${formatDate(last)}`;
}

// The summary from public.time_summary.
export interface SummaryGroup { seconds: number; billable_seconds: number; value_pence: number }
export interface TimeSummary {
  entries: number; total_seconds: number; billable_seconds: number; billable_value_pence: number; unrated_billable_seconds: number;
  by_project: (SummaryGroup & { project_id: string | null; project_name: string | null; entries: number })[];
  by_day: (SummaryGroup & { day: string })[];
}
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
export function parseSummary(data: unknown): TimeSummary {
  const d = (data ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v as Record<string, unknown>[] : []);
  const group = (g: Record<string, unknown>) => ({ seconds: num(g.seconds), billable_seconds: num(g.billable_seconds), value_pence: num(g.value_pence) });
  return {
    entries: num(d.entries), total_seconds: num(d.total_seconds), billable_seconds: num(d.billable_seconds),
    billable_value_pence: num(d.billable_value_pence), unrated_billable_seconds: num(d.unrated_billable_seconds),
    by_project: arr(d.by_project).map((g) => ({ ...group(g), project_id: (g.project_id as string | null) ?? null, project_name: (g.project_name as string | null) ?? null, entries: num(g.entries) })),
    by_day: arr(d.by_day).map((g) => ({ ...group(g), day: String(g.day ?? '') })),
  };
}
export const projectLabel = (id: string | null, name: string | null | undefined) => (id ? name || 'Project (no access)' : 'No project');

// CSV of the current range, through the Phase 36 export helper (escaping and formula neutralising live there).
export const CSV_COLUMNS: Column[] = [
  { key: 'date', label: 'Date' }, { key: 'start', label: 'Start' }, { key: 'end', label: 'End' },
  { key: 'duration', label: 'Duration' }, { key: 'hours', label: 'Hours', numeric: true },
  { key: 'project', label: 'Project' }, { key: 'description', label: 'Description' }, { key: 'billable', label: 'Billable' },
  { key: 'rate', label: 'Hourly rate (GBP)', numeric: true }, { key: 'value', label: 'Value (GBP)', numeric: true },
];
export function entriesCsv(entries: TimeEntry[], projects: Map<string, string>, nowMs: number): string {
  const rows: Record<string, Cell>[] = [...entries].sort((a, b) => ms(a.start_time) - ms(b.start_time)).map((e) => {
    const secs = workedSeconds(e, nowMs);
    const value = entryValue(e, nowMs);
    return {
      date: formatDate(e.start_time), start: formatTime(e.start_time), end: e.end_time ? formatTime(e.end_time) : '',
      duration: formatDuration(secs), hours: decimalHours(secs),
      project: e.project_id ? projects.get(e.project_id) ?? 'Project (no access)' : 'No project',
      description: e.description ?? '', billable: e.is_billable ? 'Yes' : 'No',
      rate: e.hourly_rate_pence === null ? null : e.hourly_rate_pence / 100, value: value === null ? null : value / 100,
    };
  });
  return tableToCsv(CSV_COLUMNS, rows);
}

/** Server error codes (docs/phase31/proposal.sql) in plain words. */
const MESSAGES: Record<string, string> = {
  TIMER_ALREADY_RUNNING: 'A timer is already running. Stop it before starting another.',
  pte_one_running_per_user: 'A timer is already running. Stop it before starting another.',
  NO_RUNNING_TIMER: 'There is no running timer.',
  TIMER_ALREADY_PAUSED: 'The timer is already paused.',
  TIMER_NOT_PAUSED: 'The timer is not paused.',
  TIME_IN_FUTURE: "Entries can't be in the future.",
  TIME_END_BEFORE_START: 'The end must be after the start.',
  pte_end_after_start: 'The end must be after the start.',
  pte_at_most_24_hours: "An entry can't be longer than 24 hours.",
  pte_paused_within: 'The pauses are longer than the entry. Edit the start and end times.',
  pte_project_or_description: 'Choose a project or describe the task.',
  TIME_PROJECT_OR_DESCRIPTION_REQUIRED: 'Choose a project or describe the task.',
  pte_description_length: `The description can be up to ${DESCRIPTION_MAX} characters.`,
  TIME_DESCRIPTION_TOO_LONG: `The description can be up to ${DESCRIPTION_MAX} characters.`,
  pte_rate_range: 'Enter an hourly rate between £0 and £10,000.',
  TIME_RATE_OUT_OF_RANGE: 'Enter an hourly rate between £0 and £10,000.',
  TIME_PROJECT_NOT_FOUND: "That project isn't available to you.",
  ORGANIZATION_MEMBERSHIP_REQUIRED: "You aren't a member of that company.",
  TIME_TRACKER_ACCESS_REQUIRED: 'Choose a plan to keep using the Time Tracker.',
  TIME_RUNNING_VIA_TIMER_ONLY: 'Stop the timer before editing its times.',
  MFA_REQUIRED: 'Enter your two-step code to continue.',
  TIME_RANGE_INVALID: 'Choose a range of at most 400 days.',
};
export const NOT_AVAILABLE = "The Time Tracker can't save time yet: it needs a database update (docs/phase31) that hasn't been applied. Nothing you enter here would be kept, so it is switched off until then.";
export const SAVE_ERROR = "Couldn't save. Please try again.";

export const isMissingFeature = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST204' || e.code === '42703'
    || /could not find the (function|.*column)|does not exist/i.test(e.message ?? ''));

export function errorText(e: { message?: string; details?: string } | null | undefined): string {
  const text = `${e?.message ?? ''} ${e?.details ?? ''}`;
  for (const [code, msg] of Object.entries(MESSAGES)) if (text.includes(code)) return msg;
  return SAVE_ERROR;
}

export const OLD_TRACKER_NOTE = 'Entries are now saved to your account. The earlier version of this tracker kept entries only in the open browser tab and never saved them, so there is nothing to bring across.';

/** What the Time Tracker does, for Help and the Business Tools guide (one list, so they can't disagree). */
export const TIME_TRACKER_FACTS: string[] = [
  'Saved to your account: entries and a running timer survive a refresh, closing the page and signing in on another device.',
  'One timer runs at a time: start, pause, resume and stop. Stopping under a minute asks before saving.',
  'Each entry needs one of your projects or a description (or both).',
  'Add past work by date, start and end time (or a duration); edit or delete any entry. Overlapping entries are allowed and marked. Entries cannot be in the future or longer than 24 hours.',
  'Mark entries billable or not, with an optional hourly rate in pounds, and set a default rate. A value is shown only for billable time that has a rate.',
  'Today, this week, this month or a custom range: total hours, billable hours and value, hours per day and totals by project, with a CSV export of the range.',
  "It doesn't create invoices from entries, and there is no team timesheet screen yet.",
];
export const TIME_TRACKER_FAQ = {
  question: 'Is my time saved in the Time Tracker?',
  answer: 'Yes. Business Tools → Time Tracker saves your entries and the running timer to your account, so they survive a refresh, closing the page and another device, and one timer runs at a time. A value is shown only for billable time with an hourly rate. You can export the chosen range as CSV.',
};
