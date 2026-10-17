import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Option B card: white, 12px radius, #DDE4F0 border, 18px bold heading. Renders as a labelled region. */
export function WidgetCard({ id, title, description, scope, action, children, className }: {
  id: string; title: string; description?: string; scope?: 'company' | 'personal'; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-card shadow-[0_1px_2px_rgba(0,26,76,0.06)]', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 id={id} className="text-card-title text-foreground">{title}</h2>
          {(description || scope === 'personal') && (
            <p className="mt-0.5 text-small text-muted-foreground">
              {description}
              {scope === 'personal' && <>{description ? ' · ' : ''}<span className="font-semibold">Your own records</span></>}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="min-w-0 flex-1 border-t border-border">{children}</div>
    </section>
  );
}

/** A big number with a label, used inside widgets. `value` null = unavailable, never shown as zero. */
export function Figure({ label, value, hint }: { label: string; value: ReactNode | null; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-small font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-bold tabular-nums tracking-tight text-foreground">{value === null ? '—' : value}</p>
      {(hint || value === null) && <p className="mt-0.5 text-small text-muted-foreground">{value === null ? 'Unavailable' : hint}</p>}
    </div>
  );
}

export const rowLink = 'flex min-h-touch items-center gap-3 px-5 py-2.5 text-body hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring';
export const textLink = 'font-semibold text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-sm';
