import {
  BarChart3, Bot, BriefcaseBusiness, CalendarDays, CircleDollarSign, FileText, FolderKanban, Home, LayoutGrid, LayoutTemplate, LifeBuoy, ListChecks, NotebookPen, Plug, Receipt, Settings, Sparkles, Target, Users, UsersRound, WandSparkles,
} from 'lucide-react';

/**
 * Sidebar menu (Option B). Every item points at an existing route. The phone "More" button opens
 * this same menu. Business overview sits directly under Dashboard (Phase 4).
 */
export const topItems = [
  { label: 'Dashboard', to: '/dashboard', icon: Home },
  { label: 'Business overview', to: '/business-overview', icon: BarChart3 },
];
export const groups = [
  { label: 'Work', items: [
    { label: 'Workspaces', to: '/workspaces', icon: LayoutGrid },
    { label: 'Projects', to: '/project-management', icon: FolderKanban },
    { label: 'Tasks', to: '/project-management?view=list', icon: ListChecks },
    { label: 'Calendar', to: '/project-management?view=calendar', icon: CalendarDays },
    { label: 'Goals', to: '/project-management?tab=goals', icon: Target },
    { label: 'Notes', to: '/business-tools/notepro', icon: NotebookPen },
    { label: 'Workflows', to: '/workflow-studio', icon: WandSparkles },
    { label: 'Templates', to: '/template-center', icon: LayoutTemplate },
    { label: 'All business tools', to: '/business-tools', icon: Sparkles },
  ] },
  { label: 'Customers', items: [
    { label: 'CRM', to: '/crm', icon: Users },
    { label: 'Support tickets', to: '/support-desk', icon: LifeBuoy },
    { label: 'Lead generation', to: '/lead-generation', icon: BriefcaseBusiness },
  ] },
  { label: 'Money', items: [
    { label: 'Invoices & quotes', to: '/business-tools?tool=business-finance-assistant&tab=invoices', icon: FileText },
    { label: 'Expenses', to: '/business-tools?tool=business-finance-assistant&tab=expenses', icon: Receipt },
    { label: 'Finance', to: '/business-tools?tool=business-finance-assistant&tab=dashboard', icon: CircleDollarSign },
  ] },
  { label: 'Team', items: [{ label: 'Employee rota', to: '/rota', icon: UsersRound }] },
];
export const bottomItems = [
  { label: 'AI Studio', to: '/ai-studio', icon: Bot },
  { label: 'Integrations', to: '/business-tools?tool=integrations', icon: Plug },
  { label: 'Settings', to: '/settings', icon: Settings },
];
