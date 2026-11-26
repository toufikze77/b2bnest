// Google Calendar sync (supabase/functions/google-calendar-sync): the pure plan and the executor, against an in-memory
// Google calendar and link table. Exactly one event per open task with a due date, never a duplicate.
import { describe, expect, it } from 'vitest';
import { buildEvent, contentHash, decide, GONE_PREFIX, MARK_TASK, MARK_USER, nextDay, wantsEvent, type EventLink, type SyncTask } from '../../supabase/functions/google-calendar-sync/plan';
import { syncTask, syncUser, type GoogleApi, type LinkStore } from '../../supabase/functions/google-calendar-sync/sync';
import { googleApi } from '../../supabase/functions/google-calendar-sync/google';

const U = 'user-1';
const task = (id: string, o: Partial<SyncTask> = {}): SyncTask => ({ id, title: `Task ${id}`, description: null, due_date: '2026-12-01', priority: 'medium', status: 'todo', ...o });

/** An in-memory Google calendar. calls lists every write. */
function fakeGoogle() {
  const events = new Map<string, { summary: string; start: { date: string }; end: { date: string }; colorId: string; private: Record<string, string> }>();
  const calls: string[] = [];
  let n = 0;
  const api: GoogleApi & { events: typeof events; calls: string[]; deleteInGoogle(id: string): void; failNext?: number } = {
    events, calls,
    deleteInGoogle: (id) => { events.delete(id); },
    async insert(e) {
      calls.push('insert');
      const id = `evt${++n}`;
      events.set(id, { summary: e.summary, start: e.start, end: e.end, colorId: e.colorId, private: e.extendedProperties.private });
      return { ok: true, value: id };
    },
    async patch(id, e) {
      calls.push(`patch:${id}`);
      if (!events.has(id)) return { ok: false, status: 404 };
      events.set(id, { summary: e.summary, start: e.start, end: e.end, colorId: e.colorId, private: e.extendedProperties.private });
      return { ok: true, value: null };
    },
    async remove(id) {
      calls.push(`delete:${id}`);
      if (!events.has(id)) return { ok: false, status: 410 };
      events.delete(id);
      return { ok: true, value: null };
    },
    async findByTask(taskId) {
      return { ok: true, value: [...events].filter(([, e]) => e.private[MARK_TASK] === taskId && e.private[MARK_USER] === U).map(([id]) => id) };
    },
    async listMarked() {
      return { ok: true, value: [...events].filter(([, e]) => e.private[MARK_USER] === U).map(([eventId, e]) => ({ eventId, taskId: e.private[MARK_TASK] })) };
    },
  };
  return api;
}
function fakeLinks(): LinkStore & { rows: Map<string, EventLink> } {
  const rows = new Map<string, EventLink>();
  return {
    rows,
    get: async (id) => rows.get(id) ?? null,
    all: async () => [...rows.values()],
    save: async (l) => { rows.set(l.task_id, { ...l }); },
    remove: async (id) => { rows.delete(id); },
  };
}
const noPause = { sleep: async () => {} };

