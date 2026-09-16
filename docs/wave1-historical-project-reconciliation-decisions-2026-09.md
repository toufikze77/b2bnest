# Wave 1 — Historical Project Reconciliation (Owner Decisions Applied, READ-ONLY)

Date: 2026-09-12
Production writes made: **NO** (all queries read-only; reconciliation script NOT executed)

## 1. Does a "NESTPRO TRADE" organization exist?

**NO.** No organization row matches `%nestpro%`.

## 2. Does "NG TELECOM LTD" / "NG TELECOM" exist?

**NO.** No organization row matches `%ng telecom%` or `%telecom%`.

## 3. Organization inventory / classification

| Organization | ID (short) | Created | Created by (short) | Members | Projects | Classification |
|---|---|---|---|---|---|---|
| admin@example.com's Organization | 69fd39aa | 2025-09-01 | 3eac00c6 | 1 | 2 (`B2BNEST`, `Test epic`) | **Legacy artifact** — auto-generated from a placeholder/default email at first signup. Holds real historical data (AINEST tasks) so it cannot simply be deleted. |
| Toufik Zemri's Organization | 7cc67f87 | 2025-10-02 | 51c32184 | 1 | 0 | Auto-created default org, empty. |
| toufik zemri's Organization | d2d372cd | 2025-10-02 | 66a8af46 | 1 | 0 (2 pending) | **Production** — active owner account, holds B2BNEST/AI NEST task rows. |
| Toufik Zemri's Organization | 6a269cba | 2025-10-02 | 4898a58c | 1 | 0 | Auto-created default org, empty. |
| bayken net's Organization | 11067c68 | 2025-11-12 | 961f28f6 | 1 | 0 | Auto-created default org, empty. |
| Dev Team | 136792c5 | 2026-06-06 | 3eac00c6 | 1 | 9 | **Production working org** — holds template-applied projects, CRM boards and all NG TELECOM tasks. |
| Admin | d6f6fd55 | 2026-06-06 | 3eac00c6 | 1 | 0 | **Test/demo** — manually created, no projects, no tasks, no members beyond owner. |

None of these are named for a specific trading/telecom business; every org is either an auto-generated default ("X's Organization") or an internal label ("Dev Team", "Admin").

## 4. AINEST — exact relationships / evidence

- Project `b7ac8fb5` "AINEST", created 2025-10-17, owner `3eac00c6`, no description.
- 5 tasks, all stamped `organization_id = 69fd39aa` (admin@example.com's Organization), spanning 2025-10-24 → 2025-12-15.
- Task titles: "NOTE Tool Free)", "Create Docusign", "Fix email support in B2BN", "Sign-up information request", "test notification 1" — these are **B2BNest platform work items**, not an "AI NEST" product backlog.
- Project `499fdffe` "AI NEST" is a **different** project: different owner (`66a8af46`), created 2025-10-02, description `ainest.online`, 1 task ("Integrate sign in setup") stamped to `d2d372cd`.
- No project members, time entries, activities or share logs on either project.

**Conclusion:** AINEST is **not** the same project as AI NEST (different owner, different org lineage, unrelated task content). It reads as an internally-named board used for early B2BNest platform tasks under the legacy `admin@example.com` org. It contains at least one explicit test row ("test notification 1") but is not purely a test project. Ownership remains **owner decision required** — no automatic assignment.

## 5. Child record counts per project

| Project | Tasks | Tasks with dates (calendar-visible) | Members | Time entries | Activities | Shares |
|---|---|---|---|---|---|---|
| B2BNEST (`cb4c260b`) | 6 | 5 | 0 | 0 | 0 | 0 |
| AI NEST (`499fdffe`) | 1 | 1 | 0 | 0 | 0 | 0 |
| AINEST (`b7ac8fb5`) | 5 | 5 | 0 | 0 | 0 | 0 |
| NESTPRO TRADE (`d13672f8`) | 0 | 0 | 0 | 0 | 0 | 0 |
| NG TELECOM (`271ce96c`) | 6 | 6 | 0 | 0 | 0 | 0 |

There is no separate calendar table; calendar views are driven by task due dates.

## 6. What child records would inherit after assignment

The reconciliation script only fills **NULL** organization values on children and flags contradictions as `MISMATCH` (it never overwrites an existing value).

| Project | Chosen org | Current child org stamp | Effect on children |
|---|---|---|---|
| B2BNEST | toufik zemri's Organization (`d2d372cd`) | all 6 already `d2d372cd` | No change — already consistent. |
| AI NEST | toufik zemri's Organization (`d2d372cd`) | 1 task already `d2d372cd` | No change — already consistent. |
| AINEST | NOT ASSIGNED | 5 tasks on `69fd39aa` | Nothing happens; project stays NULL and stays invisible under org-scoped views. |
| NESTPRO TRADE | new dedicated org (does not exist) | no children | Nothing to cascade. |
| NG TELECOM | new dedicated "NG TELECOM LTD" org (does not exist) | 6 tasks on `136792c5` (Dev Team) | **Would create a project↔task mismatch.** The script would report 6 `MISMATCH` rows and would not silently rewrite them. A task re-stamp step must be authorised separately. |

## 7. Revised reconciliation table

| PROJECT | CURRENT OWNER | CANDIDATE ORGANIZATIONS | EVIDENCE | CHOSEN ORGANIZATION | CHILD RECORDS | SAFE TO ASSIGN |
|---|---|---|---|---|---|---|
| B2BNEST | 66a8af46 | toufik zemri's Organization (sole membership) | STRONG — sole active membership + all 6 tasks already stamped to it | toufik zemri's Organization (`d2d372cd`) | 6 | **YES** |
| AI NEST | 66a8af46 | toufik zemri's Organization (sole membership) | STRONG — sole active membership + its 1 task already stamped to it | toufik zemri's Organization (`d2d372cd`) | 1 | **YES** |
| AINEST | 3eac00c6 | admin@example.com's Org / Dev Team / Admin | WEAK — only task stamps point to the legacy org; task content is B2BNest platform work, not an AI NEST product | HELD — do not assign | 5 | **NO** |
| NESTPRO TRADE | 3eac00c6 | none suitable (target org does not exist) | NONE — zero tasks, zero related records | Requires new "NESTPRO TRADE" organization | 0 | **NO** (blocked on org creation approval) |
| NG TELECOM | 3eac00c6 | none suitable (target org does not exist); Dev Team rejected by owner | Task content is genuine NG Telecom work, but tasks are stamped to Dev Team | Requires new "NG TELECOM LTD" organization | 6 | **NO** (blocked on org creation + task re-stamp approval) |

## 8. Status

```
UNRESOLVED PROJECTS: 3 (AINEST, NESTPRO TRADE, NG TELECOM)
READY TO ASSIGN: 2 (B2BNEST, AI NEST)
NEW ORGANIZATIONS REQUIRED: 2 (NESTPRO TRADE, NG TELECOM LTD)
AUTOMATIC ASSIGNMENT SAFE: NO
USER DECISION REQUIRED: YES
PRODUCTION CHANGES MADE: NO
WAVE 1 DEPLOYMENT AUTHORIZED: NO
```
