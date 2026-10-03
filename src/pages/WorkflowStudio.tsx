import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, MousePointerClick, Play, Plus, Save, Trash2, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  STEP_DEFINITIONS, SimpleStep, StepResult, StepKind, parseSavedSteps, serializeSteps, stepDefinition, validateStep, executeStep,
} from '@/lib/workflowSteps';

interface SavedWorkflow { id: string; name: string; description: string | null; workflow_steps: unknown; updated_at: string }

const newStep = (kind: StepKind): SimpleStep => ({
  id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  kind,
  config: Object.fromEntries(stepDefinition(kind).fields.map((f) => [f.key, ''])),
});

const runStep = (step: SimpleStep, workflowId: string | null) =>
  executeStep(step, workflowId, (fn, body) => supabase.functions.invoke(fn, { body }));

const WorkflowStudio = () => {
  const { user } = useAuth();
  const [list, setList] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState('Untitled workflow');
  const [steps, setSteps] = useState<SimpleStep[]>([]);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const runLock = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setLoadError(null);
    const { data, error } = await supabase.from('ai_workflows')
      .select('id, name, description, workflow_steps, updated_at')
      .eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) setLoadError(error.message); else setList((data ?? []) as SavedWorkflow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const open = (w: SavedWorkflow | null, newName = 'Untitled workflow') => {
    setResults({});
    if (!w) { setId(null); setName(newName); setSteps([]); setUnsupported([]); return; }
    const parsed = parseSavedSteps(w.workflow_steps);
    setId(w.id); setName(w.name); setSteps(parsed.steps); setUnsupported(parsed.unsupported);
  };

  const update = (sid: string, key: string, value: string) =>
    setSteps((s) => s.map((x) => (x.id === sid ? { ...x, config: { ...x.config, [key]: value } } : x)));
  const move = (i: number, d: -1 | 1) => setSteps((s) => {
    const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const save = async () => {
    if (!user) return;
    if (unsupported.length) return; // archived legacy workflows are read-only
    setSaving(true);
    const row = { user_id: user.id, name: name.trim() || 'Untitled workflow', workflow_steps: serializeSteps(steps) as never, updated_at: new Date().toISOString() };
    const res = id
      ? await supabase.from('ai_workflows').update(row).eq('id', id).eq('user_id', user.id).select('id')
      : await supabase.from('ai_workflows').insert(row).select('id');
    setSaving(false);
    if (res.error || !res.data?.length) { toast.error(`Workflow not saved: ${res.error?.message ?? 'no changes were stored'}`); return; }
    setId(res.data[0].id); toast.success('Workflow saved'); load();
  };

  const remove = async () => {
    if (!id || !user || unsupported.length || !window.confirm('Delete this workflow? This can\'t be undone.')) return;
    const { error } = await supabase.from('ai_workflows').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Workflow deleted'); open(null); load();
  };

  const problems = steps.map(validateStep).filter(Boolean) as string[];
  const canRun = steps.length > 0 && !unsupported.length && !problems.length && !running;

  const run = async () => {
    if (!canRun || runLock.current) return;
    runLock.current = true;
    try {
      if (!window.confirm(`Run "${name}" now? This really sends ${steps.length} message${steps.length === 1 ? '' : 's'}/post${steps.length === 1 ? '' : 's'}.`)) return;
      setRunning(true); setResults({});
      let failed = 0;
      for (const step of steps) {
        const r = await runStep(step, id).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : 'Failed' }));
        if (!r.ok) failed++;
        setResults((prev) => ({ ...prev, [step.id]: r }));
      }
      if (failed) toast.error(`${failed} of ${steps.length} steps failed — see the results below.`);
      else toast.success('All steps completed');
    } finally {
      setRunning(false);
      runLock.current = false;
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up a list of messages and posts, then send them all with one click.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <Button className="w-full" onClick={() => open(null)}><Plus className="mr-2 h-4 w-4" />New workflow</Button>
          {loading ? <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
            : loadError ? <div className="p-2 text-sm text-destructive">Couldn't load workflows. <button className="underline" onClick={load}>Retry</button></div>
            : list.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No saved workflows yet.</p>
            : (
              <ul className="space-y-1" aria-label="Saved workflows">
                {list.map((w) => {
                  const p = parseSavedSteps(w.workflow_steps);
                  return (
                    <li key={w.id}>
                      <button onClick={() => open(w)} aria-current={w.id === id ? 'true' : undefined}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${w.id === id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <span className="block truncate font-medium">{w.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.unsupported.length ? 'Archived · Can\'t run' : `${p.steps.length} step${p.steps.length === 1 ? '' : 's'}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </aside>

        <section className="space-y-4">
          {unsupported.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{name}</CardTitle>
                  <Badge variant="destructive">Can't run</Badge>
                  <Badge variant="outline">Archived · read-only</Badge>
                </div>
                <CardDescription>Made in the old builder. None of these steps were ever carried out, so this workflow can't run. It's kept exactly as saved and can't be edited here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="list-decimal space-y-1 pl-6 text-sm text-muted-foreground" aria-label="Saved steps">
                  {[...unsupported, ...steps.map((x) => stepDefinition(x.kind).label)].map((n, i) => <li key={i}>{n}</li>)}
                </ol>
                <Button onClick={() => open(null, `${name} (working)`)}><Plus className="mr-2 h-4 w-4" />Create a working workflow</Button>
                <p className="text-xs text-muted-foreground">This starts a new, separate workflow. The archived one stays unchanged.</p>
              </CardContent>
            </Card>
          ) : (<>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="wf-name">Workflow name</Label>
              <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <Button variant="outline" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save</Button>
            <Button onClick={run} disabled={!canRun}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run now</Button>
            {id && <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete workflow"><Trash2 className="h-4 w-4" /></Button>}
          </div>


          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><MousePointerClick className="h-4 w-4 text-primary" />When this happens</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">When I click "Run now"</div>
              <p className="mt-2 text-xs text-muted-foreground">Automatic starts (on a schedule, when a form is submitted or a record changes) aren't available yet.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-primary" />Do this</CardTitle>
              <CardDescription>Steps run in order. Each one really sends a message or post.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.length === 0 && <p className="text-sm text-muted-foreground">No steps yet. Add one below.</p>}
              {steps.map((s, i) => {
                const def = stepDefinition(s.kind); const r = results[s.id]; const problem = validateStep(s);
                return (
                  <div key={s.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary">{i + 1}</Badge>
                      <span className="font-medium">{def.label}</span>
                      <div className="ml-auto flex">
                        <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move step up"><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move step down"><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setSteps((x) => x.filter((y) => y.id !== s.id))} aria-label="Remove step"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <p className="mb-3 text-xs text-muted-foreground">{def.help}</p>
                    <div className="space-y-3">
                      {def.fields.map((f) => {
                        const fid = `${s.id}-${f.key}`;
                        return (
                          <div key={f.key}>
                            <Label htmlFor={fid}>{f.label}</Label>
                            {f.multiline
                              ? <Textarea id={fid} rows={3} value={s.config[f.key]} placeholder={f.placeholder} onChange={(e) => update(s.id, f.key, e.target.value)} />
                              : <Input id={fid} value={s.config[f.key]} placeholder={f.placeholder} onChange={(e) => update(s.id, f.key, e.target.value)} />}
                          </div>
                        );
                      })}
                    </div>
                    {problem && <p className="mt-2 text-xs text-muted-foreground">{problem}</p>}
                    {r && (
                      <p className={`mt-3 flex items-center gap-2 text-sm ${r.ok ? 'text-success' : 'text-destructive'}`} role="status">
                        {r.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{r.message}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <Select value="" onValueChange={(v) => setSteps((x) => [...x, newStep(v as StepKind)])}>
                  <SelectTrigger className="w-[260px]" aria-label="Add a step"><SelectValue placeholder="+ Add a step" /></SelectTrigger>
                  <SelectContent>
                    {STEP_DEFINITIONS.map((d) => <SelectItem key={d.kind} value={d.kind}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Connect accounts in <Link to="/business-tools?tool=integrations" className="underline">Integrations</Link> or <Link to="/integrations/whatsapp" className="underline">WhatsApp</Link> first.
              </p>
            </CardContent>
          </Card>
          </>)}
        </section>
      </div>
    </div>
  );
};

export default WorkflowStudio;
