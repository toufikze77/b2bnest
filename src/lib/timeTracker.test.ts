import { describe, expect, it } from 'vitest';
import {
  customRange, decimalHours, entriesCsv, entryValue, errorText, formatClock, formatDate, formatDay, formatDuration, formatPence, formatTime,
  manualEntryError, overlappingIds, parseDuration, parseRate, parseSummary, rangeFor, timerState, valuePence, workedSeconds, type TimeEntry,
} from '@/lib/timeTracker';

const T0 = new Date('2026-11-02T09:00:00Z').getTime();
const iso = (offsetSec: number) => new Date(T0 + offsetSec * 1000).toISOString();
const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'e1', user_id: 'u', project_id: null, company_id: null, description: 'Work', start_time: iso(0), end_time: null,
  paused_seconds: 0, paused_at: null, is_billable: true, hourly_rate_pence: null, ...over,
});

describe('timer maths (Phase 31)', () => {
  it('a running timer after a refresh: elapsed comes from the stored start and the clock', () => {
    const stored = entry({ start_time: iso(0) });
    expect(workedSeconds(stored, T0 + 3909 * 1000)).toBe(3909);
    expect(formatClock(workedSeconds(stored, T0 + 3909 * 1000))).toBe('1:05:09');
    expect(timerState(stored)).toBe('running');
  });
  it('pause and resume: paused time is not counted, including an open pause', () => {
    const paused = entry({ paused_seconds: 300, paused_at: iso(3000) });
    expect(timerState(paused)).toBe('paused');
    // 1 hour since start; 5 minutes paused earlier; paused again for the last 10 minutes.
    expect(workedSeconds(paused, T0 + 3600 * 1000)).toBe(3600 - 300 - 600);
    // The clock stands still while paused.
    expect(workedSeconds(paused, T0 + 4000 * 1000)).toBe(workedSeconds(paused, T0 + 3600 * 1000));
    const resumed = entry({ paused_seconds: 300 + 600 });
    expect(workedSeconds(resumed, T0 + 3600 * 1000)).toBe(2700);
  });
  it('a stopped entry: end minus start minus pauses; never negative or NaN', () => {
    expect(workedSeconds(entry({ end_time: iso(3900), paused_seconds: 0 }), Date.now())).toBe(3900);
    expect(workedSeconds(entry({ end_time: iso(60), paused_seconds: 600 }), Date.now())).toBe(0);
    expect(workedSeconds(entry({ start_time: 'nonsense', end_time: iso(60) }), Date.now())).toBe(0);
  });
});

describe('formatting, en-GB', () => {
  it('1h 05m, dates as 2 Nov 2026, 24-hour times', () => {
    expect(formatDuration(3900)).toBe('1h 05m');
    expect(formatDuration(59)).toBe('0h 00m');
    expect(formatDuration(25 * 3600 + 60 * 7)).toBe('25h 07m');
    expect(formatDuration(Number.NaN)).toBe('0h 00m');
    expect(formatDate(new Date(2026, 10, 2, 17, 5))).toBe('2 Nov 2026');
    expect(formatDate(new Date(2026, 8, 30))).toBe('30 Sep 2026');
    expect(formatDay('2026-10-07')).toBe('7 Oct 2026');
    expect(formatTime(new Date(2026, 10, 2, 17, 5))).toBe('17:05');
    expect(formatTime(new Date(2026, 10, 2, 9, 0))).toBe('09:00');
    expect(decimalHours(3900)).toBe(1.08);
  });
});

describe('rate and value', () => {
  it('value = hours x rate, rounded to the penny; no rate = no value (never guessed)', () => {
    expect(valuePence(3900, 3000)).toBe(3250);          // 1h 05m at £30
    expect(valuePence(3600, 1234)).toBe(1234);
    expect(valuePence(1000, 1234)).toBe(343);           // 342.78 → 343
    expect(valuePence(3600, null)).toBeNull();
    expect(entryValue(entry({ end_time: iso(3600), hourly_rate_pence: 5000, is_billable: false }), T0)).toBeNull();
    expect(formatPence(325050)).toBe('£3,250.50');
  });
  it('rate input: pounds to pence; empty = no rate; nonsense or over £10,000 refused', () => {
    expect(parseRate('45')).toBe(4500);
    expect(parseRate('£45.50')).toBe(4550);
    expect(parseRate('1,250.5')).toBe(125050);
    expect(parseRate('')).toBeNull();
    expect(parseRate('45.555')).toBe('invalid');
    expect(parseRate('-5')).toBe('invalid');
    expect(parseRate('10000.01')).toBe('invalid');
  });
});

