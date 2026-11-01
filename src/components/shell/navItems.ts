import {
  BarChart3, Bot, BriefcaseBusiness, CalendarDays, CircleDollarSign, FileText, FolderKanban, Home, LayoutGrid, LayoutTemplate, LifeBuoy, ListChecks, NotebookPen, Plug, Receipt, Settings, Sparkles, Target, TrendingUp, Users, UsersRound, WandSparkles,
} from 'lucide-react';
import type { NavAlias } from '@/lib/navMatch';

/**
 * Sidebar menu (Option B). Every item points at an existing route. The phone "More" button opens
 * this same menu. Business overview sits directly under Dashboard (Phase 4).
 */
export const CASH_FLOW_TO = '/business-tools?tool=cash-flow-tracker';

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
    // Phase 19: marked "Business" in the menu for accounts whose plan doesn't include workflows (Solo).
    { label: 'Workflows', to: '/workflow-studio', icon: WandSparkles, planBadge: 'Business' },
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
    // Phase 29: the Cash Flow Tracker belongs with the money tools.
    { label: 'Cash flow', to: CASH_FLOW_TO, icon: TrendingUp },
  ] },
  { label: 'Team', items: [{ label: 'Employee rota', to: '/rota', icon: UsersRound }] },
];
/**
 * Menu items that also light up for a wider set of pages than their own link: any tab of the finance tool highlights
 * "Invoices & quotes" (unless another item links to that exact tab), and the Cash Flow Tracker highlights "Cash flow"
 * whatever else is in the address (it beats "All business tools", which matches /business-tools only).
 */
export const navAliases: NavAlias[] = [
  { to: '/business-tools?tool=business-finance-assistant&tab=invoices', alsoMatches: '/business-tools?tool=business-finance-assistant' },
  { to: CASH_FLOW_TO, alsoMatches: CASH_FLOW_TO },
];

/** Leaves the app for the public website. Kept out of the in-app targets, so it is never shown as the current page. */
export const homeItem = { label: 'B2BNEST home', to: '/', icon: Home };

/**
 * Where the shell's logo goes: to the dashboard from any app page, and to the public home page when you are
 * already on the dashboard (so the logo can always reach the home page).
 */
export function logoTarget(pathname: string): { to: string; label: string } {
  return pathname === '/dashboard' ? { to: '/', label: 'Go to home page' } : { to: '/dashboard', label: 'Go to dashboard' };
}

export const bottomItems = [
  { label: 'AI Studio', to: '/ai-studio', icon: Bot },
  { label: 'Integrations', to: '/business-tools?tool=integrations', icon: Plug },
  { label: 'Settings', to: '/settings', icon: Settings },
];
