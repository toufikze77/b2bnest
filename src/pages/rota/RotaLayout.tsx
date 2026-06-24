import { Link, useLocation } from 'react-router-dom';
import { useRota, PREVIEW_EMPLOYEE_LIMIT } from '@/hooks/useRota';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Users, Crown, ShieldAlert } from 'lucide-react';
import { ReactNode } from 'react';

export default function RotaLayout({ children }: { children: ReactNode }) {
  const { isAdmin, orgLoading, isRotaPremium, employees } = useRota();
  const { pathname } = useLocation();

  if (orgLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Only organization owners and admins can manage the rota. Please contact your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const tabs = [
    { to: '/rota/employees', label: 'Employees', icon: Users },
    { to: '/rota/schedule', label: 'Schedule', icon: Calendar },
  ];

  const overLimit = !isRotaPremium && employees.filter(e => e.is_active).length >= PREVIEW_EMPLOYEE_LIMIT;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employee Rota</h1>
          <p className="text-sm text-muted-foreground">Schedule shifts, track hours, manage your team.</p>
        </div>
        <div className="flex gap-2">
          {tabs.map(t => (
            <Button
              key={t.to}
              asChild
              variant={pathname === t.to ? 'default' : 'outline'}
              size="sm"
            >
              <Link to={t.to}><t.icon className="h-4 w-4 mr-2" />{t.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {!isRotaPremium && (
        <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-900">
          <div className="flex items-start gap-3">
            <Crown className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">Preview mode</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                You're on a free plan. Add up to {PREVIEW_EMPLOYEE_LIMIT} employees{overLimit ? ' — limit reached' : ''}. Upgrade to Business Premium for unlimited employees, shift publishing, and reporting.
              </p>
            </div>
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              <Link to="/pricing">Upgrade</Link>
            </Button>
          </div>
        </Card>
      )}

      {children}
    </div>
  );
}
