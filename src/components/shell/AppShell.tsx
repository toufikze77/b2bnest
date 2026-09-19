import { ReactNode, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Bot, BriefcaseBusiness, CalendarDays, CircleDollarSign,
  FileText, FolderKanban, HelpCircle, LayoutGrid, LogOut, Plus, Receipt,
  Settings, ShieldCheck, Sparkles, Target, Users, WandSparkles,
} from 'lucide-react';
import logo from '@/assets/b2bnest-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import OrganizationSwitcher from '@/components/OrganizationSwitcher';
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
import { GlobalCommand } from './GlobalCommand';

const groups = [
  { label: 'Overview', items: [{ label: 'Dashboard', to: '/dashboard', icon: BarChart3 }] },
  { label: 'Work', items: [
    { label: 'Projects', to: '/project-management', icon: FolderKanban },
    { label: 'Tasks', to: '/project-management?view=list', icon: FileText },
    { label: 'Calendar', to: '/project-management?view=calendar', icon: CalendarDays },
    { label: 'Goals', to: '/project-management?tab=goals', icon: Target },
    { label: 'Unassigned projects', to: '/settings/unassigned-projects', icon: ShieldCheck },
  ] },
  { label: 'Customers', items: [
    { label: 'CRM', to: '/crm', icon: Users },
    { label: 'Lead generation', to: '/lead-generation', icon: BriefcaseBusiness },
  ] },
  { label: 'Money', items: [
    { label: 'Invoices & quotes', to: '/business-tools', icon: Receipt },
    { label: 'Finance', to: '/business-overview', icon: CircleDollarSign },
  ] },
  { label: 'Team', items: [{ label: 'Employee rota', to: '/rota', icon: Users }] },
  { label: 'Automate', items: [
    { label: 'AI workspace', to: '/ai-workspace', icon: Bot },
    { label: 'Workflows', to: '/workflow-studio', icon: WandSparkles },
  ] },
  { label: 'More', items: [
    { label: 'Templates', to: '/template-center', icon: LayoutGrid },
    { label: 'All business tools', to: '/business-tools', icon: Sparkles },
  ] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const { avatarUrl, displayName } = useUserAvatar();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const initials = (displayName || user?.email || '?').slice(0, 2).toUpperCase();

  const active = (to: string) => {
    const [path, query] = to.split('?');
    if (location.pathname !== path) return false;
    if (!query) return true;
    const target = new URLSearchParams(query);
    return [...target.entries()].every(([key, value]) => new URLSearchParams(location.search).get(key) === value);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <SidebarProvider>
      <a href="#app-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring">
        Skip to content
      </a>
      <Sidebar collapsible="icon" className="border-sidebar-border bg-sidebar">
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
          <Link to="/dashboard" className="flex items-center gap-2 overflow-hidden rounded-md px-1 py-1" aria-label="B2BNest dashboard">
            <img src={logo} alt="" className="h-7 w-auto max-w-[168px] object-contain dark:brightness-0 dark:invert" />
          </Link>
        </SidebarHeader>
        <SidebarContent className="py-3">
          {groups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ label, to, icon: Icon }) => (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild tooltip={label} isActive={active(to)}>
                        <Link to={to}><Icon /><span>{label}</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Settings" isActive={location.pathname === '/settings'}>
                <Link to="/settings"><Settings /><span>Settings</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/90 sm:px-5 lg:px-6">
          <SidebarTrigger className="h-10 w-10 text-muted-foreground" />
          <div className="min-w-0 flex-1 sm:flex-none"><OrganizationSwitcher /></div>
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <div className="hidden md:block"><GlobalCommand /></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-10 w-10 gap-2 px-0 sm:w-auto sm:px-4"><Plus className="h-4 w-4" /><span className="hidden lg:inline">Create</span><span className="sr-only lg:hidden">Create</span></Button>
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
            <Button variant="ghost" size="icon" className="hidden h-10 w-10 sm:inline-flex" onClick={() => navigate('/ai-workspace')} aria-label="Open AI workspace" title="AI workspace"><Bot className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="hidden h-10 w-10 lg:inline-flex" onClick={() => navigate('/settings')} aria-label="Notifications" title="Notifications"><Bell className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="hidden h-10 w-10 lg:inline-flex" onClick={() => setFeedbackOpen(true)} aria-label="Help and feedback" title="Help and feedback"><HelpCircle className="h-4 w-4" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Open profile menu">
                  <Avatar className="h-8 w-8"><AvatarImage src={avatarUrl} alt="" /><AvatarFallback>{initials}</AvatarFallback></Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{displayName || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}><Settings className="mr-2 h-4 w-4" />Account settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleTheme}><Sparkles className="mr-2 h-4 w-4" />Switch theme</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="app-content" className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
      <SupportFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </SidebarProvider>
  );
}