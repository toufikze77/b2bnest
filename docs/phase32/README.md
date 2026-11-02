# Phase 32: Rota holiday requests

Staff ask for time off in **Rota → Holiday**; the company's owner or an admin approves, declines or asks for a change.
Approved holiday shows on the schedule, and planning a shift on it needs a confirmation. Nothing here has been applied
to production.

## What was there (read only, 2 Nov 2026)
- **Code:** `src/hooks/useRota.tsx`, `src/pages/rota/*` (Employees, Schedule), `src/components/rota/*` (employee and shift dialogs). Routes `/rota`, `/rota/employees`, `/rota/schedule` behind `ProtectedRoute`; nav "Team → Employee rota".
  - The page let in only owners, admins and managers (`isAdmin` in `useRota`, which also counts a `manager` role, but production has only `owner`, `admin` and `member` roles).
- **Tables** (migration `20260624145625`):
  - `rota_employees`: `organization_id`, **`user_id` (FK profiles, ON DELETE SET NULL)**, `full_name`, `email`, `job_title`, `pay_rate_pence`, `contracted_hours`, `is_active`.
  - `rota_shifts`: employee, date, times, break, status.
  - RLS: any active member **reads** both; owners and admins (`user_is_organization_admin`) write.
  - Grants: anon `SELECT` (and `MAINTAIN`) as on most tables.
  - 2 employees, 11 shifts, **0 employees linked to a user**.
- **Companies:** `organization_members` (`owner`, `admin`, `member`), `user_is_organization_member/admin`, and `_access_state_for` (company members follow the paying account).
- **No holiday, leave, absence, allowance, working pattern or bank-holiday data** exists anywhere in the database.
- **Company settings:** `organizations.settings` (jsonb, `{}` for all 10 companies) is reused for the leave-year start month.

## How staff are matched to their employee row
`rota_employees.user_id` already exists, so no new column is needed.
- **One row per user:** the only change to the table is a partial unique index (one employee row per user per company).
- **Linking:** a manager links a member in Rota → Holiday, and `rota_employee_link` checks the member is an active member of that company.
- **Suggestions:** `leave_link_candidates` suggests an employee only when **exactly one** unlinked employee has the member's email. The manager still chooses Link; nothing is matched by email automatically.

## Rollout
1. **The owner applies `docs/phase32/proposal.sql`**. It is one transaction, and it refuses unless all of these hold:
   - the Rota tables, policies and indexes, and the hashes of six helpers, are exactly as read on 2 Nov 2026;
   - no user is linked twice in one company;
   - no company already has the setting.
2. **Publish the frontend.** Before step 1, Rota → Holiday says "Holiday requests need a database update (docs/phase32) that hasn't been applied yet…" and shows no controls. The schedule shows no holiday blocks; everything else works as today.

**No Edge Function and no email** in this phase. Email notification (to managers on a new request, to staff on a decision) is a possible later step. For now managers see a count badge on the Holiday tab, and staff see a status line on each request.

## Design
- **`rota_leave_requests`:**
  - Columns: company, employee (FK, ON DELETE CASCADE), requester, start/end date, `start_half` / `end_half` (`full`, `am`, `pm`), kind (`annual`, `unpaid`, `other`), note ≤ 500, status (`pending`, `approved`, `declined`, `cancelled`), `change_requested`, decided_by/at, decision_note ≤ 500, cancelled_by/at, timestamps.
  - CHECKs: end ≥ start; at most 60 days; one day = full, morning or afternoon; several days = start full or afternoon, end full or morning.
  - An overlap trigger works on half-day slots, so a morning and an afternoon on the same day don't overlap. It refuses overlap with the same person's pending or approved requests.
  - **Users can only read it**: it is written only by the functions and never deleted by users.
