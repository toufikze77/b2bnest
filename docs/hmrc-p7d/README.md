# HMRC P7d: narrowed CORS, tighter anonymous helpers, live privacy wording

**Nothing here is applied or deployed.** HMRC stays sandbox only. Production was only read, on 9 Nov 2026:
- function bodies (as md5) and grants;
- policies;
- the list of deployed Edge Functions.

No secret was read or set. This PR claims no HMRC approval, penetration test, accountant check, WCAG conformance or lawyer's sign-off.

## What changed

1. **CORS (Edge Functions), in code.** `supabase/functions/_shared/cors.ts` gains:
   - `corsFor(req)`: echoes the request's `Origin` only when it is allowed, sends no `Access-Control-Allow-Origin` otherwise, and always sends `Vary: Origin`. It keeps the allowed headers (`authorization, x-client-info, apikey, content-type`) and adds `Access-Control-Allow-Methods: POST, GET, OPTIONS`;
   - `preflight(req)`: the answer to an OPTIONS request, 200 as before;
   - `withNarrowCors(handler)`: re-heads a handler's answers.

   The browser-called sensitive functions are migrated. The old `corsHeaders` (`*`) is still exported, marked deprecated, so nothing else changes. The demo guard gets an optional `headersFor`, so a migrated function's demo refusal carries the narrowed headers too.
2. **Anonymous database helpers (SQL prepared, NOT applied).** `docs/hmrc-p7d/proposal.sql` revokes EXECUTE from `anon` (and PUBLIC) on five helpers. Nothing else changes: no policy, trigger, table or function body.
3. **Live Privacy Policy** (`src/pages/PrivacyPolicy.tsx`): the true data wording, last updated 9 November 2026. Terms of Service are untouched.
4. **`supabase/config.toml`** now lists `change-subscription-plan` with `verify_jwt = true`. Production showed it **off**; the handler already refuses a request without a token (see Risks).

## 1. CORS

**Allow-list:**
- `https://www.b2bnest.online` and `https://b2bnest.online`;
- the optional Edge Function secret `CORS_ALLOWED_ORIGINS`: comma separated, exact `https://host[:port]` values, no wildcards;
- `http://localhost:<port>` and `http://127.0.0.1:<port>`, only when the secret `CORS_ALLOW_LOCALHOST=1`.

**Lovable hosts found in the repository** (not hard-coded; add to `CORS_ALLOWED_ORIGINS` only if you test there):
- the published Lovable address, `https://b2bnest.lovable.app` (seen in `src/components/ProtectedRoute.test.tsx`);
- the preview, `https://id-preview--<project-id>.lovable.app`;
- the editor's preview frame, `https://<project-id>.lovableproject.com` (`src/integrations/supabase/previewAuthStorage.ts`).

The project id is in your Lovable project URL. Example value:
`CORS_ALLOWED_ORIGINS=https://b2bnest.lovable.app,https://id-preview--<project-id>.lovable.app`.

**What it protects:**
- A page on another site can no longer read the answers of the migrated functions in a browser.
- This is defence in depth. Every migrated function still needs a signed-in Supabase JWT (`verify_jwt = true`) and checks the caller itself. CORS never applies to server-to-server callers.

**Tests:** `supabase/functions/_shared/cors_test.ts` has 9 tests:
- an allowed origin is echoed with `Vary`; a disallowed one gets nothing; localhost only with the secret; extra origins exact only; preflight status;
- one test for each migrated family (HMRC, the HMRC P8 reads, data rights including the ZIP, the two `handler.ts` functions, the billing and admin functions, the demo refusal);
- the webhooks and callbacks are untouched.

The full Deno suite passes with 513 tests.

### The 65 files that used the old CORS headers

18 migrated, 16 left as is, 31 follow-ups.

