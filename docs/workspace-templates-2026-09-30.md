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
- Duplicate prevention (accurate scope): the dialog's in-flight lock + disabled button stop repeated clicks during ONE attempt in ONE dialog. They do NOT stop a second tab, a reopened dialog after success, or a network retry from creating a second copy.
- Creation is NOT transactional. If a step fails, cleanup is best-effort: rows created by that attempt are deleted and the deletes are verified (returned row ids). If any board remains or a delete errors, the dialog shows "Creation was incomplete" with the workspace id and leftover board ids (also logged to the browser console); leftovers stay visible under Workspaces / Projects & tasks for manual removal.
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

## Code-review fixes (01:18 UTC)
1. Task state is keyed to company + workspace + board; cleared on change; stale responses dropped; previous-board tasks never render.
2. Status updates are filtered by id + board + company and must return exactly one row; otherwise only that task rolls back, only in its original context, and only if no newer edit to it was made. Error toast explains.
3. Cleanup results checked (see above).
4. Duplicate-prevention scope documented (see above).
5. Table columns follow template order; unsupported columns shown as "(not supported)" headers/cells; boards without columns use Task/Status/Priority/Due date/Est. hours; empty template groups are kept ("No tasks in this group yet").
6. Retry button on workspace/board load errors.

## Proposed durable idempotency (NOT applied — needs approval + migration)
- Client generates an idempotency key per dialog session; store it in a new `template_applications(organization_id, idempotency_key UNIQUE, workspace_id, status, created_by)` table with GRANTs + org-member RLS.
- Move creation into a SECURITY INVOKER Postgres function `apply_workspace_template(org, key, payload)` that runs in one transaction (true rollback) and returns the existing workspace when the key was already used.

## Verification
Fresh run 2026-09-30 01:23 UTC:
- Production build: OK (vite build). Typecheck: clean.
- Regression tests (vitest, mocked Supabase client): 21/21 pass across 5 files — incl. WorkspaceView (delayed board response, delayed previous-company response, column order + unsupported + empty group, boards Retry, concurrent status edits incl. zero-row update, failed update after board switch), apply service (company stamping, verified cleanup, incomplete creation on partial delete and on delete error), board helpers.
- Tenant/security suite (disposable local PostgreSQL 17.9, fresh run): 642 PASS / 0 FAIL / 54 INFO, exit 0.

Limitations: tests use a mocked client, not the live database. Signed-in creation and cross-company checks in the real app could not run here (external Supabase, no session) — owner signed-in review needed before publishing. Durable idempotency and transactional creation not implemented.