describe('plan: the event', () => {
  it('is an all-day event on the due date (end is the next day), titled "📋 {title}", with our private markers', () => {
    const e = buildEvent(task('t1', { title: 'Pay VAT', priority: 'high' }), U);
    expect(e.start).toEqual({ date: '2026-12-01' });
    expect(e.end).toEqual({ date: '2026-12-02' });
    expect(e.summary).toBe('📋 Pay VAT');
    expect(e.colorId).toBe('11');
    expect(e.reminders).toEqual({ useDefault: true });
    expect(e.extendedProperties.private).toEqual({ [MARK_TASK]: 't1', [MARK_USER]: U });
    expect(JSON.stringify(e)).not.toMatch(/dateTime|timeZone/);
  });
  it('next day across month, year and leap day', () => {
    expect(nextDay('2026-01-31')).toBe('2026-02-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
  it('only open tasks with a real due date get an event ("done" is what the app writes)', () => {
    expect(wantsEvent(task('a'))).toBe(true);
    expect(wantsEvent(task('a', { status: 'done' }))).toBe(false);
    expect(wantsEvent(task('a', { completed_at: '2026-11-25T10:00:00Z' }))).toBe(false);
    expect(wantsEvent(task('a', { archived_at: '2026-11-25T10:00:00Z' }))).toBe(false);
    expect(wantsEvent(task('a', { due_date: null }))).toBe(false);
    expect(wantsEvent(null)).toBe(false);
  });
  it('the hash changes with title, description, due date or priority, and not otherwise', () => {
    const h = contentHash(task('a'));
    expect(contentHash(task('a', { status: 'in-progress' }))).toBe(h);
    for (const o of [{ title: 'x' }, { description: 'x' }, { due_date: '2026-12-02' }, { priority: 'high' }]) expect(contentHash(task('a', o))).not.toBe(h);
    expect(h).toMatch(/^v1:[0-9a-f]{16}$/);
  });
});

describe('plan: decide', () => {
  const link = (t: SyncTask, id = 'evt1'): EventLink => ({ task_id: t.id, external_event_id: id, content_hash: contentHash(t) });
  it('new task: create', () => { expect(decide(task('a'), null).kind).toBe('create'); });
  it('unchanged task: skip (no Google call)', () => { const t = task('a'); expect(decide(t, link(t))).toMatchObject({ kind: 'skip', reason: 'unchanged' }); });
  it('edited task: update the linked event', () => {
    const t = task('a'); expect(decide({ ...t, title: 'New' }, link(t))).toMatchObject({ kind: 'update', eventId: 'evt1', adopted: false });
  });
  it('completed or deleted task: delete the event and the link', () => {
    const t = task('a');
    expect(decide({ ...t, status: 'done' }, link(t))).toEqual({ kind: 'delete', eventIds: ['evt1'], dropLink: true });
    expect(decide(null, null, ['evt7'])).toEqual({ kind: 'delete', eventIds: ['evt7'], dropLink: false });
    expect(decide(null, null, [])).toEqual({ kind: 'none' });
  });
  it('lost link but our marker found: reuse that event (no duplicate), remove any extra copies', () => {
    expect(decide(task('a'), null, ['evt3', 'evt4'])).toEqual({ kind: 'update', eventId: 'evt3', hash: contentHash(task('a')), adopted: true, dropEventIds: ['evt4'] });
  });
  it('deleted in Google: skipped until the task changes, then created afresh', () => {
    const t = task('a');
    const g: EventLink = { task_id: 'a', external_event_id: 'evt1', content_hash: GONE_PREFIX + contentHash(t) };
    expect(decide(t, g)).toMatchObject({ kind: 'skip', reason: 'deleted_in_google' });
    expect(decide({ ...t, title: 'Changed' }, g).kind).toBe('create');
    expect(decide({ ...t, status: 'done' }, g)).toEqual({ kind: 'delete', eventIds: [], dropLink: true });
  });
});

describe('sync: against a calendar', () => {
  it('creates one event per open task with a due date, and the same sync twice creates nothing the second time', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    const tasks = [task('a'), task('b'), task('c', { due_date: null }), task('d', { status: 'done' })];
    expect(await syncUser(tasks, U, google, links, noPause)).toEqual({ created: 2, updated: 0, skipped: 0, deleted: 0, failed: 0 });
    expect(google.events.size).toBe(2);
    google.calls.length = 0;
    expect(await syncUser(tasks, U, google, links, noPause)).toEqual({ created: 0, updated: 0, skipped: 2, deleted: 0, failed: 0 });
    expect(google.calls).toEqual([]);
    expect(google.events.size).toBe(2);
  });
  it('an edited task is PATCHed (same event), a completed one is removed with its link', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    await syncUser([task('a'), task('b')], U, google, links, noPause);
    const idA = links.rows.get('a')!.external_event_id;
    google.calls.length = 0;
    const r = await syncUser([task('a', { title: 'Renamed', due_date: '2026-12-05' })], U, google, links, noPause);
    expect(r).toEqual({ created: 0, updated: 1, skipped: 0, deleted: 1, failed: 0 });
    expect(google.calls).toEqual([`patch:${idA}`, expect.stringMatching(/^delete:/)]);
    expect(google.events.get(idA)).toMatchObject({ summary: '📋 Renamed', start: { date: '2026-12-05' }, end: { date: '2026-12-06' } });
    expect([...links.rows.keys()]).toEqual(['a']);
  });
  it('a lost link row does not create a duplicate: the marked event is reused', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    await syncUser([task('a')], U, google, links, noPause);
    links.rows.clear();
    google.calls.length = 0;
    const r = await syncUser([task('a')], U, google, links, noPause);
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(google.calls.filter((c) => c === 'insert')).toEqual([]);
    expect(google.events.size).toBe(1);
    expect(links.rows.get('a')?.external_event_id).toBe([...google.events.keys()][0]);
  });
  it('Google 404 on an edited task: not recreated, the link remembers it; recreated only after the task changes again', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    await syncUser([task('a')], U, google, links, noPause);
    google.deleteInGoogle(links.rows.get('a')!.external_event_id);
    const edited = task('a', { title: 'Edited' });
    expect(await syncUser([edited], U, google, links, noPause)).toEqual({ created: 0, updated: 0, skipped: 1, deleted: 0, failed: 0 });
    expect(links.rows.get('a')?.content_hash).toBe(GONE_PREFIX + contentHash(edited));
    expect(google.events.size).toBe(0);
    expect(await syncUser([edited], U, google, links, noPause)).toMatchObject({ created: 0, skipped: 1 });
    expect(await syncUser([task('a', { title: 'Edited again' })], U, google, links, noPause)).toMatchObject({ created: 1 });
    expect(google.events.size).toBe(1);
  });
  it('one task after it is deleted in the app: its event is found by the marker (the link already cascaded away) and removed', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    await syncTask('a', task('a'), U, google, links);
    expect(google.events.size).toBe(1);
    links.rows.delete('a'); // ON DELETE CASCADE from todos
    expect(await syncTask('a', null, U, google, links)).toEqual({ created: 0, updated: 0, skipped: 0, deleted: 1, failed: 0 });
    expect(google.events.size).toBe(0);
  });
  it('one task twice in a row (create, then the same again): one event', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    expect(await syncTask('a', task('a'), U, google, links)).toMatchObject({ created: 1 });
    expect(await syncTask('a', task('a'), U, google, links)).toMatchObject({ created: 0, skipped: 1 });
    expect(google.events.size).toBe(1);
  });
  it('another B2BNEST person on the same Google calendar: their events are never touched', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    google.events.set('theirs', { summary: '📋 Theirs', start: { date: '2026-12-01' }, end: { date: '2026-12-02' }, colorId: '2', private: { [MARK_TASK]: 'z', [MARK_USER]: 'user-2' } });
    await syncUser([], U, google, links, noPause);
    expect(google.events.has('theirs')).toBe(true);
  });
  it('if Google cannot list the marked events, nothing is deleted or created', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    google.listMarked = async () => ({ ok: false, status: 500 });
    expect(await syncUser([task('a')], U, google, links, noPause)).toEqual({ created: 0, updated: 0, skipped: 0, deleted: 0, failed: 1 });
    expect(google.calls).toEqual([]);
  });
  it('pauses between batches of 25', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    let pauses = 0;
    const tasks = Array.from({ length: 60 }, (_, i) => task(`t${i}`));
    await syncUser(tasks, U, google, links, { sleep: async () => { pauses++; } });
    expect(pauses).toBe(2);
    expect(google.events.size).toBe(60);
  });
});

