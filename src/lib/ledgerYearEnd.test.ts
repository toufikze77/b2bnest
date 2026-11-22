// Finance phase 5: year-end date maths (mirrors the database's _ledger_ye_* helpers) and wording.
import { describe, expect, it } from 'vitest';
import { ledgerCode, ledgerMessage } from '@/lib/ledger';
import {
  dayAfter, daysInPeriod, financialYearOf, financialYearRanges, firstYearEnd, followingYearEnd, lockAfterReopen, lockConfirmText, maxDay, reopenConfirmText,
  validYearEnd, warningCount, warningTexts, yearEndIn, yearEndLabel, yearStartOf,
} from '@/lib/ledgerYearEnd';

describe('year-end dates', () => {
  it('29 February is the last day of February: 28th outside leap years (2100 is not a leap year, 2000 was)', () => {
    expect(yearEndIn(2027, 2, 29)).toBe('2027-02-28');
    expect(yearEndIn(2028, 2, 29)).toBe('2028-02-29');
    expect(yearEndIn(2100, 2, 29)).toBe('2100-02-28');
    expect(yearEndIn(2000, 2, 29)).toBe('2000-02-29');
    expect(followingYearEnd('2028-02-29', 2, 29)).toBe('2029-02-28');
    expect(followingYearEnd('2027-02-28', 2, 29)).toBe('2028-02-29');
  });
  it('valid days per month; no 30 February or 31 April', () => {
    expect(validYearEnd(2, 29)).toBe(true);
    expect(validYearEnd(2, 30)).toBe(false);
    expect(validYearEnd(4, 31)).toBe(false);
    expect(validYearEnd(12, 31)).toBe(true);
    expect(validYearEnd(13, 1)).toBe(false);
    expect(validYearEnd(1, 0)).toBe(false);
    expect([1, 2, 4, 6, 9, 11, 12].map(maxDay)).toEqual([31, 29, 30, 30, 30, 30, 31]);
    expect(yearEndLabel(3, 31)).toBe('31 March');
    expect(yearEndLabel(2, 29)).toMatch(/28 February when it isn't a leap year/);
  });
  it('the first year end is the first one after the start date, so the first year can be short', () => {
    // Year end later in the calendar year than the start: same year.
    expect(firstYearEnd('2025-01-01', 3, 31)).toBe('2025-03-31');
    expect(daysInPeriod('2025-01-01', '2025-03-31')).toBe(90);
    // Year end earlier than (or on) the start date: next year.
    expect(firstYearEnd('2025-04-01', 3, 31)).toBe('2026-03-31');
    expect(daysInPeriod('2025-04-01', '2026-03-31')).toBe(365);
    expect(firstYearEnd('2025-03-31', 3, 31)).toBe('2026-03-31');
    expect(firstYearEnd('2027-03-01', 2, 29)).toBe('2028-02-29');
    expect(daysInPeriod('2027-03-01', '2028-02-29')).toBe(366);
  });
  it('when each year starts: the start date for the first, the day after the previous year end for the rest', () => {
    expect(yearStartOf('2025-03-31', '2025-01-01', 3, 31)).toBe('2025-01-01');
    expect(yearStartOf('2026-03-31', '2025-01-01', 3, 31)).toBe('2025-04-01');
    expect(yearStartOf('2029-02-28', '2025-01-01', 2, 29)).toBe('2028-03-01');
    expect(dayAfter('2028-02-28')).toBe('2028-02-29');
  });
  it('the financial year containing a date', () => {
    expect(financialYearOf('2025-02-10', '2025-01-01', 3, 31)).toEqual({ from: '2025-01-01', to: '2025-03-31' });
    expect(financialYearOf('2025-03-31', '2025-01-01', 3, 31)).toEqual({ from: '2025-01-01', to: '2025-03-31' });
    expect(financialYearOf('2025-04-01', '2025-01-01', 3, 31)).toEqual({ from: '2025-04-01', to: '2026-03-31' });
    expect(financialYearOf('2026-11-22', '2025-01-01', 3, 31)).toEqual({ from: '2026-04-01', to: '2027-03-31' });
    expect(financialYearOf('2026-11-22', '2025-01-01', 12, 31)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('financial-year quick choices', () => {
  it('this and last financial year from the company year end (not the 6 April tax year)', () => {
    expect(financialYearRanges('2026-11-22', '2025-01-01', 3, 31)).toEqual({
      thisYear: { from: '2026-04-01', to: '2027-03-31' }, lastYear: { from: '2025-04-01', to: '2026-03-31' },
    });
  });
  it('the last financial year can be the short first year', () => {
    expect(financialYearRanges('2025-06-01', '2025-01-01', 3, 31).lastYear).toEqual({ from: '2025-01-01', to: '2025-03-31' });
  });
  it('in the first year there is no "last financial year"', () => {
    expect(financialYearRanges('2025-02-01', '2025-01-01', 3, 31)).toEqual({ thisYear: { from: '2025-01-01', to: '2025-03-31' }, lastYear: null });
  });
});

describe('warnings and confirmations', () => {
  it('one sentence and one acknowledgement per kind of warning, none when clear', () => {
    expect(warningTexts({ waiting: 0, held: 0, bank_unmatched: 0 })).toEqual([]);
    const w = warningTexts({ waiting: 2, held: 1, bank_unmatched: 3 });
    expect(w.map((x) => x.key)).toEqual(['waiting', 'held', 'bank_unmatched']);
    expect(w[0].text).toBe('2 invoices, bills or expenses dated in this year are still waiting to be posted.');
    expect(w[1].text).toBe('1 automatic posting for this year is held (see Automatic postings).');
    expect(w[2].text).toBe('3 bank statement lines in this year are not matched or posted.');
    expect(warningCount({ waiting: 2, held: 1, bank_unmatched: 3 })).toBe(6);
    expect(warningCount(null)).toBe(0);
  });
  it('the lock confirmation names the date in UK order', () => {
    expect(lockConfirmText('2027-03-31')).toBe('This locks the books through 31/03/2027. You can re-open the most recent year.');
  });
  it('re-opening moves the lock back to the previous year end, or none', () => {
    const y = (ye: string) => ({ year_end: ye, year_start: '', entry_id: null, profit: '0.00' });
    expect(lockAfterReopen({ set_up: true, can_manage: true, closed_years: [y('2025-03-31'), y('2026-03-31')] })).toBe('2025-03-31');
    expect(lockAfterReopen({ set_up: true, can_manage: true, closed_years: [y('2025-03-31')] })).toBeNull();
    expect(reopenConfirmText('2026-03-31', '2025-03-31')).toMatch(/locked through 31\/03\/2025 again/);
    expect(reopenConfirmText('2025-03-31', null)).toMatch(/no longer locked/);
  });
});

describe('error codes', () => {
  it('every new year-end code has plain words; a locked date says closed years are locked', () => {
    expect(ledgerMessage('PERIOD_LOCKED')).toBe('That date is in a locked period. Closed years are locked.');
    for (const c of ['YEAR_END_NOT_SET', 'YEAR_END_BAD_DATE', 'YEAR_END_FIXED', 'YEAR_END_OUT_OF_ORDER', 'YEAR_END_FUTURE', 'YEAR_END_NEEDS_ACK',
      'YEAR_END_INACTIVE_ACCOUNT', 'YEAR_END_NO_RETAINED_EARNINGS', 'YEAR_END_NOT_CLOSED', 'YEAR_END_NOT_LATEST', 'YEAR_END_ONLY_BY_CLOSE', 'YEAR_END_REOPEN_ONLY', 'LOCK_BACKWARDS']) {
      expect(ledgerMessage(c)).not.toBe('Something went wrong. Please try again.');
    }
    expect(ledgerCode({ message: 'LEDGER_YEAR_END_NEEDS_ACK' })).toBe('YEAR_END_NEEDS_ACK');
    expect(ledgerCode({ message: 'LEDGER_YEAR_END_REOPEN_ONLY: a year-end close is undone only by re-opening the year' })).toBe('YEAR_END_REOPEN_ONLY');
  });
});
