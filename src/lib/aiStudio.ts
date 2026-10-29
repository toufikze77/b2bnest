// AI Studio (Phase 20): shared lists, honest labels and the lock rule, so every tab says the same thing and a locked
// tab matches what the server will refuse.
import type { Access } from '@/lib/access';
import { workflowsNeedUpgrade } from '@/lib/access';
import { errorText } from '@/lib/workflowSteps';
import { AI_QUESTION_MAX_LENGTH } from '../../supabase/functions/_shared/ai-limits.ts';

export { AI_QUESTION_MAX_LENGTH };

/** The Advisor's lists, also used by Intelligent Analytics and Smart Personalization. */
export const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing',
  'Professional Services', 'Real Estate', 'Education', 'Food & Beverage', 'Other',
];
export const BUSINESS_STAGES = ['Startup', 'Growth Stage', 'Established', 'Scale-up', 'Enterprise'];

/** Shown on the Analytics screen and on every cost / document result (business-insights basis "example_figures"). */
export const EXAMPLE_FIGURES_LABEL = 'Based on example figures, not your business data';
/** Shown on industry trend results (basis "general"): no figures are used at all. */
export const GENERAL_TRENDS_LABEL = 'General industry trends from the AI, not your business data';
export const resultLabel = (insightType: string, basis?: unknown) =>
  basis === 'general' || insightType === 'industry_trend' ? GENERAL_TRENDS_LABEL : EXAMPLE_FIGURES_LABEL;

/** Smart Personalization: fixed guidance lists, not AI. */
export const PERSONALIZATION_NOTE =
  "These recommendations are general guidance for your industry and stage. They aren't written by AI and aren't based on your business data.";

export type AiFeatureId = 'advisor' | 'analytics' | 'workflows' | 'personalization';
export interface AiLock { badge: string; title: string; message: string; action: 'pricing' | 'contact' }

/**
 * Whether a tab is locked, by the same rules the server applies:
 *  * Advisor and Analytics call ai-assistant / business-insights, which refuse after the trial ends (402) and for a
 *    suspended account (403) — _shared/access.ts checkAccess on my_access_state(). Personalization follows the same
 *    access, like the rest of the app.
 *  * Workflows follow _shared/workflow-access.ts (Business and Scale, the trial, owners).
 * 'unknown' (not read yet) is never shown as locked; the server still decides.
 */
export function aiFeatureLock(access: Pick<Access, 'state' | 'planKey' | 'via'>, id: AiFeatureId): AiLock | null {
  if (access.state === 'suspended') {
    return { badge: 'Unavailable', title: 'This account has been suspended', message: 'Contact us if you think this is a mistake.', action: 'contact' };
  }
  if (access.state === 'trial_ended') {
    return {
      badge: 'Plan needed', title: 'Your 14-day trial has ended',
      message: access.via === 'company' ? "Ask your company's account owner to choose a plan." : 'Choose a plan to keep using AI Studio. Nothing has been deleted.',
      action: 'pricing',
    };
  }
  if (id === 'workflows' && workflowsNeedUpgrade(access)) {
    return {
      badge: 'Business', title: 'Workflows are included in the Business and Scale plans.',
      message: access.via === 'company' ? "Your company's plan doesn't include them. The account owner can change the plan." : "Your current plan doesn't include them.",
      action: 'pricing',
    };
  }
  return null;
}

/** The server's own message for a failed AI call (credits, trial, suspended, plan check), or a plain fallback. */
export async function aiErrorMessage(error: unknown, fallback: string): Promise<string> {
  return (await errorText(error)) ?? fallback;
}

/** "You have 41 of 250 AI credits left this month." from an ai-assistant reply, or null. */
export function creditsLeftText(data: unknown): string | null {
  const d = data as { credits_remaining?: unknown; credits_limit?: unknown } | null;
  if (typeof d?.credits_remaining !== 'number' || typeof d?.credits_limit !== 'number') return null;
  return `You have ${d.credits_remaining.toLocaleString('en-GB')} of ${d.credits_limit.toLocaleString('en-GB')} AI credits left this month.`;
}
