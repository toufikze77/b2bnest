// HMRC P8 (docs/hmrc-p8/README.md): reads the company's VAT liabilities for a date range. Sandbox only, GET to HMRC only, nothing
// stored. JWT required (supabase/config.toml); the checks are in _shared/hmrc/vatReads.ts.
import { serveVatRead } from '../_shared/hmrc/readServe.ts';
import { vatLiabilities } from '../_shared/hmrc/vatReads.ts';

serveVatRead('hmrc-vat-liabilities', vatLiabilities);
