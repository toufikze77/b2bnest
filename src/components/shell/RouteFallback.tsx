import { Skeleton } from '@/components/ui/skeleton';

/** Shown while a lazily loaded screen downloads; keeps the shell and header in place. */
export default function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-6xl content-start gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <span className="sr-only">Loading page</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );
}
