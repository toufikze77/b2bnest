/**
 * Projects & tasks view state lives in the URL (single source of truth).
 * - Task views use `?view=` (kanban | list | calendar | timeline). The visible "Board" label = `kanban`.
 * - Other tabs use `?tab=` (summary | forms | goals | all | archived | teams).
 * - Default (no param) = Board. `project=<id>` and unrelated params are preserved.
 */
export const PM_VIEWS = ['kanban', 'list', 'calendar', 'timeline'] as const;
export const PM_TABS = ['summary', 'forms', 'goals', 'all', 'archived', 'teams'] as const;
export type PmView = (typeof PM_VIEWS)[number];
export type PmTab = PmView | (typeof PM_TABS)[number];
export const DEFAULT_PM_TAB: PmTab = 'kanban';

const VIEW_ALIASES: Record<string, PmView> = { board: 'kanban', kanban: 'kanban', list: 'list', calendar: 'calendar', timeline: 'timeline' };
const isView = (v: string): v is PmView => (PM_VIEWS as readonly string[]).includes(v);
const isTab = (v: string): v is PmTab => isView(v) || (PM_TABS as readonly string[]).includes(v);

/** Reads the active tab from URL params; invalid values fall back to the default. `tab` wins over `view`. */
export function readPmTab(params: URLSearchParams): PmTab {
  const tab = params.get('tab')?.toLowerCase();
  if (tab) {
    if (VIEW_ALIASES[tab]) return VIEW_ALIASES[tab];
    if (isTab(tab)) return tab;
  }
  const view = params.get('view')?.toLowerCase();
  if (view && VIEW_ALIASES[view]) return VIEW_ALIASES[view];
  return DEFAULT_PM_TAB;
}

/** Returns new params with the tab written canonically; everything else is kept. */
export function writePmTab(params: URLSearchParams, tab: PmTab): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('tab');
  next.delete('view');
  if (tab === DEFAULT_PM_TAB) next.set('view', 'kanban');
  else if (isView(tab)) next.set('view', tab);
  else next.set('tab', tab);
  return next;
}

/** Canonical form of the current URL (normalizes invalid/alias values). Only rewrites when a view/tab param exists. */
export function normalizePmParams(params: URLSearchParams): URLSearchParams | null {
  if (!params.has('tab') && !params.has('view')) return null;
  const next = writePmTab(params, readPmTab(params));
  return next.toString() === params.toString() ? null : next;
}

export const readPmProject = (params: URLSearchParams) => params.get('project') || 'all';
export function writePmProject(params: URLSearchParams, projectId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!projectId || projectId === 'all') next.delete('project');
  else next.set('project', projectId);
  return next;
}
