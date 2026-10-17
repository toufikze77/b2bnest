import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, CalendarDays, FileText, FolderKanban, HelpCircle, Home, LogOut, Plus, Receipt, Settings, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
import ProfileEditDialog from '@/components/ProfileEditDialog';
import SupportFeedbackDialog from '@/components/SupportFeedbackDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { activeNavTarget, matchesLocation, NavAlias } from '@/lib/navMatch';
import { GlobalCommand } from './GlobalCommand';
import { NotificationsPanel } from './NotificationsPanel';
import { MobileTabBar } from './MobileTabBar';
import { bottomItems, groups, topItems } from './navItems';

// Option B navigation. Every item points at an existing route.
const MARK_REVERSED = '/brand/svg/b2bnest-mark-reversed.svg';

/** Navy menu item: white text; active = rgba(255,255,255,.12) with a 4px #3D8BFF marker. */
const navItem = cn(
  'relative h-11 min-[1100px]:h-9 text-[14.5px] text-sidebar-foreground hover:bg-nav-hover hover:text-white focus-visible:ring-[3px] focus-visible:ring-sidebar-ring',
  'data-[active=true]:bg-nav-active data-[active=true]:font-semibold data-[active=true]:text-white',
  "data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-1 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-nav-marker data-[active=true]:before:content-['']",
);

// Any tab of the finance tool highlights "Invoices & quotes", unless another item links to that exact tab.
const navAliases: NavAlias[] = [{ to: '/business-tools?tool=business-finance-assistant&tab=invoices', alsoMatches: '/business-tools?tool=business-finance-assistant' }];

