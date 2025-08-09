import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  
  // Don't show header on directory pages since they have their own navigation structure
  const hideHeaderRoutes = [
    '/directory',
    '/directory/companies', 
    '/directory/suppliers',
    '/directory/services'
  ];
  
  const shouldHideHeader = hideHeaderRoutes.some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  return (
    <div className="min-h-screen bg-background">
      {!shouldHideHeader && <Header />}
      {children}
    </div>
  );
};

export default Layout;