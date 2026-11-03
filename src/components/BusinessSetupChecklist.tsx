import { useEffect, useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BROWSER_ONLY_NOTE } from '@/lib/freeTools';
import { LINKS_NOTE } from '@/data/ukOfficialLinks';
import { CHECKLIST_KEY, loadDone, SETUP_STEPS } from '@/lib/setupChecklist';

/** Phase 38: UK business set-up checklist. Ticks are saved in this browser only. */
export default function BusinessSetupChecklist() {
  const [done, setDone] = useState<string[]>(loadDone);
  const [category, setCategory] = useState('All');
  useEffect(() => { try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(done)); } catch { /* storage blocked */ } }, [done]);
  const categories = ['All', ...Array.from(new Set(SETUP_STEPS.map((s) => s.category)))];
  const shown = category === 'All' ? SETUP_STEPS : SETUP_STEPS.filter((s) => s.category === category);
  const pct = Math.round((done.length / SETUP_STEPS.length) * 100);
  const toggle = (id: string) => setDone(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
      <header>
        <h2 className="text-2xl font-bold">Business set-up checklist (UK)</h2>
        <p className="text-sm text-muted-foreground">The usual steps to start a business in the UK. Not every step applies to every business.</p>
        <p className="mt-1 text-xs text-muted-foreground">{BROWSER_ONLY_NOTE}</p>
      </header>
      <section className="rounded-card border border-border bg-card p-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold" data-testid="checklist-progress">{done.length} of {SETUP_STEPS.length} steps done ({pct}%)</p>
          <Button type="button" size="sm" variant="ghost" disabled={done.length === 0} onClick={() => { if (window.confirm('Untick every step?')) setDone([]); }}><RotateCcw className="mr-1 h-4 w-4" aria-hidden />Reset</Button>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={`${done.length} of ${SETUP_STEPS.length} steps done`}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </section>
      <div role="group" aria-label="Show steps for" className="flex flex-wrap gap-2">
        {categories.map((c) => <Button key={c} type="button" size="sm" variant={category === c ? 'default' : 'outline'} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</Button>)}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {shown.map((s) => (
          <li key={s.id} className="rounded-card border border-border bg-card p-4" data-testid="checklist-step">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={done.includes(s.id)} onChange={() => toggle(s.id)} />
              <span>
                <span className={`font-semibold ${done.includes(s.id) ? 'line-through' : ''}`}>{s.title}</span>{done.includes(s.id) && <span className="ml-2 text-sm">(done)</span>}
                <span className="block text-sm text-muted-foreground">{s.description}</span>
              </span>
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
              <Badge variant="outline">{s.category}</Badge>{s.when && <Badge variant="secondary">{s.when}</Badge>}
              {s.link && <a href={s.link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline">{s.link.label} (GOV.UK)<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{LINKS_NOTE} General guidance, not legal or tax advice.</p>
    </div>
  );
}
