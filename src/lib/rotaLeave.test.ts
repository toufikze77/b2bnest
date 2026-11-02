import { describe, expect, it } from 'vitest';
import {
  awayCsv, balanceLines, countDays, errorText, formatDay, holidayOn, othersOff, othersOffText, rangeText, requestError, statusLine, type AwayEntry,
} from '@/lib/rotaLeave';

// 2 Nov 2026 is a Monday.
const r = (start: string, end: string, sh: 'full' | 'am' | 'pm' = 'full', eh: 'full' | 'am' | 'pm' = 'full') => ({ start_date: start, end_date: end, start_half: sh, end_half: eh });
const away = (employee_id: string, full_name: string, start: string, end: string, sh: 'full' | 'am' | 'pm' = 'full', eh: 'full' | 'am' | 'pm' = 'full'): AwayEntry =>
  ({ request_id: `${employee_id}${start}`, employee_id, full_name, start_date: start, end_date: end, start_half: sh, end_half: eh });

describe('counting days (Phase 32: Monday to Friday, half days, no bank holidays)', () => {
  it('working days and calendar days', () => {
    expect(countDays(r('2026-11-02', '2026-11-06'))).toEqual({ calendar: 5, working: 5 });
    expect(countDays(r('2026-11-02', '2026-11-08'))).toEqual({ calendar: 7, working: 5 });
    expect(countDays(r('2026-11-07', '2026-11-08'))).toEqual({ calendar: 2, working: 0 });
    expect(countDays(r('2026-12-24', '2026-12-28'))).toEqual({ calendar: 5, working: 3 }); // Christmas Day counted: bank holidays not subtracted
  });
  it('half days', () => {
    expect(countDays(r('2026-11-02', '2026-11-02', 'am', 'am')).working).toBe(0.5);
    expect(countDays(r('2026-11-02', '2026-11-02', 'pm', 'pm')).working).toBe(0.5);
    expect(countDays(r('2026-11-06', '2026-11-09', 'pm', 'am')).working).toBe(1);   // Friday afternoon to Monday morning
    expect(countDays(r('2026-11-02', '2026-11-06', 'pm', 'full')).working).toBe(4.5);
    expect(countDays(r('2026-11-07', '2026-11-07', 'am', 'am')).working).toBe(0);   // a Saturday morning
  });
  it('only inside a leave year when asked', () => {
    expect(countDays(r('2026-12-28', '2027-01-08'), '2027-01-01', '2028-01-01').working).toBe(6); // Fri 1 Jan and Mon 4 to Fri 8 Jan 2027
  });
});

