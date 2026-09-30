import { ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoResults } from '@/components/ui/states';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  caption: string;
  empty?: ReactNode;
  filtered?: boolean;
  onClearFilters?: () => void;
  rowActions?: (row: T) => ReactNode;
  initialSort?: { id: string; dir: 'asc' | 'desc' };
}

export function sortRows<T>(rows: T[], col: Column<T> | undefined, dir: 'asc' | 'desc') {
  if (!col?.sortValue) return rows;
  const f = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = col.sortValue!(a), y = col.sortValue!(b);
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { sensitivity: 'base' })) * f;
  });
}

/** Shared table with sortable headers, pagination and a row actions slot. */
export function DataTable<T>({ rows, columns, rowKey, pageSize = 25, caption, empty, filtered, onClearFilters, rowActions, initialSort }: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => sortRows(rows, columns.find((c) => c.id === sort?.id), sort?.dir ?? 'asc'), [rows, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  if (!rows.length) return <>{filtered ? <NoResults onClear={onClearFilters} /> : empty}</>;

  const toggle = (id: string) => {
    setSort((s) => (s?.id === id ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'asc' }));
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto rounded-lg border bg-card [contain:inline-size]">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => {
                const dir = sort?.id === c.id ? sort.dir : null;
                return (
                  <th key={c.id} scope="col" aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined} className={`px-3 py-2.5 font-medium ${c.className ?? ''}`}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggle(c.id)} className="inline-flex items-center gap-1 rounded-sm uppercase hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {c.header}
                        {dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : dir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
              {rowActions && <th scope="col" className="px-3 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={rowKey(r)} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((c) => <td key={c.id} className={`px-3 py-2.5 ${c.className ?? ''}`}>{c.cell(r)}</td>)}
                {rowActions && <td className="px-3 py-2.5 text-right">{rowActions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 1}><ChevronLeft className="h-4 w-4" />Previous</Button>
            <span aria-current="page">Page {current} of {pages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(current + 1)} disabled={current === pages}>Next<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </nav>
      )}
    </div>
  );
}
