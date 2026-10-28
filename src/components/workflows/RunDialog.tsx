import { useEffect, useMemo, useState } from 'react';
import { Mail, Reply, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleStep, confirmText, renderEmailStep, replyText, runPlan, stepDefinition } from '@/lib/workflowSteps';
import { PLACEHOLDERS } from '../../../supabase/functions/_shared/placeholders.ts';

interface Props {
  open: boolean;
  name: string;
  steps: SimpleStep[];
  /** The signed-in sender's own verified email (replyToAddress), or null. Never anyone else's address. */
  replyTo: string | null;
  onCancel: () => void;
  onConfirm: (values: Record<string, string>) => void;
}

/**
 * Shown when the user presses "Run now": the details for any {{placeholders}}, an exact preview of every email
 * (filled by the same function the server uses), and a confirm button. Nothing is sent until that button is pressed.
 */
export function RunDialog({ open, name, steps, replyTo, onCancel, onConfirm }: Props) {
  const plan = useMemo(() => runPlan(steps), [steps]);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (open) setValues({}); }, [open]);

  const previews = plan.sending.map((s) => {
    const r = renderEmailStep(s, values);
    return { step: s, index: steps.indexOf(s), r, errors: r.ok === false ? r.errors : [] };
  });
  const blocked = previews.some((p) => !p.r.ok);
  const fields = PLACEHOLDERS.filter((p) => plan.placeholders.includes(p.key));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run "{name}"</DialogTitle>
          <DialogDescription>Check the details and the preview. Nothing is sent until you press the button at the bottom.</DialogDescription>
        </DialogHeader>

        {fields.length > 0 && (
          <section aria-labelledby="run-details" className="space-y-3">
            <h3 id="run-details" className="text-sm font-semibold">Run with these details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label htmlFor={`ph-${f.key}`}>{f.label} <span className="font-mono text-xs text-muted-foreground">{`{{${f.key}}}`}</span></Label>
                  <Input id={`ph-${f.key}`} value={values[f.key] ?? ''} maxLength={f.maxLength} placeholder={`e.g. ${f.example}`}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="run-preview" className="space-y-3">
          <h3 id="run-preview" className="text-sm font-semibold">Email preview</h3>
          {previews.map(({ step, index, r, errors }) => (
            <div key={step.id} className="rounded-md border border-border p-3 text-sm" data-testid="email-preview">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Mail className="h-3.5 w-3.5" />Step {index + 1}</p>
              {r.ok === true ? (
                <dl className="space-y-1">
                  <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">To</dt><dd className="min-w-0 break-words">{step.config.to}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Replies</dt><dd className="min-w-0 break-words" data-testid="reply-to">{replyText(replyTo)}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 text-muted-foreground">Subject</dt><dd className="min-w-0 break-words font-medium">{r.subject}</dd></div>
                  <div className="pt-1"><dt className="sr-only">Message</dt><dd className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2">{r.body}</dd></div>
                </dl>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-destructive" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              )}
            </div>
          ))}
          {plan.skipped.map((s) => (
            <p key={s.id} className="text-xs text-muted-foreground">Step {steps.indexOf(s) + 1} ({stepDefinition(s.kind).label}) isn't available yet and will be skipped.</p>
          ))}
          <p className="text-xs text-muted-foreground">Emails are sent as plain text. The email provider accepting an email doesn't guarantee it reaches the inbox.</p>
        </section>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium" data-testid="run-summary">{confirmText(plan)}</p>
            {plan.emails > 0 && (
              <p className={`flex items-start gap-1.5 text-xs ${replyTo ? 'text-muted-foreground' : 'text-warning'}`} data-testid="run-reply-to">
                <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{replyText(replyTo)}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onConfirm(values)} disabled={blocked || plan.emails === 0}>
              <Send className="mr-2 h-4 w-4" />Send {plan.emails} email{plan.emails === 1 ? '' : 's'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
