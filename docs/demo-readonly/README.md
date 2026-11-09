# Demo account: view-only mode

**Prepared, not applied.** No SQL has been run, no Edge Function has been deployed, and no secret has been set. Nobody is view only until you add the demo user in step 4.

**What it does:** a person listed in `public.demo_readonly_users` can open every page and read everything, but cannot change, delete, send, spend or connect anything.
- **Database:** every insert, update or delete made with that person's login is refused with `This is a demo account. It is view only.` (SQLSTATE 42501). This covers the browser, any RPC they call, and anything else running with their JWT.
- **Edge Functions:** they run with the service role, which the database can't trace back to the person, so each function that writes, sends, spends or connects checks the list itself and answers HTTP 403 with the same message.
- **The app:** shows a banner, says "view only" instead of a raw error, and hides a few central buttons.

The guard is per person. It does not depend on who belongs to the demo company. Anyone not in the list keeps full write access, and a test checks this.

## What I read (production, read-only, 6 Nov 2026)
- **145 tables in `public`:** their key columns (`user_id`, `organization_id`, `company_id`, `owner_id`, `created_by`), RLS, triggers and non-SELECT policies. No trigger name sorts before `a1`, so `a0_demo_readonly_guard` fires first.
- **Every function a signed-in person can execute** that writes a table.
- **Functions that write while a page is only being read:**
  - `get_user_integrations_safe` → `integration_audit_logs`
  - `get_bank_accounts_safe` → `banking_audit_logs`
  - `get_user_payments` → `payment_audit_logs`
  - `get_advertisement_contact_info` → `security_audit_logs`
  - `get_notification_preferences` → inserts the default `user_notification_preferences` row
  - `get_ai_credits_info` → the monthly reset of `subscribers`, only when the reset date has passed
  - `support_claim_invitations` → `support_customers`, only when an invitation matches the person's email
- **The demo account:**
  - one `master_access` row;
  - one `subscribers` row, with `ai_credits_reset_date` 4 Dec 2026;
  - no two-step factor;
  - the only member of the demo company;
  - **one open support invitation matches its email.**
- **Helper hashes:** `mfa_ok` `20516f2e…` and `require_aal2_if_enrolled` `10b2ae7b…`.
- **Every Edge Function** in `supabase/functions/`.
- **Sign-in:** the app writes nothing while signing in. Supabase Auth writes only to the `auth` schema, where `auth.uid()` is not set.

## Database (`proposal.sql`)
1. **`public.demo_readonly_users`** (`user_id` primary key → `auth.users` on delete cascade, `label`, `created_at`).
   - RLS on, with the Phase 25 restrictive aal2 policy.
   - No permissive policy and no client privileges. Only the SQL editor and the service role can read or write it.
2. **`public.is_demo_readonly()`**:
   - SECURITY DEFINER, `search_path = ''`, Phase 25 guard line, and a `phase25_mfa_guard_log` row (kind `user`);
   - EXECUTE for `authenticated` only, never `anon`;
   - true or false for the caller.
3. **`public.demo_readonly_guard()`**, the trigger function:
   - if `auth.uid()` is set and listed, it raises 42501 with the message; otherwise it returns NEW (OLD for a delete);
   - one primary-key lookup, and only when a person's JWT is present;
   - EXECUTE revoked from everyone. It is a trigger function, not an RPC, which Phase 25 exempts.
4. **Trigger `a0_demo_readonly_guard`** (BEFORE INSERT OR UPDATE OR DELETE, FOR EACH ROW) on the 133 guarded tables.
5. **Safety checks.** It refuses, changing nothing, if:
   - the objects already exist;
   - the 145 table names differ from production (md5 `bb4652cf…`);
   - either helper hash differs;
   - a trigger would fire before the guard.

   After attaching the triggers it checks again that every table is guarded or allowed.

No existing function body, policy or grant changes. `check-coverage.sql` is a read-only check you can run any time: it lists any table that has neither the guard nor an allow-list entry.

### Guarded and allowed tables
Every table in `public` is guarded except the allow-list below. That is broader than "tables with those columns", so tables reached only through others (`profiles`, `messages`, `payroll_run_items`, …) are covered too. The source of truth is `tables.json`.

<details><summary>The 133 guarded tables</summary>

