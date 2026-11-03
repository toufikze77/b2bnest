import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudUpload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BROWSER_ONLY_NOTE } from '@/lib/freeTools';
import { ACCOUNT_NOTE, TRIAL_ENDED_NOTE, dismissPrompt, shortDate, type FreeToolItem, markMoveAnswered, moveAnswered, promptDismissed, signInUrl, signUpUrl, type SavableTool } from '@/lib/freeToolItems';
import type { FreeToolMode } from '@/hooks/useFreeToolAccount';


/**
 * The "Create a free account" card: inline, compact, dismissible, never in front of the tool. `forced` = the person
 * just chose something that needs an account (save, export); otherwise it is the after-first-edit offer, which stays
 * hidden for the session once dismissed. Work in progress is kept (sessionStorage / localStorage) across signing in.
 */
export function AccountPrompt({ tool, title, text, forced = false, onClose }: { tool: SavableTool; title: string; text?: string; forced?: boolean; onClose?: () => void }) {
  const [hidden, setHidden] = useState(() => !forced && promptDismissed(tool));
  if (hidden) return null;
  const close = () => { if (!forced) dismissPrompt(tool); setHidden(true); onClose?.(); };
  return (
    <aside aria-label="Create a free account" className="rounded-card border border-primary/40 bg-card p-3 text-card-foreground sm:p-4" data-testid="account-prompt">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{text ?? 'It’s free. You’ll come back to this tool, and what you’ve done so far is kept.'}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0" aria-label="Not now" onClick={close}><X className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to={signUpUrl(tool)}>Create a free account</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to={signInUrl(tool)}>Sign in</Link></Button>
      </div>
    </aside>
  );
}

/** One line under the tool's title: where the work is kept, why it isn't saved to the account, and what just happened. */
export function SaveStatus({ mode, message, browserReason, testId = 'save-status' }: { mode: FreeToolMode; message: string; browserReason: string; testId?: string }) {
  return (
    <div className="mt-1 space-y-1" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{mode === 'account' ? ACCOUNT_NOTE : mode === 'loading' ? 'Opening what you saved…' : BROWSER_ONLY_NOTE}</p>
      {mode === 'browser' && browserReason && <p className="text-sm text-foreground" data-testid="browser-reason">{browserReason}</p>}
      <p aria-live="polite" className="text-sm" data-testid="save-announce">{message}</p>
    </div>
  );
}

/**
 * The one-time offer after signing in: copy what this browser kept into the account. Nothing moves until the person
 * presses the button; the browser copy stays until they confirm the move worked and choose to remove it.
 */
export function MoveToAccount({ tool, userId, count, what, onMove, onRemoveBrowserCopy }: {
  tool: SavableTool; userId: string; count: number; what: string;
  onMove: () => Promise<boolean>; onRemoveBrowserCopy: () => void;
}) {
  const [step, setStep] = useState<'offer' | 'moving' | 'moved' | 'failed' | 'gone'>(() => (moveAnswered(tool, userId) ? 'gone' : 'offer'));
  if (step === 'gone' || count === 0 && step === 'offer') return null;
  const done = () => { markMoveAnswered(tool, userId); setStep('gone'); };
  const move = async () => { setStep('moving'); setStep((await onMove()) ? 'moved' : 'failed'); };
  return (
    <section aria-label="Move to your account" className="rounded-card border border-border bg-muted/40 p-3 text-sm" data-testid="move-to-account">
      <p aria-live="polite" className="font-medium">
        {step === 'moved' ? `Moved to your account. Check it's all there: the copy in this browser is kept until you remove it.`
          : step === 'failed' ? 'Nothing was moved. Your browser copy is unchanged; try again later.'
          : `This browser has ${what} you saved before signing in.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(step === 'offer' || step === 'moving' || step === 'failed') && (
          <>
            <Button type="button" size="sm" disabled={step === 'moving'} onClick={move}><CloudUpload className="mr-1 h-4 w-4" aria-hidden />{step === 'moving' ? 'Moving…' : 'Move what you saved in this browser to your account'}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={done}>No thanks</Button>
          </>
        )}
        {step === 'moved' && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => { if (window.confirm('Remove the copy saved in this browser? Your account keeps its copy.')) { onRemoveBrowserCopy(); done(); } }}>It worked: remove the browser copy</Button>
            <Button type="button" size="sm" variant="ghost" onClick={done}>Keep both</Button>
          </>
        )}
      </div>
    </section>
  );
}

/** Phase 39: for trial-ended accounts on the free tools. One calm line, no countdown, no pop-up. */
export function TrialEndedNote() {
  return (
    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" data-testid="trial-ended-note">
      {TRIAL_ENDED_NOTE.replace(' See plans to unlock the rest.', ' ')}
      <Link to="/pricing" className="font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">See plans</Link> to unlock the rest.
    </p>
  );
}

/** Results saved to the account (Cost Calculator, Compliance Checker): open one again, or delete it. */
export function SavedResults<T>({ items, onOpen, onDelete }: { items: FreeToolItem<T>[]; onOpen: (i: FreeToolItem<T>) => void; onDelete: (i: FreeToolItem<T>) => void }) {
  return (
    <section aria-label="Saved results" className="rounded-card border border-border bg-card p-3 text-sm" data-testid="saved-results">
      <h3 className="font-semibold">Saved results</h3>
      {items.length === 0 ? <p className="text-muted-foreground" data-testid="saved-results-empty">Nothing saved yet.</p> : (
        <ul className="mt-1 divide-y divide-border">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>{i.name} <span className="text-xs text-muted-foreground">· saved {shortDate(i.updated_at)}</span></span>
              <span className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => onOpen(i)} aria-label={`Open ${i.name}`}>Open</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { if (window.confirm(`Delete "${i.name}"?`)) onDelete(i); }} aria-label={`Delete ${i.name}`}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
