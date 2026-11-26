// Google Calendar tokens (supabase/functions/google-calendar-sync/tokens.ts): read with get_integration_tokens, refreshed
// with B2BNEST's Google app, written back with store_integration_tokens; a rejected refresh token asks for reconnection.
import { describe, expect, it, vi } from 'vitest';
import { EXPIRY_MARGIN_MS, googleAccess, mergeMetadata, refreshOutcome, tokenPlan, type StoredTokens, type TokenDeps } from '../../supabase/functions/google-calendar-sync/tokens';

const NOW = Date.parse('2026-11-26T10:00:00Z');
const later = (ms: number) => new Date(NOW + ms).toISOString();

describe('tokenPlan', () => {
  it('no row (not connected, or is_connected false): not connected', () => {
    expect(tokenPlan(null, NOW)).toEqual({ kind: 'not_connected' });
    expect(tokenPlan({ access_token: null, refresh_token: null, expires_at: null }, NOW)).toEqual({ kind: 'not_connected' });
  });
  it('a token valid for more than a minute: use it; no expiry stored: use it', () => {
    expect(tokenPlan({ access_token: 'a', refresh_token: 'r', expires_at: later(10 * 60_000) }, NOW)).toEqual({ kind: 'use', accessToken: 'a' });
    expect(tokenPlan({ access_token: 'a', refresh_token: null, expires_at: null }, NOW)).toEqual({ kind: 'use', accessToken: 'a' });
  });
  it('expired, or expiring within the margin: refresh; with no refresh token: reconnect', () => {
    expect(tokenPlan({ access_token: 'a', refresh_token: 'r', expires_at: later(EXPIRY_MARGIN_MS - 1) }, NOW)).toEqual({ kind: 'refresh', refreshToken: 'r' });
    expect(tokenPlan({ access_token: 'a', refresh_token: 'r', expires_at: later(-1) }, NOW)).toEqual({ kind: 'refresh', refreshToken: 'r' });
    expect(tokenPlan({ access_token: 'a', refresh_token: null, expires_at: later(-1) }, NOW)).toEqual({ kind: 'reconnect' });
  });
});

describe('refreshOutcome', () => {
  it('a new access token, its expiry, and a new refresh token only when Google sends one', () => {
    expect(refreshOutcome(200, { access_token: 'n', expires_in: 3599, scope: 'https://www.googleapis.com/auth/calendar.events' }, NOW))
      .toEqual({ kind: 'ok', accessToken: 'n', expiresAt: later(3599_000), refreshToken: null, scope: 'https://www.googleapis.com/auth/calendar.events' });
    expect(refreshOutcome(200, { access_token: 'n', refresh_token: 'r2' }, NOW)).toMatchObject({ refreshToken: 'r2', expiresAt: null });
  });
  it('invalid_grant (revoked, expired) and unauthorized_client (issued to another client): reconnect', () => {
    expect(refreshOutcome(400, { error: 'invalid_grant' }, NOW)).toEqual({ kind: 'reconnect', error: 'invalid_grant' });
    expect(refreshOutcome(401, { error: 'unauthorized_client' }, NOW)).toEqual({ kind: 'reconnect', error: 'unauthorized_client' });
  });
  it('our own misconfiguration or an outage never disconnects anyone', () => {
    expect(refreshOutcome(401, { error: 'invalid_client' }, NOW)).toEqual({ kind: 'failed', error: 'invalid_client' });
    expect(refreshOutcome(503, null, NOW)).toEqual({ kind: 'failed', error: 'http_503' });
    expect(refreshOutcome(0, null, NOW).kind).toBe('failed');
  });
});

describe('mergeMetadata', () => {
  it('keeps email, name, picture and scope; drops client credentials from the old flow; updates the scope', () => {
    expect(mergeMetadata({ email: 'p@example.test', name: 'P', picture: 'x', scope: 'old', client_id: 'cid', client_secret: 's' }, { scope: 'new' }))
      .toEqual({ email: 'p@example.test', name: 'P', picture: 'x', scope: 'new' });
    expect(mergeMetadata('{"email":"p@example.test"}')).toEqual({ email: 'p@example.test' });
    expect(mergeMetadata(null)).toEqual({});
    expect(mergeMetadata('not json')).toEqual({});
  });
});

