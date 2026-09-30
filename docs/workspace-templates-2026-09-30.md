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

## Durable duplicate protection (owner-approved 2026-09-30, frontend in preview only)

### Which database was changed
- The migration ran on the one connected Supabase project, `gvftvswyrevummbvyhxa`. The preview **and** the published site (b2bnest.online) both use it, so **the production database was changed** even though the frontend was not published.
- What changed: one new, empty table (`template_applications`) with its grants, RLS policies and an updated_at trigger. No existing table, row, policy, function, billing or HMRC object was changed. The published frontend does not use the table, so live behaviour is unchanged until the frontend is published.
- Migration file: `supabase/migrations/20260930013054_403c6633-cfd2-4e79-a4e5-1f85ae854a26.sql`.

### New database objects
- Table `public.template_applications`: id, organization_id (FK organizations, ON DELETE CASCADE), idempotency_key, template_slug, workspace_id, primary_project_id, kind, status (`pending` | `done` | `incomplete`), created_by (default auth.uid()), created_at, updated_at.
- Constraint `UNIQUE (organization_id, idempotency_key)` — the duplicate-detection key.
- Trigger `template_applications_updated_at` (existing `handle_updated_at()`).
- No new functions, so no new SECURITY DEFINER surface.

### Grants and RLS
- Grants: `authenticated` SELECT/INSERT/UPDATE/DELETE; `service_role` ALL; **no `anon` grant**.
- SELECT: active members of the company (`user_is_organization_member`).
- INSERT: only as yourself (`created_by = auth.uid()`) into a company you belong to.
- UPDATE: only your own records, and only within a company you belong to (cannot move a record to another company).
- DELETE: only your own records.

### Duplicate-detection key and intentional copies
- The dialog makes one random key per **company + template** and keeps it in the browser's localStorage, so every tab and every retry in that browser sends the same key.
- **Concurrent/duplicate requests** (two tabs, double-sent request) share the key: the database's unique rule lets only one claim succeed; the other is refused as "in progress", or — if the first already finished — told "already created" and taken to that workspace.
- **Intentional later copy**: after success the key is removed from the browser, so using the template again makes a new key and a new workspace.
- Limit: the key lives in one browser. Two different browsers/devices clicking at the same moment get different keys and can still both create a copy (each is then a deliberate action by that user).
- Clean failure: the claim is deleted and the key stays, so retry works.
- Incomplete cleanup: the claim is marked `incomplete` with the workspace id; the same key is refused with that id, so no accidental second copy is made until leftovers are handled.

### Stalled attempt recovery
- A `pending` claim older than 10 minutes (tab closed or crashed mid-creation) is treated as stalled. When **the same user** retries, the stale claim is removed and creation proceeds. Another user's stalled claim is never taken over; recent ones are still "in progress".
- Manual path (owner, Supabase SQL editor): find it with `select * from template_applications where status in ('pending','incomplete') and created_at < now() - interval '10 minutes';`, remove leftover boards listed by `workspace_id` (projects where `custom_fields->'workspace'->>'id' = '<workspace_id>'` and their todos), then `delete from template_applications where id = '<id>';`. The user can also clear the browser key by clearing site data.

### Not done
- Creation is still not transactional (no single database function); cleanup remains best-effort.

## Deployment and rollback
- Database: **already applied** to `gvftvswyrevummbvyhxa` (see above). Safe with the currently published frontend (unused table).
- Frontend: publish from Lovable after the owner's signed-in check. Order: database first (done), then frontend.
- Rollback, frontend only (preferred): restore the previous version in Lovable history and republish; the table stays unused and harmless.
- Rollback, database (only after the frontend no longer references the table): `drop table if exists public.template_applications;` — it only holds attempt records, no customer business data. Validated in the disposable harness as a standalone object with no dependants.

## Verification
Fresh run 2026-09-30 01:23 UTC:
- Production build: OK (vite build). Typecheck: clean.
- Regression tests (vitest, mocked Supabase client): 21/21 pass across 5 files — incl. WorkspaceView (delayed board response, delayed previous-company response, column order + unsupported + empty group, boards Retry, concurrent status edits incl. zero-row update, failed update after board switch), apply service (company stamping, verified cleanup, incomplete creation on partial delete and on delete error), board helpers.
- Tenant/security suite (disposable local PostgreSQL 17.9, fresh run): 642 PASS / 0 FAIL / 54 INFO, exit 0.

Limitations: tests use a mocked client, not the live database. Signed-in creation and cross-company checks in the real app could not run here (external Supabase, no session) — owner signed-in review needed before publishing. Transactional creation not implemented.

### Duplicate-protection verification (fresh run 2026-09-30 ~01:37 UTC)
The earlier 21 tests do NOT cover this protection. New, dedicated checks:
- App logic (vitest, in-memory fake enforcing the same unique rule), `src/services/workspaceTemplateIdempotency.test.ts`: 9/9 pass — two concurrent tabs → exactly one workspace; repeat after success → existing workspace returned, nothing created; intentional later copy → second workspace; clean failure → retry works; incomplete cleanup → recovery info kept, same key blocked; key scoped per company; stalled attempt (same user, >10 min) recovered; recent pending stays blocked; another user's stalled claim not taken over.
- Database (disposable PostgreSQL 17.9, the real migration file), `scripts/staging/90_template_applications_tests.sql` + concurrency step: 20/20 pass (TA-01…TA-20) — anon denied; same-company read allowed; cross-company read/insert/update/delete denied; cross-user insert/update/delete within the company denied; moving a record to another company denied; duplicate key refused (23505); same key in another company allowed; no-company user denied; two parallel database sessions with the same key → exactly 1 row.
- Full tenant/security suite, fresh: **662 PASS / 0 FAIL / 54 INFO**, exit 0 (previous 642 + 20 new).
- Whole vitest run: 30/30. Not yet checked signed-in in the real app.
