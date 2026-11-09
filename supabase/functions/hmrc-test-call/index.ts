// HMRC P1 + P2 (docs/hmrc-p1-p2/README.md). JWT required (supabase/config.toml); the checks are in
// _shared/hmrc/testCall.ts. Nothing here logs a request body, a header or an HMRC response.
// HMRC P7d: CORS narrowed to the allowed origins; demo people get 403 first (serveHmrcRequest).
import { realDeps, serveHmrcRequest } from '../_shared/hmrc/serve.ts';
import { testCall } from '../_shared/hmrc/testCall.ts';

serveHmrcRequest('hmrc-test-call', (req, body) => {
  const deps = { ...realDeps('hmrc-test-call'), sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) };
  return testCall({ authHeader: req.headers.get('Authorization'), headers: req.headers, body }, deps);
});
