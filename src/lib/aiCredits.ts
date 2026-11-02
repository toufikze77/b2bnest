// Phase 30c: the AI credit balance shown to customers. One source of truth: public.get_ai_credits_info() (own account
// only, SECURITY DEFINER), read by src/hooks/useAiCredits.ts. These helpers are pure so they are easy to test.

/**
 * Phase 35 (owner decision, 2 Nov 2026): what a trial / no-plan account starts with. docs/phase35/proposal.sql makes
 * check_and_deduct_ai_credit create the missing subscribers row with 50 / 50 (was 10 / 10); aiCredits.test.ts checks
 * the two agree.
 */
export const TRIAL_AI_CREDITS = 50;

export interface AiCredits {
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
}

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

/** "42 of 250 AI credits left" (or "No AI credits on this plan"). */
export function creditsLeftLine(c: Pick<AiCredits, 'remaining' | 'limit'>): string {
  if (!(c.limit > 0)) return 'No AI credits on this plan';
  return `${n(c.remaining)} of ${n(c.limit)} AI credit${c.limit === 1 ? '' : 's'} left`;
}

/** "Resets 1 December 2026" (en-GB), or null without a real date. */
export function resetLine(resetDate: string | null): string | null {
  if (!resetDate) return null;
  const d = new Date(resetDate);
  if (Number.isNaN(d.getTime())) return null;
  return `Resets ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export const NOT_STARTED_LINE = `Your ${TRIAL_AI_CREDITS} credits start counting from your first AI request.`;
export const TRIAL_LINE = 'Included in your free trial';
export const CREDITS_LOAD_ERROR = "Couldn't load your credits";
/** The 10 must match CREDITS_PER_DOCUMENT (src/lib/legalDocuments.ts); aiCredits.test.ts checks it. */
export const CREDITS_USAGE_NOTE = "Advisor answers use 1 credit, contracts and legal notices use 10. Unused credits don't roll over.";

/** Reads an RPC answer; null when it isn't one. */
export function parseCreditsInfo(data: unknown, hasRow: boolean): AiCredits | null {
  const d = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!d || typeof d.credits_remaining !== 'number' || typeof d.credits_limit !== 'number') return null;
  // No row yet: show what the server creates on the first request (TRIAL_AI_CREDITS), not the RPC's placeholder.
  return {
    remaining: hasRow ? d.credits_remaining : TRIAL_AI_CREDITS,
    limit: hasRow ? d.credits_limit : TRIAL_AI_CREDITS,
    resetDate: hasRow && typeof d.reset_date === 'string' ? d.reset_date : null,
    tier: typeof d.subscription_tier === 'string' ? d.subscription_tier : null,
    notStarted: !hasRow,
  };
}
