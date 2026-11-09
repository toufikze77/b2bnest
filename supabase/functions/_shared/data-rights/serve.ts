// HMRC P7b: the real dependencies and the HTTP wrapper for data-export, account-delete and company-close.
// Nothing here logs a request body, a header, a token or a row.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsFor, preflight } from '../cors.ts';
import { guardedDenoServe } from '../demo-guard.ts';
import { isDemoReadonly } from '../demo-guard.ts';
import type { DrDeps, DrResult } from './core.ts';
import { fail } from './core.ts';

const URL_ = () => Deno.env.get('SUPABASE_URL') ?? '';

export function realDrDeps(name: string): DrDeps {
  const admin = createClient(URL_(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
  const asCaller = (jwt: string) => createClient(URL_(), Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const listDeep = async (bucket: string, prefix: string, depth = 0): Promise<string[]> => {
    const out: string[] = [];
    for (let offset = 0; offset < 10_000; offset += 1000) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
      if (error) throw new Error('list failed');
      for (const e of data ?? []) {
        const path = `${prefix}/${e.name}`;
        if (e.id === null && depth < 4) out.push(...await listDeep(bucket, path, depth + 1));
        else if (e.id !== null) out.push(path);
      }
      if ((data ?? []).length < 1000) break;
    }
    return out;
  };
  return {
    now: () => new Date(),
    log: (event, meta) => console.log(`[${name}] ${event}${meta ? ' ' + JSON.stringify(meta) : ''}`),
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data?.user ? null : { id: data.user.id, email: data.user.email ?? null };
    },
    async listFactors(userId) {
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
      if (error) throw new Error('listFactors failed');
      return (data?.factors ?? []) as { factor_type: string; status: string }[];
    },
    isDemo: (userId) => isDemoReadonly(userId),
    async rpc(fn, args) {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error: error ? { code: error.code, message: error.message } : null };
    },
    async read(as, jwt, table, select, filter, from, to) {
      const client = as === 'caller' ? asCaller(jwt) : admin;
      // deno-lint-ignore no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js's query builder type changes with every filter.
      let q: any = client.from(table).select(select);
      for (const [k, v] of filter.eq) q = q.eq(k, v);
      for (const k of filter.isNull ?? []) q = q.is(k, null);
      if (filter.inList) q = q.in(filter.inList[0], filter.inList[1]);
      const { data, error } = await q.range(from, to);
      return { rows: (data ?? []) as Record<string, unknown>[], error: error ? { code: error.code, message: error.message } : null };
    },
    storageList: (bucket, prefix) => listDeep(bucket, prefix),
    async storageSign(bucket, path, seconds) {
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, seconds);
      return error ? null : data?.signedUrl ?? null;
    },
    async storageRemove(bucket, paths) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      return !error;
    },
  };
}

const json = (req: Request, r: DrResult) => new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { ...corsFor(req), 'Content-Type': 'application/json' } });

/** The request handler the three data-rights functions share. HMRC P7d: CORS narrowed to the allowed origins. */
export function dataRightsHttp(name: string, handler: (req: { authHeader: string | null; body: Record<string, unknown> }, deps: DrDeps) => Promise<DrResult>,
  depsFor: (name: string) => DrDeps = realDrDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return preflight(req);
    if (req.method !== 'POST') return json(req, fail(405, 'bad_request'));
    try {
      const body = await req.json().catch(() => ({}));
      const r = await handler({ authHeader: req.headers.get('Authorization'), body: body && typeof body === 'object' ? body : {} }, depsFor(name));
      if (r.bytes) {
        return new Response(r.bytes, { status: r.status, headers: { ...corsFor(req), 'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${r.filename ?? 'b2bnest-data.zip'}"`, 'Access-Control-Expose-Headers': 'Content-Disposition', 'Cache-Control': 'no-store' } });
      }
      return json(req, r);
    } catch (e) {
      console.error(`[${name}] error ${e instanceof Error ? e.name : 'unknown'}`);
      return json(req, fail(500, 'server_error'));
    }
  };
}

export function serveDataRights(name: string, handler: (req: { authHeader: string | null; body: Record<string, unknown> }, deps: DrDeps) => Promise<DrResult>) {
  // Demo read-only: a demo person is refused (403) before anything runs (docs/demo-readonly); the handler checks again.
  guardedDenoServe(dataRightsHttp(name, handler), { headersFor: (req) => corsFor(req) });
}
