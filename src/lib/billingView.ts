import type { Access } from '@/lib/access';

/**
 * Phase 26: what this account's billing is, from the same single source as the rest of the app (my_access_state via
 * useAccess). Only a paid plan of your own has a Stripe customer, so only then is "Manage billing" offered.
 *   'paid'    : your own paid plan (Manage billing, Change plan)
 *   'company' : your company's plan, paid by its account owner (nothing to manage here)
 *   'owner'   : full access without a plan (platform owner / master account), unless it also pays for its own plan
 *   'none'    : no paid plan (trial, trial ended, suspended): "View plans"
 * When access could not be read ('unknown'), the old rule is kept: the stored subscription row decides.
 */
export type BillingKind = 'paid' | 'company' | 'owner' | 'none';
export function billingKind(access: Pick<Access, 'state' | 'via'>, storedSubscribed: boolean): BillingKind {
  if (access.state === 'unknown') return storedSubscribed ? 'paid' : 'none';
  if (access.state === 'subscribed') return access.via === 'company' ? 'company' : 'paid';
  // A platform owner / master account that also pays for its own plan keeps Manage billing.
  if (access.state === 'owner') return storedSubscribed ? 'paid' : 'owner';
  return 'none';
}
export const NO_PAID_PLAN = "You don't have a paid plan yet.";
export const TRIAL_ENDED_TEXT = 'Your 14-day trial has ended';
export const PORTAL_UNAVAILABLE = 'Billing portal unavailable';
