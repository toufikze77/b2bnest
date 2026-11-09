// HMRC P3 (docs/hmrc-p3/README.md). JWT required (supabase/config.toml); the checks are in
// _shared/hmrc/vatObligations.ts. Read only, sandbox only. Nothing here logs a request body, a header or an HMRC response.
// HMRC P7d: CORS narrowed to the allowed origins; demo people get 403 first (serveHmrcRequest).
import { realDeps, serveHmrcRequest } from '../_shared/hmrc/serve.ts';
import { vatObligations } from '../_shared/hmrc/vatObligations.ts';

serveHmrcRequest('hmrc-vat-obligations', (req, body) => {
  const deps = { ...realDeps('hmrc-vat-obligations'), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };
  return vatObligations({ authHeader: req.headers.get('Authorization'), headers: req.headers, body }, deps);
});
