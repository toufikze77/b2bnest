# Marketing planning workspace — release report (APPLIED to live gvftvswyrevummbvyhxa, 2026-10-14 21:4x UTC, owner-approved)

- Migration: `proposal.sql` (r2) · Export before rollback: `export.sql` · Rollback: `rollback.sql`
- Test: `test.sql` + concurrency check in `run-test.sh` (disposable local Postgres, deleted afterwards) — 28/28 PASS.

## Task-link security review (r2)
- Live task rule read 2026-10-14 (`todos_org_select`): a task is visible if it is in a company where you are an
  active member, or it is your own personal task (or you are a super admin). There is **no restricted-project
  rule for tasks** in the live schema: `project_id` and `project_members` do not limit task visibility.
  So company membership is the authoritative rule; the r1 check was not wider than live, but it duplicated it.
- r2 fix: the guard now runs with the caller's own rights and checks "can you see this task?" through the live
  rule itself — no copied logic, so it can't drift. Helper used by live: `user_is_organization_member(org_id, check_user_id)`, active members only.
- Revocation: once membership is turned off, linked company tasks disappear from the Marketing screen (task
  details are read through the live rule); the planned-content row stays with its own title; relinking and
  creating tasks in that company are refused.

## Results
| Check | Result |
|---|---|
| Own personal task / company task (member) | allowed |
| Project task in same company, not a project member | allowed — same as live task rule (no restricted projects exist) |
| Another company's task / another user's personal task | rejected |
| After membership revoked: task hidden, relink refused, create refused | PASS |
| Anonymous access to all 3 tables and the create-task action | refused (explicit REVOKE; 0 anon privileges even with default grants) |
| "Create task" retry and two simultaneous calls | exactly 1 task, same id returned |
| Injected failure during application | nothing left behind (single transaction) |
| Export then rollback | export holds every row; rollback removes only marketing tables/functions |

## Rollback
Run `export.sql` first and save the JSON; then `rollback.sql`. Deletes saved audiences, campaigns, planned content.
Tasks created from planned content remain. Test caveat: existing tables were stand-ins with live columns, policies and helpers copied verbatim.
