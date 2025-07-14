import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end: string | null;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: 'free',
    subscription_end: null,
    loading: true
  });

  useEffect(() => {
    if (!user) {
      setSubscription({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        loading: false
      });
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching subscription:', error);
          return;
        }

        if (data) {
          setSubscription({
            subscribed: data.subscribed,
            subscription_tier: data.subscription_tier || 'free',
            subscription_end: data.subscription_end,
            loading: false
          });
        } else {
          // No subscription record exists, create one with free tier
          const { error: insertError } = await supabase
            .from('subscribers')
            .insert({
              user_id: user.id,
              email: user.email,
              subscribed: false,
              subscription_tier: 'free'
            });

          if (insertError) {
            console.error('Error creating subscription record:', insertError);
          }

          setSubscription({
            subscribed: false,
            subscription_tier: 'free',
            subscription_end: null,
            loading: false
          });
        }
      } catch (error) {
        console.error('Error in fetchSubscription:', error);
        setSubscription(prev => ({ ...prev, loading: false }));
      }
    };

    fetchSubscription();
  }, [user]);

  const isPremium = isAdmin || (subscription.subscribed && subscription.subscription_tier !== 'free');
  const canAccessFeature = (featureId: string) => {
    // Admin users have access to all features
    if (isAdmin) return true;
    
    // Free features available to all users
    if (['advisor', 'crm', 'contacts', 'deals'].includes(featureId)) return true;
    
    // Other features require premium subscription
    return isPremium;
  };

  return {
    ...subscription,
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
