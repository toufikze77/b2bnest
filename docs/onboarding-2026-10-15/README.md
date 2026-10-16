# Ticketing onboarding package — PREPARED, NOT APPLIED

Target when approved: production gvftvswyrevummbvyhxa. Nothing here is live, deployed, sent or published.

## Finding
Company-member invitations did not work: `organization_invitations` existed (0 rows) but had no accept step, no revoke,
no seat check, no duplicate guard, and live grants give signed-in users no access at all. Project-team invitations were
not reused (they grant project access, not company membership).

## Files
| Item | Path |
|---|---|
| Migration (one transaction) | `proposal.sql` (sha256 e02f4b26…a559 at test time) |
| Export before rollback | `export.sql` |
| Rollback | `rollback.sql` |
| DB tests / runner | `test.sql`, `run-test.sh` (81 checks, throwaway database) |
| Invitation email sender | `functions/onboarding-email-sender/` (inert until `ONBOARDING_EMAIL_ENABLED=true`) |
| Ticket email sender v2 (adds status emails) | `functions/support-email-sender/` (supersedes the 2026-10-15 copy) |
| Preview screens | Settings → Members & roles (Invite colleagues), `/join?token=…`, portal feedback + email switch, desk feedback switch |

## Rules enforced by the database
- Staff: owners invite admin/manager/member; admins manager/member; nobody invites owner. Other companies can't.
- Accept only with the signed-in account whose VERIFIED email equals the invitation; single use; 7-day expiry, extend, revoke.
- One live invitation per email per company; repeat invite returns the existing one; existing members reported, not re-added.
- Seats = active members + pending invitations, checked on invite and again on accept, from the owner's plan
  `platform_plans.member_limit`. **Owner decision:** live plans table currently holds no limits, so no cap applies until
  you set them. Plans/billing are not changed by this package.
- Customers stay in support_customers: a customer email can't be invited as staff, an active customer can't accept a staff
  invitation, customers never use seats. Joined colleagues can then be appointed as support agents.
- Invitation token column is not readable directly; owners/admins get it only through "Copy invitation link".
- Emails: queued server-side only; revoked/accepted/expired invitations are cancelled before sending; max 5 attempts;
  "uncertain" never resent; "accepted by provider" is not proof of delivery. Until sending is approved the screens say
  "Invitation saved — email not sent".
- Status changes notify the customer in-app and queue an email with status only (no message text, no private notes, no files).
  Each person can switch support email off per company; in-app stays on.
- Closure feedback: off by default; 1–5 + optional comment; only that ticket's customer, only when closed, once; only staff read it.

## Sign-up / sign-in journeys
New user: link → sign-in page (remembers where to return) → create account → verify email → link returns them to the
join page or that company's portal → accept. Existing user: link → sign in → back to the same page; no password reset.
Return addresses are restricted to known app pages (no open redirects).

## Deployment order (after approval)
1. Apply `proposal.sql` (one transaction; a failure leaves nothing — tested with an injected failure).
2. Publish the frontend.
3. Separately approved: deploy both senders with sending switched off, schedule them, then switch on.
   They reuse the Microsoft 365 settings (SMTP_* → smtp.office365.com, notifications@b2bnest.online); no Gmail, no new secrets.

## Rollback
Run `export.sql`, save privately, then `rollback.sql`. Colleagues who joined stay members (remove manually if wanted).
Re-applying after a rollback refuses atomically if two live invitations share an email; resolve them first.

## Not verified here
Signed-in screens were not driven in a browser (no session available); the database rules were checked with labelled
sample accounts in a throwaway database only.
