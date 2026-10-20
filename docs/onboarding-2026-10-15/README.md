# Ticketing onboarding package: revision 4, PREPARED, NOT APPLIED

Target when approved: production `gvftvswyrevummbvyhxa`. Nothing here is applied, deployed, sent or published. Email sending
stays off until a bounded delivery test is explicitly approved. Old queued emails are never drained.

Owner decisions recorded 2026-10-16: one seat allowance per paying owner; link-only emails; NG TELECOM to use its correct
organisation (inventory only, nothing moved); a labelled test company with three authorised test accounts; onboarding in its
own PR; exact auth callback URLs; existing Microsoft 365 / Supabase Auth email settings left untouched.

## Verified production state (read-only queries, 2026-10-16)

- Base ticketing is installed. The onboarding objects are not (no `org_*` RPCs, no `onboarding_email_outbox`, and
  `organization_invitations` has no `revoked_at` / `accepted_by`). 0 staff invitations.
- `support_email_outbox`: 1 pending acknowledgement from before sending was approved. No support/invitation sender is deployed.
- `platform_plans`: **0 rows**, so no seat limit can apply under any rule.
- `subscribers`: 7 rows, 6 marked subscribed (enterprise / professional / starter).
- 10 companies. 4 have no active owner (only an admin). One owner account owns 3 companies.
- The onboarding screens are already on `main`. Until the migration is applied they show "needs an approved database update".

## Billing owner and seats (revision 4)

**What exists on live (read-only, 2026-10-16):** there is no company → subscription link. `subscribers` is keyed by user only,
`organizations.subscription_tier` is `free` on all 10 companies, and `organizations.created_by` (never changes) records each
company's creator. In 6 companies the creator is still the active owner. In 4 the creator is only an admin, because the sign-up
trigger `handle_new_user` creates each new user's personal company with the creator as **admin** (unchanged here; see blockers).

**New schema (in `proposal.sql`, not applied):** `organization_billing(organization_id PK, billing_user_id, source, set_by, set_at, note)`.
Readable by that company's owners/admins; not writable through the API.

| Rule | How |
| --- | --- |
| Who pays for a company | Its row in `organization_billing`. Never inferred from roles or join dates. |
| Initial mapping | Seeded only where `created_by` is the active owner (6 companies, `source = seeded_creator_owner`). |
| New companies | When the company's creator is inserted as its first member (all four creation paths do this), the guard records them (`company_created`). Someone else joining first gets no billing row. |
| Changes / repairs | Only `platform_set_billing_owner(org, user, reason)`: platform super admins, target must be an active member, reason stored with who and when (`platform_admin`). |
| Ownership transfer | Changing roles never changes `organization_billing`, so the subscription and seat pool don't move silently. |
| Pool | All companies with the same `billing_user_id` share one allowance. Unique staff counted once; one reservation per pending email; support customers never count. |
| Caps | Off: `_seat_caps_enabled()` returns `false`. Turning it on needs a later approved migration, after the plan limits and complimentary-access decisions. |
| No billing owner (4 live companies) | Current members keep access. New invitations, adds and re-activations are refused ("ask B2BNEST support to repair"), until a super admin sets the billing owner. |
| Over limit (when caps are on later) | Nobody is removed. An invitation's own reservation lets its acceptance in, first come first served. A direct add or re-activation must fit beside all reservations. |

**One enforcement point:** `organization_members_guard` (BEFORE INSERT OR UPDATE on `organization_members`) runs for every route
that adds or re-activates staff: invitation acceptance, admins' direct API update of `is_active`, Edge Functions using the
service role, and the definer functions `create_team_with_owner`, `ensure_user_has_org`, `create_user_organization` and
`handle_new_user`. It takes the pool lock, then checks customer separation, billing owner and seats. Deactivations and role
changes of active members are never blocked. Direct INSERT is also revoked from `anon`/`authenticated`.

## Review items A–E

