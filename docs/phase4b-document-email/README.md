# Phase 4b: email an invoice or quote to the customer — BUILT, TESTED, NOT DEPLOYED

Nothing here is applied, deployed, enabled or sent. No secret or environment variable was set. No email was sent and no
mail server was contacted while building or testing this (all tests use fakes; see "What was tested").

Phase 4b-2 (hardening before any deployment): the dialog shows the real sending address reported by the server, sending is
**off for every account unless listed** (fail closed), only accounts with a verified email address can send, and the
per-user daily limit is a setting with a safe default.

## Sending mailbox

Emails go out from whatever mailbox the server's `SMTP_FROM` names (or `SMTP_USER` when `SMTP_FROM` is not set). The owner
has confirmed this is currently **notifications@b2bnest.online** on Microsoft 365. Nothing in the app hard-codes an address:
the preview dialog shows the address the server reports ("This email is sent from <sender> on your behalf. Replies go to
<your email>."), and if the server reports none it says "from the B2BNEST sending address" rather than guessing.

## What is in the repo

| Piece | File | State |
| --- | --- | --- |
| Edge Function | `supabase/functions/send-document-email/` (`handler.ts`, `index.ts`, `handler_test.ts`) | Not deployed. `verify_jwt = true` in `supabase/config.toml`. |
| SMTP message builder | `supabase/functions/workflow-send-email/smtp.ts`: `buildMixedMessage` (text + HTML + one attachment); `sendSmtp` takes an optional prebuilt message | Existing callers unchanged (`buildMessage` output byte-identical; existing tests green). |
| Email log table (proposal) | `proposal.sql`, `rollback.sql`, `test.sql`, `run-test.sh` (this folder) | **Proposal, not applied.** |
| Browser | "Email to customer" in the quote/invoice row menu and document view; preview dialog | Shows "Email to customer (not available yet)" unless the server says this user may send. Safe to merge before deployment. |

## Settings (server-side, Edge Function environment)

| Setting | Meaning | When unset |
| --- | --- | --- |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, optional `SMTP_HOST` (default `smtp.office365.com`), `SMTP_PORT` (default 587) | **Existing** Microsoft 365 settings, shared with `workflow-send-email`. Only the address part of `SMTP_FROM` is used; the display name is built per business. | Not configured: nothing can be sent. The Gmail fallback is never used. |
| `DOCUMENT_EMAIL_ENABLED` | **New.** Master switch: must be exactly `true`. | Off for everyone. |
| `DOCUMENT_EMAIL_ALLOWED_USERS` | **New.** Comma-separated user ids that may send, or `*` for every verified user. Spaces are trimmed, blanks ignored, case-insensitive. | **Nobody may send (fail closed).** |
| `DOCUMENT_EMAIL_USER_DAILY_LIMIT` | **New, optional.** Emails per user per 24 hours. A positive whole number, capped at 50. | 10 (also used for any invalid value). |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically.

### Why it is fail closed (the abuse risk)

Every email goes out from the platform's own mailbox. Without a restriction, anyone who signs up could type any address
into a document's customer email and send it a PDF of their choosing from that mailbox, up to the daily limits. Spam or
phishing sent that way would be blamed on b2bnest.online: the domain could be blocked or marked as spam, and the same
mailbox and domain also carry B2BNEST's own onboarding and notification email. So:

- Sending is **off for every account** unless its user id is in `DOCUMENT_EMAIL_ALLOWED_USERS`. An empty or missing list
  means nobody, never everybody. `*` (everybody) is a deliberate later decision, not a default.
- Only accounts whose email address is **verified** (`email_confirmed_at` set) can send, even when listed or with `*`.
- The per-user daily limit defaults to 10 and can never be set above 50; 3 per document per day.
- Both the GET check and the send itself enforce all of this on the server, so a modified browser gains nothing.

## How it works

1. The browser asks the function (GET) whether this user may send. The answer is `{ configured: true, sender }` (sender =
   the address only — never the display name, host, port, user name or any secret) or `{ configured: false, reason }`
   with `not_configured`, `not_allowed` or `email_not_verified`. Not deployed, offline or any odd answer counts as not
   configured. Not available → the action reads "Email to customer (not available yet)" with the reason
   ("…isn't switched on yet", "…isn't switched on for your account yet", or "Verify your email address to use this.").
2. The owner opens the preview: To (the document's saved customer email, read-only), Subject, Message (plain text, max
   2,000 characters), the PDF name and size, and the sender line above.
3. Send: the browser posts `{ kind, id, subject, message, pdf_base64 }` — never an address.
4. The function checks the caller's token, the switch, the allowlist and email verification (403 `not_allowed` /
   `email_not_verified`, nothing loaded or sent), then reads the document **as the caller** (row-level security) and
   refuses when it is someone else's, archived, a paid invoice, or has no / an invalid customer email. The recipient is
   always the saved `client_email`. One recipient, no CC/BCC. The PDF must start with `%PDF` and be at most 5 MB.
