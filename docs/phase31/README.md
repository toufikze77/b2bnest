# Phase 31: Time Tracker saved to the account

Business Tools → Time Tracker used to keep everything in React state: a refresh lost the running timer and every entry.
It now saves to the database. Nothing here has been applied to production.

## What was there (read only, 2 Nov 2026)
- `src/components/TimeTracker.tsx` (Business Tools): React state only, free-text project and task, last 10 entries in memory.
- `src/components/ProjectTimeTracker.tsx` (Project Management): also React state only. **Not changed.**
- **`public.project_time_entries`** exists in production (migrations `20250804164213`, `20250804164715`, `20250804164802`, later policy fixes `20260523142210`, `20260604233121`):
  - columns `id, project_id (NOT NULL, FK projects ON DELETE CASCADE), user_id (no FK), task_name (NOT NULL), description, start_time, end_time, duration_minutes, is_billable, hourly_rate numeric(10,2), created_at, updated_at`;
  - RLS on with four policies: project owners manage all entries of their projects; **any active member of the project's company may change anyone's entries** (role `public`); users read their own; the Phase 25 restrictive aal2 policy;
  - grants: anon `SELECT` (and `MAINTAIN`), authenticated and service_role all;
  - **0 rows, and no code reads or writes it** (the project tracker never saved).
- **Decision: reuse and extend it** (one table for time) instead of creating `time_entries`. See the proposal header for what changes.
- Companies: `organization_members` + `user_is_organization_member/admin`, `user_can_access_project`; access state from `_access_state_for` (owner, subscribed self or via company, trial, trial_ended, suspended). No Business Tools table refused trial-ended accounts in the database before; this one does.
- Other Business Tools: Create Coupon and Cash Flow Tracker are browser-only; To-do list (`todos`) and the rota use the database with the company pattern this follows.

## Rollout
1. **The owner applies `docs/phase31/proposal.sql`** (one transaction; refuses unless the table, its policies, `_access_state_for` and `mfa_ok` are exactly as read on 2 Nov 2026, and the table is empty).
2. **Publish the frontend.** Before step 1 the page says the tracker needs a database update and offers no controls (nothing would be kept).

No Edge Function changes. `supabase/functions/ai-assistant/knowledge.ts` has new text only; deploy it whenever convenient (optional).

The old in-memory tracker never saved anything, so **there is nothing to migrate**. The page says so: "The earlier version of this tracker kept entries only in the open browser tab and never saved them, so there is nothing to bring across."

## Design
- **Timer:** `time_start(project, description, billable, rate_pence, company)`, `time_pause()`, `time_resume()`, `time_stop(confirm_short, ended_at)`. The server clock (`now()`) sets start, pause and end, so a wrong device clock can't corrupt entries. Elapsed time in the browser is computed from the stored times and the clock, so a refresh, a closed tab or another device shows the right time.
- **One running timer per user:** a partial unique index plus a per-user advisory lock.
- **Pauses:** `paused_at` while paused; resume adds the pause to `paused_seconds`; stop while paused counts the open pause.
- **Short entries:** stopping under a minute returns `needs_confirmation`; the page asks (Save anyway / Discard / Keep timing).
- **Over 24 hours:** stop returns `over_24_hours`; the page asks when it stopped (`ended_at`, never in the future or before the start).
- **Manual entries and edits:** table writes, checked by RLS and the `time_entry_guard` trigger (no future times, running entries only via the timer, owner can't change) and CHECKs (end >= start, at most 24 hours, pauses within the entry, rate 0 to £10,000 an hour in pence, description at most 500, a project or a description). Overlaps are allowed; the page marks them.
- **Rate and value:** `hourly_rate_pence` is the source of truth (`hourly_rate` pounds and `duration_minutes` are kept in step by the trigger for the project screens). Value = worked hours x rate per billable entry, rounded to the penny; no rate means no value (the page says how much billable time has no rate).
- **Defaults:** `time_tracker_settings` (default rate, billable by default), one row per user.
- **Summary:** `time_summary(from, to)`: your own finished entries that start in the range; totals, by project and by day (UK days, Europe/London), every day listed. At most 400 days.
- **Who sees what:** you see and change only your own entries. Owners and admins of the entry's company can **read** their members' company entries (the `todos` / rota pattern); there is no screen for that yet. A company project's entry belongs to that company; a no-project entry takes the company chosen in the app.
- **Access:** a restrictive policy and every RPC require `time_tracker_access_ok()`: owner, subscribed (own or company) or trial. Trial-ended and suspended accounts are refused by the database, including reading old entries (they come back with a plan). The Phase 25 aal2 policy and guard line apply.
- **Page:** timer with project picker and description, Today / This week / This month / Custom, totals, hours per day chart (with a table version), by project, entries with edit and delete, add entry (end time or duration), defaults, CSV export through the Phase 36 helper (`tableToCsv`: escaping and formula neutralising), `aria-live` announcements on start, pause, resume and stop.

## Tests
- `PG_RUN_USER=postgres bash docs/phase31/run-test.sh`: disposable Postgres 16 with the production shapes (helper hashes checked first). **106 checks**: privileges, guard log, one running timer, pause maths, stop while paused, short stop, over 24 hours, manual limits, overlaps, companies, RLS between users and companies, trial / trial-ended / suspended / anon / aal2, settings, summary maths and UK days, rollback refused without force, forced rollback restores the exact state (columns, constraints, indexes, trigger, policies, grants, guard log), re-apply, second apply refused, drift refused.
- vitest: `src/lib/timeTracker.test.ts`, `src/components/TimeTracker.test.tsx` and updated Help tests.

## Security advisor expectations
- `authenticated_security_definer_function_executable` (WARN): **+6** (`time_start`, `time_pause`, `time_resume`, `time_stop`, `time_summary`, `time_tracker_access_ok`). Each checks the caller itself; none is executable by anon.
- No `rls_disabled` (both tables have RLS); no anon grants (anon's old `SELECT` on `project_time_entries` is removed); `search_path` pinned on every new function.

## Rollback
`docs/phase31/rollback.sql` refuses while any entry or setting exists. With `SET LOCAL app.phase31_force = 'on'` it **deletes every time entry and setting** (export first), then restores the table exactly.
