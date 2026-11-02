// Phase 30c: the AI credit balance shown to customers. One source of truth: public.get_ai_credits_info() (own account
// only, SECURITY DEFINER), read by src/hooks/useAiCredits.ts. These helpers are pure so they are easy to test.

/**
 * Phase 35 (owner decision, 2 Nov 2026): what a trial / no-plan account starts with. docs/phase35/proposal.sql makes
 * check_and_deduct_ai_credit create the missing subscribers row with 50 / 50 (was 10 / 10); aiCredits.test.ts checks
 * the two agree.
 */
export const TRIAL_AI_CREDITS = 50;

export interface AiCredits {
  /** Everything that can be spent now: monthly + unexpired top-up credits (Phase 37). The generators check this. */
  remaining: number;
  limit: number;
  /** ISO date the allowance resets, or null when the monthly count hasn't started (no subscribers row yet). */
  resetDate: string | null;
  tier: string | null;
  /**
   * No subscribers row yet. get_ai_credits_info() then answers with a reset date of "now + 1 month" that moves on every
   * call. What the server will really do (check_and_deduct_ai_credit): on the first AI request it creates the row with
   * TRIAL_AI_CREDITS of TRIAL_AI_CREDITS and the month starts then. So that figure is shown; the reset date is not.
   */
  notStarted: boolean;
  /** Phase 37: monthly credits left (used first). Missing before Phase 37 is applied: then all of `remaining` is monthly. */
  monthlyRemaining?: number;
  /** Phase 37: unexpired purchased (top-up) credits, used after the monthly ones. */
  topupCredits?: number;
  /** Phase 37: when the soonest top-up credits expire (ISO), or null. */
  topupNextExpiry?: string | null;
}

/** Monthly credits left (Phase 37 split; before it, all of `remaining`). */
export const monthlyOf = (c: Pick<AiCredits, 'remaining' | 'monthlyRemaining' | 'topupCredits'>) =>
  c.monthlyRemaining ?? Math.max(0, c.remaining - (c.topupCredits ?? 0));
export const topupOf = (c: Pick<AiCredits, 'topupCredits'>) => Math.max(0, c.topupCredits ?? 0);

export type CreditLevel = 'none' | 'critical' | 'low' | 'ok';

/** limit 0 → 'none' (never divides by zero); under 10% → 'critical'; under 20% → 'low'. */
export function creditLevel(remaining: number, limit: number): CreditLevel {
  if (!(limit > 0)) return 'none';
  const pct = (Math.max(0, remaining) / limit) * 100;
  if (pct < 10) return 'critical';
  if (pct < 20) return 'low';
  return 'ok';
}

export const creditPercent = (remaining: number, limit: number) =>
  limit > 0 ? Math.min(100, Math.max(0, Math.round((remaining / limit) * 100))) : 0;

const n = (x: number) => x.toLocaleString('en-GB');

/** "42 of 250 AI credits left this month" (or "No AI credits on this plan"). Monthly credits only (Phase 37). */
export function creditsLeftLine(c: Pick<AiCredits, 'remaining' | 'limit' | 'monthlyRemaining' | 'topupCredits'>): string {
  if (!(c.limit > 0)) return 'No AI credits on this plan';
  return `${n(monthlyOf(c))} of ${n(c.limit)} AI credit${c.limit === 1 ? '' : 's'} left this month`;
}

const longDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Phase 37: "+ 300 top-up credits (expire from 2 November 2027)", or null with none. */
export function topupLine(c: Pick<AiCredits, 'topupCredits' | 'topupNextExpiry'>): string | null {
  const t = topupOf(c);
  if (t <= 0) return null;
  const when = longDate(c.topupNextExpiry);
  return `+ ${n(t)} top-up credit${t === 1 ? '' : 's'}${when ? ` (expire from ${when})` : ''}`;
}

/** "Resets 1 December 2026" (en-GB), or null without a real date. */
export function resetLine(resetDate: string | null): string | null {
  const when = longDate(resetDate);
  return when ? `Resets ${when}` : null;
}

export const NOT_STARTED_LINE = `Your ${TRIAL_AI_CREDITS} credits start counting from your first AI request.`;
export const TRIAL_LINE = 'Included in your free trial';
export const CREDITS_LOAD_ERROR = "Couldn't load your credits";
/** The 10 must match CREDITS_PER_DOCUMENT (src/lib/legalDocuments.ts); aiCredits.test.ts checks it. */
export const CREDITS_USAGE_NOTE = "Advisor answers use 1 credit, contracts and legal notices use 10. Unused monthly credits don't roll over; top-up credits last 12 months and are used after your monthly credits.";

/** Reads an RPC answer; null when it isn't one. */
export function parseCreditsInfo(data: unknown, hasRow: boolean): AiCredits | null {
  const d = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!d || typeof d.credits_remaining !== 'number' || typeof d.credits_limit !== 'number') return null;
  // Phase 37 adds monthly_remaining / topup_credits / topup_next_expiry. Without them (before Phase 37) all is monthly.
  const topup = typeof d.topup_credits === 'number' ? Math.max(0, d.topup_credits) : 0;
  const monthly = typeof d.monthly_remaining === 'number' ? d.monthly_remaining : d.credits_remaining - topup;
  // No row yet: show what the server creates on the first request (TRIAL_AI_CREDITS), not the RPC's placeholder.
  return {
    remaining: hasRow ? monthly + topup : TRIAL_AI_CREDITS + topup,
    limit: hasRow ? d.credits_limit : TRIAL_AI_CREDITS,
    resetDate: hasRow && typeof d.reset_date === 'string' ? d.reset_date : null,
    tier: typeof d.subscription_tier === 'string' ? d.subscription_tier : null,
    notStarted: !hasRow,
    monthlyRemaining: hasRow ? monthly : TRIAL_AI_CREDITS,
    topupCredits: topup,
    topupNextExpiry: topup > 0 && typeof d.topup_next_expiry === 'string' ? d.topup_next_expiry : null,
  };
}