const allTargets = [...topItems.map((i) => i.to), ...groups.flatMap((g) => g.items.map((i) => i.to)), ...bottomItems.map((i) => i.to)];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const { avatarUrl, displayName, email: profileEmail } = useUserAvatar();
  const [profileOpen, setProfileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const initials = (displayName || user?.email || '?').slice(0, 2).toUpperCase();

  // Only the most specific matching item is active (e.g. Calendar, not also Projects).
  const activeTo = activeNavTarget(allTargets, location.pathname, location.search, navAliases)
    ?? (location.pathname.startsWith('/settings/') ? '/settings' : undefined);
  const active = (to: string) => to === activeTo;

  // Collapsible groups (remembered per browser). The group holding the active page always stays open.
  const [closed, setClosed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('b2bnest.sidebar.closed') || '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('b2bnest.sidebar.closed', JSON.stringify(closed)); } catch { /* not remembered */ } }, [closed]);
  const toggleGroup = (label: string) => setClosed((c) => (c.includes(label) ? c.filter((x) => x !== label) : [...c, label]));

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const item = ({ label, to, icon: Icon }: { label: string; to: string; icon: typeof Home }) => (
    <SidebarMenuItem key={to}>
      <SidebarMenuButton asChild tooltip={label} isActive={active(to)} className={navItem}>
        <Link to={to} aria-current={active(to) ? 'page' : undefined}><Icon /><span>{label}</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <SidebarProvider>
      <a href="#app-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:ring-[3px] focus:ring-ring">
        Skip to content
      </a>
      <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar" aria-label="Main">
        <SidebarHeader className="h-[72px] justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:h-16">
          {/* Owner's reversed mark, straight on navy (no tile). */}
          <Link to="/dashboard" className="flex w-fit items-center rounded-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring">
            <img src={MARK_REVERSED} alt="B2BNEST" width={52} height={52} className="h-[52px] w-[52px] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8" />
          </Link>
        </SidebarHeader>
        <SidebarContent className="gap-0 py-2">
          {/* On phones the company switcher lives in the menu, so the navy top bar stays uncluttered. */}
          <div className="px-3 pb-2 pt-1 text-foreground md:hidden"><OrganizationSwitcher /></div>
          <SidebarGroup className="py-1">
            <SidebarMenu>{topItems.map(item)}</SidebarMenu>
          </SidebarGroup>
          {groups.map((group) => {
            const hasActive = group.items.some((i) => active(i.to));
            const open = hasActive || !closed.includes(group.label);
            const gid = `nav-${group.label.toLowerCase()}`;
            return (
              <SidebarGroup key={group.label} className="py-1">
                <SidebarGroupLabel asChild className="h-9 text-small font-bold uppercase tracking-wider text-brand-navy-muted focus-visible:ring-[3px]">
                  <button type="button" onClick={() => toggleGroup(group.label)} aria-expanded={open} aria-controls={gid} disabled={hasActive} className="w-full justify-between hover:text-white disabled:cursor-default">
                    {group.label}
                    {!hasActive && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />}
                  </button>
                </SidebarGroupLabel>
                <SidebarGroupContent id={gid} hidden={!open} className="group-data-[collapsible=icon]:!block">
                  <SidebarMenu className="gap-0.5">{group.items.map(item)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu className="gap-0.5">{bottomItems.map(item)}</SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        {/* Navy top bar on phones (with the reversed mark), white from md up. */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-transparent bg-brand-navy px-3 text-white sm:px-5 md:border-border md:bg-card md:text-foreground lg:px-6">
          <SidebarTrigger className="h-11 w-11 text-current hover:bg-white/10 hover:text-white md:hover:bg-accent md:hover:text-accent-foreground" aria-label="Open menu" />
          <Link to="/dashboard" className="shrink-0 rounded-control focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:hidden">
            <img src={MARK_REVERSED} alt="B2BNEST" width={42} height={42} className="h-[42px] w-[42px]" />
          </Link>
          <div className="ml-auto min-w-0 md:ml-0 md:flex-1"><GlobalCommand /></div>
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 md:ml-auto">
            {location.pathname !== '/dashboard' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-11 w-11 gap-2 px-0 sm:h-10 sm:w-auto sm:px-4"><Plus className="h-4 w-4" /><span className="hidden lg:inline">Create</span><span className="sr-only lg:hidden">Create</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Quick create</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => navigate('/project-management?create=project')}><FolderKanban className="mr-2 h-4 w-4" />Project</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/project-management?create=task')}><FileText className="mr-2 h-4 w-4" />Task</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/project-management?create=event&view=calendar')}><CalendarDays className="mr-2 h-4 w-4" />Calendar event</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate('/crm')}><Users className="mr-2 h-4 w-4" />Contact or deal</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/business-tools')}><Receipt className="mr-2 h-4 w-4" />Invoice or quote</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="icon" className="hidden h-11 w-11 sm:inline-flex" onClick={() => setFeedbackOpen(true)} aria-label="Help and feedback" title="Help and feedback"><HelpCircle className="h-5 w-5" /></Button>
            <NotificationsPanel />
            <div className="hidden min-w-0 md:block"><OrganizationSwitcher /></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Open account menu">
                  <Avatar className="h-8 w-8 ring-1 ring-white/50 md:ring-0"><AvatarImage src={avatarUrl} alt="" /><AvatarFallback className="bg-brand-navy text-small font-bold text-white">{initials}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{displayName || 'Your profile'}</p>
                  <p className="truncate text-xs text-muted-foreground">{profileEmail || user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}><Users className="mr-2 h-4 w-4" />Edit profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate('/settings')}><Settings className="mr-2 h-4 w-4" />Account settings</DropdownMenuItem>
                <DropdownMenuItem className="sm:hidden" onSelect={() => setFeedbackOpen(true)}><HelpCircle className="mr-2 h-4 w-4" />Help and feedback</DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleTheme}><Sparkles className="mr-2 h-4 w-4" />Switch theme</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="app-content" className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        <MobileTabBar matches={(to) => matchesLocation(to, location.pathname, location.search)} />
      </SidebarInset>
      <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <SupportFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SidebarProvider>
  );
}