| File | Decision |
| --- | --- |
| `_shared/cors.ts` | migrated: adds `corsFor`, `preflight` and `withNarrowCors`; the old `corsHeaders` (`*`) stays, marked deprecated, for the functions not yet migrated |
| `_shared/data-rights/serve.ts` | migrated (`data-export`, `account-delete`, `company-close`), including the ZIP download and the demo refusal |
| `_shared/demo-guard.ts` | migrated where asked: new `headersFor` option, so a migrated function's demo refusal carries the narrowed headers; without it the refusal is unchanged |
| `_shared/hmrc/readServe.ts` | migrated (`hmrc-vat-return-view`, `-liabilities`, `-payments`, `-penalties`) |
| `_shared/hmrc/serve.ts` | migrated (`hmrc-connect-start`, `hmrc-connect-complete`, `hmrc-disconnect` and the shared `serveHmrcRequest`) |
| `activate-trial/index.ts` | follow-up |
| `admin-reset-mfa/index.ts` | migrated |
| `admin-set-user-ban/index.ts` | migrated |
| `ai-assistant/handler.ts` | follow-up |
| `b2b-form-submit/index.ts` | follow-up (public form for signed-out visitors) |
| `business-insights/handler.ts` | follow-up |
| `change-subscription-plan/index.ts` | migrated |
| `check-subscription/index.ts` | migrated (runs on page load, so `www` and the bare domain are both allowed) |
| `create-ai-topup-checkout/index.ts` | migrated |
| `create-coinbase-charge/index.ts` | follow-up (browser-called; Coinbase payments to retest) |
| `create-payment/index.ts` | follow-up (browser-called payment) |
| `create-subscription-checkout/index.ts` | migrated |
| `create-subscription-invoice/index.ts` | migrated |
| `customer-portal/index.ts` | migrated |
| `firecrawl-scrape/index.ts` | follow-up |
| `generate-legal-document/handler.ts` | migrated (wrapped with `withNarrowCors`) |
| `generate-template/handler.ts` | follow-up |
| `generate-template/index.ts` | follow-up |
| `get-oauth-config/index.ts` | follow-up (read only) |
| `google-calendar-sync/index.ts` | follow-up |
| `hmrc-test-call/index.ts` | migrated |
| `hmrc-vat-obligations/index.ts` | migrated |
| `hmrc-vat-submit/index.ts` | migrated |
| `notion-sync/index.ts` | follow-up |
| `oauth-facebook/index.ts` | left as is, because it is an OAuth callback from Meta |
| `oauth-gmail-callback/index.ts` | left as is, because it is an OAuth callback from Google |
| `oauth-gmail-init/index.ts` | left as is, because it starts the Google OAuth flow; changed together with its callback later |
| `oauth-google-calendar/index.ts` | left as is, because it is an OAuth callback from Google |
| `oauth-icloud-calendar/index.ts` | left as is, because it handles the calendar provider's OAuth callback |
| `oauth-linkedin/index.ts` | left as is, because it is an OAuth callback from LinkedIn |
| `oauth-onedrive/index.ts` | left as is, because it is an OAuth callback from Microsoft |
| `oauth-outlook-calendar/index.ts` | left as is, because it is an OAuth callback from Microsoft |
| `oauth-outlook-init/index.ts` | left as is, because it starts the Microsoft OAuth flow; changed together with its callback later |
| `oauth-twitter-request/index.ts` | left as is, because it starts the X OAuth flow with a provider callback; changed together with its callback later |
| `oauth-twitter/index.ts` | left as is, because it is part of the X (Twitter) OAuth flow |
| `public-work-request/index.ts` | follow-up (public form for signed-out visitors) |
| `send-2fa-email/index.ts` | follow-up (sign-in path: a mistake would lock people out, so it gets its own change and a sign-in test) |
| `send-contact-email/index.ts` | follow-up (public contact form) |
| `send-document-email/handler.ts` | migrated (wrapped with `withNarrowCors`; GET and POST) |
| `send-invitation-email/index.ts` | follow-up |
| `send-task-notification/index.ts` | follow-up |
| `share-project/index.ts` | follow-up |
| `share-task/index.ts` | follow-up |
| `sign-oauth-state/index.ts` | follow-up (OAuth start helper) |
| `slack-commands/index.ts` | left as is, because Slack's servers call it (signed) |
| `slack-interactions/index.ts` | left as is, because Slack's servers call it (signed) |
| `store-twitter-credentials/index.ts` | follow-up |
| `stripe-webhook/handler.ts` | left as is, because Stripe's servers call it (signed); CORS does not apply |
| `stripe-webhook/index.ts` | left as is, because Stripe's servers call it (signed) |
| `sync-note-to-email/index.ts` | follow-up |
| `trello-import/index.ts` | follow-up |
| `truelayer-integration/index.ts` | left as is, because it handles TrueLayer's OAuth redirect |
| `verify-2fa-code/index.ts` | follow-up (sign-in path, as above) |
| `whatsapp-connect/index.ts` | follow-up (browser-called; WhatsApp/Twilio side to check first) |
| `whatsapp-disconnect/index.ts` | follow-up (browser-called) |
| `workflow-execute/handler.ts` | follow-up |
| `workflow-linkedin-post/handler.ts` | follow-up |
| `workflow-send-email/handler.ts` | follow-up (its exported `corsHeaders` is still imported by `send-document-email`, whose answers are now re-headed) |
| `workflow-send-email/request.ts` | follow-up |
| `workflow-twitter-post/handler.ts` | follow-up |

The HMRC functions `hmrc-connect-start`, `hmrc-connect-complete`, `hmrc-disconnect` and the four HMRC P8 reads don't
mention CORS themselves. They are migrated through `_shared/hmrc/serve.ts` and `readServe.ts`.

## 2. The 18 SECURITY DEFINER functions `anon` can run

