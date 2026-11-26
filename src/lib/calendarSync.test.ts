// Google Calendar sync from the app: one task after a change, only when connected; "Sync now"; disconnect.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ data: [{ integration_name: 'google_calendar', is_connected: true }], error: null })),
  invoke: vi.fn(async () => ({ data: { success: true, created: 3, updated: 1, skipped: 4, deleted: 0, failed: 0 }, error: null })),
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: st.rpc,
    auth: { getSession: async () => ({ data: { session: st.session } }) },
    functions: { invoke: st.invoke },
  },
}));

import { forgetCalendarLinks, GOOGLE_CALENDAR_SCOPE, googleCalendarConnected, resetCalendarConnectionCache, syncNow, syncSummary, syncTaskToCalendar, SYNC_FAILED } from './calendarSync';
import { resetDemoMode, setDemoNow } from '@/lib/demoMode';

beforeEach(() => { resetCalendarConnectionCache(); st.session = { user: { id: 'u1' } }; });
afterEach(() => { resetDemoMode(); st.rpc.mockClear(); st.invoke.mockClear(); vi.restoreAllMocks(); });

describe('one task after a change', () => {
  it('connected: asks the function to sync just that task', async () => {
    await syncTaskToCalendar('t1');
    expect(st.invoke).toHaveBeenCalledWith('google-calendar-sync', { body: { action: 'sync_task', task_id: 't1' } });
  });
  it('not connected: no call at all (and the answer is remembered for a minute)', async () => {
    st.rpc.mockResolvedValue({ data: [{ integration_name: 'notion', is_connected: true }, { integration_name: 'google_calendar', is_connected: false }], error: null });
    await syncTaskToCalendar('t1');
    await syncTaskToCalendar('t2');
    expect(st.invoke).not.toHaveBeenCalled();
    expect(st.rpc).toHaveBeenCalledTimes(1);
    st.rpc.mockResolvedValue({ data: [{ integration_name: 'google_calendar', is_connected: true }], error: null });
  });
  it('demo, signed out or no task id: no call', async () => {
    setDemoNow(true);
    await syncTaskToCalendar('t1');
    resetDemoMode();
    st.session = null;
    await syncTaskToCalendar('t1');
    st.session = { user: { id: 'u1' } };
    await syncTaskToCalendar(undefined);
    expect(st.invoke).not.toHaveBeenCalled();
  });
  it('a failure is logged, never thrown, and never shown as an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    st.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } } as never);
    await expect(syncTaskToCalendar('t1')).resolves.toBeUndefined();
    st.invoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(syncTaskToCalendar('t1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });
  it('the connection check reads the safe RPC for this person', async () => {
    expect(await googleCalendarConnected('u9', 0)).toBe(true);
    expect(st.rpc).toHaveBeenCalledWith('get_user_integrations_safe', { p_user_id: 'u9' });
  });
});

describe('Sync now', () => {
  it('shows "Synced 3, updated 1, removed 0" (the function now returns success and the counts)', async () => {
    expect(await syncNow()).toEqual({ ok: true, counts: { created: 3, updated: 1, skipped: 4, deleted: 0, failed: 0 }, text: 'Synced 3, updated 1, removed 0' });
    expect(st.invoke).toHaveBeenCalledWith('google-calendar-sync', { body: { action: 'sync_tasks' } });
    expect(syncSummary({ created: 0, updated: 0, skipped: 0, deleted: 2, failed: 1 })).toBe('Synced 0, updated 0, removed 2, 1 failed');
  });
  it('an error says so', async () => {
    st.invoke.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);
    expect(await syncNow()).toEqual({ ok: false, text: SYNC_FAILED });
    st.invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'Google Calendar not connected' }) } } } as never);
    expect(await syncNow()).toEqual({ ok: false, text: 'Google Calendar is not connected.' });
  });
  it('Google refused the saved sign-in: "Please reconnect Google Calendar" (reconnect flag in the body, or in the error)', async () => {
    st.invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'Google Calendar needs to be reconnected', reconnect: true }) } } } as never);
    expect(await syncNow()).toEqual({ ok: false, text: 'Please reconnect Google Calendar', reconnect: true });
    st.invoke.mockResolvedValueOnce({ data: { error: 'Google Calendar needs to be reconnected', reconnect: true }, error: null } as never);
    expect(await syncNow()).toEqual({ ok: false, text: 'Please reconnect Google Calendar', reconnect: true });
  });
  it('the Google scope is calendar events only', () => {
    expect(GOOGLE_CALENDAR_SCOPE).toBe('https://www.googleapis.com/auth/calendar.events');
  });
});

describe('disconnect', () => {
  it('asks the function to forget the links (the events stay in Google)', async () => {
    await forgetCalendarLinks();
    expect(st.invoke).toHaveBeenCalledWith('google-calendar-sync', { body: { action: 'forget_links' } });
  });
});