describe('google client: 401 and 429', () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  it('401: refreshes the token once and tries again', async () => {
    const seen: string[] = [];
    const fetchFn = (async (_url: string, init: RequestInit) => {
      seen.push(String((init.headers as Record<string, string>).Authorization));
      return seen.length === 1 ? new Response('no', { status: 401 }) : ok({ id: 'evt1' });
    }) as unknown as typeof fetch;
    const g = googleApi({ token: 'old', userId: U, refresh: async () => 'new', fetchFn, sleep: async () => {} });
    expect(await g.insert(buildEvent(task('a'), U))).toEqual({ ok: true, value: 'evt1' });
    expect(seen).toEqual(['Bearer old', 'Bearer new']);
  });
  it('429: waits (Retry-After) and retries, then succeeds', async () => {
    let n = 0; const waits: number[] = [];
    const fetchFn = (async () => (++n < 3 ? new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } }) : ok({}))) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, sleep: async (ms) => { waits.push(ms); } });
    expect((await g.patch('evt1', buildEvent(task('a'), U))).ok).toBe(true);
    // Only the retry waits (the write spacing waits are under a second).
    expect(waits.filter((w) => w >= 1000)).toEqual([1000, 1000]);
  });
  it('searches by both private markers (this person and this task)', async () => {
    let url = '';
    const fetchFn = (async (u: string) => { url = u; return ok({ items: [{ id: 'e1', extendedProperties: { private: { [MARK_TASK]: 'a', [MARK_USER]: U } } }] }); }) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn });
    expect(await g.findByTask('a')).toEqual({ ok: true, value: ['e1'] });
    expect(decodeURIComponent(url)).toContain(`privateExtendedProperty=${MARK_USER}=${U}`);
    expect(decodeURIComponent(url)).toContain(`privateExtendedProperty=${MARK_TASK}=a`);
  });
});