`admin_audit_logs`, `advertisement_categories`, `advertisements`, `ai_conversations`, `ai_credit_ledger`, `ai_credit_lots`, `ai_model_prices`, `ai_topup_checkouts`, `ai_topup_packs`, `ai_workflows`, `ai_workspaces`, `b2b_form_submissions`, `bank_accounts`, `bank_transactions`, `bills`, `business_insights`, `companies`, `connections`, `crm_contacts`, `crm_deals`, `document_email_log`, `documents`, `email_optouts`, `expenses`, `feedback_requests`, `forum_posts`, `forum_replies`, `free_tool_items`, `hmrc_audit_log`, `hmrc_connections`, `hmrc_integrations`, `hmrc_oauth_states`, `hmrc_p0_backup`, `hmrc_settings`, `hmrc_submission_logs`, `integration_settings`, `invoices`, `job_postings`, `marketing_audiences`, `marketing_campaigns`, `marketing_consents`, `marketing_content_items`, `master_access`, `messages`, `news_articles`, `note_categories`, `notes`, `onboarding_email_outbox`, `organization_billing`, `organization_invitations`, `organization_members`, `organizations`, `outgoings`, `payment_notifications`, `payments`, `payroll_employees`, `payroll_run_items`, `payroll_runs`, `payroll_submissions`, `phase12_subscribers_backup`, `phase12_trial_flags_backup`, `phase25_mfa_guard_log`, `phase31_backup`, `phase32_backup`, `phase35_function_backup`, `phase35_guard_log_backup`, `phase37_function_backup`, `phase37_guard_log_backup`, `plan_prices`, `platform_plan_prices`, `platform_plans`, `platform_settings`, `platform_tools`, `post_comments`, `post_likes`, `products_services`, `profiles`, `project_activities`, `project_members`, `project_share_logs`, `project_time_entries`, `projects`, `quotes`, `rota_employees`, `rota_leave_allowances`, `rota_leave_requests`, `rota_shifts`, `rota_week_publications`, `security_settings`, `social_posts`, `staking_reward_pools`, `staking_rewards`, `staking_tiers`, `staking_transactions`, `staking_wallet_links`, `stripe_webhook_events`, `subscribers`, `suppliers`, `support_agents`, `support_attachments`, `support_categories`, `support_customers`, `support_email_outbox`, `support_messages`, `support_notification_prefs`, `support_settings`, `support_ticket_feedback`, `support_tickets`, `team_members`, `teams`, `template_applications`, `template_catalog`, `template_events`, `time_tracker_settings`, `todo_comments`, `todo_history`, `todo_subtasks`, `todos`, `trial_email_outbox`, `trial_email_settings`, `user_2fa_attempts`, `user_2fa_codes`, `user_2fa_settings`, `user_ai_preferences`, `user_document_templates`, `user_documents`, `user_integrations`, `user_roles`, `user_stakes`, `wave1_backfill_journal`, `wave1_created_objects`, `wave1_unresolved_rows`, `workflow_run_logs`

</details>

| Allowed table | Why it has no guard |
|---|---|
| `audit_logs` | Append-only audit log. Written by log_user_action / audit_profile_access while pages load; holds no business data the demo user could change. |
| `banking_audit_logs` | Append-only. get_bank_accounts_safe writes a row when the finance assistant reads bank accounts. |
| `demo_readonly_users` | Created by this proposal. No client privileges at all; only the owner (SQL editor) or the service role writes it. |
| `integration_audit_logs` | Append-only. get_user_integrations_safe writes a row each time the Integrations cards load. |
| `notification_logs` | Append-only send log of notifications. |
| `notification_type_prefs` | Per-user notification preferences (on/off per type). No business data. |
| `notifications` | Notification read state: the Notifications panel marks items read (UPDATE of own rows only). |
| `payment_audit_logs` | Append-only. get_user_payments writes a row when payments are read. |
| `security_audit_logs` | Append-only security log. get_advertisement_contact_info writes a row when a page reads contact details. |
| `trial_email_log` | Append-only send log of the trial emails (written by the trial email sender with the service role). |
| `user_favorite_tools` | Per-user favourite tools in the tool list. No business data. |
| `user_favorites` | Per-user UI favourites. No business data. |
| `user_notification_preferences` | Per-user notification preferences. get_notification_preferences inserts the default row on load (INSERT ... ON CONFLICT DO NOTHING still fires BEFORE INSERT triggers). |

`tables.json` also lists four tables that old migrations create but production no longer has (`calendar_events`, `goals`, `staging_cost_test_runs`, `work_requests`), so the repo test does not flag them.

