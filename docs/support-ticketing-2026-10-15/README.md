# Support ticketing — release package (NOT APPLIED)

Reusable per-company helpdesk. NG TELECOM is the first company to use it; nothing is hard-coded for it.
Target when approved: gvftvswyrevummbvyhxa. Status: preview code only; no live change, deploy or publish.

## Files
- `proposal.sql` — one transaction, additive only (8 new `support_*` tables, helpers, RPCs, 2 storage policies).
- `rollback.sql` — removes only those objects. **Deletes all tickets/replies/notes/attachment records.** Run `export.sql` first.
- `export.sql` — JSON copy of every support record.
- `test.sql` + `run-test.sh` — disposable local Postgres; live membership helpers copied verbatim.
- Separate step at approval: create private bucket `support-attachments` (10 MB limit) with the storage tool.

## Affected tables
New only: support_settings, support_categories, support_agents, support_customers, support_tickets,
support_messages, support_attachments, support_email_outbox. Writes rows to existing `notifications` (type `support`).
No existing table, policy, billing, plan or seat logic changes. Data loss on apply: none.

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

## Test results (throwaway database, 2026-10-15)
74/74 PASS: setup/permissions, self-promotion refused, ticket numbering, retry/double-submit (incl. simultaneous),
customer isolation, private-note and private-file isolation, guessed IDs, direct API writes refused, status rules,
reopen, attachment size/type/path, revoked customer, removed agent, portal off, anon refused, outbox server-only,
export, rollback, and atomic failure. Caveat: other tables are stand-ins, not a full schema replay.
