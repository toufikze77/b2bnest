import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

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
  const { subscribed, subscription_tier, subscription_end, loading } = useSubscription();
  const [opening, setOpening] = useState(false);
  const [pending, setPending] = useState<PendingDowngrade | null>(null);
  const [keeping, setKeeping] = useState(false);

  const loadPending = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('change-subscription-plan', { body: { mode: 'status' } });
    setPending(!error && data?.pendingDowngrade ? (data.pendingDowngrade as PendingDowngrade) : null);
  }, []);

  useEffect(() => {
    if (subscribed) void loadPending();
  }, [subscribed, loadPending]);

  const keepCurrentPlan = async () => {
    setKeeping(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-subscription-plan', {
        body: { mode: 'cancel_downgrade', requestId: crypto.randomUUID() },
      });
      if (error || !data?.ok) throw new Error('The scheduled change could not be cancelled. Please try again.');
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
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('Could not open the billing portal');
    } catch (err: unknown) {
      toast({
        title: 'Billing portal unavailable',
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
            <Badge variant={subscribed ? 'default' : 'secondary'}>
              {subscribed ? subscription_tier : 'Free'}
            </Badge>
          )}
        </div>

        {subscribed && subscription_end && (
          <p className="text-sm text-muted-foreground">
            {pending ? 'Current period ends on' : 'Renews on'} {new Date(subscription_end).toLocaleDateString('en-GB')}
          </p>
        )}

        {pending && <PendingPlanChange pending={pending} busy={keeping} onKeep={keepCurrentPlan} />}

        <div className="flex flex-wrap gap-3">
          <Button onClick={openPortal} disabled={opening}>
            {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage billing
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/pricing')}>
            {subscribed ? 'Change plan' : 'View plans'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Payments, invoices and cancellations are handled securely by Stripe. Downgrades and cancellations take effect at the end of your paid period.
        </p>
      </CardContent>
    </Card>
  );
};

export default BillingSettings;
