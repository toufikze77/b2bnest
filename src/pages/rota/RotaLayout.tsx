import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useRota, PREVIEW_EMPLOYEE_LIMIT } from '@/hooks/useRota';
import { pendingCount } from '@/lib/rotaLeaveApi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Users, Crown, ShieldAlert, Plane } from 'lucide-react';
import { ReactNode } from 'react';
import PageBackBar from '@/components/shell/PageBackBar';

export default function RotaLayout({ children }: { children: ReactNode }) {
  const { isAdmin, isLeaveManager, orgLoading, isRotaPremium, employees, organizationId } = useRota();
  const { pathname } = useLocation();
  // Phase 32: managers see how many holiday requests wait for them (0 or nothing before the database update).
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    if (!isLeaveManager || !organizationId) { setWaiting(null); return; }
    let live = true;
    pendingCount(organizationId).then((r) => { if (live) setWaiting(r.error ? null : r.count ?? 0); }, () => { if (live) setWaiting(null); });
    return () => { live = false; };
  }, [isLeaveManager, organizationId, pathname]);

  if (orgLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  // Phase 32: everyone in the company can open Holiday; the planning tabs stay for owners, admins and managers.
  if (!isAdmin && pathname === '/rota/holiday') {
    return (
      <>
      <PageBackBar title="Employee rota" />
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Holiday</h1>
          <p className="text-sm text-muted-foreground">Ask for time off and see who is away.</p>
        </div>
        {children}
      </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
      <PageBackBar title="Employee rota" />
      <div className="max-w-2xl mx-auto p-6">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Rota planning is for company owners, admins and managers. Ask your company owner to give you the Admin or Manager role in Settings → Team.
            {' '}You can still <Link to="/rota/holiday" className="font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ask for holiday</Link>.
          </AlertDescription>
        </Alert>
      </div>
      </>
    );
  }

  const tabs = [
    { to: '/rota/employees', label: 'Employees', icon: Users },
    { to: '/rota/schedule', label: 'Schedule', icon: Calendar },
    { to: '/rota/holiday', label: 'Holiday', icon: Plane },
  ];

  const overLimit = !isRotaPremium && employees.filter(e => e.is_active).length >= PREVIEW_EMPLOYEE_LIMIT;

  return (
    <>
    <PageBackBar title="Employee rota" />
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
              <Link to={t.to}>
                <t.icon className="h-4 w-4 mr-2" />{t.label}
                {t.to === '/rota/holiday' && waiting ? (
                  <span className="ml-2 rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground" aria-label={`${waiting} waiting for a decision`} data-testid="leave-badge">{waiting}</span>
                ) : null}
              </Link>
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
                Add up to {PREVIEW_EMPLOYEE_LIMIT} employees in preview{overLimit ? ' — limit reached' : ''}. Choose a plan for unlimited employees, shift publishing and reporting.
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
    </>
  );
}
