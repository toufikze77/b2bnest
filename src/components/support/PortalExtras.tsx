import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { canSubmitFeedback } from '@/lib/onboarding';
import * as svc from '@/services/onboardingService';
import type { Ticket } from '@/services/supportService';

/** Per-company email choice. In-app notifications always stay on. Hidden until the database update is installed. */
export function SupportEmailToggle({ org, uid }: { org: string; uid: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setOn(null); svc.getEmailPref(org, uid).then(setOn).catch(() => setOn(null)); }, [org, uid]);
  if (on === null) return null;
  const change = async (v: boolean) => { setErr(null); try { await svc.setEmailPref(org, uid, v); setOn(v); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="text-sm">
      <label className="flex items-center gap-2"><Switch checked={on} onCheckedChange={change} />Email me about ticket updates (in-app updates always appear)</label>
      {err && <p role="alert" className="text-destructive">{err}</p>}
    </div>
  );
}

/** Optional 1–5 rating, once, on the customer's own closed ticket. Only support staff can read it. */
export function PortalFeedback({ ticket, enabled }: { ticket?: Ticket; enabled: boolean }) {
  const [done, setDone] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (ticket && enabled && ticket.status === 'closed') svc.feedbackSubmitted(ticket.id).then(setDone).catch(() => setDone(null)); }, [ticket, enabled]);
  if (!ticket || done === null) return null;
  if (done) return <p className="mt-3 text-sm text-muted-foreground">Thanks — your feedback was sent to the support team.</p>;
  if (!canSubmitFeedback(ticket.status, enabled, done)) return null;
  const send = async () => { setErr(null); try { await svc.submitFeedback(ticket.id, rating, comment); setDone(true); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-3">
      <p className="text-sm font-medium">How did we do? (optional)</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating 1 to 5">
        {[1, 2, 3, 4, 5].map((n) => <Button key={n} size="sm" variant={rating === n ? 'default' : 'outline'} aria-pressed={rating === n} onClick={() => setRating(n)}>{n}</Button>)}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Comment (optional)" />
      <Button size="sm" disabled={!rating} onClick={send}>Send feedback</Button>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
