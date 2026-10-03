import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import WelcomeTour from '@/components/onboarding/WelcomeTour';
import { AppShell } from '@/components/shell/AppShell';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { pathname } = useLocation();
  const appPrefixes = [
    '/dashboard', '/business-overview', '/settings', '/profile-setup', '/onboarding',
    '/crm', '/project-management', '/lead-generation', '/rota',
    '/workflow-studio', '/integrations/', '/business-tools', '/template-center', '/workspaces',
  ];
  const isAppRoute = appPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAppRoute && !isAdminRoute) {
    return (
      <div className="min-h-screen bg-background">
        <AppShell>{children}</AppShell>
        <WelcomeTour />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>{children}</main>
      <WelcomeTour />
    </div>
  );
};

export default Layout;