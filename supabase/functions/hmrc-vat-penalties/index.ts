// HMRC P8 (docs/hmrc-p8/README.md): reads the late submission and late payment penalties HMRC shows. Sandbox only, GET to HMRC only, nothing
// stored. JWT required (supabase/config.toml); the checks are in _shared/hmrc/vatReads.ts.
import { serveVatRead } from '../_shared/hmrc/readServe.ts';
import { vatPenalties } from '../_shared/hmrc/vatReads.ts';

serveVatRead('hmrc-vat-penalties', vatPenalties);
