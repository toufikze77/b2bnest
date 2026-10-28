# Phase 18: replies to workflow emails reach the sender

**Status: prepared, not deployed.** Nothing in this folder or PR has been deployed, and no email has been sent.

## What changes

Workflow emails (Workflow Studio → "Send an email") are still sent **From** B2BNEST's sending address (`SMTP_FROM`), with the
same display name. They now carry a **Reply-To** header set to the **signed-in sender's own verified account email**, so a
customer who presses Reply writes to the business, not to B2BNEST.

- The address is read on the server from the authenticated user (`auth.getUser` in `workflow-send-email/index.ts`). The
  request body can't set or change it: there is no field for it, and any `replyTo`, `reply_to` or `from` that is sent is ignored.
- It is used only when `email_confirmed_at` is set and the address is one plain ASCII address
  (`supabase/functions/_shared/reply-to.ts`). Otherwise no Reply-To is set, the email still goes, and the response says
  `replyTo: null` with a `replyNote` explaining that replies will go to B2BNEST's sending address.
- `buildMessage` (`workflow-send-email/smtp.ts`) adds `Reply-To:` only when a caller passes `replyTo`, and refuses (throws)
  any value with CR/LF, spaces, brackets, commas or non-ASCII characters rather than folding it into a header. Without
  `replyTo`, its output is byte-identical to before for every other sender (`phase18_test.ts` compares it with a copy of
  the old function).
- **Why not a company email:** B2BNEST stores no company contact email. This was checked read-only in production on
  28 Oct 2026: no `email` column exists on `companies`, `organizations` or any settings table. The only email-like
  columns are `profiles.email`, `organization_invitations.email`, `hmrc_settings.email_notifications` and
  `user_2fa_settings.email_verified`. So the sender's own verified account email is the only trustworthy source.
- At the time of the check, every production account had a verified email (0 of 8 unverified).

## Deploy order (owner, after review)

1. **Deploy `workflow-send-email`** (the only function whose behaviour changes). From the dashboard, upload the output of
   `node scripts/flatten-function.mjs workflow-send-email`:
   `handler.ts, index.ts, probe.ts, request.ts, shared_placeholders.ts, shared_reply-to.ts, smtp.ts`.
   The CLI equivalent is `supabase functions deploy workflow-send-email`.
2. **Then publish the frontend** (merge, then Vercel).

`onboarding-email-sender`, `support-email-sender`, `send-document-email` and `trial-email-sender` bundle copies of
`wse_smtp.ts` and `wse_handler.ts`. Those files changed, but the change only adds the optional Reply-To. None of these
functions passes one, so their messages are byte-identical and they **don't need redeploying**. Redeploying them later is
safe. Their flattened layouts are unchanged:
- `onboarding-email-sender`, `support-email-sender` and `send-document-email`:
  `handler.ts, index.ts, wse_handler.ts, wse_smtp.ts`.
- `trial-email-sender`: also `mime.ts, oes_handler.ts, shared_plans.ts, shared_trial-emails.ts`.

**If the order is wrong** (the frontend is published before the function):
- Before sending, the preview and confirm dialog would say "Replies go to <your email>." That would be untrue, because
  the old function sets no Reply-To.
- After sending, each step's result is built from the server's own answer. The old function sends no `replyTo` field,
  so the result says "Replies go to B2BNEST's sending address."

So the claim is corrected after the send, but the preview is wrong until the function is deployed.

## Rollback

Redeploy the previous `workflow-send-email` (main before this PR). No database change is involved.

## Not verified

- How real mail clients (Outlook, Gmail, Apple Mail) handle the Reply-To.
- Real delivery through Office 365 / SMTP with the new header. No email was sent.
- Whether the SMTP provider rewrites or drops Reply-To.