| Item | Status |
| --- | --- |
| A. Seats | As above. Tested: pooled counting, shared staff counted once, cross-company pending counted once, re-activation via admin API and server-side blocked when full, direct server-side add blocked, ownerless company blocked but existing access kept, authorised repair, ownership transfer not switching billing, creator-only bootstrap, Free fallback, over-limit with nobody removed, and two simultaneous adds with one free seat (exactly one succeeds). |
| B. Staff/customer | Per company. A customer of A can be staff of B. In the same company, converting requires removing customer access first. Members can only join through an invitation (direct inserts closed). |
| C. Notifications | Customer replies notify the assignee, or all agents plus owners/admins if unassigned. Customer reopen notifies staff. Staff replies notify the customer once. Private notes and files never reach customers. |
| C. Email content (decision 2) | Link-only: support name, ticket reference, event/status and a portal link that opens the right company and ticket. No reply text, notes or attachments. |
| D. Auth email | See [`AUTH-CALLBACKS.md`](AUTH-CALLBACKS.md): exact callback URLs, how intent survives sign-up and confirmation, and the dashboard check. The allow-list itself is **unverified** (not readable from here). |
| E. Release order | Below; each step is approved separately. |

## Email paths (decision 7): what exists, nothing changed

- **Supabase Auth email** (sign-up confirmation, password reset): configured in the Supabase dashboard. Not touched by this package.
- **Workflow email** `workflow-send-email` (deployed version matches the repo): uses `SMTP_*` (Microsoft 365, default
  `smtp.office365.com:587`) when set, otherwise falls back to `GMAIL_*`. You confirmed Microsoft 365 worked for
  `notifications@b2bnest.online`. No sends appear in the last 24 h of function logs, so I did not re-verify it.
- **Support and invitation senders** (this package, not deployed): reuse the same SMTP code but **only accept `SMTP_*`**.
  The Gmail fallback is refused before anything is sent. No new secrets.
- Older paths still hard-coded to Gmail (team invitation, task and contact-form email) are unchanged and out of scope.
- UI while sending is off: Members & roles shows "Email sending is switched off: nothing is emailed…". The customer email
  switch says no emails are sent yet. The staff reply box says the customer sees replies in the portal and gets no email.
  Invitation rows say "Invitation saved — email not sent".

## NG TELECOM (decision 3: separate organisation, Dev Team preserved). Prepared only, nothing done

- Today: no NG TELECOM organisation. "NG TELECOM" is only the support display name on Dev Team (`136792c5-1268-482f-ae83-b2da315403fd`),
  which holds 1 staff test ticket (`T-00001`) and 3 invited customers who have never signed in. Nothing is moved, renamed or re-invited.
- Normal authorised creation flow (the only one in the app): signed in as the intended NG TELECOM owner →
  Projects & tasks → Teams → **Create team** → name "NG TELECOM". This calls `create_team_with_owner`, which makes the caller
  owner and, with this package applied, records them as billing owner (verified on a local copy of the production schema).
- Then, in the new company: Support desk → Setup → support name "NG TELECOM", categories, portal on.
- Later steps, each only when you say so: invite the 3 customers in the new company. Then change Dev Team's support name back to
  something else, or revoke its 3 unused customer invitations. The test ticket stays in Dev Team.
- Do it after the migration, so the new company gets its billing owner the normal way (before it, the billing row would be
  seeded only if the creator is still owner at migration time).

## Files

| Item | Path |
| --- | --- |
| Migration (one transaction) | `proposal.sql` (sha256 `52955994f2d4bbee1bc5e28f580437c3ec146b7302a02a1ae0f5c5161e51c299`) |
| Export before rollback / Rollback | `export.sql` / `rollback.sql` (sha256 `ce4283aaa449bce48e46842a5daf40ce318f107bf1d72cc623f4eaacb261c76d`) |
| DB tests / runner | `test.sql`, `run-test.sh` (`PG_RUN_USER=postgres bash docs/onboarding-2026-10-15/run-test.sh`) |
| Senders | `supabase/functions/onboarding-email-sender/`, `supabase/functions/support-email-sender/` — in supabase/functions, not deployed (inert until `*_EMAIL_ENABLED=true`; see `docs/phase10-email-senders/README.md`) |
| Auth callbacks | `AUTH-CALLBACKS.md` |

## Old queued email (decision 6)

