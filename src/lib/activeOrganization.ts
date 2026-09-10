import { supabase } from '@/integrations/supabase/client';

/**
 * Canonical tenant resolution for Wave 1 creation paths.
 *
 * There is exactly ONE legitimate source of the tenant for a newly created
 * organisation-owned record: the organisation the user has explicitly selected
 * in the top-bar switcher (OrganizationContext). Picking "the first membership"
 * — via [0], .limit(1) or an arbitrary fallback — is a tenant-assignment bug and
 * is forbidden in creation paths.
 *
 * This helper re-validates the selected organisation against the caller's active
 * memberships before it is used, so a manipulated client payload cannot create
 * records inside an organisation the caller does not belong to. RLS enforces the
 * same rule server-side; this is the fail-fast client-side gate.
 */

export const CREATE_ROLES = ['owner', 'admin', 'manager', 'member'];

export interface ValidatedTenant {
  userId: string;
  organizationId: string;
  role: string;
}

export const assertActiveOrganization = async (
  organizationId: string | null | undefined,
): Promise<ValidatedTenant> => {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) throw new Error('Please sign in to continue.');

  if (!organizationId) {
    throw new Error(
      'No company is selected. Choose a company in the top bar before creating records.',
    );
  }

  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!membership) {
    throw new Error('You are not a member of the selected company.');
  }
  if (!CREATE_ROLES.includes(membership.role)) {
    throw new Error('Your role in the selected company does not allow creating records.');
  }

  return { userId: user.id, organizationId, role: membership.role };
};
