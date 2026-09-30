import { AlertTriangle, Lock, SearchX } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Shared state treatments (UI Wave 2). Pair with EmptyState for "nothing yet". */

export function LoadingRows({ rows = 3, label = 'Loading', className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={cn('space-y-2 p-4', className)}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 border border-destructive/40 bg-destructive/5 p-4 text-sm', className)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function PermissionDenied({ title = "You don't have access", description = 'Ask your company owner or admin for access.', action, className }: { title?: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 border border-border bg-muted/20 px-6 py-10 text-center', className)}>
      <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function NoResults({ query, onClear, className }: { query?: string; onClear?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-base font-semibold">No results{query ? ` for “${query}”` : ''}</h3>
      <p className="text-sm text-muted-foreground">Try a different search or clear the filters.</p>
      {onClear && <Button size="sm" variant="outline" className="mt-2" onClick={onClear}>Clear search</Button>}
    </div>
  );
}
