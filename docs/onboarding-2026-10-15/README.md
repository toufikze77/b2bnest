# Ticketing onboarding package: revision 2, PREPARED, NOT APPLIED

Target when approved: production `gvftvswyrevummbvyhxa`. Nothing here is applied, deployed, sent or published.

## Verified state on 2026-10-16

These come from read-only queries on production, not from earlier reports.

- Base ticketing is installed (`support_*` tables and functions). The onboarding objects are **not**: no `org_*` RPCs,
  no `onboarding_email_outbox`, and `organization_invitations` has no `revoked_at` / `accepted_by` columns.
- `organization_invitations` has 0 rows, `support_customers` 3, `support_tickets` 1.
- `support_email_outbox` holds **1 pending acknowledgement** from before sending was approved. No sender is deployed.
- `platform_plans` has **0 rows**, so no seat limit can apply. 10 companies; the largest has 2 active members;
  one account owns 3 companies.
- The onboarding screens are already on `main` (Lovable commit "Implemented onboarding flow"). Until this migration is
  applied they show "needs an approved database update" instead of failing, so publishing `main` does not break them.

## Review items A–E

| Item | Status after revision 2 |
| --- | --- |
| **A. Seats** | Only live pending invitations count. Accepting does not count its own seat twice. Invite and accept take the same per-company lock, so concurrent requests can't exceed a cap. No members are ever removed. No limits are active (the plans table is empty). **Decision needed, see below**: the allowance is currently applied *per company*, so an owner with 3 companies would get the full allowance in each. Direct member inserts are now closed, so the only way in is an invitation (and its seat check). |
| **B. Staff/customer** | Checked per company. A customer of company A can be staff of company B. In the same company, staff can't be invited as customers (the claim skips them) and customers can't be invited or accepted as staff until their customer access is removed (an explicit action). There is no platform-wide ban. |
| **C. Notifications** | Fixed in revision 2. Staff replies notify the customer (in-app plus a queued email). Customer replies now notify the assignee, or **all agents plus owners/admins** if the ticket is unassigned (previously nobody). A customer reopening now notifies staff. The first staff reply no longer also sends an "Open" status notice. Private notes and files never reach customers: tested, and the claim strips them. Emails contain status and a portal link only; the reply text is **no longer** copied into email. |
| **D. Auth email** | Sign-up confirmation is Supabase Auth's own email, separate from the support/invitation senders, so it works while those are off. The return page survives confirmation via `emailRedirectTo` plus an allow-list (`safeNext`). **You need to check in the Supabase dashboard** (I can't read Auth settings): Auth → URL Configuration must allow `https://www.b2bnest.online/**` and any preview host you test on, otherwise Supabase sends people to the Site URL and the join/portal page is lost. Also check Auth → SMTP: without custom SMTP, Supabase's built-in mailer is heavily rate-limited. |
| **E. Release order** | Corrected below. The migration and owner tests come first, publishing is approved separately, and senders are deployed and switched on separately again. |

## Revision 2 changes

1. Customer reply on an unassigned ticket notifies agents plus owners/admins (new trigger on `support_messages`).
2. A customer reopening a ticket notifies the assignee, or all staff if it's unassigned. A reply that reopens it sends one notice, not two.
3. The automatic New → Open on the first staff reply sends no extra status notice.
4. `REVOKE INSERT ON organization_members FROM anon, authenticated`. Live allowed owners/admins to insert any account id
   as a member, with no invitation, verification, seat or customer check. No app screen uses this; role changes and removals are unaffected.
   The old `Auth.tsx ?invited=true&org=` self-join was already blocked by RLS (dead code).
5. Ticket emails already queued (1 on live) are cancelled with reason "queued before email sending was approved", so switching
   the sender on later can't send stale mail. Rollback leaves them cancelled on purpose.
6. Support sender: reply emails no longer include the reply text.

## Files

