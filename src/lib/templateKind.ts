import { WorkspaceTemplate } from '@/types/workspaceTemplate';

/**
 * Project template  = one board → creates one ordinary project.
 * Workspace template = several boards → creates a grouped workspace that
 * opens in the dedicated workspace view (/workspaces/:id).
 */
export type TemplateKind = 'project' | 'workspace';

export const getTemplateKind = (t: Pick<WorkspaceTemplate, 'boards'>): TemplateKind =>
  t.boards.length > 1 ? 'workspace' : 'project';

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  project: 'Project template',
  workspace: 'Workspace template',
};

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