describe('speed and time budget', () => {
  /** A fake calendar whose calls take a little time, counting how many are in flight at once. */
  function slowGoogle(delayMs = 5) {
    const g = fakeGoogle();
    let inFlight = 0; let max = 0;
    const wrap = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) => async (...a: A) => {
      inFlight++; max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, delayMs));
      try { return await fn(...a); } finally { inFlight--; }
    };
    g.insert = wrap(g.insert.bind(g)); g.patch = wrap(g.patch.bind(g)); g.remove = wrap(g.remove.bind(g));
    return Object.assign(g, { maxInFlight: () => max });
  }
  it('never more than 2 calls to Google in flight at once (the default since the rate-limit failures)', async () => {
    const google = slowGoogle(); const links = fakeLinks();
    await syncUser(Array.from({ length: 40 }, (_, i) => task(`t${i}`)), U, google, links, noPause);
    expect(google.maxInFlight()).toBe(2);
    expect(google.events.size).toBe(40);
  });
  it('the same task list gives the same counts with 5 at a time as one at a time', async () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task(`t${i}`, i % 3 === 0 ? { title: 'A' } : {}));
    const run = async (concurrency: number) => {
      const google = slowGoogle(1); const links = fakeLinks();
      const first = await syncUser(tasks, U, google, links, { ...noPause, concurrency });
      const edited = tasks.map((t, i) => (i % 4 === 0 ? { ...t, title: `${t.title} edited` } : t)).filter((_, i) => i % 5 !== 0);
      const second = await syncUser(edited, U, google, links, { ...noPause, concurrency });
      return { first, second, events: google.events.size, links: links.rows.size };
    };
    const one = await run(1);
    const five = await run(5);
    expect(five).toEqual(one);
    expect(one.second).toEqual({ created: 0, updated: 6, skipped: 18, deleted: 6, failed: 0 });
  });
  it('when the budget runs out: no new task starts, the rest is reported; the next run finishes without duplicates', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    const tasks = Array.from({ length: 50 }, (_, i) => task(`t${i}`));
    let started = 0; let remaining = -1;
    const budget = { expired: () => started >= 20 };
    const counting = { ...google, insert: async (e: Parameters<GoogleApi['insert']>[0]) => { started++; return google.insert(e); } } as GoogleApi;
    const first = await syncUser(tasks, U, counting, links, { ...noPause, budget, report: (r) => { remaining = r.remaining; } });
    expect(first.created).toBe(20);
    expect(remaining).toBe(30);
    let remaining2 = -1;
    const second = await syncUser(tasks, U, google, links, { ...noPause, report: (r) => { remaining2 = r.remaining; } });
    expect(second).toEqual({ created: 30, updated: 0, skipped: 20, deleted: 0, failed: 0 });
    expect(remaining2).toBe(0);
    expect(google.events.size).toBe(50);
    expect(new Set([...google.events.values()].map((e) => e.private[MARK_TASK])).size).toBe(50);
  });
  it('createBudget expires after its time', async () => {
    const { createBudget } = await import('../../supabase/functions/google-calendar-sync/sync');
    let t = 1000;
    const b = createBudget(100, () => t);
    expect(b.expired()).toBe(false);
    t = 1100; expect(b.expired()).toBe(false);
    t = 1101; expect(b.expired()).toBe(true);
  });
  it('several calls hitting 401 at once share one token refresh, then all succeed', async () => {
    let refreshes = 0;
    const fetchFn = (async (_url: string, init: RequestInit) => {
      const auth = String((init.headers as Record<string, string>).Authorization);
      await new Promise((r) => setTimeout(r, 2));
      return auth === 'Bearer old' ? new Response('', { status: 401 }) : new Response(JSON.stringify({ id: 'e' }), { status: 200 });
    }) as unknown as typeof fetch;
    const g = googleApi({ token: 'old', userId: U, refresh: async () => { refreshes++; await new Promise((r) => setTimeout(r, 5)); return 'new'; }, fetchFn, sleep: async () => {} });
    const results = await Promise.all(Array.from({ length: 5 }, () => g.insert(buildEvent(task('a'), U))));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(refreshes).toBe(1);
  });
});

