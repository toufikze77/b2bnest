// Google Calendar sync: carrying out the decisions (plan.ts) against Google and the link table. No Deno or network
// imports: Google and the links are passed in, so the Edge Function uses the real ones and the Vitest uses fakes.
import { buildEvent, decide, GONE_PREFIX, wantsEvent, type EventLink, type SyncTask } from './plan.ts';

/** A Google answer: ok, or the HTTP status (0 for a network failure). */
export type GoogleResult<T = unknown> = { ok: true; value: T } | { ok: false; status: number };
export interface GoogleApi {
  insert(event: ReturnType<typeof buildEvent>): Promise<GoogleResult<string>>;
  patch(eventId: string, event: ReturnType<typeof buildEvent>): Promise<GoogleResult>;
  remove(eventId: string): Promise<GoogleResult>;
  /** This person's events carrying the marker of one task. */
  findByTask(taskId: string): Promise<GoogleResult<string[]>>;
  /** All of this person's marked events: event id and task id. */
  listMarked(): Promise<GoogleResult<{ eventId: string; taskId: string }[]>>;
}
export interface LinkStore {
  get(taskId: string): Promise<EventLink | null>;
  all(): Promise<EventLink[]>;
  save(link: EventLink): Promise<void>;
  remove(taskId: string): Promise<void>;
}
export interface Counts { created: number; updated: number; skipped: number; deleted: number; failed: number }
export const emptyCounts = (): Counts => ({ created: 0, updated: 0, skipped: 0, deleted: 0, failed: 0 });
export const addCounts = (a: Counts, b: Counts): Counts =>
  ({ created: a.created + b.created, updated: a.updated + b.updated, skipped: a.skipped + b.skipped, deleted: a.deleted + b.deleted, failed: a.failed + b.failed });

/** The status of a failed answer (works without strict null checks too). */
export const statusOf = (r: GoogleResult<unknown>): number => ('status' in r ? r.status : 0);
const gone = (status: number) => status === 404 || status === 410;

/** One task: decide, then call Google and update the link. Never throws for a Google refusal (it counts as failed). */
export async function syncOne(taskId: string, task: SyncTask | null, link: EventLink | null, marked: string[], userId: string,
  google: GoogleApi, links: LinkStore, counts: Counts): Promise<void> {
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
      const r = await google.insert(buildEvent(task as SyncTask, userId));
      if (!r.ok) { counts.failed++; return; }
      await links.save({ task_id: taskId, external_event_id: r.value, content_hash: d.hash });
      counts.created++;
      await dropExtras(d.dropEventIds);
      return;
    }
    case 'update': {
      const r = await google.patch(d.eventId, buildEvent(task as SyncTask, userId));
      if (!r.ok && gone(statusOf(r))) {
        // Deleted in Google: don't recreate it; skip this task until it changes (decide() reads the "gone:" hash).
        await links.save({ task_id: taskId, external_event_id: d.eventId, content_hash: GONE_PREFIX + d.hash });
        counts.skipped++;
        return;
      }
      if (!r.ok) { counts.failed++; return; }
      await links.save({ task_id: taskId, external_event_id: d.eventId, content_hash: d.hash });
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

/** Google's per-person rate limit is why this stays small. */
export const DEFAULT_CONCURRENCY = 5;

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
}

/**
 * Everything for one person. tasks: their open tasks with a due date (anything not in it is finished, deleted or has no
 * date, so its event goes). If listing Google's marked events fails, nothing is deleted on Google's side.
 * Batches of 25 with a short pause between them; within a batch, up to 5 tasks at a time. Each task is handled exactly
 * as before (syncOne), so the decisions and the counts don't depend on the order.
 */
export async function syncUser(tasks: SyncTask[], userId: string, google: GoogleApi, links: LinkStore, opts: SyncUserOptions = {}): Promise<Counts> {
  const counts = emptyCounts();
  const batch = opts.batchSize ?? 25;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, batch));
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const listed = await google.listMarked();
  if (!listed.ok) { counts.failed++; opts.report?.({ remaining: 0 }); return counts; }
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
        await syncOne(id, task, byTask.get(id) ?? null, marked.get(id) ?? [], userId, google, links, counts);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, chunk.length) }, worker));
  }
  opts.report?.({ remaining: work.length - started });
  return counts;
}
