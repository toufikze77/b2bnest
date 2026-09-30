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
