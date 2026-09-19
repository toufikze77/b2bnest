# B2BNest — Safest Future Reconciliation Operations for B2BNEST, AI NEST, AINEST, NESTPRO TRADE, NG TELECOM LTD (2026-09)

**Design/review only. No production write is authorised by this document.** Evidence is drawn
entirely from existing repository artefacts; nothing new was executed against production.

---

## 1. Scope

Five historical `organization_id IS NULL` projects, and two entities that do not yet exist as
organisations:

| # | Project | State today | Operation required |
|---|---|---|---|
| 1 | B2BNEST | NULL org, owner single-membership | Assign to existing org (safe) |
| 2 | AI NEST | NULL org, owner single-membership | Assign to existing org (safe) |
| 3 | AINEST | NULL org, owner multi-membership | HELD — no safe automatic assignment |
| 4 | NESTPRO TRADE (future) | NULL org, no evidence, target org doesn't exist | Blocked on (a) org creation approval, (b) owner mapping |
| 5 | NG TELECOM LTD (future) | NULL org, 6 tasks stamped to wrong org (Dev Team), target org doesn't exist | Blocked on (a) org creation approval, (b) six-task re-stamp |

Sources: `docs/wave1-historical-project-reconciliation-2026-09.md`,
`docs/wave1-historical-project-reconciliation-decisions-2026-09.md`,
`docs/organization-wave1-final-blocker-remediation-2026-09.md`,
`docs/organization-wave1-production-preflight-2026-09.md`,
`docs/organization-wave1-staging-validation-2026-09.md`,
`supabase/remediation/organization-wave1-historical-reconciliation-2026-09.sql`,
`supabase/remediation/organization-wave1-2026-09-rollback.sql`.

---

## 2. Evidence base (already produced, all read-only)

- **Row-level evidence** (`wave1-historical-project-reconciliation-2026-09.md` §1-3): exact
  project IDs, owners, task counts, and per-project evidence class (STRONG / WEAK / NO EVIDENCE).
- **Organisation inventory & classification** (`…-decisions-2026-09.md` §3): confirms no
  organisation named "NESTPRO TRADE" or "NG TELECOM" exists in production today — both must be
  *created*, not merely *assigned to*.
- **Child-record fan-out** (`…-decisions-2026-09.md` §5-6): shows exactly what a reconciliation
  UPDATE would touch — 6/1/5/0/6 tasks respectively, zero members/time-entries/activities/shares
  anywhere, so blast radius is `projects` + `todos` only.
- **Package review** (`wave1-historical-project-reconciliation-2026-09.md` §7): a line-by-line PASS
  table showing the prepared SQL only updates supplied mappings, validates membership, never
  overwrites, is transactional, and fails closed.
- **Wave 1 schema/RLS package + rollback validated in isolated staging**
  (`organization-wave1-production-preflight-2026-09.md` §24-25): rollback fingerprint-identical to
  pre-Wave-1 state; only intentional drift is that `anon` DML grants stay revoked.
- **Security regression baseline**: 574–657 PASS / 0 FAIL across staging runs
  (`organization-wave1-staging-validation-2026-09.md`, `organization-wave1-final-blocker-remediation-2026-09.md`).

This is enough evidence to design the *operations*; it is **not** enough evidence to execute any
of them, because 3 of the 5 items still require a named human decision or a not-yet-created org.

---

## 3. Per-entity safest operation design

### 3.1 B2BNEST → toufik zemri's Organization (`d2d372cd…`)
- Evidence class: STRONG (sole active membership + all 6 child tasks already stamped consistently).
- Operation: single-row insert into `wave1_approved_assignments`, run the existing reconciliation
  template, `COMMIT` only after Step 8's self-verification passes.
- Fail-closed checks already present: target row must be NULL (no overwrite), owner must be an
  active member of the chosen org, no child task may contradict the choice.
- Rollback: journal-free for this write path — capture pre-image via `SELECT id, organization_id
  FROM projects WHERE id = 'cb4c260b…'` and the 6 task ids before running; a one-line `UPDATE …
  SET organization_id = NULL WHERE id = …` restores state if needed (safe because nothing else
  will have referenced the now-visible project in the interim window if applied in a single
  transaction with no other concurrent writers).
- Readiness: **safe to execute once a named approver signs the mapping** — no code or schema
  change required beyond the already-validated Wave 1 package being live.

### 3.2 AI NEST → toufik zemri's Organization (`d2d372cd…`)
- Identical evidence class and mechanics to B2BNEST (STRONG, 1 task already consistent).
- Same operation, same fail-closed checks, same rollback shape.
- Readiness: **safe to execute once approved**, same precondition as 3.1.

### 3.3 AINEST → HELD, no operation authorised
- Evidence class: WEAK. Owner has 3 memberships; the only signal is that 5 tasks share one
  `organization_id`, but that value was stamped *after the fact* and is not an independent
  authority (`wave1-historical-project-reconciliation-2026-09.md` §3, `…-decisions-2026-09.md` §4).
  Task content ("Fix email support in B2BN", "Create Docusign") reads as legacy B2BNest platform
  work, not an "AI NEST" product backlog — i.e. the project name itself is unreliable evidence.
