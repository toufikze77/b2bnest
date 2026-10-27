import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccess } from '@/hooks/useAccess';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end: string | null;
  trial_ends_at: string | null;
  loading: boolean;
  ai_credits_remaining: number;
  ai_credits_limit: number;
  ai_credits_reset_date: string | null;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const access = useAccess();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: 'free',
    subscription_end: null,
    trial_ends_at: null,
    loading: true,
    ai_credits_remaining: 0,
    ai_credits_limit: 0,
    ai_credits_reset_date: null
  });

  useEffect(() => {
    if (!user) {
      setSubscription({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_ends_at: null,
        loading: false,
        ai_credits_remaining: 0,
        ai_credits_limit: 0,
        ai_credits_reset_date: null
      });
      return;
    }

    const fetchSubscription = async () => {
      try {
        // Fetch subscription info
        const { data, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription:', error);
        }

        if (data) {
          setSubscription({
            subscribed: data.subscribed,
            subscription_tier: data.subscription_tier || 'free',
            subscription_end: data.subscription_end,
            trial_ends_at: null,
            loading: false,
            ai_credits_remaining: data.ai_credits_remaining || 0,
            ai_credits_limit: data.ai_credits_limit || 0,
            ai_credits_reset_date: data.ai_credits_reset_date || null
          });
        } else {
          // No subscriber record: entitlement records are created ONLY by the trusted
          // server-side billing flow (check-subscription / stripe-webhook, service role).
          // No record simply means "no subscription" (access still comes from my_access_state).
          supabase.functions.invoke('check-subscription').catch(() => {
            /* non-fatal: access is decided by my_access_state, not by this row */
          });

          setSubscription({
            subscribed: false,
            subscription_tier: 'free',
            subscription_end: null,
            trial_ends_at: null,
            loading: false,
            ai_credits_remaining: 10,
            ai_credits_limit: 10,
            ai_credits_reset_date: null
          });
        }
      } catch (error) {
        console.error('Error in fetchSubscription:', error);
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    };

    fetchSubscription();
  }, [user]);

  // Access comes from the server (my_access_state, see src/lib/access.ts). There is no free tier: during the 14-day
  // trial everything is open, after it a plan is needed. The temporary owner-email rule lives in useAccess.
  const isPremium = access.hasAccess;
  const canAccessFeature = (_featureId: string) => access.hasAccess;

  return {
    ...subscription,
    loading: subscription.loading || access.loading,
    trial_ends_at: access.trialEndsAt,
    access,
    isPremium,
    canAccessFeature,
    refreshSubscription: () => {
      if (user) {
        setSubscription(prev => ({ ...prev, loading: true }));
        // Re-trigger useEffect
        window.location.reload();
      }
    }
  };
};
