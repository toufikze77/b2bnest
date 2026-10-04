# UI Wave 3 — Work and Customers (preview, unpublished)

## Baseline
UI Wave 2 was published from commit a2d3623fd13a572eef3c6e3acd7f774ae3dc5187 (www.b2bnest.online) after the owner confirmed all four signed-in checks passed. These owner-verified fixes are preserved unchanged: project and task saves, deadline saving and links, view persistence and the refresh-flash fix.

## What changed
**Projects & tasks**
- One view switcher (List, Board, Calendar, Timeline). Summary, Goals, Work requests, All work, Archived and Teams are under "More", so nothing was removed. The URL is still the source of truth (pmView.ts), and no-op clicks add no history entries.
- One URL-backed filter bar: search, status, priority, assignee, and due from/to (`q, status, priority, assignee, from, to`). The filters apply to List, Board, Calendar and All work, and they survive refresh and Back/Forward. Edits replace the history entry, so typing doesn't flood the history.
- The List view is now a table with status and priority badges, due dates (with the year shown when outside the current year) and overdue marking. On phones it becomes a stacked list. The title, the Edit button and the ⋯ menu all open the one shared task editor, which is also used from Board cards.
- The previous duplicate view buttons and tab strip are gone. The data loading, company scoping, saveTaskEdit, completion timestamps and the ?create/?edit shortcuts are untouched.
- New presentation components: src/components/work/{ViewSwitcher, WorkFilterBar, TaskListView}.tsx and src/lib/workFilters.ts.

**Workspace boards**
- They now use the shared FilterBar (search and priority) and StatusBadge, with formatted dates and a no-results state.
- Template groups, column order, "Not supported" labels, supported views, loading/error/Retry, keyed state, row-count checks and rollback are unchanged. Duplicate protection and partial-cleanup code were not touched.

**Calendar**
- Tasks follow the shared filters; the calendar's own duplicate filter controls were removed. Items are keyboard-focusable buttons, and the month buttons are labelled.
- Below 768px an agenda list (CalendarAgenda) replaces the month grid.
- Due dates are now placed from the date-only value (`yyyy-MM-dd`), with no UTC conversion. Events with an invalid date no longer crash the view; this was found in browser testing.

**CRM**
- New shared components: src/components/data/{DataTable, FilterBar, StatusBadge}.tsx. DataTable provides sortable headers (aria-sort), 25 rows per page, a row-actions slot and a stacked layout on phones.
- Contacts use DataTable, and a side panel (Sheet) shows contact details with an Edit button. Deals have a Table view with search and a stage filter; the drag-to-reorder pipeline is kept as "Reorder pipeline".
- Scope is labelled honestly: "Your contacts/deals — records you created". The queries are unchanged (user_id plus RLS). Contacts are not presented as company-scoped; that needs the proposed organization_id schema work.

## Changed files
src/lib/workFilters.ts (new) · src/components/work/{ViewSwitcher,WorkFilterBar,TaskListView,wave3.test}.tsx (new) · src/components/data/{DataTable,FilterBar,StatusBadge}.tsx (new) · src/components/project-management/CalendarAgenda.tsx (new) · src/components/ProjectManagement.tsx · src/components/project-management/ProjectCalendarView.tsx · src/pages/workspaces/WorkspaceView.tsx · src/components/crm/ContactsView.tsx · src/components/crm/DealsView.tsx

No database, RLS, billing, HMRC, auth or pricing change. No migration.

## Validation (actual results)
- Typecheck: clean. Preview build: OK.
- App tests: 81/81 pass, 13 of them new. The new tests render the actual components: the URL filter round-trip, WorkFilterBar writing to the URL while keeping view/project, ViewSwitcher current state and no-op clicks, TaskListView editor entry and no-results, DataTable pagination and sorting, CalendarAgenda date-only grouping, and StatusBadge.
- Fresh full tenant/security suite (disposable PostgreSQL): 662 PASS / 0 FAIL / 54 INFO. It ran before the final calendar and phone-layout edits, which are presentation-only.
- Mocked browser checks (fake session and synthetic "(sample)" data, Supabase requests intercepted; not live data):
  - Search written to the URL, still applied after refresh.
  - Board → Timeline, then Back twice, returned the correct views.
  - The Edit button (Enter key) opened one dialog; Escape closed it and returned focus to the Edit button.
  - A task title edit sent one PATCH with the company filter and kept due_date as 2026-10-01; the "Task updated" toast appeared.
  - The contact side panel opened and Escape closed it; sorting contacts by value descending worked.
  - The agenda showed at 390px.
  - No horizontal overflow and no page errors at 390/768/1024/1280/1440 on List, Board, Calendar and CRM.
