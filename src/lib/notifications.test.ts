import { describe, expect, it } from 'vitest';
import { groupNotifications, isMissingColumnError, isMissingTableError, notificationGroup, notificationKind, safeInAppLink } from './notifications';

describe('notification grouping boundaries (week starts Monday)', () => {
  const thu = new Date('2026-10-22T12:00:00'); // Thursday
  it('Today is the viewer\'s calendar day, from midnight', () => {
    expect(notificationGroup('2026-10-22T00:00:00', thu)).toBe('Today');
    expect(notificationGroup('2026-10-21T23:59:59', thu)).toBe('Earlier this week');
  });
  it('Earlier this week starts Monday 00:00; Sunday is Older', () => {
    expect(notificationGroup('2026-10-19T00:00:00', thu)).toBe('Earlier this week');
    expect(notificationGroup('2026-10-18T23:59:59', thu)).toBe('Older');
  });
  it('on a Monday, yesterday (Sunday) is Older, not this week', () => {
    const mon = new Date('2026-10-19T09:00:00');
    expect(notificationGroup('2026-10-19T08:00:00', mon)).toBe('Today');
    expect(notificationGroup('2026-10-18T20:00:00', mon)).toBe('Older');
  });
  it('missing or bad dates go to Older', () => {
    expect(notificationGroup(null, thu)).toBe('Older');
    expect(notificationGroup('nope', thu)).toBe('Older');
  });
  it('keeps order and drops empty groups', () => {
    const g = groupNotifications([{ created_at: '2026-10-22T10:00:00' }, { created_at: '2026-10-01T10:00:00' }], thu);
    expect(g.map((x) => x.label)).toEqual(['Today', 'Older']);
  });
});

describe('notification helpers', () => {
  it('accepts in-app paths only', () => {
    expect(safeInAppLink('/business-tools/notepro?note=1')).toBe('/business-tools/notepro?note=1');
    expect(safeInAppLink('/')).toBe('/');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a b', '', null, undefined]) {
      expect(safeInAppLink(bad)).toBeNull();
    }
  });
  it('maps old and new types to a kind', () => {
    expect(notificationKind('invoice_overdue')).toBe('invoice_overdue');
    expect(notificationKind('task_shared')).toBe('shared');
    expect(notificationKind('welcome')).toBe('welcome');
    expect(notificationKind(null)).toBe('general');
    expect(notificationKind('info')).toBe('general');
  });
  it('recognises missing column and missing table errors', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column notifications.link does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.notification_type_prefs' in the schema cache" })).toBe(true);
    expect(isMissingTableError({ code: '42P01', message: 'relation "public.notification_type_prefs" does not exist' })).toBe(true);
    expect(isMissingTableError({ code: '500', message: 'boom' })).toBe(false);
  });
});
