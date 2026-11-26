// Google Calendar sync: the person's Google tokens. Read with get_integration_tokens and written back with
// store_integration_tokens (the database functions every other server function uses; the service role passes their
// person check). Refreshed with B2BNEST's own Google app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). When Google says
// the refresh token is no longer good (invalid_grant, or unauthorized_client for a token issued to another client, as
// for people who connected earlier with their own Client ID), the connection is marked not connected and the person
// is asked to reconnect. No Deno imports: the database and fetch are passed in (Vitest: src/test/googleCalendarTokens.test.ts).

export interface StoredTokens { access_token: string | null; refresh_token: string | null; expires_at: string | null }

/** Refresh this long before Google's expiry, so a call never starts with a token about to lapse. */
export const EXPIRY_MARGIN_MS = 60_000;

export type TokenPlan =
  | { kind: 'not_connected' }
  | { kind: 'use'; accessToken: string }
  | { kind: 'refresh'; refreshToken: string }
  | { kind: 'reconnect' };

/** What to do with the stored tokens (null: no connected row). */
export function tokenPlan(row: StoredTokens | null, now: number): TokenPlan {
  if (!row || (!row.access_token && !row.refresh_token)) return { kind: 'not_connected' };
  const expired = !row.access_token || (!!row.expires_at && Date.parse(row.expires_at) - EXPIRY_MARGIN_MS <= now);
  if (!expired) return { kind: 'use', accessToken: row.access_token as string };
  return row.refresh_token ? { kind: 'refresh', refreshToken: row.refresh_token } : { kind: 'reconnect' };
}

export type RefreshOutcome =
  | { kind: 'ok'; accessToken: string; expiresAt: string | null; refreshToken: string | null; scope: string | null }
  | { kind: 'reconnect'; error: string }
  | { kind: 'failed'; error: string };

/** Google's answer to a refresh. Only a refresh token Google rejects means "reconnect"; our own misconfiguration
 *  (invalid_client: wrong GOOGLE_CLIENT_SECRET) or an outage never disconnects anyone. */
export function refreshOutcome(status: number, body: Record<string, unknown> | null, now: number): RefreshOutcome {
  const token = body?.access_token;
  if (status >= 200 && status < 300 && typeof token === 'string' && token) {
    const secs = Number(body?.expires_in);
    return {
      kind: 'ok', accessToken: token,
      expiresAt: Number.isFinite(secs) && secs > 0 ? new Date(now + secs * 1000).toISOString() : null,
      refreshToken: typeof body?.refresh_token === 'string' && body.refresh_token ? body.refresh_token : null,
      scope: typeof body?.scope === 'string' ? body.scope : null,
    };
  }
  const error = typeof body?.error === 'string' ? body.error : `http_${status}`;
  if (error === 'invalid_grant' || error === 'unauthorized_client') return { kind: 'reconnect', error };
  return { kind: 'failed', error };
}

/** Keep what the card shows (email, name, picture, scope); never keep client credentials (the old flow stored client_id). */
export function mergeMetadata(existing: unknown, patch: Record<string, unknown> = {}): Record<string, unknown> {
  const base = (typeof existing === 'string' ? safeJson(existing) : existing) as Record<string, unknown> | null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries({ ...(base ?? {}), ...patch })) {
    if (/^client_(id|secret)$|^app_(id|secret)$/.test(k) || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}
const safeJson = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

export interface TokenDeps {
  readTokens(userId: string): Promise<StoredTokens | null>;
  readMetadata(userId: string): Promise<unknown>;
  storeTokens(userId: string, t: { accessToken: string; refreshToken: string; expiresAt: string | null; metadata: Record<string, unknown> }): Promise<boolean>;
  markDisconnected(userId: string): Promise<void>;
  fetchFn: typeof fetch;
  clientId: string | undefined;
  clientSecret: string | undefined;
  now?: () => number;
}

export type Access =
  | { ok: true; token: string; refresh: () => Promise<string | null>; needsReconnect: () => boolean }
  | { ok: false; reason: 'not_connected' | 'reconnect' | 'failed' };

/**
 * A usable access token for one person, refreshing it first when it has expired. refresh() is for a 401 during the
 * sync (at most once per run, by the Google client); needsReconnect() tells afterwards whether Google rejected the
 * refresh token meanwhile (the connection is then already marked not connected).
 */
export async function googleAccess(userId: string, deps: TokenDeps): Promise<Access> {
  const now = deps.now ?? Date.now;
  const row = await deps.readTokens(userId);
  let refreshToken = row?.refresh_token ?? null;
  let reconnect = false;

  const doRefresh = async (): Promise<string | null> => {
    if (!refreshToken) { reconnect = true; await deps.markDisconnected(userId); return null; }
    if (!deps.clientId || !deps.clientSecret) {
      console.error('google-calendar-sync: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set; cannot refresh');
      return null;
    }
    let status = 0; let body: Record<string, unknown> | null = null;
    try {
      const res = await deps.fetchFn('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: deps.clientId, client_secret: deps.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } catch {
      status = 0;
    }
    const out = refreshOutcome(status, body, now());
    if (out.kind === 'reconnect') {
      // Logged without any token: only Google's error code.
      console.warn(`google-calendar-sync: Google refused the refresh (${out.error}); marking Google Calendar as needing reconnection`);
      reconnect = true;
      await deps.markDisconnected(userId);
      return null;
    }
    if (out.kind === 'failed') {
      console.error(`google-calendar-sync: token refresh failed (${out.error})`);
      return null;
    }
    // Keep the old refresh token when Google sends none (store_integration_tokens would otherwise clear it).
    const keep = out.refreshToken ?? refreshToken;
    const metadata = mergeMetadata(await deps.readMetadata(userId), out.scope ? { scope: out.scope } : {});
    const saved = await deps.storeTokens(userId, { accessToken: out.accessToken, refreshToken: keep, expiresAt: out.expiresAt, metadata });
    if (!saved) console.error('google-calendar-sync: refreshed token not saved (used for this run only)');
    refreshToken = keep;
    return out.accessToken;
  };

  const plan = tokenPlan(row, now());
  if (plan.kind === 'not_connected') return { ok: false, reason: 'not_connected' };
  if (plan.kind === 'reconnect') { await deps.markDisconnected(userId); return { ok: false, reason: 'reconnect' }; }
  let token: string | null = plan.kind === 'use' ? plan.accessToken : await doRefresh();
  if (!token) return { ok: false, reason: reconnect ? 'reconnect' : 'failed' };
  let refreshedOnce = plan.kind === 'refresh';
  return {
    ok: true,
    token,
    refresh: async () => {
      if (refreshedOnce) return null;
      refreshedOnce = true;
      token = await doRefresh();
      return token;
    },
    needsReconnect: () => reconnect,
  };
}
