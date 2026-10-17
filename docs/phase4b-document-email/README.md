# Phase 4b: email an invoice or quote to the customer — BUILT, TESTED, NOT DEPLOYED

Nothing here is applied, deployed, enabled or sent. No secret or environment variable was set. No email was sent and no
mail server was contacted while building or testing this (all tests use fakes; see "What was tested").

## What is in the repo

| Piece | File | State |
| --- | --- | --- |
| Edge Function | `supabase/functions/send-document-email/` (`handler.ts`, `index.ts`, `handler_test.ts`) | Not deployed. `verify_jwt = true` in `supabase/config.toml`. |
| SMTP message builder | `supabase/functions/workflow-send-email/smtp.ts`: new `buildMixedMessage` (text + HTML + one attachment); `sendSmtp` takes an optional prebuilt message | Existing callers unchanged (`buildMessage` output byte-identical; existing tests green). |
| Email log table (proposal) | `proposal.sql`, `rollback.sql`, `test.sql`, `run-test.sh` (this folder) | **Proposal, not applied.** |
| Browser | "Email to customer" in the quote/invoice row menu and document view; preview dialog | Shows "Email to customer (not available yet)" until the function says it is configured. Safe to merge before deployment. |

## How it works

1. The browser asks the function (GET) whether sending is switched on. Not deployed, not configured or switched off → the
   action reads "Email to customer (not available yet)" and nothing else is called.
2. The owner opens the preview: To (the document's saved customer email, read-only), Subject, Message (plain text, max
   2,000 characters), the PDF name and size, and "This email is sent from info@b2bnest.online on your behalf. Replies go to
   <your email>."
3. Send: the browser posts `{ kind, id, subject, message, pdf_base64 }` — never an address.
4. The function checks the caller's token, reads the document **as the caller** (row-level security), and refuses when it
   is someone else's, archived, a paid invoice, or has no / an invalid customer email. The recipient is always the saved
   `client_email`. One recipient, no CC/BCC. The PDF must start with `%PDF` and be at most 5 MB.
5. Limits: 20 emailed documents per user per 24 hours, 3 per document per 24 hours (accepted + uncertain sends count).
6. The message: From `"B2BNEST on behalf of <business>" <info@b2bnest.online>` (business name cleaned: no line breaks,
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

## Deployment steps for the owner to approve (each one separately)

1. **Check the existing secrets** (no new ones, do not change values): `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and
   optionally `SMTP_HOST` (default `smtp.office365.com`) and `SMTP_PORT` (default 587). These are the same settings
   `workflow-send-email` already uses. Only the address inside `SMTP_FROM` is used; the display name is built per business.
   Confirm `SMTP_USER` is (or may send as) **info@b2bnest.online** — the onboarding notes from 2026-10-16 mention
   `notifications@b2bnest.online` for the same settings, so this needs checking. The Gmail fallback is never used here.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically.
2. **Apply the table**: run `bash docs/phase4b-document-email/run-test.sh` locally first (disposable Postgres), then apply
   `proposal.sql` to production through the approved migration step.
3. **Deploy the function**: `supabase functions deploy send-document-email`. It stays switched off.
4. **Switch on for the test only**: set `DOCUMENT_EMAIL_ENABLED=true` (this is the one new setting; without it the
   function answers "not configured" and sends nothing). Do this only when the test below is ready.
5. **One named test address**: the owner picks one mailbox they control. Create a draft invoice whose customer email is
   exactly that address. Send it once.

### Test checklist (with the named test address)

- [ ] The row menu shows "Email to customer"; the preview shows the test address read-only, subject, message and the PDF.
- [ ] Send → spinner → "Email sent to <test address>. Your mail provider accepted it." The invoice changes to Sent.
- [ ] The message arrives (check the spam/junk folder too). From reads "B2BNEST on behalf of <business>".
- [ ] Replying goes to the owner's own email, not to info@b2bnest.online.
- [ ] The attachment opens and matches "Download PDF".
- [ ] Message headers show SPF, DKIM and DMARC as `pass` (Authentication-Results).
- [ ] `document_email_log` has one `accepted_by_provider` row with only the domain of the test address.
- [ ] The same invoice now offers "Email again" with the extra line. Paid, archived and no-email documents are disabled with a reason.
- [ ] Turn `DOCUMENT_EMAIL_ENABLED` off again → the action reads "not available yet".

### Rollback

1. Remove `DOCUMENT_EMAIL_ENABLED` (or set it to anything but `true`): the app goes back to "not available yet" at once.
2. Undeploy: `supabase functions delete send-document-email`.
3. Run `rollback.sql` (removes the log and its helper; invoice/quote statuses already set to Sent stay as they are).

## Limits

- 20 emailed documents per user per 24 hours; 3 per document per 24 hours. Failed attempts don't count.
- One recipient (the saved customer email). No CC/BCC. PDF up to 5 MB. Message up to 2,000 characters, subject 200.
- Paid invoices and archived documents are never emailed.
- Two simultaneous sends could both pass the limit check (the count is read, then the send happens). Acceptable for these
  limits; a stricter version would reserve a row before sending.

## Risks

- **SPF / DKIM / DMARC**: sending as info@b2bnest.online through Microsoft 365 passes only if b2bnest.online's SPF includes
  `spf.protection.outlook.com` and DKIM is enabled for the domain in Microsoft 365. Not verified from here.
- **Spam placement**: a first-time sender, an attachment and "on behalf of" wording can land in junk. Customers may need to
  look there at first.
- **Microsoft 365 sending limits**: Exchange Online's published limits are about 10,000 recipients per mailbox per day and
  30 messages per minute (check the current figures for the plan); one shared
  mailbox serves every B2BNEST user (and the other platform notifications). SMTP AUTH must stay enabled for that mailbox.
- **Display-name sender**: the From address is B2BNEST's; only the display name carries the business name. Some mail
  clients show the address prominently, so customers may see "info@b2bnest.online". Reply-To keeps replies with the business.
- **Reputation**: every business shares one sending address; abuse by one user would affect all. The limits above reduce,
  not remove, this risk.

## What was tested (and how)

- Deno (installed from the official GitHub release, v2.1.4): `deno test --allow-env --import-map=<local map>` on every
  Edge Function test file. deno.land is blocked in this environment, so the map points the standard `asserts.ts` URL at a
  small local stand-in with the same functions; the repo's test files are unchanged. Network permission was **not**
  granted, so any attempt to connect anywhere would have failed the run.
- `bash docs/phase4b-document-email/run-test.sh`: 33 checks on a disposable local Postgres 16.
- Browser: vitest (dialog, availability rules, status only after success, failures, no address sent) and a local
  Playwright harness with mocked function replies at 1440px and 390px.
