# UI Wave 3 — Work and Customers (preview only)

## Starting point
- UI Wave 2 is published from saved version a2d3623 (www.b2bnest.online), with the owner's signed-in checks all passed. It is recorded as the baseline in the Wave 3 report.
- The following owner-verified fixes are kept exactly as they work now: saving projects and tasks, deadline saving and links, views surviving a refresh, and no flash on refresh.
- Wave 3 stays unpublished until the owner reviews it. No database changes: anything that would need one goes into a written proposal.

## Delivery in four phases
Each phase ends with a build, a code check, tests and screenshots, and a short progress note. Phases 1 and 2 matter most. Phases 3 and 4 follow in the same way.

### Phase 1 — Projects & tasks
- One view switcher (List, Board, Calendar, Timeline) linked to the page address. Goals, Archive, Work requests and the other tabs stay reachable from a "More" menu, so no features are removed.
- Keep the selected project, refresh, direct links, and Back/Forward exactly as they work now.
- One filter bar across all views: search, status, priority, assignee, and a date range. Filters are stored in the page address so they survive a refresh.
- Edit project and Edit task buttons stay as they are and follow the current permissions.
- One shared task panel for viewing and editing, opened from List rows and Board cards. It shows "Saving…", then a success or failure message, and only confirms a save once the updated task comes back.
- Break the ~3,900-line Projects & tasks screen into smaller display pieces: the view switcher, filter bar, list, board, timeline and task panel. The saving and loading logic moves unchanged.

### Phase 2 — Workspace boards and Calendar
- Workspace boards get the same look, filter bar and shared task panel as Projects & tasks.
- These stay exactly as they are: template groups, column order, the "(not supported)" labels, the loading and error states, duplicate protection, and the partial-cleanup safeguards.
- Calendar gets a clearer month and week view, previous/next/today navigation, and colours by status or priority. On narrow screens (under 768px) it shows an agenda list instead.
- Clicking an item in the calendar opens its existing details or edit form. Dates are handled as calendar days, so there's no time-zone shift.

### Phase 3 — CRM
- New shared building blocks: a data table, a filter bar and status badges. The table supports search, sorting, pagination (25 per page) and a row actions menu.
- Contacts open in a side panel for viewing and editing. Deals use the same table.
- Keep today's scope: contacts and deals belong to the signed-in user. They are labelled "Your contacts", never as the company's, and the report states that this limit stays until the database supports company ownership.

### Phase 4 — Shared polish and validation
- Use the existing colour scheme, page layout, page headers and loading/empty/error/permission/no-results messages everywhere.
- Visible keyboard focus outlines and readable text sizes.
- Checks at 390, 768, 1024, 1280 and 1440px widths.

## Validation
- Build and code check.
- Tests that render the actual components: the filter bar, the view switcher linked to the page address, the shared task panel's save states (success, refused, error), the calendar agenda list and its date handling, and the data table's sorting and pagination.
- A fresh full company-separation and security suite, with the actual counts reported.
- Browser checks using a pretend sign-in and sample data (clearly labelled as such): navigation, edit and save, refresh, company switching, keyboard use, and phone layouts. Before/after screenshots saved to Files.
- Signed-in checks on real data remain for the owner.

## Technical details
- New files under src/components/work/: ViewSwitcher, WorkFilterBar, TaskListView, TaskBoardView, TaskTimelineView, TaskDetailsPanel (a side panel), and useWorkFilters (reads and writes the page address through pmView.ts).
- New files under src/components/data/: DataTable, FilterBar, StatusBadge. CalendarAgenda goes in project-management/.
- ProjectManagement.tsx keeps its data loading, company scoping (the `.or` filter with its columns selected), saveTaskEdit, the rules that record finish times, and the ?create/?edit shortcuts.
- WorkspaceView keeps its keyed state, discards out-of-date responses, and keeps its row-count checks and optimistic rollback.
- CRM queries are unchanged: they stay filtered by user_id and follow the database's existing access rules.
- Deliverables: docs/ui-wave3-work-customers-report-2026-09-30.md, a roadmap entry, a list of changed files, and screenshots in /mnt/documents/ui-wave3/.
