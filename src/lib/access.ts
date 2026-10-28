// What the signed-in person can do. The server decides: public.my_access_state() (docs/phase12). The app only maps the
// row it returns. Owner decision (27 Oct 2026): every account gets a 14-day trial of everything; after that a plan is
// needed. There is no free tier.

export type AccessStateName = 'owner' | 'subscribed' | 'trial' | 'trial_ended';

/** One row of public.my_access_state(). */
export interface AccessStateRow {
  state: AccessStateName;
  trial_ends_at: string | null;
  days_left: number | null;
  plan_key: string | null;
  subscription_status: string | null;
  via: 'self' | 'company';
  owner_name?: string | null;
}

export interface Access {
  /** 'unknown' = could not be read (network/server error). Never shows the paywall; the server still refuses paid work. */
  state: AccessStateName | 'unknown';
  hasAccess: boolean;
  trialEnded: boolean;
  inTrial: boolean;
  daysLeft: number;
  trialEndsAt: string | null;
  planKey: string | null;
  subscriptionStatus: string | null;
  /** 'company' = the company's billing owner decides (member view: no payment buttons). */
  via: 'self' | 'company';
  ownerName: string | null;
}

const STATES: AccessStateName[] = ['owner', 'subscribed', 'trial', 'trial_ended'];

export const UNKNOWN_ACCESS: Access = {
  state: 'unknown', hasAccess: true, trialEnded: false, inTrial: false, daysLeft: 0, trialEndsAt: null,
  planKey: null, subscriptionStatus: null, via: 'self', ownerName: null,
};

export function accessFromState(row: AccessStateRow | null | undefined): Access {
  if (!row || !STATES.includes(row.state)) return UNKNOWN_ACCESS;
  const name = row.owner_name?.trim();
  return {
    state: row.state,
    hasAccess: row.state !== 'trial_ended',
    trialEnded: row.state === 'trial_ended',
    inTrial: row.state === 'trial',
    daysLeft: Math.max(0, Math.floor(Number(row.days_left) || 0)),
    trialEndsAt: row.trial_ends_at ?? null,
    planKey: row.plan_key ?? null,
    subscriptionStatus: row.subscription_status ?? null,
    via: row.via === 'company' ? 'company' : 'self',
    ownerName: name ? name : null,
  };
}

// Same list as stripe-webhook / check-subscription ENTITLED_STATUSES and my_access_state().
export const ENTITLED_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];
const OWNER_ROLES = ['super_admin', 'admin', 'owner'];

/**
 * Fallback ONLY while my_access_state() is not yet applied in production (docs/phase12/proposal.sql). Same rules,
 * applied to what the browser can read about the person themself (own roles, own trial date, own subscription row).
 * It cannot see a company owner's plan, so a member of a paying company may see "trial ended" until the SQL is applied.
 */
export function legacyStateRow(input: {
  roles: string[]; trialEndsAt: string | null;
  subscriber: { subscribed?: boolean | null; subscription_status?: string | null; plan_key?: string | null } | null;
  now?: Date;
}): AccessStateRow {
  const now = input.now ?? new Date();
  const ends = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / 86_400_000)) : 0;
  const base = { trial_ends_at: input.trialEndsAt, plan_key: null, subscription_status: null, via: 'self' as const, owner_name: null };
  if (input.roles.some((r) => OWNER_ROLES.includes(r))) return { ...base, state: 'owner', days_left: daysLeft };
  const s = input.subscriber;
  const entitled = s && (s.subscription_status == null ? !!s.subscribed : ENTITLED_STATUSES.includes(s.subscription_status));
  if (entitled) return { ...base, state: 'subscribed', days_left: 0, plan_key: s.plan_key ?? null, subscription_status: s.subscription_status ?? null };
  if (ends && ends.getTime() > now.getTime()) return { ...base, state: 'trial', days_left: daysLeft };
  return { ...base, state: 'trial_ended', days_left: 0 };
}

/** The trial banner text, or null when no banner should show. */
export function trialBannerText(access: Access): string | null {
  if (access.state !== 'trial') return null;
  return `Free trial: ${access.daysLeft} ${access.daysLeft === 1 ? 'day' : 'days'} left`;
}

/**
 * Routes that stay open after the trial ends: choosing and paying for a plan, account and billing settings, signing
 * in and out, joining a company, help and contact, legal pages, public content, public forms and pages, and the
 * support portal used by external customers.
 */
const EXEMPT_EXACT = ['/', '/about', '/pricing', '/auth', '/forgot-password', '/reset-password', '/join', '/onboarding',
  '/profile-setup', '/payment-success', '/help', '/contact', '/privacy', '/terms', '/business-resources', '/blog'];
const EXEMPT_PREFIXES = ['/settings', '/support/portal', '/knowledge-base', '/f', '/p', '/forms'];

export function isPaywallExempt(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return EXEMPT_EXACT.includes(path) || EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
