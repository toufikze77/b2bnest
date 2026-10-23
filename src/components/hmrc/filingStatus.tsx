import { AlertTriangle, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * HMRC filing (VAT, tax returns, FPS/EPS) is not built: there is no call to an HMRC submission API anywhere in the app.
 * Every filing screen shows this banner, filing buttons stay disabled, and nothing is recorded as "submitted".
 */
export const HMRC_FILING_AVAILABLE = false;
export const HMRC_FILING_UNAVAILABLE = 'HMRC filing is not available yet. Nothing has been sent to HMRC.';
export const PREVIEW_ONLY = 'Preview only';
export const EXAMPLE_FIGURES = 'Example figures to show the layout. They are not your data and have not been sent anywhere.';
const BANNER_ID = 'hmrc-filing-unavailable';

export function HMRCFilingBanner() {
  return (
    <Alert role="note" id={BANNER_ID} className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{HMRC_FILING_UNAVAILABLE}</AlertTitle>
      <AlertDescription>{EXAMPLE_FIGURES} File with HMRC directly or through your accountant.</AlertDescription>
    </Alert>
  );
}

export function PreviewOnlyBadge() {
  return <Badge variant="outline" className="text-xs">{PREVIEW_ONLY}</Badge>;
}

/** The filing action, shown but disabled so people can see where it will be once it really exists. */
export function SubmitUnavailableButton() {
  return (
    <Button size="sm" disabled aria-describedby={BANNER_ID} title={HMRC_FILING_UNAVAILABLE}>
      <Upload className="mr-2 h-4 w-4" />
      Submit to HMRC (not available yet)
    </Button>
  );
}
