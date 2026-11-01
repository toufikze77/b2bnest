// What the AI assistant knows about B2BNEST (Phase 20). Plan names, prices, AI credits and which plans include
// workflows are BUILT from the plan catalogue (_shared/plans.ts) and the workflow rule (_shared/workflow-access.ts),
// so they can't drift from what the Pricing page and the server say. knowledge_test.ts fails if they disagree.
//
// Lines removed in Phase 20 because the code proves them false (see the PR): recurring tasks, task dependencies,
// P60/P45 generation, pension auto-enrolment, statutory payments (SSP/SMP/SPP), bank account integration via TrueLayer,
// document version control, sentiment analysis, predictive analytics, scheduled reports; and in WORKFLOWS: "uses the
// company's email settings" (it is sent from B2BNEST's address) and "steps that don't run yet are hidden" (they are
// shown as not available).
// Phase 21: COLLABORATION re-checked against the code. Removed the two promised-but-unbuilt lines (a chat feature and
// video calls; owner decision: no promises), "Comments and mentions" (no mentions exist), "File sharing" (no shared file
// storage) and "Real-time collaboration" (only task comments update live).
// Phase 30b: brought up to date for Phases 24-30. The contract and legal-notice lists are BUILT from the
// generate-legal-document catalogue (flattened as gld_catalogue.ts). Removed because the code proves them false: "File
// attachments and document management", "Secure file storage" and "Document sharing and collaboration" (the only file
// uploads are support-ticket attachments), "Business cards designer" and "Email signature generator" (no such tools).
import { PLAN_CATALOG, type PlanDefinition } from "../_shared/plans.ts";
import { WORKFLOW_PLAN_KEYS } from "../_shared/workflow-access.ts";
import { docTypesFor, JURISDICTIONS, type DocKind } from "../generate-legal-document/catalogue.ts";

/** Length of the free trial every new account gets (profiles.trial_ends_at default: now() + 14 days). */
export const TRIAL_DAYS = 14;
/** Same cap as Workflow Studio (src/lib/workflowSteps.ts MAX_STEPS) and workflow-execute. */
const WORKFLOW_MAX_STEPS = 10;
/** Same as CREDITS_PER_DOCUMENT in generate-legal-document/handler.ts (knowledge_test.ts fails if they differ). */
export const LEGAL_DOCUMENT_CREDITS = 2;

const pounds = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;
const plans = Object.values(PLAN_CATALOG);
const names = (keys: readonly string[]) => plans.filter((p) => keys.includes(p.key)).map((p) => p.name);
const join = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export const WORKFLOW_PLAN_NAMES = names(WORKFLOW_PLAN_KEYS);
export const NON_WORKFLOW_PLAN_NAMES = plans.filter((p) => !(WORKFLOW_PLAN_KEYS as readonly string[]).includes(p.key)).map((p) => p.name);

const planLine = (p: PlanDefinition) =>
  `- ${p.name}: ${pounds(p.prices.month.amount)} a month or ${pounds(p.prices.year.amount)} a year; ${p.aiCreditLimit.toLocaleString("en-GB")} AI credits a month`;

export function plansSection(): string {
  return `## PLANS AND PRICES (GBP)
${plans.map(planLine).join("\n")}
- Every new account gets a ${TRIAL_DAYS}-day free trial of all features, including workflows. After the trial a plan is needed to keep using the workspace.
- Prices and what each plan includes are on the Pricing page. Never quote a price, credit amount or plan feature that isn't listed here.
- Users can see their remaining AI credits and reset date on the Dashboard and in Settings → Billing.
- Settings → Billing: an account without a paid plan (for example during the trial) sees "You don't have a paid plan yet." and a View plans button that opens the Pricing page.`;
}

/** "Services: Service Agreement, Consulting Agreement …" per group, in catalogue order. */
export function documentTypeLines(kind: DocKind): string[] {
  const groups: { group: string; labels: string[] }[] = [];
  for (const d of docTypesFor(kind)) {
    const g = groups.find((x) => x.group === d.group);
    if (g) g.labels.push(d.label); else groups.push({ group: d.group, labels: [d.label] });
  }
  return groups.map((g) => `  - ${g.group}: ${g.labels.join("; ")}`);
}

