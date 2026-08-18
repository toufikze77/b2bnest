import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { ReactNode } from 'react';

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  change?: number | null;
  changeLabel?: string;
  icon?: ReactNode;
  hint?: string;
}

export default function AdminStatCard({ label, value, change, changeLabel = 'this month', icon, hint }: AdminStatCardProps) {
  const hasChange = typeof change === 'number' && isFinite(change);
  const positive = hasChange && (change as number) >= 0;

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground truncate">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
            {hasChange ? (
              <p className={`mt-1 flex items-center gap-1 text-xs ${positive ? 'text-emerald-500' : 'text-destructive'}`}>
                {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {`${positive ? '+' : ''}${(change as number).toFixed(1)}% ${changeLabel}`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{hint ?? 'No historical data'}</p>
            )}
          </div>
          {icon && <div className="rounded-lg bg-muted p-2 text-muted-foreground">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
