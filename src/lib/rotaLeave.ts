// Phase 32: Rota holiday requests. Pure helpers (tested in rotaLeave.test.ts). The database (docs/phase32/proposal.sql)
// decides who may ask, decide and see what; these helpers only count days, check a request before it is sent and word
// things for the page. Working days are Monday to Friday (the rota stores no working pattern) and bank holidays are
// not subtracted: there is no bank-holiday data in B2BNEST.
import { tableToCsv, type Cell, type Column } from '@/lib/adminMetricsCore';

export type Half = 'full' | 'am' | 'pm';
export type LeaveKind = 'annual' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface LeaveRequest {
  id: string; company_id: string; employee_id: string; requester_user_id: string | null;
  start_date: string; end_date: string; start_half: Half; end_half: Half; kind: LeaveKind; note: string | null;
  status: LeaveStatus; change_requested: boolean; decided_by: string | null; decided_at: string | null; decision_note: string | null;
  cancelled_at: string | null; created_at: string;
}
/** What leave_calendar returns: approved holiday, name and dates only. */
export interface AwayEntry { request_id: string; employee_id: string; full_name: string; start_date: string; end_date: string; start_half: Half; end_half: Half }
export interface LeaveBalance {
  leave_year: number; start_month: number; year_start: string; year_end: string;
  allowance_days: number | null; used_days: number; pending_days: number; remaining_days: number | null;
}

export const KIND_LABEL: Record<LeaveKind, string> = { annual: 'Annual holiday', unpaid: 'Unpaid leave', other: 'Other' };
export const MAX_DAYS = 60;
export const NOTE_MAX = 500;

// Dates are "YYYY-MM-DD" day strings throughout (no time zones).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (day: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] as const : null; };
const toUtc = (day: string) => { const p = parts(day); return p ? Date.UTC(p[0], p[1] - 1, p[2]) : Number.NaN; };
const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => fromUtc(toUtc(day) + n * 86400000);
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86400000);
export const isWeekday = (day: string) => { const d = new Date(toUtc(day)).getUTCDay(); return d >= 1 && d <= 5; };
/** "2 Nov 2026". */
export function formatDay(day: string): string { const p = parts(day); return p ? `${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}` : ''; }
/** Today in the browser's local time, as a day string. */
export const today = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** "2 Nov 2026 (afternoon) to 6 Nov 2026 (morning)", "2 Nov 2026 (morning)" or "2 Nov 2026". */
export function rangeText(r: Pick<LeaveRequest, 'start_date' | 'end_date' | 'start_half' | 'end_half'>): string {
  const h = (x: Half) => (x === 'am' ? ' (morning)' : x === 'pm' ? ' (afternoon)' : '');
  if (r.start_date === r.end_date) return `${formatDay(r.start_date)}${h(r.start_half)}`;
  return `${formatDay(r.start_date)}${h(r.start_half)} to ${formatDay(r.end_date)}${h(r.end_half)}`;
}

/**
 * Calendar days and working days (Monday to Friday) asked for, with half days. The same rule as the database's
 * _leave_working_days, optionally only inside [from, to).
 */
export function countDays(r: Pick<LeaveRequest, 'start_date' | 'end_date' | 'start_half' | 'end_half'>, from?: string, to?: string) {
  const calendar = Math.max(0, daysBetween(r.start_date, r.end_date) + 1);
  let working = 0;
  for (let i = 0; i < calendar; i++) {
    const d = addDays(r.start_date, i);
    if ((from && d < from) || (to && d >= to) || !isWeekday(d)) continue;
    if (r.start_date === r.end_date) working += r.start_half === 'full' ? 1 : 0.5;
    else if (d === r.start_date && r.start_half !== 'full') working += 0.5;
    else if (d === r.end_date && r.end_half !== 'full') working += 0.5;
    else working += 1;
  }
  return { calendar, working };
}
const n1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
export const daysText = (x: number) => `${n1(x)} ${x === 1 ? 'day' : 'days'}`;
export const WORKING_DAYS_NOTE = 'Working days are counted Monday to Friday, because the rota has no working pattern for each person. Bank holidays are not subtracted yet.';