### Why these are allowed
- **Logs and audit tables:** append-only, and written by the read functions listed above. If they were guarded, every page that loads integrations, bank accounts or payments would fail for the demo user.
- **Notifications, notification preferences and favourites:** per-person read state and preferences with no business data. `get_notification_preferences` inserts a default row on load. `INSERT … ON CONFLICT DO NOTHING` still fires BEFORE INSERT triggers, and the suite checks this.
- **Guarded on purpose, although the app writes them on load:**
  - `subscribers`: `check_and_deduct_ai_credit`, which a signed-in person can call, spends credits through it. Because it is guarded, the monthly reset in `get_ai_credits_info` would be refused for the demo user after 4 Dec 2026. See step 4b.
  - `template_events`: analytics, and the app already ignores a failed write.
  - `support_customers`: claiming the matching invitation is refused. The Support portal now ignores that one refusal and still loads.

## Edge Functions
All of them use one helper, `supabase/functions/_shared/demo-guard.ts`.
- **`withDemoGuard`, `guardedServe` and `guardedDenoServe`** wrap the whole handler. They read the person from the request's own JWT (`sub` of a `role: authenticated` token) and look them up in `demo_readonly_users` with the service role.
  - The JWT is not verified at this step. It only decides whether to refuse, and the `sub` can't be changed without breaking the signature, which the function and the gateway still check.
  - If the table doesn't exist yet, nobody is a demo user.
  - Any other lookup failure answers 503, so a demo person is never let through.
- **`demoRefusal(userId)`** is used in the OAuth callbacks, right after the signed state gives the person and before anything is stored.
- **A Deno test** fails if a function has no decision, or if a refused function lacks the guard.

