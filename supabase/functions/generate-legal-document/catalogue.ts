// Phase 30: the documents generate-legal-document can draft, and the facts it asks for. Plain TypeScript (no Deno APIs):
// the frontend imports this same file (src/lib/legalDocuments.ts), so the screen and the function always agree.

export type DocKind = "contract" | "legal_notice";
export type Jurisdiction = "england_wales" | "scotland" | "northern_ireland";

export const JURISDICTIONS: { id: Jurisdiction; label: string; law: string; courts: string }[] = [
  { id: "england_wales", label: "England and Wales", law: "the law of England and Wales", courts: "the courts of England and Wales" },
  { id: "scotland", label: "Scotland", law: "Scots law", courts: "the Scottish courts" },
  { id: "northern_ireland", label: "Northern Ireland", law: "the law of Northern Ireland", courts: "the courts of Northern Ireland" },
];

export type FieldId =
  | "business_name" | "business_address" | "company_number" | "other_party_name" | "other_party_address"
  | "start_date" | "term" | "fee" | "currency" | "payment_terms_days" | "notice_period" | "scope" | "ip_ownership"
  | "liability_cap" | "confidentiality" | "job_title" | "place_of_work" | "hours_of_work" | "holiday_entitlement"
  | "website" | "contact_email" | "data_collected" | "ico_number" | "dpo_contact" | "details";

export type FieldInput = "text" | "textarea" | "date" | "select" | "checkboxes";
export interface FieldDef { id: FieldId; label: string; input: FieldInput; hint?: string; options?: { id: string; label: string }[] }

/** What a notice says the business collects. The ids are what the function receives (comma separated). */
export const DATA_COLLECTED_OPTIONS: { id: string; label: string }[] = [
  { id: "analytics", label: "Website analytics" },
  { id: "cookies", label: "Cookies" },
  { id: "payments", label: "Payments" },
  { id: "marketing_emails", label: "Marketing emails" },
  { id: "accounts", label: "Accounts and logins" },
  { id: "contact_forms", label: "Contact forms" },
  { id: "newsletter", label: "Newsletter" },
  { id: "social_login", label: "Social login (Google, Facebook…)" },
  { id: "advertising", label: "Advertising and tracking" },
  { id: "children", label: "Children's data (under 13)" },
  { id: "international_transfers", label: "Transfers outside the UK" },
  { id: "cctv", label: "CCTV" },
  { id: "recruitment", label: "Recruitment (job applicants)" },
];

export const FIELDS: Record<FieldId, FieldDef> = {
  business_name: { id: "business_name", label: "Your business name", input: "text" },
  business_address: { id: "business_address", label: "Your business address", input: "text" },
  company_number: { id: "company_number", label: "Company number", input: "text", hint: "From Companies House, if you are a company." },
  other_party_name: { id: "other_party_name", label: "Other party's name", input: "text" },
  other_party_address: { id: "other_party_address", label: "Other party's address", input: "text" },
  start_date: { id: "start_date", label: "Start date", input: "date" },
  term: { id: "term", label: "Length of the agreement", input: "text", hint: "For example 12 months, or until the work is finished." },
  fee: { id: "fee", label: "Fee or price", input: "text", hint: "For example 2,500 per month." },
  currency: { id: "currency", label: "Currency", input: "select", options: [{ id: "GBP", label: "GBP (£)" }, { id: "EUR", label: "EUR (€)" }, { id: "USD", label: "USD ($)" }] },
  payment_terms_days: { id: "payment_terms_days", label: "Payment terms (days)", input: "text", hint: "Days after invoice, for example 30." },
  notice_period: { id: "notice_period", label: "Notice period", input: "text", hint: "For example 1 month." },
  scope: { id: "scope", label: "Scope / deliverables", input: "textarea" },
  ip_ownership: {
    id: "ip_ownership", label: "Who owns the work (intellectual property)", input: "select",
    options: [{ id: "client", label: "The client owns it once paid" }, { id: "supplier", label: "The supplier keeps it and licenses it" }, { id: "shared", label: "Shared / decide in the details" }],
  },
  liability_cap: { id: "liability_cap", label: "Liability cap", input: "text", hint: "For example the fees paid in the last 12 months." },
  confidentiality: { id: "confidentiality", label: "Confidentiality", input: "text", hint: "For example 3 years after the end." },
  job_title: { id: "job_title", label: "Job title", input: "text" },
  place_of_work: { id: "place_of_work", label: "Place of work", input: "text" },
  hours_of_work: { id: "hours_of_work", label: "Hours of work", input: "text", hint: "For example 37.5 hours, Monday to Friday." },
  holiday_entitlement: { id: "holiday_entitlement", label: "Holiday entitlement", input: "text", hint: "For example 28 days including bank holidays." },
  website: { id: "website", label: "Website address", input: "text" },
  contact_email: { id: "contact_email", label: "Contact email for privacy questions", input: "text" },
  data_collected: { id: "data_collected", label: "What you collect or use", input: "checkboxes", options: DATA_COLLECTED_OPTIONS },
  ico_number: { id: "ico_number", label: "ICO registration number", input: "text", hint: "From the ICO register, if you have one." },
  dpo_contact: { id: "dpo_contact", label: "Data protection officer or contact", input: "text" },
  details: { id: "details", label: "Anything else to include", input: "textarea", hint: "Special terms, facts about your business, what to leave out." },
};

