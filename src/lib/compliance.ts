// Phase 38: Compliance Checker rules (UK). Every item links to the GOV.UK page it is based on.
import { GOV } from '@/data/ukOfficialLinks';

export type Answer = 'yes' | 'no' | '';
export interface ComplianceAnswers { structure: '' | 'sole_trader' | 'partnership' | 'limited_company' | 'llp'; employs: Answer; personalData: Answer; vatTurnover: Answer }
export interface ComplianceItem { id: string; title: string; text: string; source: { label: string; url: string } }

export const NOT_LEGAL_ADVICE = 'General guidance, not legal advice. Rules change and depend on your business: check the official page, and speak to an accountant or solicitor if you are unsure.';

/** Phase 38: UK duties from a few questions. Every item links to the GOV.UK page it is based on. */
export function complianceItems(a: ComplianceAnswers): ComplianceItem[] {
  const out: ComplianceItem[] = [];
  if (a.structure === 'sole_trader') out.push({ id: 'sa', title: 'Register for Self Assessment', text: 'Sole traders register with HMRC and send a Self Assessment tax return.', source: { label: 'Set up as a sole trader', url: GOV.soleTrader } });
  if (a.structure === 'partnership' || a.structure === 'llp') out.push({ id: 'partners', title: 'Register the partners with HMRC', text: 'Partners are registered for Self Assessment; check what the business itself must register.', source: { label: 'Set up a business', url: GOV.setUpBusiness } });
  if (a.structure === 'limited_company') {
    out.push({ id: 'ch', title: 'Companies House and Corporation Tax', text: 'A limited company is registered at Companies House and must register for Corporation Tax.', source: { label: 'Set up a limited company', url: GOV.limitedCompany } });
    out.push({ id: 'records', title: 'Company and accounting records', text: 'A limited company must keep company and accounting records for a set time.', source: { label: 'Company and accounting records', url: GOV.companyRecords } });
  }
  if (a.structure === 'llp') out.push({ id: 'llp', title: 'Companies House', text: 'An LLP is registered at Companies House and files with it every year.', source: { label: 'Set up a business', url: GOV.setUpBusiness } });
  if (a.vatTurnover === 'yes') {
    out.push({ id: 'vat', title: 'VAT registration', text: 'Once taxable turnover goes over the VAT threshold you must register for VAT.', source: { label: 'How to register for VAT', url: GOV.registerVat } });
    out.push({ id: 'mtd', title: 'Making Tax Digital for VAT', text: 'VAT-registered businesses keep digital records and send returns through compatible software.', source: { label: 'Making Tax Digital for VAT', url: GOV.mtdVat } });
  }
  if (a.employs === 'yes') {
    out.push({ id: 'employing', title: 'Employer duties', text: "Including employers' liability insurance and checking the right to work.", source: { label: 'Employing staff for the first time', url: GOV.employingStaff } });
    out.push({ id: 'paye', title: 'PAYE and payroll', text: 'Register as an employer and run payroll.', source: { label: 'PAYE and payroll for employers', url: GOV.paye } });
    out.push({ id: 'nmw', title: 'National Minimum Wage and Living Wage', text: 'Pay at least the current rates.', source: { label: 'The National Minimum Wage and Living Wage', url: GOV.minimumWage } });
    out.push({ id: 'pensions', title: 'Workplace pensions', text: 'Automatic enrolment duties for eligible staff.', source: { label: 'Workplace pensions for employers', url: GOV.pensions } });
  }
  if (a.personalData === 'yes') out.push({ id: 'data', title: 'Data protection (UK GDPR)', text: 'Using personal data comes with duties, and you may need to pay the ICO fee.', source: { label: 'Data protection and your business', url: GOV.dataProtection } });
  return out;
}