5. Limits: `DOCUMENT_EMAIL_USER_DAILY_LIMIT` (default 10, max 50) per user per 24 hours, 3 per document per 24 hours
   (accepted + uncertain sends count). The error message quotes the actual number.
6. The message: From `"B2BNEST on behalf of <business>" <SMTP_FROM address>` (business name cleaned: no line breaks,
   angle brackets or quotes), Reply-To the owner's own email, the PDF attached, the owner's text escaped, a footer saying
   it was sent via B2BNEST on behalf of the business. No links added, no tracking pixel, no click tracking.
7. Only when the mail server accepts the message does the function log `accepted_by_provider` and return success. The
   browser then (drafts only) sets the status to Sent with the usual owner-filtered write, and says
   "Email sent to <address>. Your mail provider accepted it." If that status write fails: "The email was sent, but the
   status could not be saved. Mark it as sent manually."
8. Any failure before the message was handed over is logged `failed` with the SMTP stage, the reason is shown in plain
   words, the document is unchanged and "Download PDF and send it yourself" is offered. A connection lost after the
   message was handed over, or a timeout, is logged `uncertain` and the owner is told to check before retrying.
9. The log never holds addresses, subjects or bodies: ids, kind, the recipient's domain, the outcome, the stage, and the
   server reply with addresses redacted (max 300 characters).

**"Accepted by the provider" means Microsoft 365 took the message for delivery. It does not mean it reached the inbox**
(it can still bounce later, be filtered as spam, or be quarantined). Nothing in the app says "delivered".

## Staged rollout (each step approved separately)

### Stage 1: the owner only, one named test address

1. **Check the existing SMTP settings** (no new values): confirm `SMTP_FROM` (or `SMTP_USER`) is
   notifications@b2bnest.online and that the account may send as that address.
2. **Apply the table**: run `bash docs/phase4b-document-email/run-test.sh` locally first (disposable Postgres), then apply
   `proposal.sql` to production through the approved migration step.