| Function | Decision | Why |
|---|---|---|
| ai-assistant, business-insights, generate-legal-document, generate-template | **refuse** | They spend AI credits. Refused by default: the demo person shouldn't use up the owner's credits or model budget. |
| firecrawl-scrape | **refuse** | Spends paid third-party scraping |
| activate-trial | **refuse** | Writes the trial |
| change-subscription-plan, create-ai-topup-checkout, create-coinbase-charge, create-payment, create-subscription-checkout, create-subscription-invoice, customer-portal | **refuse** | Checkout, portal and subscription changes |
| send-contact-email, send-document-email, send-invitation-email, send-task-notification, sync-note-to-email | **refuse** | They send email |
| share-project, share-task | **refuse** | They share and send |
| workflow-execute, workflow-send-email, workflow-linkedin-post, workflow-twitter-post | **refuse** | They run workflows, send and post |
| hmrc-connect-start, hmrc-connect-complete, hmrc-disconnect, hmrc-test-call, hmrc-vat-obligations (HMRC P3), hmrc-vat-submit (HMRC P6), hmrc-vat-return-view, hmrc-vat-liabilities, hmrc-vat-payments, hmrc-vat-penalties (HMRC P8) | **refuse** | HMRC connect, disconnect, test, obligations, VAT submissions and the HMRC P8 reads (test environment). Refused by `guardedDenoServe` before any HMRC check. The new table `hmrc_vat_submissions` (HMRC P6) has the `a0_demo_readonly_guard` trigger, so a demo write is refused in the database too. |
| data-export, account-delete, company-close (HMRC P7b) | **refuse** | Downloading, deleting the account and closing a company. Refused by `guardedDenoServe` (via `serveDataRights`) before anything runs, and again in the handler and in the SQL functions. The new tables `data_rights_requests` and `_data_rights_gate` have the `a0_demo_readonly_guard` trigger. |
| sign-oauth-state, oauth-gmail-init, oauth-twitter-request | **refuse** | Start a connection |
| oauth-facebook, oauth-gmail-callback, oauth-google-calendar, oauth-icloud-calendar, oauth-linkedin, oauth-onedrive, oauth-outlook-calendar, oauth-twitter | **refuse** (`demoRefusal`) | OAuth callbacks. The person comes from the signed state, and the check runs before tokens are stored. |
| store-twitter-credentials, whatsapp-connect, whatsapp-disconnect, truelayer-integration | **refuse** | Connect or disconnect |
| trello-import, notion-sync, google-calendar-sync | **refuse** | Import or sync into the account |
| check-subscription | not refused | Runs on page load and only syncs the plan row from Stripe. Refusing it would break every page. |
| send-2fa-email, verify-2fa-code | not refused | Sign-in path (the person's own code) |
| admin-reset-mfa, admin-set-user-ban | not refused | Platform super admins only |
| get-oauth-config | not refused | Read only |
| oauth-outlook-init | not refused | Builds an address only; its callback refuses |
| b2b-form-submit, public-work-request | not refused | Public forms for signed-out visitors |
| stripe-webhook, slack-commands, slack-interactions | not user-facing | Signed calls from Stripe or Slack. A demo person can't link Slack, because connecting is refused. |
| onboarding-email-sender, trial-email-sender, support-email-sender | not user-facing | Scheduled senders with the service role. Their queues are written only through guarded tables. |

## Frontend
- **`DemoModeProvider`** (`src/contexts/DemoModeContext.tsx`) calls `is_demo_readonly()` once for each signed-in person. If the call fails, the person is treated as not in demo mode; the database guard is the real protection.
- **`DemoBanner`**: "Demo account: view only. Sign up free to try it with your own data." with **Sign up**. Switched off for now (`SHOW_DEMO_BANNER = false` in `src/lib/demoMode.ts`; internal-only demo).
  - Shown at the top of every page, in the app shell and on public pages.
  - Sticky, `role="status"`, wraps at phone width, light and dark.
  - Sign up signs out this device only, then opens the sign-up page.
- **Friendly errors, in one place** (`src/lib/demoMode.ts`):
  - a fetch wrapper on the Supabase client notices any 403 carrying the demo message, from PostgREST or an Edge Function;
  - for the next few seconds, a failure toast (shadcn `toast()` with `variant: 'destructive'`, or sonner's `toast.error`) shows "View only · This is a demo account. It is view only.";
  - toasts that already carry the message are tidied the same way;
  - this covers every screen that already shows a failure toast (both toast systems), so no screen was edited;
  - for normal users nothing is ever noted, so nothing changes.
- **Hidden or disabled in demo mode** (cheap and central):
  - **Settings → Security:** two-step setup and "Sign out other devices", which would sign out every viewer of the shared login.
  - **Settings → Account:** the Change password card. `updatePassword` itself also refuses.
  - **Settings → Members:** the invite form.
  - **Settings → Billing:** shown, but its controls sit in a disabled fieldset.
  - **Integrations:** connecting through `useOAuthConnect` (all the OAuth cards) shows the message instead.
  - **Dashboard:** Quick add.
  - **Sign out** (header and menu) signs out this device only. Supabase's default sign-out ends every session of the account.
- **Account deletion:** there is no self-service delete-account control in the app, so there was nothing to hide.
- **Left to the database and Edge Function guard:** every other create, edit or delete button. Hiding them isn't central, and the failure toast already says "view only".

## Supabase Auth: what the demo password can still do
Table triggers don't cover Supabase Auth. Anyone with the demo password and the public anon key can call the Auth API directly, outside the app. The items below come from the documented Supabase Auth client API. I have **not verified them against this project's Auth settings**.
- **Change the password** (`updateUser({ password })`), which locks the next viewer out. The app hides this; the API doesn't. If "Secure password change" is on, it asks for a recent sign-in, which a fresh demo session already has.
- **Change the email** (`updateUser({ email })`). With "Secure email change" on (Supabase's default; not verified here), both addresses must confirm, so it can't finish without access to the owner's inbox.
- **Enrol a two-step factor** (`mfa.enroll`, then verify). Every later viewer would then need that factor, and the Phase 25 policies would ask for aal2.
- **Sign out every session** (`signOut({ scope: 'global' })`), ending other viewers' sessions.
- **Change user metadata** (`updateUser({ data })`).
- **Ask for password-reset or magic-link emails**, which only reach the demo address.
- **Delete the account:** the supabase-js client has no self-service delete (deleting needs the admin API).

**Hardening you can do in the dashboard:**
- Give the demo account a long random password and rotate it when you share a new link.
- Don't enrol two-step on it.
- Keep "Secure email change" on.
- Watch Authentication → Users for a changed email or a new factor. To recover, reset the password and remove the factor from the dashboard (the existing `admin-reset-mfa` works for factors).

I couldn't find an Auth hook that blocks a signed-in user from changing their own password or enrolling a factor, so I'm not claiming one exists. Banning the user would also block sign-in, so it doesn't help a demo.

## Rollout (owner)
1. **Apply `docs/demo-readonly/proposal.sql`** after review. It refuses, changing nothing, on any drift listed above.
2. **Deploy the changed Edge Functions:** the 46 marked "refuse" above. The HMRC three change only through `_shared/hmrc/serve.ts`, but must be redeployed. A function not yet redeployed doesn't check, but the database still refuses that person's own writes.
3. **Publish the frontend.**
4. **Switch the demo user on**, with this one statement in the SQL editor:
   ```sql
   INSERT INTO public.demo_readonly_users (user_id, label) VALUES ('4898a58c-c505-49e8-a657-91fae96ebe6f', 'Public demo account');
   ```
   - Master access is already granted (one `master_access` row on 6 Nov 2026), so nothing else is needed for full read access.
   - **4b (recommended, data only):** the demo user's monthly AI-credit reset would be refused after 4 Dec 2026, and the credit balance would then fail to load. Move the date out of the way from the SQL editor:
     ```sql
     UPDATE public.subscribers SET ai_credits_reset_date = '2099-01-01' WHERE user_id = '4898a58c-c505-49e8-a657-91fae96ebe6f';
     ```
   - **Optional:** revoke the open support invitation that matches the demo email if it isn't wanted. Claiming it is refused either way.

   To switch the demo user off: `DELETE FROM public.demo_readonly_users WHERE user_id = '4898a58c-c505-49e8-a657-91fae96ebe6f';`. The change is immediate, and the suite tests it.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,492 / 1,492 pass (156 files) |
| `npm run build` | OK |
| Deno, all function tests | 435 / 435 pass (9 new in `_shared/demo-guard_test.ts`) |
| `deno check` of every changed function | no new errors. The same 11 errors as before this change, in 9 functions (`catch` values typed `unknown`, `never[]`). |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/demo-readonly/run-test.sh`) | 45 / 45 PASS |

**The SQL suite** (fictional users only):
- production table set and helper hashes;
- 133 guards, the guard log row, privileges, RLS, and the guard firing first;
- the demo user refused on insert, update and delete across several tables (including a real fixture table, `organization_members`), on `ON CONFLICT DO NOTHING`, and through two SECURITY DEFINER RPCs (an invoice, and spending credits);
- the demo user can still read everything, and the page-load writes still work;
- the demo user can't read or edit the list;
- another signed-in user keeps full write access, directly and through the RPCs;
- the service role and the SQL editor are unaffected;
- anon can't call `is_demo_readonly`;
- taking someone off the list restores their access at once;
- coverage passes, and fails for a new table;
- empty and forced rollback both restore the fingerprint exactly (functions, privileges, tables, triggers, policies, guard log);
- re-apply works; a second apply is refused; rollback is refused with rows unless forced, and refused when not applied;
- cascade on deleting the auth user;
- drift refused (a new table, a trigger before the guard, a changed helper), with nothing applied.

**vitest:**
- `src/test/demoMode.test.ts`: error mapping, the fetch wrapper, both toast systems, and normal mode unchanged.
- `src/components/demo/demoMode.test.tsx`: the banner only in demo mode, local sign-out, and Security controls hidden only in demo mode.
- `src/hooks/useOAuthConnect.demo.test.ts`.
- `src/test/demoReadonlyCoverage.test.ts`: every table in migrations, the generated types and `docs/*/proposal.sql` is classified, and the SQL lists equal `tables.json`.
- `edgeFunctions.test.ts`: `send-document-email`'s flattened layout now also has `shared_demo-guard.ts` and `shared_cors.ts`.

**Deno:** `deno.land` and `esm.sh` are blocked here, so the runs used local stand-ins for std, supabase-js, stripe and denomailer, as in the earlier phases.

## Security advisor expectations
- One new SECURITY DEFINER function callable by signed-in users (`is_demo_readonly`). It has the Phase 25 guard, a fixed `search_path` and no anon access, and returns only the caller's own yes or no.
- `demo_readonly_guard` is a SECURITY DEFINER trigger function with no EXECUTE for anyone.
- `demo_readonly_users` has RLS on with no permissive policy. The advisor may note "RLS enabled, no policy" as information; that is intended (no client access).

## Rollback
- **`rollback.sql`:** drops all 133 triggers, both functions, the guard log row and the table, exactly.
- It refuses while anyone is listed, unless forced with `SET app.demo_readonly_force = 'on';`. Take the demo login down first: after a rollback the demo user can change data again.
- **Edge Functions:** redeploy the previous versions. Before the table exists, the guard treats everyone as not demo.

## Risks and not done
- **Storage uploads aren't covered.** `storage.objects` is outside `public`, so the demo user can still upload files to buckets their storage policies allow (for example a profile picture; the follow-up `profiles` update is refused). A trigger on `storage.objects` is possible, but I haven't verified that the owner role may create it there, so it isn't in this proposal.
- **Supabase Auth self-service** (above) is limited by the app and dashboard settings only.
- **The edge guard costs one extra PostgREST lookup** per call for a signed-in person, on the refused functions only.
- **A function deployed later without `guardedServe` or `demoRefusal`** fails the Deno test, but only if the decision table is kept up to date. The test also fails for a new function with no decision.
- **`TRUNCATE` isn't guarded** (statement-level). The app and PostgREST never truncate, and no production RPC does.
- **Failure toasts are mapped for a few seconds after a demo refusal.** Error text a screen shows outside a toast keeps its own message; for database refusals that is already the demo message.
- **Not done:** any change to billing logic, credits maths, HMRC behaviour beyond the refusal, or the free tools.
