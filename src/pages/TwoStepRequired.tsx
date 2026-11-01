import { Link, useSearchParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TwoStepSetup from '@/components/twoStep/TwoStepSetup';
import { useAssurance } from '@/hooks/useAssurance';
import { safeReturnPath } from '@/lib/onboarding';

/**
 * Phase 25: super admins must use two-step sign-in for the Admin area. Without an authenticator app they land here
 * from /admin/*; everything else in the app keeps working for them.
 */
export default function TwoStepRequired() {
  const [params] = useSearchParams();
  const { verified } = useAssurance();
  const next = safeReturnPath(params.get('next') ?? '/admin');
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10" data-testid="two-step-required">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Set up two-step sign-in to use Admin</h1>
          <p className="mt-1 text-muted-foreground">
            Admin can see every company's data, so it needs a 6-digit code from your phone as well as your password. It takes
            about two minutes. The rest of B2BNEST keeps working as before.
          </p>
        </div>
      </div>
      <TwoStepSetup />
      <div className="flex flex-wrap gap-2">
        {verified.length > 0
          ? <Button asChild><Link to={next}>Continue to Admin</Link></Button>
          : <Button asChild variant="outline"><Link to="/dashboard">Back to the dashboard</Link></Button>}
      </div>
    </main>
  );
}
