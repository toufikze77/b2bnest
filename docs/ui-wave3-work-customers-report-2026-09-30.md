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

## Not verified / pending owner
- A signed-in check on real data: filters, List/Board editing and saving, the calendar agenda on a phone, the CRM table and panel, and company switching. No signed-in session is available in the sandbox (external Supabase).
- Company switching was not browser-tested with two companies in this wave. Scoping code is unchanged from Wave 2.
- Not done: the Timeline view was not restyled; the Board kanban internals were not split out of ProjectManagement.tsx (still about 3,800 lines); the calendar has no week view.
