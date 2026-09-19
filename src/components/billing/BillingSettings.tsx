import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

const BillingSettings = () => {
  const { subscribed, subscription_tier, subscription_end, loading } = useSubscription();
  const [opening, setOpening] = useState(false);

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
    } catch (err: any) {
      toast({
        title: 'Billing portal unavailable',
        description: err?.message || 'Please try again later.',
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
            Renews on {new Date(subscription_end).toLocaleDateString()}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={openPortal} disabled={opening}>
            {opening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Manage billing
          </Button>
          {!subscribed && (
            <Button variant="outline" onClick={() => (window.location.href = '/pricing')}>
              View plans
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Payments, invoices and cancellations are handled securely by Stripe.
        </p>
      </CardContent>
    </Card>
  );
};

export default BillingSettings;
