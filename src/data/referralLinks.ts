// Referral links B2BNEST may earn a commission from. One source for every page that shows them (the Business Resources
// page and the advert card on the free Business Tools), so each link lives in one place.
// Owner to confirm each referral programme is active and that the link may be published.
export interface ReferralLink { name: string; provider: string; description: string; url: string }

export const REVOLUT_BUSINESS: ReferralLink = {
  name: 'Revolut Business account', provider: 'Revolut',
  description: 'A business bank account from Revolut. Check fees, plans and eligibility on Revolut’s website.',
  url: 'https://business.revolut.com/signup?promo=b2b-ref-028-H2-TXL&ext=bcc2bf37-a7ca-3f5f-a13b-fbfc4b6829b4&context=B2B_REFERRAL',
};
