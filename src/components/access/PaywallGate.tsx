import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/hooks/useAccess';
import { isPaywallExempt, type Access } from '@/lib/access';
import PricingPlans from '@/components/PricingPlans';
import { Button } from '@/components/ui/button';

// Verified 27 Oct 2026: nothing deletes data when a trial ends or a subscription is cancelled (no cron job, database
// function or Edge Function removes user data on expiry; the only cron job sends due-date notifications).
export const NOTHING_DELETED = 'Nothing has been deleted. Your information is waiting for you when you subscribe.';
export const NOTHING_DELETED_MEMBER = 'Nothing has been deleted. Your information is waiting for you when your company subscribes.';

/** The full-page "trial has ended" screen. Owners choose a plan; members of someone else's company are told who decides. */
export function TrialEndedScreen({ access }: { access: Access }) {
  const member = access.via === 'company';
  return (
    <section aria-labelledby="trial-ended-title" className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 id="trial-ended-title" className="text-3xl font-bold text-brand-navy dark:text-foreground sm:text-4xl">
            {member ? "Your company's trial has ended" : 'Your 14-day trial has ended'}
          </h1>
          {member ? (
            <p className="mt-4 text-lg text-muted-foreground">
              Ask {access.ownerName ?? 'the account owner'} to choose a plan. You'll have access again as soon as they subscribe.
            </p>
          ) : (
            <p className="mt-4 text-lg text-muted-foreground">Choose a plan to keep using B2BNEST.</p>
          )}
          <p className="mt-3 text-base text-foreground">{member ? NOTHING_DELETED_MEMBER : NOTHING_DELETED}</p>
        </div>

        {!member && <div className="mt-8"><PricingPlans variant="paywall" /></div>}

        <nav aria-label="Account and help" className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline"><Link to="/settings?tab=billing">Settings: billing</Link></Button>
          <Button asChild variant="outline"><Link to="/contact">Contact us</Link></Button>
          <Button asChild variant="ghost"><Link to="/pricing">Compare plans</Link></Button>
        </nav>
      </div>
    </section>
  );
}

/** Wraps the signed-in app. Blocks only when the server says the trial has ended, and never on an exempt route. */
export default function PaywallGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const access = useAccess();
  if (!user || isPaywallExempt(pathname) || access.loading || !access.trialEnded) return <>{children}</>;
  return <TrialEndedScreen access={access} />;
}