| Item | Path |
| --- | --- |
| Migration (one transaction) | `proposal.sql` (sha256 `39e5283c7ebe28c99c4d46c05b3f77434c6afdeb7246764b1aa29b57c343b126`) |
| Export before rollback | `export.sql` |
| Rollback | `rollback.sql` |
| DB tests / runner | `test.sql`, `run-test.sh` |
| Invitation email sender | `functions/onboarding-email-sender/` (inert until `ONBOARDING_EMAIL_ENABLED=true`) |
| Ticket email sender v2 | `functions/support-email-sender/` (inert until `SUPPORT_EMAIL_ENABLED=true`) |

## Tests run on 2026-10-16

| Suite | Where | Result |
| --- | --- | --- |
| `test.sql` (104 checks: original 81 + 23 revision-2) | Throwaway local PostgreSQL 16 with the mirrored fixture; **not** production | 104 passed, 0 failed |
| Support sender `handler_test.ts` | Deno 2, mocked SMTP (`deno.land` blocked here, so the `asserts` import was mapped to a `node:assert` shim) | 9 passed |
| Invitation sender `handler_test.ts` | Same | 5 passed |
| App unit tests (`vitest`), includes the onboarding helpers | jsdom, mocked Supabase | 174 passed |

Not tested: signed-in screens in a browser, the real Supabase Auth email, any real email send.

## Decisions needed before approval

1. **Seat allowance across companies (A).** Pick one:
   (a) per company: each company the subscriber owns gets the full plan allowance (current code); or
   (b) pooled: the allowance covers all companies the subscriber owns together. This needs a small change, so tell me before approval.
   Nothing is enforced either way until plan limits are set.
2. **Reply emails (C).** Link-only, as now in revision 2, or include the reply text (the earlier draft did).

## Release order (each step separately approved)

1. Run `export.sql` (expected near-empty), then apply `proposal.sql` to `gvftvswyrevummbvyhxa` in one transaction. Confirm with:
   `select to_regclass('public.onboarding_email_outbox'), has_table_privilege('authenticated','public.organization_members','INSERT')`
   → table present, `false`.
2. Owner tests on the preview (below). **The preview uses the production database.** Use your own test companies and accounts only.
3. Publishing approval for the frontend (it is already on `main`, so this means "allow the live site to show it").
4. Sender approval: deploy both senders with sending off, then a bounded test to one named address you approve, then switch on.

## Owner test plan (preview, about 15 minutes, no emails are sent)

Use company **Dev Team** (owner: you). Live on 2026-10-16 its support is named **NG TELECOM**, has 3 invited customers (none
signed in yet) and no agents. Confirm Dev Team really is the company that should provide NG TELECOM support before any real
customer uses it.

You need three accounts, because one account can't be staff and customer of the same company:
**Owner** (you), **Colleague** (an address that is *not* one of Dev Team's invited customers), and **Customer** (one of the
3 invited customer addresses). Invitation links are copied by hand because email is off.

1. As Owner: Settings → Members & roles → invite Colleague as **member**. Expected: "Invitation saved — email not sent", one row.
   Invite the same address again. Expected: "already invited", still one row.
2. Copy the link and open it in a private window signed in as Colleague. Expected: Dev Team and role shown; Accept works; you land in Members.
3. As Owner: Colleague is listed as member. Invite a dummy address, then revoke it. Its link then says it's no longer valid.
4. As Owner: Support desk → Setup → make Colleague an agent.
5. As Customer: sign in, open the support portal (access is claimed on sign-in), create a ticket, then reply on it.
   Expected: Owner and Colleague each get **one** "Customer replied" notice.
6. As Colleague: reply publicly. Expected: Customer gets **one** "Reply on…" notice and no extra status notice.
   Add a private note. Expected: Customer sees nothing.
7. As Colleague: close the ticket. As Customer: reopen it. Expected: Owner and Colleague get "Customer reopened".

Report anything that differs. Failures are diagnosed from the database, not by repeating the test.

## Rollback

Run `export.sql`, save the output privately, then `rollback.sql`. Colleagues who joined stay members (remove them manually if wanted).
The direct member INSERT grant is restored as before. Cancelled stale emails stay cancelled.
