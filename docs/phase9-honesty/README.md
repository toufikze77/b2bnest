# Phase 9: fake "Connected" integrations — prepared cleanup (NOT applied)

**Status: prepared, not run.** Nothing here has been run on production. The owner approves first.

## What happened

`src/components/crm/IntegrationsTab.tsx` and `src/components/crm/ServicesTab.tsx` (removed in Phase 9) called
`store_integration_tokens` with the literal `'placeholder_token'` when "Connect" was clicked for a service with no real
connection flow (Zapier, Make, Webhooks, Calendly, Stripe, Plaid, Notion, ClickUp, Slack, Zoom, Microsoft Teams,
Google Meet), then showed "Connected". Neither tab was rendered by any page in this repository's history, so any such
rows date from an earlier version of the app.

Tokens are stored through `public.encrypt_integration_token`, which is base64 with an `ENC:` prefix (not real
encryption), so the placeholder is stored as `ENC:cGxhY2Vob2xkZXJfdG9rZW4=`; the queries decrypt instead of matching text.

## Files

| File | What it does |
| --- | --- |
| `count-placeholder-integrations.sql` | Read-only. Placeholder rows per service, how many show as connected, how many users. Run before and after. |
| `cleanup-placeholder-integrations.sql` | Copies the placeholder rows to `phase9_placeholder_integrations_backup` (RLS on, no grants), then deletes only those rows. Idempotent. |
| `rollback-placeholder-integrations.sql` | Puts the backed-up rows back exactly, unless the user has since connected that service for real. Idempotent. |
| `run-test.sh` | Throwaway local Postgres test (never production). |

## Order

1. Run `count-placeholder-integrations.sql` and keep the result.
2. After approval, run `cleanup-placeholder-integrations.sql`.
3. Run the count again: it must return no rows.
4. If anything looks wrong: `rollback-placeholder-integrations.sql`.
5. Later, separately: drop `public.phase9_placeholder_integrations_backup`.

## Local test (what was run)

`bash docs/phase9-honesty/run-test.sh` with five rows (placeholder stored encrypted, placeholder in plain text, two
real tokens, one row with no token): count finds the 2 placeholder rows; cleanup run twice leaves the 3 others;
backup holds 2 rows and is not readable by anon/authenticated; rollback run twice restores all rows byte-for-byte.
