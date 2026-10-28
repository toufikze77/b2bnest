# Phase 12b: master-access switch (prepared SQL)

Nothing in this folder has been applied. Production is `gvftvswyrevummbvyhxa`. Every fact below was read **read-only** on 28 Oct 2026.

## What the switch does

The owner's decision (28 Oct 2026) is that every account chooses a plan and pays after the 14-day trial, with no extensions. The only exception is a **master account**.

- A super admin switches a master account on or off by hand in the Admin portal (Users page).
- A master account gets `state = 'owner'` from `my_access_state()`, so it never sees the paywall or the trial banner, and the AI functions let it through.
- It does **not** get a platform role, so it does **not** open the Admin portal. This is why a separate switch is needed: the `admin` role that gives `owner` today also opens the portal.
- Only super admins can change or list master accounts. This follows the role-granting rule already in production.
- Every change writes a row to `public.admin_audit_logs`, the table the Admin portal already writes to. Actions are `master_access.on` and `master_access.off`, with who, whom, the note and when.
- The last master account can't be removed; there is always at least one.
- The switch touches only `master_access`, never `user_roles`, so it can't lock a super admin out of the portal.

## Files and order

1. **`proposal.sql`**, one transaction. It refuses to run if:
   - it was already applied;
   - Phase 12 is missing;
   - `_access_state_for` differs from the version read today (body md5 `f8c1f091…`, result type, `SET search_path = ''`, SECURITY DEFINER);
   - `admin_audit_logs` or `is_super_admin()` is missing.

   It creates:
   - `public.master_access`: RLS on, no policies. Everything is revoked from PUBLIC, anon and authenticated (Supabase stops auto-granting on 30 Oct, but production still has default grants today). service_role gets SELECT, INSERT, UPDATE and DELETE.
   - `public.set_master_access(_user_id, _enabled, _note)` and `public.list_master_access()`: SECURITY DEFINER, `SET search_path = ''`, EXECUTE for authenticated and service_role only.
   - `CREATE OR REPLACE public._access_state_for(uuid)`: production's exact Phase 12 body plus **one** rule right after the owner-role rule (a `master_access` row returns `owner`, via self, with days left computed as before). Its grants and `search_path` are unchanged.
2. **`data-step.sql`**, right after the proposal. It seeds `master_access` with the two owner accounts, looked up by email (case-insensitive).
   - It is idempotent (ON CONFLICT DO NOTHING).
   - An email with no account is skipped, and it says so in a NOTICE.
   - It runs as the operator, so no super admin is recorded in `admin_audit_logs`. Each row's note says "Phase 12b seed: owner account".
3. **Then** ship the new frontend (Admin switch, owner emails removed).

**Rollback:** `rollback.sql` restores `_access_state_for` byte-for-byte to the production version and drops the table and both functions. It also undoes the data step, because the table goes. Every master account then falls back to the normal rules. Audit rows already written are kept.

## Keeping the two owner accounts safe

> **Apply `proposal.sql` and `data-step.sql` before the new frontend ships.** The new frontend no longer has the hard-coded owner emails. Without the data step, the two owner accounts would depend only on their platform role for owner access.

Today (read 28 Oct), both owner accounts also hold the `admin` role:

| Account | Roles |
| --- | --- |
| `toufikze@gmail.com` | `admin`, `super_admin` |
| `toufik.zemri@outlook.com` | `admin`, `user` |

So Phase 12 already returns `owner` for them on the server. They would keep owner access even without the data step, *as long as that role stays*. The data step makes their owner access independent of the role, so removing `admin` from either later doesn't lock them behind the paywall.

Only `toufikze@gmail.com` is a super admin, so only that account can use the switch. `toufik.zemri@outlook.com` cannot, unless a super admin gives it `super_admin`, which is not part of this change.

## Footer `allowedMarketingEmails`

The two emails in `src/components/Footer.tsx` only hid the footer **link** to `/marketing-materials`. They gated no feature: the page is a public route, listed in the sitemap and `llms.txt`, and anyone can open it.

The brief also requires that neither email appears in `src/`. So the link now shows when the server says `owner` (owner role or master account), the same switch as above. The page itself stays public as before.

## Tests

Run `PG_RUN_USER=postgres bash docs/phase12b/run-test.sh` from the repo root. It uses a throwaway Postgres 16 on port 55438.

| Run | What | Result |
| --- | --- | --- |
| A | `docs/phase12/test.sql` unchanged, as production is today | **81 passed, 0 failed** |
| B | `docs/phase12/test.sql` unchanged, with 12b applied on top (12b's rollback runs before Phase 12's) | **81 passed, 0 failed** |
| C | `docs/phase12b/test.sql` | **51 passed, 0 failed** |
| C, runner checks | re-apply after rollback works; a second apply is refused by the guard; two super admins removing the last two masters at the same moment leaves exactly one | **3 passed** |

Run C covers:
- the local Phase 12 body is the production one (md5);
- no Phase 12 state changes when there are no masters;
- the table is closed to normal users, anon and even super admins writing directly;
- non-super-admins, anon and a service role with no user are refused;
- on: an ended-trial user with no role becomes `owner` with no portal access, and an audit row is written;
- off: back to `trial_ended`;
- the last master can't be removed;
- no-ops write no audit rows;
- a super admin can't be locked out;
- unknown users and over-long notes are refused;
- deleting a user removes their master row (cascade);
- `list_master_access` returns only its five fields;
- the data step: one email present, one missing, idempotent, case-insensitive;
- rollback: exact body restored, audit rows kept.

## Not verified

- Anything on production beyond the read-only readings above. Nothing was applied.
- The harness runs Postgres 16; production runs 17.4. The guard compares the function **body** (`prosrc`), which is the same text on both, rather than the version-formatted full definition.
