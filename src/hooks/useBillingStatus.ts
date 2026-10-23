import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** What Stripe says about the signed-in user's subscription (change-subscription-plan, mode "status"). */
export interface BillingStatus {
  currentPlan: string | null;
  currentPlanKey: string | null;
  currentInterval: 'month' | 'year' | null;
  /** What the customer actually pays, in pence. */
  currentPrice: number | null;
  /** An earlier price kept for an existing subscriber (Business £35/£350, Scale £85/£850). */
  currentLegacy: boolean;
  currentLimits: { members: number; admins: number } | null;
  pendingDowngrade: { plan: string; interval: 'month' | 'year'; price: number; effectiveDate: string | null } | null;
}

export function useBillingStatus(enabled: boolean) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const reload = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('change-subscription-plan', { body: { mode: 'status' } });
    setStatus(!error && data?.ok ? (data as BillingStatus) : null);
  }, []);
  useEffect(() => {
    if (enabled) void reload();
    else setStatus(null);
  }, [enabled, reload]);
  return { status, reload };
}

export const poundsText = (pence: number) => `£${(pence / 100).toFixed(2)}`;
