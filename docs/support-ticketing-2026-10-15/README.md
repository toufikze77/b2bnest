# Support ticketing — release package (NOT APPLIED)

Reusable per-company helpdesk. NG TELECOM is the first company to use it; nothing is hard-coded for it.
Target when approved: gvftvswyrevummbvyhxa. Status: preview code only; no live change, deploy or publish.

## Exact paths
| Item | Path |
|---|---|
| Migration (one transaction) | `docs/support-ticketing-2026-10-15/proposal.sql` |
| Export (run before any rollback) | `docs/support-ticketing-2026-10-15/export.sql` |
| Rollback | `docs/support-ticketing-2026-10-15/rollback.sql` |
| DB tests / runner | `docs/support-ticketing-2026-10-15/test.sql`, `run-test.sh` |
| Storage bucket | `support-attachments`, private, 10 MB (created with the storage tool, not SQL) |
| Email sender (not deployed) | `docs/support-ticketing-2026-10-15/functions/support-email-sender/{index.ts,handler.ts,handler_test.ts}` -> copy to `supabase/functions/support-email-sender/` |
| Sample-data screens | `docs/screenshots/support-sample/*.png`, script `sample-screens.py` (mocked backend) |

## Objects created
Tables (8): support_settings, support_categories, support_agents, support_customers, support_tickets, support_messages,
support_attachments, support_email_outbox.
Policies: settings (select/insert/update), categories (select/insert/update), agents (select/insert/delete),
customers (select/insert/update), tickets (select), messages (select), attachments (select); outbox none (server only);
storage.objects: "Support files: read if attachment visible", "Support files: upload into a visible ticket folder".
No update/delete storage policies (files cannot be overwritten or removed by users).
Functions: support_is_manager, support_is_agent, support_is_customer, support_can_view_ticket, support_notify,
support_claim_invitations, support_create_ticket, support_add_message, support_update_ticket, support_add_attachment,
support_outbox_claim, support_outbox_finish, support_settings_guard (trigger), support_customers_guard (trigger).

## Live status
Applied 2026-10-15 to production gvftvswyrevummbvyhxa with owner approval: `proposal.sql` (sha256 2c7846e2…aa80c, identical
to the tested file; 112 checks + concurrency re-run on it before applying) and private bucket `support-attachments` (10 MB).
Order: SQL first (storage policies depend on the support tables, not on the bucket row; the SQL is one transaction, so a
failure leaves nothing), then the bucket, created private. A first attempt failed on a transcription typo and left no
objects (verified). Frontend remains preview-only; email sender not deployed; AI knowledge still says ticketing is unavailable.
Linter: the email queue has RLS with no policies on purpose (server-only); support RPCs are intentionally callable by
signed-in users and enforce their own checks; the two guard functions are trigger-only.

## Deployment order (after approval)
1. Create bucket `support-attachments` (private, 10 MB).  2. Apply `proposal.sql`.  3. Publish the frontend.
4. Later, separately approved: copy and deploy `support-email-sender` with `SUPPORT_EMAIL_ENABLED` unset, then schedule it,
   then set `SUPPORT_EMAIL_ENABLED=true` only when the owner approves sending.

## Rollback impact
1. Run `export.sql` and save the JSON. This holds database rows and the file LIST only, not file contents.
2. Copy the attachment BYTES before anything is deleted: with a service-role session, list every object in bucket
   `support-attachments` (paths match `support_attachments.storage_path`), download each file, keep the original
   `<org>/<ticket>/<file>` folder layout, then check the downloaded count and total size against the export. Store the
   backup privately (it contains customer files and private-note attachments). Do not continue until this is verified.
3. Run `rollback.sql`: deletes every ticket, reply, private note, attachment record and queued email; keeps delivered
in-app notifications. 4. Empty and delete the bucket with the storage tool (files are not removed by SQL).
No existing table is touched in either direction.

## Invitations
Bound only to the signed-in account whose email in auth.users is confirmed (token email is not trusted); single use;
unclaimed invitations expire after 14 days (admin can extend); revoked invitations can't be claimed; one account can be
a customer of several companies, each isolated; company members are never bound as customers of their own company.

## Signed links
Downloads use 60-second signed links created only after the database rule allows the file. A link already issued keeps
working until it expires (max 60 s) even if access is removed in that minute; it can't be revoked early. Anyone holding
the link during those 60 s can open the file.

## Email queue rules
Claimed with row locks so two runs never take the same email. Max 5 attempts; failures before the message is handed
over retry after 5, 15, 45, 135 min. Timeouts or failures after hand-over become "uncertain" and are never resent
automatically (avoids duplicates; may mean one email is missing). "accepted_by_provider" is not inbox delivery.
Emails are plain text with reference, subject and the public reply only; no private notes, no attachments.

## Permission matrix
| Action | Owner/admin | Support agent (member + agent row) | Other member | External customer | Other company / signed out |
|---|---|---|---|---|---|
| Set up support, categories, hours | yes | no | no | no | no |
| Add/remove agents (must be company members) | yes | no | no | no | no |
| Invite/remove customers | yes | no | no | no | no |
| See tickets | all in company | all in company | none | own only, while invited and portal on | none |
| Private staff notes and their files | yes | yes | no | never | no |
| Create ticket | yes | yes | no | yes (10/hour) | no |
| Reply | yes | yes | no | own, not when closed | no |
| Status / priority / assign | yes | yes | no | reopen own resolved/closed only | no |
| Projects, CRM, finance | unchanged | unchanged | unchanged | none (not a member) | none |

## Entitlement proposal (not implemented)
External customers are not `organization_members`, so they never count as staff seats. Agents are already
paid members. Suggested later: a per-plan cap on active customer accounts. No billing or plan change made.

## Email
RPCs queue acknowledgements and public-reply notices in `support_email_outbox` with a unique dedupe key
(one per ticket/reply + recipient). Private notes never queue email. Saving a ticket/reply never depends on email.
A sender function (reusing the existing workflow SMTP sender) is NOT written or deployed yet; status will read
"accepted by provider", never "delivered".

## Test results r1 (throwaway database, 2026-10-15)
74/74 PASS: setup/permissions, self-promotion refused, ticket numbering, retry/double-submit (incl. simultaneous),
customer isolation, private-note and private-file isolation, guessed IDs, direct API writes refused, status rules,
reopen, attachment size/type/path, revoked customer, removed agent, portal off, anon refused, outbox server-only,
export, rollback, and atomic failure. Caveat: other tables are stand-ins, not a full schema replay.

## Test results r2 (2026-10-15)
Throwaway database now mirrors live organizations / organization_members / notifications / auth.users / storage.objects
columns, constraints, FKs and policies. 112 checks + concurrency, 0 failures (39 new: invitations, agents, storage,
email queue). Sender: 7/7 Deno tests. App rules: 8/8 vitest.
