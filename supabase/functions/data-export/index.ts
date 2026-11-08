// HMRC P7b (docs/hmrc-p7b/README.md). JWT required (supabase/config.toml); the checks are in _shared/data-rights.
// Nothing here logs a request body, a header, a token or a row.
import { dataExport } from '../_shared/data-rights/export.ts';
import { serveDataRights } from '../_shared/data-rights/serve.ts';

serveDataRights('data-export', dataExport);
