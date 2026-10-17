import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, CheckCircle2, Download, Edit, Eye, MoreHorizontal, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { statusActions, StatusTarget } from '@/lib/documentActions';
import { activeOnly, archivedNewestFirst } from '@/lib/archive';
import { ErrorState, LoadingRows } from '@/components/ui/states';
import { DataTable } from '@/components/data/DataTable';
import { usePhone } from '@/hooks/use-media-query';
import { formatDueDate } from '@/lib/dashboardData';
import { CHIP_LABEL, FinDoc, invoiceStatus, quoteStatus } from '@/lib/financeSummary';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { InvoiceStatusChip, QuoteStatusChip } from './DocStatusChip';

export interface TableDoc extends FinDoc { valid_until?: string | null; archived_at?: string | null }

interface Props<D extends TableDoc> {
  kind: 'quote' | 'invoice';
  docs: D[];
  numberOf: (d: D) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onNew: () => void;
  onView: (d: D) => void;
  onEdit: (d: D) => void;
  onDownload: (d: D) => void;
  /** Mark as sent / paid / unpaid. Only records the status: nothing is emailed. */
  onStatus: (d: D, to: StatusTarget) => void;
  /** Active view: Move to archive (the parent confirms). */
  onArchive: (d: D) => void;
  /** Archive view: Restore, and Delete forever (the parent confirms). */
  onRestore: (d: D) => void;
  onDeleteForever: (d: D) => void;
  /** Document with a status change in flight (its status items are disabled). */
  busyId?: string | null;
  /** Active | Archive, when the parent keeps it (in the URL). Without it the table keeps its own. */
  view?: 'active' | 'archive';
  onViewChange?: (v: 'active' | 'archive') => void;
}

const PHONE_PAGE = 25;
const date = (d?: string | null) => (d ? formatDueDate(d) : '—');

