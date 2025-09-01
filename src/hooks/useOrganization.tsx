import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  settings: any;
  subscription_tier: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'member';
  permissions: any;
  is_active: boolean;
  profile?: {
    id: string;
    display_name: string;
    email: string;
    full_name: string;
  } | null;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  members: OrganizationMember[];
  userRole: string | null;
  loading: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  fetchMembers: () => Promise<void>;
  inviteUser: (email: string, role: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const { data: orgMemberships, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user?.id)
        .eq('is_active', true);

      if (error) throw error;

      const orgs = orgMemberships?.map(m => m.organization).filter(Boolean) || [];
      setOrganizations(orgs);
      
      // Set the first organization as current if none selected
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      let selectedOrg = orgs.find(o => o.id === savedOrgId) || orgs[0];
      
      if (selectedOrg) {
        setCurrentOrganization(selectedOrg);
        localStorage.setItem('currentOrganizationId', selectedOrg.id);
        
        // Set user role for current organization
        const membership = orgMemberships?.find(m => m.organization_id === selectedOrg.id);
        setUserRole(membership?.role || null);
        
        // Fetch members for current organization
        fetchMembers(selectedOrg.id);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async (orgId?: string) => {
    const targetOrgId = orgId || currentOrganization?.id;
    if (!targetOrgId) return;

    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          profile:profiles(id, display_name, email, full_name)
        `)
        .eq('organization_id', targetOrgId)
        .eq('is_active', true)
        .order('role', { ascending: true });

      if (error) throw error;
      setMembers((data || []).map(member => ({
        ...member,
        role: member.role as 'owner' | 'admin' | 'manager' | 'member',
        profile: member.profile && !('error' in member.profile) ? member.profile : null
      })));
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', orgId);
      
      // Update user role for new organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgId)
        .eq('user_id', user?.id)
        .single();
      
      setUserRole(membership?.role || null);
      await fetchMembers(orgId);
    }
  };

  const inviteUser = async (email: string, role: string) => {
    if (!currentOrganization) return;

    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: currentOrganization.id,
          email,
          role,
          invited_by: user?.id,
          token
        });

      if (error) throw error;
      
      // In a real app, you would send an email here
      console.log(`Invitation sent to ${email} with token: ${token}`);
    } catch (error) {
      console.error('Error inviting user:', error);
      throw error;
    }
  };

  const updateMemberRole = async (memberId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      await fetchMembers();
    } catch (error) {
      console.error('Error updating member role:', error);
      throw error;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;
      await fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  };

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      organizations,
      members,
      userRole,
      loading,
      switchOrganization,
      fetchMembers,
      inviteUser,
      updateMemberRole,
      removeMember
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};