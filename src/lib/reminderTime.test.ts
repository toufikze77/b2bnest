import { describe, expect, it } from 'vitest';
import { formatReminder, fromLocalInputValue, reminderState, toLocalInputValue } from './reminderTime';

const LONDON = 'Europe/London';

describe('note reminder time: local display, UTC storage', () => {
  it('stores a summer London time as UTC one hour earlier, and shows it back unchanged', () => {
    const iso = fromLocalInputValue('2026-07-01T09:00', LONDON);
    expect(iso).toBe('2026-07-01T08:00:00.000Z');
    expect(toLocalInputValue(iso, LONDON)).toBe('2026-07-01T09:00');
    expect(formatReminder(iso!, LONDON)).toBe('Wed 1 Jul 2026, 09:00 BST');
  });

  it('stores a winter London time as the same UTC time', () => {
    expect(fromLocalInputValue('2026-12-01T09:00', LONDON)).toBe('2026-12-01T09:00:00.000Z');
  });

  it('DST end (last Sunday of October, 25 Oct 2026): times either side of the change are exact', () => {
    // Clocks go back from 02:00 BST to 01:00 GMT.
    expect(fromLocalInputValue('2026-10-25T00:30', LONDON)).toBe('2026-10-24T23:30:00.000Z'); // still BST
    expect(fromLocalInputValue('2026-10-25T02:30', LONDON)).toBe('2026-10-25T02:30:00.000Z'); // GMT
    expect(fromLocalInputValue('2026-10-25T09:00', LONDON)).toBe('2026-10-25T09:00:00.000Z');
    expect(formatReminder('2026-10-25T09:00:00.000Z', LONDON)).toBe('Sun 25 Oct 2026, 09:00 GMT');
    // The day before the change, 09:00 is still BST.
    expect(fromLocalInputValue('2026-10-24T09:00', LONDON)).toBe('2026-10-24T08:00:00.000Z');
  });

  it('DST end: 01:30 happens twice; the first (BST) one is used so the reminder is never late', () => {
    const iso = fromLocalInputValue('2026-10-25T01:30', LONDON);
    expect(iso).toBe('2026-10-25T00:30:00.000Z');
    expect(formatReminder(iso!, LONDON)).toBe('Sun 25 Oct 2026, 01:30 BST');
    // The second 01:30 (GMT) still displays as 01:30 in the input.
    expect(toLocalInputValue('2026-10-25T01:30:00.000Z', LONDON)).toBe('2026-10-25T01:30');
  });

  it('DST start (29 Mar 2026): a skipped time moves forward by the gap', () => {
    expect(fromLocalInputValue('2026-03-29T01:30', LONDON)).toBe('2026-03-29T01:30:00.000Z'); // shown as 02:30 BST
    expect(toLocalInputValue('2026-03-29T01:30:00.000Z', LONDON)).toBe('2026-03-29T02:30');
  });

  it('reads the database format (with +00:00) for the input', () => {
    expect(toLocalInputValue('2026-07-01T08:00:00+00:00', LONDON)).toBe('2026-07-01T09:00');
  });

  it('empty or bad values are null / empty, never a guess', () => {
    expect(fromLocalInputValue('', LONDON)).toBeNull();
    expect(fromLocalInputValue('25/10/2026 09:00', LONDON)).toBeNull();
    expect(toLocalInputValue(null, LONDON)).toBe('');
    expect(toLocalInputValue('nope', LONDON)).toBe('');
  });

  it('due once the time has passed, upcoming before', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    expect(reminderState('2026-10-18T11:59:00Z', now)).toBe('due');
    expect(reminderState('2026-10-18T12:00:00Z', now)).toBe('due');
    expect(reminderState('2026-10-18T12:01:00Z', now)).toBe('upcoming');
    expect(reminderState(null, now)).toBe('none');
  });
});
