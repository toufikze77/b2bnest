import { NavLink, Outlet, Link } from 'react-router-dom';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, Users, Building2, CreditCard, Layers, Brain, Wrench, FolderKanban,
  FileText, MessagesSquare, LifeBuoy, BarChart3, ScrollText, Download, Activity, Settings,
  ArrowLeft, ShieldAlert, Menu,
} from 'lucide-react';

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/plans', label: 'Plans', icon: Layers },
  { to: '/admin/ai', label: 'AI Management', icon: Brain },
  { to: '/admin/tools', label: 'Business Tools', icon: Wrench },
  { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { to: '/admin/documents', label: 'Documents & Templates', icon: FileText },
  { to: '/admin/social', label: 'Social / Community', icon: MessagesSquare },
  { to: '/admin/support', label: 'Support', icon: LifeBuoy },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/export', label: 'Data Export', icon: Download },
  { to: '/admin/system-health', label: 'System Health', icon: Activity },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1 p-3">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="text-sm text-muted-foreground">
          {user
            ? 'Your account does not have B2BNest Super Admin permissions. All admin data is additionally protected server-side.'
            : 'Please sign in with an authorised Super Admin account.'}
        </p>
        <Button asChild variant="outline">
          <Link to={user ? '/dashboard' : '/auth'}>{user ? 'Back to B2BNest' : 'Sign in'}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-background lg:block">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <ShieldAlert className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-wide">B2BNEST ADMIN</span>
        </div>
        <ScrollArea className="h-[calc(100vh-7rem)]">
          <NavItems />
        </ScrollArea>
        <div className="border-t border-border p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to B2BNest
            </Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center gap-2 border-b border-border bg-background px-4 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open admin navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-14 items-center gap-2 border-b border-border px-4">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">B2BNEST ADMIN</span>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <NavItems />
                <div className="p-3">
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                    <Link to="/dashboard">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back to B2BNest
                    </Link>
                  </Button>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">B2BNEST ADMIN</span>
        </div>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
