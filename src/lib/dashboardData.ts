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
  /** company = measured for the selected company; personal = measured for the signed-in user only. */
  scope: 'company' | 'personal';
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
    { id: 'project', scope: 'company', title: 'Create a project or template workspace', description: 'Start a project, or use a template to set up boards for this company.', href: '/project-management?create=project', actionLabel: 'Create project', state: stateOf(counts.projects) },
    { id: 'contact', scope: 'personal', title: 'Add your first contact', description: 'Add a customer or lead in CRM.', href: '/crm', actionLabel: 'Open CRM', state: stateOf(counts.contacts) },
    { id: 'invoice', scope: 'personal', title: 'Create your first invoice', description: 'Bill a customer from Invoices & quotes.', href: '/business-tools?tool=business-finance-assistant&tab=invoices', actionLabel: 'Open invoices', state: stateOf(counts.invoices) },
  ];
  if (opts.canInvite && hasRole(role, ADMIN_ROLES)) {
    steps.push({ id: 'invite', scope: 'company', title: 'Invite a teammate', description: 'Give a colleague access to this company.', href: '/settings?tab=team', actionLabel: 'Invite teammate', state: stateOf(counts.members, 1) });
  }
  return steps;
}

export const dismissKey = (userId: string, orgId: string) => `b2bnest.activation.dismissed.${userId}.${orgId}`;

/** One Needs-attention group: up to GROUP_LIMIT items shown, `total` = exact count of all matching tasks (null = count unavailable). */
export interface TaskGroupData { items: DashTask[]; total: number | null }
export const GROUP_LIMIT = 5;

/* ---------- Summary, projects, workspaces (UI Wave 2 revision) ---------- */

export const CLOSED_PROJECT_STATUSES = ['completed', 'cancelled'];

/** Monday of the current local week, YYYY-MM-DD. */
export const weekStartIso = (d: Date) => {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return isoDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
};

export interface DashProject {
  id: string;
  name: string;
  color: string | null;
  status: string;
  deadline: string | null;
  custom_fields: unknown;
  updated_at: string;
}
export interface ProgressTask { project_id: string | null; status: string; due_date: string | null }

export interface ProjectSummary {
  id: string; name: string; color: string | null; status: string;
  done: number; total: number; nextDue: string | null; deadline: string | null; href: string;
}
export interface WorkspaceSummary { id: string; name: string; boards: number; open: number; href: string }

type WsMeta = { id?: string; name?: string };
const wsOf = (p: DashProject): WsMeta | null => {
  const cf = p.custom_fields as { workspace?: WsMeta } | null;
  return cf && typeof cf === 'object' && cf.workspace?.id ? cf.workspace : null;
};

/** Splits active projects into standalone projects and template workspaces, with real task progress. */
export function summarizeProjects(projects: DashProject[], tasks: ProgressTask[]) {
  const stats = new Map<string, { done: number; total: number; nextDue: string | null }>();
  for (const t of tasks) {
    if (!t.project_id) continue;
    const s = stats.get(t.project_id) ?? { done: 0, total: 0, nextDue: null };
    s.total++;
    if (!isOpen(t.status)) s.done++;
    else if (t.due_date) { const d = t.due_date.slice(0, 10); if (!s.nextDue || d < s.nextDue) s.nextDue = d; }
    stats.set(t.project_id, s);
  }
  const standalone: ProjectSummary[] = [];
  const ws = new Map<string, WorkspaceSummary>();
  for (const p of projects) {
    const s = stats.get(p.id) ?? { done: 0, total: 0, nextDue: null };
    const w = wsOf(p);
    if (w?.id) {
      const cur = ws.get(w.id) ?? { id: w.id, name: w.name || 'Workspace', boards: 0, open: 0, href: `/workspaces/${w.id}` };
      cur.boards++; cur.open += s.total - s.done;
      ws.set(w.id, cur);
    } else {
      standalone.push({ id: p.id, name: p.name, color: p.color, status: p.status, deadline: p.deadline, ...s, href: `/project-management?view=list&project=${p.id}` });
    }
  }
  return { projects: standalone, workspaces: [...ws.values()] };
}

/** Active projects with a deadline, soonest first. */
export const projectDeadlines = (projects: DashProject[], limit = 5) =>
  projects.filter((p) => p.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)).slice(0, limit);