**How each was checked**, on production (read-only, 9 Nov 2026):
- every RLS policy that calls it, and every policy for `anon` or `public`;
- views, column defaults, CHECK constraints and functions that call it;
- `.rpc('<name>'` calls in `src/` and `supabase/functions/`.

**Why policies matter:** a policy written for the `public` role also applies to `anon`, and PostgreSQL needs the
caller's role to hold EXECUTE on every function a policy calls. So a helper used by a public-role policy has to keep
its `anon` grant. The test suite proves this: it revokes one inside a savepoint, and an anonymous read then fails.

| Helper | Decision | Why |
| --- | --- | --- |
| `is_project_member(uuid,uuid)` | **revoked from anon** | Used only by `authenticated` policies (`projects_org_select`, `projects_org_update`) and SECURITY DEFINER functions. No app call |
| `is_team_member(uuid,uuid)` | **revoked from anon** | Used by no policy, view or default. No app call |
| `owns_team(uuid,uuid)` | **revoked from anon** | Used only inside `get_team_members_with_profiles` (SECURITY DEFINER). No app call |
| `user_can_access_project(uuid,uuid)` | **revoked from anon** | Used only by `authenticated` policies (project activities, time entries) and SECURITY DEFINER `time_start` / `time_summary` |
| `get_invitation_by_token(text)` | **revoked from anon** | See below. The app doesn't call it: the invite page uses `org_invitation_preview`, which requires sign-in |
| `has_role(uuid,app_role)` | kept | `feedback_requests` policies for the `public` role call it |
| `is_admin_or_owner(uuid)` | kept | Public-role policies on `b2b_form_submissions`, `hmrc_submission_logs`, `staking_reward_pools`, `staking_rewards`, `staking_tiers` and `user_stakes`. `anon` can read `staking_reward_pools`, so revoking would break that read |
| `is_super_admin(uuid)` | kept | The public-role policy "anyone can view active plans" on `platform_plans`. Also called with the signed-in user's own id by `useSuperAdmin` |
| `user_is_organization_admin(uuid,uuid)` | kept | Public-role policies on `organization_members` |
| `user_is_organization_member(uuid,uuid)` | kept | Public-role policy on `organization_members` |
| `user_is_organization_owner(uuid,uuid)` | kept | Public-role policy on `organization_members` |
| `user_owns_project(uuid,uuid)` | kept | Public-role policies on `project_members` |
| `email_unsubscribe(text)` | kept (fine) | Needs a 64-hex token and only opts out |
| `template_usage_counts()` | kept (fine) | Aggregates only |
| `_data_rights_gate_is_open(text)` | kept (fine) | Returns whether a transaction-local gate is open; no data |
| `is_safe_profile_field(text)` | kept (fine) | Checks a field name against a fixed list |
| `wave1_enforce_org_membership()`, `wave1_todo_parent_tenant()` | kept (fine) | Trigger functions; they can't be called directly |

**The seven kept role helpers** can be revoked later. First rewrite their public-role policies `TO authenticated`.
That is a policy change, so it is out of scope here and listed as a follow-up.

**`get_invitation_by_token`, for the record:**
- the token is two random UUIDs joined (`org_invite_member`: `gen_random_uuid()::text || gen_random_uuid()::text`), about 244 random bits;
- invitations expire after 7 days (column default), and the function refuses expired, accepted and revoked ones;
- guessing is not rate-limited, but at that length guessing isn't practical;
- after the revoke, only signed-in callers can use it, and the app doesn't.

"Rate-limit invitation lookups" is therefore not needed for this function. It would only matter if an anonymous lookup comes back.