3. **Deploy the function**: `supabase functions deploy send-document-email`. With no new settings it sends nothing.
4. **Switch on for the owner only**:
   - `DOCUMENT_EMAIL_ALLOWED_USERS=<OWNER_USER_ID>` (the owner's own user id; placeholder here, no real ids in the repo)
   - `DOCUMENT_EMAIL_USER_DAILY_LIMIT` left unset (10)
   - `DOCUMENT_EMAIL_ENABLED=true`
5. **One named test address**: the owner picks one mailbox they control. Create a draft invoice whose customer email is
   exactly that address. Send it once, then work through the checklist below.

### Stage 2: widen only after the owner approves

- Add specific accounts: `DOCUMENT_EMAIL_ALLOWED_USERS=<OWNER_USER_ID>,<APPROVED_USER_ID_1>,<APPROVED_USER_ID_2>`.
- `*` (every verified user) only after Stage 1 and a period with named accounts show no deliverability or abuse problems,
  and after SPF/DKIM/DMARC are confirmed. Consider keeping the daily limit at 10 when opening up.

### Test checklist (Stage 1, named test address)

- [ ] The row menu shows "Email to customer"; the preview shows the test address read-only, subject, message, the PDF, and
      "This email is sent from notifications@b2bnest.online on your behalf. Replies go to <owner email>."
- [ ] Send → spinner → "Email sent to <test address>. Your mail provider accepted it." The invoice changes to Sent.
- [ ] The message arrives (check the spam/junk folder too). From reads "B2BNEST on behalf of <business>".
- [ ] Replying goes to the owner's own email, not to the sending mailbox.
- [ ] The attachment opens and matches "Download PDF".
- [ ] Message headers show SPF, DKIM and DMARC as `pass` (Authentication-Results).
- [ ] `document_email_log` has one `accepted_by_provider` row with only the domain of the test address.
- [ ] The same invoice now offers "Email again" with the extra line. Paid, archived and no-email documents are disabled with a reason.
- [ ] Signed in as a different (unlisted) account: "Email to customer (not available yet)" — "…isn't switched on for your account yet".
- [ ] Turn `DOCUMENT_EMAIL_ENABLED` off again → the action reads "not available yet".

### Rollback

1. Remove `DOCUMENT_EMAIL_ENABLED` or empty `DOCUMENT_EMAIL_ALLOWED_USERS`: the app goes back to "not available yet" at once.
2. Undeploy: `supabase functions delete send-document-email`.
3. Run `rollback.sql` (removes the log and its helper; invoice/quote statuses already set to Sent stay as they are).

## Limits

- Per user: `DOCUMENT_EMAIL_USER_DAILY_LIMIT` (default 10, max 50) per 24 hours; 3 per document per 24 hours. Failed
  attempts don't count.
- One recipient (the saved customer email). No CC/BCC. PDF up to 5 MB. Message up to 2,000 characters, subject 200.
- Paid invoices and archived documents are never emailed. Unverified accounts and accounts not on the allowlist never send.
- Two simultaneous sends could both pass the limit check (the count is read, then the send happens). Acceptable for these
  limits; a stricter version would reserve a row before sending.

## Risks

- **SPF / DKIM / DMARC**: sending as notifications@b2bnest.online through Microsoft 365 passes only if b2bnest.online's SPF
  includes `spf.protection.outlook.com` and DKIM is enabled for the domain in Microsoft 365. Not verified from here.
- **Spam placement**: a first-time sender, an attachment and "on behalf of" wording can land in junk. Customers may need to
  look there at first.
- **Microsoft 365 sending limits**: Exchange Online's published limits are about 10,000 recipients per mailbox per day and
  30 messages per minute (check the current figures for the plan); one mailbox serves every allowed B2BNEST user and the
  other platform notifications. SMTP AUTH must stay enabled for that mailbox.
- **Display-name sender**: the From address is B2BNEST's; only the display name carries the business name. Some mail
  clients show the address prominently, so customers may see notifications@b2bnest.online. Reply-To keeps replies with the business.
- **Reputation**: every allowed business shares one sending address. The allowlist, verification and limits reduce this
  risk; widening to `*` increases it again.

## What was tested (and how)

- Deno (installed from the official GitHub release, v2.1.4): `deno test --allow-env --import-map=<local map>` on every
  Edge Function test file. deno.land is blocked in this environment, so the map points the standard `asserts.ts` URL at a
  small local stand-in with the same functions; the repo's test files are unchanged. Network permission was **not**
  granted, so any attempt to connect anywhere would have failed the run.
- `bash docs/phase4b-document-email/run-test.sh`: 33 checks on a disposable local Postgres 16.
- Browser: vitest (dialog, sender line, availability rules incl. not allowed / not verified, status only after success,
  failures, no address sent) and a local Playwright harness with mocked function replies at 1440px and 390px.
