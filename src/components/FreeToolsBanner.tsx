import { KeyboardEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ADVERT_LABEL, COMMISSION_LINE, FINANCE_ASSISTANT_PROMO, NOT_ADVICE_LINE, REFERRAL_GROUPS, REFERRAL_PARTNERS, visibleGroups,
  type ReferralGroup, type ReferralPartner,
} from '@/data/freeToolsPromos';

const DISMISS_KEY = 'b2bnest.freeToolsBanner.dismissed';
const GROUP_KEY = 'b2bnest.freeToolsBanner.group';
const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked: this view only */ } };

/**
 * Phase 38: one compact advert card above the free Business Tools. Content comes from src/data/freeToolsPromos.ts.
 * Labelled "Advert"; referral links are marked sponsored and come with the commission line; partners are grouped by
 * category (a selector appears only when two or more groups have entries); dismissed for this browser session only.
 * No tracking, analytics or cookies.
 */
export default function FreeToolsBanner({ groups = REFERRAL_GROUPS, partners = REFERRAL_PARTNERS }: { groups?: ReferralGroup[]; partners?: ReferralPartner[] }) {
  const [hidden, setHidden] = useState(() => read(DISMISS_KEY) === '1');
  const shown = visibleGroups(groups, partners);
  const [chosen, setChosen] = useState(() => read(GROUP_KEY));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  if (hidden) return null;
  const dismiss = () => { write(DISMISS_KEY, '1'); setHidden(true); };
  const active = shown.find((g) => g.id === chosen) ?? shown[0];
  const choose = (id: string, focus = false) => {
    setChosen(id); write(GROUP_KEY, id);
    if (focus) tabs.current[shown.findIndex((g) => g.id === id)]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % shown.length : e.key === 'ArrowLeft' ? (i - 1 + shown.length) % shown.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? shown.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(shown[to].id, true);
  };
  const p = FINANCE_ASSISTANT_PROMO;
  return (
    <aside aria-label="Advert" className="relative rounded-card border border-border bg-card p-4 text-card-foreground" data-testid="free-tools-banner">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded border border-border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{ADVERT_LABEL}</span>
        <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-2 h-8 w-8" aria-label="Hide this advert for now" onClick={dismiss}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className={`mt-2 grid gap-4 ${active ? 'md:grid-cols-2' : ''}`}>
        {active && (
          <section aria-label="Partner offers" data-testid="ftb-partners">
            {shown.length > 1 ? (
              <div role="tablist" aria-label="Partner category" className="flex flex-wrap gap-1" data-testid="ftb-groups">
                {shown.map((g, i) => (
                  <button key={g.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`ftb-tab-${g.id}`}
                    aria-selected={g.id === active.id} aria-controls="ftb-panel" tabIndex={g.id === active.id ? 0 : -1}
                    onClick={() => choose(g.id)} onKeyDown={(e) => onKey(e, i)}
                    className={`rounded-md border px-2 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${g.id === active.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="text-sm font-semibold">{active.label}</h2>
            )}
            <p aria-live="polite" className="sr-only" data-testid="ftb-group-announce">{shown.length > 1 ? `Showing ${active.label}` : ''}</p>
            <div id="ftb-panel" role={shown.length > 1 ? 'tabpanel' : undefined} aria-labelledby={shown.length > 1 ? `ftb-tab-${active.id}` : undefined}>
              <ul className="mt-1 space-y-2">
                {active.partners.map((b) => (
                  <li key={b.id} className="text-sm" data-testid="ftb-partner">
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
            </div>
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
