// Phase 38: what the advert card on the free Business Tools shows (src/components/FreeToolsBanner.tsx).
// The owner changes this file, not the component.
//
// REFERRAL PARTNERS, grouped by category. The card shows a group only when at least one of its entries has a link.
//   * To ADD A PARTNER: add an object to REFERRAL_PARTNERS with a unique id, the partner's own name, one line about it,
//     your referral link (https) and the group id it belongs to. An entry without a link is not shown.
//   * To ADD AN OFFER line: set `offer` to the wording exactly as the partner publishes it, and remove it when it ends.
//     Don't add rates, bonuses or fees the partner hasn't given you in writing.
//   * To ADD A GROUP (for example accounting software, insurance, payments, legal): add { id, label } to REFERRAL_GROUPS
//     in the order it should appear, then give entries that group id. With two or more groups that have entries the
//     card shows a group selector; "Banking & finance" stays first and is selected by default.
//   * The Revolut Business link itself lives in src/data/referralLinks.ts (shared with the Business Resources page).
import { TRIAL_DAYS } from '@/lib/helpAssistant';
import { REVOLUT_BUSINESS } from '@/data/referralLinks';

export interface ReferralGroup { id: string; label: string }
export interface ReferralPartner {
  id: string;
  /** The partner's own name. */
  name: string;
  /** One line about it. */
  description: string;
  /** The referral link (https). Without one, the entry is not shown. */
  url?: string;
  /** Optional: the offer exactly as the partner states it. */
  offer?: string;
  /** A REFERRAL_GROUPS id. */
  group: string;
}

/** Ordered; the first group is shown by default. Only "Banking & finance" for now; the owner adds more. */
export const REFERRAL_GROUPS: ReferralGroup[] = [
  { id: 'banking', label: 'Banking & finance' },
];

export const REFERRAL_PARTNERS: ReferralPartner[] = [
  { id: 'revolut-business', name: REVOLUT_BUSINESS.name, description: REVOLUT_BUSINESS.description, url: REVOLUT_BUSINESS.url, group: 'banking' },
];

const hasLink = (p: ReferralPartner) => typeof p.url === 'string' && /^https:\/\/\S+$/.test(p.url);
/** The groups to show, in order, each with its entries that have a link; empty groups are left out. */
export function visibleGroups(groups: ReferralGroup[] = REFERRAL_GROUPS, partners: ReferralPartner[] = REFERRAL_PARTNERS) {
  return groups.map((g) => ({ ...g, partners: partners.filter((p) => p.group === g.id && hasLink(p)) })).filter((g) => g.partners.length > 0);
}

/** B2BNEST's own Business Finance Assistant (Business Tools → Invoices & quotes). Must match what it does today. */
export const FINANCE_ASSISTANT_PROMO = {
  title: 'B2BNEST Business Finance Assistant',
  text: 'Invoices, quotes and money tracking in one place: create quotes and invoices, see what is owed, record expenses and outgoings, and keep suppliers and products together.',
  needs: `Needs a B2BNEST account and a plan (every new account starts with a ${TRIAL_DAYS}-day trial).`,
  cta: 'Open the Business Finance Assistant',
  to: '/business-tools?tool=business-finance-assistant',
};

export const ADVERT_LABEL = 'Advert';
export const COMMISSION_LINE = 'We may earn a commission if you open an account through these links.';
export const NOT_ADVICE_LINE = 'Not financial advice. Check the terms with the provider.';