describe('request checks (the same limits the database enforces)', () => {
  it('end before start, more than 60 days, the past, invalid halves', () => {
    expect(requestError(r('2026-11-10', '2026-11-12'), '2026-11-02', false)).toBeNull();
    expect(requestError(r('2026-11-12', '2026-11-10'), '2026-11-02', false)).toBe('The end date must be on or after the start date.');
    expect(requestError(r('2026-11-10', '2027-01-08'), '2026-11-02', false)).toBeNull(); // 60 days
    expect(requestError(r('2026-11-10', '2027-01-09'), '2026-11-02', false)).toMatch(/at most 60 days/);
    expect(requestError(r('2026-11-01', '2026-11-03'), '2026-11-02', false)).toMatch(/can't start in the past/);
    expect(requestError(r('2026-11-01', '2026-11-03'), '2026-11-02', true)).toBeNull(); // managers may record past absence
    expect(requestError(r('2026-11-10', '2026-11-10', 'am', 'pm'), '2026-11-02', false)).toMatch(/one day/);
    expect(requestError(r('2026-11-10', '2026-11-12', 'am', 'full'), '2026-11-02', false)).toMatch(/several days/);
    expect(requestError(r('', '2026-11-12'), '2026-11-02', false)).toBe('Choose a start date.');
  });
});

describe('words and flags', () => {
  it('dates as 2 Nov 2026, ranges with halves', () => {
    expect(formatDay('2026-11-02')).toBe('2 Nov 2026');
    expect(rangeText(r('2026-11-02', '2026-11-02', 'am', 'am'))).toBe('2 Nov 2026 (morning)');
    expect(rangeText(r('2026-11-06', '2026-11-09', 'pm', 'am'))).toBe('6 Nov 2026 (afternoon) to 9 Nov 2026 (morning)');
  });
  it('others off these days (same person not counted)', () => {
    const list = [away('a', 'Ann', '2026-11-03', '2026-11-03'), away('b', 'Bo', '2026-11-01', '2026-11-20'), away('b', 'Bo', '2026-12-01', '2026-12-02'), away('me', 'Me', '2026-11-04', '2026-11-04')];
    expect(othersOff({ employee_id: 'me', start_date: '2026-11-02', end_date: '2026-11-04' }, list)).toBe(2);
    expect(othersOffText(2)).toBe('2 others are off these days');
    expect(othersOffText(1)).toBe('1 other is off these days');
    expect(othersOffText(0)).toBeNull();
  });
  it('holiday on a rota day, as text', () => {
    const list = [away('a', 'Ann', '2026-11-06', '2026-11-09', 'pm', 'am'), away('b', 'Bo', '2026-11-03', '2026-11-03', 'am', 'am')];
    expect(holidayOn('a', '2026-11-06', list)).toBe('Holiday (afternoon)');
    expect(holidayOn('a', '2026-11-07', list)).toBe('Holiday');
    expect(holidayOn('a', '2026-11-09', list)).toBe('Holiday (morning)');
    expect(holidayOn('b', '2026-11-03', list)).toBe('Holiday (morning)');
    expect(holidayOn('a', '2026-11-10', list)).toBeNull();
  });
  it('status lines with the reason', () => {
    expect(statusLine({ status: 'pending', change_requested: false, decision_note: null })).toBe('Waiting for a manager');
    expect(statusLine({ status: 'declined', change_requested: false, decision_note: 'Stocktake' })).toBe('Declined: Stocktake');
    expect(statusLine({ status: 'declined', change_requested: true, decision_note: 'Move a week' })).toBe('Change requested: Move a week');
    expect(statusLine({ status: 'approved', change_requested: false, decision_note: null })).toBe('Approved');
  });
  it('balance: with an allowance; without one, no balance (never invented)', () => {
    const b = { leave_year: 2026, start_month: 1, year_start: '2026-01-01', year_end: '2026-12-31', used_days: 5, pending_days: 1.5 };
    expect(balanceLines({ ...b, allowance_days: 25, remaining_days: 18.5 }).lines).toEqual(['Allowance: 25 days', 'Used: 5 days', 'Waiting for approval: 1.5 days', 'Remaining if those are approved: 18.5 days']);
    const none = balanceLines({ ...b, allowance_days: null, remaining_days: null });
    expect(none.lines[0]).toBe('No allowance set, so no balance is shown.');
    expect(none.lines.join(' ')).not.toMatch(/Remaining|Allowance:/);
    expect(none.title).toBe('Leave year 1 Jan 2026 to 31 Dec 2026');
  });
  it('server codes in plain words', () => {
    expect(errorText({ message: 'LEAVE_OVERLAP' })).toMatch(/already has a pending or approved request/);
    expect(errorText({ message: 'boom' })).toBe("Couldn't save. Please try again.");
  });
});

describe('CSV of approved holiday (the Phase 36 export helper)', () => {
  it('escapes commas, quotes and new lines and neutralises formulas', () => {
    const csv = awayCsv([away('a', '=HYPERLINK("x")', '2026-11-02', '2026-11-06'), away('b', 'Smith, "Jo"\nB', '2026-11-03', '2026-11-03', 'pm', 'pm'),
      away('c', '+44 Cat', '2026-11-04', '2026-11-04'), away('d', '@Dee', '2026-11-05', '2026-11-05'), away('e', '-Ed', '2026-11-05', '2026-11-05')]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Name,Start,Start half,End,End half,Working days (Mon to Fri)');
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")",2 Nov 2026,Full day,6 Nov 2026,Full day,5`);
    expect(csv).toContain('"Smith, ""Jo""\nB",3 Nov 2026,Afternoon,3 Nov 2026,Afternoon,0.5');
    expect(csv).toContain("'+44 Cat");
    expect(csv).toContain("'@Dee");
    expect(csv).toContain("'-Ed");
  });
});
