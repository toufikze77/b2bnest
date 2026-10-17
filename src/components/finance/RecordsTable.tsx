import { ReactNode, useState } from 'react';
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { Column, DataTable } from '@/components/data/DataTable';
import { usePhone } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface RecordFilter<T> { value: string; label: string; test: (r: T) => boolean }
export interface RecordCard { title: string; lines: ReactNode[]; chip?: ReactNode; amount?: ReactNode }

interface Props<T extends { id: string }> {
  id: string;
  title: string;
  description: string;
  noun: string;
  nounPlural: string;
  rows: T[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  searchLabel: string;
  searchText: (r: T) => string;
  filters: RecordFilter<T>[];
  columns: Column<T>[];
  card: (r: T) => RecordCard;
  rowName: (r: T) => string;
  onAdd: () => void;
  addLabel: string;
  onEdit: (r: T) => void;
  onDelete: (r: T) => void;
  extraActions?: (r: T) => { label: string; onSelect: () => void }[];
  headerActions?: ReactNode;
  /** Shown under the row count for the rows currently listed (e.g. a running total). */
  summary?: (visible: T[]) => ReactNode;
  /** A second filter as a dropdown (e.g. expense category), for lists too long to show as chips. */
  selectFilter?: { label: string; allLabel: string; options: RecordFilter<T>[] };
  initialSort?: { id: string; dir: 'asc' | 'desc' };
}

const PHONE_PAGE = 25;

/** Money-out list: search, filter chips, row count, row actions (Edit, Delete, …), phone cards with 44px targets. */
export function RecordsTable<T extends { id: string }>(p: Props<T>) {
  const phone = usePhone();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PHONE_PAGE);
  const q = query.trim().toLowerCase();
  const [selectValue, setSelectValue] = useState('all');
  const active = p.filters.find((f) => f.value === filter);
  const selected = p.selectFilter?.options.find((o) => o.value === selectValue);
  const rows = p.rows.filter((r) => (!active || active.test(r)) && (!selected || selected.test(r)) && (!q || p.searchText(r).toLowerCase().includes(q)));
  const filtered = !!q || filter !== 'all' || !!selected;
  const clear = () => { setQuery(''); setFilter('all'); setSelectValue('all'); setShown(PHONE_PAGE); };

  // Not modal: the menu opens dialogs (Edit, Delete), and a modal menu would fight them for focus.
  const actions = (r: T) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-9 md:w-9" aria-label={`Actions for ${p.noun} ${p.rowName(r)}`}>
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => p.onEdit(r)}><Edit className="mr-2 h-4 w-4" aria-hidden="true" />Edit</DropdownMenuItem>
        {(p.extraActions?.(r) ?? []).map((a) => <DropdownMenuItem key={a.label} onSelect={a.onSelect}>{a.label}</DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => p.onDelete(r)}><Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden="true" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const addButton = <Button onClick={p.onAdd} className="min-h-touch md:min-h-0"><Plus className="h-4 w-4" aria-hidden="true" />{p.addLabel}</Button>;
  const empty = (
    <div className="flex flex-col items-center gap-3 rounded-control border border-dashed p-8 text-center text-body text-muted-foreground">
      <p>No {p.nounPlural} yet.</p>
      {addButton}
    </div>
  );

  return (
    <section aria-labelledby={`${p.id}-heading`} className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 id={`${p.id}-heading`} className="text-card-title">{p.title}</h2>
          <p className="text-small text-muted-foreground">{p.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">{addButton}{p.headerActions}</div>
      </div>

      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter" className="flex gap-2 overflow-x-auto">
          {p.filters.map((f) => {
            const on = filter === f.value;
            const n = p.rows.filter(f.test).length;
            return (
              <button key={f.value} type="button" aria-pressed={on} onClick={() => { setFilter(f.value); setShown(PHONE_PAGE); }}
                className={cn('min-h-touch shrink-0 rounded-full border px-4 text-body font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-9',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted')}>
                {f.label} <span className="tabular-nums">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
        {p.selectFilter && p.selectFilter.options.length > 0 && (
          <Select value={selectValue} onValueChange={(v) => { setSelectValue(v); setShown(PHONE_PAGE); }}>
            <SelectTrigger aria-label={p.selectFilter.label} className="h-11 w-full sm:w-56 md:h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{p.selectFilter.allLabel}</SelectItem>
              {p.selectFilter.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label} ({p.rows.filter(o.test).length})</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="relative w-full md:w-72">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={p.searchLabel} placeholder={p.searchLabel} className="h-11 pl-10 md:h-10" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PHONE_PAGE); }} />
        </div>
        </div>
      </div>

      {p.loading ? <div className="p-4"><LoadingRows label={`Loading ${p.nounPlural}`} /></div>
        : p.error ? <div className="p-4"><ErrorState title={`Your ${p.nounPlural} couldn't be loaded`} description="This is a loading problem, not missing data." onRetry={p.onRetry} /></div>
        : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3 text-small text-muted-foreground">
              <p aria-live="polite">{filtered ? `Showing ${rows.length} of ${p.rows.length} ${p.nounPlural}` : `${p.rows.length} ${p.rows.length === 1 ? p.noun : p.nounPlural}`}</p>
              {p.summary && p.rows.length > 0 && <div>{p.summary(rows)}</div>}
            </div>
            {phone ? (
              rows.length === 0 ? (
                <div className="p-4">
                  {filtered
                    ? <div className="rounded-control border border-dashed p-6 text-center text-body text-muted-foreground">No {p.nounPlural} match. <button type="button" onClick={clear} className="font-semibold text-link underline">Clear filters</button></div>
                    : empty}
                </div>
              ) : (
                <>
                  <ul aria-label={p.title} className="divide-y divide-border">
                    {rows.slice(0, shown).map((r) => {
                      const c = p.card(r);
                      return (
                        <li key={r.id} className="flex items-center gap-2 px-4 py-3">
                          <button type="button" onClick={() => p.onEdit(r)} aria-label={`Edit ${p.noun} ${c.title}`} className="flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold text-foreground">{c.title}</span>
                              {c.lines.map((l, i) => <span key={i} className="block truncate text-small text-muted-foreground">{l}</span>)}
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              {c.chip}
                              {c.amount != null && <span className="text-small font-semibold tabular-nums text-foreground">{c.amount}</span>}
                            </span>
                          </button>
                          {actions(r)}
                        </li>
                      );
                    })}
                  </ul>
                  {rows.length > shown && (
                    <div className="p-4"><Button variant="outline" className="min-h-touch w-full" onClick={() => setShown((n) => n + PHONE_PAGE)}>Show more ({rows.length - shown} left)</Button></div>
                  )}
                </>
              )
            ) : (
              <div className="p-4 pt-3">
                <DataTable caption={p.title} rows={rows} rowKey={(r) => r.id} filtered={filtered} onClearFilters={clear} empty={empty}
                  initialSort={p.initialSort} rowActions={actions} columns={p.columns} />
              </div>
            )}
          </>
        )}
    </section>
  );
}