/** Quotes or invoices: search, status chips, row count, row actions, phone cards with 44px targets. */
export function DocumentsTable<D extends TableDoc>({ kind, docs, numberOf, loading, error, onRetry, onNew, onView, onEdit, onDownload, onStatus, onArchive, onRestore, onDeleteForever, busyId, view: viewProp, onViewChange }: Props<D>) {
  const phone = usePhone();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [shown, setShown] = useState(PHONE_PAGE);
  // Active | Archive. Archived documents are kept for the record and left out of every total.
  const [ownView, setOwnView] = useState<'active' | 'archive'>('active');
  const view = viewProp ?? ownView;
  const archive = view === 'archive';
  const activeDocs = useMemo(() => activeOnly(docs), [docs]);
  const archivedDocs = useMemo(() => archivedNewestFirst(docs), [docs]);
  const listed = archive ? archivedDocs : activeDocs;
  const noun = kind === 'quote' ? 'quote' : 'invoice';
  const Noun = kind === 'quote' ? 'Quote' : 'Invoice';
  const chipOf = (d: D) => (kind === 'invoice' ? invoiceStatus(d) : quoteStatus(d));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of activeDocs) { const c = kind === 'invoice' ? invoiceStatus(d) : quoteStatus(d); m.set(c, (m.get(c) ?? 0) + 1); }
    return m;
  }, [activeDocs, kind]);
  const base = kind === 'invoice' ? ['draft', 'sent', 'overdue', 'paid'] : ['draft', 'sent'];
  const extra = kind === 'invoice' ? ['cancelled'] : ['other'];
  const filters = [{ value: 'all', label: 'All', n: activeDocs.length },
    ...[...base, ...extra.filter((c) => counts.get(c))].map((c) => ({ value: c, label: CHIP_LABEL[c as keyof typeof CHIP_LABEL], n: counts.get(c) ?? 0 }))];

  const q = query.trim().toLowerCase();
  const rows = listed.filter((d) => (archive || status === 'all' || chipOf(d) === status)
    && (!q || numberOf(d).toLowerCase().includes(q) || (d.client_name || '').toLowerCase().includes(q)));
  const filtered = !!q || (!archive && status !== 'all');
  const switchView = (v: 'active' | 'archive') => { if (onViewChange) onViewChange(v); else setOwnView(v); setStatus('all'); setShown(PHONE_PAGE); };
  const clear = () => { setQuery(''); setStatus('all'); setShown(PHONE_PAGE); };
  const amount = (d: D) => formatMoney(Number(d.total_amount) || 0, d.currency, { cents: true });
  const chip = (d: D) => (kind === 'invoice' ? <InvoiceStatusChip doc={d} /> : <QuoteStatusChip doc={d} />);
  const secondDate = (d: D) => (kind === 'invoice' ? d.due_date : d.valid_until);
  const secondLabel = kind === 'invoice' ? 'Due' : 'Valid until';

  // On phones the whole card opens the document, so only the "More actions" menu sits beside it.
  const actions = (d: D) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => onView(d)} aria-label={`View ${noun} ${numberOf(d)}`}>
        <Eye className="h-4 w-4" aria-hidden="true" /><span className="hidden lg:inline">View</span>
      </Button>
      {/* Not modal: Delete opens a dialog, and a modal menu would fight it for focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 md:h-9 md:w-9" aria-label={`More actions for ${noun} ${numberOf(d)}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        {archive ? (
          // Archived: view, restore, or delete forever. No editing or status changes.
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onRestore(d)} disabled={busyId === d.id}><ArchiveRestore className="mr-2 h-4 w-4" aria-hidden="true" />Restore</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onDeleteForever(d)}><Trash2 className="mr-2 h-4 w-4 text-destructive" aria-hidden="true" />Delete forever</DropdownMenuItem>
          </DropdownMenuContent>
        ) : (
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(d)}><Edit className="mr-2 h-4 w-4" aria-hidden="true" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(d)}><Download className="mr-2 h-4 w-4" aria-hidden="true" />Download PDF</DropdownMenuItem>
            {statusActions(kind, d).map((a) => (
              <DropdownMenuItem key={a.label} onSelect={() => onStatus(d, a.to)} disabled={busyId === d.id}>
                {a.label === 'Mark as unpaid' ? <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />}{a.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onArchive(d)} disabled={busyId === d.id}><Archive className="mr-2 h-4 w-4" aria-hidden="true" />Move to archive</DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );

  const emptyText = archive
    ? `Nothing in the archive. ${Noun}s you move to the archive appear here and can be restored.`
    : `No ${noun}s yet. Use “New ${noun}” to create your first one.`;
  const newButton = archive ? null : <Button onClick={onNew} className="min-h-touch md:min-h-0"><Plus className="h-4 w-4" aria-hidden="true" />New {noun}</Button>;
  const archivedOn = (d: D) => (d.archived_at ? formatDueDate(d.archived_at) : '—');

  return (
    <section aria-labelledby={`${kind}s-heading`} className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id={`${kind}s-heading`} className="text-card-title">{Noun}s</h2>
          <p className="text-small text-muted-foreground">{kind === 'quote' ? 'Quotes are offers. They never count as money in.' : 'Overdue means the due date has passed and the invoice is not marked paid.'}</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={`Search ${noun}s`} placeholder={`Search ${noun} number or client`} className="h-11 pl-10 md:h-10"
            value={query} onChange={(e) => { setQuery(e.target.value); setShown(PHONE_PAGE); }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div role="group" aria-label={`Show active or archived ${noun}s`} className="flex rounded-control border border-border bg-muted p-1">
          {(['active', 'archive'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)}
              className={cn('min-h-touch rounded-[6px] px-3 text-body font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-9',
                view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {v === 'active' ? 'Active' : <>Archive <span className="tabular-nums">({archivedDocs.length})</span></>}
            </button>
          ))}
        </div>
      </div>

      {!archive && <div role="group" aria-label="Filter by status" className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
        {filters.map((f) => {
          const on = status === f.value;
          return (
            <button key={f.value} type="button" aria-pressed={on} onClick={() => { setStatus(f.value); setShown(PHONE_PAGE); }}
              className={cn('min-h-touch shrink-0 rounded-full border px-4 text-body font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-9',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted')}>
              {f.label} <span className="tabular-nums">{f.n}</span>
            </button>
          );
        })}
      </div>}

      {loading ? <div className="p-4"><LoadingRows label={`Loading ${noun}s`} /></div>
        : error ? <div className="p-4"><ErrorState title={`${Noun}s couldn't be loaded`} description="This is a loading problem, not missing data." onRetry={onRetry} /></div>
        : (
          <>
            <p className="px-4 pt-3 text-small text-muted-foreground" aria-live="polite">
              {(() => { const all = listed.length; const what = archive ? `archived ${noun}` : noun;
                return filtered ? `Showing ${rows.length} of ${all} ${what}s` : `${all} ${all === 1 ? what : `${what}s`}`; })()}
            </p>
            {phone ? (
              rows.length === 0 ? (
                <div className="p-4">
                  {filtered
                    ? <div className="rounded-control border border-dashed p-6 text-center text-body text-muted-foreground">No {noun}s match. <button type="button" onClick={clear} className="font-semibold text-link underline">Clear filters</button></div>
                    : <div className="flex flex-col items-center gap-3 rounded-control border border-dashed p-6 text-center text-body text-muted-foreground"><p>{emptyText}</p>{newButton}</div>}
                </div>
              ) : (
                <>
                  <ul aria-label={`Your ${noun}s`} className="divide-y divide-border">
                    {rows.slice(0, shown).map((d) => (
                      <li key={d.id} className="flex items-center gap-2 px-4 py-3">
                        <button type="button" onClick={() => onView(d)} className="flex min-h-touch min-w-0 flex-1 items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-foreground">{Noun} {numberOf(d)}</span>
                            <span className="block truncate text-small text-muted-foreground">{d.client_name || 'No client name'}</span>
                            <span className="block text-small text-muted-foreground">{archive ? `Archived ${archivedOn(d)}` : `${secondLabel}: ${date(secondDate(d))}`}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            {chip(d)}
                            <span className="text-small font-semibold tabular-nums text-foreground">{amount(d)}</span>
                          </span>
                        </button>
                        {actions(d)}
                      </li>
                    ))}
                  </ul>
                  {rows.length > shown && (
                    <div className="p-4"><Button variant="outline" className="min-h-touch w-full" onClick={() => setShown((n) => n + PHONE_PAGE)}>Show more ({rows.length - shown} left)</Button></div>
                  )}
                </>
              )
            ) : (
              <div className="p-4 pt-3">
                <DataTable
                  key={view}
                  caption={archive ? `Archived ${noun}s` : `Your ${noun}s`}
                  rows={rows}
                  rowKey={(d) => d.id}
                  filtered={filtered}
                  onClearFilters={clear}
                  empty={<div className="flex flex-col items-center gap-3 rounded-control border border-dashed p-8 text-center text-sm text-muted-foreground"><p>{emptyText}</p>{newButton}</div>}
                  initialSort={archive ? { id: 'archived', dir: 'desc' } : { id: 'date', dir: 'desc' }}
                  rowActions={actions}
                  columns={[
                    { id: 'number', header: Noun, sortValue: (d) => numberOf(d), cell: (d) => (
                      <button type="button" onClick={() => onView(d)} className="rounded-sm text-left font-semibold text-foreground hover:text-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{numberOf(d)}</button>
                    ) },
                    { id: 'client', header: 'Client', sortValue: (d) => d.client_name, cell: (d) => <span className="block max-w-[16rem] truncate">{d.client_name || <span className="text-muted-foreground">—</span>}</span> },
                    { id: 'status', header: 'Status', sortValue: (d) => chipOf(d), cell: chip },
                    { id: 'amount', header: 'Amount', className: 'text-right', sortValue: (d) => Number(d.total_amount) || 0, cell: (d) => <span className="whitespace-nowrap tabular-nums">{amount(d)}</span> },
                    { id: 'date', header: 'Date', sortValue: (d) => d.created_at, cell: (d) => <span className="whitespace-nowrap">{date(d.created_at)}</span> },
                    archive
                      ? { id: 'archived', header: 'Archived', sortValue: (d) => d.archived_at, cell: (d) => <span className="whitespace-nowrap">{archivedOn(d)}</span> }
                      : { id: 'second', header: secondLabel, sortValue: (d) => secondDate(d), cell: (d) => <span className="whitespace-nowrap">{date(secondDate(d))}</span> },
                  ]}
                />
              </div>
            )}
          </>
        )}
    </section>
  );
}
