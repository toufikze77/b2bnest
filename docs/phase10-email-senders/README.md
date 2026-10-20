# Phase 10: invitation and support email senders — rollout (each step needs separate approval)

**Status (Phase 10 PR): in `supabase/functions`, not deployed, not scheduled, switched off.** Nothing was deployed, no
secret set, no job scheduled and no email sent.

| Function | Folder | Sends | Queue (live in production) |
| --- | --- | --- | --- |
| `onboarding-email-sender` | `supabase/functions/onboarding-email-sender/` | Staff invitations (`/join?token=…` link) and support-customer invitations (portal link) | `onboarding_email_outbox` via `onboarding_outbox_claim` / `onboarding_outbox_finish` |
| `support-email-sender` (v2) | `supabase/functions/support-email-sender/` | Ticket received, new reply, status change — portal link only, never reply text, notes or attachments | `support_email_outbox` via `support_outbox_claim` / `support_outbox_finish` |

Both:
- answer only callers presenting the service-role key (anything else: HTTP 401);
- do nothing (`{"status":"disabled"}`, nothing claimed, no SMTP) unless `ONBOARDING_EMAIL_ENABLED` / `SUPPORT_EMAIL_ENABLED`
  is exactly `true`;
- send only through the Microsoft 365 `SMTP_*` settings already used by `send-document-email` and `workflow-send-email`
  (the Gmail fallback is refused);
- claim at most 20 rows per call; a failure before the message is handed over is `failed` and retried with backoff
  (5, 15, 45, 135 minutes; at most 5 attempts); a failure during or after DATA, or a lost connection, is `uncertain` and
  is **never resent automatically**.

Read-only checks for every step: [`checks.sql`](checks.sql). Production on 2026-10-18/20 (read-only): onboarding queue
empty; support queue 1 cancelled row; nothing due; no sender jobs; no Vault secret yet.

## How invitations work today (no email)

- Settings → Members & roles calls the `org_invite_member` RPC. The invitation and an `onboarding_email_outbox` row are
  saved; the inviter sees "Invitation saved — email not sent" and uses **Copy invitation link** (`/join?token=…`).
- Support desk → Customer access inserts into `support_customers`; the `support_customers_queue_invitation` trigger
  queues a `customer_invitation` row. The inviter sees "Invitation saved — email not sent" and copies the portal link.
- Nothing in the app calls the old `send-invitation-email` function (only `src/test/teamInvitation.e2e.test.ts`).

## (a) Deploy both functions with sending off

1. Confirm `checks.sql` §1–4 match the production state above.
2. Make sure `ONBOARDING_EMAIL_ENABLED` and `SUPPORT_EMAIL_ENABLED` are **not set** (Edge Functions → Secrets).
3. Deploy. Either:
   - CLI: `supabase functions deploy onboarding-email-sender` and `supabase functions deploy support-email-sender`
     (config.toml sets `verify_jwt = true`); or
   - Dashboard (one folder per function): run `node scripts/flatten-function.mjs onboarding-email-sender` and
     `node scripts/flatten-function.mjs support-email-sender`, then upload `dist-functions/<name>/` (4 files each:
     `index.ts`, `handler.ts`, `wse_handler.ts`, `wse_smtp.ts`), with "Verify JWT" on.
4. Check it is off: call each once with the service-role key —
   `curl -s -X POST https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/onboarding-email-sender -H "Authorization: Bearer <service role key>"`
   → expect `{"status":"disabled","sent":0}`; the same call without the header → 401. `checks.sql` unchanged.

**Rollback (a):** delete the two functions in the dashboard (Edge Functions → … → Delete). Nothing else changed.

## (b) One bounded test invitation, to an address the owner names

1. Run `checks.sql` §2: **it must return no rows.** If it lists anything, stop: those emails would go out too.
2. Create one invitation to the owner's chosen address: Settings → Members & roles → enter the address, role
   "member", **Invite** (or, as a signed-in owner/admin: `select public.org_invite_member('<org id>', '<address>', 'member');`).
