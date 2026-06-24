import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserRole } from '@/hooks/useUserRole';

export interface RotaEmployee {
  id: string;
  organization_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  color: string | null;
  pay_rate_pence: number;
  contracted_hours: number;
  is_active: boolean;
  created_at: string;
}

export interface RotaShift {
  id: string;
  organization_id: string;
  employee_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  role: string | null;
  location: string | null;
  notes: string | null;
  status: 'draft' | 'published';
}

export const PREVIEW_EMPLOYEE_LIMIT = 3;

export const useRota = () => {
  const { user } = useAuth();
  const { subscription, isPremium } = useSubscription();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [employees, setEmployees] = useState<RotaEmployee[]>([]);
  const [shifts, setShifts] = useState<RotaShift[]>([]);
  const [loading, setLoading] = useState(false);

  // Resolve org
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      setOrgLoading(true);
      const { data, error } = await supabase.rpc('ensure_user_has_org', { p_user_id: user.id });
      if (mounted) {
        if (!error && data) setOrganizationId(data as unknown as string);
        setOrgLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const tier = (subscription.subscription_tier || 'free').toLowerCase();
  const isRotaPremium = isPremium || tier.includes('premium') || tier === 'enterprise';

  const fetchEmployees = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('rota_employees')
      .select('*')
      .eq('organization_id', organizationId)
      .order('full_name');
    if (!error && data) setEmployees(data as RotaEmployee[]);
  }, [organizationId]);

  const fetchShifts = useCallback(async (weekStart: string, weekEnd: string) => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('rota_shifts')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('shift_date', weekStart)
      .lte('shift_date', weekEnd);
    if (!error && data) setShifts(data as RotaShift[]);
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      setLoading(true);
      fetchEmployees().finally(() => setLoading(false));
    }
  }, [organizationId, fetchEmployees]);

  return {
    user,
    organizationId,
    orgLoading: orgLoading || roleLoading,
    isAdmin,
    isRotaPremium,
    employees,
    shifts,
    loading,
    fetchEmployees,
    fetchShifts,
    setShifts,
  };
};
