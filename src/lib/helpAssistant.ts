import { PLANS, type Plan, limitText, aiCreditsText, SEAT_LIMITS_NOTE } from '@/lib/plans';

/**
 * The homepage help assistant. It is NOT an AI: it matches keywords against a short list of questions and
 * answers only with facts this app can back up. Plan names, prices and user limits come from PLANS (the Pricing
 * page's own data). Anything it does not recognise gets an honest "I don't know" with links to Help and Contact.
 */

export interface HelpLink {
  label: string;
  to: string;
}

export interface HelpAnswer {
  text: string;
  links?: HelpLink[];
  suggestions?: string[];
}

export const HELP_LINK: HelpLink = { label: 'Help page', to: '/help' };
export const CONTACT_LINK: HelpLink = { label: 'Contact us', to: '/contact' };
export const PRICING_LINK: HelpLink = { label: 'Pricing page', to: '/pricing' };

/** Length of the free trial every new account gets (profiles.trial_ends_at default; stated on the Pricing page). */
export const TRIAL_DAYS = 14;

export const HELP_TOPICS: { id: string; label: string; question: string }[] = [
  { id: 'overview', label: 'What B2BNEST does', question: 'What is B2BNEST?' },
  { id: 'plans', label: 'Plans and prices', question: 'What plans do you offer?' },
  { id: 'start', label: 'Getting started', question: 'How do I get started?' },
  { id: 'integrations', label: 'Integrations', question: 'Which integrations can I connect?' },
  { id: 'help', label: 'Help and contact', question: 'How do I get help?' },
];

const money = (n: number) => `£${n}`;
export function describePlan(plan: Plan): string {
  return `${plan.name}: ${money(plan.monthly)} a month or ${money(plan.annual)} a year, ${limitText(plan)}, ${aiCreditsText(plan)}.`;
}

export const UNKNOWN_ANSWER: HelpAnswer = {
  text:
    "Sorry, I don't know the answer to that. I'm a simple help assistant that answers a short list of common questions; " +
    "I'm not an AI and I can't look anything up. The Help page has more answers, or you can contact the team.",
  links: [HELP_LINK, CONTACT_LINK],
  suggestions: HELP_TOPICS.map((t) => t.question),
};

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function answerQuestion(input: string): HelpAnswer {
  const q = input.toLowerCase();
  const named = PLANS.find((p) => q.includes(p.name.toLowerCase()));

  if (named) {
    return {
      text: `${describePlan(named)}\n\nThe full list of what's included is on the Pricing page. Every new account gets a ${TRIAL_DAYS}-day free trial of all features; after that you choose a plan.`,
      links: [PRICING_LINK],
      suggestions: ['What plans do you offer?', 'Is there a free trial?'],
    };
  }

  if (has(q, ['trial', 'free'])) {
    return {
      text: `Every new account gets a ${TRIAL_DAYS}-day free trial of all features. No card is needed. After ${TRIAL_DAYS} days you choose a plan to continue. Prices and what each plan includes are on the Pricing page.`,
      links: [PRICING_LINK],
      suggestions: ['What plans do you offer?'],
    };
  }

  if (has(q, ['price', 'pricing', 'cost', 'plan', 'subscription', 'how much', 'users', 'seats'])) {
    return {
      text: `There are ${PLANS.length} plans, priced in pounds:\n\n${PLANS.map(describePlan).join('\n')}\n\n${SEAT_LIMITS_NOTE} Every new account gets a ${TRIAL_DAYS}-day free trial of all features; after that you choose a plan. The full list of what each plan includes is on the Pricing page.`,
      links: [PRICING_LINK],
      suggestions: ['Is there a free trial?', 'How do I get started?'],
    };
  }

  if (has(q, ['integrat', 'connect', 'api', 'slack', 'google', 'outlook', 'xero', 'quickbooks', 'zapier'])) {
    return {
      text:
        "After you sign in, integrations are listed in the CRM under Integrations. A service shows a Connect button only " +
        "when its connection works today; the others are marked 'Not available yet'. I can't confirm any other tool here.",
      links: [HELP_LINK],
      suggestions: ['How do I get help?'],
    };
  }

  if (has(q, ['support', 'help', 'contact', 'ticket', 'email', 'phone', 'call', 'chat', 'response time'])) {
    return {
      text:
        "The Help page answers common questions. For anything else, use the Contact page to reach the team. " +
        "Support tickets are not switched on yet, and I can't promise a reply time.",
      links: [HELP_LINK, CONTACT_LINK],
    };
  }

  if (has(q, ['start', 'sign up', 'signup', 'register', 'begin', 'account', 'set up', 'setup'])) {
    return {
      text:
        `Create an account: you get a ${TRIAL_DAYS}-day free trial of all features, then you choose a plan. ` +
        "Once you're signed in, the menu takes you to the dashboard, CRM, projects and tasks, invoices and quotes, notes and templates.",
      links: [PRICING_LINK, HELP_LINK],
      suggestions: ['What plans do you offer?', 'What is B2BNEST?'],
    };
  }

  if (has(q, ['crm', 'customer', 'lead', 'deal', 'pipeline'])) {
    return {
      text: 'The CRM keeps your contacts and deals, with a deal pipeline and reports built from your own data.',
      suggestions: ['What plans do you offer?'],
    };
  }

  if (has(q, ['project', 'task', 'team'])) {
    return {
      text: 'Projects and tasks: create projects, add tasks with priorities and due dates, and view them as a list, board or calendar.',
      suggestions: ['What plans do you offer?'],
    };
  }

  if (has(q, ['invoice', 'quote', 'expense', 'finance', 'money', 'bill'])) {
    return {
      text: 'Invoices and quotes: create them, mark them sent or paid, and track expenses and money going out. Amounts are kept in each document\'s own currency.',
      suggestions: ['What plans do you offer?'],
    };
  }

  if (has(q, ['note', 'reminder'])) {
    return {
      text: 'Notes: write notes with lists and checklists, and set a reminder. When the time passes you get a notification inside B2BNEST.',
    };
  }

  if (has(q, ['template', 'document', 'contract'])) {
    return {
      text: 'Templates: start a project, workspace or document from a ready-made business template, then change it to suit you.',
    };
  }

  if (has(q, ['b2bnest', 'about', 'feature', 'what can', 'what does', 'overview'])) {
    return {
      text:
        'B2BNEST is a set of business tools in one place: a CRM for contacts and deals, projects and tasks, invoices and quotes, ' +
        'expenses, notes, business templates and AI tools that use monthly AI credits.',
      links: [PRICING_LINK],
      suggestions: ['What plans do you offer?', 'How do I get started?'],
    };
  }

  return UNKNOWN_ANSWER;
}