3. Run `checks.sql` §2 again: exactly **one** `staff_invitation` row, `pending`, `attempts = 0`, for that address.
4. Set `ONBOARDING_EMAIL_ENABLED=true` (Edge Functions → Secrets).
5. Call the function **once** by hand (the `curl` in step a.4). Expected reply: `{"status":"ran","claimed":1,"accepted":1,…}`.
6. Immediately remove `ONBOARDING_EMAIL_ENABLED` again (or set it to `false`).
7. Read the result:
   ```sql
   SELECT status, attempts, provider_reply, last_error, accepted_at FROM public.onboarding_email_outbox
   WHERE recipient_email = lower('<address>') ORDER BY created_at DESC LIMIT 1;
   ```
   - `accepted_by_provider` + a `250 …` reply: Microsoft 365 accepted it. Check the inbox (and spam) and that the link
     opens `/join` and accepts after signing in with that address.
   - `failed`: it never reached the provider (reason in `last_error`, e.g. SMTP settings); it will retry only while
     the flag is on.
   - `uncertain`: the provider may or may not have it; **do not resend automatically** — check the mailbox, then either
     leave it or use **Copy invitation link**.

**Rollback (b):** remove `ONBOARDING_EMAIL_ENABLED`; revoke the test invitation (Members & roles → Revoke), which
cancels its queue row on the next claim.

## (c) Schedule both senders — PREPARED, NOT APPLIED: [`schedule.sql`](schedule.sql)

1. Store the service-role key in Vault as `email_senders_service_role_key` (owner action; the SQL never contains it).
2. Run `schedule.sql`: two pg_cron jobs calling the functions through pg_net, every 5 minutes (support offset by
   2 minutes), 20 rows per run. While the flags are off each run is a no-op returning `{"status":"disabled"}`.
3. Check: `checks.sql` §4 shows both jobs `active = true`; after 10 minutes §5 shows `succeeded` runs and §6 shows
   `200` responses with `"status":"disabled"`.

**Rollback (c):** [`schedule-rollback.sql`](schedule-rollback.sql) (unschedules both by name; safe to re-run). Optionally
delete the Vault secret.

## (d) Switch sending on

1. Run `checks.sql` §2 and review every row it lists: each **will be emailed** within 5 minutes.
2. Set `ONBOARDING_EMAIL_ENABLED=true`. Watch `checks.sql` §1/§3/§5 for an hour.
3. Separately, when support tickets are switched on and approved: set `SUPPORT_EMAIL_ENABLED=true` and watch the same way.
4. The app still says "email not sent" until `EMAIL_SENDING_ENABLED` in `src/services/onboardingService.ts` (and the
   support desk banner) are changed in a follow-up PR — do that only after the first scheduled sends are confirmed.

**Rollback (d):** remove the flag (takes effect on the next run; anything already handed to the provider has gone).
Rows that were claimed stay in their final state; `uncertain` rows need a human.

## (e) Rollback summary

| Step | Undo |
| --- | --- |
| (a) deploy | Delete the two functions |
| (b) test send | Remove `ONBOARDING_EMAIL_ENABLED`; revoke the test invitation |
| (c) schedule | `schedule-rollback.sql`; optionally delete the Vault secret |
| (d) switch on | Remove the `*_EMAIL_ENABLED` flag(s) |

## The old `send-invitation-email` function (separate recommendation)

It is still deployed (`verify_jwt = true`), sends through hard-coded **Gmail** SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`)
and builds old `/auth?invited=true&org=…` links instead of `/join?token=…`. Nothing in the app calls it (only the e2e
test). Recommendation, as its own approved change: delete the deployed function, then remove
`supabase/functions/send-invitation-email/`, its `config.toml` entry and the e2e test's call to it.
`share-project`, `share-task` and `send-task-notification` also send through Gmail SMTP; moving them to Microsoft 365
is a separate decision.
