import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleSlash, HelpCircle, History, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HISTORY_ROWS, HISTORY_RUNS, HistoryRun, RunLogRow, StepStatus, groupRuns, runTime } from '@/lib/workflowRuns';

const ICON: Record<StepStatus, JSX.Element> = {
  sent: <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />,
  failed: <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />,
  unknown: <HelpCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />,
  skipped: <CircleSlash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />,
};

/** Latest runs of one saved workflow. Reads the user's own rows only (RLS). `refreshKey` reloads after a run. */
export function RunHistory({ workflowId, userId, refreshKey }: { workflowId: string; userId: string; refreshKey: number }) {
  const [runs, setRuns] = useState<HistoryRun[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false); setRuns(null);
    const { data, error: e } = await supabase.from('workflow_run_logs').select('*')
      .eq('workflow_id', workflowId).eq('user_id', userId).order('created_at', { ascending: false }).limit(HISTORY_ROWS);
    if (e) { setError(true); return; }
    setRuns(groupRuns((data ?? []) as unknown as RunLogRow[]));
  }, [workflowId, userId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" />Run history</CardTitle>
        <CardDescription>The latest {HISTORY_RUNS} runs of this workflow. "Sent" means the email provider accepted the email; it doesn't confirm it reached the inbox.</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive" role="alert">Couldn't load the run history. <button className="underline" onClick={load}>Retry</button></p>
        ) : runs === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading run history…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet. When you press "Run now", each step's result appears here.</p>
        ) : (
          <ol className="space-y-3" aria-label="Run history">
            {runs.map((run) => (
              <li key={run.key} className="rounded-md border border-border p-3">
                <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-medium">{runTime(run.at)}</span>
                  <span className="text-xs text-muted-foreground">Run by you</span>
                </p>
                <ul className="space-y-2">
                  {run.steps.map((s, i) => (
                    <li key={s.key} className="flex items-start gap-2 text-sm">
                      {ICON[s.status]}
                      <div className="min-w-0">
                        <p>
                          <span className="text-muted-foreground">Step {(s.index ?? i) + 1} · {s.label}{s.recipients ? ` · ${s.recipients} recipient${s.recipients === 1 ? '' : 's'}` : ''}: </span>
                          <span className="font-medium">{s.statusText}</span>
                        </p>
                        {s.detail && <p className="break-words text-xs text-muted-foreground">{s.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
