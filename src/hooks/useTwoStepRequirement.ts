import { useActiveOrganization } from '@/contexts/OrganizationContext';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAssurance } from '@/hooks/useAssurance';
import { requirementFor, TWO_STEP_BANNER_ROLES } from '@/lib/twoStep';

/**
 * Whether two-step sign-in is required for the signed-in person and whether they still have to set it up (Phase 25).
 * `scope` follows TWO_STEP_REQUIRED_ROLES: 'admin' for super admins (Admin area only), 'app' if a company role is ever
 * added there, otherwise null (optional).
 */
export function useTwoStepRequirement() {
  const { isSuperAdmin, loading: superLoading } = useSuperAdmin();
  const { memberships, loading: orgLoading } = useActiveOrganization();
  const assurance = useAssurance();
  const companyRoles = memberships.map((m) => m.role);
  const scope = requirementFor({ isSuperAdmin, companyRoles });
  const hasApp = assurance.verified.length > 0;
  return {
    loading: superLoading || orgLoading || assurance.loading,
    scope,
    hasApp,
    /** Required here but no authenticator app yet: send them to set it up. */
    mustSetUp: scope !== null && !hasApp,
    /** Company owners/admins without an app see the "Protect your account" banner (optional, encouraged). */
    showBanner: !hasApp && companyRoles.some((r) => (TWO_STEP_BANNER_ROLES as readonly string[]).includes(r)),
  };
}
