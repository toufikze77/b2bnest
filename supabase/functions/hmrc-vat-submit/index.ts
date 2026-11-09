// HMRC P6 (docs/hmrc-p6/README.md). JWT required (supabase/config.toml); the checks are in _shared/hmrc/vatSubmit.ts.
// Sandbox only: production is refused by readConfig and there is no production path. Nothing here logs a request body,
// a header or an HMRC response. HMRC P7d: CORS narrowed to the allowed origins; demo people get 403 first.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { realDeps, serveHmrcRequest } from '../_shared/hmrc/serve.ts';
import { previewWithCallerJwt, supabaseSubmitStore } from '../_shared/hmrc/submitStore.ts';
import { vatSubmit } from '../_shared/hmrc/vatSubmit.ts';

const URL_ = Deno.env.get('SUPABASE_URL') ?? '';

serveHmrcRequest('hmrc-vat-submit', (req, body) => {
  const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
  const asCaller = (jwt: string) => createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const deps = {
    ...realDeps('hmrc-vat-submit'),
    sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    submissions: supabaseSubmitStore(admin as unknown as Parameters<typeof supabaseSubmitStore>[0]),
    preview: previewWithCallerJwt(asCaller as unknown as Parameters<typeof previewWithCallerJwt>[0]),
    newId: () => crypto.randomUUID(),
  };
  return vatSubmit({ authHeader: req.headers.get('Authorization'), headers: req.headers, body }, deps);
});
