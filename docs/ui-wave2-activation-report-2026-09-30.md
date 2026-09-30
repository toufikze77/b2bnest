# UI Wave 2 — Activation (preview only, 2026-09-30)

Status: implemented in preview; NOT published. Awaiting owner signed-in review.

## What changed
- **One operational dashboard** (`/dashboard`): replaced the two stacked dashboards (operational overview + the old "Documents, billing and account" tabs: purchases, favourites, invoices, bills, account settings, admin). No records deleted. Account/billing stay in Settings (Account, Billing tabs); invoices in Invoices & quotes; admin at /admin. The old tab component (`src/components/UserDashboard.tsx`) is no longer shown but kept in the codebase.
- **Needs attention**: open tasks for the selected company, grouped Overdue / Due today / Upcoming (7 days). Each item links to the existing Projects & tasks list for its project (`/project-management?view=list&project=<id>`); there is no single-task deep link in the app yet.
- **Get started checklist** (company-specific where the data allows): first contact, first project or template workspace, first invoice. Completion comes from real counts; completed steps hidden; whole card hidden when all done; dismissible per user + company.
- **Shared states** (`src/components/ui/states.tsx`): LoadingRows, ErrorState (with Try again), PermissionDenied, NoResults; reuses EmptyState (one clear button).
- **Quick actions**: New task, New project, Use a template, Add contact, New invoice, and Plan the rota (owner/admin/manager only). Company name shown in the page eyebrow and description. On phones, Needs attention comes first, then quick actions, then the checklist.
- Removed unused `src/components/dashboard/OperationalOverview.tsx`.

## Honest limits (data model)
- **Contacts and invoices have no company column** in the database. They are counted for the signed-in user, not the company. Consequently overdue invoices are **not** shown in Needs attention (it would mix companies); the dashboard says so.
- **Invite a teammate**: there is no company-invitation flow in the app (only project-team invites). Per "only show actions the user can perform", this step is omitted. Logic is ready (`canInvite`, owners/admins only) once a flow exists.
- Checklist dismissal is stored in the browser (localStorage), so it does not follow the user to another device.

## Proposed (not applied — needs separate review)
- Add `organization_id` to `crm_contacts` and `invoices` (+ backfill rules, RLS) to make contacts/invoices company-scoped and enable overdue invoices in Needs attention.
- Company invitation flow using the existing `organization_invitations` table.
- `user_activation_state(user_id, organization_id, dismissed_at)` table for cross-device dismissal.

## Tenant boundary
Tasks, projects and member counts filtered by `organization_id` of the top-bar company on top of RLS. Responses for a previous company are discarded (request sequence + key check) so its data never renders after a switch. No company is created or switched. No DB, RLS, Stripe, HMRC, auth or pricing change. Crypto content not reintroduced. Workspace templates untouched.

## Verification (fresh, 2026-09-30 ~01:55 UTC)
- Typecheck: clean. Build: see build log (OK).
- New tests: 16/16 — `src/lib/dashboardData.test.ts` (7: task grouping, links, checklist from real counts, failed count = unknown, invite hidden / role-gated, rota role) and `src/pages/Dashboard.test.tsx` (9: company scoping, error vs empty with Retry, empty state action, checklist completion + dismissal, failed count reported, all-done hides checklist, rota role visibility, delayed previous-company response never shown, no company selected). Whole run: 47/47 (mocked Supabase client).
- Full tenant/security suite (disposable PostgreSQL 17.9, fresh): **662 PASS / 0 FAIL / 54 INFO**, exit 0.
- Visual: 390/768/1024/1280/1440 px, no horizontal overflow. Populated with **synthetic sample data** (network responses mocked in the browser; not real customer data, not a real sign-in). "Before" screenshots were not captured this turn.
- Keyboard/a11y: skip link first in tab order; every link/button in the main area has an accessible name (0 unnamed); dismiss button labelled; sections labelled by headings; loading has role=status, errors role=alert.
- Not verified: real signed-in data in the live database — owner review required.

