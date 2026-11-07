import { Badge } from '@/components/ui/badge';
import { VAT_NOT_RECORDED } from '@/lib/vat';

/** HMRC P4: a record without its VAT breakdown (left out of VAT figures until fixed). */
export function VatNotRecordedBadge() {
  return <Badge variant="outline" className="whitespace-nowrap border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50" data-testid="vat-not-recorded">{VAT_NOT_RECORDED}</Badge>;
}
/** HMRC P4: an invoice not in GBP (kept as entered; left out of a VAT return until a GBP conversion exists). */
export function NotGbpBadge({ currency }: { currency?: string | null }) {
  return <Badge variant="outline" className="whitespace-nowrap" title="Left out of VAT returns until currency conversion exists" data-testid="not-gbp">Not GBP{currency ? ` (${currency.toUpperCase()})` : ''}</Badge>;
}
