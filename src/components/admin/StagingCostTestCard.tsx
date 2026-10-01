import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Temporary one-off test card. Removed together with the staging-cost-test function.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function call(mode: 'plan' | 'status' | 'run') {
  const { data, error } = await supabase.functions.invoke('staging-cost-test', { body: { mode } });
  if (error) {
    let body: any = null;
    try { body = await (error as any).context?.json?.(); } catch { /* ignore */ }
    return { ok: false, body: body ?? { error: error.message } };
  }
  return { ok: true, body: data };
}

const StagingCostTestCard = () => {
  const [plan, setPlan] = useState<any>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const load = async () => {
    const p = await call('plan');
    if (!p.ok) { setPlanErr(p.body?.error ?? 'unavailable'); return; }
    setPlan(p.body);
    if (p.body.alreadyRun) setResult((await call('status')).body?.run);
  };
  useEffect(() => { void load(); }, []);

  const run = async () => {
    setConfirming(false); setRunning(true);
    const r = await call('run');
    setRunning(false);
    setResult(r.body?.results ? r.body : r.body?.run ?? r.body);
    void load();
  };

  const ready = plan && plan.keyConfigured && plan.lockTableReady && !plan.alreadyRun;
  const rows: any[] = result?.results ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>One-off OpenAI cost test (temporary)</CardTitle>
        <CardDescription>Runs once only, ever. Uses live Supabase infrastructure, a separate staging OpenAI key and four fixed example businesses. No customer data or credits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {planErr ? <p role="alert" className="text-destructive">Test unavailable: {planErr}</p> : !plan ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div><dt className="text-muted-foreground">Model</dt><dd>{plan.model}</dd></div>
              <div><dt className="text-muted-foreground">Calls</dt><dd>{plan.calls}, no retries</dd></div>
              <div><dt className="text-muted-foreground">Token limits per call</dt><dd>{plan.maxInputTokensPerCall} in / {plan.maxOutputTokensPerCall} out</dd></div>
              <div><dt className="text-muted-foreground">Maximum batch cost</dt><dd>${plan.worstCaseBatchUsd.toFixed(4)} ≈ £{plan.worstCaseBatchGbpEstimate.toFixed(4)} (estimate; ceiling £{plan.ceilingGbp.toFixed(2)})</dd></div>
            </dl>
            <ul className="list-disc pl-5 text-muted-foreground">{plan.prompts.map((p: string) => <li key={p}>{p}</li>)}</ul>
            {!plan.lockTableReady && <p role="alert" className="text-destructive">Setup incomplete: the run-lock table is missing.</p>}
            {!plan.keyConfigured && <p role="alert" className="text-destructive">Setup incomplete: the staging OpenAI key hasn't been added.</p>}
            {plan.alreadyRun && <p role="status">This test has already been run. It can't be run again.</p>}
            {ready && !confirming && !running && <Button onClick={() => setConfirming(true)}>Run cost test…</Button>}
            {confirming && (
              <div className="flex flex-wrap items-center gap-2">
                <span>Send {plan.calls} calls to {plan.model}, at most ${plan.worstCaseBatchUsd.toFixed(4)}? This can only happen once.</span>
                <Button onClick={run}>Confirm</Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            )}
            {running && <p><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Running (up to a few minutes)…</p>}
          </>
        )}
        {result?.error && <p role="alert" className="text-destructive">Run refused: {result.error}</p>}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-border"><th className="py-1">Business</th><th>Result</th><th>In</th><th>Out</th><th>Cost ($)</th><th>Time</th><th>Output</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.call} className="border-b border-border align-top">
                  <td className="py-1 pr-2">{r.prompt}</td>
                  <td><Badge variant={r.outcome === 'ok' ? 'secondary' : 'destructive'}>{r.outcome}</Badge>{r.errors && <div className="text-xs text-muted-foreground">{r.errors.join('; ')}</div>}</td>
                  <td>{r.inputTokens}</td><td>{r.outputTokens}</td><td>{(r.costUsdMicros / 1e6).toFixed(6)}</td><td>{(r.latencyMs / 1000).toFixed(1)}s</td>
                  <td className="text-xs">{r.quality ? `${r.quality.kind} "${r.quality.name}": ${r.quality.boards} boards, ${r.quality.tasks} tasks — ${r.quality.boardNames.join(', ')}. e.g. ${r.quality.sampleTasks.join('; ')}` : '—'}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StagingCostTestCard;
