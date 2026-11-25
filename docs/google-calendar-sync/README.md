# Google Calendar: automatic task sync, without duplicates

**Prepared, not applied and not deployed.** Tasks with a due date appear in the person's Google Calendar as all-day events. They stay in step automatically, with exactly one event per task.

## Files
- **SQL** (owner applies, after review):
  - `proposal.sql`: the `calendar_event_links` table;
  - `rollback.sql`;
  - `schedule.sql`: the 15-minute catch-up job, applied separately.
- **Local tests:**
  - `fixture.sql`;
  - `test.sql`;
  - `run-test.sh`, run with `PG_RUN_USER=postgres bash docs/google-calendar-sync/run-test.sh`. It currently gives 26 PASS, 0 FAIL.
- **Edge Function** `supabase/functions/google-calendar-sync/`:
  - `index.ts`: the actions;
  - `plan.ts`: pure. It builds the event and the hash and decides create, update, skip or delete;
  - `sync.ts`: carries the decisions out. Google and the links are passed in;
  - `google.ts`: the Google Calendar API, with the 401 refresh and the 429 retry;
  - `secret.ts`: the `sync_all` secret check;
  - `secret_test.ts`: a Deno test.
- **App:**
  - `src/lib/calendarSync.ts`;
  - the "Sync now" button in `src/components/IntegrationButtons.tsx`, shown on the Google Calendar card and in the Project management calendar;
  - one-task syncs after task changes in `TodoList`, `ProjectManagement`, `WorkspaceView` and `lib/deleteTask.ts`.
- **Tests:**
  - `src/test/googleCalendarSync.test.ts`: plan, executor and Google client, against a fake calendar;
  - `src/lib/calendarSync.test.ts`.

## How it works
- **The event:**
  - It is an **all-day event on the due date**. `todos.due_date` is a DATE: `start.date` is the due date and `end.date` the next day, because Google's end date is exclusive.
  - Its title is "📋 {title}", and its description is the task's description, or "Task from B2BNEST".
  - Its colour follows the priority: red for high and urgent, yellow for medium, green otherwise. These colours are valid for all-day events.
  - Reminders are the calendar's own all-day defaults. The old 60- and 30-minute overrides would fire the evening before an all-day event.
  - Every event we create carries two private properties: `b2bnest_task_id` and `b2bnest_user_id`.
- **Which tasks:** the person's own tasks (`todos.user_id`), not done (`status <> 'done'`, which is what the app writes; the old code compared with `'completed'`, which never matched), not completed, not archived, and with a due date.
- **The link:** `calendar_event_links (user_id, task_id, provider)` holds the Google event id and `content_hash`, a hash of the title, description, due date and priority.
- **The decision for each task** (`plan.ts` `decide`):
  - Link, and the hash unchanged: **skip**. No call to Google.
  - Link, and the hash changed: **PATCH** the event.
  - No link: look for an event carrying this task's marker and **reuse** it (PATCH it and store the link). Only when there is none, **POST** a new one. So a lost link row can't cause a duplicate.
  - Extra marked events for the same task (duplicates) are removed.
  - Task done, archived, without a due date, or deleted: **delete** the event and the link.
    - A deleted task's link has already gone with it (`ON DELETE CASCADE`), so its event is found **by its marker**.
    - The full sync lists the person's marked events and removes any whose task is no longer open.
  - Only events with **this person's** marker are listed and deleted, so another B2BNEST account on the same Google calendar is never touched.
- **Deleted in Google** (decided): when an edit's PATCH gets 404 or 410, the event is **not recreated**. The link is kept with `content_hash = "gone:<hash>"`, and the task is skipped while it stays the same. If the task changes later, it gets a new event; if it is finished, the link is just removed.
- **Google errors:**
  - 401: the token is refreshed once, through the existing `refreshIntegrationToken` (the `getValidToken` path), and the call is tried again.
  - 429 or 503: it waits (Retry-After, at most 5 seconds) and tries up to twice more.
  - Tasks are processed in batches of 25, with a short pause between batches.
  - If Google can't list the marked events, the run stops before changing anything.
- **Answer:** `{ success: true, created, updated, skipped, deleted, failed }`. `sync_all` adds `users`, `users_skipped`, `more` and `links_forgotten_for`.