## Review fixes (2026-09-30 ~02:05 UTC, preview only)
1. **Personal vs company progress.** The checklist is now split into "For <company>" (project/template workspace — measured by `organization_id`) and "For your account" with the note "Counts your own records, not just <company>'s." (first contact, first invoice — measured by `user_id`, because `crm_contacts` and `invoices` have no company column). Each step carries `scope: 'company' | 'personal'`. No database change.
2. **No silent 100-task limit.** Needs attention now runs three independent queries (overdue `< today`, due today `= today`, upcoming `> today and <= today+7`; `due_date` is a DATE column), each org-scoped, limited to 5 rows and requesting an exact count. The badge shows the true total; when more exist the group says "Showing 5 of N. See all in Projects & tasks". If a count is unavailable it says "Showing N." without claiming a total. A large overdue backlog can no longer hide today's or upcoming tasks.
3. **Quick-action labels.** The app has no deep link that opens the contact-creation or invoice-creation form, so the actions are now labelled "Open CRM" and "Open invoices" (checklist buttons likewise: "Open CRM", "Open invoices").
4. **Customer-facing wording.** Removed the dashboard sentence about invoices not being linked to a company. The technical limitation (no `organization_id` on `invoices`/`crm_contacts`, so overdue invoices are not in Needs attention) remains documented above.

### Results (fresh)
- App tests: 49/49 (8 files, mocked Supabase client). New: 150 overdue + 2 due today + 3 upcoming → all today/upcoming tasks shown, badge "150", "Showing 5 of 150", exactly three org-scoped task queries; quick-action labels/destinations; checklist split labels.
- Typecheck clean; `vite build` OK.
- Full tenant/security suite (disposable PostgreSQL 17.9): 662 PASS / 0 FAIL / 54 INFO, exit 0.
- Not verified signed in on real data — owner review still required. Still preview only.

## Revision — operational dashboard (2026-09-30, preview only)

- Layout: full-width frame (max 1760px); header with company, date and one primary action (New task); summary row (active projects, open tasks, overdue tasks, completed this week — all selected-company queries, "—/Unavailable" on failure, never 0); main column Needs attention + Active projects (name, status, done/total progress bar, next open due date, link); side column Workspaces (from `custom_fields.workspace`, links to /workspaces/:id), Project deadlines, Recently updated tasks, compact Quick actions, a separate "Your records" block (CRM/invoices are per-user), and the Get started checklist.
- Removed duplicate CTAs (New task only in the header; empty state keeps a contextual Create task).
- No revenue/invoice metrics (no company attribution yet). "Completed this week" relies on `todos.completed_at`; tasks closed without that timestamp are not counted.
- Sidebar: collapsible groups (remembered per browser; the group with the current page cannot collapse), stronger active state, `aria-current`. All links/URLs unchanged.
- Tests: 56/56 app tests (new: summary metrics + progress + workspace links + org scoping; failed metric shows Unavailable; summarizeProjects/weekStart/deadlines). Typecheck clean. No database changes.
- Screenshots (synthetic data, every name marked "(sample)", served by intercepted network responses — not a real account): 1815×1321, 1440, 390. No horizontal overflow at any width.
- Not checked: signed-in with real data.

## Final pre-publish revision (2026-09-30, 13:30 London)

1. **Overdue "5 Oct / 18 Oct" under 30 Sept** — investigated on the live database (read-only): 35 dated tasks have a 2025 due date (19 still open); 203 are in 2026. The October dates were 5/18 Oct **2025**, correctly classified as overdue; the display hid the year. Dates outside the current year now show the year ("5 Oct 2025"). Tests: past-year (2025) overdue, future-year (2027) not upcoming, year shown/hidden.
2. **"Completed this week"** — the query used `todos.completed_at` (never `updated_at`), but all 16 closed dated tasks have `completed_at` NULL: the main status-change paths (Projects & tasks, workspace boards) never recorded it. The metric is **removed** and replaced by "Due in next 7 days" (exact upcoming count). Both status paths now write `completed_at` on close and clear it on reopen (`completionPatch`, tested), so completion history starts accruing; the metric can return once enough history exists. No database change.
3. **Readability at 100% zoom** — task titles/body 14px; secondary labels raised from 12px to 13px; due-date column widened for years.
4. **Project deadlines empty state** — owners/admins/managers get a "Set deadlines" button to Projects & tasks; other members see "Ask a company admin to add one."
5. **Checks (actual)** — app tests 57/57 (mocked client); fresh tenant/security suite **662 PASS / 0 FAIL / 54 INFO** on a disposable PostgreSQL copy.

