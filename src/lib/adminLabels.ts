// Admin labels (Phase 22). Admin shows the same plan names as the customer screens (Solo / Business / Scale) and never
// "Free": there is no free tier (owner decision). An account without a plan is shown by its real access state, read
// from the same single source as the app (_access_state_for via the admin list functions), or "No plan".
import { NO_PLAN, planDisplayName, planKeyOf } from '@/lib/plans';

export const ACCESS_STATE_LABEL: Record<string, string> = {
  owner: 'Full access (owner)',
  subscribed: 'Subscribed',
  trial: 'Trial',
  trial_ended: 'Trial ended',
  suspended: 'Suspended',
};

export interface AdminAccountRow {
  subscribed?: boolean | null;
  plan?: string | null;
  plan_key?: string | null;
  access_state?: string | null;
  is_trial_active?: boolean | null;
}

/**
 * What Admin → Users prints in the Plan column: the plan name when the account pays; otherwise the access state
 * (Trial, Trial ended, Suspended, Full access). Before the Phase 22 SQL is applied the row has no access_state, so the
 * old trial flag is used, and anything else is "No plan".
 */
export function accountPlanLabel(row: AdminAccountRow): string {
  if (row.subscribed) return planDisplayName(row.plan_key || row.plan);
  if (row.access_state && row.access_state !== 'subscribed' && ACCESS_STATE_LABEL[row.access_state]) return ACCESS_STATE_LABEL[row.access_state];
  if (!row.access_state && row.is_trial_active) return ACCESS_STATE_LABEL.trial;
  return NO_PLAN;
}

/** Admin → Subscriptions status values (admin_list_subscriptions) and their labels. "free" is the pre-Phase 22 value. */
export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  cancelled: 'Cancelled',
  not_completed: 'Checkout not completed',
  no_plan: NO_PLAN,
  free: NO_PLAN,
  trial: 'Trial',
};
export const subscriptionStatusLabel = (s: string | null | undefined) => SUBSCRIPTION_STATUS_LABEL[s ?? ''] ?? NO_PLAN;

/** Filters offered in Admin → Subscriptions (value sent to the server, label shown). */
export const SUBSCRIPTION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  // The value stays 'free' (an internal filter code, never shown): both the live SQL and Phase 22 accept it.
  { value: 'free', label: NO_PLAN },
  { value: 'trial', label: 'Trial' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'not_completed', label: 'Checkout not completed' },
];

/** Plan filters (value = stored plan key, as the server compares it). */
export const PLAN_FILTERS = [
  { value: 'all', label: 'All plans' },
  { value: 'starter', label: planDisplayName('starter') },
  { value: 'professional', label: planDisplayName('professional') },
  { value: 'enterprise', label: planDisplayName('enterprise') },
  { value: 'free', label: NO_PLAN },  // internal code accepted by the live SQL and by Phase 22
];

/** Status filters in Admin → Users (value sent to admin_list_users). */
export const USER_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'paid', label: 'Paying' },
  { value: 'free', label: NO_PLAN },  // internal code accepted by the live SQL and by Phase 22
  { value: 'trial', label: 'Trial' },
  { value: 'trial_ended', label: 'Trial ended' },  // Phase 22 SQL; the live SQL returns no rows for it
];

/**
 * Rows for a CSV export: "plan" becomes the display name (Solo / Business / Scale / No plan) and the raw value is kept
 * in its own "plan_key" column (starter / professional / enterprise, or empty) so nothing downstream breaks. A
 * pre-Phase 22 "free" status becomes "no_plan".
 */
export function csvPlanRows<T extends Record<string, unknown>>(rows: T[], planField: keyof T & string = 'plan'): Record<string, unknown>[] {
  return rows.map((r) => {
    const raw = (r.plan_key as string | null | undefined) || (r[planField] as string | null | undefined);
    const paying = r.subscribed === undefined ? true : !!r.subscribed;
    return {
      ...r,
      [planField]: paying || r.plan_key ? planDisplayName(raw) : accountPlanLabel(r as AdminAccountRow),
      plan_key: planKeyOf(raw) ?? '',
      ...(r.status === 'free' ? { status: 'no_plan' } : {}),
    };
  });
}
