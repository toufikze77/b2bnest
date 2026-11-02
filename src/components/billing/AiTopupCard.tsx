import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAiCredits } from '@/hooks/useAiCredits';
import { toast } from '@/hooks/use-toast';
import { topupLine, topupOf } from '@/lib/aiCredits';
import {
  CHOOSE_PLAN_FIRST, COMPANY_TOPUP_TEXT, packTitle, PAYMENT_ARRIVED, PAYMENT_CANCELLED, PAYMENT_RECEIVED, PAYMENT_STILL_WAITING,
  perCreditLabel, poundsLabel, RETURN_POLL, TOPUP_FALLBACK_ERROR, TOPUP_PACKS, TOPUP_RULES, type TopupOffer,
} from '@/lib/aiTopups';
import { functionErrorText, readFunctionError } from '@/lib/billingErrors';

type ReturnPhase = 'none' | 'waiting' | 'arrived' | 'still_waiting' | 'cancelled';
const SESSION_ID = /^cs_[A-Za-z0-9_]{1,250}$/;

/** Has the webhook created the lot for this checkout session yet? (The customer's own lots are readable; RLS.) */
async function lotExists(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.from('ai_credit_lots' as never).select('id').eq('stripe_checkout_session_id', sessionId).maybeSingle();
  return !error && !!data;
}

/**
 * Phase 37: buy AI credit top-ups (Settings → Billing). Prices come from the catalogue the server also uses; the server
 * decides who may buy and what is charged, and only the Stripe webhook adds credits after payment.
 */
export default function AiTopupCard({ offer }: { offer: TopupOffer }) {
  const { credits, refetch } = useAiCredits();
  const [params] = useSearchParams();
  const returned = params.get('topup');
  const sessionId = params.get('session_id');
  const [phase, setPhase] = useState<ReturnPhase>(returned === 'success' ? 'waiting' : returned === 'cancelled' ? 'cancelled' : 'none');
  const [buying, setBuying] = useState<string | null>(null);

  // Back from Stripe: look for the purchase a few times (the webhook usually lands within seconds).
  useEffect(() => {
    if (phase !== 'waiting') return;
    let live = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      tries += 1;
      const found = sessionId && SESSION_ID.test(sessionId) ? await lotExists(sessionId) : false;
      if (!live) return;
      if (found) { setPhase('arrived'); void refetch(); return; }
      if (tries >= RETURN_POLL.tries) { setPhase('still_waiting'); void refetch(); return; }
      timer = setTimeout(check, RETURN_POLL.everyMs);
    };
    timer = setTimeout(check, RETURN_POLL.everyMs);
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [phase, sessionId, refetch]);

  const buy = async (packId: string) => {
    setBuying(packId);
    try {
      const { data, error } = await supabase.functions.invoke('create-ai-topup-checkout', { body: { packId } });
      if (error) throw new Error(functionErrorText(await readFunctionError(error), TOPUP_FALLBACK_ERROR));
      if (typeof data?.url !== 'string' || !data.url.startsWith('https://')) throw new Error(TOPUP_FALLBACK_ERROR);
      window.location.assign(data.url);
    } catch (e) {
      toast({ title: 'Top-up not started', description: e instanceof Error ? e.message : TOPUP_FALLBACK_ERROR, variant: 'destructive' });
      setBuying(null);
    }
  };

  const balance = credits ? topupLine(credits) : null;

  return (
    <section id="ai-topup" aria-labelledby="ai-topup-title" className="rounded-lg border border-border bg-card p-4 text-card-foreground" data-testid="ai-topup-card">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-primary/10 p-2"><Zap className="h-4 w-4 text-primary" aria-hidden /></span>
        <div>
          <h2 id="ai-topup-title" className="text-sm font-semibold">Top up AI credits</h2>
          <p className="text-xs text-muted-foreground">
            {credits && topupOf(credits) > 0 ? balance : 'No top-up credits yet.'}
          </p>
        </div>
      </div>

      {phase === 'waiting' && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="topup-waiting">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />{PAYMENT_RECEIVED}
        </p>
      )}
      {phase === 'arrived' && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm" data-testid="topup-arrived">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />{PAYMENT_ARRIVED}
        </p>
      )}
      {phase === 'still_waiting' && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="topup-still-waiting">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />{PAYMENT_STILL_WAITING}
        </p>
      )}
      {phase === 'cancelled' && (
        <p role="status" className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm" data-testid="topup-cancelled">{PAYMENT_CANCELLED}</p>
      )}

      {offer === 'buy' && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {TOPUP_PACKS.map((p) => (
            <li key={p.id} className="flex flex-col rounded-md border border-border p-3">
              <span className="text-sm font-semibold">{packTitle(p)}</span>
              <span className="text-lg font-semibold">{poundsLabel(p.amountPence)}</span>
              <span className="text-xs text-muted-foreground">{perCreditLabel(p)}</span>
              <Button type="button" size="sm" className="mt-2" disabled={buying !== null} onClick={() => void buy(p.id)}
                aria-label={`Buy ${packTitle(p)} for ${poundsLabel(p.amountPence)}`}>
                {buying === p.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Buy
              </Button>
            </li>
          ))}
        </ul>
      )}
      {offer === 'plan_first' && (
        <div className="mt-3 space-y-2" data-testid="topup-plan-first">
          <p className="text-sm text-muted-foreground">{CHOOSE_PLAN_FIRST}</p>
          <Button asChild size="sm"><Link to="/pricing">View plans</Link></Button>
        </div>
      )}
      {offer === 'company' && <p className="mt-3 text-sm text-muted-foreground" data-testid="topup-company">{COMPANY_TOPUP_TEXT}</p>}

      <p className="mt-3 text-xs text-muted-foreground">{TOPUP_RULES}</p>
    </section>
  );
}