/** The same limits the database enforces, checked first so the message is clear. */
export function requestError(r: Pick<LeaveRequest, 'start_date' | 'end_date' | 'start_half' | 'end_half'>, todayDay: string, isManager: boolean): string | null {
  if (!parts(r.start_date)) return 'Choose a start date.';
  if (!parts(r.end_date)) return 'Choose an end date.';
  if (r.end_date < r.start_date) return 'The end date must be on or after the start date.';
  if (daysBetween(r.start_date, r.end_date) + 1 > MAX_DAYS) return `A request can be at most ${MAX_DAYS} days. Split longer leave into two requests.`;
  if (!isManager && r.start_date < todayDay) return "Holiday can't start in the past. Ask a manager to record past absence.";
  if (r.start_date === r.end_date && r.start_half !== r.end_half) return 'For one day, choose a full day, the morning or the afternoon.';
  if (r.start_date !== r.end_date && (r.start_half === 'am' || r.end_half === 'pm')) return 'Over several days, the first day can be full or the afternoon, and the last day full or the morning.';
  return null;
}

/** How many other people have approved holiday on any of these days (allowed, but shown). */
export function othersOff(r: Pick<LeaveRequest, 'employee_id' | 'start_date' | 'end_date'>, away: AwayEntry[]): number {
  return new Set(away.filter((a) => a.employee_id !== r.employee_id && a.start_date <= r.end_date && a.end_date >= r.start_date).map((a) => a.employee_id)).size;
}
export const othersOffText = (n: number) => (n === 0 ? null : `${n} ${n === 1 ? 'other is' : 'others are'} off these days`);

/** The holiday on a person's day, as a text label (never colour alone), or null. */
export function holidayOn(employeeId: string, day: string, away: AwayEntry[]): string | null {
  const a = away.find((x) => x.employee_id === employeeId && x.start_date <= day && x.end_date >= day);
  if (!a) return null;
  const half = a.start_date === a.end_date ? a.start_half : day === a.start_date && a.start_half === 'pm' ? 'pm' : day === a.end_date && a.end_half === 'am' ? 'am' : 'full';
  return half === 'am' ? 'Holiday (morning)' : half === 'pm' ? 'Holiday (afternoon)' : 'Holiday';
}
export const shiftOnHolidayWarning = (name: string, label: string) =>
  `${name} has approved ${label.toLowerCase()} on this day. You can still plan the shift if you need to.`;

/** The status line staff see for their own request. */
export function statusLine(r: Pick<LeaveRequest, 'status' | 'change_requested' | 'decision_note'>): string {
  const why = r.decision_note ? `: ${r.decision_note}` : '';
  switch (r.status) {
    case 'pending': return 'Waiting for a manager';
    case 'approved': return 'Approved';
    case 'declined': return r.change_requested ? `Change requested${why}` : `Declined${why}`;
    default: return 'Cancelled';
  }
}

/** Balance lines; null allowance = no balance at all (never invented). */
export function balanceLines(b: LeaveBalance | null): { title: string; lines: string[] } {
  if (!b) return { title: 'Balance', lines: [] };
  const year = `Leave year ${formatDay(b.year_start)} to ${formatDay(b.year_end)}`;
  if (b.allowance_days === null) {
    return { title: year, lines: ['No allowance set, so no balance is shown.', `Annual holiday booked: ${daysText(b.used_days)} approved, ${daysText(b.pending_days)} waiting.`] };
  }
  return { title: year, lines: [`Allowance: ${daysText(b.allowance_days)}`, `Used: ${daysText(b.used_days)}`, `Waiting for approval: ${daysText(b.pending_days)}`,
    `Remaining if those are approved: ${daysText(b.remaining_days ?? 0)}`] };
}
export const STATUTORY_HINT = 'For reference only (not checked): most workers in the UK are entitled to at least 5.6 weeks of paid holiday a year, which is 28 days for someone who works five days a week.';

