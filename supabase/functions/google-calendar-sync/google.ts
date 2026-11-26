// Google Calendar sync: the real Google Calendar API behind the GoogleApi interface (sync.ts). Every call goes to the
// person's primary calendar. A 401 refreshes the token once (the existing refresh path) and tries again; a 429 or 503
// waits briefly and tries up to twice more. No Deno imports (fetch and the token functions are passed in).
import { MARK_TASK, MARK_USER } from './plan.ts';
import { statusOf, type GoogleApi, type GoogleResult } from './sync.ts';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface GoogleDeps {
  token: string;
  refresh: () => Promise<string | null>;
  userId: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function googleApi(deps: GoogleDeps): GoogleApi {
  let token = deps.token;
  // One refresh shared by every call in flight (up to 5 at once): a 401 waits for it, then retries with the new token.
  let refreshing: Promise<string | null> | null = null;
  const freshToken = (used: string): Promise<string | null> => {
    if (token !== used) return Promise.resolve(token);
    if (!refreshing) refreshing = deps.refresh().then((t) => { if (t) token = t; return t; });
    return refreshing;
  };
  const fetchFn = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  async function call(method: string, url: string, body?: unknown): Promise<GoogleResult<Record<string, unknown> | null>> {
    let retriedAuth = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      let res: Response;
      const used = token;
      try {
        res = await fetchFn(url, {
          method,
          headers: { Authorization: `Bearer ${used}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        return { ok: false, status: 0 };
      }
      if (res.status === 401 && !retriedAuth) {
        retriedAuth = true;
        await res.body?.cancel();
        const next = await freshToken(used);
        if (!next) return { ok: false, status: 401 };
        continue;
      }
      if ((res.status === 429 || res.status === 503) && attempt < 2) {
        const after = Number(res.headers.get('retry-after'));
        await res.body?.cancel();
        await sleep(Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * (attempt + 1), 5000));
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return { ok: false, status: res.status };
      }
      if (res.status === 204) return { ok: true, value: null };
      const json = await res.json().catch(() => null);
      return { ok: true, value: json as Record<string, unknown> | null };
    }
    return { ok: false, status: 429 };
  }

  const marker = (k: string, v: string) => `privateExtendedProperty=${encodeURIComponent(`${k}=${v}`)}`;

  async function listIds(query: string): Promise<GoogleResult<{ eventId: string; taskId: string }[]>> {
    const out: { eventId: string; taskId: string }[] = [];
    let page: string | undefined;
    for (let i = 0; i < 20; i++) {
      const r = await call('GET', `${BASE}?${query}&maxResults=2500&showDeleted=false${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      if (!r.ok) return { ok: false, status: statusOf(r) };
      const items = (r.value?.items ?? []) as { id?: string; status?: string; extendedProperties?: { private?: Record<string, string> } }[];
      for (const e of items) {
        const taskId = e.extendedProperties?.private?.[MARK_TASK];
        if (e.id && taskId && e.status !== 'cancelled') out.push({ eventId: e.id, taskId });
      }
      page = r.value?.nextPageToken as string | undefined;
      if (!page) break;
    }
    return { ok: true, value: out };
  }

  return {
    async insert(event) {
      const r = await call('POST', BASE, event);
      if (!r.ok) return { ok: false, status: statusOf(r) };
      const id = r.value?.id;
      return typeof id === 'string' ? { ok: true, value: id } : { ok: false, status: 0 };
    },
    async patch(eventId, event) {
      const r = await call('PATCH', `${BASE}/${encodeURIComponent(eventId)}`, event);
      return r.ok ? { ok: true, value: null } : { ok: false, status: statusOf(r) };
    },
    async remove(eventId) {
      const r = await call('DELETE', `${BASE}/${encodeURIComponent(eventId)}?sendUpdates=none`);
      return r.ok ? { ok: true, value: null } : { ok: false, status: statusOf(r) };
    },
    async findByTask(taskId) {
      const r = await listIds(`${marker(MARK_USER, deps.userId)}&${marker(MARK_TASK, taskId)}`);
      return r.ok ? { ok: true, value: r.value.map((x) => x.eventId) } : { ok: false, status: statusOf(r) };
    },
    listMarked: () => listIds(marker(MARK_USER, deps.userId)),
  };
}
