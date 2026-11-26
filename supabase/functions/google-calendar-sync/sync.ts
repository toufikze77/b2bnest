// Google Calendar sync: carrying out the decisions (plan.ts) against Google and the link table. No Deno or network
// imports: Google and the links are passed in, so the Edge Function uses the real ones and the Vitest uses fakes.
import { buildEvent, decide, GONE_PREFIX, wantsEvent, type EventLink, type SyncTask } from './plan.ts';
import { GOOGLE_LIMITS } from './limits.ts';

/** A Google answer: ok, or the HTTP status (0 for a network failure) and Google's reason when there was one. */
export type GoogleResult<T = unknown> = { ok: true; value: T } | { ok: false; status: number; reason?: string };
export interface GoogleApi {
  insert(event: ReturnType<typeof buildEvent>): Promise<GoogleResult<string>>;
  patch(eventId: string, event: ReturnType<typeof buildEvent>): Promise<GoogleResult>;
  remove(eventId: string): Promise<GoogleResult>;
  /** This person's events carrying the marker of one task. */
  findByTask(taskId: string): Promise<GoogleResult<string[]>>;
  /** All of this person's marked events: event id, task id and (from Google) when it was created. */
  listMarked(): Promise<GoogleResult<{ eventId: string; taskId: string; created?: string }[]>>;
  /** Failures so far by Google's reason, and the first one (the real client; fakes may leave it out). */
  failureSummary?(): { failures: Record<string, number>; firstError: string | null };
}
export interface LinkStore {
  get(taskId: string): Promise<EventLink | null>;
  all(): Promise<EventLink[]>;
  /** false when the row could not be saved (retried once by syncOne). */
  save(link: EventLink): Promise<boolean | void>;
  remove(taskId: string): Promise<void>;
}
export interface Counts { created: number; updated: number; skipped: number; deleted: number; failed: number }
export const emptyCounts = (): Counts => ({ created: 0, updated: 0, skipped: 0, deleted: 0, failed: 0 });
export const addCounts = (a: Counts, b: Counts): Counts =>
  ({ created: a.created + b.created, updated: a.updated + b.updated, skipped: a.skipped + b.skipped, deleted: a.deleted + b.deleted, failed: a.failed + b.failed });

/** The status of a failed answer (works without strict null checks too). */
export const statusOf = (r: GoogleResult<unknown>): number => ('status' in r ? r.status : 0);
export const reasonOf = (r: GoogleResult<unknown>): string | undefined => ('reason' in r ? r.reason : undefined);
/** An answer that may have been lost after Google acted on it (network failure or a 5xx). */
const mayHaveHappened = (status: number) => status === 0 || status >= 500;

/** Save a link; if that fails, try once more (the event exists, so a lost link must not cause a duplicate later). */
async function saveLink(links: LinkStore, link: EventLink): Promise<void> {
  if ((await links.save(link)) !== false) return;
  if ((await links.save(link)) === false) console.error('google-calendar-sync: link not saved after a retry (the next sync finds the event by its marker)');
}

export interface SyncOneOptions {
  /** Look the task's marker up again right before an insert (the first listing may be stale). */
  freshMarks?: () => Promise<string[] | null>;
}
const gone = (status: number) => status === 404 || status === 410;

/** One task: decide, then call Google and update the link. Never throws for a Google refusal (it counts as failed). */
export async function syncOne(taskId: string, task: SyncTask | null, link: EventLink | null, marked: string[], userId: string,
  google: GoogleApi, links: LinkStore, counts: Counts, opts: SyncOneOptions = {}): Promise<void> {
  const d = decide(task, link, marked);
  const dropExtras = async (ids: string[]) => {
    for (const id of ids) {
      const r = await google.remove(id);
      if (r.ok || gone(statusOf(r))) counts.deleted++; else counts.failed++;
    }
  };
  switch (d.kind) {
    case 'none': return;
    case 'skip': counts.skipped++; await dropExtras(d.dropEventIds); return;
    case 'delete': {
      let allGone = true;
      for (const id of d.eventIds) {
        const r = await google.remove(id);
        if (r.ok || gone(statusOf(r))) counts.deleted++; else { counts.failed++; allGone = false; }
      }
      // A deleted link with nothing to remove (its event was already deleted in Google) still clears the row.
      if (d.dropLink && allGone) await links.remove(taskId);
      return;
    }
    case 'create': {
      // No duplicate from a stale listing: if the marker shows an event now, reuse it instead of inserting.
      if (!link && opts.freshMarks) {
        const fresh = await opts.freshMarks();
        if (fresh && fresh.length) return syncOne(taskId, task, null, fresh, userId, google, links, counts);
      }
      const r = await google.insert(buildEvent(task as SyncTask, userId));
      if (!r.ok) {
        // The answer may have been lost after Google created the event: look for it before giving up.
        if (mayHaveHappened(statusOf(r))) {
          const found = await google.findByTask(taskId);
          if (found.ok && found.value.length) {
            await saveLink(links, { task_id: taskId, external_event_id: found.value[0], content_hash: d.hash });
            counts.created++;
            await dropExtras([...found.value.slice(1), ...d.dropEventIds]);
            return;
          }
        }
        counts.failed++;
        return;
      }
      await saveLink(links, { task_id: taskId, external_event_id: r.value, content_hash: d.hash });
      counts.created++;
      await dropExtras(d.dropEventIds);
      return;
    }
    case 'update': {
      const r = await google.patch(d.eventId, buildEvent(task as SyncTask, userId));
      if (!r.ok && gone(statusOf(r))) {
        // Deleted in Google: don't recreate it; skip this task until it changes (decide() reads the "gone:" hash).
        await saveLink(links, { task_id: taskId, external_event_id: d.eventId, content_hash: GONE_PREFIX + d.hash });
        counts.skipped++;
        return;
      }
      if (!r.ok) { counts.failed++; return; }
      await saveLink(links, { task_id: taskId, external_event_id: d.eventId, content_hash: d.hash });
      counts.updated++;
      await dropExtras(d.dropEventIds);
      return;
    }
  }
}

