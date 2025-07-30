import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface TrialStatus {
  isTrialActive: boolean;
  trialExpired: boolean;
  daysRemaining: number;
  trialEndsAt: string | null;
  loading: boolean;
}

export const useTrialStatus = () => {
  const { user } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    isTrialActive: false,
    trialExpired: false,
    daysRemaining: 0,
    trialEndsAt: null,
    loading: true
  });

  const checkTrialStatus = async () => {
    if (!user) {
      setTrialStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase.rpc('check_trial_status', {
        user_id_param: user.id
      });

      if (error) {
        console.error('Error checking trial status:', error);
        return;
      }

      if (data && data.length > 0) {
        const trial = data[0];
        setTrialStatus({
          isTrialActive: trial.is_trial_active,
          trialExpired: trial.trial_expired,
          daysRemaining: trial.days_remaining,
          trialEndsAt: trial.trial_ends_at,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error fetching trial status:', error);
      setTrialStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    checkTrialStatus();
  }, [user]);

  return {
    ...trialStatus,
    refreshTrialStatus: checkTrialStatus
  };
};