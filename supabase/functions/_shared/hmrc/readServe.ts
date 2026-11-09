// HMRC P8: the HTTP wrapper for the four read functions (hmrc-vat-return-view, -liabilities, -payments, -penalties).
// JWT required (supabase/config.toml); the demo guard refuses demo people first; POST only. Nothing here logs a
// request body, a header or an HMRC response. HMRC P7d: CORS narrowed to the allowed origins (serveHmrcRequest).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { HandlerResult } from './errors.ts';
import { realDeps, serveHmrcRequest } from './serve.ts';
import { type ReadDeps, supabaseReadStore } from './vatReads.ts';

export function serveVatRead(name: string, handler: (req: { authHeader: string | null; headers: Headers; body: Record<string, unknown> }, deps: ReadDeps) => Promise<HandlerResult>) {
  serveHmrcRequest(name, (req, body) => {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const deps: ReadDeps = {
      ...realDeps(name),
      sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
      reads: supabaseReadStore(admin as unknown as Parameters<typeof supabaseReadStore>[0]),
    };
    return handler({ authHeader: req.headers.get('Authorization'), headers: req.headers, body }, deps);
  });
}
