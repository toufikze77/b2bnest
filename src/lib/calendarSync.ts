// Google Calendar sync from the app (docs/google-calendar-sync/README.md). After a task is created, edited, completed or
// deleted, the google-calendar-sync function updates that one task's event, but only when the person has Google
// Calendar connected (checked with the safe RPC, remembered for a minute; nothing is called otherwise). These calls never
// block or fail the task change: problems are logged, and the 15-minute catch-up fixes anything missed.
import { supabase } from '@/integrations/supabase/client';
import { isDemoNow } from '@/lib/demoMode';

export interface CalendarCounts { created: number; updated: number; skipped: number; deleted: number; failed: number }

const CACHE_MS = 60_000;
let cache: { userId: string; connected: boolean; at: number } | null = null;

/** Forget the remembered answer (after connecting or disconnecting). */
export function resetCalendarConnectionCache() { cache = null; }

/** Is Google Calendar connected for this person? (get_user_integrations_safe; no tokens are read.) */
export async function googleCalendarConnected(userId: string, now = Date.now()): Promise<boolean> {
  if (cache && cache.userId === userId && now - cache.at < CACHE_MS) return cache.connected;
  const { data, error } = await supabase.rpc('get_user_integrations_safe', { p_user_id: userId });
  if (error) return false;
  const connected = ((data ?? []) as { integration_name: string; is_connected: boolean | null }[])
    .some((i) => i.integration_name === 'google_calendar' && i.is_connected === true);
  cache = { userId, connected, at: now };
  return connected;
}

/** Update one task's Google Calendar event (create, change or remove it). Fire and forget: never throws. */
export async function syncTaskToCalendar(taskId: string | null | undefined): Promise<void> {
  try {
    if (!taskId || isDemoNow()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId || !(await googleCalendarConnected(userId))) return;
    const { error } = await supabase.functions.invoke('google-calendar-sync', { body: { action: 'sync_task', task_id: taskId } });
    if (error) console.warn('Google Calendar: this task was not synced now; the next automatic sync will retry.', error.message);
  } catch (e) {
    console.warn('Google Calendar: this task was not synced now; the next automatic sync will retry.', e instanceof Error ? e.message : e);
  }
}

/** "Synced 3, updated 1, removed 0" (and "2 failed" when some did). */
export function syncSummary(c: CalendarCounts): string {
  return `Synced ${c.created}, updated ${c.updated}, removed ${c.deleted}${c.failed ? `, ${c.failed} failed` : ''}`;
}

export const SYNC_FAILED = 'Could not sync with Google Calendar. Please try again.';

/** The "Sync now" button: every task of the signed-in person. */
export async function syncNow(): Promise<{ ok: true; counts: CalendarCounts; text: string } | { ok: false; text: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body: { action: 'sync_tasks' } });
    if (error || !data?.success) {
      const notConnected = /not connected/i.test(String(data?.error ?? '')) || /not connected/i.test(await errorText(error));
      return { ok: false, text: notConnected ? 'Google Calendar is not connected.' : SYNC_FAILED };
    }
    const counts: CalendarCounts = {
      created: Number(data.created) || 0, updated: Number(data.updated) || 0, skipped: Number(data.skipped) || 0,
      deleted: Number(data.deleted) || 0, failed: Number(data.failed) || 0,
    };
    return { ok: true, counts, text: syncSummary(counts) };
  } catch {
    return { ok: false, text: SYNC_FAILED };
  }
}

/** The error body of a failed function call, when there is one (FunctionsHttpError keeps the Response in .context). */
async function errorText(error: unknown): Promise<string> {
  const ctx = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!ctx?.json) return '';
  try { return JSON.stringify(await ctx.json()); } catch { return ''; }
}

/** Google Calendar was disconnected: forget which event belongs to which task. The events themselves stay in Google. */
export async function forgetCalendarLinks(): Promise<void> {
  resetCalendarConnectionCache();
  try {
    const { error } = await supabase.functions.invoke('google-calendar-sync', { body: { action: 'forget_links' } });
    if (error) console.warn('Google Calendar: links not cleared now; the next automatic sync clears them.', error.message);
  } catch (e) {
    console.warn('Google Calendar: links not cleared now; the next automatic sync clears them.', e instanceof Error ? e.message : e);
  }
}
