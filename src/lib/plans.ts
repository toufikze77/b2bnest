/**
 * The subscription plans shown on the Pricing page. This is the single source for plan names, prices (GBP),
 * user/admin limits, AI credits and listed features; anything else that mentions plans (the homepage help assistant,
 * the savings calculator, Settings → Billing) reads them from here. The server's catalogue is
 * supabase/functions/_shared/plans.ts; src/test/planCatalogue.test.ts fails if the two disagree.
 *
 * Every listed feature exists in the app today. Plan ids and stored tier names are unchanged (starter/Starter,
 * professional/Professional, enterprise/Enterprise); only the display names changed (Solo, Business, Scale).
 */
export type PlanId = 'starter' | 'professional' | 'enterprise';

export interface PlanLimits {
  /** Total users, owners and admins included. */
  users: number;
  /** Owners and admins together. */
  admins: number;
}

export interface Plan extends PlanLimits {
  id: PlanId;
  name: string;
  /** Value stored in subscribers.subscription_tier. */
  tier: string;
  description: string;
  /** Monthly price in GBP (new subscribers). */
  monthly: number;
  /** Annual price in GBP (new subscribers): 10 x monthly. */
  annual: number;
  aiCredits: number;
  features: string[];
  cta: string;
  popular: boolean;
  /** Earlier price still paid by existing subscribers; never offered to anyone new. */
  legacy?: PlanLimits & { monthly: number; annual: number };
}

/**
 * User and admin limits are listed on every plan but are NOT applied yet: turning them on is a separate, approved
 * database step (docs/phase11b). Until then this stays false and every screen says the limits aren't applied.
 */
export const SEAT_LIMITS_ENFORCED = false;
/** Date the limits start, once the owner sets it (shown as "from <date>"). */
export const SEAT_LIMITS_FROM: string | null = null;

export const SEAT_LIMITS_NOTE = SEAT_LIMITS_ENFORCED
  ? 'User and admin limits apply.'
  : SEAT_LIMITS_FROM
    ? `User and admin limits apply from ${SEAT_LIMITS_FROM}.`
    : "User and admin limits aren't applied yet. We'll announce the date before they start.";

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
/** "50 users, up to 5 admins" / "1 user (you are the admin)". */
export const limitText = (l: PlanLimits) =>
  l.users === 1 ? '1 user (you are the admin)' : `${count(l.users, 'user')}, up to ${count(l.admins, 'admin')}`;
export const aiCreditsText = (plan: Pick<Plan, 'aiCredits'>) => `${plan.aiCredits.toLocaleString('en-GB')} AI credits a month`;

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Solo',
    tier: 'Starter',
    description: 'For one person running a business',
    monthly: 19,
    annual: 190,
    users: 1,
    admins: 1,
    aiCredits: 250,
    features: [
      'AI Business Advisor',
      'Personalisation in AI Studio',
      'Invoice & Quote generator',
      'QR Code Generator',
      'Time Tracker',
      'Cash Flow Tracker',
      'ROI Calculator',
      'Document templates',
      'AI analytics (preview until it uses your own data)',
    ],
    cta: 'Subscribe',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Business',
    tier: 'Professional',
    description: 'For teams that work together',
    monthly: 59,
    annual: 590,
    users: 50,
    admins: 5,
    aiCredits: 1000,
    features: [
      'Everything in Solo',
      'CRM & Project Management',
      'Team members and roles',
      'Workflow builder (email steps only)',
    ],
    cta: 'Subscribe',
    popular: true,
    legacy: { monthly: 35, annual: 350, users: 5, admins: 5 },
  },
  {
    id: 'enterprise',
    name: 'Scale',
    tier: 'Enterprise',
    description: 'For larger teams',
    monthly: 89,
    annual: 890,
    users: 100,
    admins: 10,
    aiCredits: 5000,
    features: [
      'Everything in Business',
      'Higher user, admin and AI credit limits',
    ],
    cta: 'Subscribe',
    popular: false,
    legacy: { monthly: 85, annual: 850, users: 25, admins: 10 },
  },
];

export const planById = (id: string | null | undefined): Plan | undefined => PLANS.find((p) => p.id === id);
/** Display name for a stored tier ("Professional" → "Business"); unknown values are returned as they are. */
export const planNameForTier = (tier: string | null | undefined): string => {
  if (!tier) return 'Free';
  const p = PLANS.find((x) => x.tier.toLowerCase() === tier.toLowerCase() || x.id === tier.toLowerCase());
  return p ? p.name : tier === 'free' ? 'Free' : tier;
};
