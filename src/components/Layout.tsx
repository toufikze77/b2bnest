import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import WelcomeTour from '@/components/onboarding/WelcomeTour';
import { AppShell } from '@/components/shell/AppShell';
import RouteFallback from '@/components/shell/RouteFallback';
import { useAuth } from '@/hooks/useAuth';
import { isAppShellPath } from '@/lib/appShellRoutes';
import DemoBanner from '@/components/demo/DemoBanner';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Phase 24: the app shell is shown only to a signed-in person. A signed-out visitor on any route — including the public
 * showcase pages /template-center and /business-tools — gets the public Header, exactly like Pricing. While sign-in is
 * still being checked on an app route, neither is shown: only the neutral page skeleton, so the shell never flashes.
 */
const Layout = ({ children }: LayoutProps) => {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const isAppRoute = isAppShellPath(pathname);

  if (isAppRoute && loading) {
    return (
      <div className="min-h-screen bg-background" data-testid="layout-loading">
        <RouteFallback />
      </div>
    );
  }

  if (isAppRoute && user) {
    return (
      <div className="min-h-screen bg-background">
        <DemoBanner />
        <AppShell>{children}</AppShell>
        <WelcomeTour />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DemoBanner />
      <Header />
      <main>{children}</main>
      <WelcomeTour />
    </div>
  );
};

export default Layout;
