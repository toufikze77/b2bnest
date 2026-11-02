import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAiCredits } from '@/hooks/useAiCredits';
import { useAccess } from '@/hooks/useAccess';
import {
  CREDITS_LOAD_ERROR, creditLevel, creditPercent, creditsLeftLine, monthlyOf, NOT_STARTED_LINE, resetLine, topupLine, TRIAL_LINE, type CreditLevel,
} from '@/lib/aiCredits';

interface Props {
  /** 'card': full panel with a progress bar. 'compact': one line for headers and dialogs. */
  variant?: 'card' | 'compact';
  /** An extra line under the card (for example what each feature costs). */
  note?: string;
  className?: string;
}

const BAR: Record<CreditLevel, string> = { ok: 'bg-primary', low: 'bg-warning', critical: 'bg-destructive', none: 'bg-muted-foreground' };
const TEXT: Record<CreditLevel, string> = { ok: 'text-foreground', low: 'text-warning', critical: 'text-destructive', none: 'text-muted-foreground' };

/**
 * Phase 30c: the customer's AI credit balance (src/hooks/useAiCredits.ts). Theme tokens only (dark-mode safe), a skeleton
 * of the same size while loading, and a quiet error with Retry instead of a toast.
 */
export default function AICreditsDisplay({ variant = 'card', note, className }: Props) {
  const { credits, loading, error, refetch } = useAiCredits();
  const access = useAccess();
  const compact = variant === 'compact';

  if (loading) {
    return compact
      ? <Skeleton className={cn('h-5 w-56', className)} data-testid="ai-credits-loading" />
      : <Skeleton className={cn('h-[7.5rem] w-full rounded-lg', className)} data-testid="ai-credits-loading" />;
  }

  if (error || !credits) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', !compact && 'rounded-lg border border-border bg-card p-4', className)} data-testid="ai-credits-error">
        <span>{CREDITS_LOAD_ERROR}</span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void refetch()} className="h-7 px-2">
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />Retry
        </Button>
      </div>
    );
  }

  // Phase 37: the bar and level are the monthly allowance; purchased (top-up) credits are a separate line.
  const monthly = monthlyOf(credits);
  const level = creditLevel(monthly, credits.limit);
  const left = creditsLeftLine(credits);
  const topup = topupLine(credits);
  const sub = credits.notStarted
    ? [access.inTrial ? TRIAL_LINE : null, NOT_STARTED_LINE].filter(Boolean).join('. ')
    : resetLine(credits.resetDate);

  if (compact) {
    return (
      <p className={cn('flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground', className)} data-testid="ai-credits-compact">
        <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className={cn('font-medium', TEXT[level])}>{left}</span>
        {topup && <>{' '}<span className="font-medium text-foreground" data-testid="ai-credits-topup">{topup}</span></>}
        {sub && <>{' '}<span>· {sub}</span></>}
      </p>
    );
  }

  const pct = creditPercent(monthly, credits.limit);
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4 text-card-foreground', className)} aria-labelledby="ai-credits-title" data-testid="ai-credits-card" data-level={level}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 p-2"><Zap className="h-4 w-4 text-primary" aria-hidden /></span>
          <div>
            <h2 id="ai-credits-title" className="text-sm font-semibold">AI credits</h2>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-semibold', TEXT[level])}>{left}</p>
          {topup && <p className="text-xs font-medium text-foreground" data-testid="ai-credits-topup">{topup}</p>}
        </div>
      </div>
      {credits.limit > 0 && (
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="AI credits left this month"
          aria-valuemin={0}
          aria-valuemax={credits.limit}
          aria-valuenow={Math.max(0, monthly)}
          aria-valuetext={left}
        >
          <div className={cn('h-full rounded-full transition-all', BAR[level])} style={{ width: `${pct}%` }} />
        </div>
      )}
      {(level === 'low' || level === 'critical') && (
        <p className={cn('mt-2 text-xs', TEXT[level])}>Running low. Credits reset each month; a bigger plan has more.</p>
      )}
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
