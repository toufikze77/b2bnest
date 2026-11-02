// Phase 37: AI credit top-up packs as the app shows them. The server is the only source of what is sold and charged
// (public.ai_topup_packs, read by create-ai-topup-checkout); this copy is for display only and aiTopups.test.ts checks it
// matches docs/phase37/proposal.sql and supabase/functions/_shared/topup-packs.ts exactly.
import { billingKind } from '@/lib/billingView';
import type { Access } from '@/lib/access';

export type TopupPackView = { id: string; credits: number; amountPence: number };

export const TOPUP_PACKS: readonly TopupPackView[] = [
  { id: 'credits_100', credits: 100, amountPence: 500 },
  { id: 'credits_300', credits: 300, amountPence: 1200 },
  { id: 'credits_1000', credits: 1000, amountPence: 3500 },
];
export const TOPUP_CAP = 5000;
export const TOPUP_VALID_MONTHS = 12;

const n = (x: number) => x.toLocaleString('en-GB');
/** "£12" or "£12.50". */
export const poundsLabel = (pence: number) => `£${pence % 100 === 0 ? n(pence / 100) : (pence / 100).toFixed(2)}`;
/** "5p a credit", "4p a credit", "3.5p a credit". */
export const perCreditLabel = (p: TopupPackView) => {
  const v = Math.round((p.amountPence / p.credits) * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1).replace(/\.0$/, '')}p a credit`;
};
export const packTitle = (p: TopupPackView) => `${n(p.credits)} credits`;

export const TOPUP_RULES = `Top-up credits last ${TOPUP_VALID_MONTHS} months and are used after your monthly credits. Monthly credits don't roll over. For subscribers only. Prices as shown.`;
export const CHOOSE_PLAN_FIRST = 'Choose a plan first. Top-ups are for subscribers.';
export const COMPANY_TOPUP_TEXT = "Top-ups are bought by subscribers for their own account. Your company's plan is managed by its account owner.";
export const PAYMENT_RECEIVED = 'Payment received. Your credits will appear in a moment.';
export const PAYMENT_STILL_WAITING = "We're still waiting for Stripe to confirm the payment. Your credits will appear once it does; you won't be charged twice.";
export const PAYMENT_ARRIVED = 'Your top-up credits are ready.';
export const PAYMENT_CANCELLED = 'Payment cancelled. Nothing was charged.';
export const TOPUP_FALLBACK_ERROR = "Couldn't start the top-up. Please try again.";
export const TOPUP_BILLING_PATH = '/settings?tab=billing#ai-topup';

export type TopupOffer = 'buy' | 'plan_first' | 'company';
/** Who may buy: their own paid plan, or an owner / master account (testing). The server checks again. */
export function topupOffer(access: Pick<Access, 'state' | 'via'>, storedSubscribed: boolean): TopupOffer {
  const kind = billingKind(access, storedSubscribed);
  if (kind === 'paid' || kind === 'owner') return 'buy';
  if (kind === 'company') return 'company';
  return 'plan_first';
}

/** How many times, and how often, the Billing page re-reads the balance after Stripe sends the customer back. */
export const RETURN_POLL = { tries: 5, everyMs: 3000 } as const;

/** Pricing and Help: "Can I buy more AI credits?" (built from the catalogue). */
export const TOPUP_FAQ_QUESTION = 'Can I buy more AI credits?';
export const TOPUP_FAQ_ANSWER = `Yes, if you subscribe on your own plan: top-ups in Settings → Billing are ${TOPUP_PACKS.map((p) => `${packTitle(p)} for ${poundsLabel(p.amountPence)}`).join(', ')}, as one-off payments. Prices as shown. Top-up credits last ${TOPUP_VALID_MONTHS} months and are used after your monthly credits. Monthly credits don't roll over. Top-ups aren't available during the free trial or to company members whose company pays.`;
