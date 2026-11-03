import { FormEvent, useState } from 'react';
import { CheckCircle, Circle, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AccountPrompt, MoveToAccount, SaveStatus } from '@/components/freeTools/FreeToolAccount';
import { useToolCollection } from '@/hooks/useToolCollection';
import { isListOf, mergeById } from '@/lib/freeToolItems';
import { CATEGORIES, dueText, formatDay, goalErrors, isGoal, loadGoals, localToday, MAX_GOALS, saveGoals, setProgress, type Goal } from '@/lib/goals';

const GOALS_OPTS = { itemName: 'My goals', empty: [] as Goal[], isValid: isListOf(isGoal), isEmpty: (v: Goal[]) => v.length === 0, loadBrowser: loadGoals, saveBrowser: saveGoals, merge: mergeById<Goal> };

const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CARD = 'rounded-card border border-border bg-card p-4 text-card-foreground';
const BLANK = { title: '', description: '', targetDate: '', category: 'Business' };

/**
 * Phase 38: Goal Tracker. Signed out: saved in this browser (localStorage "goalTrackerGoals").
 * Phase 39: signed in, saved to the account (one item, "My goals"); a free-account offer appears after the first edit.
 */
export default function GoalTracker() {
  const c = useToolCollection<Goal[]>('goal-tracker', GOALS_OPTS);
  const goals = c.value;
  const setGoals = c.set;
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<{ title?: string; targetDate?: string }>({});
  const [announce, setAnnounce] = useState('');
  const storageOk = c.storageOk;
  const today = localToday();

  const open = (g?: Goal) => { setErrors({}); setEditing(g ? g.id : 'new'); setForm(g ? { title: g.title, description: g.description, targetDate: g.targetDate, category: g.category } : BLANK); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = goalErrors(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (editing === 'new') {
      if (goals.length >= MAX_GOALS) { setAnnounce(`You can keep up to ${MAX_GOALS} goals. Delete one first.`); return; }
      setGoals([{ id: `${Date.now()}`, title: form.title.trim(), description: form.description.trim(), targetDate: form.targetDate, category: form.category, progress: 0, isCompleted: false, createdAt: new Date().toISOString() }, ...goals]);
      setAnnounce(`Goal "${form.title.trim()}" added.`);
    } else {
      setGoals(goals.map((g) => (g.id === editing ? { ...g, title: form.title.trim(), description: form.description.trim(), targetDate: form.targetDate, category: form.category } : g)));
      setAnnounce('Goal updated.');
    }
    setEditing(null);
  };
  const progress = (g: Goal, p: number) => {
    const next = setProgress(g, p);
    setGoals(goals.map((x) => (x.id === g.id ? next : x)));
    setAnnounce(next.isCompleted && !g.isCompleted ? `"${g.title}" completed.` : `"${g.title}" is at ${next.progress}%.`);
  };
  const remove = (g: Goal) => { if (!window.confirm(`Delete "${g.title}"?`)) return; setGoals(goals.filter((x) => x.id !== g.id)); setAnnounce(`"${g.title}" deleted.`); };

  const completed = goals.filter((g) => g.isCompleted).length;
  const average = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold">Goal Tracker</h1>
        <p className="text-sm text-muted-foreground">Set business goals with a target date and track progress. Up to {MAX_GOALS} goals.</p>
        <SaveStatus mode={c.acct.mode} message={c.acct.message} browserReason={c.acct.browserReason} />
        {!storageOk && <p role="alert" className="mt-1 text-sm text-destructive">This browser isn't keeping your goals (storage is blocked or full), so they will be gone when you leave the page.</p>}
      </header>
      {c.acct.mode === 'signed-out' && c.edited && <AccountPrompt tool="goal-tracker" title="Keep your goals on all your devices" text="Create a free account to save them to your account. Until then they stay in this browser." />}
      {c.inAccount && c.acct.userId && c.browserHasData && (
        <MoveToAccount tool="goal-tracker" userId={c.acct.userId} count={1} what="goals" onMove={c.moveToAccount} onRemoveBrowserCopy={c.removeBrowserCopy} />
      )}
      <p aria-live="polite" className="sr-only" data-testid="goal-announce">{announce}</p>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="goal-stats">
        <div className={CARD}><p className="text-sm text-muted-foreground">Goals</p><p className="text-2xl font-bold">{goals.length} of {MAX_GOALS}</p></div>
        <div className={CARD}><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold">{completed}</p></div>
        <div className={CARD}><p className="text-sm text-muted-foreground">Average progress</p><p className="text-2xl font-bold">{average}%</p></div>
      </div>

      {editing ? (
        <form onSubmit={submit} className={`${CARD} grid gap-3 sm:grid-cols-2`} aria-label={editing === 'new' ? 'Add a goal' : 'Edit goal'} noValidate>
          <div className="sm:col-span-2"><Label htmlFor="g-title">Goal</Label>
            <Input id="g-title" value={form.title} maxLength={120} placeholder="For example: reach £10,000 monthly revenue" aria-invalid={!!errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title}</p>}</div>
          <div className="sm:col-span-2"><Label htmlFor="g-desc">Description (optional)</Label><Input id="g-desc" value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label htmlFor="g-cat">Category</Label>
            <select id="g-cat" className={FIELD} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label htmlFor="g-date">Target date</Label>
            <input id="g-date" type="date" className={FIELD} value={form.targetDate} aria-invalid={!!errors.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            {errors.targetDate && <p className="mt-1 text-sm text-destructive">{errors.targetDate}</p>}</div>
          <div className="flex gap-2 sm:col-span-2"><Button type="submit">{editing === 'new' ? 'Add goal' : 'Save changes'}</Button><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </form>
      ) : (
        <Button type="button" onClick={() => open()} disabled={goals.length >= MAX_GOALS}><Plus className="mr-1 h-4 w-4" aria-hidden />{goals.length >= MAX_GOALS ? `Limit of ${MAX_GOALS} goals reached` : 'Add a goal'}</Button>
      )}

      <section aria-labelledby="goals-title" className={CARD}>
        <h2 id="goals-title" className="flex items-center gap-2 font-semibold"><Target className="h-5 w-5" aria-hidden />Your goals</h2>
        {goals.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground" data-testid="goals-empty">No goals yet. Add your first goal above.</p> : (
          <ul className="mt-2 divide-y divide-border">
            {goals.map((g) => (
              <li key={g.id} className="space-y-2 py-3" data-testid="goal">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      {g.isCompleted ? <CheckCircle className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />}
                      <span className={g.isCompleted ? 'line-through' : ''}>{g.title}</span><Badge variant="outline">{g.category}</Badge>
                    </p>
                    {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                    <p className="text-sm">Target: {formatDay(g.targetDate)} · <strong>{dueText(g, today)}</strong></p>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${g.title}`} onClick={() => open(g)}><Pencil className="h-4 w-4" aria-hidden /></Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${g.title}`} onClick={() => remove(g)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Progress: {g.progress}%</span>
                  <Button type="button" size="sm" variant="outline" disabled={g.progress <= 0} aria-label={`Take 10% off ${g.title}`} onClick={() => progress(g, g.progress - 10)}>-10%</Button>
                  <Button type="button" size="sm" variant="outline" disabled={g.progress >= 100} aria-label={`Add 10% to ${g.title}`} onClick={() => progress(g, g.progress + 10)}>+10%</Button>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Progress on ${g.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.progress} aria-valuetext={`${g.progress}%`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${g.progress}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
