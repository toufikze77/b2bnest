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
/** What the user picks and fills in (the screen uses these fields). */
export interface DocTypeBase { id: string; kind: DocKind; group: string; label: string; fields: DocField[] }
/**
 * Phase 30d: what a competent UK solicitor-drafted version contains. The system prompt requires every clause, each with a
 * numbered heading and full sub-clauses, and a length of at least minWords; the handler refuses (and refunds) an answer
 * under 70% of it.
 */
export interface DocRequirements { requiredClauses: string[]; minWords: number }
export interface DocType extends DocTypeBase, DocRequirements {}

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

const BASE_TYPES: DocTypeBase[] = [
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


// ---------------------------------------------------------------------------------------------------------------------
// Phase 30d: required clauses and word targets per document type. The lists are what a competent UK solicitor-drafted
// version of each document contains; the prompt requires all of them (see handler.ts systemPrompt).

const BOILERPLATE = [
  "Force majeure",
  "Assignment and subcontracting",
  "Entire agreement",
  "Variation",
  "Waiver",
  "Notices (how and where notices are served, and when they are treated as received)",
  "Severance",
  "No partnership or agency",
  "Third-party rights (exclusion under the Contracts (Rights of Third Parties) Act 1999)",
  "Counterparts and electronic signature",
  "Governing law and jurisdiction",
];
const OPENING = ["Parties and date", "Background (recitals)", "Definitions and interpretation"];
/** Contracts only: notices never have one (catalogue test). */
export const SIGNATURE_CLAUSE = "Signature blocks for each party (name, position, signature and date)";
const LIABILITY =
  "Limitation of liability (an overall cap; exclusion of indirect and consequential loss; and no limit on liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be limited or excluded by law)";
const LATE_PAYMENT = "Late payment interest under the Late Payment of Commercial Debts (Interest) Act 1998";
const DATA_PROTECTION =
  "Data protection (UK GDPR and the Data Protection Act 2018, including processor terms where one party processes personal data for the other)";
const TERMINATION = "Termination (on notice, for material breach not remedied within a stated period, and for insolvency)";

const SERVICE_CORE = [
  ...OPENING,
  "Commencement and term",
  "The services and service standards (reasonable skill and care, and good industry practice)",
  "Client obligations, dependencies and relief where the client causes delay",
  "Change control",
  "Fees, invoicing and payment terms",
  LATE_PAYMENT,
  "Expenses",
  "VAT",
  "Intellectual property rights (ownership, assignment or licence, and background IP)",
  "Confidentiality",
  DATA_PROTECTION,
  "Warranties",
  LIABILITY,
  "Insurance",
  TERMINATION,
  "Consequences of termination (payment for work done, return of materials and survival of clauses)",
  "Dispute resolution (escalation before court proceedings)",
  ...BOILERPLATE,
];
const serviceClauses = (extra: string[]) => [
  ...SERVICE_CORE, ...extra, "Schedule 1: the services and deliverables", "Schedule 2: fees and payment", SIGNATURE_CLAUSE,
];

const EMPLOYMENT_HEAD = [
  "Parties and date",
  "Definitions and interpretation",
  "Start date and date continuous employment began",
];
const EMPLOYMENT_BODY = [
  "Job title and duties",
  "Place of work",
  "Hours of work (and a Working Time Regulations 1998 opt-out only if the facts ask for one)",
  "Pay (amount, intervals and method) and deductions",
  "Holidays and holiday pay (at least the statutory 5.6 weeks, including how bank holidays are treated)",
  "Sickness absence, reporting and statutory sick pay",
  "Other paid leave (family-friendly leave by reference to statute and any policies)",
  "Pension (automatic enrolment under the Pensions Act 2008)",
  "Benefits",
  "Training the employer requires and any training paid for by the employer",
  "Notice periods (at least the statutory minimum under section 86 of the Employment Rights Act 1996)",
  "Payment in lieu of notice and garden leave",
  "Confidentiality",
  "Intellectual property created in the course of employment",
  "Data protection (reference to the employee privacy notice)",
  "Disciplinary and grievance procedures (by reference to the employer's procedures)",
  "Collective agreements (state that none apply if none do)",
  "Restrictive covenants (only if the facts ask for them; otherwise state that there are none)",
  "Return of company property",
  "Governing law and jurisdiction",
  "Signature blocks for the employer and the employee (name, signature and date)",
];

const GOODS_HEAD = [
  ...OPENING,
  "The goods and their specification",
  "Orders, quotations and acceptance",
  "Price, invoicing and payment",
  LATE_PAYMENT,
];
const GOODS_BODY = [
  "Delivery (time, place, method and partial deliveries)",
  "Risk and title (with retention of title until payment)",
  "Inspection, acceptance and rejection",
  "Quality warranties (the Sale of Goods Act 1979 implied terms, and any exclusion only so far as reasonable under the Unfair Contract Terms Act 1977)",
  "Remedies for defective goods",
  LIABILITY,
  "Intellectual property",
  "Confidentiality",
  TERMINATION,
  "Consequences of termination",
  ...BOILERPLATE,
];

const NDA_CORE = [
  ...OPENING,
  "The purpose",
  "Confidential information (definition)",
  "Exclusions (public information, already known, independently developed, received from a third party)",
  "Obligations of confidentiality and restricted use",
  "Permitted disclosure (employees and advisers who need to know, and disclosure required by law or a regulator)",
  "Return and destruction of information",
  "Duration of the obligations",
  "No licence and no warranty",
  "Remedies (damages may not be adequate; injunctions and specific performance)",
  "No obligation to proceed with any transaction",
  DATA_PROTECTION,
  "Entire agreement, variation and waiver",
  "Notices",
  "Third-party rights (exclusion under the Contracts (Rights of Third Parties) Act 1999)",
  "Governing law and jurisdiction",
  SIGNATURE_CLAUSE,
];

const PRIVACY_RIGHTS =
  "Your rights under UK GDPR (access, rectification, erasure, restriction, portability, objection, and rights about automated decision-making) and how to use them";
const NOTICE_END = ["How to complain to the Information Commissioner's Office (ICO)", "Changes to this notice", "How to contact us"];

const REQUIREMENTS: Record<string, DocRequirements> = {
  service_agreement: { minWords: 2800, requiredClauses: serviceClauses([]) },
  freelance_contractor: { minWords: 2600, requiredClauses: serviceClauses([
    "Status: an independent contractor, not an employee or worker (the contractor is responsible for their own tax and National Insurance; off-payroll working (IR35) where it applies)",
    "Right of substitution",
    "No exclusivity: the contractor may work for others",
  ]) },
  consulting_agreement: { minWords: 2600, requiredClauses: serviceClauses([
    "Key personnel",
    "Advice only: the client makes its own decisions and no particular result is guaranteed",
  ]) },
  subcontractor_agreement: { minWords: 2600, requiredClauses: serviceClauses([
    "Flow-down of the head contract obligations that apply to the subcontracted work",
    "The contractor's right to inspect, test and reject work",
    "Set-off",
  ]) },
  statement_of_work: { minWords: 1500, requiredClauses: [
    "Parties, date and the master agreement this statement of work sits under",
    "Background and objectives",
    "Scope of work and deliverables",
    "Out of scope",
    "Milestones and timetable",
    "Acceptance criteria and acceptance process",
    "Fees, payment schedule and expenses",
    "Assumptions and dependencies",
    "Client responsibilities",
    "Project governance, key contacts and reporting",
    "Change control",
    "Order of precedence between this statement of work and the master agreement",
    SIGNATURE_CLAUSE,
  ] },
  marketing_agency: { minWords: 2600, requiredClauses: serviceClauses([
    "Campaign briefs, approval of creative and sign-off",
    "Third-party media and supplier costs",
    "Advertising standards: each party's responsibilities under the CAP Code and the Privacy and Electronic Communications Regulations 2003 (PECR)",
    "Reporting and performance data (no guaranteed results)",
  ]) },
  website_development: { minWords: 2700, requiredClauses: serviceClauses([
    "Specification, design approval and milestones",
    "Acceptance testing and defect fixing",
    "Hosting, domain names and third-party services",
    "Open-source and third-party components (and their licences)",
    "Content supplied by the client",
    "Support and maintenance after launch (or a statement that none is included)",
  ]) },

  employment_contract: { minWords: 2500, requiredClauses: [...EMPLOYMENT_HEAD, "Probationary period", ...EMPLOYMENT_BODY] },
  fixed_term_employment: { minWords: 2500, requiredClauses: [
    ...EMPLOYMENT_HEAD,
    "Fixed term, end date and the reason for the fixed term",
    "Early termination during the fixed term",
    "Equal treatment of fixed-term employees (Fixed-term Employees (Prevention of Less Favourable Treatment) Regulations 2002)",
    ...EMPLOYMENT_BODY,
  ] },
  zero_hours_worker: { minWords: 2200, requiredClauses: [
    "Parties and date",
    "Definitions and interpretation",
    "Worker status (a worker, not an employee) and start date",
    "No guaranteed hours: how work is offered, accepted and cancelled",
    "No exclusivity (exclusivity terms are unenforceable under the Exclusivity Terms in Zero Hours Contracts (Redress) Regulations 2015)",
    "Role and duties",
    "Place of work",
    "Pay (at least the National Minimum Wage), timesheets and deductions",
    "Holiday entitlement and holiday pay for irregular-hours workers",
    "Sickness reporting and statutory sick pay",
    "Pension (automatic enrolment where eligible)",
    "Training",
    "Confidentiality",
    "Intellectual property",
    "Data protection (reference to the privacy notice)",
    "Disciplinary and grievance procedures (by reference)",
    "Ending the arrangement and notice",
    "Return of property",
    "Governing law and jurisdiction",
    "Signature blocks for the business and the worker (name, signature and date)",
  ] },
  internship: { minWords: 1800, requiredClauses: [
    "Parties and date",
    "Definitions and interpretation",
    "Status of the intern (worker or volunteer) and the National Minimum Wage position",
    "Length of the placement and start date",
    "Learning objectives, supervisor and feedback",
    "Hours and place of work",
    "Pay or expenses",
    "Holiday and absence",
    "Health and safety",
    "Confidentiality",
    "Intellectual property",
    "Data protection (reference to the privacy notice)",
    "Conduct and ending the placement early",
    "Governing law and jurisdiction",
    "Signature blocks for the business and the intern (name, signature and date)",
  ] },

  sale_of_goods: { minWords: 2500, requiredClauses: [...GOODS_HEAD, ...GOODS_BODY, "Schedule 1: the goods and prices", SIGNATURE_CLAUSE] },
  supply_agreement: { minWords: 2700, requiredClauses: [
    ...GOODS_HEAD,
    "Forecasts, minimum quantities and capacity",
    "Price review",
    "Service levels and remedies for late delivery",
    ...GOODS_BODY,
    "Product recall",
    "Schedule 1: the products, specification and prices",
    SIGNATURE_CLAUSE,
  ] },
  distribution_reseller: { minWords: 2700, requiredClauses: [
    ...OPENING,
    "Appointment and territory",
    "Exclusivity (or non-exclusivity) and reserved rights",
    "Competition law: the distributor sets its own resale prices (Competition Act 1998 and the Vertical Agreements Block Exemption Order 2022)",
    "Minimum purchase or sales targets",
    "Orders and supply of the products",
    "Prices and payment",
    LATE_PAYMENT,
    "Marketing and use of trade marks (licence and restrictions)",
    "The distributor's obligations",
    "The supplier's obligations",
    "Product warranties and recalls",
    "Records, reporting and audit",
    LIABILITY,
    "Confidentiality",
    DATA_PROTECTION,
    "Term and termination",
    "Consequences of termination (unsold stock, trade marks and customer data)",
    ...BOILERPLATE,
    "Schedule 1: the products, territory and prices",
    SIGNATURE_CLAUSE,
  ] },
  commercial_agent: { minWords: 2700, requiredClauses: [
    ...OPENING,
    "Appointment, territory and products",
    "Exclusivity",
    "The agent's duties (Commercial Agents (Council Directive) Regulations 1993, regulation 3)",
    "The principal's duties (regulation 4), including information and notice of accepted or refused orders",
    "Authority of the agent (whether the agent may conclude contracts)",
    "Commission: rate, when it is earned and when it is due (regulations 7 to 12)",
    "Commission statements and the agent's right to information",
    "Expenses",
    "Confidentiality",
    DATA_PROTECTION,
    "Term and termination (with at least the minimum notice periods in regulation 15)",
    "Indemnity or compensation on termination (regulation 17; state which applies, compensation by default)",
    "Restraint of trade after termination (no longer than two years, regulation 20)",
    LIABILITY,
    ...BOILERPLATE,
    "Schedule 1: products, territory and commission rates",
    SIGNATURE_CLAUSE,
  ] },
  referral_affiliate: { minWords: 2000, requiredClauses: [
    ...OPENING,
    "Appointment and the referral programme",
    "Qualifying referrals",
    "Referral fees or commission: rates, when earned and when paid",
    "Tracking, reporting and disputes about referrals",
    "Marketing standards (CAP Code, and PECR consent for electronic marketing)",
    "Use of names and trade marks",
    DATA_PROTECTION,
    "No authority to bind the other party",
    "Confidentiality",
    LIABILITY,
    "Term and termination",
    "Fees after termination",
    ...BOILERPLATE,
    "Schedule 1: commission rates",
    SIGNATURE_CLAUSE,
  ] },
  software_licence: { minWords: 2700, requiredClauses: [
    ...OPENING,
    "Grant of licence (scope, number of users, permitted purpose and territory)",
    "Licence restrictions (copying, modification, and reverse engineering only as far as the law allows)",
    "Delivery and installation",
    "Acceptance",
    "Licence fees and payment",
    LATE_PAYMENT,
    "Support, maintenance and updates",
    "Intellectual property (the licensor keeps ownership)",
    "Open-source components",
    "Warranties",
    "Intellectual property indemnity",
    LIABILITY,
    "Confidentiality",
    DATA_PROTECTION,
    "Audit of use",
    "Term and termination",
    "Consequences of termination (stop using and delete the software)",
    "Source code escrow (or a statement that there is none)",
    ...BOILERPLATE,
    "Schedule 1: the software and licence fees",
    SIGNATURE_CLAUSE,
  ] },
  saas_terms: { minWords: 3000, requiredClauses: [
    ...OPENING,
    "The subscription and access to the service",
    "User accounts and security of log-ins",
    "Acceptable use",
    "Customer data (ownership, and the licence to process it)",
    "Data protection and processor terms (UK GDPR Article 28)",
    "Availability, service levels and support",
    "Security measures",
    "Fees, renewal and price changes",
    LATE_PAYMENT,
    "Suspension for non-payment or misuse",
    "Intellectual property",
    "Third-party services and integrations",
    "Warranties",
    "Indemnities",
    LIABILITY,
    "Term and renewal",
    "Termination and the return or export of customer data",
    "Confidentiality",
    ...BOILERPLATE,
    "Schedule 1: subscription plan, fees and service levels",
    SIGNATURE_CLAUSE,
  ] },
  terms_of_sale_b2b: { minWords: 2500, requiredClauses: [
    "Definitions and interpretation",
    "Application of these terms (they apply instead of any terms the customer puts forward)",
    "Basis of contract (quotations, orders and acceptance)",
    "The goods or services",
    "Delivery",
    "Risk and title (retention of title until payment)",
    "Price and payment",
    LATE_PAYMENT,
    "Quality (warranty, and any exclusion only so far as reasonable under the Unfair Contract Terms Act 1977)",
    "Customer's obligations",
    LIABILITY,
    "Intellectual property",
    "Confidentiality",
    DATA_PROTECTION,
    "Cancellation by the customer",
    TERMINATION,
    "Consequences of termination",
    ...BOILERPLATE,
    "Signature block for the customer's acceptance (name, position, signature and date)",
  ] },

  nda_mutual: { minWords: 1300, requiredClauses: NDA_CORE },
  nda_one_way: { minWords: 1200, requiredClauses: NDA_CORE.map((c) => (
    c === "Obligations of confidentiality and restricted use" ? "The recipient's obligations of confidentiality and restricted use" : c)) },
  data_processing_agreement: { minWords: 2000, requiredClauses: [
    ...OPENING,
    "Roles of the parties (controller and processor) and compliance with data protection law",
    "Processing only on the controller's documented instructions",
    "Confidentiality of personnel",
    "Security of processing (UK GDPR Article 32)",
    "Sub-processors (prior written authorisation and flow-down of obligations)",
    "Assisting with data subjects' rights requests",
    "Assisting with security, breach notification, data protection impact assessments and prior consultation (Articles 32 to 36)",
    "Personal data breaches (notice without undue delay, and what it must contain)",
    "International transfers (only with appropriate safeguards such as the International Data Transfer Agreement or the UK Addendum)",
    "Audits and information",
    "Deletion or return of personal data at the end",
    "Liability",
    "Term and termination",
    "Order of precedence with the main agreement",
    "Governing law and jurisdiction",
    "Schedule 1: details of the processing (subject matter, duration, nature and purpose, types of personal data, categories of data subjects)",
    "Schedule 2: technical and organisational security measures",
    SIGNATURE_CLAUSE,
  ] },
  loan_agreement: { minWords: 2200, requiredClauses: [
    ...OPENING,
    "The loan and drawdown",
    "Purpose",
    "Interest (rate, how it is calculated and when it is paid)",
    "Repayment schedule",
    "Voluntary prepayment",
    "Default interest",
    "Representations and warranties of the borrower",
    "Undertakings of the borrower",
    "Events of default",
    "Consequences of default (acceleration and demand)",
    "Security or guarantee (or a statement that the loan is unsecured)",
    "Costs and expenses",
    "Payments, set-off and no deduction",
    "Assignment and transfer",
    "Notices",
    "Entire agreement, variation and waiver",
    "Severance",
    "Third-party rights (exclusion under the Contracts (Rights of Third Parties) Act 1999)",
    "Governing law and jurisdiction",
    "Schedule 1: repayment schedule",
    SIGNATURE_CLAUSE,
  ] },
  partnership_agreement: { minWords: 2700, requiredClauses: [
    ...OPENING,
    "Name and nature of the business",
    "Commencement and duration",
    "Capital contributions",
    "Shares of profits and losses",
    "Drawings",
    "Bank accounts, books, records and annual accounts",
    "Management and decisions (matters needing unanimous consent)",
    "Duties of the partners (good faith, time and attention, no competing business)",
    "Holidays, sickness and absence",
    "Admission of new partners",
    "Retirement",
    "Expulsion",
    "Death or incapacity",
    "Payments to outgoing partners",
    "Dissolution and winding up",
    "Restrictive covenants after leaving (only if the facts ask for them)",
    "Dispute resolution",
    "Relationship with the Partnership Act 1890 (this agreement overrides its default rules where they differ)",
    "Notices",
    "Entire agreement and variation",
    "Governing law and jurisdiction",
    SIGNATURE_CLAUSE,
  ] },
  mou: { minWords: 1200, requiredClauses: [
    ...OPENING,
    "Purpose and scope of the collaboration",
    "Roles and responsibilities",
    "Timetable and next steps",
    "Costs",
    "Confidentiality (legally binding)",
    "Intellectual property",
    "Status: not legally binding except the clauses stated to be binding",
    "Duration and termination",
    "Governing law and jurisdiction (for the binding clauses)",
    SIGNATURE_CLAUSE,
  ] },
  letter_of_intent: { minWords: 1200, requiredClauses: [
    "Parties and date",
    "The proposed transaction",
    "Key commercial terms (price or consideration, and structure)",
    "Conditions (due diligence, finance, approvals and a definitive agreement)",
    "Timetable",
    "Exclusivity (legally binding, only if the facts ask for it)",
    "Confidentiality (legally binding)",
    "Costs",
    "Status: not legally binding except the clauses stated to be binding",
    "Termination of this letter",
    "Governing law and jurisdiction (for the binding clauses)",
    SIGNATURE_CLAUSE,
  ] },

  website_privacy_policy: { minWords: 1800, requiredClauses: [
    "Who we are (the controller, company details and ICO registration number)",
    "The personal data we collect",
    "How we collect it",
    "How we use it and our lawful bases (UK GDPR Article 6)",
    "Special category data (only if relevant to the facts; otherwise state that none is collected)",
    "Cookies and similar technologies (with a reference to the cookie policy)",
    "Marketing and how to opt out (PECR)",
    "Who we share it with (processors and other recipients)",
    "International transfers (only if transfers outside the UK were ticked; otherwise state that data stays in the UK)",
    "How long we keep it",
    "How we keep it secure",
    PRIVACY_RIGHTS,
    "Children's data",
    ...NOTICE_END,
  ] },
  cookie_policy: { minWords: 1400, requiredClauses: [
    "Who we are",
    "What cookies and similar technologies are",
    "The cookies we use (a table with name, provider, purpose and duration, using placeholders where unknown)",
    "Strictly necessary cookies",
    "Analytics cookies (only if analytics was ticked)",
    "Functional cookies",
    "Advertising and tracking cookies (only if advertising was ticked)",
    "Consent under PECR and how to change your choices",
    "Third-party cookies",
    "How to manage cookies in your browser",
    ...NOTICE_END,
  ] },
  employee_privacy_notice: { minWords: 2000, requiredClauses: [
    "Who we are (the controller and contact details)",
    "Who this notice applies to (employees, workers, contractors and job applicants)",
    "The personal data we hold (recruitment, employment, pay and performance)",
    "Special category and criminal offence data (conditions under Schedule 1 to the Data Protection Act 2018)",
    "How we collect it",
    "Why we use it and our lawful bases",
    "Right to work checks",
    "Monitoring (only if the facts mention it; otherwise state that there is none beyond what is described)",
    "Who we share it with (payroll, pension provider, HMRC and advisers)",
    "International transfers (only if transfers outside the UK were ticked)",
    "How long we keep it",
    "How we keep it secure",
    PRIVACY_RIGHTS,
    "Automated decision-making",
    ...NOTICE_END,
  ] },
  customer_privacy_notice: { minWords: 1600, requiredClauses: [
    "Who we are (the controller and contact details)",
    "The personal data we collect about customers and contacts",
    "Where we get it from",
    "How we use it and our lawful bases",
    "Marketing (PECR and the soft opt-in) and how to opt out",
    "Who we share it with",
    "International transfers (only if transfers outside the UK were ticked)",
    "How long we keep it",
    "How we keep it secure",
    PRIVACY_RIGHTS,
    ...NOTICE_END,
  ] },
  cctv_privacy_notice: { minWords: 1200, requiredClauses: [
    "Who operates the CCTV (the controller and contact details)",
    "Where the cameras are and what they cover",
    "Why we use CCTV",
    "Our lawful basis (legitimate interests)",
    "Audio recording (state that there is none unless the facts say otherwise)",
    "Who can view the footage",
    "Sharing with the police and others",
    "How long we keep footage",
    "How we keep it secure",
    "Your rights, including how to ask for a copy of footage of you",
    "Review of the CCTV system",
    ...NOTICE_END,
  ] },
  data_retention_policy: { minWords: 1600, requiredClauses: [
    "Purpose and scope",
    "Roles and responsibilities",
    "Principles (the storage limitation principle in UK GDPR Article 5(1)(e))",
    "Retention schedule (a table of record type, retention period, reason or legal requirement and action at the end, with bracketed periods to confirm)",
    "Legal holds",
    "Secure deletion and destruction",
    "Anonymisation",
    "Review of this policy",
    "Breaches of this policy",
    "Contact",
  ] },
  website_terms_of_use: { minWords: 1800, requiredClauses: [
    "Who we are (company name, number, registered office and contact details)",
    "Accepting these terms",
    "Changes to these terms and to the site",
    "Accessing the site",
    "Accounts and passwords (only if the site has accounts)",
    "Acceptable use",
    "Intellectual property in the site",
    "No reliance on information on the site",
    "Limitation of our liability (separately for business users and consumers, and never limiting what the law does not allow)",
    "Viruses and security",
    "Linking to our site",
    "Third-party links and resources",
    "Content you upload (only if users can upload content)",
    "Privacy and cookies (reference to the policies)",
    "Governing law and jurisdiction (consumers may also bring proceedings where they live in the UK)",
    "How to contact us",
  ] },
};

export const DOC_TYPES: DocType[] = BASE_TYPES.map((d) => {
  const req = REQUIREMENTS[d.id];
  if (!req) throw new Error(`No requirements for ${d.id}`);
  return { ...d, ...req };
});

export const docTypeById = (id: string) => DOC_TYPES.find((d) => d.id === id);
export const docTypesFor = (kind: DocKind) => DOC_TYPES.filter((d) => d.kind === kind);
export const fieldLabel = (doc: DocType, id: FieldId) => doc.fields.find((x) => x.id === id)?.label ?? FIELDS[id].label;
