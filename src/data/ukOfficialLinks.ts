// Phase 38: official UK pages the free tools link to. Every URL here was already used in B2BNEST (Business Resources,
// src/components/BusinessResources.tsx). gov.uk could not be opened from the session that wrote Phase 38 (3 Nov 2026),
// so no fee or figure from these pages is copied into the app: the tools link to them for the current details.
export const GOV = {
  setUpBusiness: 'https://www.gov.uk/set-up-business',
  soleTrader: 'https://www.gov.uk/set-up-as-sole-trader',
  limitedCompany: 'https://www.gov.uk/set-up-limited-company',
  companyRecords: 'https://www.gov.uk/running-a-limited-company/company-and-accounting-records',
  registerVat: 'https://www.gov.uk/register-for-vat/how-register-for-vat',
  mtdVat: 'https://www.gov.uk/government/collections/making-tax-digital-for-vat',
  hmrcOnline: 'https://www.gov.uk/log-in-register-hmrc-online-services',
  employingStaff: 'https://www.gov.uk/employing-staff',
  paye: 'https://www.gov.uk/paye-for-employers',
  minimumWage: 'https://www.gov.uk/national-minimum-wage',
  pensions: 'https://www.gov.uk/workplace-pensions-employers',
  dataProtection: 'https://www.gov.uk/data-protection-your-business',
  businessSupport: 'https://www.gov.uk/get-business-support',
  financeSupport: 'https://www.gov.uk/business-finance-support',
  browseBusiness: 'https://www.gov.uk/browse/business',
} as const;
export const LINKS_NOTE = 'Links go to GOV.UK, which has the current rules and fees. Check there before you rely on anything here.';
