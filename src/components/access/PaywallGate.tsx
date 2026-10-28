import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/hooks/useAccess';
import { isPaywallExempt, isSuspendedExempt, type Access } from '@/lib/access';
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

export const SUSPENDED_TITLE = 'Your account has been suspended';
export const SUSPENDED_TEXT = "You can't use B2BNEST while your account is suspended. If you think this is a mistake, contact us.";

/** Phase 12c: shown to a suspended account. No plans, no payment buttons, no way round it but Contact. */
export function SuspendedScreen() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <section aria-labelledby="suspended-title" className="min-h-screen bg-background px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <h1 id="suspended-title" className="text-3xl font-bold text-brand-navy dark:text-foreground sm:text-4xl">{SUSPENDED_TITLE}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{SUSPENDED_TEXT}</p>
        <p className="mt-3 text-base text-foreground">Nothing has been deleted.</p>
        <nav aria-label="Help" className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild><Link to="/contact">Contact us</Link></Button>
          <Button asChild variant="outline"><Link to="/help">Help</Link></Button>
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</Button>
        </nav>
      </div>
    </section>
  );
}

/**
 * Wraps the signed-in app. Blocks when the server says the trial has ended (paywall, exempt routes as in Phase 12) or
 * the account is suspended (narrower exempt list, see isSuspendedExempt). Never blocks while loading.
 */
export default function PaywallGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const access = useAccess();
  if (!user || access.loading) return <>{children}</>;
  if (access.suspended) return isSuspendedExempt(pathname) ? <>{children}</> : <SuspendedScreen />;
  if (isPaywallExempt(pathname) || !access.trialEnded) return <>{children}</>;
  return <TrialEndedScreen access={access} />;
}
