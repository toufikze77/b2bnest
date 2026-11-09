// HMRC P8 (docs/hmrc-p8/README.md): compares the nine boxes HMRC holds for a period with our stored copy (no write). Sandbox only, GET to HMRC only, nothing
// stored. JWT required (supabase/config.toml); the checks are in _shared/hmrc/vatReads.ts.
import { serveVatRead } from '../_shared/hmrc/readServe.ts';
import { vatReturnView } from '../_shared/hmrc/vatReads.ts';

serveVatRead('hmrc-vat-return-view', vatReturnView);
