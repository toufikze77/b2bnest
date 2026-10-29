// What the AI assistant knows about B2BNEST (Phase 20). Plan names, prices, AI credits and which plans include
// workflows are BUILT from the plan catalogue (_shared/plans.ts) and the workflow rule (_shared/workflow-access.ts),
// so they can't drift from what the Pricing page and the server say. knowledge_test.ts fails if they disagree.
//
// Lines removed in Phase 20 because the code proves them false (see the PR): recurring tasks, task dependencies,
// P60/P45 generation, pension auto-enrolment, statutory payments (SSP/SMP/SPP), bank account integration via TrueLayer,
// document version control, sentiment analysis, predictive analytics, scheduled reports; and in WORKFLOWS: "uses the
// company's email settings" (it is sent from B2BNEST's address) and "steps that don't run yet are hidden" (they are
// shown as not available).
import { PLAN_CATALOG, type PlanDefinition } from "../_shared/plans.ts";
import { WORKFLOW_PLAN_KEYS } from "../_shared/workflow-access.ts";

/** Length of the free trial every new account gets (profiles.trial_ends_at default: now() + 14 days). */
export const TRIAL_DAYS = 14;
/** Same cap as Workflow Studio (src/lib/workflowSteps.ts MAX_STEPS) and workflow-execute. */
const WORKFLOW_MAX_STEPS = 10;

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
- Prices and what each plan includes are on the Pricing page. Never quote a price, credit amount or plan feature that isn't listed here.`;
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
- File attachments and document management

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
- Cash flow tracking
- ROI calculator
- Cost calculator with industry templates
- Multi-currency support
- Tax calculations (VAT, Corporation Tax)
- Financial reporting and analytics

## DOCUMENT MANAGEMENT
- Document templates library
- AI-powered document generation
- Contract generator
- Privacy policy generator
- Business cards designer
- Email signature generator
- Secure file storage
- Document sharing and collaboration

## AI FEATURES
- AI Document Assistant for document creation
- AI Business Advisor for strategic guidance (general advice; it doesn't read the user's own business data)
- Smart search across all data
- Content generation
- Business insights and recommendations (the AI Studio analytics use example figures, not the user's data)
- Automated data classification
- Each answer from the AI assistant (Advisor, document assistant) uses one AI credit. If the AI service fails, the credit is given back.

## SECURITY & COMPLIANCE
- Two-step sign-in is not active yet: signing in needs only a password
- Role-based access control
- Audit logs for all actions
- Data travels over HTTPS; storage is provided by Supabase
- No certifications are claimed. Don't state any security score, certification or audit.

## COLLABORATION
- Team workspaces
- Real-time collaboration
- Comments and mentions
- Activity feeds
- File sharing
- Team chat (coming soon)
- Video conferencing integration (coming soon)

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
