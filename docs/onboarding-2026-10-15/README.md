# Ticketing onboarding package: revision 3, PREPARED, NOT APPLIED

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

## Seats: one allowance per paying owner (decision 1)

| Rule | Implementation (`_seat_pool`, `_org_billing_owner`, `_seat_already_counted`) |
| --- | --- |
| Who owns the subscription for a company | Its **billing owner**: the earliest-joined active member with role `owner`. Live has no company with two active owners. |
| Which companies share the allowance | Every company whose billing owner is the same account (the "pool"). |
| Limit | Billing owner's `subscribers` row with `subscribed = true` → that plan's `platform_plans.member_limit`. |
| Free | Not subscribed → the `free` plan's `member_limit`. |
| No stored limit | No cap (`basis = …:no_limit_configured`). **This is every account today**, since `platform_plans` is empty. |
| Company with no active owner | Not attributable → no cap, reported as `no_owner` (4 live companies). Needs an owner before limits mean anything. |
| Who uses a seat | Unique active staff accounts across the pool: one person in 3 companies uses 1 seat. Support customers never use seats. |
| Pending invitations | Reserve one seat per unique email across the pool, only if that person isn't already counted staff. |
| No double-counting | Accepting turns the reservation into the seat (pending −1, used +1). Inviting someone already counted, or already invited in another pooled company, needs no new seat. |
| Concurrency | Every invitation and acceptance in a pool takes the same pool lock, so concurrent requests can't exceed the cap. |
| Over-limit accounts | Nobody is removed. New invitations are refused while staff + pending ≥ limit, and acceptances while staff ≥ limit. Removing someone frees a seat. |
| Complimentary accounts | No complimentary-entitlement table exists. Accounts that were given Enterprise during test-key use resolve through their current `subscribers` row like anyone else. **Decision still needed** (from the billing backlog) before limits are activated. |
| Activation | Not part of this package. It needs plan limits stored, the complimentary decision, and one more guard: today an admin can re-activate a deactivated member (UPDATE `is_active`) without a seat check. |

## Review items A–E

| Item | Status |
| --- | --- |
| A. Seats | As above. Tested: pooled counting across 2 companies, shared staff counted once, cross-company pending counted once, already-counted invitee allowed at a full pool, customers excluded, no-owner company, Free fallback, over-limit refusal with nobody removed. |
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

## NG TELECOM (decision 3): inventory only, nothing moved or renamed

- There is **no organisation named NG TELECOM**. "NG TELECOM" is only the support display name configured on
  **Dev Team** (`136792c5-1268-482f-ae83-b2da315403fd`).
- Support data owned by Dev Team: 1 ticket (`T-00001`, resolved, raised by Dev Team's own owner, so a staff test with
  0 messages and 0 files); 3 invited customers (domains ngtelecom.co.uk, outlook.com, gmail.com; none has signed in); 0 agents.
- Other organisations (id prefix · name · active roles · tickets): `69fd39aa` admin@example.com's Organization (owner, 0);
  `d6f6fd55` Admin (owner, 0); `6a269cba` Toufik Zemri's Organization (owner+member, 0); `7cc67f87` Toufik Zemri's
  Organization (owner, 0); `d2d372cd` toufik zemri's Organization (owner, 0); `ab413f58` Toufik Zemri's Organization
  (admin only, 0); `11067c68` bayken net's Organization (suspended, admin only, 0); `06875fdf` Adam Zemri's Organization
  (admin only, 0); `f9a9309d` CHIWA COIN's Organization (admin only, 0). Full ids are in the query output, available on request.
- **Proposal, awaiting your choice:** either (a) create a proper "NG TELECOM" organisation and set up support there,
  re-inviting the 3 customers (nothing to migrate except the test ticket), or (b) rename Dev Team. Nothing will be changed
  until you pick one.

## Files

| Item | Path |
| --- | --- |
| Migration (one transaction) | `proposal.sql` (sha256 `f19d7ce6f03f15fa2f656c8db778d31ae3cc097a91972f038ff843b0805db55d`) |
| Export before rollback / Rollback | `export.sql` / `rollback.sql` (sha256 `f3b407ba4e00a9de378c6c45b74737c6b961057a8df1a2b96400aecc655c695a`) |
| DB tests / runner | `test.sql`, `run-test.sh` (`PG_RUN_USER=postgres bash docs/onboarding-2026-10-15/run-test.sh`) |
| Senders | `functions/onboarding-email-sender/`, `functions/support-email-sender/` (inert until `*_EMAIL_ENABLED=true`) |
| Auth callbacks | `AUTH-CALLBACKS.md` |

## Tests run on 2026-10-16

| Suite | Where | Result |
| --- | --- | --- |
| `test.sql` (120 checks) | Throwaway local PostgreSQL 16, mirrored fixture; **not** production | 120 passed |
| Support sender | Deno 2, mocked SMTP (the `deno.land` asserts import mapped to a `node:assert` shim; deno.land is blocked here) | 11 passed |
| Invitation sender | Same | 6 passed |
| App unit tests (`vitest`) | jsdom, mocked Supabase | 174 passed, 3 failed. The 3 are WorkflowStudio tests that fail on `main` too; they're fixed in the audit PR. |

Not tested: signed-in screens in a browser, a real Supabase Auth confirmation email, and any real email send.

## Release order (each step separately approved)

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
