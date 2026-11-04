// HMRC P0 (docs/hmrc-p0/README.md). JWT required (supabase/config.toml); the checks are in _shared/hmrc/handlers.ts.
import { connectComplete } from '../_shared/hmrc/handlers.ts';
import { serveHmrc } from '../_shared/hmrc/serve.ts';

serveHmrc('hmrc-connect-complete', connectComplete);
