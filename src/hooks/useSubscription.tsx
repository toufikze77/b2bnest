import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string;
  subscription_end: string | null;
  trial_ends_at: string | null;
  loading: boolean;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [subscription, setSubscription] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: 'free',
    subscription_end: null,
    trial_ends_at: null,
    loading: true
  });

  useEffect(() => {
    if (!user) {
      setSubscription({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        trial_ends_at: null,
        loading: false
      });
      return;
    }

    const fetchSubscription = async () => {
      try {
        // Fetch trial info from profiles (primary source of truth)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('trial_ends_at, is_trial_active')
          .eq('id', user.id)
          .single();

        console.log('🔍 Trial Status Debug:', {
          userId: user.id,
          email: user.email,
          trial_ends_at: profile?.trial_ends_at,
          is_trial_active: profile?.is_trial_active,
          now: new Date().toISOString()
        });

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        // Fetch subscription info
        const { data, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching subscription:', error);
        }

        const trialEndsAt = profile?.trial_ends_at || null;
        const hasActiveTrial = trialEndsAt && new Date(trialEndsAt) > new Date();
        
        console.log('✅ Subscription State:', {
          hasActiveTrial,
          trialEndsAt,
          subscribed: data?.subscribed || false,
          subscription_tier: data?.subscription_tier || 'free'
        });

        if (data) {
          setSubscription({
            subscribed: data.subscribed,
            subscription_tier: data.subscription_tier || 'free',
            subscription_end: data.subscription_end,
            trial_ends_at: trialEndsAt,
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
            trial_ends_at: profile?.trial_ends_at || null,
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

  // Special access emails for AI Studio features
  const specialAccessEmails = ['toufikze@gmail.com', 'toufik.zemri@outlook.com'];
  const hasSpecialAccess = user?.email && specialAccessEmails.includes(user.email);
  
  // Check if user has active trial
  const hasActiveTrial = subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date();
  
  // Trial users get full Enterprise access, paid users get their tier, admins get everything
  const isPremium = isAdmin || hasSpecialAccess || hasActiveTrial || (subscription.subscribed && subscription.subscription_tier !== 'free');
  
  const canAccessFeature = (featureId: string) => {
    // Admin users have access to all features
    if (isAdmin) {
      console.log(`✅ Feature "${featureId}" granted: Admin access`);
      return true;
    }
    
    // Active trial users get full access to ALL features (Enterprise level)
    if (hasActiveTrial) {
      console.log(`✅ Feature "${featureId}" granted: Active trial (Enterprise access)`);
      return true;
    }
    
    // Special access users have full AI Studio access
    if (hasSpecialAccess && ['analytics', 'workflows', 'personalization'].includes(featureId)) {
      console.log(`✅ Feature "${featureId}" granted: Special access`);
      return true;
    }
    
    // Free features available to all users
    if (['advisor', 'crm', 'contacts', 'deals', 'project-management'].includes(featureId)) {
      console.log(`✅ Feature "${featureId}" granted: Free tier`);
      return true;
    }
    
    // Other features require premium subscription
    const granted = isPremium;
    console.log(`${granted ? '✅' : '❌'} Feature "${featureId}" ${granted ? 'granted' : 'denied'}: Premium required, isPremium=${isPremium}`);
    return granted;
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
