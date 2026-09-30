/** Pure helpers for the operational dashboard (UI Wave 2). */

export interface DashTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
}

export const CLOSED_STATUSES = ['done', 'completed', 'cancelled'];
export const isOpen = (status: string) => !CLOSED_STATUSES.includes((status || '').toLowerCase());

/** Local calendar date as YYYY-MM-DD. */
export const isoDay = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const addDaysIso = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + days));
};

export const UPCOMING_DAYS = 7;

export function classifyTasks(tasks: DashTask[], today: string, horizonDays = UPCOMING_DAYS) {
  const horizon = addDaysIso(today, horizonDays);
  const overdue: DashTask[] = [];
  const dueToday: DashTask[] = [];
  const upcoming: DashTask[] = [];
  for (const t of tasks) {
    if (!t.due_date || !isOpen(t.status)) continue;
    const day = t.due_date.slice(0, 10);
    if (day < today) overdue.push(t);
    else if (day === today) dueToday.push(t);
    else if (day <= horizon) upcoming.push(t);
  }
  const byDue = (a: DashTask, b: DashTask) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0);
  return { overdue: overdue.sort(byDue), dueToday: dueToday.sort(byDue), upcoming: upcoming.sort(byDue) };
}

/** Link to the existing view that holds a task (tasks have no single-task deep link). */
export const taskHref = (t: Pick<DashTask, 'project_id'>) =>
  t.project_id ? `/project-management?view=list&project=${t.project_id}` : '/project-management?view=list';

export type StepId = 'contact' | 'project' | 'invoice' | 'invite';
export type StepState = 'done' | 'todo' | 'unknown';

export interface ActivationCounts {
  contacts: number | null; // null = query failed
  projects: number | null;
  invoices: number | null;
  members: number | null;
}

export interface ActivationStep {
  id: StepId;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  state: StepState;
}

export const ADMIN_ROLES = ['owner', 'admin', 'super_admin'];
export const ROTA_ROLES = ['owner', 'admin', 'manager', 'super_admin'];
export const hasRole = (role: string | null | undefined, allowed: string[]) => !!role && allowed.includes(role.toLowerCase());

const stateOf = (n: number | null, threshold = 0): StepState => (n === null ? 'unknown' : n > threshold ? 'done' : 'todo');

/**
 * Builds the first-run checklist from real counts. Steps the user cannot
 * perform are omitted. `canInvite` is false until a company-invitation flow
 * exists (see docs/ui-wave2-activation-report-2026-09-30.md).
 */
export function buildActivationSteps(counts: ActivationCounts, role: string | null | undefined, opts: { canInvite?: boolean } = {}): ActivationStep[] {
  const steps: ActivationStep[] = [
    { id: 'contact', title: 'Create a first contact', description: 'Add a customer or lead to your CRM contacts.', href: '/crm', actionLabel: 'Open CRM', state: stateOf(counts.contacts) },
    { id: 'project', title: 'Create a project or template workspace', description: 'Start a project, or use a template to set up boards for this company.', href: '/project-management?create=project', actionLabel: 'Create project', state: stateOf(counts.projects) },
    { id: 'invoice', title: 'Create a first invoice', description: 'Bill a customer from Invoices & quotes.', href: '/business-tools?tool=business-finance-assistant&tab=invoices', actionLabel: 'Create invoice', state: stateOf(counts.invoices) },
  ];
  if (opts.canInvite && hasRole(role, ADMIN_ROLES)) {
    steps.push({ id: 'invite', title: 'Invite a teammate', description: 'Give a colleague access to this company.', href: '/settings?tab=team', actionLabel: 'Invite teammate', state: stateOf(counts.members, 1) });
  }
  return steps;
}

export const dismissKey = (userId: string, orgId: string) => `b2bnest.activation.dismissed.${userId}.${orgId}`;