/** One task by id (after it was created, edited, completed or deleted in the app). task: null when it no longer exists. */
export async function syncTask(taskId: string, task: SyncTask | null, userId: string, google: GoogleApi, links: LinkStore): Promise<Counts> {
  const counts = emptyCounts();
  const found = await google.findByTask(taskId);
  if (!found.ok) { counts.failed++; return counts; }
  await syncOne(taskId, task, await links.get(taskId), found.value, userId, google, links, counts);
  return counts;
}

/** A time budget: true once ms have passed since it was created (shared by sync_tasks and sync_all). */
export function createBudget(ms: number, now: () => number = Date.now) {
  const started = now();
  return { expired: () => now() - started > ms, elapsed: () => now() - started };
}
export type Budget = ReturnType<typeof createBudget>;

/** Google's per-person rate limit is why this stays small (see limits.ts). */
export const DEFAULT_CONCURRENCY = GOOGLE_LIMITS.concurrency;

export interface SyncUserOptions {
  batchSize?: number;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Tasks in flight at once within a batch (default 5). */
  concurrency?: number;
  /** No new task is started once it has expired; the rest are reported as remaining. */
  budget?: { expired(): boolean };
  /** How many tasks were not started because the budget ran out (0 when everything ran). */
  report?: (r: { remaining: number }) => void;
  now?: () => number;
}

/**
 * Everything for one person. tasks: their open tasks with a due date (anything not in it is finished, deleted or has no
 * date, so its event goes). If listing Google's marked events fails, nothing is deleted on Google's side.
 * Batches of 25 with a short pause between them; within a batch, up to GOOGLE_LIMITS.concurrency (2) tasks at a time,
 * and Google's own client spaces the write calls. Each task is handled exactly
 * as before (syncOne), so the decisions and the counts don't depend on the order.
 */
export async function syncUser(tasks: SyncTask[], userId: string, google: GoogleApi, links: LinkStore, opts: SyncUserOptions = {}): Promise<Counts> {
  const counts = emptyCounts();
  const batch = opts.batchSize ?? 25;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, batch));
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const listed = await google.listMarked();
  if (!listed.ok) { counts.failed++; opts.report?.({ remaining: 0 }); return counts; }
  const listedAt = now();
  // Google's listing can lag a few seconds behind; once it is old, look a task's marker up again before inserting.
  const freshMarks = (id: string) => async () => {
    if (now() - listedAt <= GOOGLE_LIMITS.staleListMs) return null;
    const f = await google.findByTask(id);
    return f.ok ? f.value : null;
  };
  const marked = new Map<string, string[]>();
  for (const m of listed.value) marked.set(m.taskId, [...(marked.get(m.taskId) ?? []), m.eventId]);
  const byTask = new Map((await links.all()).map((l) => [l.task_id, l]));
  const wanted = tasks.filter((t) => wantsEvent(t));
  const wantedIds = new Set(wanted.map((t) => t.id));
  const work: [string, SyncTask | null][] = [
    ...wanted.map((t): [string, SyncTask] => [t.id, t]),
    ...[...new Set([...byTask.keys(), ...marked.keys()])].filter((id) => !wantedIds.has(id)).map((id): [string, null] => [id, null]),
  ];
  let started = 0;
  let stopped = false;
  for (let from = 0; from < work.length && !stopped; from += batch) {
    if (from > 0) await sleep(opts.pauseMs ?? 250);
    const chunk = work.slice(from, from + batch);
    let next = 0;
    const worker = async () => {
      while (next < chunk.length) {
        if (opts.budget?.expired()) { stopped = true; return; }
        const [id, task] = chunk[next++];
        started++;
        await syncOne(id, task, byTask.get(id) ?? null, marked.get(id) ?? [], userId, google, links, counts, { freshMarks: freshMarks(id) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, chunk.length) }, worker));
  }
  opts.report?.({ remaining: work.length - started });
  return counts;
}

/**
 * "Fix duplicates": for every task with more than one marked event, keep one (the event the link names, else the
 * oldest created) and delete the others, then make sure a link names the kept one. A new link gets a hash that never
 * matches, so the next sync rewrites the event once to the task's current content.
 */
export async function repairDuplicates(google: GoogleApi, links: LinkStore): Promise<{ removed: number; failed: number; relinked: number }> {
  const out = { removed: 0, failed: 0, relinked: 0 };
  const listed = await google.listMarked();
  if (!listed.ok) { out.failed++; return out; }
  const byTask = new Map<string, { eventId: string; created?: string }[]>();
  for (const m of listed.value) byTask.set(m.taskId, [...(byTask.get(m.taskId) ?? []), m]);
  const linkFor = new Map((await links.all()).map((l) => [l.task_id, l]));
  for (const [taskId, evs] of byTask) {
    if (evs.length < 2) continue;
    const link = linkFor.get(taskId);
    const linked = link && evs.find((e) => e.eventId === link.external_event_id);
    const keep = linked ?? [...evs].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''))[0];
    for (const e of evs) {
      if (e.eventId === keep.eventId) continue;
      const r = await google.remove(e.eventId);
      if (r.ok || gone(statusOf(r))) out.removed++; else out.failed++;
    }
    if (!link || link.external_event_id !== keep.eventId) {
      await saveLink(links, { task_id: taskId, external_event_id: keep.eventId, content_hash: 'repair:rewrite' });
      out.relinked++;
    }
  }
  return out;
}
