// Google Calendar sync: the real Google Calendar API behind the GoogleApi interface (sync.ts). Every call goes to the
// person's primary calendar.
// * 401: one token refresh shared by all calls in flight, then the call is tried again.
// * "Slow down" (429, 503, or 403 with a rate-limit reason): retried after 1, 2, 4, 8 s (+ jitter), or after Google's
//   Retry-After; any other 403 (for example insufficientPermissions) is final.
// * Write calls (insert, patch, delete) start at least GOOGLE_LIMITS.writeSpacingMs apart, shared by all workers.
// * Every final failure is logged in one line (kind, method, status, Google's reason; never a token, title or
//   description) and counted by reason for the sync result.
// No Deno imports (fetch, the clock and the token functions are passed in).
import { MARK_TASK, MARK_USER } from './plan.ts';
import { GOOGLE_LIMITS, RATE_LIMIT_REASONS } from './limits.ts';
import { reasonOf, statusOf, type GoogleApi, type GoogleResult } from './sync.ts';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface GoogleDeps {
  token: string;
  refresh: () => Promise<string | null>;
  userId: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  log?: (line: string) => void;
}

type Kind = 'insert' | 'patch' | 'remove' | 'list';

/** Google's reason for an error answer: error.errors[0].reason, else error.status, else http_<status>. */
export async function errorReason(res: Response): Promise<string> {
  const body = await res.json().catch(() => null) as { error?: { status?: string; errors?: { reason?: string }[] } } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status;
  return typeof reason === 'string' && /^[A-Za-z_]{1,60}$/.test(reason) ? reason : `http_${res.status}`;
}
export const isRateLimited = (status: number, reason: string) =>
  status === 429 || status === 503 || (status === 403 && RATE_LIMIT_REASONS.has(reason));

export interface FailureSummary { failures: Record<string, number>; firstError: string | null }

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
  const now = deps.now ?? Date.now;
  const random = deps.random ?? Math.random;
  const log = deps.log ?? ((line: string) => console.error(line));

  // Write calls start at least writeSpacingMs apart: each one reserves its start time before waiting.
  let nextWrite = 0;
  const writeSlot = async () => {
    const t = now();
    const start = Math.max(t, nextWrite);
    nextWrite = start + GOOGLE_LIMITS.writeSpacingMs;
    if (start > t) await sleep(start - t);
  };

  const failures: Record<string, number> = {};
  let firstError: string | null = null;
  const fail = (kind: Kind, method: string, status: number, reason: string): { ok: false; status: number; reason: string } => {
    // A patch or delete of an event that is no longer in Google is an expected outcome (handled by sync.ts), not a failure.
    if (!((kind === 'patch' || kind === 'remove') && (status === 404 || status === 410))) {
      log(`google-calendar-sync: ${kind} failed (${method} ${status} ${reason})`);
      failures[reason] = (failures[reason] ?? 0) + 1;
      firstError ??= reason;
    }
    return { ok: false, status, reason };
  };

  async function call(kind: Kind, method: string, url: string, body?: unknown): Promise<GoogleResult<Record<string, unknown> | null>> {
    let retriedAuth = false;
    let retries = 0;
    for (;;) {
      let res: Response;
      if (method !== 'GET') await writeSlot();
      const used = token;
      try {
        res = await fetchFn(url, {
          method,
          headers: { Authorization: `Bearer ${used}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        return fail(kind, method, 0, 'network');
      }
      if (res.status === 401 && !retriedAuth) {
        retriedAuth = true;
        await res.body?.cancel();
        const next = await freshToken(used);
        if (!next) return fail(kind, method, 401, 'authError');
        continue;
      }
      if (!res.ok) {
        const reason = await errorReason(res);
        if (isRateLimited(res.status, reason) && retries < GOOGLE_LIMITS.retryDelaysMs.length) {
          const after = Number(res.headers.get('retry-after'));
          const wait = Number.isFinite(after) && after > 0
            ? Math.min(after * 1000, GOOGLE_LIMITS.maxRetryAfterMs)
            : GOOGLE_LIMITS.retryDelaysMs[retries] + Math.floor(random() * GOOGLE_LIMITS.jitterMs);
          retries++;
          await sleep(wait);
          continue;
        }
        return fail(kind, method, res.status, reason);
      }
      if (res.status === 204) return { ok: true, value: null };
      const json = await res.json().catch(() => null);
      return { ok: true, value: json as Record<string, unknown> | null };
    }
  }

  const marker = (k: string, v: string) => `privateExtendedProperty=${encodeURIComponent(`${k}=${v}`)}`;

  async function listIds(query: string): Promise<GoogleResult<{ eventId: string; taskId: string; created?: string }[]>> {
    const out: { eventId: string; taskId: string; created?: string }[] = [];
    let page: string | undefined;
    for (let i = 0; i < 20; i++) {
      const r = await call('list', 'GET', `${BASE}?${query}&maxResults=2500&showDeleted=false${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
      if (!r.ok) return { ok: false, status: statusOf(r), reason: reasonOf(r) };
      const items = (r.value?.items ?? []) as { id?: string; status?: string; created?: string; extendedProperties?: { private?: Record<string, string> } }[];
      for (const e of items) {
        const taskId = e.extendedProperties?.private?.[MARK_TASK];
        if (e.id && taskId && e.status !== 'cancelled') out.push({ eventId: e.id, taskId, ...(e.created ? { created: e.created } : {}) });
      }
      page = r.value?.nextPageToken as string | undefined;
      if (!page) break;
    }
    return { ok: true, value: out };
  }

  return {
    async insert(event) {
      const r = await call('insert', 'POST', BASE, event);
      if (!r.ok) return { ok: false, status: statusOf(r), reason: reasonOf(r) };
      const id = r.value?.id;
      return typeof id === 'string' ? { ok: true, value: id } : fail('insert', 'POST', 0, 'noEventId');
    },
    async patch(eventId, event) {
      const r = await call('patch', 'PATCH', `${BASE}/${encodeURIComponent(eventId)}`, event);
      return r.ok ? { ok: true, value: null } : { ok: false, status: statusOf(r), reason: reasonOf(r) };
    },
    async remove(eventId) {
      const r = await call('remove', 'DELETE', `${BASE}/${encodeURIComponent(eventId)}?sendUpdates=none`);
      return r.ok ? { ok: true, value: null } : { ok: false, status: statusOf(r), reason: reasonOf(r) };
    },
    async findByTask(taskId) {
      const r = await listIds(`${marker(MARK_USER, deps.userId)}&${marker(MARK_TASK, taskId)}`);
      return r.ok ? { ok: true, value: r.value.map((x) => x.eventId) } : { ok: false, status: statusOf(r), reason: reasonOf(r) };
    },
    listMarked: () => listIds(marker(MARK_USER, deps.userId)),
    failureSummary: (): FailureSummary => ({ failures: { ...failures }, firstError }),
  };
}
