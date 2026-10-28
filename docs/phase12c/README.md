# Phase 12c: Suspend really blocks an account (prepared)

Nothing in this folder has been applied, and the `admin-set-user-ban` Edge Function has not been deployed. Production is `gvftvswyrevummbvyhxa`. Every fact below was read **read-only** on 28 Oct 2026.

## What Suspend did before

Admin → Users → Suspend calls `public.admin_set_user_status(_user_id, _active)`. Its whole body:
- checks for a super admin;
- refuses your own account;
- runs `UPDATE profiles SET is_active = …`;
- writes an audit row.

**Nothing reads `profiles.is_active`**: there is no sign-in block, no RLS rule and no access check. A suspended person keeps signing in and using everything, which the tests reproduce. Phase 12 also left `authenticated` with column INSERT and UPDATE on `is_active` (live ACL `authenticated=arw`), so a suspended person can set themselves back to Active from the browser, which the tests also reproduce. Super admins, admins and master accounts could all be "suspended".

Checked in the code: nothing in `src/` or `supabase/functions/` writes `profiles.is_active` as the user. The only writers are `admin_set_user_status` and the sign-up trigger (`handle_new_user`, SECURITY DEFINER).

## The three layers now

1. **Server access state.** `my_access_state()` returns `state = 'suspended'` for a suspended account, whatever its plan, trial or company. The app and the AI functions (`ai-assistant`, `business-insights`) read this, so it also covers the access-token window described below.
2. **The app.** The paywall gate shows a full-page "Your account has been suspended" screen, with Contact and Help links and a sign-out button. It has no plans and no payment buttons. The trial banner never shows for a suspended account.
3. **Sign-in.** The `admin-set-user-ban` Edge Function sets a Supabase Auth ban, so a suspended person can't sign in or refresh a session. The sign-in screen says "This account has been suspended. Contact us."

Reactivate lifts the ban, clears the flag and restores the previous state exactly (tested).

**Never suspended:** super admins, admin/owner-role users and master accounts. The RPC refuses them, and even a flag set behind its back is ignored. Nobody can suspend themselves.

## Files and order

1. **`precheck.sql`** (read-only, counts only). Run it on production just before applying. Today (28 Oct): 8 profiles, **1 suspended, which will be blocked as soon as the proposal is applied**, 0 protected accounts suspended. That one account has no Auth ban yet: after the proposal it sees the suspended screen but can still sign in. To ban it too, reactivate and suspend it again from Admin → Users once the function is deployed.
2. **`proposal.sql`**, one transaction. Its guards refuse if:
   - it was already applied;
   - Phase 12b is missing;
   - the live bodies differ (md5 of `prosrc`: `_access_state_for` `07c21748745fb10e84459577f5c3129b`, `admin_set_user_status` `1877bf0d05437954004bbc6ab8d57ce3`);
   - `admin_log_action` or `is_super_admin` is missing;
   - `is_active` is no longer user-writable.

   What it changes:
   - `REVOKE INSERT (is_active), UPDATE (is_active)` from PUBLIC, anon and authenticated. Every other column grant is unchanged, and anon/authenticated SELECT on `is_active` is kept.
   - New `public._suspension_protected(uuid)` (service_role only).
   - `CREATE OR REPLACE admin_set_user_status`: same signature and behaviour, plus refusals:

     | Case | Code | Message |
     | --- | --- | --- |
     | Suspending a super admin | `P0001` | `cannot_suspend_super_admin` |
     | Suspending an admin/owner-role user | `P0001` | `cannot_suspend_admin` |
     | Suspending a master account | `P0001` | `cannot_suspend_master` |
     | Missing user | `P0002` | |
     | Not a super admin, or your own account | `42501` | same messages as today |

     Its `search_path` changes from the live `public` to `''` (every name is schema-qualified). Its grants stay authenticated and service_role.
   - `CREATE OR REPLACE _access_state_for`: the live body plus one rule, first after the null check.
3. **Deploy `admin-set-user-ban`.**
4. **Publish the frontend.**

