
## Employee Rota & Scheduling (Business Premium)

A multi-tenant rota system inspired by RotaCloud / Workday WFM. Scope for v1: **Employees & Roles** + **Weekly Shift Scheduling**. Strict org-scoped data, owners/admins only manage, preview mode for non-premium plans.

### What gets built

**1. Navigation & gating**
- New sidebar entry "Rota" under Business Tools.
- Route `/rota` (protected). Page checks plan via `useSubscription`:
  - **Business Premium / Enterprise** → full access.
  - **Other plans** → preview mode: UI rendered, capped at 3 employees + 1 published week, with an inline upgrade banner pointing to `/pricing`.
- Owners/Admins only: non-admin org members see a "Contact your administrator" empty state. Enforced both client-side (via `useUserRole`) and server-side via RLS.

**2. Employees screen (`/rota/employees`)**
- Table of employees in the current org with: name, email, role/job title, pay rate (hourly), contracted hours/week, color tag, status (active/archived), linked user (optional).
- Add/Edit/Archive dialogs.
- "Link to platform user" optional dropdown — choose any active org member; leave blank for standalone records (e.g. casual staff who don't need a login).
- Bulk import CSV (deferred — flagged but not in v1).

**3. Weekly scheduler (`/rota/schedule`)**
- Week picker (prev/next/today), grid of employees × 7 days.
- Click a cell → shift dialog: start, end, break (mins), role, location/note.
- Drag-to-resize and drag-to-copy shifts (using `@dnd-kit/core`, already installed).
- "Copy previous week" action.
- Draft vs Published state per week. Publishing locks edits to admins and is the trigger that makes shifts visible to linked employees in future (read-only "My shifts" view — out of v1 scope but schema-ready).
- Totals per employee per week (scheduled hours, cost = hours × pay_rate) and per day (headcount, hours).

### Data model (new tables, all org-scoped)

All tables include `organization_id uuid not null`, `created_at`, `updated_at`. RLS uses existing helpers `user_is_organization_member` (read) and `user_is_organization_admin` (write).

```text
rota_employees
  id, organization_id, user_id (nullable, FK profiles.id),
  full_name, email, job_title, color,
  pay_rate_pence int, contracted_hours numeric,
  is_active bool default true

rota_shifts
  id, organization_id, employee_id (FK rota_employees),
  shift_date date, start_time time, end_time time,
  break_minutes int default 0, role text, location text, notes text,
  status text check in ('draft','published') default 'draft',
  created_by uuid

rota_week_publications
  id, organization_id, week_start date,
  published_at, published_by
  unique(organization_id, week_start)
```

**GRANTs**: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` (ALL). No `anon`.

**RLS policies** (per table):
- SELECT: `user_is_organization_member(organization_id)`
- INSERT/UPDATE/DELETE: `user_is_organization_admin(organization_id)`

Tenant isolation guaranteed by `organization_id` filter in every policy — no cross-org leakage possible even if the client requests it.

### Plan gate (server-side reinforcement)

Beyond UI gating, add a Postgres function `rota_can_add_employee(org_id)` that returns true if the org has Business Premium/Enterprise OR has fewer than 3 active employees. Called via RPC before inserts; UI also calls it to show/hide the upgrade prompt. Prevents bypass via direct API.

### Files

**New**
- `supabase/migrations/<ts>_rota_system.sql` — tables, grants, RLS, gate function.
- `src/pages/rota/RotaLayout.tsx` — shared layout + plan/role guard.
- `src/pages/rota/Employees.tsx`
- `src/pages/rota/Schedule.tsx`
- `src/components/rota/EmployeeDialog.tsx`
- `src/components/rota/ShiftDialog.tsx`
- `src/components/rota/WeekGrid.tsx`
- `src/components/rota/UpgradeBanner.tsx`
- `src/hooks/useRota.tsx` — fetches employees, shifts, current org id, plan status.

**Edited**
- `src/App.tsx` — add `/rota`, `/rota/employees`, `/rota/schedule` routes (ProtectedRoute).
- `src/components/Header.tsx` or sidebar — add "Rota" entry.
- `src/pages/BusinessTools.tsx` — add card linking to `/rota`.

### Out of scope for v1 (noted for follow-up)
- Employee-facing "My shifts" view, time clock/timesheets, leave & availability, payroll export, mobile push notifications, swap requests. Schema choices above leave room for all of these.

### Security checklist
- All tables org-scoped with RLS via security-definer helpers (no recursive policies).
- Admin-only mutations enforced in DB, not just UI.
- Plan gate enforced in DB function as well as in client.
- No PII exposed cross-tenant; email column on `rota_employees` only readable by same-org members.
- No service-role key in client; all access via anon key + RLS.

Approve to proceed and I'll run the migration first, then build the UI.
