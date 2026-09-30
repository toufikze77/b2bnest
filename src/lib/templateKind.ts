import { WorkspaceTemplate } from '@/types/workspaceTemplate';

/**
 * Project template   → creates one ordinary project in Projects & tasks.
 * Workspace template → creates linked boards (one or more) that open in the
 * dedicated workspace view (/workspaces/:id).
 *
 * Resolution order: an explicit `kind` on the template wins; otherwise the
 * template type decides (CRM and multi-component templates are workspaces);
 * board count is only a last-resort fallback. A workspace may have one board.
 */
export type TemplateKind = 'project' | 'workspace';

const WORKSPACE_TYPES = new Set(['crm', 'multi-component']);

export const getTemplateKind = (
  t: Pick<WorkspaceTemplate, 'boards'> & Partial<Pick<WorkspaceTemplate, 'kind' | 'templateType'>>,
): TemplateKind => {
  if (t.kind === 'workspace' || t.kind === 'project') return t.kind;
  if (t.templateType && WORKSPACE_TYPES.has(t.templateType)) return 'workspace';
  return t.boards.length > 1 ? 'workspace' : 'project';
};

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  project: 'Project template',
  workspace: 'Workspace template',
};

/**
 * Template types whose headline capability (dashboards, automations, AI steps)
 * is not built. Creating them would only produce a plain task list, so they
 * are shown as unavailable instead of pretending to deliver the description.
 */
const UNBUILT_TYPES: Record<string, string> = {
  dashboard: 'The dashboard this template describes is not built yet.',
  workflow: 'The automated workflow this template describes is not built yet.',
  automation: 'The automations this template describes are not built yet.',
  'ai-workflow': 'The AI steps this template describes are not built yet.',
};

export interface TemplateAvailability {
  available: boolean;
  reason: string | null;
}

export const getTemplateAvailability = (
  t: Pick<WorkspaceTemplate, 'boards' | 'templateType'> & Partial<Pick<WorkspaceTemplate, 'status'>>,
): TemplateAvailability => {
  if (t.status && t.status !== 'published') return { available: false, reason: 'This template is not published.' };
  const tasks = t.boards.reduce((s, b) => s + b.groups.reduce((a, g) => a + g.tasks.length, 0), 0);
  if (t.boards.length === 0 || tasks === 0) {
    return { available: false, reason: 'This template has no boards or tasks yet.' };
  }
  const unbuilt = UNBUILT_TYPES[t.templateType];
  if (unbuilt) return { available: false, reason: unbuilt };
  return { available: true, reason: null };
};

export class TemplateUnavailableError extends Error {}

/** Views the workspace screen can actually render. */
export const SUPPORTED_VIEW_ALIASES: Record<string, 'table' | 'board' | 'calendar'> = {
  table: 'table',
  list: 'table',
  kanban: 'board',
  board: 'board',
  calendar: 'calendar',
};

export const resolveView = (label: string) =>
  SUPPORTED_VIEW_ALIASES[label.trim().toLowerCase()] ?? null;

/** Template columns that map onto real task fields. */
const SUPPORTED_COLUMN = /^(task|item|name|title|status|stage|priority|due|due date|deadline|date|estimate|estimated hours|hours|group)$/i;
export const isSupportedColumn = (label: string) => SUPPORTED_COLUMN.test(label.trim());

export const TASK_STATUS_KEYS = ['backlog', 'todo', 'in-progress', 'review', 'done'] as const;
export const DEFAULT_STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  'in-progress': 'In progress',
  review: 'Review',
  done: 'Done',
};

/** Template status labels map 1:1 onto the five task statuses when there are exactly five. */
export const statusLabelsFor = (templateStatuses?: string[] | null) => {
  if (templateStatuses && templateStatuses.length === TASK_STATUS_KEYS.length) {
    return Object.fromEntries(TASK_STATUS_KEYS.map((k, i) => [k, templateStatuses[i]]));
  }
  return DEFAULT_STATUS_LABELS;
};