export function legalDocumentsSection(): string {
  const [first, ...others] = JURISDICTIONS.map((j) => j.label);
  return `## CONTRACTS AND LEGAL NOTICES (Business Tools → Contract Generator, and Privacy & Legal Notices Generator)
- The AI drafts the document from the details the user types in. Law: ${first} by default, or ${others.join(" or ")}.
- Each document uses ${LEGAL_DOCUMENT_CREDITS} AI credits. If the AI fails or doesn't produce a usable document, the credits are given back.
- Contracts the Contract Generator can draft:
${documentTypeLines("contract").join("\n")}
- Notices the Privacy & Legal Notices Generator can draft (for most of them the user ticks what the business collects, such as cookies, payments or CCTV):
${documentTypeLines("legal_notice").join("\n")}
- Only these types can be drafted. Anything the user didn't give appears as a placeholder in square brackets, such as [Company number], to fill in.
- The result can be edited, copied, or downloaded as PDF, Word (.docx) or Markdown (.md). The last 10 documents of each generator are saved in that browser only (not on B2BNEST's servers or other devices).
- It is not legal advice: a qualified solicitor should check a document before anyone relies on it. Never say a generated document is compliant, approved or checked by a lawyer.`;
}

export function businessToolsSection(): string {
  return `## BUSINESS TOOLS
- Signed-out visitors only see the public pages (home, Pricing, Help, Knowledge base and the lists of tools and templates). Using a tool, a template or AI Studio, and the dashboard, needs signing in.
- Each tool page has a Back button and a breadcrumb. Back returns to the previous page in B2BNEST, or to Business tools.
- QR Code Generator: makes real, scannable QR codes for a web address, text, email, phone number, SMS, WhatsApp message, Wi-Fi network or contact card (vCard), with PNG and SVG downloads. The codes are created in the browser.
- Create Coupon: Generate, Validate, Manage and Import / Export tabs, with CSV import and export. Coupons are saved in that browser only.
- Cash Flow Tracker: income and expense entries with a longer list of UK business categories (including HMRC: VAT, PAYE / NI and Corporation Tax) and the user's own categories. It is in the menu under Money → Cash flow. Entries are saved in that browser only.`;
}

export function workflowsSection(): string {
  return `## WORKFLOWS (Workflow Studio)
- Included in the ${join(WORKFLOW_PLAN_NAMES)} plans, and during the ${TRIAL_DAYS}-day trial. Not included in ${join(NON_WORKFLOW_PLAN_NAMES)}.
- A workflow is a saved list of up to ${WORKFLOW_MAX_STEPS} "Send an email" steps that run in order when the user presses "Run now". Nothing starts by itself: there are no schedules and no starts from forms or record changes.
- Emails are sent from B2BNEST's sending address; replies go to the user's own verified account email. Delivery to the inbox isn't guaranteed.
- X (Twitter), LinkedIn and WhatsApp steps are switched off and never run for customers.
- There is no drag-and-drop builder, no loops or parallel steps, and no marketing email campaigns.`;
}