export const FIELD_MAX = 500;
export const DETAILS_MAX = 2000;

export interface DocField { id: FieldId; required?: boolean; label?: string }
export interface DocType { id: string; kind: DocKind; group: string; label: string; fields: DocField[] }

const f = (id: FieldId, required = false, label?: string): DocField => ({ id, required, ...(label ? { label } : {}) });
const parties = (other: string): DocField[] => [f("business_name", true), f("business_address"), f("company_number"), f("other_party_name", true, `${other} name`), f("other_party_address", false, `${other} address`)];
const services = (other: string): DocField[] => [
  ...parties(other), f("start_date"), f("term"), f("scope", true), f("fee"), f("currency"), f("payment_terms_days"), f("notice_period"),
  f("ip_ownership"), f("liability_cap"), f("confidentiality"), f("details"),
];
const employment = (other: string, extra: DocField[] = []): DocField[] => [
  f("business_name", true, "Employer name"), f("business_address", false, "Employer address"), f("company_number"),
  f("other_party_name", true, `${other} name`), f("other_party_address", false, `${other} address`), f("job_title", true), f("start_date", true),
  ...extra, f("place_of_work"), f("hours_of_work"), f("fee", false, "Pay (amount and how often)"), f("currency"), f("holiday_entitlement"),
  f("notice_period"), f("details"),
];
const commercial = (other: string): DocField[] => [
  ...parties(other), f("start_date"), f("term"), f("scope", true), f("fee"), f("currency"), f("payment_terms_days"), f("notice_period"),
  f("liability_cap"), f("ip_ownership"), f("details"),
];
const simple = (other: string, scopeLabel: string): DocField[] => [...parties(other), f("scope", true, scopeLabel), f("start_date"), f("term"), f("details")];
const notice = (website: boolean, data: boolean): DocField[] => [
  f("business_name", true), f("business_address"), f("company_number"), ...(website ? [f("website", true)] : []), f("contact_email", true),
  ...(data ? [f("data_collected")] : []), f("ico_number"), f("dpo_contact"), f("details"),
];

const G_SERVICES = "Services", G_EMPLOYMENT = "Employment", G_COMMERCIAL = "Commercial", G_OTHER = "Confidentiality and other", G_NOTICES = "Legal notices";