/** Approved holiday for a range, for managers (the Phase 36 export helper escapes and neutralises formulas). */
export const CSV_COLUMNS: Column[] = [
  { key: 'name', label: 'Name' }, { key: 'start', label: 'Start' }, { key: 'start_half', label: 'Start half' },
  { key: 'end', label: 'End' }, { key: 'end_half', label: 'End half' }, { key: 'working', label: 'Working days (Mon to Fri)', numeric: true },
];
const halfLabel = (h: Half) => (h === 'am' ? 'Morning' : h === 'pm' ? 'Afternoon' : 'Full day');
export function awayCsv(away: AwayEntry[]): string {
  const rows: Record<string, Cell>[] = [...away].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.full_name.localeCompare(b.full_name))
    .map((a) => ({ name: a.full_name, start: formatDay(a.start_date), start_half: halfLabel(a.start_half), end: formatDay(a.end_date), end_half: halfLabel(a.end_half), working: countDays(a).working }));
  return tableToCsv(CSV_COLUMNS, rows);
}

/** Server codes (docs/phase32/proposal.sql) in plain words. */
const MESSAGES: Record<string, string> = {
  LEAVE_OVERLAP: 'This person already has a pending or approved request on some of these days.',
  LEAVE_TOO_LONG: `A request can be at most ${MAX_DAYS} days.`,
  rlr_at_most_60_days: `A request can be at most ${MAX_DAYS} days.`,
  LEAVE_IN_PAST: "Holiday can't start in the past. Ask a manager to record past absence.",
  LEAVE_DATES_INVALID: 'The end date must be on or after the start date.',
  rlr_halves: 'Over several days, the first day can be full or the afternoon, and the last day full or the morning.',
  LEAVE_NOTE_TOO_LONG: `Notes can be up to ${NOTE_MAX} characters.`,
  LEAVE_EMPLOYEE_NOT_FOUND: "That person isn't on your company's rota, or isn't linked to you.",
  LEAVE_EMPLOYEE_ARCHIVED: 'That person is archived on the rota.',
  LEAVE_MANAGER_ONLY: 'Only the owner or an admin of the company can do that.',
  LEAVE_OWN_REQUEST: 'Another manager or the company owner needs to decide your own request.',
  LEAVE_ALREADY_DECIDED: 'This request has already been decided.',
  LEAVE_NOT_CANCELLABLE: 'This request can no longer be cancelled.',
  LEAVE_ALREADY_STARTED: 'This holiday has started. Ask a manager to cancel it.',
  LEAVE_NOT_FOUND: "That request isn't available to you.",
  LEAVE_MEMBER_ALREADY_LINKED: 'This member is already linked to another employee.',
  ORGANIZATION_MEMBERSHIP_REQUIRED: 'Only an active member of this company can be linked.',
  LEAVE_ACCESS_REQUIRED: 'Choose a plan to keep using holiday requests.',
  LEAVE_MONTH_INVALID: 'Choose a month.',
  MFA_REQUIRED: 'Enter your two-step code to continue.',
};
export const SAVE_ERROR = "Couldn't save. Please try again.";
export function errorText(e: { message?: string; details?: string } | null | undefined): string {
  const text = `${e?.message ?? ''} ${e?.details ?? ''}`;
  for (const [code, msg] of Object.entries(MESSAGES)) if (text.includes(code)) return msg;
  return SAVE_ERROR;
}
export const isMissingFeature = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST205' || e.code === '42P01' || /could not find the (function|table)|does not exist/i.test(e.message ?? ''));
export const NOT_AVAILABLE = "Holiday requests need a database update (docs/phase32) that hasn't been applied yet, so nothing can be asked for or saved here until then.";
export const NOT_LINKED = "Your account isn't linked to an employee on this company's rota yet. Ask the company owner or an admin to link you in Rota → Holiday.";

/** What Help and the assistant say (one list, so they can't disagree). */
export const HOLIDAY_FAQ = {
  question: 'How do holiday requests work on the rota?',
  answer: 'In Rota → Holiday, staff ask for a day, half a day or a range of up to 60 days, and the company owner or an admin approves, declines or asks for a change. Holiday a manager has agreed shows on the schedule, and planning a shift on it asks the manager to confirm first. Working days are counted Monday to Friday and bank holidays are not subtracted yet; a balance is shown only when a manager has set an allowance.',
};
