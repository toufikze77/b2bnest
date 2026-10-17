import { useMemo } from 'react';
import { AlertTriangle, ChevronRight, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { StatTile } from '@/components/charts';
import { CurrencyTotals } from '@/lib/dashboardWidgets';
import { formatDueDate, isoDay } from '@/lib/dashboardData';
import { countOf, FinDoc, FinExpense, financeSummary, needsAttention, paidWithoutDateNote, recentDocuments } from '@/lib/financeSummary';
import { formatMoney, formatTotals } from '@/lib/money';
import { InvoiceStatusChip, QuoteStatusChip } from './DocStatusChip';

interface Props<Q extends FinDoc, I extends FinDoc> {
  quotes: Q[];
  invoices: I[];
  expenses: FinExpense[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  numberOf: (d: Q | I) => string;
  onOpen: (d: Q | I) => void;
  onNew: (type: 'invoice' | 'quote') => void;
  onOpenTab: (tab: 'invoices' | 'quotes') => void;
}

const plural = (n: number, noun: string) => `${n} ${n === 1 ? noun : `${noun}s`}`;
/** Per-currency total, or null (shown as "—") when there are none. */
const totals = (t: CurrencyTotals) => (t.length ? formatTotals(t) : null);

/** Overview: four tiles, overdue invoices oldest first, and the newest documents. All from loaded documents. */
export function FinanceOverview<Q extends FinDoc, I extends FinDoc>({ quotes, invoices, expenses, loading, error, onRetry, numberOf, onOpen, onNew, onOpenTab }: Props<Q, I>) {
  const today = isoDay(new Date());
  const s = useMemo(() => financeSummary(invoices, quotes, expenses), [invoices, quotes, expenses]);
  const overdue = useMemo(() => needsAttention(invoices, today), [invoices, today]);
  const recent = useMemo(() => recentDocuments(quotes, invoices, 6), [quotes, invoices]);
  const none = !quotes.length && !invoices.length;

  if (error) return <ErrorState title="Quotes and invoices couldn't be loaded" description="This is a loading problem, not missing data." onRetry={onRetry} className="rounded-card" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Invoice figures">
        <StatTile loading={loading} label="Outstanding" value={totals(s.outstanding)} hint={s.outstanding.length ? `${plural(countOf(s.outstanding), 'invoice')} sent, not paid.` : 'No unpaid sent invoices.'} />
        <StatTile loading={loading} label="Overdue" value={totals(s.overdue)} hint={s.overdue.length ? `${plural(countOf(s.overdue), 'invoice')} past the due date.` : 'Nothing past its due date.'} />
        <StatTile loading={loading} label="Paid last 30 days" value={totals(s.paidLast30)} hint={<>
          {s.paidLast30.length ? `${plural(countOf(s.paidLast30), 'paid invoice')}, by the date marked paid.` : 'No invoices marked paid in the last 30 days.'}
          {/* Paid date = paid_at; invoices marked paid before it was recorded fall back to invoice date. */}
          {paidWithoutDateNote(s.paidWithoutDate) && <span className="mt-1 block">{paidWithoutDateNote(s.paidWithoutDate)}</span>}
        </>} />
        <StatTile loading={loading} label="Drafts" value={String(countOf(s.drafts))} hint={s.drafts.length ? `Draft invoices worth ${formatTotals(s.drafts)}.` : 'No draft invoices.'} />
      </div>
      {!loading && (s.outstanding.length > 1 || s.paidLast30.length > 1) && (
        <p className="text-small text-muted-foreground">Totals are shown per currency and never converted.</p>
      )}

      {!loading && none ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card p-8 text-center">
          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-body text-muted-foreground">No data yet. Create your first invoice or quote and the figures above fill in from it.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button className="min-h-touch md:min-h-0" onClick={() => onNew('invoice')}><Plus className="h-4 w-4" aria-hidden="true" />New invoice</Button>
            <Button variant="outline" className="min-h-touch md:min-h-0" onClick={() => onNew('quote')}><Plus className="h-4 w-4" aria-hidden="true" />New quote</Button>
          </div>
        </div>
      ) : !loading && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-labelledby="attention-heading" className="rounded-card border border-border bg-card">
            <header className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 id="attention-heading" className="text-card-title">Needs attention</h2>
                <p className="text-small text-muted-foreground">Overdue invoices, oldest due date first.</p>
              </div>
              {overdue.length > 0 && <Button variant="ghost" size="sm" className="min-h-touch md:min-h-0" onClick={() => onOpenTab('invoices')}>All invoices</Button>}
            </header>
            {overdue.length === 0 ? (
              <p className="p-4 text-body text-muted-foreground">Nothing needs attention. No invoice is past its due date.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overdue.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onOpen(d)} className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">Invoice {numberOf(d)}</span>
                        <span className="block truncate text-small text-muted-foreground">{d.client_name || 'No client name'} · due {d.due_date ? formatDueDate(d.due_date) : '—'}</span>
                      </span>
                      <span className="shrink-0 text-small font-semibold tabular-nums">{formatMoney(Number(d.total_amount) || 0, d.currency, { cents: true })}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {overdue.length > 6 && <p className="border-t border-border px-4 py-2 text-small text-muted-foreground">And {overdue.length - 6} more on the Invoices tab.</p>}
          </section>

          <section aria-labelledby="recent-heading" className="rounded-card border border-border bg-card">
            <header className="border-b border-border p-4">
              <h2 id="recent-heading" className="text-card-title">Recent documents</h2>
              <p className="text-small text-muted-foreground">The newest quotes and invoices.</p>
            </header>
            <ul className="divide-y divide-border">
              {recent.map(({ kind, doc }) => (
                <li key={`${kind}-${doc.id}`}>
                  <button type="button" onClick={() => onOpen(doc)} className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{kind === 'quote' ? 'Quote' : 'Invoice'} {numberOf(doc)}</span>
                      <span className="block truncate text-small text-muted-foreground">{doc.client_name || 'No client name'} · {formatDueDate(doc.created_at)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {kind === 'quote' ? <QuoteStatusChip doc={doc} /> : <InvoiceStatusChip doc={doc} today={today} />}
                      <span className="text-small font-semibold tabular-nums">{formatMoney(Number(doc.total_amount) || 0, doc.currency, { cents: true })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