## Actions
| Action | Who | What |
|---|---|---|
| `sync_tasks` | the signed-in person | all their tasks: the "Sync now" button |
| `sync_task` (`create_event` is still accepted) | the signed-in person | one task, after it was created, edited, completed or deleted in the app |
| `forget_links` | the signed-in person | Google Calendar was disconnected: delete their link rows (their Google events are left alone) |
| `sync_all` | **only** the `x-calendar-sync-secret` header (pg_cron) | every person with `google_calendar` connected, for up to 100 seconds per run (`more: true` means the next run continues); links of people no longer connected are deleted |

- **Two ways in:**
  - `sync_all` never accepts a sign-in. It needs the Edge Function secret `CALENDAR_SYNC_CRON_SECRET` (at least 32 characters), compared in constant time. With the secret unset or too short, it is always refused with 401.
  - Every other action checks the caller with `auth.getUser(token)`, as before.
- **Demo:** demo people are refused by the existing guard wrapper, the same decision as before (`_shared/demo-guard_test.ts` lists the function as "refuse").
- **`verify_jwt` stays `false`** (it is in `config.toml` and on the list in `src/test/edgeFunctions.test.ts`). The function checks the person itself, and the cron call has no JWT.

## In the app
- **After a change:** after a task is created, edited, completed or deleted, `syncTaskToCalendar(taskId)` asks for `sync_task`.
  - It does this only when Google Calendar is connected, checked with the safe `get_user_integrations_safe` RPC; the answer is remembered for a minute. Otherwise nothing is called.
  - Never for the demo account.
  - It never blocks or fails the task change. Problems are logged with `console.warn`, and the catch-up fixes them.
- **Tasks created in bulk** from templates are not synced one by one; the 15-minute catch-up picks them up.
- **"Sync now":** on the Google Calendar card (when connected) and in the Project management calendar (only when connected). It shows, for example, "Synced 3, updated 1, removed 0", or the error. The old `SyncToCalendarButton` checked `data.success`, which the function never returned, and wasn't used anywhere.
- **Disconnect:** the card calls `forget_links`, then deletes the connection as before. The events stay in Google Calendar.

## The table
- **Protection:**
  - RLS is on, with no policies. There are no grants for anon or authenticated, and only the service role can read or write it. This is the same protection as `user_integrations`.
  - It has the `a0_demo_readonly_guard` trigger. `docs/demo-readonly/tables.json` lists it under "not in production yet" with that note, as earlier prepared tables were.
- **Cascades:**
  - with the task (`task_id → todos(id) ON DELETE CASCADE`);
  - with the person (`user_id → auth.users(id) ON DELETE CASCADE`, as `user_integrations`).
- **Account deletion:** `data_rights_delete_account` also deletes every `user_id` table it finds in the catalogue, so it is covered.
- **"Download my data":** includes it, through `supabase/functions/_shared/data-rights/tables.ts` (service role, by `user_id`). `src/test/dataExportCoverage.test.ts` checks this.
- **Production guard** (read 25 Nov 2026): 160 tables, md5 `b9fec97b9d0d8c836c6af78125e92371`; `todos.id` a uuid primary key; `demo_readonly_guard()` exists; no `calendar_event_links`.
- **Rollback:**
  - it unschedules the job if it exists and drops the table;
  - the links are only a cache, and the events carry their markers, so a later sync reuses them instead of duplicating;
  - roll back the function first.

## Owner steps
1. **Apply** `proposal.sql` after review: the owner's assistant re-checks the facts above, read-only.
2. **Set the secret:** pick a random value of 32 or more characters, then run:
   ```powershell
   npx.cmd supabase secrets set CALENDAR_SYNC_CRON_SECRET=<the value> --project-ref gvftvswyrevummbvyhxa
   ```
3. **Deploy:**
   ```powershell
   npx.cmd supabase functions deploy google-calendar-sync --project-ref gvftvswyrevummbvyhxa --use-api
   ```
   `config.toml` already has `verify_jwt = false` for it.
4. **Publish the front end.**
5. **Put the same secret value in Vault** as `calendar_sync_cron_secret`, then apply `schedule.sql`. The job runs every 15 minutes, at :07, :22, :37 and :52.

The existing secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ENCRYPTION_SECRET` are used as before.

## Limits and later
- **Events from the old code** (before this change) carry no marker, so they can't be recognised. People who used the old sync may have old timed events to remove by hand once.
- **Only the person's own tasks** (`user_id`) are synced, not tasks assigned to them by others.
- **No change comes back from Google** into tasks (one way only).
- **Only the primary calendar** is used.