- **`rota_leave_allowances`:** employee, leave year, days `numeric(5,1)` from 0 to 366. The company is always taken from the employee. Managers write; staff read their own. With no row, no balance is shown.
- **Leave year:** `organizations.settings.leave_year_start_month` (1–12; January when absent), set through `leave_settings_set`.
- **Functions** (SECURITY DEFINER, `search_path ''`, Phase 25 guard line, authenticated only):
  - `leave_access_ok`: owner, subscribed or trial; used by the policies.
  - `leave_request_create`:
    - staff for their own linked row, managers for anyone in the company;
    - no past start unless a manager;
    - at most 60 days; no overlap with that person's other pending or approved requests.
  - `leave_request_decide`: approve / decline / change, managers only. A manager can't decide their own request unless they are the company owner. `decided_at = now()`. A decided request can't be decided again, only cancelled.
  - `leave_request_cancel`:
    - staff: their own pending request, or approved holiday before it starts;
    - managers: any pending or approved request in their company.
  - `leave_balance(employee, year)`:
    - annual holiday only, counted Monday to Friday with half days;
    - used = approved, pending = waiting, remaining = allowance − used − pending;
    - with no allowance, no balance is returned.
  - `leave_calendar(company, from, to)`: approved only, name and dates only, at most 400 days.
  - `leave_settings_set`, `rota_employee_link` and `leave_link_candidates`: managers only.
- **Privacy:**
  - Staff see their own requests, their own allowance, and the approved-away calendar (names and dates only).
  - Managers see everything for their company. Other companies see nothing.
  - A restrictive policy refuses trial-ended and suspended accounts, and every function checks the same.
- **Working days:** Monday to Friday, because the rota has no working pattern per person. **Bank holidays are not subtracted**: there is no bank-holiday data, and none was invented. The page says so.
- **Page (`/rota/holiday`):** open to every company member.
  - **Staff:** ask (dates, halves, type, note), see working and calendar days and "N others are off these days", see their requests with status and reason, cancel, see their balance (when an allowance is set) with the 5.6-week statutory minimum as a hint only, and see who is away for the next 90 days.
  - **Managers** also get:
    - the decision queue (with the person's note and others off);
    - allowances per person and the leave-year start month;
    - linking members;
    - CSV export of approved holiday through `tableToCsv`.
- **Schedule:** a dashed "Holiday", "Holiday (morning)" or "Holiday (afternoon)" block (text, not colour alone) on the person's day.
  - **Adding or editing a shift there:** shows the warning, and Save stays off until "Plan this shift anyway" is ticked.
  - **"Copy last week":** asks first when copied shifts would land on holiday.

## Tests
- `PG_RUN_USER=postgres bash docs/phase32/run-test.sh`: a disposable Postgres 16 with production shapes; helper hashes are checked first. **125 checks:**
  - privileges and the guard log;
  - day and half-day counting;
  - every request rule (overlap, 60 days, past, halves, kind, note);
  - staff can't decide their own or others' requests, and an admin can't decide their own;
  - privacy of notes, reasons and allowances; cross-company isolation;
  - balance maths, with and without an allowance, and the April leave year;
  - calendar is approved-only with name and dates only;
  - cancelling rules; linking rules and suggestions;
  - trial-ended, suspended, aal2 and anon (all 9 functions);
  - rollback refused without force, then forced rollback restores links, settings, indexes and policies exactly;
  - re-apply works; a second apply is refused; drifted policies and a changed helper are refused.
- vitest: `src/lib/rotaLeave.test.ts`, `src/pages/rota/Holiday.test.tsx`, `src/components/rota/ShiftDialog.test.tsx`, and the Help tests.

## Security advisor expectations
- `authenticated_security_definer_function_executable` (WARN): **+9**:
  - `leave_access_ok`
  - `leave_request_create`
  - `leave_request_decide`
  - `leave_request_cancel`
  - `leave_balance`
  - `leave_calendar`
  - `leave_settings_set`
  - `rota_employee_link`
  - `leave_link_candidates`

  Each checks the caller itself, and none is executable by anon.
- No `rls_disabled` (RLS is on for both new tables, with the restrictive aal2 and access policies), no anon grants on the new tables, and `search_path` is pinned everywhere.

## Rollback
`docs/phase32/rollback.sql` **refuses while any request, allowance, settings change or link made through Phase 32 exists.**

With `SET LOCAL app.phase32_force = 'on'` it:
- deletes all holiday data (export first);
- puts each company's settings and each employee's `user_id` back exactly as they were before the first change (from `phase32_backup`);
- drops the index, tables, functions and guard log rows.