/** Fakes for the database and Google's token endpoint. */
function deps(row: StoredTokens | null, google: { status: number; body: Record<string, unknown> | null }, o: Partial<TokenDeps> = {}) {
  const stored: Parameters<TokenDeps['storeTokens']>[1][] = [];
  const disconnected: string[] = [];
  const posts: URLSearchParams[] = [];
  const d: TokenDeps = {
    readTokens: async () => row,
    readMetadata: async () => ({ email: 'p@example.test', name: 'P', scope: 'old', client_id: 'their-own-client' }),
    storeTokens: async (_u, t) => { stored.push(t); return true; },
    markDisconnected: async (u) => { disconnected.push(u); },
    fetchFn: (async (_url: string, init: RequestInit) => {
      posts.push(init.body as URLSearchParams);
      return new Response(JSON.stringify(google.body), { status: google.status });
    }) as unknown as typeof fetch,
    clientId: 'platform-id', clientSecret: 'platform-secret', now: () => NOW,
    ...o,
  };
  return { d, stored, disconnected, posts };
}
const expired: StoredTokens = { access_token: 'old', refresh_token: 'r1', expires_at: later(-60_000) };

describe('googleAccess', () => {
  it('a valid token is used as it is: no refresh, nothing written', async () => {
    const f = deps({ access_token: 'a', refresh_token: 'r1', expires_at: later(3_600_000) }, { status: 500, body: null });
    const a = await googleAccess('u1', f.d);
    expect(a).toMatchObject({ ok: true, token: 'a' });
    expect(f.posts).toEqual([]);
    expect(f.stored).toEqual([]);
  });
  it('expired: refreshed with B2BNEST’s Google app, written back keeping the old refresh token and the metadata (without client_id)', async () => {
    const f = deps(expired, { status: 200, body: { access_token: 'new', expires_in: 3599, scope: 'https://www.googleapis.com/auth/calendar.events' } });
    const a = await googleAccess('u1', f.d);
    expect(a).toMatchObject({ ok: true, token: 'new' });
    expect(Object.fromEntries(f.posts[0])).toEqual({ client_id: 'platform-id', client_secret: 'platform-secret', refresh_token: 'r1', grant_type: 'refresh_token' });
    expect(f.stored).toEqual([{ accessToken: 'new', refreshToken: 'r1', expiresAt: later(3599_000),
      metadata: { email: 'p@example.test', name: 'P', scope: 'https://www.googleapis.com/auth/calendar.events' } }]);
    expect(f.disconnected).toEqual([]);
  });
  it('invalid_grant: marked not connected, and the answer is "reconnect"', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = deps(expired, { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } });
    expect(await googleAccess('u1', f.d)).toEqual({ ok: false, reason: 'reconnect' });
    expect(f.disconnected).toEqual(['u1']);
    expect(f.stored).toEqual([]);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('r1');
    warn.mockRestore();
  });
  it('a connection made earlier with the person’s own Client ID (unauthorized_client): reconnect', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = deps(expired, { status: 401, body: { error: 'unauthorized_client' } });
    expect(await googleAccess('u1', f.d)).toEqual({ ok: false, reason: 'reconnect' });
    expect(f.disconnected).toEqual(['u1']);
    warn.mockRestore();
  });
  it('invalid_client (our secret is wrong) or GOOGLE_CLIENT_ID unset: failed, nobody is disconnected', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = deps(expired, { status: 401, body: { error: 'invalid_client' } });
    expect(await googleAccess('u1', a.d)).toEqual({ ok: false, reason: 'failed' });
    expect(a.disconnected).toEqual([]);
    const b = deps(expired, { status: 200, body: { access_token: 'x' } }, { clientId: undefined });
    expect(await googleAccess('u1', b.d)).toEqual({ ok: false, reason: 'failed' });
    expect(b.posts).toEqual([]);
    err.mockRestore();
  });
  it('expired with no refresh token: reconnect (marked not connected)', async () => {
    const f = deps({ access_token: 'a', refresh_token: null, expires_at: later(-1) }, { status: 500, body: null });
    expect(await googleAccess('u1', f.d)).toEqual({ ok: false, reason: 'reconnect' });
    expect(f.disconnected).toEqual(['u1']);
  });
  it('not connected (no row from get_integration_tokens): nothing is called or written', async () => {
    const f = deps(null, { status: 500, body: null });
    expect(await googleAccess('u1', f.d)).toEqual({ ok: false, reason: 'not_connected' });
    expect(f.posts).toEqual([]);
    expect(f.disconnected).toEqual([]);
  });
  it('a 401 during the sync refreshes once; if Google then rejects the refresh token, needsReconnect() says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = deps({ access_token: 'a', refresh_token: 'r1', expires_at: later(3_600_000) }, { status: 400, body: { error: 'invalid_grant' } });
    const a = await googleAccess('u1', f.d);
    if (!a.ok) throw new Error('expected access');
    expect(a.needsReconnect()).toBe(false);
    expect(await a.refresh()).toBeNull();
    expect(a.needsReconnect()).toBe(true);
    expect(await a.refresh()).toBeNull();
    expect(f.posts).toHaveLength(1);
    expect(f.disconnected).toEqual(['u1']);
    warn.mockRestore();
  });
});
