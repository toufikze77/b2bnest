/** Pure helpers for the workspace board view (unit-tested). */

export type ColumnField = 'title' | 'status' | 'priority' | 'due_date' | 'estimated_hours' | 'group';

export interface BoardColumn {
  label: string;
  field: ColumnField | null; // null = defined by the template but not supported
}

const FIELD_BY_LABEL: Record<string, ColumnField> = {
  task: 'title', item: 'title', name: 'title', title: 'title',
  status: 'status', stage: 'status',
  priority: 'priority',
  due: 'due_date', 'due date': 'due_date', deadline: 'due_date', date: 'due_date',
  estimate: 'estimated_hours', 'estimated hours': 'estimated_hours', hours: 'estimated_hours',
  group: 'group',
};

export const fieldForColumn = (label: string): ColumnField | null =>
  FIELD_BY_LABEL[label.trim().toLowerCase()] ?? null;

/**
 * Keeps the template's column order. Supported columns map to task fields,
 * unsupported ones stay in place with field = null. A task-title column is
 * prepended only if the template has none; duplicate field mappings are kept
 * once (first occurrence wins) so a value is never shown twice. Boards with
 * no template columns fall back to DEFAULT_COLUMNS.
 */
export const DEFAULT_COLUMNS = ['Task', 'Status', 'Priority', 'Due date', 'Estimated hours'];

export const buildColumns = (templateColumns: string[]): BoardColumn[] => {
  if (!templateColumns.length) templateColumns = DEFAULT_COLUMNS; // board without defined columns
  const seen = new Set<ColumnField>();
  const cols: BoardColumn[] = [];
  for (const label of templateColumns) {
    const field = fieldForColumn(label);
    if (field && seen.has(field)) continue;
    if (field) seen.add(field);
    cols.push({ label, field });
  }
  if (!seen.has('title')) cols.unshift({ label: 'Task', field: 'title' });
  return cols;
};

/**
 * Groups tasks by template group, preserving template order and keeping empty
 * groups. Tasks whose label matches no template group go into "Other" (only
 * shown when non-empty).
 */
export const groupTasks = <T extends { labels: string[] | null }>(tasks: T[], groups: string[]) => {
  const map = new Map<string, T[]>();
  groups.forEach((g) => map.set(g, []));
  const other: T[] = [];
  for (const t of tasks) {
    const g = t.labels?.find((l) => map.has(l));
    if (g) map.get(g)!.push(t);
    else other.push(t);
  }
  const result = [...map.entries()].map(([name, list]) => ({ name, tasks: list }));
  if (other.length) result.push({ name: 'Other', tasks: other });
  return result;
};

export const contextKey = (org: string | null, workspace: string | undefined, board: string | null | undefined) =>
  `${org ?? ''}|${workspace ?? ''}|${board ?? ''}`;
