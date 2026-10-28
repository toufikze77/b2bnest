import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, CheckCircle2, LayoutTemplate, Loader2, MousePointerClick, Play, Plus, Save, Trash2, XCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GUIDE_PATH } from '@/lib/workflowGuide';
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
  MAX_STEPS, STEP_DEFINITIONS, RunContext, SimpleStep, StepResult, StepKind, parseSavedSteps, serializeSteps, skippedLogRow, stepDefinition,
  validateStep, executeStep,
} from '@/lib/workflowSteps';
import { templateSteps, WorkingTemplate } from '@/lib/workflowEmailTemplates';
import { EmailConnectionCheck } from '@/components/workflows/EmailConnectionCheck';
import { RunDialog } from '@/components/workflows/RunDialog';
import { RunHistory } from '@/components/workflows/RunHistory';
import { TemplatePicker } from '@/components/workflows/TemplatePicker';

interface SavedWorkflow { id: string; name: string; description: string | null; workflow_steps: unknown; updated_at: string }

const stepId = () => `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const newStep = (kind: StepKind): SimpleStep => ({
  id: stepId(),
  kind,
  config: Object.fromEntries(stepDefinition(kind).fields.map((f) => [f.key, ''])),
});

const runStep = (step: SimpleStep, workflowId: string | null, ctx: RunContext) =>
  executeStep(step, workflowId, (fn, body) => supabase.functions.invoke(fn, { body }), ctx);

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
  const [runOpen, setRunOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
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

  const open = (w: SavedWorkflow | null, newName = 'Untitled workflow', preset: SimpleStep[] = []) => {
    setResults({});
    if (!w) { setId(null); setName(newName); setSteps(preset); setUnsupported([]); return; }
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

  const useTemplate = (t: WorkingTemplate) => open(null, t.name, templateSteps(t, user?.email ?? '', stepId));

  const problems = steps.map(validateStep).filter(Boolean) as string[];
  const canRun = steps.length > 0 && steps.length <= MAX_STEPS && !unsupported.length && !problems.length && !running;

  // "Run now" opens the details, preview and confirm. Nothing is sent until the user confirms there.
  const run = () => { if (canRun && !runLock.current) setRunOpen(true); };

  const confirmRun = async (values: Record<string, string>) => {
    if (!canRun || runLock.current) return;
    runLock.current = true;
    setRunOpen(false);
    try {
      setRunning(true); setResults({});
      const runId = crypto.randomUUID();
      let failed = 0;
      for (const [stepIndex, step] of steps.entries()) {
        const ctx: RunContext = { runId, stepIndex, values };
        if (!stepDefinition(step.kind).verified && user) {
          // Run history: a skipped step is the one row a browser may write (docs/phase15). Best effort.
          await Promise.resolve(supabase.from('workflow_run_logs').insert(skippedLogRow(step, ctx, user.id, id) as never)).catch(() => undefined);
        }
        const r = await runStep(step, id, ctx).catch((e) => ({ ok: false, message: e instanceof Error ? e.message : 'Failed' }));
        if (!r.ok) failed++;
        setResults((prev) => ({ ...prev, [step.id]: r }));
      }
      if (failed) toast.error(`${failed} of ${steps.length} steps failed — see the results below.`);
      else toast.success('All steps completed');
    } finally {
      setRunning(false);
      runLock.current = false;
      setHistoryKey((k) => k + 1);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a list of emails, then send them all with one click.{' '}
          <Link to={GUIDE_PATH} className="inline-flex items-center gap-1 rounded-control text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />How workflows work
          </Link>
        </p>
      </div>

      <EmailConnectionCheck />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <Button className="w-full" onClick={() => open(null)}><Plus className="mr-2 h-4 w-4" />New workflow</Button>
          <Button className="w-full" variant="outline" onClick={() => setPickerOpen(true)}><LayoutTemplate className="mr-2 h-4 w-4" />Start from a template</Button>
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
              <CardDescription>Steps run in order. Each one really sends an email.</CardDescription>
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
                    <p className="mb-3 text-xs text-muted-foreground">{def.verified ? def.help : 'Not available yet: this step has not been verified and will not run.'}</p>
                    {s.kind === 'email' && (
                      <p className="mb-3 text-xs text-muted-foreground">
                        You can use {'{{name}}'}, {'{{company}}'}, {'{{amount}}'}, {'{{due_date}}'}, {'{{invoice_number}}'}, {'{{quote_number}}'}, {'{{date}}'} and {'{{time}}'} in
                        the subject and message. You fill them in when you run it.
                      </p>
                    )}
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
                <Select value="" disabled={steps.length >= MAX_STEPS} onValueChange={(v) => setSteps((x) => (x.length >= MAX_STEPS ? x : [...x, newStep(v as StepKind)]))}>
                  <SelectTrigger className="w-full max-w-[260px]" aria-label="Add a step"><SelectValue placeholder={steps.length >= MAX_STEPS ? `Up to ${MAX_STEPS} steps` : '+ Add a step'} /></SelectTrigger>
                  <SelectContent>
                    {STEP_DEFINITIONS.map((d) => <SelectItem key={d.kind} value={d.kind} disabled={!d.verified}>{d.label}{d.verified ? '' : ' — not available yet'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Only email is available right now. X, LinkedIn and WhatsApp steps are switched off until their delivery has been verified.
              </p>
            </CardContent>
          </Card>

          {id && user ? <RunHistory workflowId={id} userId={user.id} refreshKey={historyKey} />
            : <p className="text-xs text-muted-foreground">Save this workflow to keep a run history.</p>}
          </>)}
        </section>
      </div>

      <RunDialog open={runOpen} name={name} steps={steps} onCancel={() => setRunOpen(false)} onConfirm={confirmRun} />
      <TemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onUse={useTemplate} />
    </div>
  );
};

export default WorkflowStudio;
