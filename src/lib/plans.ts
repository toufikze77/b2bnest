/**
 * The subscription plans shown on the Pricing page. This is the single source for plan names, prices (GBP),
 * user limits and listed features; anything else that mentions plans (e.g. the homepage help assistant)
 * reads them from here so it can never disagree with the Pricing page.
 */
export interface Plan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  description: string;
  /** Monthly price in GBP. */
  monthly: number;
  /** Annual price in GBP. */
  annual: number;
  userLimit: string;
  users: number;
  features: string[];
  cta: string;
  popular: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for solopreneurs and small teams',
    monthly: 19,
    annual: 190,
    userLimit: '1 user',
    users: 1,
    features: [
      '250 AI credits/month (~250 conversations)',
      'AI Business Advisor',
      'Basic document templates',
      'AI Studio (Basic features)',
      'Invoice & Quote generator',
      'Priority support',
      'Advanced AI analytics & workflows',
      'QR Code Generator',
      'Time Tracker',
      'Cash Flow Tracker',
      'ROI Calculator',
      'Email support',
      'Mobile app access',
    ],
    cta: 'Subscribe',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing teams and serious entrepreneurs',
    monthly: 35,
    annual: 350,
    userLimit: '5 users',
    users: 5,
    features: [
      '1,000 AI credits/month (~1,000 conversations)',
      'Everything in Starter',
      'AI Studio (Full access)',
      'Advanced AI analytics & workflows',
      'Intelligent automation builder',
      'Smart personalization engine',
      'Premium document templates',
      'CRM & Project Management',
      'Invoice & Quote generator',
      'Priority support',
      'Team collaboration tools',
      'Custom integrations',
    ],
    cta: 'Subscribe',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For scaling businesses and larger teams',
    monthly: 85,
    annual: 850,
    userLimit: '25 users',
    users: 25,
    features: [
      '5,000 AI credits/month (~5,000 conversations)',
      'Everything in Professional',
      'AI Studio (Enterprise features)',
      'Custom AI model training',
      'Advanced workflow automation',
      'Advanced analytics',
      'Custom AI integrations',
      'White-label AI solutions',
      'Dedicated account manager',
      'Custom integrations & API',
      'Training & onboarding',
      'SLA guarantee',
    ],
    cta: 'Subscribe',
    popular: false,
  },
];
