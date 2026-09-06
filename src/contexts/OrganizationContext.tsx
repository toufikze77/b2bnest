import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OrganizationMembership {
  organizationId: string;
  name: string;
  role: string;
}

interface OrganizationContextValue {
  memberships: OrganizationMembership[];
  organizationId: string | null;
  organization: OrganizationMembership | null;
  loading: boolean;
  setActiveOrganization: (id: string) => void;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

const storageKey = (userId: string) => `b2bnest.activeOrganization.${userId}`;

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setOrganizationId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id, role, organizations:organization_id(id, name)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      const list: OrganizationMembership[] = (data || []).map((row: any) => ({
        organizationId: row.organization_id,
        name: row.organizations?.name || 'My workspace',
        role: row.role,
      }));
      setMemberships(list);

      // Restore the stored selection only when it is still a valid membership.
      const stored = localStorage.getItem(storageKey(user.id));
      const valid = list.find((m) => m.organizationId === stored);
      setOrganizationId(valid?.organizationId ?? list[0]?.organizationId ?? null);
    } catch (err) {
      console.error('Failed to load organization memberships', err);
      setMemberships([]);
      setOrganizationId(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveOrganization = useCallback(
    (id: string) => {
      if (!user) return;
      if (!memberships.some((m) => m.organizationId === id)) return; // never trust an unvalidated id
      localStorage.setItem(storageKey(user.id), id);
      setOrganizationId(id);
      // Cached data belongs to the previous tenant: drop it.
      queryClient.clear();
    },
    [user, memberships, queryClient]
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({
      memberships,
      organizationId,
      organization: memberships.find((m) => m.organizationId === organizationId) || null,
      loading,
      setActiveOrganization,
      refresh: load,
    }),
    [memberships, organizationId, loading, setActiveOrganization, load]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useActiveOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useActiveOrganization must be used within an OrganizationProvider');
  return ctx;
};