export const DOC_TYPES: DocType[] = [
  { id: "service_agreement", kind: "contract", group: G_SERVICES, label: "Service Agreement", fields: services("Client's") },
  { id: "freelance_contractor", kind: "contract", group: G_SERVICES, label: "Freelance / Independent Contractor Agreement", fields: services("Contractor's") },
  { id: "consulting_agreement", kind: "contract", group: G_SERVICES, label: "Consulting Agreement", fields: services("Client's") },
  { id: "subcontractor_agreement", kind: "contract", group: G_SERVICES, label: "Subcontractor Agreement", fields: services("Subcontractor's") },
  { id: "statement_of_work", kind: "contract", group: G_SERVICES, label: "Statement of Work", fields: services("Client's") },
  { id: "marketing_agency", kind: "contract", group: G_SERVICES, label: "Marketing / Agency Services Agreement", fields: services("Client's") },
  { id: "website_development", kind: "contract", group: G_SERVICES, label: "Website Design & Development Agreement", fields: services("Client's") },

  { id: "employment_contract", kind: "contract", group: G_EMPLOYMENT, label: "Employment Contract (written statement)", fields: employment("Employee's") },
  { id: "fixed_term_employment", kind: "contract", group: G_EMPLOYMENT, label: "Fixed-term Employment Contract", fields: employment("Employee's", [f("term", true, "End date or length of the fixed term")]) },
  { id: "zero_hours_worker", kind: "contract", group: G_EMPLOYMENT, label: "Zero-hours Worker Agreement", fields: employment("Worker's") },
  { id: "internship", kind: "contract", group: G_EMPLOYMENT, label: "Intern / Work Experience Agreement", fields: employment("Intern's", [f("term", false, "Length of the placement")]) },

  { id: "sale_of_goods", kind: "contract", group: G_COMMERCIAL, label: "Sale of Goods Agreement", fields: commercial("Buyer's") },
  { id: "supply_agreement", kind: "contract", group: G_COMMERCIAL, label: "Supply Agreement", fields: commercial("Customer's") },
  { id: "distribution_reseller", kind: "contract", group: G_COMMERCIAL, label: "Distribution / Reseller Agreement", fields: commercial("Distributor's") },
  { id: "commercial_agent", kind: "contract", group: G_COMMERCIAL, label: "Commercial Agent Agreement", fields: commercial("Agent's") },
  { id: "referral_affiliate", kind: "contract", group: G_COMMERCIAL, label: "Referral / Affiliate Agreement", fields: commercial("Partner's") },
  { id: "software_licence", kind: "contract", group: G_COMMERCIAL, label: "Software Licence Agreement", fields: commercial("Licensee's") },
  { id: "saas_terms", kind: "contract", group: G_COMMERCIAL, label: "SaaS / Subscription Terms", fields: commercial("Customer's") },
  { id: "terms_of_sale_b2b", kind: "contract", group: G_COMMERCIAL, label: "Terms and Conditions of Sale (B2B)", fields: [
    f("business_name", true), f("business_address"), f("company_number"), f("scope", true, "What you sell"), f("payment_terms_days"),
    f("currency"), f("liability_cap"), f("details"),
  ] },

  { id: "nda_mutual", kind: "contract", group: G_OTHER, label: "Non-Disclosure Agreement (mutual)", fields: simple("Other party's", "Purpose of sharing information") },
  { id: "nda_one_way", kind: "contract", group: G_OTHER, label: "Non-Disclosure Agreement (one-way)", fields: simple("Recipient's", "Purpose of sharing information") },
  { id: "data_processing_agreement", kind: "contract", group: G_OTHER, label: "Data Processing Agreement (UK GDPR Art. 28)", fields: [
    ...parties("Processor's"), f("scope", true, "What the processor does with the data"), f("data_collected", false, "Kinds of personal data"), f("term"), f("details"),
  ] },
  { id: "loan_agreement", kind: "contract", group: G_OTHER, label: "Loan Agreement (between businesses)", fields: [
    ...parties("Borrower's"), f("fee", true, "Loan amount"), f("currency"), f("start_date"), f("term", false, "Repayment period"), f("details", false, "Interest, repayment schedule and security"),
  ] },
  { id: "partnership_agreement", kind: "contract", group: G_OTHER, label: "Partnership Agreement", fields: simple("Partner's", "What the partnership does and who contributes what") },
  { id: "mou", kind: "contract", group: G_OTHER, label: "Memorandum of Understanding", fields: simple("Other party's", "What you are agreeing to work on") },
  { id: "letter_of_intent", kind: "contract", group: G_OTHER, label: "Letter of Intent", fields: simple("Other party's", "The proposed deal") },

  { id: "website_privacy_policy", kind: "legal_notice", group: G_NOTICES, label: "Website Privacy Policy", fields: notice(true, true) },
  { id: "cookie_policy", kind: "legal_notice", group: G_NOTICES, label: "Cookie Policy", fields: notice(true, true) },
  { id: "employee_privacy_notice", kind: "legal_notice", group: G_NOTICES, label: "Employee & Job Applicant Privacy Notice", fields: notice(false, true) },
  { id: "customer_privacy_notice", kind: "legal_notice", group: G_NOTICES, label: "Customer / Client Privacy Notice (non-website)", fields: notice(false, true) },
  { id: "cctv_privacy_notice", kind: "legal_notice", group: G_NOTICES, label: "CCTV Privacy Notice", fields: [...notice(false, false), f("place_of_work", false, "Where the cameras are")] },
  { id: "data_retention_policy", kind: "legal_notice", group: G_NOTICES, label: "Data Retention Policy", fields: notice(false, true) },
  { id: "website_terms_of_use", kind: "legal_notice", group: G_NOTICES, label: "Website Terms of Use", fields: notice(true, false) },
];

export const docTypeById = (id: string) => DOC_TYPES.find((d) => d.id === id);
export const docTypesFor = (kind: DocKind) => DOC_TYPES.filter((d) => d.kind === kind);
export const fieldLabel = (doc: DocType, id: FieldId) => doc.fields.find((x) => x.id === id)?.label ?? FIELDS[id].label;
