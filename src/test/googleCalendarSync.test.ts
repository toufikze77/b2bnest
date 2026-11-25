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
  it('429: waits and retries (at most twice), then succeeds', async () => {
    let n = 0; const waits: number[] = [];
    const fetchFn = (async () => (++n < 3 ? new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } }) : ok({}))) as unknown as typeof fetch;
    const g = googleApi({ token: 't', userId: U, refresh: async () => null, fetchFn, sleep: async (ms) => { waits.push(ms); } });
    expect((await g.patch('evt1', buildEvent(task('a'), U))).ok).toBe(true);
    expect(waits).toEqual([1000, 1000]);
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