**SQL files:**
- `docs/hmrc-p7d/proposal.sql`: one transaction. It refuses unless production matches what was read: 148 tables, the five bodies' md5, the current grants, and nothing anonymous depending on them (policies, views, defaults, CHECKs, invoker functions).
- `rollback.sql`: grants `anon` back, exactly as before.
- `fixture.sql`: makes the local copy match production for the 14 helpers (production's exact bodies and grants).
- `test.sql` and `run-test.sh`: **44 PASS, 0 FAIL** on a disposable local Postgres (`PG_RUN_USER=postgres bash docs/hmrc-p7d/run-test.sh`).

The tests cover:
- as `anon`, each revoked helper is refused, while the kept ones, `email_unsubscribe`, `template_usage_counts` and the public pages' tables (templates, news, jobs) still answer;
- why the seven are kept;
- as `authenticated`, the helpers still work, company A sees only A's projects and invoices, and A can still create and edit its own but can't write as B or into company B;
- no body changes;
- the rollback restores the exact grant list;
- a second apply is refused;
- drift is refused (a helper used by an anon policy, a view or an invoker function; a changed body; a changed table set).

## 3. Privacy Policy

**Published:**
- the HMRC section: test environment only, the fraud prevention information sent, what we keep, that records of returns sent can't be changed or deleted, and that HMRC readings are shown live and not stored;
- how to download your data and company data, close a company or delete your account (Settings > Your data, with a fresh sign-in), and `info@b2bnest.online` for anything else;
- retention: 6 years after the VAT period, 12 months for test-environment records, tokens only while connected;
- that the business must keep its own VAT records, so download first.

The old `admin@b2bnest.online` is replaced by `info@b2bnest.online`, the only confirmed mailbox. Removed as unproven:
- "conduct security audits";
- "SSL technology";
- the general "we regularly update our security practices".

What was not published, and why, is listed at the top of `docs/hmrc-p7/privacy-wording.md`: legal bases, the full processor list, Edge Function location, international transfers, and automatic deletion (the purge isn't scheduled).

**Tests:**
- `src/pages/PrivacyPolicy.test.tsx` checks the rendered sections, the contact address and that no banned phrase appears;
- `src/test/noUnprovenPrivacyClaims.test.ts` now also fails on "(adviser", "DPO", "30 days" or "90 days", a named UK GDPR article, backup or audit claims, or another mailbox on this page.

## Owner steps

1. **Review** `docs/hmrc-p7d/proposal.sql` (and this README).
2. After your approval, **your assistant applies** `proposal.sql` in the Supabase SQL editor (one transaction).
3. **Only if you test on a Lovable preview:** set `CORS_ALLOWED_ORIGINS` (Supabase → Edge Functions → Secrets), for example `https://b2bnest.lovable.app`. Not needed for www.b2bnest.online or b2bnest.online.
4. **Redeploy the changed Edge Functions.** Only these import the changed CORS code in a way that changes their behaviour. The others keep `*` until they are migrated, so they don't need a redeploy.

   ```powershell
   cd C:\b2bnest-deploy
   git pull
npx.cmd supabase functions deploy hmrc-connect-start --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-connect-complete --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-disconnect --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-test-call --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-obligations --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-submit --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-return-view --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-liabilities --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-payments --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy hmrc-vat-penalties --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy data-export --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy account-delete --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy company-close --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy customer-portal --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy create-subscription-checkout --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy create-subscription-invoice --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy create-ai-topup-checkout --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy change-subscription-plan --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy check-subscription --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy admin-set-user-ban --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy admin-reset-mfa --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy send-document-email --project-ref gvftvswyrevummbvyhxa --use-api
npx.cmd supabase functions deploy generate-legal-document --project-ref gvftvswyrevummbvyhxa --use-api
   ```

   - JWT verification stays on. **Never use `--no-verify-jwt`.**
   - `change-subscription-plan` will come up with JWT verification **on** (it was off; see Risks).
   - `send-document-email` is deployed in production, so it is in the list.
5. **Publish the front end** (the Privacy Policy).

## Test after rollout

1. Open https://www.b2bnest.online and https://b2bnest.online and sign in on each. The site loads, and the dashboard and plan load (`check-subscription`).
2. **Settings → Billing:** open the plan view and the billing portal button (`customer-portal`). Don't change a plan unless you mean to.
3. **VAT Returns page:** get obligations, and check what HMRC holds for 18A1 (sandbox).
4. **Settings → Your data:** Download my data (asks for your password or code, then downloads the ZIP).
5. **Privacy Policy** at /privacy shows "Last updated: 9 November 2026" and the HMRC section.
6. Optional: in the browser's developer tools (Network), a function call from www.b2bnest.online shows `access-control-allow-origin: https://www.b2bnest.online` and `vary: Origin`.

## Rollback

- **CORS:** redeploy the previous version of each function from the previous commit (`git checkout <previous commit>`, then the same deploy commands).
- **SQL:** run `docs/hmrc-p7d/rollback.sql`.
- **Privacy page:** publish the previous front end.

## Risks

- **A host not on the allow-list** (for example a Lovable preview, or a new domain) can't read the migrated functions' answers until it is added to `CORS_ALLOWED_ORIGINS`. The live site's two hosts are on the list.
- **`change-subscription-plan`** had JWT verification off in production. Redeploying with `config.toml` turns it on.
  - A signed-in person is unaffected: the function already returns 401 without a token.
  - If anything called it without a user token, that call would now fail at the gateway. Nothing in the repository does.
- **The SQL guard** refuses if production has changed since 9 Nov 2026. If it does, read production again and update the md5s.

## Out of scope (not done)

- CORS for the 31 follow-up functions, including the sign-in path, public forms and payments other than Stripe.
- The 7 kept role helpers. Rewriting their public-role policies `TO authenticated` comes first.
- Rate-limiting invitation lookups. Not needed after the revoke.
- Legal bases, the full processor list, Edge Function location and international transfers on the Privacy Policy (owner and adviser).
- Scheduling the retention purge.
- An independent penetration test.