- Safest operation: **do not assign**. Any assignment here would be a guess dressed as a migration.
  The reconciliation script's Step 4 membership check would pass for any of the 3 candidate orgs,
  so the script *cannot* fail closed against a wrong-but-plausible human choice — this is a decision
  risk, not a technical one, and must stay a named, dated, attributable decision recorded in
  `approved_by`.
- Fail-closed check to add before this is ever run: require the approver to also state which of
  the 3 memberships was chosen and why (freeform in `approved_by`, already a mandatory NOT NULL
  column), and diff the task titles against the target org's other work before commit, as a human
  sanity check — not automatable safely.

### 3.4 NESTPRO TRADE — two-stage operation, currently blocked
NESTPRO TRADE has **zero** child evidence (0 tasks, 0 members, 0 of anything). It cannot be
reconciled to an *existing* org; the review already establishes no organisation of that name
exists (`…-decisions-2026-09.md` §1, §7).

Safest sequencing:
1. **Org creation** (separate, explicit approval): create organisation "NESTPRO TRADE" through the
   normal application creation path (not a raw INSERT) so that `organization_members` gets a
   proper owner row, matching the same trust boundary the app already enforces via
   `assertActiveOrganization()` (`organization-wave1-final-blocker-remediation-2026-09.md` §4).
2. **Project assignment**: once the org exists and the current project owner (`3eac00c6…`) is
   confirmed as an active member of it, run the identical reconciliation template used for
   B2BNEST/AI NEST. Step 4 (owner-must-be-member) will only pass after step 1 is done — this *is*
   the fail-closed gate that prevents assigning an org the owner doesn't belong to.
3. No child-task re-stamp is needed (0 tasks).
- Readiness: **not ready**. Blocked on org-creation approval and, since there is no evidence at
  all, a human must also independently confirm this project is legitimately "NESTPRO TRADE" and
  not an abandoned test project — the `…-decisions-2026-09.md` §7 table already flags this as
  "NO EVIDENCE / requires new organisation / NOT SAFE".

### 3.5 NG TELECOM LTD — org creation + six-task re-stamp, currently blocked
This is the highest-risk item because, unlike NESTPRO TRADE, it has *misleading* existing evidence:
6 tasks are already stamped to `136792c5…` (Dev Team), which the owner has explicitly rejected as
the target (`…-decisions-2026-09.md` §6-7: "Dev Team rejected by owner… Requires new organisation").

Safest sequencing:
1. **Org creation**: create "NG TELECOM LTD" the same way as NESTPRO TRADE (application path, not
   raw SQL), with the current project owner (`3eac00c6…`) as owner/member.
2. **Project assignment**: this is where the existing reconciliation template's Step 5 guard
   ("approved org must not contradict existing child-task evidence") will **abort by design**,
   because the 6 tasks already carry `136792c5…` (Dev Team) while the parent project is being
   moved to the new "NG TELECOM LTD" org — exactly the `MISMATCH` case documented in
   `…-decisions-2026-09.md` §6: *"The script would report 6 MISMATCH rows and would not silently
   rewrite them. A task re-stamp step must be authorised separately."*
