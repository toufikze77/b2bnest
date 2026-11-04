import { KeyboardEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  commissionLine, FINANCE_ASSISTANT_PROMO, NOT_ADVICE_LINE, REFERRAL_GROUPS, REFERRAL_PARTNERS, visibleGroups,
  type ReferralContext, type ReferralGroup, type ReferralPartner,
} from '@/data/freeToolsPromos';

const read = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked: this view only */ } };

/**
 * Phase 39: referral links next to the task (the Setup Checklist's bank step, under the Cost Calculator's total, the
 * Business Resources page). Phase 39b: no "Advert" badge; a neutral label ("Business account: Revolut Business" under
 * "Banking & finance") with the commission line right under the link and "Not financial advice"; links marked
 * sponsored. Partners are grouped; a selector appears only when two or more groups have entries here. Dismissed for
 * this browser session only. Rendered with the page (no late insert), so nothing jumps. No tracking.
 */
export function ReferralSlot({ context, heading, groups = REFERRAL_GROUPS, partners = REFERRAL_PARTNERS }: {
  context: ReferralContext; heading?: string; groups?: ReferralGroup[]; partners?: ReferralPartner[];
}) {
  const dismissKey = `b2bnest.referralSlot.${context}.dismissed`;
  const groupKey = `b2bnest.referralSlot.group`;
  const [hidden, setHidden] = useState(() => read(dismissKey) === '1');
  const [chosen, setChosen] = useState(() => read(groupKey));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = visibleGroups(context, groups, partners);
  if (hidden || shown.length === 0) return null;
  const active = shown.find((g) => g.id === chosen) ?? shown[0];
  const many = shown.length > 1;
  const choose = (id: string, focus = false) => {
    setChosen(id); write(groupKey, id);
    if (focus) tabs.current[shown.findIndex((g) => g.id === id)]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === 'ArrowRight' ? (i + 1) % shown.length : e.key === 'ArrowLeft' ? (i - 1 + shown.length) % shown.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? shown.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    choose(shown[to].id, true);
  };
  const panel = `rs-panel-${context}`;
  return (
    <aside aria-label={heading ?? active.label} className="rounded-card border border-border bg-card p-3 text-card-foreground" data-testid={`referral-slot-${context}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {heading && <p className="text-sm font-semibold">{heading}</p>}
          {!many && <h3 className="text-sm font-semibold text-muted-foreground">{active.label}</h3>}
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mr-1 -mt-1 h-8 w-8 shrink-0" aria-label="Hide this for now" onClick={() => { write(dismissKey, '1'); setHidden(true); }}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {many ? (
        <div role="tablist" aria-label="Partner category" className="mt-2 flex flex-wrap gap-1">
          {shown.map((g, i) => (
            <button key={g.id} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`rs-tab-${context}-${g.id}`}
              aria-selected={g.id === active.id} aria-controls={panel} tabIndex={g.id === active.id ? 0 : -1}
              onClick={() => choose(g.id)} onKeyDown={(e) => onKey(e, i)}
              className={`rounded-md border px-2 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${g.id === active.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground'}`}>
              {g.label}
            </button>
          ))}
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only" data-testid="rs-group-announce">{many ? `Showing ${active.label}` : ''}</p>
      <div id={panel} role={many ? 'tabpanel' : undefined} aria-labelledby={many ? `rs-tab-${context}-${active.id}` : undefined}>
        <ul className="mt-1 space-y-1">
          {active.partners.map((p) => (
            <li key={p.id} className="text-sm" data-testid="rs-partner">
              {p.kind && <span className="font-medium">{p.kind}: </span>}
              <a href={p.url} target="_blank" rel="sponsored noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {p.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span className="text-muted-foreground"> · {p.description}</span>
              {p.offer && <span className="block text-xs text-foreground">{p.offer}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-foreground" data-testid="rs-commission">{commissionLine(active.partners.length)}</p>
        <p className="text-xs text-muted-foreground">{NOT_ADVICE_LINE}</p>
      </div>
    </aside>
  );
}

/** B2BNEST's own Business Finance Assistant: shown after a money result (ROI, Cost Calculator) and on the Overview. Never a pop-up. */
export function FinanceAssistantPromo() {
  const p = FINANCE_ASSISTANT_PROMO;
  return (
    <section aria-labelledby="fa-promo-title" className="rounded-card border border-border bg-card p-3 text-card-foreground" data-testid="finance-assistant-promo">
      <h2 id="fa-promo-title" className="text-sm font-semibold">{p.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
      <p className="mt-1 text-xs text-muted-foreground">{p.needs}</p>
      <Button asChild size="sm" variant="outline" className="mt-2"><Link to={p.to}>{p.cta}</Link></Button>
    </section>
  );
}
