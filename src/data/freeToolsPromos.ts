// Phase 38: what the advert card on the free Business Tools shows (src/components/FreeToolsBanner.tsx).
// The owner changes this file, not the component.
//
// HOW TO ADD A BANK PARTNER (business bank account referral):
//   Add an object to BANK_PARTNERS, for example
//     { name: '<the bank's own name>', description: '<one line about the account>',
//       url: 'https://<the referral link the bank gave you>', offer: '<optional: the offer exactly as the bank states it>' },
//   - Use only the bank's real name, your real referral link and the offer wording the bank publishes. Don't add rates,
//     bonuses or claims the bank hasn't given you in writing, and remove an offer when it ends.
//   - The card then shows the bank section with "We may earn a commission if you open an account through these links".
//   While the list is empty, the bank section isn't shown at all.
import { TRIAL_DAYS } from '@/lib/helpAssistant';

export interface BankPartner {
  /** The bank's own name. */
  name: string;
  /** One line about the account. */
  description: string;
  /** The referral link (https). */
  url: string;
  /** Optional: the offer exactly as the bank states it. */
  offer?: string;
}

/** No partners yet: the real referral links aren't known. Don't add placeholders. */
export const BANK_PARTNERS: BankPartner[] = [];

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
