import { ReactNode, useId, useState } from 'react';
import { AlertTriangle, BarChart3, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Plain table version of a chart ("View as table"). Cells are already-formatted text. */
export interface ChartTable { caption: string; columns: string[]; rows: (string | number)[][] }

export type ChartState = 'loading' | 'error' | 'empty' | 'ready';

/** Empty state: a short message and, when there is one, the next action. */
export function ChartEmpty({ message, action, className }: { message: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-control border border-dashed border-border px-6 py-8 text-center', className)}>
      <BarChart3 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-sm text-body text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

/**
 * The one card every chart sits in: white, 12px radius, #DDE4F0 border, 18px bold title,
 * a one-line muted subtitle, optional controls, and a "View as table" toggle that shows
 * the same data in a real table. The chart itself is announced as an image with `summary`.
 */
export function ChartCard({
  title, subtitle, controls, state = 'ready', summary, table, empty, onRetry, footer, children, className,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  state?: ChartState;
  /** One or two sentences that say what the chart shows, for screen readers. */
  summary: string;
  table?: ChartTable;
  empty?: { message: string; action?: ReactNode };
  onRetry?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [asTable, setAsTable] = useState(false);
  const ready = state === 'ready';
  return (
    <section aria-labelledby={`${id}-t`} className={cn('flex min-w-0 flex-col rounded-card border border-border bg-card p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="text-card-title text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-small text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {ready && table && (
            <Button variant="outline" size="sm" className="min-h-touch md:min-h-0" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
              {asTable ? <BarChart3 className="h-4 w-4" aria-hidden="true" /> : <Table2 className="h-4 w-4" aria-hidden="true" />}
              {asTable ? 'View as chart' : 'View as table'}
            </Button>
          )}
        </div>
      </header>
      {state === 'loading' ? (
        <div role="status" aria-label={`Loading ${title}`} className="space-y-3">
          <Skeleton className="h-48 w-full rounded-control" />
          <Skeleton className="h-4 w-2/3" />
          <span className="sr-only">Loading…</span>
        </div>
      ) : state === 'error' ? (
        <div role="alert" className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-control border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          <p className="text-body text-foreground">{title} couldn't be loaded. This is a loading problem, not missing data.</p>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
        </div>
      ) : state === 'empty' ? (
        <ChartEmpty message={empty?.message ?? 'No data yet.'} action={empty?.action} />
      ) : asTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr className="border-b border-border text-left text-small text-muted-foreground">
                {table.columns.map((c, i) => <th key={c} scope="col" className={cn('px-2 py-2 font-semibold', i > 0 && 'text-right')}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((v, j) => j === 0
                    ? <th key={j} scope="row" className="px-2 py-2 text-left font-medium">{v}</th>
                    : <td key={j} className="px-2 py-2 text-right tabular-nums">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={summary} className="min-w-0">{children}</div>
      )}
      {footer && ready && <div className="mt-3 space-y-1 text-small text-muted-foreground">{footer}</div>}
    </section>
  );
}
