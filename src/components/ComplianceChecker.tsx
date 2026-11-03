import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Save, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountPrompt, SavedResults, SaveStatus } from '@/components/freeTools/FreeToolAccount';
import { useFreeToolAccount } from '@/hooks/useFreeToolAccount';
import { loadDraft, saveDraft, shortDate } from '@/lib/freeToolItems';
import { Label } from '@/components/ui/label';
import { LINKS_NOTE } from '@/data/ukOfficialLinks';
import { complianceItems, NOT_LEGAL_ADVICE, type ComplianceAnswers } from '@/lib/compliance';

const FIELD = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const BLANK: ComplianceAnswers = { structure: '', employs: '', personalData: '', vatTurnover: '' };
const isAnswers = (v: unknown): v is ComplianceAnswers => !!v && typeof v === 'object'
  && (['structure', 'employs', 'personalData', 'vatTurnover'] as const).every((k) => typeof (v as Record<string, unknown>)[k] === 'string');

/**
 * Phase 38: UK compliance checker; general guidance only. Phase 39: the result is visible to everyone; "Save this
 * result" needs a free account. The answers are kept for this browser tab, so they are still there after signing in.
 */
export default function ComplianceChecker() {
  const draft = useMemo(() => loadDraft('compliance', isAnswers), []);
  const acct = useFreeToolAccount<ComplianceAnswers>('compliance');
  const [a, setA] = useState<ComplianceAnswers>(draft ?? BLANK);
  const [prompt, setPrompt] = useState(false);
  useEffect(() => { saveDraft('compliance', a); }, [a]);
  const signedOut = acct.mode === 'signed-out';
  const saveResult = async () => {
    if (signedOut) { setPrompt(true); return; }
    if (acct.mode === 'account') await acct.save(`Compliance check, ${shortDate(new Date())}`, a);
  };
  const items = complianceItems(a);
  const yesNo = (id: keyof ComplianceAnswers, label: string) => (
    <div><Label htmlFor={`cc-${id}`}>{label}</Label>
      <select id={`cc-${id}`} className={FIELD} value={a[id]} onChange={(e) => setA({ ...a, [id]: e.target.value })}>
        <option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option>
      </select></div>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
      <header>
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-6 w-6 text-primary" aria-hidden />Compliance checker (UK)</h2>
        <p className="text-sm text-muted-foreground">Answer a few questions to see the main UK duties that may apply, each with its official GOV.UK page.</p>
        <p className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="not-legal-advice">{NOT_LEGAL_ADVICE}</p>
        <SaveStatus mode={acct.mode} message={acct.message} browserReason={acct.browserReason} />
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label htmlFor="cc-structure">Business structure</Label>
          <select id="cc-structure" className={FIELD} value={a.structure} onChange={(e) => setA({ ...a, structure: e.target.value as ComplianceAnswers['structure'] })}>
            <option value="">Choose</option><option value="sole_trader">Sole trader</option><option value="partnership">Partnership</option>
            <option value="limited_company">Limited company</option><option value="llp">LLP</option>
          </select></div>
        {yesNo('employs', 'Do you (or will you) employ anyone?')}
        {yesNo('personalData', 'Do you use personal data about customers or staff?')}
        {yesNo('vatTurnover', 'Is your taxable turnover over the VAT threshold?')}
      </div>
      <section aria-live="polite" aria-label="What may apply">
        {items.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="cc-none">Answer the questions above to see what may apply.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {items.map((it) => (
              <li key={it.id} className="rounded-card border border-border bg-card p-4" data-testid="cc-item">
                <p className="font-semibold">{it.title}</p>
                <p className="text-sm text-muted-foreground">{it.text}</p>
                <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline">{it.source.label} (GOV.UK)<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
              </li>
            ))}
          </ul>
        )}
      </section>
      {items.length > 0 && (
        <div className="space-y-3">
          <Button type="button" size="sm" onClick={saveResult} disabled={acct.mode === 'browser' || acct.mode === 'loading'}><Save className="mr-1 h-4 w-4" aria-hidden />Save this result</Button>
          {prompt && signedOut && <AccountPrompt forced tool="compliance" title="Create a free account to save this result" text="Save it to your account to come back to it on any device. It's free, and your answers are kept." onClose={() => setPrompt(false)} />}
        </div>
      )}
      {acct.mode === 'account' && (
        <SavedResults items={acct.items} onDelete={(i) => void acct.remove(i.id)}
          onOpen={(i) => { if (isAnswers(i.data)) { setA(i.data); acct.setMessage(`Opened "${i.name}".`); } }} />
      )}
      <p className="text-xs text-muted-foreground">{LINKS_NOTE}</p>
    </div>
  );
}
