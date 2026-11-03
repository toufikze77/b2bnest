import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADVERT_LABEL, BANK_PARTNERS, COMMISSION_LINE, FINANCE_ASSISTANT_PROMO, NOT_ADVICE_LINE, type BankPartner } from '@/data/freeToolsPromos';

const DISMISS_KEY = 'b2bnest.freeToolsBanner.dismissed';
const isDismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };

/**
 * Phase 38: one compact advert card above the free Business Tools. Content comes from src/data/freeToolsPromos.ts.
 * Labelled "Advert"; referral links are marked sponsored and come with the commission line; dismissed for this browser
 * session only. No tracking, analytics or cookies.
 */
export default function FreeToolsBanner({ partners = BANK_PARTNERS }: { partners?: BankPartner[] }) {
  const [hidden, setHidden] = useState(isDismissed);
  if (hidden) return null;
  const dismiss = () => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked: hide for now only */ } setHidden(true); };
  const p = FINANCE_ASSISTANT_PROMO;
  return (
    <aside aria-label="Advert" className="relative rounded-card border border-border bg-card p-4 text-card-foreground" data-testid="free-tools-banner">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded border border-border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ADVERT_LABEL}</span>
        <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8" aria-label="Hide this advert for now" onClick={dismiss}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className={`mt-2 grid gap-4 ${partners.length > 0 ? 'md:grid-cols-2' : ''}`}>
        {partners.length > 0 && (
          <section aria-labelledby="ftb-banks" data-testid="ftb-banks">
            <h2 id="ftb-banks" className="text-sm font-semibold">Business bank accounts</h2>
            <ul className="mt-1 space-y-2">
              {partners.map((b) => (
                <li key={b.url} className="text-sm">
                  <a href={b.url} target="_blank" rel="sponsored noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {b.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  <span className="text-muted-foreground"> · {b.description}</span>
                  {b.offer && <span className="block text-xs text-foreground">{b.offer}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{COMMISSION_LINE}</p>
          </section>
        )}
        <section aria-labelledby="ftb-finance">
          <h2 id="ftb-finance" className="text-sm font-semibold">{p.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.needs}</p>
          <Button asChild size="sm" variant="outline" className="mt-2"><Link to={p.to}>{p.cta}</Link></Button>
        </section>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{NOT_ADVICE_LINE}</p>
    </aside>
  );
}
