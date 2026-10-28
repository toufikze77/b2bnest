# Phase 15: Workflow Studio basics (prepared)

Nothing in this PR has been applied, deployed, scheduled, switched on or sent, not even a test email. Production (`gvftvswyrevummbvyhxa`) was only **read**, on 28 Oct 2026.

This phase adds **no** new triggers, scheduled jobs or step types. Only the verified "Send an email" step runs. X, LinkedIn and WhatsApp stay `verified: false` in `src/lib/workflowSteps.ts`, so they are shown disabled and never run.

## What the screen showed before (checked on main)

The live screen is `src/pages/WorkflowStudio.tsx` at `/workflow-studio`.

**Before:**
- **No run history.** Nothing in `src/` read `workflow_run_logs`.
- **Email steps were never logged.** The screen calls `workflow-send-email` directly; only `workflow-execute` (WhatsApp) wrote log rows.
- **No templates on the screen.**
  - `src/data/workflowTemplates.ts` (45 named templates, including "Blank Workflow", in 8 categories, none with steps) is not imported anywhere.
  - `src/components/ai/WorkflowBuilder.tsx` (the old "AI Workflow Builder", 363 lines) isn't imported anywhere either. It is dead code; I've left it as it is.
- **"Run now"** showed a browser `confirm()` saying "This really sends N message(s)/post(s)", then sent the subject and message exactly as typed. There were no placeholders.
- **No step cap on the screen.** Only `workflow-execute` had `MAX_STEPS = 10`. The brief's "max 10 steps" is true on the server only.

