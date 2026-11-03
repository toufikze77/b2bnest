// Phase 38: Business Setup Checklist data (UK steps, GOV.UK links). Ticks are saved in this browser only.
import { GOV } from '@/data/ukOfficialLinks';

export interface ChecklistStep { id: string; title: string; description: string; category: string; link?: { label: string; url: string }; when?: string }

/** Phase 38: UK steps only, each with its GOV.UK page where there is one. */
export const SETUP_STEPS: ChecklistStep[] = [
  { id: 'idea', title: 'Describe your business', description: 'Who you sell to, what you sell and how you will reach customers.', category: 'Planning' },
  { id: 'structure', title: 'Choose a structure', description: 'Sole trader, partnership, limited company or LLP. Each has different tax and paperwork.', category: 'Legal', link: { label: 'Set up a business', url: GOV.setUpBusiness } },
  { id: 'name', title: 'Choose a business name', description: 'Check the name rules for your structure before you use it.', category: 'Legal', link: { label: 'Set up a business', url: GOV.setUpBusiness } },
  { id: 'companies-house', title: 'Register with Companies House', description: 'For a limited company or an LLP.', category: 'Legal', when: 'Limited companies and LLPs', link: { label: 'Set up a limited company', url: GOV.limitedCompany } },
  { id: 'hmrc', title: 'Register with HMRC', description: 'Self Assessment for sole traders and partners; Corporation Tax for a limited company.', category: 'Tax', link: { label: 'Set up as a sole trader', url: GOV.soleTrader } },
  { id: 'hmrc-online', title: 'Set up your HMRC online account', description: 'For VAT, PAYE and Corporation Tax.', category: 'Tax', link: { label: 'HMRC online services', url: GOV.hmrcOnline } },
  { id: 'vat', title: 'Check whether you need to register for VAT', description: 'Required once taxable turnover goes over the threshold; you can also register voluntarily.', category: 'Tax', link: { label: 'How to register for VAT', url: GOV.registerVat } },
  { id: 'bank', title: 'Open a business bank account', description: 'Keeping business money separate makes records and tax easier.', category: 'Money' },
  { id: 'records', title: 'Set up record keeping', description: 'Keep records of sales, costs and receipts; a limited company has extra rules.', category: 'Money', link: { label: 'Company and accounting records', url: GOV.companyRecords } },
  { id: 'insurance', title: 'Arrange insurance', description: "Employers' liability insurance is required by law once you employ people; other cover depends on your business.", category: 'Insurance', link: { label: 'Employing staff for the first time', url: GOV.employingStaff } },
  { id: 'data', title: 'Check your data protection duties (GDPR)', description: 'If you use personal data about customers or staff, including whether you must pay the ICO fee.', category: 'Data', link: { label: 'Data protection and your business', url: GOV.dataProtection } },
  { id: 'employing', title: 'Before you employ anyone', description: 'Payroll (PAYE), the minimum wage and workplace pensions.', category: 'People', when: 'If you employ people', link: { label: 'PAYE and payroll for employers', url: GOV.paye } },
];
export const CHECKLIST_KEY = 'b2bnest.setupChecklist.v1';

export function loadDone(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && SETUP_STEPS.some((s) => s.id === x)) : [];
  } catch { return []; }
}