describe('manual entries', () => {
  const now = new Date(2026, 10, 2, 12, 0).getTime();
  it('refuses the future, more than 24 hours, and an end before the start', () => {
    expect(manualEntryError(new Date(2026, 10, 2, 9), new Date(2026, 10, 2, 10, 5), now)).toBeNull();
    expect(manualEntryError(new Date(2026, 10, 2, 11), new Date(2026, 10, 2, 13), now)).toBe("Entries can't be in the future.");
    expect(manualEntryError(new Date(2026, 10, 3, 9), new Date(2026, 10, 3, 10), now)).toBe("Entries can't be in the future.");
    expect(manualEntryError(new Date(2026, 10, 1, 9), new Date(2026, 10, 2, 9, 1), now)).toBe("An entry can't be longer than 24 hours.");
    expect(manualEntryError(new Date(2026, 10, 1, 9), new Date(2026, 10, 2, 9), now)).toBeNull();
    expect(manualEntryError(new Date(2026, 10, 2, 10), new Date(2026, 10, 2, 9), now)).toBe('The end must be after the start.');
    expect(manualEntryError(null, null, now)).toBe('Enter a start date and time.');
  });
  it('durations typed as 1h 05m, 1:05, 65m, 1.5h or 90', () => {
    expect(parseDuration('1h 05m')).toBe(3900);
    expect(parseDuration('1:05')).toBe(3900);
    expect(parseDuration('65m')).toBe(3900);
    expect(parseDuration('1.5h')).toBe(5400);
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('soon')).toBeNull();
  });
  it('overlapping entries are flagged, touching ones are not', () => {
    const list = [
      { id: 'a', start_time: iso(0), end_time: iso(3600) },
      { id: 'b', start_time: iso(1800), end_time: iso(5400) },
      { id: 'c', start_time: iso(5400), end_time: iso(6000) },
      { id: 'd', start_time: iso(9000), end_time: null },
      { id: 'e', start_time: iso(9500), end_time: iso(9600) },
    ];
    expect([...overlappingIds(list, T0 + 10000 * 1000)].sort()).toEqual(['a', 'b', 'd', 'e']);
  });
});

describe('ranges (weeks start on Monday)', () => {
  it('today, this week, this month, custom', () => {
    const now = new Date(2026, 10, 4, 15, 0); // Wednesday 4 Nov 2026
    expect(rangeFor('today', now)).toEqual({ from: new Date(2026, 10, 4), to: new Date(2026, 10, 5) });
    expect(rangeFor('week', now)).toEqual({ from: new Date(2026, 10, 2), to: new Date(2026, 10, 9) });
    expect(rangeFor('week', new Date(2026, 10, 8, 23))).toEqual({ from: new Date(2026, 10, 2), to: new Date(2026, 10, 9) }); // Sunday
    expect(rangeFor('month', now)).toEqual({ from: new Date(2026, 10, 1), to: new Date(2026, 11, 1) });
    expect(customRange('2026-10-05', '2026-10-07')).toEqual({ from: new Date(2026, 9, 5), to: new Date(2026, 9, 8) });
    expect(customRange('2026-10-07', '2026-10-05')).toBe('The end date must be on or after the start date.');
    expect(customRange('2025-01-01', '2026-10-05')).toBe('Choose at most 400 days.');
  });
});

describe('CSV of the range (the Phase 36 export helper)', () => {
  it('escapes commas, quotes and new lines, and neutralises leading = + - @', () => {
    const csv = entriesCsv([
      entry({ id: '1', description: 'Call, then "notes"\nline 2', end_time: iso(3900), hourly_rate_pence: 3000 }),
      entry({ id: '2', start_time: iso(7200), description: '=HYPERLINK("http://x")', end_time: iso(7800), is_billable: false }),
      entry({ id: '3', start_time: iso(9000), description: '+44 call', end_time: iso(9600), project_id: 'p1' }),
      entry({ id: '4', start_time: iso(10000), description: '-1', end_time: iso(10600) }),
      entry({ id: '5', start_time: iso(11000), description: '@SUM(A1)', end_time: iso(11600) }),
    ], new Map([['p1', 'Acme, Ltd']]), T0);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Start,End,Duration,Hours,Project,Description,Billable,Hourly rate (GBP),Value (GBP)');
    expect(csv).toContain('"Call, then ""notes""\nline 2"');
    expect(lines[1]).toMatch(/,1h 05m,1\.08,No project,/);
    expect(lines[1]).toMatch(/,Yes,30,32\.5$/);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain("'+44 call");
    expect(csv).toContain(',"Acme, Ltd",');
    expect(csv).toContain(",'-1,");
    expect(csv).toContain(",'@SUM(A1),");
    expect(csv).toMatch(/'=HYPERLINK.*,No,,$/m); // not billable, no rate: value left empty, not 0
  });
});

describe('summary and errors', () => {
  it('a missing or partial summary reads as zeros, never NaN', () => {
    expect(parseSummary(null)).toEqual({ entries: 0, total_seconds: 0, billable_seconds: 0, billable_value_pence: 0, unrated_billable_seconds: 0, by_project: [], by_day: [] });
    expect(parseSummary({ total_seconds: 'x', by_day: [{ day: '2026-11-02', seconds: null }] }).by_day[0]).toEqual({ day: '2026-11-02', seconds: 0, billable_seconds: 0, value_pence: 0 });
  });
  it('server codes in plain words', () => {
    expect(errorText({ message: 'TIMER_ALREADY_RUNNING' })).toBe('A timer is already running. Stop it before starting another.');
    expect(errorText({ message: 'new row violates check constraint "pte_at_most_24_hours"' })).toBe("An entry can't be longer than 24 hours.");
    expect(errorText({ message: 'boom' })).toBe("Couldn't save. Please try again.");
  });
});
