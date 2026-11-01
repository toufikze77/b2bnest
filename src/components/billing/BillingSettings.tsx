import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import { useBillingStatus, poundsText } from '@/hooks/useBillingStatus';
import { planNameForTier, limitText, SEAT_LIMITS_NOTE } from '@/lib/plans';
import { useAccess } from '@/hooks/useAccess';
import AICreditsDisplay from '@/components/AICreditsDisplay';
import { CREDITS_USAGE_NOTE } from '@/lib/aiCredits';
import { trialBannerText } from '@/lib/access';
import { billingKind, NO_PAID_PLAN, PORTAL_UNAVAILABLE, TRIAL_ENDED_TEXT } from '@/lib/billingView';
import { functionErrorStatus, functionErrorText, isNoCustomer, NO_BILLING_ACCOUNT, readFunctionError } from '@/lib/billingErrors';



export interface PendingDowngrade {
  plan: string;
  interval: 'month' | 'year';
  price: number; // pence
  effectiveDate: string | null;
}

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'the end of your billing period';

export const PendingPlanChange = ({ pending, busy, onKeep }: { pending: PendingDowngrade; busy: boolean; onKeep: () => void }) => (
  <div role="status" className="rounded-md border border-border bg-muted/40 p-4 text-sm">
    <p className="flex items-center gap-2 font-medium text-foreground">
      <CalendarClock className="h-4 w-4 text-primary" /> Plan change scheduled
    </p>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted-foreground">
      <dt>New plan</dt><dd className="text-foreground">{pending.plan}</dd>
      <dt>Starts on</dt><dd className="text-foreground">{formatDate(pending.effectiveDate)}</dd>
      <dt>Next price</dt><dd className="text-foreground">£{(pending.price / 100).toFixed(2)} per {pending.interval}</dd>
    </dl>
    <p className="mt-2 text-xs text-muted-foreground">
      You keep your current plan until then. Nothing is charged now and there's no automatic refund or credit for unused time.
    </p>
    <Button className="mt-3" size="sm" variant="outline" onClick={onKeep} disabled={busy}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Keep current plan
    </Button>
  </div>
);

const BillingSettings = () => {
  const { subscribed: storedSubscribed, subscription_tier, subscription_end, loading: subLoading } = useSubscription();
  const access = useAccess();
  const navigate = useNavigate();
  const kind = billingKind(access, storedSubscribed);
  const subscribed = kind === 'paid';
  const loading = subLoading || access.loading;
  const trialLine = access.trialEnded ? TRIAL_ENDED_TEXT : trialBannerText(access);
  const [opening, setOpening] = useState(false);
  const [keeping, setKeeping] = useState(false);
  // Live from Stripe: the price this customer really pays (an earlier price is shown as it is), and any pending change.
  const { status, reload: loadPending } = useBillingStatus(subscribed);
  const pending: PendingDowngrade | null = status?.pendingDowngrade ?? null;

  const keepCurrentPlan = async () => {
    setKeeping(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-subscription-plan', {
        body: { mode: 'cancel_downgrade', requestId: crypto.randomUUID() },
      });
      if (error) throw new Error(functionErrorText(await readFunctionError(error), 'The scheduled change could not be cancelled. Please try again.'));
      if (!data?.ok) throw new Error('The scheduled change could not be cancelled. Please try again.');
      toast({ title: 'Plan change cancelled', description: 'Your current plan continues.' });
      await loadPending();
    } catch (err: unknown) {
      toast({ title: 'Not cancelled', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setKeeping(false);
    }
  };

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) {
        const body = await readFunctionError(error);
        if (isNoCustomer(functionErrorStatus(error), body)) {
          // Correct answer from the server: this account has never had a Stripe customer, so there is no portal.
          toast({
            title: 'No billing account yet',
            description: NO_BILLING_ACCOUNT,
            action: <ToastAction altText="View plans" onClick={() => navigate('/pricing')}>View plans</ToastAction>,
          });
          return;
        }
        throw new Error(functionErrorText(body, 'Please try again later.'));
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('Could not open the billing portal');
    } catch (err: unknown) {
      toast({
        title: PORTAL_UNAVAILABLE,
        description: err instanceof Error ? err.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing
        </CardTitle>
        <CardDescription>
          Manage your plan, payment method, invoices and cancellation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Current plan</span>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Badge variant={kind === 'none' ? 'secondary' : 'default'}>
              {kind === 'paid' ? (status?.currentPlan ?? planNameForTier(access.planKey ?? subscription_tier))
                : kind === 'company' ? `${planNameForTier(access.planKey)} (company plan)`
                : kind === 'owner' ? 'Full access' : 'No plan yet'}
            </Badge>
          )}
        </div>

        {subscribed && status?.currentPrice != null && status.currentInterval && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Your price: <span className="font-medium text-foreground">{poundsText(status.currentPrice)} per {status.currentInterval}</span>
              {status.currentLegacy && ' (an earlier price you keep while you stay on this plan and billing period)'}
            </p>
            {status.currentLimits && <p>Plan limits: {limitText({ users: status.currentLimits.members, admins: status.currentLimits.admins })}. {SEAT_LIMITS_NOTE}</p>}
          </div>
        )}

        {subscribed && subscription_end && (
          <p className="text-sm text-muted-foreground">
            {pending ? 'Current period ends on' : 'Renews on'} {new Date(subscription_end).toLocaleDateString('en-GB')}
          </p>
        )}

        {pending && <PendingPlanChange pending={pending} busy={keeping} onKeep={keepCurrentPlan} />}

        {!loading && kind === 'paid' && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={openPortal} disabled={opening}>
              {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Manage billing
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = '/pricing')}>
              Change plan
            </Button>
          </div>
        )}

        {!loading && kind === 'none' && (
          <div className="space-y-3" data-testid="billing-no-plan">
            {trialLine && <p className="text-sm font-medium text-foreground">{trialLine}</p>}
            <p className="text-sm text-muted-foreground">{NO_PAID_PLAN}</p>
            <Button asChild><Link to="/pricing">View plans</Link></Button>
          </div>
        )}

        {!loading && kind === 'company' && (
          <p className="text-sm text-muted-foreground" data-testid="billing-company">
            Your company's plan is paid by {access.ownerName ?? "its account owner"}. They manage billing and invoices.
          </p>
        )}

        {!loading && kind === 'owner' && (
          <p className="text-sm text-muted-foreground" data-testid="billing-owner">
            This account has full access without a plan, so there is nothing to pay.
          </p>
        )}

        {/* Phase 30c: the AI credit balance (get_ai_credits_info). */}
        <AICreditsDisplay note={CREDITS_USAGE_NOTE} />

        <p className="text-xs text-muted-foreground">
          Payments, invoices and cancellations are handled securely by Stripe. Downgrades and cancellations take effect at the end of your paid period.
        </p>
      </CardContent>
    </Card>
  );
};

export default BillingSettings;