describe('rate limits, visibility, duplicates and edits (after #118)', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const googleError = (status: number, reason: string) => json({ error: { code: status, message: 'x', errors: [{ reason, domain: 'usageLimits' }] } }, status);
  /** A fake clock: sleep moves it forward. */
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => { t += ms; } };
  }

  it('403 rateLimitExceeded for 3 calls, then success: retried with backoff, counted as created', async () => {
    const c = clock(); let n = 0; const waits: number[] = [];
    const fetchFn = (async () => (++n <= 3 ? googleError(403, 'rateLimitExceeded') : json({ id: 'evt1' }))) as unknown as typeof fetch;
    const logs: string[] = [];
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, now: c.now, random: () => 0, log: (l) => logs.push(l),
      sleep: async (ms) => { if (ms >= 1000) waits.push(ms); await c.sleep(ms); } });
    const links = fakeLinks();
    const counts = await syncTask('a', task('a'), U, { ...g, findByTask: async () => ({ ok: true, value: [] }) }, links);
    expect(counts).toMatchObject({ created: 1, failed: 0 });
    expect(waits).toEqual([1000, 2000, 4000]);
    expect(logs).toEqual([]);
    expect(g.failureSummary?.()).toEqual({ failures: {}, firstError: null });
  });
  it('403 rateLimitExceeded every time: 4 retries (1, 2, 4, 8 s), then failed with the reason logged and returned', async () => {
    const c = clock(); const waits: number[] = []; const logs: string[] = [];
    const fetchFn = (async () => googleError(403, 'userRateLimitExceeded')) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, now: c.now, random: () => 0, log: (l) => logs.push(l),
      sleep: async (ms) => { if (ms >= 1000) waits.push(ms); await c.sleep(ms); } });
    expect(await g.insert(buildEvent(task('a'), U))).toEqual({ ok: false, status: 403, reason: 'userRateLimitExceeded' });
    expect(waits).toEqual([1000, 2000, 4000, 8000]);
    expect(logs).toEqual(['google-calendar-sync: insert failed (POST 403 userRateLimitExceeded)']);
    expect(g.failureSummary?.()).toEqual({ failures: { userRateLimitExceeded: 1 }, firstError: 'userRateLimitExceeded' });
  });
  it('403 insufficientPermissions: no retry, the reason is surfaced, and the log has no token, title or description', async () => {
    const c = clock(); let n = 0; const logs: string[] = [];
    const fetchFn = (async () => { n++; return googleError(403, 'insufficientPermissions'); }) as unknown as typeof fetch;
    const g = googleApi({ token: 'secret-token', userId: U, refresh: async () => null, fetchFn, now: c.now, sleep: c.sleep, log: (l) => logs.push(l) });
    const r = await g.patch('evt1', buildEvent(task('a', { title: 'Private title', description: 'Private notes' }), U));
    expect(r).toEqual({ ok: false, status: 403, reason: 'insufficientPermissions' });
    expect(n).toBe(1);
    expect(logs.join(' ')).not.toMatch(/secret-token|Private/);
    expect(g.failureSummary?.().firstError).toBe('insufficientPermissions');
  });
  it('Retry-After is honoured (capped at 10 s)', async () => {
    const c = clock(); let n = 0; const waits: number[] = [];
    const fetchFn = (async () => (++n === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '30' } }) : json({}))) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, now: c.now, sleep: async (ms) => { if (ms >= 1000) waits.push(ms); await c.sleep(ms); } });
    expect((await g.remove('evt1')).ok).toBe(true);
    expect(waits).toEqual([10000]);
  });
  /** Virtual time: sleeps resolve in time order, overlapping like real ones (run() drives the timers). */
  function virtualTime() {
    let t = 0;
    const timers: { at: number; seq: number; fn: () => void }[] = [];
    let seq = 0;
    const sleep = (ms: number) => new Promise<void>((res) => { timers.push({ at: t + Math.max(0, ms), seq: seq++, fn: res }); });
    const tick = () => new Promise((r) => setTimeout(r, 0));
    async function run<T>(p: Promise<T>): Promise<T> {
      let done = false;
      void p.finally(() => { done = true; });
      while (!done) {
        await tick();
        if (done || !timers.length) continue;
        timers.sort((x, y) => x.at - y.at || x.seq - y.seq);
        const next = timers.shift()!;
        t = Math.max(t, next.at);
        next.fn();
      }
      return p;
    }
    return { now: () => t, sleep, run };
  }

  it('write calls start at least 300 ms apart, shared by the workers; at most 2 in flight', async () => {
    const c = virtualTime(); const starts: number[] = []; let inFlight = 0; let max = 0; let id = 0;
    const fetchFn = (async (_u: string, init: RequestInit) => {
      if (init.method !== 'GET') starts.push(c.now());
      inFlight++; max = Math.max(max, inFlight);
      await c.sleep(50);
      inFlight--;
      return init.method === 'GET' ? json({ items: [] }) : json({ id: `e${++id}` });
    }) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, now: c.now, sleep: c.sleep });
    await c.run(syncUser(Array.from({ length: 12 }, (_, i) => task(`t${i}`)), U, g, fakeLinks(), { sleep: c.sleep, now: c.now }));
    expect(starts).toHaveLength(12);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(300);
    expect(max).toBeLessThanOrEqual(2);
  });
  it('a marked event that Google lists only after a delay: no duplicate (looked up again before inserting)', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    // An event made a moment ago by another run: not in the first listing yet, found by its marker later.
    google.events.set('evtLate', { summary: '📋 Task a', start: { date: '2026-12-01' }, end: { date: '2026-12-02' }, colorId: '5', private: { [MARK_TASK]: 'a', [MARK_USER]: U } });
    const realList = google.listMarked.bind(google);
    google.listMarked = async () => { const r = await realList(); return r.ok ? { ok: true, value: r.value.filter((x) => x.eventId !== 'evtLate') } : r; };
    let t = 0;
    const counts = await syncUser([task('a')], U, google, links, { sleep: async () => {}, now: () => { t += 61_000; return t; } });
    expect(counts).toMatchObject({ created: 0, updated: 1 });
    expect(google.calls.filter((x) => x === 'insert')).toEqual([]);
    expect(links.rows.get('a')?.external_event_id).toBe('evtLate');
  });
  it('an insert whose answer was lost (network error) but which Google made: found by its marker, linked, not duplicated', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    const realInsert = google.insert.bind(google);
    google.insert = async (e) => { await realInsert(e); return { ok: false, status: 0, reason: 'network' }; };
    expect(await syncUser([task('a')], U, google, links, noPause)).toMatchObject({ created: 1, failed: 0 });
    expect(google.events.size).toBe(1);
    expect(await syncUser([task('a')], U, google, links, noPause)).toMatchObject({ created: 0, skipped: 1 });
    expect(google.events.size).toBe(1);
  });
  it('a link save that fails once is retried once', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    let fails = 1; const realSave = links.save;
    links.save = async (l) => { if (fails-- > 0) return false; return realSave(l); };
    await syncUser([task('a')], U, google, links, noPause);
    expect(links.rows.get('a')).toBeDefined();
  });
  it('an edited title is PATCHed by sync_task and by sync_tasks (the content hash changes)', async () => {
    for (const how of ['one', 'all'] as const) {
      const google = fakeGoogle(); const links = fakeLinks();
      await syncTask('a', task('a'), U, google, links);
      const id = links.rows.get('a')!.external_event_id;
      const edited = task('a', { title: 'New title' });
      expect(contentHash(edited)).not.toBe(links.rows.get('a')!.content_hash);
      google.calls.length = 0;
      const r = how === 'one' ? await syncTask('a', edited, U, google, links) : await syncUser([edited], U, google, links, noPause);
      expect(r).toMatchObject({ updated: 1, created: 0, failed: 0 });
      expect(google.calls).toEqual([`patch:${id}`]);
      expect(google.events.get(id)?.summary).toBe('📋 New title');
    }
  });
  it('after Disconnect + Connect (no links), existing marked events are adopted: no inserts, the duplicate removed', async () => {
    const google = fakeGoogle(); const links = fakeLinks();
    const ev = (taskId: string) => ({ summary: `📋 Task ${taskId}`, start: { date: '2026-12-01' }, end: { date: '2026-12-02' }, colorId: '5', private: { [MARK_TASK]: taskId, [MARK_USER]: U } });
    google.events.set('e1', ev('a')); google.events.set('e2', ev('a')); google.events.set('e3', ev('b'));
    const r = await syncUser([task('a'), task('b')], U, google, links, noPause);
    expect(google.calls.filter((x) => x === 'insert')).toEqual([]);
    expect(r).toMatchObject({ created: 0, updated: 2, deleted: 1, failed: 0 });
    expect([...google.events.keys()].sort()).toEqual(['e1', 'e3']);
    expect(links.rows.get('a')?.external_event_id).toBe('e1');
  });
  it('Fix duplicates: keeps the linked event (else the oldest), deletes the rest, links the kept one', async () => {
    const { repairDuplicates } = await import('../../supabase/functions/google-calendar-sync/sync');
    const google = fakeGoogle(); const links = fakeLinks();
    const ev = (taskId: string) => ({ summary: 'x', start: { date: '2026-12-01' }, end: { date: '2026-12-02' }, colorId: '5', private: { [MARK_TASK]: taskId, [MARK_USER]: U } });
    google.events.set('a1', ev('a')); google.events.set('a2', ev('a')); google.events.set('a3', ev('a'));
    google.events.set('b1', ev('b')); google.events.set('b2', ev('b'));
    google.events.set('c1', ev('c'));
    links.rows.set('a', { task_id: 'a', external_event_id: 'a2', content_hash: 'h' });
    const created: Record<string, string> = { b1: '2026-11-26T10:00:05Z', b2: '2026-11-26T10:00:01Z' };
    const realList = google.listMarked.bind(google);
    google.listMarked = async () => { const r = await realList(); return r.ok ? { ok: true, value: r.value.map((x) => ({ ...x, created: created[x.eventId] })) } : r; };
    expect(await repairDuplicates(google, links)).toEqual({ removed: 3, failed: 0, relinked: 1 });
    expect([...google.events.keys()].sort()).toEqual(['a2', 'b2', 'c1']);
    expect(links.rows.get('b')?.external_event_id).toBe('b2');
    expect(links.rows.get('a')?.external_event_id).toBe('a2');
  });
});