**After:**
- **Run history panel** per saved workflow: the latest 20 runs.
  - Each run shows when it ran and "Run by you".
  - Each step shows one of: **Sent** / **Failed** (with the server's reason) / **Delivery status unknown** / **Skipped (step not available)**.
  - It has empty, loading and error (with Retry) states.
- **"Start from a template"**: 6 working templates, each previewed before use. The other 38 named templates are listed as "Coming soon", with no button.
- **Placeholders** such as `{{name}}` in the subject and message.
- **"Run now" opens a dialog** with:
  - "Run with these details": only the fields for placeholders actually used;
  - "Email preview": exactly what will be sent;
  - "This will send N email(s) to R recipient(s)", and a **Send** button. Nothing is sent before that click.
- **At most 10 steps** on the screen too, matching the server.

Screenshots (mocked data, labelled in the image) are in `docs/phase15/screenshots/`, at 1440 and 390 px:
- `history-empty-*`, `history-runs-*`
- `template-picker-*`, `template-preview-*`
- `run-details-empty-*`, `run-details-filled-*`
- `email-preview-confirm-*`

## RLS and logging findings

**Read-only on production, 28 Oct 2026:**
- `workflow_run_logs` has 0 rows. RLS is on.
- Policies:
  - "Users view own run logs" (SELECT, `user_id = auth.uid()`)
  - "Users insert own run logs" (INSERT, `user_id = auth.uid()`)
- Status check: `ok` / `error` only.
- `ai_workflows` (6 rows) is own-only for every action.

| # | Finding | Fix |
| --- | --- | --- |
| 1 | **Reading is right.** A user reads only their own rows, never anyone else's. Workflows aren't shared within a company, so "who ran it" is always the user. | Unchanged |
| 2 | **History could be forged.** Any signed-in user could insert their own rows with `status = 'ok'`, so a browser could write a fake "sent" row. | `proposal.sql`: only the server (service role) writes ok / error / unknown. A browser may insert only `status = 'skipped'` with `provider = 'none'`, for itself. |
| 3 | **Too many grants.** `anon` and `authenticated` hold DELETE, UPDATE, TRUNCATE, TRIGGER and REFERENCES. RLS blocks UPDATE and DELETE (no policy), but **TRUNCATE isn't covered by RLS**. PostgREST doesn't expose TRUNCATE, so I don't know of an API path to it. | `proposal.sql` revokes everything, then grants `authenticated` SELECT and INSERT only. `anon` gets nothing. |
| 4 | **Statuses and grouping were missing.** No "unknown" or "skipped" status, and no way to group a run's steps. | `proposal.sql` adds `run_id`, `step_index` (0–9), the statuses `unknown` and `skipped`, a size limit on the summaries, and an index for the history query. |
| 5 | **`workflow-execute` logged too much.** It stored `String(e)` on network errors, which can contain the Twilio API URL with the Account SID. It also stored Twilio's free-text `message`, which can repeat the recipient's phone number. And it wrote logs through the user's session. | Fixed in code (not deployed). Logs now hold the error code, HTTP status and Twilio code only, and are written with the service role. The caller still sees Twilio's reply (it's their own account). |
| 6 | **No email history at all.** `workflow-send-email` wrote no history. | It now writes one row per email step, with the service role. Each row holds counts (recipients, subject and message lengths, number of placeholders) and the server's own reason, with any address-like text redacted. **No addresses, subject or message text** are stored (tested). |

Anything else stays out of the history too:
- The panel shows step labels, statuses, the recipient **count** and the server's reason.
- It never shows addresses or message text.
- No secrets or tokens are logged (tested for both functions).

## Templates (Part B)

All six are one "Send an email" step started by "Run now". "To" starts as the signed-in user's **own** address so the first run goes to them, and the screen says to change it.

The copy is British English, with no urgency wording, statistics or guarantees (tested, and scanned by the claims guard both as files and filled in).

| Template | Replaces named template | Subject | Placeholders |
| --- | --- | --- | --- |
| Overdue invoice reminder | `finance-overdue` | Invoice {{invoice_number}} is overdue | name, invoice_number, amount, due_date, company |
| New lead welcome | `sales-lead` | Thanks for getting in touch, {{name}} | name, company |
| Quote follow-up | `sales-quote` | Following up on quote {{quote_number}} | name, quote_number, amount, company |
| Appointment reminder | `sales-meeting` | Reminder: your appointment on {{date}} | name, company, date, time |
| Thank-you after a job | `customer-feedback` | Thank you from {{company}} | name, company |
| Trial-ending note to a customer | `customer-renewal` | Your trial with {{company}} ends on {{date}} | name, company, date |

The full messages are in `src/lib/workflowEmailTemplates.ts`.

Every preloaded template passes `validateStep` (`src/lib/workflowEmailTemplates.test.ts`). The other 38 named templates need an automatic start or a step that isn't available, so they're shown as "Coming soon" and can't be used or run.

## Placeholder rules (Part C)

There is one pure function, `supabase/functions/_shared/placeholders.ts` (`renderTemplate`). The screen's preview **and** `workflow-send-email` both use it.

- **Allowed names only:** `{{name}}`, `{{company}}`, `{{amount}}`, `{{due_date}}`, `{{invoice_number}}`, `{{quote_number}}`, `{{date}}`, `{{time}}`.
  - Spaces inside the braces are fine.
  - Anything else (`{{Name}}`, `{{first_name}}`) is an error that lists the allowed names.
- **Every placeholder used needs a value.** A missing value is an error, so the literal `{{name}}` is never sent. Fields appear only for the placeholders used.
- **Simple, single-pass replacement.** Nothing is evaluated, and inserted values are never scanned again.
- **Rules for values:**
  - no `{{` or `}}`;
  - no line breaks or control characters (no header injection through the subject);
  - a length limit for each one (20–100 characters).
- **Rules for the text you write:**
  - any other `{{` or `}}` in the subject or message is an error;
  - the subject must be one line.
- **Length limits once the details are filled in:** subject at most 200 characters, message at most 10,000.
- **Plain text.** Emails are plain text, as before. The function HTML-escapes values only in the existing `html: true` mode, which Workflow Studio doesn't use. On screen, React shows everything as text.
- **What is sent equals the preview.** The client sends both the filled-in subject and message (what the user previewed) and the original text with the details. The server fills them in again and refuses (409) if the result differs. Without details, any `{{...}}` is refused (400). So an old or tampered client can't get a literal placeholder sent.

**Behaviour change for existing workflows:** a saved email whose subject or message contains `{{` or `}}` that isn't one of the placeholders above is now refused with a clear error instead of being sent as typed. Existing subjects over 200 characters or messages over 10,000 characters are also refused now. They used to be cut to 500 and 100,000.

## Guardrails (Part D)

- **The confirm counts unique recipients** across the email steps: "This will send N email(s) to R recipient(s)". It also says when a step will be skipped.
- **Server-side limit.**
  - `workflow-send-email` had **no** limit. It now has the same per-instance, in-memory limiter as `workflow-execute`: 30 per user per minute. That is best effort, not strict across instances.
  - Both functions answer 429 with a readable message: "You've sent a lot of emails in the last minute. Nothing was sent. Wait a minute, then try again."
  - The screen shows that message, never the code.
  - The rate-limit refusal itself isn't written to Run history, so a flood of refused calls writes nothing to the database.
- **No run quotas per plan in this phase.** To add them later we would need:
  - a durable per-user (or per-company) count of email steps sent per day or month. `workflow_run_logs` with `status = 'ok'` could be the source once the logs can't be forged (this phase);
  - the plan for that person (from `my_access_state()` / `subscribers.plan_key`);
  - the owner's quota for each plan in the plan catalogue;
  - a decision on whether "unknown" sends count;
  - a server-side check before sending, using one database counter, since the in-memory limiter isn't shared between instances.

## Files

- **`fixture-live.sql`:** the table exactly as live, for the test only.
- **`proposal.sql`:** one transaction.
  - It refuses to run if the table is missing, or if it was already applied.
  - It has explicit REVOKE and GRANT statements, and RLS stays on.
  - It creates no functions, so there is no `search_path` to set.
- **`rollback.sql`:** puts the live table back exactly as it was (columns, status check, policies and the live grants, broad as they were).
  - It first **deletes** `unknown` and `skipped` rows, because the old status check can't hold them.
  - `ok` and `error` rows are kept.
- **`test.sql`, `run-test.sh`:** a throwaway Postgres 16. Run `PG_RUN_USER=postgres bash docs/phase15/run-test.sh` from the repo root.

## Deploy order (not done)

1. **Apply `proposal.sql`.**
2. **Redeploy `workflow-execute` straight after**, then `workflow-send-email`.
   - Dashboard deploy: `node scripts/flatten-function.mjs <name>`.
   - `workflow-send-email` produces 6 files: `handler.ts`, `index.ts`, `probe.ts`, `request.ts`, `shared_placeholders.ts`, `smtp.ts`.
   - `workflow-execute` produces 2 files: `handler.ts`, `index.ts`.
   - `verify_jwt` stays as it is today.
3. **Publish the frontend.**

**What breaks if the order is wrong.** None of these cases sends the wrong email.

| Wrong order | Effect |
| --- | --- |
| SQL applied, `workflow-execute` not yet redeployed | Its log inserts go through the user's session and are refused by the new policy, so WhatsApp "Send test" rows are lost. The message itself still sends, and its result isn't affected. |
| Functions before SQL | `workflow-send-email` history inserts fail (missing `run_id` / `step_index` columns, no `unknown` status). They are best effort and logged; sending is unaffected; Run history stays empty. |
| Frontend before functions | The new screen sends the filled-in subject and message plus the details. The old function ignores the extras and sends the filled-in text, which is the correct email. There are no history rows and no friendly rate-limit message yet. |
| Frontend before SQL | The panel reads with `select('*')`, so it works and shows nothing new. Skipped-step inserts fail quietly (old status check). |
| Old frontend with new functions | An old screen sends the text as typed. Anything with `{{...}}` is now refused with a clear error instead of being sent literally (intended). |

**Not redeployed:**
- `onboarding-email-sender`, `support-email-sender` and `send-document-email` also bundle `workflow-send-email/handler.ts`.
- The request logic moved into `request.ts`, so `handler.ts` only lost code those senders never used. Their layout test and behaviour are unchanged.
- They **don't need** redeploying; if they are redeployed, nothing changes.

## Not changed (and why)

- Stripe, HMRC, sign-in, the paywall / trial / suspension rules and seat limits: out of scope.
- Which steps are shown as working: X, LinkedIn and WhatsApp stay `verified: false`.
- No triggers, schedules or step types; the brief rules them out.
- `WorkflowBuilder.tsx` and `workflowTemplates.ts` were kept as they are. The new templates reference the old ids, and removing the dead builder is a separate clean-up.
- No run quotas per plan (see above).

## Tests run

| Check | Result |
| --- | --- |
| `docs/phase12/test.sql` | 79/81 before and after (the two known failures since 12c) |
| `docs/phase12b/test.sql` | 51/51 |
| `docs/phase12c/test.sql` | 49/49 |
| `docs/phase13/test.sql` | 60/60, re-apply ✓, guard ✓ |
| `docs/phase15/test.sql` | **27/27**, re-apply after rollback ✓, second apply refused ✓ |

The Deno and vitest numbers are in the PR description.

## Not verified

- Anything on production beyond the read-only counts and catalogue reads above. Nothing was applied or deployed.
- Real SMTP delivery and inbox placement. All email tests use fakes, and no email was sent.
- Real Twilio calls.
- The new service-role inserts and selects against the real database. They were type-checked against stubs only, because the registries are blocked here.
- How the deployed functions behave across several instances: the rate limit is per instance.
