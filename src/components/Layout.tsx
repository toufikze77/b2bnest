import { ReactNode } from 'react';
import Header from '@/components/Header';
import WelcomeTour from '@/components/onboarding/WelcomeTour';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>{children}</main>
      <WelcomeTour />
    </div>
  );
};

export default Layout;