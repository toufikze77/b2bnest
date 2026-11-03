import { useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LINKS_NOTE } from '@/data/ukOfficialLinks';
import { AccountPrompt, MoveToAccount, SaveStatus } from '@/components/freeTools/FreeToolAccount';
import { ReferralSlot } from '@/components/freeTools/Promos';
import { useToolCollection } from '@/hooks/useToolCollection';
import { isListOf } from '@/lib/freeToolItems';
import { isStepId, loadDone, saveDone, SETUP_STEPS } from '@/lib/setupChecklist';

const DONE_OPTS = {
  itemName: 'My checklist', empty: [] as string[], isValid: isListOf(isStepId), isEmpty: (v: string[]) => v.length === 0, loadBrowser: loadDone, saveBrowser: saveDone,
  merge: (a: string[], b: string[]) => Array.from(new Set([...a, ...b])),
};

/**
 * Phase 38: UK business set-up checklist. Phase 39: signed out, ticks stay in this browser; signed in, they are saved to
 * the account. The referral slot sits at the "open a business bank account" step.
 */
export default function BusinessSetupChecklist() {
  const c = useToolCollection<string[]>('setup-checklist', DONE_OPTS);
  const done = c.value;
  const setDone = c.set;
  const [category, setCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(SETUP_STEPS.map((s) => s.category)))];
  const shown = category === 'All' ? SETUP_STEPS : SETUP_STEPS.filter((s) => s.category === category);
  const pct = Math.round((done.length / SETUP_STEPS.length) * 100);
  const toggle = (id: string) => setDone(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
      <header>
        <h2 className="text-2xl font-bold">Business set-up checklist (UK)</h2>
        <p className="text-sm text-muted-foreground">The usual steps to start a business in the UK. Not every step applies to every business.</p>
        <SaveStatus mode={c.acct.mode} message={c.acct.message} browserReason={c.acct.browserReason} />
        {!c.storageOk && <p role="alert" className="mt-1 text-sm text-destructive">This browser isn't keeping your ticks (storage is blocked or full).</p>}
      </header>
      {c.acct.mode === 'signed-out' && c.edited && <AccountPrompt tool="setup-checklist" title="Keep your checklist on all your devices" text="Create a free account to save your ticks to your account. Until then they stay in this browser." />}
      {c.inAccount && c.acct.userId && c.browserHasData && (
        <MoveToAccount tool="setup-checklist" userId={c.acct.userId} count={1} what="checklist ticks" onMove={c.moveToAccount} onRemoveBrowserCopy={c.removeBrowserCopy} />
      )}
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
            {s.id === 'bank' && <div className="mt-3 pl-7"><ReferralSlot context="setup-checklist" /></div>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{LINKS_NOTE} General guidance, not legal or tax advice.</p>
    </div>
  );
}
