import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * One headline figure: label (sentence case), value, and a one-line hint that says what it is
 * counted from. `value` null = not enough data, shown as "—" with the hint saying why.
 * No invented deltas or trends.
 */
export function StatTile({ label, value, hint, loading }: { label: string; value: ReactNode | null; hint?: ReactNode; loading?: boolean }) {
  return (
    <div className="min-w-0 rounded-card border border-border bg-card p-4">
      <p className="text-small font-semibold text-muted-foreground">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 break-words text-2xl font-bold tabular-nums text-foreground">{value ?? '—'}</p>}
      {hint && !loading && <p className="mt-0.5 text-small text-muted-foreground">{hint}</p>}
    </div>
  );
}
