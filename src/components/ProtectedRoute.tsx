import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authUrlWithNext } from '@/lib/onboarding';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Signed-in pages only. A signed-out visitor is sent to sign-in with the page as the return path, on every host.
 * Phase 24 removed the old host-name bypass (hosts containing "lovable.app", "preview" or "localhost" skipped this
 * check): nothing needs it, since Lovable previews share the editor's session (previewAuthStorage.ts) and local
 * development and the screenshot scripts sign in with a real session.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  return <>{children}</>;
};

export default ProtectedRoute;
