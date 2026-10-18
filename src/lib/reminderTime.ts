// Note reminders are stored as UTC instants (timestamptz) and shown in the viewer's local time.
// <input type="datetime-local"> works in wall-clock time ("2026-10-25T01:30"), so these helpers convert both ways
// for a given IANA time zone (default: the browser's), including the hours that clocks skip or repeat.

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const pad = (n: number) => String(n).padStart(2, '0');

function wallClock(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Offset of the zone from UTC at that instant, in ms (Europe/London: 0 in winter, +1h in summer). */
function zoneOffset(ms: number, timeZone: string) {
  const w = wallClock(ms, timeZone);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** UTC ISO string -> "yyyy-MM-ddTHH:mm" in the zone, for a datetime-local input. Empty for no or bad value. */
export function toLocalInputValue(iso: string | null | undefined, timeZone: string = browserZone()): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const w = wallClock(ms, timeZone);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
}

/**
 * "yyyy-MM-ddTHH:mm" wall-clock time in the zone -> UTC ISO string (null for empty or bad input).
 * A repeated time (clocks go back) resolves to the first occurrence, so the reminder never fires late.
 * A skipped time (clocks go forward) moves forward by the gap (01:30 on the spring change in London -> 02:30 BST).
 */
export function fromLocalInputValue(value: string | null | undefined, timeZone: string = browserZone()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value ?? '');
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const hour = 3_600_000;
  const before = asUtc - zoneOffset(asUtc - 12 * hour, timeZone);
  const after = asUtc - zoneOffset(asUtc + 12 * hour, timeZone);
  const matches = (ms: number) => { const w = wallClock(ms, timeZone); return w.y === y && w.mo === mo && w.d === d && w.h === h && w.mi === mi; };
  const valid = [before, after].filter(matches);
  const chosen = valid.length ? Math.min(...valid) : before;
  return new Date(chosen).toISOString();
}

/** "Sun 25 Oct 2026, 01:30 GMT" in the zone (built from parts, so it does not depend on the runtime's punctuation). */
export function formatReminder(iso: string, timeZone: string = browserZone()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} ${get('timeZoneName')}`;
}

export type ReminderState = 'none' | 'due' | 'upcoming';

/** Due once the time has passed: the 15-minute check will have put it in the bell, or will on its next run. */
export function reminderState(iso: string | null | undefined, now: Date = new Date()): ReminderState {
  if (!iso) return 'none';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'none';
  return ms <= now.getTime() ? 'due' : 'upcoming';
}