- Screenshots: /mnt/documents/ui-wave3/ (after only; "before" is Wave 2 as published).

## Owner verification
- All outstanding signed-in checks are owner-confirmed PASS (2026-10-04): filters, List/Board editing and saving, the calendar agenda on a phone, the CRM table and panel, and company switching.
- Company-owned records remained isolated when switching companies. Personal CRM contacts and deals may remain visible across companies by design.
- Not done: the Timeline view was not restyled; the Board kanban internals were not split out of ProjectManagement.tsx (still about 3,800 lines); the calendar has no week view.

## Owner review follow-up (2026-09-30, late)

**Owner review: template behaviour FAILED.** Owner reported templates opening ordinary Projects & tasks and entries with no usable template behind them.

### Root cause
- Destination was decided only by board count (`boards.length > 1`). 45 of 50 built-in templates have one board, so they were always created as plain projects, including the CRM template type.
- 20 templates (types dashboard, workflow, automation, ai-workflow) advertise dashboards, automations or AI steps that are not built; creating them produced only a task list.

### Fix (preview only, no database change)
- `getTemplateKind`: explicit `kind` on the template wins → otherwise type `crm`/`multi-component` = workspace → board count only as fallback. A one-board workspace is supported (`kind: 'workspace'` can be set in the admin catalogue JSON; no schema change required).
- `getTemplateAvailability`: unpublished, empty, or unbuilt-type templates are marked "Not available yet" on the card and in the preview, the Use button is disabled, and the creation service refuses them (`TemplateUnavailableError`) before touching the company or the database. Unavailable items sort last.
- Create dialog states the board count and destination. On failure it stays open with the error; it never falls back to Projects & tasks.
- Empty category/sub-category shows "No templates in this category yet".
- Company validation, RLS, duplicate protection and incomplete-creation recovery unchanged.

### Security moved out of CRM
Audit of the old CRM Security tab: every value was fake or unenforced — role counts hardcoded (1/3/5/12), active sessions "24" and failed logins "3" hardcoded, "Security score" computed from the switches themselves, OAuth/2FA/SSO switches and session-timeout/threshold inputs only saved to `integration_settings` and were never enforced. "Manage user roles" edited platform-wide `user_roles` (super admins only by RLS).
- Settings → **Security**: real two-step status (`user_2fa_settings`), "Sign out other devices" (Supabase `signOut({scope:'others'})`), own last 20 audit entries.
- Settings → **Members & roles**: members of the selected company from `organization_members`; owners change any role, admins non-owner roles, nobody their own (same as RLS); success only when exactly one row updated.
- Settings → **Company security**: owner/admin only; role counts from real membership. Company audit log shown as **unavailable** — `audit_logs` has no company column. Proposed separately (not applied): add `organization_id` to `audit_logs` + RLS for company owners/admins; rollback = drop column/policy.
- Super Admin → Settings: read-only "Sign-in and authentication" card linking to Supabase providers. No global auth changes; platform roles stay under Admin → Users.
- CRM Security tab and `SecurityTab.tsx` removed; `/crm?tab=security` redirects to `/settings?tab=company-security`.

### Results
- Mocked app tests: 87/87 (6 new: kind resolution incl. one-board workspace, availability, disabled card button, project label, role-assignment rules). These use a stand-in database.
- Typecheck clean. Fresh tenant/security suite: 662 PASS / 0 FAIL / 54 INFO.
- Real signed-in checks: **owner-confirmed PASS 2026-10-04**: multi-board workspace and project-template destination and refresh, company A→B→A switching, unavailable-template refusal, and the new Settings tabs for member, admin and super admin.