**Pending:** signed-in owner review on real data. Unpublished.

## Revision — refresh flash fix and final preview verification (2026-09-30)

**Cause of the flash.** The selected view was already read from the URL on the first render, but the screen rendered immediately with built-in placeholder projects/tasks ("Website Redesign", "Mobile App Development") and before the company's data had loaded, so a refresh briefly showed content that was not the chosen view's real data.

**Fix (src/components/ProjectManagement.tsx).** Placeholder data removed (initial projects/tasks are empty). A neutral skeleton (`data-testid="pm-loading"`, `aria-busy`) is shown until the user, access check and the *selected company's* projects and tasks have resolved (readiness keyed to the company id). Responses from a previously selected company are discarded. View/tab/project remain derived directly from the URL (no effect-based correction). Archive/trash lists load after the main screen appears. Unchanged: one history entry per view click, Back/Forward, invalid-URL normalization, `?create=`/`?edit=` consumed once, sidebar highlighting.

### Automated tests
- App tests: 68/68 pass (mocked Supabase client). Typecheck clean; build OK.
- Fresh full tenant/security suite on disposable PostgreSQL: **662 PASS / 0 FAIL / 54 INFO**.

### Mocked browser checks (full Projects & tasks screen; mocked session and sample data, not the live database)
- Refresh with 2 s delayed data for List, Goals, Calendar, Timeline and an invalid view: every animation frame recorded; sequence was blank → skeleton → chosen view. No frame showed a different tab or placeholder data. Invalid view normalized to `view=kanban`.
- Create task / Create project / Create event: each form opened once; only `create` was removed from the URL (project and view kept; event switches to Calendar); refresh did not reopen. Deadline edit shortcut (`edit=`) opened once and did not reopen after refresh.
- Wrong-company edit link: no form opened; "Project not found" shown.
- Three view clicks added exactly three history entries; Back and Forward restored the right views.
- Dashboard deadline flow (keyboard Enter → edit → pick 20th → save → refresh): saved `2026-09-20` and showed "20 Sept" with a working project link in both Europe/London and America/New_York (UTC−4). Saves went to a stand-in, not the live database.

### Owner-confirmed signed-in checks
- View persistence after refresh works (owner). The refresh flash was reported by the owner; fixed and verified in mocked browser checks only — **not yet owner-confirmed**.

### Remaining checks (owner, signed in, real database)
- Refresh List/Goals/Calendar/Timeline and confirm no flash.
- Save a project deadline from Dashboard, refresh, and confirm the exact date.

Release remains unpublished.

### Create task "two dialogs" investigation (2026-09-30)
- Cause: ProjectManagement rendered `CreateTodoDialog` twice from the same `showCreateTask` flag (and the edit dialog twice from `showEditTask`), so opening Create task mounted two stacked modal dialogs and two overlays. The form also had a second, custom close (X) button next to the built-in one.
- Fix: duplicate create/edit mounts removed (one of each remains); custom X removed; the dialog now returns focus to the element that opened it (it is opened from state, not a trigger).
- Mocked browser check (sample data): one dialog and one overlay when open; 25 Tab presses never left the form; one Close button; Escape closed it with no leftover dialog, overlay or pointer lock; focus returned to "New Task"; `?create=task` opens exactly one dialog. App tests 68/68; typecheck clean.
