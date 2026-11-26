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

/** Google's "slow down" reasons: the advice is to wait and press again. */
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded', 'calendarUsageLimitsExceeded']);
/** "198 failed (Google said: rateLimitExceeded). Wait a minute and press Sync now again." */
export function failureNote(failed: number, firstError: string | null | undefined): string {
  if (!failed) return '';
  if (!firstError) return ` ${failed} failed.`;
  const advice = RATE_REASONS.has(firstError) ? ' Wait a minute and press Sync now again.' : '';
  return ` ${failed} failed (Google said: ${firstError}).${advice}`;
}
export const RECONNECT_TEXT = 'Please reconnect Google Calendar';
export const SYNCING_TEXT = 'Syncing… this can take a minute the first time';
export const CONNECTED_TEXT = 'Google Calendar connected. Your tasks with a due date will appear in it.';

/** The time budget ran out before every task was done: what was done so far, and what is left. */
export const partialSummary = (c: CalendarCounts, remaining: number) =>
  `Synced ${c.created} so far, ${remaining} remain – press Sync now again`;

/** Only events: create, change and delete the events made for tasks, and find them again by their private marker. */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const GOOGLE_CALENDAR_DESCRIPTION =
  'Adds your tasks with a due date to your Google Calendar: Google lets B2BNEST see and edit events in your calendars, and B2BNEST only creates, updates and removes the events for your tasks.';
export const GOOGLE_NOT_SET_UP = "Google Calendar can't be connected yet: B2BNEST's Google sign-in isn't set up. Please tell us at info@b2bnest.online.";

/** The "Sync now" button: every task of the signed-in person. */
export async function syncNow(): Promise<{ ok: true; counts: CalendarCounts; text: string; remaining: number } | { ok: false; text: string; reconnect?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body: { action: 'sync_tasks' } });
    if (error || !data?.success) {
      const body = String(data?.error ?? '') + (data?.reconnect ? ' "reconnect":true' : '') + (await errorText(error));
      // Google refused the saved sign-in (for example a connection made earlier with a person's own Client ID).
      if (/"reconnect":\s*true|needs to be reconnected/i.test(body)) {
        resetCalendarConnectionCache();
        return { ok: false, text: RECONNECT_TEXT, reconnect: true };
      }
      const notConnected = /not connected/i.test(body);
      return { ok: false, text: notConnected ? 'Google Calendar is not connected.' : SYNC_FAILED };
    }
    const counts: CalendarCounts = {
      created: Number(data.created) || 0, updated: Number(data.updated) || 0, skipped: Number(data.skipped) || 0,
      deleted: Number(data.deleted) || 0, failed: Number(data.failed) || 0,
    };
    // A big first sync stops starting new tasks after about 100 seconds; pressing again continues (unchanged ones are skipped).
    const remaining = data.more ? Math.max(0, Number(data.remaining) || 0) : 0;
    const firstError = typeof data.firstError === 'string' ? data.firstError : null;
    const main = remaining > 0 ? partialSummary(counts, remaining) : syncSummary({ ...counts, failed: firstError ? 0 : counts.failed });
    // With Google's reason, the failures read "N failed (Google said: …)" instead of ", N failed".
    const text = firstError && counts.failed ? `${main}.${failureNote(counts.failed, firstError)}` : main;
    return { ok: true, counts, remaining, text };
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

/** "Fix duplicates": keep one event per task in Google Calendar and delete the copies. */
export async function repairDuplicatesNow(): Promise<{ ok: boolean; text: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-calendar-sync', { body: { action: 'repair_duplicates' } });
    if (error || !data?.success) {
      const body = String(data?.error ?? '') + (await errorText(error));
      if (/"reconnect":\s*true|needs to be reconnected/i.test(body)) return { ok: false, text: RECONNECT_TEXT };
      return { ok: false, text: 'Could not check for duplicates. Please try again.' };
    }
    const removed = Number(data.removed) || 0;
    const failed = Number(data.failed) || 0;
    const text = `Removed ${removed} duplicate event${removed === 1 ? '' : 's'}`;
    return { ok: true, text: failed ? `${text}.${failureNote(failed, typeof data.firstError === 'string' ? data.firstError : null)}` : text };
  } catch {
    return { ok: false, text: 'Could not check for duplicates. Please try again.' };
  }
}
