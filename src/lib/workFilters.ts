/**
 * Shared task filters for Projects & tasks and workspace boards.
 * Filters live in the URL (q, status, priority, assignee, from, to) so they
 * survive refresh, direct links and Back/Forward. Dates are calendar days
 * (yyyy-MM-dd) compared as strings — no time-zone conversion.
 */
export interface WorkFilters {
  q: string;
  status: string; // 'all' or a status key
  priority: string; // 'all' or a priority key
  assignee: string; // 'all' | 'unassigned' | name/id
  from: string; // yyyy-MM-dd or ''
  to: string; // yyyy-MM-dd or ''
}

export const EMPTY_FILTERS: WorkFilters = { q: '', status: 'all', priority: 'all', assignee: 'all', from: '', to: '' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readWorkFilters(params: URLSearchParams): WorkFilters {
  const day = (v: string | null) => (v && DAY.test(v) ? v : '');
  return {
    q: params.get('q') ?? '',
    status: params.get('status') || 'all',
    priority: params.get('priority') || 'all',
    assignee: params.get('assignee') || 'all',
    from: day(params.get('from')),
    to: day(params.get('to')),
  };
}

export function writeWorkFilters(params: URLSearchParams, f: Partial<WorkFilters>): URLSearchParams {
  const next = new URLSearchParams(params);
  const merged = { ...readWorkFilters(params), ...f };
  (Object.keys(EMPTY_FILTERS) as (keyof WorkFilters)[]).forEach((k) => {
    const v = merged[k];
    if (!v || v === EMPTY_FILTERS[k]) next.delete(k);
    else next.set(k, v);
  });
  return next;
}

export const activeFilterCount = (f: WorkFilters) =>
  (Object.keys(EMPTY_FILTERS) as (keyof WorkFilters)[]).filter((k) => f[k] !== EMPTY_FILTERS[k]).length;

/** Local calendar day for a Date, or the first 10 chars of a date string. */
export function toDay(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface FilterableTask {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assignee?: string | null;
  dueDate?: Date | string | null;
}

export function applyWorkFilters<T extends FilterableTask>(tasks: T[], f: WorkFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return tasks.filter((t) => {
    if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.status !== 'all' && t.status !== f.status) return false;
    if (f.priority !== 'all' && t.priority !== f.priority) return false;
    if (f.assignee !== 'all') {
      const a = (t.assignee || '').trim();
      const unassigned = !a || a === 'Unassigned';
      if (f.assignee === 'unassigned' ? !unassigned : a !== f.assignee) return false;
    }
    if (f.from || f.to) {
      const day = toDay(t.dueDate ?? null);
      if (!day) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    return true;
  });
}