The migration cancels exactly one row, by id, and only if it is still pending: `support_email_outbox`
`a0ff58dd-c038-49ca-a212-e58bed67923e`. It's an `acknowledgement` ("we've received your ticket") for Dev Team's `T-00001`, queued
2026-10-15 01:32 UTC when Dev Team's owner raised a test ticket, addressed to that same owner. 0 attempts; it was never sent.
Why: the ticket is a resolved staff test, so sending it after approval would be a stale, misleading email. Any other queued
email, now or later, is left untouched for the sender-approval step. Rollback leaves this one cancelled.

## Release: PR #10 + PR #11 (decision 4)

- **Dependency:** the two PRs touch no files in common and merge cleanly. #11 does not need #10's code, but it does need #10 to
  build and test. `main` has no `vercel.json` and its lockfile is out of date: npm 10 crashes on install
  (reproduced here), and that's why the `b2bnest` Vercel build of #11 fails. #10 also fixes the 3 failing WorkflowStudio tests.
  **Release order: merge #10 first, then #11.**
- Exact combined tree tested: merge `dc2c17c` (branch `claude/release-10-11`, preview only, no PR). It has #10 at `beff226` and #11 at `7ce4736`.

| Check on the combined tree (2026-10-16) | Result |
| --- | --- |
| `npm ci` with npm 10.9.4 (Vercel's) | passes |
| `npm run build` | passes |
| `tsc -p tsconfig.app.json` | passes |
| `vitest run` (all) | **187/187 passed**; the 3 known failures are resolved |
| ESLint on changed source files | no new errors (2 files have fewer) |
| SQL on a production-shaped schema: baseline + 14 later migrations (incl. #10's two) + `proposal.sql` | all apply; smoke: `create_team_with_owner` and #10's `ensure_user_has_org` work through the guard and record the billing owner |
| `test.sql` (throwaway PG16, mirrored fixture) | 139/139, plus the concurrency check |
| Senders (Deno, mocked SMTP) | 11/11 and 6/6 (unchanged since rev 3) |

Not tested: real browser sessions, a real Supabase confirmation email, any real email.

## Release order (each step separately approved)

0. Merge PR #10, then PR #11 (code only; nothing in the database changes).
1. Run `export.sql`, then apply `proposal.sql` in one transaction. Check:
   `select to_regclass('public.onboarding_email_outbox'), has_table_privilege('authenticated','public.organization_members','INSERT')`
   → present, `false`.
2. Owner tests (below).
3. Approval to show the onboarding screens on the live site.
4. Sender approval: deploy both with sending off, then one bounded test to an address you name, then switch on.

## Owner test plan (decision 4; about 15 minutes; no support/invitation emails are sent)

Use a **new, clearly labelled test company**, e.g. "ZZ TEST – Onboarding (do not use)", created by you as owner, and three
authorised test accounts that are **not** any real customer address (in particular, not Dev Team's 3 invited customers):
**Owner**, **Colleague**, **Customer**. Real customer access is not touched. Run the sign-up step on the production site or
a Vercel preview, not the Lovable preview (see `AUTH-CALLBACKS.md`). Creating a Customer or Colleague account triggers one
Supabase Auth confirmation email to that test address. That's the existing Auth path, not the support sender.

1. Owner: Settings → Members & roles → invite Colleague as member. Expected: the email-off notice, "Invitation saved — email
   not sent", one row. Invite again: "already invited", still one row. The seat line counts 1 pending invitation, plus staff across every company you own (one allowance per paying owner).
2. Colleague (signed out) opens the copied link → create account → confirm → lands on `/join?token=…` → Accept → Members.
3. Owner: invite a dummy address, then revoke it. Its link says it's no longer valid.
4. Owner: Support desk → set up support for the test company → make Colleague an agent → invite Customer.
5. Customer opens the portal link signed out → create account → confirm → lands in the test company's portal →
   creates a ticket, then replies. Expected: Owner and Colleague each get one "Customer replied" notice.
6. Colleague replies. Expected: Customer gets one "Reply on…" notice, no extra status notice. Colleague adds a private note: the customer sees nothing.
7. Colleague closes the ticket. Customer reopens it. Expected: staff get "Customer reopened".
8. Afterwards: delete the test company, or keep it for regression tests.

## Rollback

Run `export.sql`, save the output privately, then `rollback.sql`. Colleagues who joined stay members (remove them manually if
wanted). The direct member INSERT grant is restored as before. Cancelled stale emails stay cancelled.
