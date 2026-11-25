// Google Calendar sync: pure helpers (no Deno, no network), shared by the Edge Function and its Vitest
// (src/test/googleCalendarSync.test.ts). What an event looks like, a hash of what was written, and what to do for a
// task: create, update, skip or delete. See docs/google-calendar-sync/README.md.

export const PROVIDER = 'google_calendar';
/** Bumped when the event format changes, so every event is rewritten once. */
export const HASH_VERSION = 'v1';
/** A link whose event was deleted in Google: content_hash is GONE_PREFIX + the hash of the task at that moment. */
export const GONE_PREFIX = 'gone:';
/** Private extended properties on every event we create (a lost link can't cause a duplicate). */
export const MARK_TASK = 'b2bnest_task_id';
export const MARK_USER = 'b2bnest_user_id';

export interface SyncTask {
  id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string | null;
  completed_at?: string | null;
  archived_at?: string | null;
}
export interface EventLink { task_id: string; external_event_id: string; content_hash: string }

/** Finished tasks: status 'done' (what the app writes), or a completion time, or archived. */
export const isOpen = (t: SyncTask) => t.status !== 'done' && t.status !== 'completed' && !t.completed_at && !t.archived_at;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An open task with a real due date gets one event; anything else gets none. */
export const wantsEvent = (t: SyncTask | null | undefined): t is SyncTask => !!t && isOpen(t) && ISO_DATE.test(t.due_date ?? '');

/** The day after 'YYYY-MM-DD' (Google's all-day events end on the next day, exclusive). */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Google's event colours: 11 red, 5 yellow, 2 green (valid for all-day events too). */
export const colourFor = (priority?: string | null) => (priority === 'high' || priority === 'urgent' ? '11' : priority === 'medium' ? '5' : '2');

/** The all-day event for a task on its due date. Reminders: the calendar's own all-day defaults. */
export function buildEvent(task: SyncTask, userId: string) {
  const due = task.due_date as string;
  return {
    summary: `📋 ${task.title}`,
    description: task.description || 'Task from B2BNEST',
    start: { date: due },
    end: { date: nextDay(due) },
    reminders: { useDefault: true },
    colorId: colourFor(task.priority),
    extendedProperties: { private: { [MARK_TASK]: task.id, [MARK_USER]: userId } },
  };
}

/** Two FNV-1a 32-bit hashes (different seeds) of a string: 16 hex characters. Change detection only, not security. */
function fnv(s: string): string {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
/** What the event shows: title, description, due date and priority (colour). */
export const contentHash = (t: SyncTask) =>
  `${HASH_VERSION}:${fnv(JSON.stringify([t.title ?? '', t.description ?? '', t.due_date ?? '', t.priority ?? '']))}`;

export type Decision =
  | { kind: 'none' }
  | { kind: 'skip'; reason: 'unchanged' | 'deleted_in_google'; dropEventIds: string[] }
  | { kind: 'create'; hash: string; dropEventIds: string[] }
  | { kind: 'update'; eventId: string; hash: string; adopted: boolean; dropEventIds: string[] }
  | { kind: 'delete'; eventIds: string[]; dropLink: boolean };

/**
 * What to do for one task. task: the task if it should be considered (null when deleted, or not loaded because it is
 * finished or has no due date). link: our row, if any. marked: ids of this person's events carrying the task's marker.
 * Extra marked events (duplicates) are always removed, so there is exactly one event per task afterwards.
 */
export function decide(task: SyncTask | null, link: EventLink | null, marked: string[] = []): Decision {
  const linkId = link && !link.content_hash.startsWith(GONE_PREFIX) ? link.external_event_id : null;
  if (!wantsEvent(task)) {
    const ids = [...new Set([...(linkId ? [linkId] : []), ...marked])];
    return ids.length || link ? { kind: 'delete', eventIds: ids, dropLink: !!link } : { kind: 'none' };
  }
  const hash = contentHash(task);
  if (link) {
    if (link.content_hash.startsWith(GONE_PREFIX)) {
      // Deleted in Google: not recreated while the task is unchanged; recreated (fresh) once the task changes.
      if (link.content_hash === GONE_PREFIX + hash) return { kind: 'skip', reason: 'deleted_in_google', dropEventIds: marked };
      return { kind: 'create', hash, dropEventIds: marked };
    }
    const extras = marked.filter((id) => id !== link.external_event_id);
    if (link.content_hash === hash) return { kind: 'skip', reason: 'unchanged', dropEventIds: extras };
    return { kind: 'update', eventId: link.external_event_id, hash, adopted: false, dropEventIds: extras };
  }
  // No link: reuse an event that already carries our marker (the link was lost), otherwise create one.
  if (marked.length) return { kind: 'update', eventId: marked[0], hash, adopted: true, dropEventIds: marked.slice(1) };
  return { kind: 'create', hash, dropEventIds: [] };
}
