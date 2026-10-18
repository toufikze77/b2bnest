# Phase 9: proposed text changes to the AI edge function prompts (NOT deployed)

Nothing here has been changed in the function code or deployed. These are proposals for the owner.

## 1. `supabase/functions/ai-assistant/index.ts` (used by AI Studio's AI Business Advisor and the AI workspace)

The `platformKnowledge` string (lines 73 to 293) tells the model the product has features it does not have, so the
model repeats them to customers. Untrue or unverifiable lines include:

| Line(s) | Says | Problem |
| --- | --- | --- |
| 94-96 | Recurring tasks, task dependencies, email notifications for task updates | Email sending is switched off app-wide (`src/lib/onboarding.ts`) |
| 128-142 | Schedule tweets, LinkedIn and Facebook posts; analytics; multiple accounts | X and LinkedIn steps are switched off; no scheduling exists |
| 166-167, 211-215 | PAYE/RTI submissions, P60/P45, pension auto-enrolment, SSP/SMP/SPP | HMRC payroll submission is simulated in the app (see PR) |
| 174-194 | Drag-and-drop workflow builder, triggers, loops, retries, schedules, monitoring, parallel runs | Workflows are a manual "Run now" list; email only |
| 243-248 | Sentiment analysis, automated data classification, predictive analytics | Not built |
| 253-258 | Audit logs for all actions, encryption at rest, **GDPR compliance, SOC 2 Type II certified infrastructure**, regular security audits, backup and disaster recovery | Certification and compliance claims B2BNEST cannot back up |
| 262-267 | Real-time collaboration; team chat and video "coming soon" | Not built / advertises unfinished features |
| 275-283 | Scheduled reports; API access, webhooks, REST API docs, rate limits | No public API exists |
| 286-291 | Email support, **live chat support** | There is no live chat; support tickets are not switched on |

**Proposed replacement for the whole `platformKnowledge` string:**

```text
B2BNEST features available today (describe only these; never promise anything else):
- CRM: contacts and deals, a deal pipeline, and reports built from the user's own data.
- Projects and tasks: projects, tasks with priorities and due dates, list, board and calendar views.
- Invoices and quotes: create them, mark them sent or paid; each keeps its own currency. Expenses, outgoings and suppliers.
- Notes: notes with lists and checklists; a reminder creates an in-app notification (no email).
- Templates: start a project, workspace or document from a business template.
- Workflows: a list of steps run with one click ("Run now"). Only email steps are switched on. No schedules or automatic triggers.
- Integration Hub: connect Google Calendar, iCloud Calendar, Outlook 365, OneDrive, X, LinkedIn and Facebook through each
  service's own sign-in page.
- AI: this advisor; it uses the user's monthly AI credits.
- Help: the Help page and Knowledge Base, and the contact page. Support tickets are not switched on. There is no live chat,
  no phone support and no promised reply time.

Rules:
- If asked about a feature that is not in this list, say it is not available in B2BNEST today. Do not guess.
- Never claim certifications or compliance (GDPR, SOC 2, ISO, HIPAA, PCI) or uptime. For legal or regulatory questions,
  give general information and suggest a qualified adviser.
- For plans and prices, point to the Pricing page; do not quote prices.
```

## 2. `supabase/functions/ai-business-assistant/index.ts` (no caller in the app; deployed, public: verify_jwt = false)

- Calls the product "BusinessForms Pro" (lines 231, 261, 282, 382, 420, 456, 492, 522, 582, 612).
- Navigation to routes that do not exist: `/documents` "1000+ templates", `/finance`, **`/trading` "Real-time market data,
  technical analysis, portfolio management, crypto tracking"** (lines 52-54).
- Trading/crypto content: lines 77-81, 108 ("crypto payment processing"), 248-253, 388, 599-604, 627.
- Plans that contradict the Pricing page (lines 90-102): free / pro / enterprise with "Up to 10 documents per month",
  "priority support", "SLA guarantees"; no Starter, no prices, no user limits.
- Integrations that do not exist: QuickBooks, Xero, FreshBooks (105), Slack/Microsoft 365 (107), Google Analytics (109).

**Proposal:** nothing in the app calls it, so the owner deletes the deployed `ai-business-assistant` function in the
Supabase dashboard (and its folder in a later PR). If it must stay, replace its knowledge object with the same text as
section 1 and remove every trading, crypto and pricing block listed above.
