# Workspace templates — findings and preview implementation (2026-09-30)

## How it worked before
- Templates live in src/data/workspaceTemplates.ts (50 templates). Each has 1+ boards; each board has columns, statuses, views, groups and tasks.
- Applying (services/workspaceTemplateApply.ts) created one `projects` row per board and `todos` per task, stamped with the top-bar company.
- Groups were flattened into `todos.labels`; columns/statuses/views were stored in `projects.custom_fields` but never read.
- Multi-board templates had no link between their boards and always opened the first board in the ordinary project screen.
- No distinction between project and workspace templates; no rollback on partial failure.

## Now (preview only)
- Project template = 1 board (opens Projects & tasks as before). Workspace template = 2+ boards. Labelled on cards and in the dialog.
- Boards of a workspace share `custom_fields.workspace = {id, name, board_index, board_count}`; group order saved in `custom_fields.board_groups`.
- New pages: /workspaces (list for the selected company) and /workspaces/:id (boards on the left, selected board main area, Table / Board / Calendar views, status editing, drag between status columns). Deep links: ?board=<id>&view=table|board|calendar.
- After creation, workspace templates open /workspaces/:id directly.
- Repeated clicks blocked (in-flight lock + disabled button). If any step fails, rows created by that attempt are removed.
- Loading, error (with retry), empty and "not in this company" states.
- Existing projects/tasks untouched; each board also opens in Projects & tasks.

## Tenant boundary
- Creation still calls assertActiveOrganization with the top-bar company; nothing creates or switches companies.
- Every workspace read and status update is filtered by the selected organization_id on top of existing RLS. A workspace from another company shows "not found in this company".
- No RLS, permission or schema change.

## Supported vs not supported
- Groups: supported (from labels + saved group order).
- Statuses: the five template statuses map 1:1 onto task statuses and show with the template's labels. Custom status sets of other sizes would fall back to default labels.
- Views: Table, Kanban/Board, Calendar supported. Timeline and Dashboard are shown struck through, labelled "not yet supported".
- Columns: Task, Status, Priority, Due date, Estimated hours, Group supported. Other columns (e.g. Owner, Deal value, Stage-specific fields) are saved and listed as "not yet supported" on the board.

## Schema changes needed for full support (NOT applied — needs owner approval)
1. `workspaces` table (id, organization_id, name, template_slug, created_by) with GRANTs + org-member RLS, and `projects.workspace_id` FK — replaces the JSON grouping.
2. `board_groups` table (project_id, name, position, colour) so groups can be renamed/reordered.
3. `board_columns` + `todo_field_values` for custom typed columns (person, number, money, dropdown).
4. Per-board custom status sets.
5. Backfill: existing custom_fields.workspace ids map into the new table.

## Verification
- Typecheck clean. Signed-in creation and cross-company checks could not run in this sandbox (external Supabase, no session) — owner review needed.