**What breaks if the order is wrong:**
- **Frontend before the function:** Suspend and Reactivate fail with a clear "couldn't reach the server" error, and nothing changes.
- **Function before the SQL:** the RPC still has no master/admin refusals, and the flag alone blocks nothing in the app.
- **SQL before the frontend:** suspended people get `suspended` from the server. The current app doesn't know that state and treats it as "unknown", which never blocks, so the app keeps working for them. The current AI functions do refuse it: an unknown state fails closed with 503. The clear 403 arrives with the new function code.

The safe order is SQL, then the function, then the frontend, done together.

**Rollback:** `rollback.sql` restores both functions verbatim (including `SET search_path TO 'public'`), drops the helper and re-grants `INSERT (is_active), UPDATE (is_active)` to authenticated. The tests check the ACL is restored exactly. **It does not lift Auth bans**: reactivate people in Admin → Users first, or lift the ban in the Supabase dashboard.

## The Edge Function `admin-set-user-ban`

`verify_jwt = true`. Body: `{ user_id, suspend }`.

1. It authenticates the caller from their JWT. It calls `admin_set_user_status` **as the caller**, with a client built on their JWT. So the database runs the super-admin, self, admin and master checks and writes the audit row.
2. **Suspend:** RPC (`_active = false`), then the Auth ban (`auth.admin.updateUserById(id, { ban_duration: '876000h' })`, service role). If the ban fails, it puts the flag back with the same RPC and returns a clear error, so the two never disagree.
3. **Reactivate:** it lifts the ban first (`ban_duration: 'none'`), then calls the RPC (`_active = true`). If the RPC fails, it re-applies the ban.
4. It never logs tokens or emails, and never retries. CORS is the same as the other functions.

**Signing the person out now:** in the supabase-js version these functions pin (`esm.sh/@supabase/supabase-js@2.45.0` → `@supabase/auth-js` 2.64.4, checked in the package source), `auth.admin.signOut(jwt, scope)` takes **the person's own access token**, not a user id. The service role can't sign someone out by id with it. There is no by-id session revocation in that version, so the function doesn't call it. The ban itself stops new sign-ins, and Supabase Auth refuses to refresh a banned user's session. I haven't verified that refusal against the real Auth server from here.

**The access-token window:** an access token issued before the suspend stays valid until it expires, up to the project's JWT expiry (Supabase's default is 1 hour; I did not read this project's setting). During that window, layer 1 still blocks the person: every page asks `my_access_state()` and gets `suspended`, and the AI functions refuse it. Their direct table access under RLS (their own rows) lasts until the token expires.

## How a banned sign-in looks

Supabase Auth returns an `AuthApiError` with code `user_banned` (the code is in the auth-js error-code list, checked locally). The sign-in page then shows "This account has been suspended. Contact us." with a link to /contact. I could not trigger a real banned sign-in from here.

## Tests

Run `PG_RUN_USER=postgres bash docs/phase12c/run-test.sh` from the repo root. It uses a throwaway Postgres 16 on port 55441.

| Run | Suite | Result |
| --- | --- | --- |
| A1 | `docs/phase12/test.sql` unchanged, production today | **81 / 81** |
| A2 | `docs/phase12/test.sql` unchanged, with 12c on top | **79 / 81**: the 2 expected failures below |
| B1 | `docs/phase12b/test.sql` unchanged, production today | **51 / 51** |
| B2 | `docs/phase12b/test.sql` unchanged, with 12c on top | **51 / 51** |
| C | `docs/phase12c/test.sql` | **49 / 49**, plus guard and re-apply after rollback |

The two A2 failures are the hole being closed, not a regression. Both Phase 12 checks assert that users can write `is_active`:
- "every other profile field still saves": its update includes `is_active = true`;
- "UPDATE on all 28 others": it is 27 now.

The Phase 12 file is left unchanged as asked. The 12c suite re-checks the same ground: every other field and upsert still saves, the trial columns stay locked, and only `is_active`'s grant changed.

## Not verified

- Production beyond the read-only readings. Nothing was applied.
- The real Supabase Auth admin API: the ban, the unban, refresh refusal for a banned user, and the `user_banned` response at sign-in.
- The project's JWT expiry setting.
