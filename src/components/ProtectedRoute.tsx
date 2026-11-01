import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authUrlWithNext } from '@/lib/onboarding';
import { useAuth } from '@/hooks/useAuth';
import { useAssurance } from '@/hooks/useAssurance';
import { useTwoStepRequirement } from '@/hooks/useTwoStepRequirement';
import TwoStepCodeScreen from '@/components/twoStep/TwoStepCodeScreen';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

/** Paths that stay open to someone who must set up two-step sign-in, so they can do it. */
const SETUP_PATHS = ['/two-step-required', '/settings'];

/**
 * Signed-in pages only. A signed-out visitor is sent to sign-in with the page as the return path, on every host.
 * Phase 24 removed the old host-name bypass (hosts containing "lovable.app", "preview" or "localhost" skipped this
 * check): nothing needs it, since Lovable previews share the editor's session (previewAuthStorage.ts) and local
 * development and the screenshot scripts sign in with a real session.
 * Phase 25: a session that still needs its two-step code sees the code screen, never the page; and if two-step sign-in
 * is ever required for a company role (TWO_STEP_REQUIRED_ROLES), those people are sent to set it up first.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const assurance = useAssurance();
  const twoStep = useTwoStepRequirement();
  const location = useLocation();

  if (loading || (user && assurance.loading)) {
    return (
      <div className="mx-auto grid min-h-screen max-w-6xl content-start gap-4 px-6 py-24">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={authUrlWithNext(location.pathname + location.search)} replace />;
  }

  if (assurance.needsCode) return <TwoStepCodeScreen />;

  if (!twoStep.loading && twoStep.scope === 'app' && twoStep.mustSetUp
    && !SETUP_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return <Navigate to={`/two-step-required?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
