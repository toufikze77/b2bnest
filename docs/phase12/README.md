# Phase 12: the 14-day trial ends (prepared SQL)

Nothing in this folder has been applied. Production is `gvftvswyrevummbvyhxa`. Every fact below was read **read-only** on 27 Oct 2026.

## The trial hole

| What | Live reading |
| --- | --- |
| `public.profiles` ACL | `{postgres=arwdDxtm, service_role=arwdDxtm, authenticated=arw}` |
| Update policies | `users_update_own_profile` and "Users can update own profile" check only `auth.uid() = id` |

Table-level INSERT and UPDATE for `authenticated`, plus those policies, means any signed-in user can extend their own trial from the browser:

```sql
update profiles set trial_ends_at = '2099-01-01' where id = auth.uid()
```

They can also flip `is_trial_active`, `trial_expired` and `trial_started_at`, or delete and re-insert their row with a far-future date.

**Reproduced** on a throwaway Postgres 16 that copies the live grants and policies (`test.sql`, section 0, three checks).

**Closed** by `proposal.sql`:
- It revokes table-level INSERT and UPDATE from `authenticated`.
- It grants them back, column by column, on the 28 other columns.
- The four trial columns get nothing for `PUBLIC`, `anon` or `authenticated`.
- SELECT is untouched.

After the change, every app write still works (checked in `test.sql`, section 2):
- `ProfileSetup` upsert
- `AccountSettings` avatar upsert
- `ProfileEditDialog`
- `useUserSettings`

Nothing in `src` writes a trial column. Only the `activate-trial` Edge Function does, with the service role, and the service role keeps full access.

Sign-up is unchanged. `handle_new_user()` runs as definer, owned by postgres, and does not name the trial columns. The column defaults still give exactly 14 days.

## `my_access_state()`: who can do what

- SECURITY DEFINER, STABLE, `SET search_path = ''`.
- EXECUTE for `authenticated` and `service_role` only.
- With no signed-in user it raises `42501`.
- It answers for the caller only. The helper `_access_state_for(uuid)` is service_role only.

The rules are checked in this order:

| state | when | via |
| --- | --- | --- |
| `owner` | `user_roles` has `super_admin`, `admin` or `owner`. Only super admins can grant roles, never `super_admin` and never to themselves. Live: both owner accounts have `admin`. | self |
| `subscribed` | The caller's own `subscribers` row is entitled: status `active`, `trialing`, `past_due` or `unpaid` (the webhook's `ENTITLED_STATUSES`), or an old row with no status and `subscribed = true`. | self |
| `subscribed` | The billing owner of a company where the caller is an **active** member has an entitled row. | company |
| `trial` | The caller's own `trial_ends_at > now()`, or a billing owner's (whichever ends later). Read from the timestamp, never from the flags. | self / company |
| `trial_ended` | None of the above. `via = company` (with the owner's display name) when the caller is an active member of a company billed by someone else, so the app shows "ask the account owner" and no payment buttons. | self / company |

Other fields:
- `days_left` is whole days, rounded up, never negative.
- The flip happens at the exact timestamp: `trial_ends_at = now()` is already ended, and `now() + 1µs` is still a trial with 1 day left.

Design notes for the owner:
- Every sign-up gets a personal company, created by `handle_new_user`, where they are billing owner. So "via company" means a member of a company billed by **someone else**.
- **Support customers** live in `support_customers`, never in `organization_members`. They never inherit a company's plan; they only have their own trial state. `/support/portal` is exempt from the paywall, so they keep using it.
- A super admin who grants `admin` to a customer gives that customer owner (full) access. This is the same as today.
- **Noticed, not changed (out of scope):** `profiles.is_active` is also self-updatable by users today. It is the same class of issue if admin suspension relies on it.

## Precheck (production, read-only, 27 Oct 2026)

`precheck.sql` returns counts only, with no names or emails. It uses the same rules as the function; `test.sql` proves the categories match.

| Category | Accounts |
| --- | --- |
| 1 owner account | 3 |
| 2 subscribed (own subscription) | 4 |
| 5 PAYWALL: own trial ended (chooses a plan) | 1 |

All 8 profiles started a trial, and all 8 trials have ended (0 running). 2 still carry a stale `is_trial_active = true` flag. The brief's "6 expired" is the 6 rows *flagged* expired.

**Decision for the owner:** when the new app ships, **1 account** will see the "Your 14-day trial has ended" screen. No member will see the company view today. Nothing here extends anyone's trial. If you want to give that account more time, that is a separate, explicit data change.

## Files and order

1. `precheck.sql`: read-only. Run it again just before applying, because the counts change daily.
2. `proposal.sql`: one transaction.
   - Guards: refuses to run twice, refuses if the live grants differ, refuses if `profiles` no longer has 32 columns.
   - Locks the trial columns and creates the three functions.
3. Deploy the app and the `ai-assistant` and `business-insights` functions (`_shared/access.ts`).
   - Until step 2 is applied, `my_access_state()` doesn't exist. The app then falls back to the old client rules, and the functions fail open, both clearly logged (see the PR).
4. Optional: `data-step.sql`.
   - Cosmetic. It tidies the 2 stale flags, after saving them to `phase12_trial_flags_backup` (RLS on, service_role only).
   - Access never reads these flags.

Rollbacks:
- `data-step-rollback.sql` restores each flag exactly and drops the backup table.
- `rollback.sql` drops the three functions and restores the exact live grants (`authenticated=arw`, column SELECT grants untouched). **It reopens the hole.**

Retire later (not done here): the deployed `activate-trial` Edge Function. The app no longer calls it.

## Tests

`PG_RUN_USER=postgres bash docs/phase12/run-test.sh` (from the repo root) uses a throwaway Postgres 16 on port 55437.

The baseline is the support and onboarding harness fixtures, then `fixture-live.sql`. That file holds the live `profiles` columns, defaults, grants and the 7 policies; the live `handle_new_user`, `check_trial_status`, `assert_self` and `is_super_admin`; and the `user_roles` policies.

Result on 27 Oct 2026: **81 passed, 0 failed** in `test.sql`, plus 2 runner checks (re-apply after rollback works; a second apply is refused).

The tests cover:
- the hole before and after;
- sign-up gives exactly 14 days, plus the company and billing owner;
- `owner`;
- each entitled status, plus canceled, incomplete, incomplete_expired and paused;
- old rows with a null status;
- a member whose owner subscribed, is past_due, or cancelled;
- a deactivated member;
- a member during the owner's trial;
- a member whose owner's trial ended (with and without a name on file);
- an ownerless company;
- a support customer;
- the exact-timestamp flip and `days_left` rounding;
- grants, `search_path` and anon access;
- live functions unchanged;
- `check_trial_status` still works;
- the precheck matches the function;
- the data step and its rollback;
- `rollback.sql` restores the ACL exactly.

Not verified: anything on production beyond the read-only readings above.
