# B2BNest — Wave 1 Historical Project Reconciliation (2026-09)

Read-only investigation. **No production row, schema, policy or deployment was changed.**
The reconciliation script was reviewed only; it was **not executed**.

---

## Step 1 — The 5 unresolved projects

| # | Project ID | Name | Created | Owner (user id) | organization_id | Tasks | Members / time entries / activities / shares |
|---|---|---|---|---|---|---|---|
| 1 | cb4c260b-4905-433c-9563-9f381ea3912d | B2BNEST | 2025-10-02 | 66a8af46… | NULL | 6 | 0 / 0 / 0 / 0 |
| 2 | 499fdffe-5741-4984-99c5-8b654f82d555 | AI NEST | 2025-10-02 | 66a8af46… | NULL | 1 | 0 / 0 / 0 / 0 |
| 3 | b7ac8fb5-09b0-438b-8cfa-042e3f024b1a | AINEST | 2025-10-17 | 3eac00c6… | NULL | 5 | 0 / 0 / 0 / 0 |
| 4 | d13672f8-f5f4-4e2a-a4e1-35df0cf0ff32 | NESTPRO TRADE | 2026-05-27 | 3eac00c6… | NULL | 0 | 0 / 0 / 0 / 0 |
| 5 | 271ce96c-2341-4f9b-a9db-96d3ad54a9ec | NG TELECOM | 2026-07-08 | 3eac00c6… | NULL | 6 | 0 / 0 / 0 / 0 |

No calendar, project-member, time-entry, activity or share records exist for any of them.
Owner identifiers are truncated; no email or profile PII is reproduced here.

## Step 2 — Candidate organisations per owner

Owner `66a8af46…` — single membership (projects 1, 2):

| Organization ID | Name | Role | Status |
|---|---|---|---|
| d2d372cd-a0fb-4ff9-9918-c2ffdd823242 | toufik zemri's Organization | owner | active |

Owner `3eac00c6…` — three memberships (projects 3, 4, 5):

| Organization ID | Name | Role | Status |
|---|---|---|---|
| 69fd39aa-6631-4401-be7c-8116bd475789 | admin@example.com's Organization | owner | active |
| 136792c5-1268-482f-ae83-b2da315403fd | Dev Team | owner | active |
| d6f6fd55-dfb7-45b4-8af3-d6dbf9c1adcb | Admin | owner | active |

## Step 3 — Evidence

| Project | Evidence class | Detail |
|---|---|---|
| B2BNEST | STRONG | Owner has exactly one active membership (d2d372cd…); all 6 child tasks already carry d2d372cd… — one distinct value, no contradiction. |
| AI NEST | STRONG | Same single membership; the single child task carries d2d372cd…. |
| AINEST | WEAK | Owner belongs to 3 organisations. All 5 child tasks carry 69fd39aa… (single distinct value), but task organisation was itself stamped later and is not an independent authority. |
| NESTPRO TRADE | NO EVIDENCE | No tasks, no members, no related records of any kind. |
| NG TELECOM | WEAK | All 6 child tasks carry 136792c5… (Dev Team), single distinct value; same caveat as AINEST. |

No deterministic parent relationship (team, CRM, invoice, calendar) links any of the five projects to an organisation.

## Step 4 — Recommendations (advisory only)

| Project | Recommended organisation | Confidence | Reason |
|---|---|---|---|
| B2BNEST | toufik zemri's Organization | HIGH | Sole membership of the owner plus consistent child-task evidence. |
| AI NEST | toufik zemri's Organization | HIGH | Same as above. |
| AINEST | admin@example.com's Organization | MEDIUM | Only child-task evidence; owner has two other organisations. |
| NESTPRO TRADE | NONE | — | No evidence of any kind; must be chosen by a human. |
| NG TELECOM | Dev Team | MEDIUM | Only child-task evidence; owner has two other organisations. |

Nothing above was written anywhere. Even the HIGH rows require explicit approval.

## Step 5 — Decision table

```text
# | PROJECT        | CANDIDATE COMPANIES                                  | RECOMMENDATION                        | USER CHOICE
1 | B2BNEST        | toufik zemri's Organization                          | toufik zemri's Organization (HIGH)    | ______
2 | AI NEST        | toufik zemri's Organization                          | toufik zemri's Organization (HIGH)    | ______
3 | AINEST         | admin@example.com's Organization / Dev Team / Admin  | admin@example.com's Org (MEDIUM)      | ______
4 | NESTPRO TRADE  | admin@example.com's Organization / Dev Team / Admin  | NONE                                  | ______
5 | NG TELECOM     | admin@example.com's Organization / Dev Team / Admin  | Dev Team (MEDIUM)                     | ______
```

## Step 6 — How to reply

Plain text, one line per project, company names exactly as listed above:

```text
B2BNEST -> toufik zemri's Organization
AI NEST -> toufik zemri's Organization
AINEST -> admin@example.com's Organization
NESTPRO TRADE -> Dev Team
NG TELECOM -> Dev Team
```

No SQL is required. A project may be left out; it then stays unassigned.

## Step 7 — Review of the prepared reconciliation script

`supabase/remediation/organization-wave1-historical-reconciliation-2026-09.sql` — read-only review, not executed.

| Requirement | Result | Where |
|---|---|---|
| Only the specified project rows are updated | PASS | `update public.projects … from wave1_approved_assignments a where p.id = a.project_id` |
| Only explicitly supplied mappings are applied | PASS | rows must be inserted into `wave1_approved_assignments` by hand; template ships them commented out |
| Membership legitimacy validated | PASS | Step 4 aborts unless the project owner is an active member of the approved organisation |
| Unrelated projects untouched | PASS | every statement joins on the approved-assignments table |
| Never overwrites a valid organization_id | PASS | Step 2 aborts if any target is non-NULL; update also guards `p.organization_id is null` |
| Transactional | PASS | opens with `begin;` and ends with `rollback;` (operator must change it to `commit`) |
| Fails closed | PASS | zero approved rows raises `ABORT`; each of steps 2–5 raises on violation |
| Task/calendar consistency | PASS | Step 5 aborts if a child task contradicts the approved organisation; Step 7 stamps child tasks strictly from the parent; Step 8 re-verifies both |
| Rollback / backup path | PASS | script ends in `rollback`, so a dry run changes nothing; Wave 1 rollback package `organization-wave1-2026-09-rollback.sql` remains validated |

Residual note: the script assigns child tasks only where `t.organization_id is null`, which is correct — the 11 existing tasks under the ambiguous projects already carry values, and Step 5 guarantees those values match the approved choice.

---

UNRESOLVED PROJECTS: 5
AUTOMATIC ASSIGNMENT SAFE: NO
USER DECISION REQUIRED: YES
PRODUCTION CHANGES MADE: NO
WAVE 1 DEPLOYMENT AUTHORIZED: NO