export function platformKnowledge(): string {
  return `
B2BNest Platform Features & Capabilities:

${plansSection()}

## PROJECT MANAGEMENT
- Create and manage unlimited projects with custom fields (name, description, status, progress, deadline, client, color, budget, priority, stage)
- Track project progress with visual indicators and deadlines
- Assign team members to projects with role-based permissions
- View projects in list or kanban board format
- Filter projects by status, priority, and team members
- Time tracking for projects and tasks
- Project activity timeline and history
- Budget tracking and financial management
- Client management and communication

## TASK MANAGEMENT
- Create tasks with priorities (low, medium, high), status, due dates
- Assign tasks to team members
- Add subtasks and checklists
- Task comments and collaboration
- Task history and activity logs
- Email notifications for task updates
- Search and filter tasks across projects

## INTEGRATION HUB
The Integration Hub allows users to connect external services:

### Google Calendar Integration
- Sync events and meetings with Google Calendar
- Create calendar events from within B2BNest
- View calendar availability
- Automatic event reminders

### iCloud Calendar Integration
- Connect and sync Apple iCloud Calendar
- Manage calendar events and schedules
- Two-way synchronization with iCloud
- Support for multiple Apple calendars

### Outlook Calendar Integration (Microsoft 365)
- Connect Microsoft Outlook 365 Calendar
- Sync events and meetings with Outlook
- Create and manage Outlook calendar events
- Integration with Microsoft 365 ecosystem

### OneDrive Integration
- Connect Microsoft OneDrive account via OAuth2
- Access and manage OneDrive files directly from B2BNest
- Automatic file synchronization
- Secure token management and refresh

### X (Twitter), LinkedIn and Facebook
- Accounts can be connected, but posting from B2BNEST is switched off for customers until it has been verified
- There is no post scheduling, analytics or engagement tracking

### Firecrawl Web Scraper
- Scrape single web pages or entire websites
- Extract clean, structured data from websites
- Convert web content to markdown or HTML
- LLM-ready data extraction for AI applications
- Rate limiting and credit-based usage
- Support for custom include/exclude tags
- Main content extraction (removes ads, navigation, etc.)

## HMRC (UK tax)
- HMRC filing is not available yet. Nothing is sent to HMRC: no VAT returns, no Corporation Tax or Self Assessment
  returns, no payroll RTI (FPS/EPS). Never tell a user they can file or have filed with HMRC through B2BNEST.
- Users can save company and HMRC details (VAT number, UTR, PAYE reference) and connect an HMRC sign-in for later use
- The VAT, payroll and tax return screens show example figures, labelled "Preview only"
- To file, users must go to HMRC directly or use their accountant

${workflowsSection()}

${businessToolsSection()}

${legalDocumentsSection()}

## CRM (Customer Relationship Management)
- Contact management with full profiles
- Deal pipeline with drag-and-drop stages
- Lead tracking and scoring
- Activity logging and notes
- Email integration
- Task and appointment scheduling
- Sales forecasting and reporting
- Custom fields and tags
- Multi-currency support

## PAYROLL (UK)
- Employee management
- Payroll calculations (UK tax and NI)
- Payslip generation
- RTI (FPS/EPS) filing with HMRC is not available yet; payroll figures are for preparation only

## FINANCIAL TOOLS
- Invoice generation and management
- Expense tracking and categorization
- Bill management and payments
- Cash Flow Tracker (see BUSINESS TOOLS)
- ROI calculator
- Cost calculator with industry templates
- Multi-currency support
- Tax calculations (VAT, Corporation Tax)
- Financial reporting and analytics

## DOCUMENT MANAGEMENT
- Document templates library
- AI-powered document generation
- Contract Generator and Privacy & Legal Notices Generator (see CONTRACTS AND LEGAL NOTICES)

## AI FEATURES
- AI Document Assistant for document creation
- AI Business Advisor for strategic guidance (general advice; it doesn't read the user's own business data)
- Smart search across all data
- Content generation
- Business insights and recommendations (the AI Studio analytics use example figures, not the user's data)
- Automated data classification
- Each answer from the AI assistant (Advisor, document assistant) uses one AI credit. If the AI service fails, the credit is given back.
- Each contract or legal notice uses ${LEGAL_DOCUMENT_CREDITS} AI credits (see CONTRACTS AND LEGAL NOTICES).

## SECURITY & COMPLIANCE
- Two-step sign-in is optional for each user (Settings → Security): a 6-digit code from an authenticator app such as Microsoft Authenticator, Google Authenticator, Authy or 1Password, checked by Supabase Auth. It is required for platform administrators to open the Admin area. There is no SMS option.
- Users can add a second phone as a backup. Someone who loses their phone and has no backup contacts support@b2bnest.online: a platform administrator checks it is them and then resets their two-step sign-in (the reason is recorded). There is no self-service reset.
- Role-based access control
- Audit logs for all actions
- Data travels over HTTPS; storage is provided by Supabase
- No certifications are claimed. Don't state any security score, certification or audit.

## COLLABORATION
- Workspaces for organising work
- Comments on tasks; new comments appear live for everyone viewing the task
- Project activity timeline
- There is no team chat, no video calls, no @mentions and no shared file storage

## REPORTING & ANALYTICS
- Custom dashboards
- Business insights
- Financial reports
- Project analytics
- Team performance metrics
- Export to PDF, Excel, CSV

## DEVICES
- Works in the web browser on computers and phones. There is no mobile app and no public API.

## HELP
- The Help page and Knowledge base answer common questions
- Users can contact the team from the Contact page. No plan includes a support response-time promise.
`;
}