3. **Six-task re-stamp (separate, explicitly authorised step)**: only after (1) and (2) are
   approved and complete, run a second, narrowly-scoped statement that re-stamps exactly the 6
   `todos` rows whose `project_id = '271ce96c…'` from `136792c5…` to the new NG TELECOM LTD org id,
   and *only* those rows — joined on `project_id`, not on the old organisation value, so it cannot
   touch any other Dev Team task. This must:
   - run in the same transaction as, or immediately after, the project UPDATE (never before —
     otherwise tasks briefly point to an org the project doesn't belong to);
   - assert `count(*) = 6` before and after (fail if the count differs — indicates a task was
     added/removed/moved concurrently since the investigation);
   - write a journal row per task (old org, new org, task id, approver, timestamp) modelled on
     the existing `wave1_backfill_journal` pattern (`organization-wave1-production-preflight-2026-09.md`
     §1, §20) so the six-task re-stamp is exactly reversible;
   - re-verify parent/child consistency afterwards using the same check Wave 1 already enforces at
     the RLS/trigger layer (`todos.organization_id` must equal `projects.organization_id`,
     `…-preflight-2026-09.md` §11) — if the trigger is live, this re-verification is actually
     redundant-but-safe defence in depth, since the trigger would reject a mismatched write outright.
- Readiness: **not ready**. Two independent approvals required (org creation, then the six-task
  re-stamp), plus the org-creation step must complete and be verified before the re-stamp step is
  even attempted — attempting them out of order is the main risk this design guards against.

---

## 4. Fail-closed checks required across all five operations

All already implemented in the reviewed template and reusable for every case above
(`organization-wave1-historical-reconciliation-2026-09.sql` — see PASS table in
`wave1-historical-project-reconciliation-2026-09.md` §7):

1. Zero approved rows ⇒ abort, nothing runs (no default/guessed path exists).
2. Target project's `organization_id` must still be NULL — never overwrite a resolved tenant.
3. Approved project id must exist.
4. Project owner must be an **active** member of the approved organisation — this is the specific
   gate that keeps NESTPRO TRADE/NG TELECOM LTD blocked until their orgs exist and have the right
   owner enrolled.
5. Approved organisation must not contradict existing child-task evidence — this is the gate that
   correctly stops NG TELECOM LTD's project reassignment and forces the six-task re-stamp to be a
   distinct, explicitly authorised step rather than an implicit side effect.
6. Post-write self-verification (Step 8) — re-reads and raises if any assigned row, or any child
   task, doesn't match what was approved.
7. Whole operation transactional, defaults to `rollback` — an operator must deliberately change
   `rollback` to `commit`, which is itself a fail-closed control against accidental execution.

**Additional check to add before the six-task re-stamp is ever authorised** (not yet in the
existing template, because the template assumes children only get filled when NULL, never
re-pointed): an explicit `UPDATE … WHERE t.organization_id = '<old_org>' AND t.project_id =
'<project>'` guard plus a hard row-count assertion (`= 6`), since re-pointing already-non-NULL
children is a materially different and riskier operation than the NULL-fill path Wave 1 was
originally built for, and deserves its own reviewed script rather than reuse of the existing one
as-is.

---

## 5. Rollback / backup readiness

- **Schema/RLS/trigger layer (Wave 1 package)**: rollback script exists
  (`supabase/remediation/organization-wave1-2026-09-rollback.sql`), validated fingerprint-identical
  to pre-Wave-1 state in an isolated staging cluster
  (`organization-wave1-production-preflight-2026-09.md` §24-25); reverts only journalled values,
  deletes no business row, and deliberately does not restore the removed `anon` DML grants
  (security-positive drift, documented and intentional).
- **Historical reconciliation UPDATEs (B2BNEST/AI NEST/AINEST/NESTPRO TRADE)**: the template
  itself ends in `rollback` by default (§2 above) and is only 2 tables (`projects`, `todos`) with
  a handful of rows each — pre-image capture is trivial (project id + org id, task ids + org ids)
  and documented above per-entity.
- **NG TELECOM LTD six-task re-stamp**: needs its own dedicated journal (not yet written as code —
  design only, §3.5/§4) modelled on `wave1_backfill_journal`, so this specific step is not yet at
  the same readiness level as the other four; it should not be executed until that journal-backed
  script exists and has been staged-tested the same way the Wave 1 package was (574-657 PASS / 0
  FAIL regression, rollback fingerprint compare).
- **General backup plan** (`organization-wave1-production-preflight-2026-09.md` §26): full platform
  snapshot, targeted CSV export of `id`/ownership/`organization_id` for the affected tables, and a
  `pg_policies`/`pg_proc`/`pg_trigger`/`pg_constraint`/`pg_indexes`/grants capture — sufficient to
  reconstruct exact prior state, but explicitly **not executed** yet.

---

## 6. Current readiness summary

| Entity | Org exists? | Evidence | Fail-closed template ready? | Rollback ready? | Blocking on |
|---|---|---|---|---|---|
| B2BNEST | YES | STRONG | YES (reused as-is) | YES (trivial pre-image) | Named human approval only |
| AI NEST | YES | STRONG | YES (reused as-is) | YES (trivial pre-image) | Named human approval only |
| AINEST | YES (3 candidates) | WEAK | YES, but cannot fail-close against a *wrong plausible* choice | YES (trivial pre-image) | Human decision on which of 3 orgs, or leave HELD |
| NESTPRO TRADE | **NO** | NONE | Reusable only after org exists | YES (0 children, trivial) | Org-creation approval, then owner mapping |
| NG TELECOM LTD | **NO** | Misleading (6 tasks stamped to rejected org) | Project step reusable; **six-task re-stamp step not yet built/tested** | Project step trivial; re-stamp needs new journal (not yet built) | Org-creation approval, then a dedicated, staged-and-tested re-stamp script |

```
ENTITIES READY FOR SAFE EXECUTION (pending approval only): B2BNEST, AI NEST
ENTITIES REQUIRING A HUMAN JUDGEMENT CALL BEFORE ANY WRITE: AINEST
ENTITIES REQUIRING NEW ORGANISATION CREATION FIRST: NESTPRO TRADE, NG TELECOM LTD
NEW CODE/SCRIPT STILL REQUIRED: six-task re-stamp for NG TELECOM LTD (journal-backed, staged, tested)
PRODUCTION CHANGES MADE BY THIS REVIEW: NONE
DEPLOYMENT/EXECUTION AUTHORISED BY THIS DOCUMENT: NO
```
