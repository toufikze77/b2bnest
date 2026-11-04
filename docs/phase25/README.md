# Phase 25: real two-step sign-in with an authenticator app (prepared)

**Status: prepared, not applied or deployed.** Nothing here has run against production. Production was only read (catalog and hashes, plus counts: 0 authenticator apps today, 2 accounts with the old setting).

Two-step sign-in now uses **Supabase Auth TOTP**:
- `mfa.enroll`, `challenge` and `verify` do all the work.
- Our code never makes or checks a code.
- Any standard authenticator app works: Microsoft Authenticator, Google Authenticator, Authy, 1Password. All are free. There is no SMS.

| Who | Rule |
| --- | --- |
| Everyone | Optional, encouraged. |
| Super admins | **Required** for the Admin area (`TWO_STEP_REQUIRED_ROLES = ['super_admin']` in `src/lib/twoStep.ts`). |
| Company owners and admins | A "Protect your account" banner (hideable for 7 days). To make it required later, add `'owner'` / `'admin'` to that one constant. |
| The 2 accounts with the old `user_2fa_settings.is_enabled = true` | Not locked out. A one-time "Set up two-step sign-in / Later" prompt. Old tables and functions are untouched. |

## Rollout order (mandatory)

| Step | Who | What | What people see after it |
| --- | --- | --- | --- |
| 1 | Owner | Supabase dashboard → **Authentication → Sign In / Providers → Multi-Factor**: TOTP **Enroll** and **Verify** on. | Nothing changes. Nobody has an app yet. |
| 2 | Owner | Merge and publish the frontend. Optionally redeploy `ai-assistant` (its help text now describes two-step sign-in). | Settings → Security: "Set up an authenticator app". Anyone who sets one up is asked for the code at every sign-in. Super admins opening Admin are sent to set it up. The database does not check the code yet: an `aal1` token still reads data through the API. |
| 3 | Owner | Run `owner-readonly.sql` **A** (must show 66 / 0 / 0 / 0 / 0 / 0 / … / 0) and **B**. Then apply `proposal.sql` in the SQL editor. | Enforced: an `aal1` session of someone with an app reads nothing and is refused by every user-data RPC (`MFA_REQUIRED`). Admin RPCs need `aal2` for super admins. Nobody without an app notices anything. |
| 4 | Owner | Run `owner-readonly.sql` **C** (98 / 66 / 22 / true). Deploy `admin-reset-mfa` (`supabase functions deploy admin-reset-mfa`, or paste `handler.ts`, `index.ts`, `shared_cors.ts` from `node scripts/flatten-function.mjs admin-reset-mfa`). | Admin → Users → "Reset two-step sign-in" works. |

**If the order is wrong:**
- **SQL before the frontend:** anyone who already has an app (0 today) would be locked out of their own data: every read returns nothing, every RPC says `MFA_REQUIRED`, and the old frontend has no code screen. `proposal.sql` starts with this warning. Fix: publish the frontend, or run `rollback.sql`.
- **SQL before step 1:** harmless. Nobody can enrol, so `mfa_ok()` is true for everyone except super admins on Admin RPCs. They would see Admin errors until they enrol, which needs step 1. Do step 1 first.
- **`admin-reset-mfa` before the SQL:** works (it checks `aal2` from the caller's token itself).
- **Frontend without step 1:** "Set up an authenticator app" fails with Supabase's error ("MFA enroll is disabled"). Nothing else changes.

**Rollback:** `rollback.sql`. It restores every function body byte-for-byte (checked by hash) and drops the policies, the helpers and the two new tables. Then redeploy the previous frontend if wanted.

## How a locked-out person gets back in

1. **Second phone:** Settings → Security recommends "Add a backup phone". The code screen asks for the main authenticator (the oldest one added) and offers "Use a backup authenticator instead" at the bottom.
2. **Owner-assisted reset:** they contact support@b2bnest.online. A super admin who has entered their own code (`aal2`) checks it is really them, then Admin → Users → open the person → **Reset two-step sign-in**, typing the reason.
   - `admin-reset-mfa` records an `audit_logs` row first: who (`details.admin_id`), whom (`user_id`), reason, time, number of apps. No secrets.
   - Then it removes every factor with `auth.admin.mfa.deleteFactor`.
   - It refuses: a password-only caller, a non-super-admin, the caller's own account, a missing reason, more than 5 resets an hour.
   - The person sees "two step reset by admin" in their own activity list, signs in with the password and sets up a new app.

## What changed in the database (`proposal.sql`, one transaction)

- **`public.mfa_ok()`** (STABLE, SECURITY DEFINER, `search_path = ''`, EXECUTE for `authenticated` and `service_role` only). It is true when:
  - the token says `aal = aal2`; or
  - the caller has **no verified factor** in `auth.mfa_factors`; or
  - it runs on a server path (`service_role` / `postgres` / `supabase_admin`, the same rule as `public.assert_self`).
- **`public.require_aal2_if_enrolled()`** raises SQLSTATE 42501 `MFA_REQUIRED` when `mfa_ok()` is false.
- **`public.require_aal2_admin()`** does the same, and also requires `aal2` for **super admins always** while `public.security_settings.admin_requires_aal2` is true. That is one row, default **true**. The owner can switch it off with `UPDATE public.security_settings SET admin_requires_aal2 = false;`.
- **Restrictive policy `require_aal2_if_enrolled`:** `AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.mfa_ok())) WITH CHECK ((SELECT public.mfa_ok()))` on **98 tables**, listed one by one (no loop: future tables are added on purpose). `anon` is untouched: the policy names `authenticated` only, and the test compares every table's anonymous answer before and after.
- **66 SECURITY DEFINER functions** (they bypass RLS) get one guard line at the top: `PERFORM public.require_aal2_if_enrolled();`, or `require_aal2_admin()` for the 22 admin ones.
  - Each is refused unless its live body hash still equals the one read on 1 Nov 2026.
  - The rest of each body is unchanged; grants, owner and SECURITY DEFINER are kept.
  - A read-only dry run on production showed all 66 present and unchanged, with BEGIN alone on its own line and the body found exactly once in its definition.
- **Completeness check:** the apply refuses if any SECURITY DEFINER function executable by `authenticated` is neither guarded nor in the reviewed exclusion list below.
- **Not changed:** helper functions used inside RLS policies (`has_role`, `is_super_admin`, `user_is_organization_*`, `support_is_*`, …).

### Signed-out (anon) access: confirmed unchanged
The policy is `TO authenticated` only, and `mfa_ok()` is not executable by anon, so no anon policy can call it. Production today:
- **Anon can SELECT:** `advertisement_categories`, `news_articles`, `staking_tiers`, `staking_reward_pools`, `template_catalog`, `forum_replies`, `job_postings`, `organization_members`. The last only through a policy whose condition needs a user: checked read-only as `anon` on production, it returns 0 rows.
- **Anon can INSERT:** `template_events` and the public-form tables, through the policies that already exist.

The test runs `select count(*)` as anon on **every** table before and after: identical.

### Functions guarded (66)

| Function | Guard | Why |
|---|---|---|
| `add_project_member(uuid,uuid,text)` | enrolled → aal2 | adds people to a project |
| `add_team_member(uuid,uuid,text)` | enrolled → aal2 | adds people to a team |
| `admin_ai_stats(integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_analytics_series(integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_company_detail(uuid)` | admin (aal2 always for super admins) | admin RPC |
| `admin_documents_summary(integer,integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_list_companies(text,integer,integer,text,text)` | admin (aal2 always for super admins) | admin RPC |
| `admin_list_projects(text,text,integer,integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_list_subscriptions(text,text,integer,integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_list_users(text,text,integer,integer,text)` | admin (aal2 always for super admins) | admin RPC |
| `admin_log_action(text,text,text,jsonb,text)` | admin (aal2 always for super admins) | admin RPC |
| `admin_moderate_post(uuid,boolean)` | admin (aal2 always for super admins) | admin RPC |
| `admin_overview_stats()` | admin (aal2 always for super admins) | admin RPC |
| `admin_set_company_status(uuid,text,text)` | admin (aal2 always for super admins) | admin RPC |
| `admin_set_user_role(uuid,app_role)` | admin (aal2 always for super admins) | admin RPC |
| `admin_set_user_status(uuid,boolean)` | admin (aal2 always for super admins) | admin RPC |
| `admin_social_stats(integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_support_overview(text,integer,integer)` | admin (aal2 always for super admins) | admin RPC |
| `admin_system_health()` | admin (aal2 always for super admins) | admin RPC |
| `admin_tools_overview()` | admin (aal2 always for super admins) | admin RPC |
| `admin_update_company(uuid,text,text)` | admin (aal2 always for super admins) | admin RPC |
| `audit_profile_access(uuid,text)` | enrolled → aal2 | writes the user audit trail |
| `check_and_deduct_ai_credit(uuid,integer)` | enrolled → aal2 | reads and spends AI credits |
| `check_trial_status(uuid)` | enrolled → aal2 | reads trial/subscription data |
| `create_team_with_owner(text)` | enrolled → aal2 | creates company data |
| `ensure_user_has_org(uuid)` | enrolled → aal2 | creates/reads the company |
| `get_advertisement_contact_info(uuid)` | enrolled → aal2 | returns advertiser contact details |
| `get_ai_credits_info(uuid)` | enrolled → aal2 | reads billing/credits |
| `get_bank_account_details(uuid,uuid)` | enrolled → aal2 | returns bank details |
| `get_bank_accounts_safe(uuid)` | enrolled → aal2 | returns bank accounts |
| `get_hmrc_client_secret(uuid)` | enrolled → aal2 | returns HMRC credentials |
| `get_hmrc_tokens(uuid)` | enrolled → aal2 | returns HMRC tokens |
| `get_integration_tokens(text,uuid)` | enrolled → aal2 | returns integration tokens |
| `get_notification_preferences(uuid)` | enrolled → aal2 | reads personal settings |
| `get_team_members_with_profiles(uuid)` | enrolled → aal2 | returns profiles |
| `get_user_display_info(uuid)` | enrolled → aal2 | returns profile data |
| `get_user_integrations_safe(uuid)` | enrolled → aal2 | reads integrations |
| `get_user_payments(uuid)` | enrolled → aal2 | returns payments |
| `get_user_projects(uuid)` | enrolled → aal2 | returns projects |
| `get_user_staking_tier(uuid)` | enrolled → aal2 | reads the user’s (retired) staking data |
| `get_user_teams(uuid)` | enrolled → aal2 | returns teams |
| `list_master_access()` | admin (aal2 always for super admins) | admin RPC |
| `log_user_action(uuid,text,text,text,jsonb,inet,text)` | enrolled → aal2 | writes the user audit trail |
| `my_access_state()` | enrolled → aal2 | reads subscription/trial state |
| `onboarding_email_status(uuid)` | enrolled → aal2 | reads company invitations |
| `org_accept_invitation(text)` | enrolled → aal2 | joins a company |
| `org_invitation_preview(text)` | enrolled → aal2 | reads an invitation (company name, role) |
| `org_invitation_token(uuid)` | enrolled → aal2 | returns an invitation link |
| `org_invite_member(uuid,text,text)` | enrolled → aal2 | invites to a company |
| `org_manage_invitation(uuid,text)` | enrolled → aal2 | changes invitations |
| `org_seat_summary(uuid)` | enrolled → aal2 | reads company seats |
| `platform_set_billing_owner(uuid,uuid,text)` | admin (aal2 always for super admins) | admin RPC |
| `preview_user_emissions(uuid)` | enrolled → aal2 | reads the user’s (retired) staking data |
| `resolve_active_organization(uuid)` | enrolled → aal2 | reads company membership |
| `rota_can_add_employee(uuid)` | enrolled → aal2 | reads company rota data |
| `set_master_access(uuid,boolean,text)` | admin (aal2 always for super admins) | admin RPC |
| `store_bank_account(text,text,text,text,text,text,text,numeric,numeric,uuid)` | enrolled → aal2 | stores bank details |
| `store_integration_tokens(text,text,text,timestamp with time zone,jsonb,uuid)` | enrolled → aal2 | stores integration tokens |
| `support_add_attachment(uuid,uuid,text,text,integer,text,boolean)` | enrolled → aal2 | writes support tickets |
| `support_add_message(uuid,text,boolean,uuid)` | enrolled → aal2 | writes support tickets |
| `support_claim_invitations()` | enrolled → aal2 | links support-portal access |
| `support_create_ticket(uuid,text,text,uuid,text,uuid)` | enrolled → aal2 | writes support tickets |
| `support_submit_feedback(uuid,integer,text)` | enrolled → aal2 | writes support tickets |
| `support_update_ticket(uuid,text,text,uuid,uuid,boolean)` | enrolled → aal2 | writes support tickets |
| `wave1_list_reconcilable_projects()` | enrolled → aal2 | lists the user’s projects |
| `wave1_reconcile_project(uuid,uuid)` | enrolled → aal2 | moves a project between companies |

### Functions not changed (23)

| Function | Reason |
|---|---|
| `email_unsubscribe(text)` | Public unsubscribe link from emails (token only, also callable signed out). No account data returned. |
| `get_invitation_by_token(text)` | Looks up an invitation by its secret token on the join/sign-up page, before the person can have a code. |
| `has_role(uuid,app_role)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `is_admin_or_owner(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `is_project_member(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `is_safe_profile_field(text)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `is_super_admin(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `is_team_member(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `owns_team(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `support_can_view_ticket(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `support_feedback_submitted(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `support_is_agent(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `support_is_customer(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `support_is_manager(uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `template_usage_counts()` | Public template usage counts (also callable signed out). No personal data. |
| `user_can_access_project(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `user_is_organization_admin(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `user_is_organization_member(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `user_is_organization_owner(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `user_owns_project(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `users_share_organization(uuid,uuid)` | Helper used inside RLS policies or other checks; answers yes/no only. Not changed (the restrictive policy covers the tables). |
| `wave1_enforce_org_membership()` | Trigger function: runs inside a write that the table's RLS (with the new policy) already checks. |
| `wave1_todo_parent_tenant()` | Trigger function: runs inside a write that the table's RLS (with the new policy) already checks. |

### Tables excluded (25)

| Table | Reason |
|---|---|
| `advertisement_categories` | Public reference list (signed-out visitors read it). |
| `email_optouts` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `forum_posts` | Public community forum content. |
| `forum_replies` | Public community forum content. |
| `job_postings` | Public job board (signed-out visitors read active postings). |
| `master_access` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `news_articles` | Public news (signed-out visitors read it). |
| `onboarding_email_outbox` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `phase12_subscribers_backup` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `phase12_trial_flags_backup` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `plan_prices` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `platform_plan_prices` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `platform_plans` | Plan names/prices the app shows on Pricing; no personal data. |
| `staking_reward_pools` | Public reference (retired staking feature). |
| `staking_tiers` | Public reference (retired staking feature). |
| `stripe_webhook_events` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `support_email_outbox` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `template_catalog` | Published template catalogue (signed-out visitors read it). |
| `template_events` | Anonymous template analytics (preview counts). |
| `trial_email_log` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `trial_email_outbox` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `trial_email_settings` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `wave1_backfill_journal` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `wave1_created_objects` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |
| `wave1_unresolved_rows` | Service role only: no policy lets a signed-in user read or write it, so a restrictive policy would change nothing. |

### Tables with the restrictive policy (98)

`admin_audit_logs`, `advertisements`, `ai_conversations`, `ai_workflows`, `ai_workspaces`, `audit_logs`, `b2b_form_submissions`, `bank_accounts`, `bank_transactions`, `banking_audit_logs`, `bills`, `business_insights`, `companies`, `connections`, `crm_contacts`, `crm_deals`, `document_email_log`, `documents`, `expenses`, `feedback_requests`, `hmrc_integrations`, `hmrc_settings`, `hmrc_submission_logs`, `integration_audit_logs`, `integration_settings`, `invoices`, `marketing_audiences`, `marketing_campaigns`, `marketing_content_items`, `messages`, `note_categories`, `notes`, `notification_logs`, `notification_type_prefs`, `notifications`, `organization_billing`, `organization_invitations`, `organization_members`, `organizations`, `outgoings`, `payment_audit_logs`, `payment_notifications`, `payments`, `payroll_employees`, `payroll_run_items`, `payroll_runs`, `payroll_submissions`, `platform_settings`, `platform_tools`, `post_comments`, `post_likes`, `products_services`, `profiles`, `project_activities`, `project_members`, `project_share_logs`, `project_time_entries`, `projects`, `quotes`, `rota_employees`, `rota_shifts`, `rota_week_publications`, `security_audit_logs`, `social_posts`, `staking_rewards`, `staking_transactions`, `staking_wallet_links`, `subscribers`, `suppliers`, `support_agents`, `support_attachments`, `support_categories`, `support_customers`, `support_messages`, `support_notification_prefs`, `support_settings`, `support_ticket_feedback`, `support_tickets`, `team_members`, `teams`, `template_applications`, `todo_comments`, `todo_history`, `todo_subtasks`, `todos`, `user_2fa_attempts`, `user_2fa_codes`, `user_2fa_settings`, `user_ai_preferences`, `user_document_templates`, `user_documents`, `user_favorite_tools`, `user_favorites`, `user_integrations`, `user_notification_preferences`, `user_roles`, `user_stakes`, `workflow_run_logs`

## Frontend

| File | Change |
| --- | --- |
| `src/lib/twoStep.ts` | Rewritten. `TWO_STEP_REQUIRED_ROLES`, `TWO_STEP_BANNER_ROLES`, wording, `verifiedTotp`, `needsCode`, `cleanCode`, `requirementFor`, `codeErrorMessage`, banner snooze and legacy-prompt storage (localStorage in try/catch). **`TWO_STEP_ENFORCED` removed**: whether a code is asked for is decided per session by Supabase (`aal1` → `aal2` when the account has a verified factor), not by a global constant. |
| `src/hooks/useAssurance.ts`, `src/components/twoStep/AssuranceProvider.tsx` | `useAssurance()`: assurance level and factors, re-checked for every new session token (sign-in, reload, refresh, after verify). `loading` is true from the first render with a new token, so nothing can flash. |
| `src/components/twoStep/TwoStepGate.tsx` | Locks the whole app (every route) while the code is needed. A failed check locks with Retry / Sign out. |
| `src/components/twoStep/TwoStepCodeScreen.tsx` | 6 digits, paste "123 456", choose between two apps, plain errors, rate-limit message, "Use a different account" (signs out). |
| `src/components/twoStep/TwoStepSetup.tsx` | Enrol: QR from Supabase, typed key, code → On. List with name and date. "Add a backup phone". Remove needs a fresh code. Half-finished set-ups are cleaned up. "On" only with a verified factor. |
| `src/components/twoStep/ProtectAccountBanner.tsx` | Owners/admins without an app. "Remind me in 7 days". Mounted in `AppShell`. |
| `src/components/twoStep/LegacyTwoStepPrompt.tsx` | One-time "Set up / Later" for `user_2fa_settings.is_enabled` accounts without an app. |
| `src/hooks/useTwoStepRequirement.ts`, `src/pages/TwoStepRequired.tsx` | "Set up two-step sign-in to use Admin" page (`/two-step-required?next=`). |
| `src/components/ProtectedRoute.tsx`, `src/pages/admin/AdminLayout.tsx` | Use the shared hook: code screen at `aal1`; super admin without an app → set-up page; "required" company roles (if ever added) → set-up page. |
| `src/App.tsx` | `AssuranceProvider`, `TwoStepGate` around `Layout`, `LegacyTwoStepPrompt`, route `/two-step-required`. |
| `src/pages/Auth.tsx` | The old email-code step (`TwoFactorAuth`) removed from sign-in. `TwoFactorAuth.tsx`, `user_2fa_*`, `send-2fa-email`, `verify-2fa-code` and `useAuth`'s `verify2FA` / `sendVerificationCode` are **left in place, unused**. |
| `src/components/settings/AccountSecurity.tsx`, `src/components/AccountSettings.tsx` | "Not active yet" cards replaced (real set-up; status from verified factors). |
| `src/pages/admin/AdminUsers.tsx`, `src/lib/resetTwoStep.ts` | "Reset two-step sign-in" (super admins, not your own account, reason required). |
| `src/pages/articles/SecurityGuide.tsx`, `supabase/functions/ai-assistant/knowledge.ts` (+ `_test`) | Wording (below). |
| `src/test/noInventedClaims.test.ts`, `src/test/twoStepHonesty.test.tsx` | The "coming soon" exception is gone. "Not active" wording is banned. "On" only from verified factors. The old screen is unreachable. |
| `src/test/twoStepFlows.test.tsx`, `src/pages/admin/AdminResetTwoStep.test.tsx`, `src/components/ProtectedRoute.test.tsx`, `src/components/shell/AppShell.test.tsx` | New tests, plus mocks for the new hooks/banner in two existing tests. |

### Strings changed
| Where | Before | After |
| --- | --- | --- |
| Settings → Security, Account settings | "Two-step sign-in is not active yet. Signing in needs only your password." / "Not active yet" / "Coming soon: we'll tell you when it's available." | "When it's on, signing in needs your password and a 6-digit code from an authenticator app on your phone (Microsoft Authenticator, Google Authenticator, Authy or 1Password, all free)." · status **On / Off** · "Set up an authenticator app" / "Add a backup phone" |
| Security guide | "Two-step sign-in is not active yet … Coming soon …" | "Turn it on in Settings → Security … such as Microsoft Authenticator … Add a second phone as a backup. If you lose your phone, contact support@b2bnest.online and we'll check it's you before resetting it." |
| AI assistant knowledge | "Two-step sign-in is not active yet: signing in needs only a password" | "Two-step sign-in is optional for each user (Settings → Security): a 6-digit code from an authenticator app … checked by Supabase Auth. It is required for platform administrators. There is no SMS option." |
| New | – | Code screen, the Admin set-up page, the banner, the legacy prompt and the reset dialog (see screenshots). |

## Tests run

| Suite | Result |
| --- | --- |
| `npx vitest run` | 110 files, 1019 tests passed. Includes `twoStepFlows.test.tsx` (22): code screen only at `aal1`→`aal2`; `?next=` kept and same-origin only; wrong code and rate limit; reload and direct link locked; token refresh re-checked; super admin redirected from `/admin`; enrol success and wrong code; On only with a verified factor; second factor; removal needs a fresh code; banner snooze; legacy prompt. Also `AdminResetTwoStep.test.tsx` (4). |
| `deno test admin-reset-mfa` | 12 passed. `deno check` of `index.ts` and the test: ok. `deno lint` of the function: clean. `deno.land` and `esm.sh` are blocked here, so these ran with `--no-check=remote` and a local import map. |
| `PG_RUN_USER=postgres bash docs/phase25/run-test.sh` | Earlier suites unchanged: 12b 51/51 (×2), 12c 49/49 (×2), 13 60/60, 15 27/27, 20 20/20, 22 20/20. Phase 12 inside the combined run: 79/81 (×2), the same known two `is_active` checks as on `main`. **Phase 25: 66/66**, plus 4 guard checks. |

**What the Phase 25 SQL test runs on:** a replica of the production schema (shim + Sept baseline + every later migration + the hand-applied phases that still replay). It has 111 of 123 tables (the 12 missing are excluded service-only tables) and 61 of the 66 guarded functions (40 byte-identical to production). The test uses the replica's own hashes for those 61. The **real** `proposal.sql` is run too and is **refused** by its hash guard, because the replica's bodies differ, with nothing applied.

## Not verified
- Real authenticator apps and real Supabase MFA. The Supabase API is mocked in the frontend tests, and TOTP is not enabled on the project yet.
- The 5 guarded functions missing from the replica (`list_master_access`, `set_master_access`, `resolve_active_organization`, `wave1_list_reconcilable_projects`, `wave1_reconcile_project`) were only checked by the production dry run, not executed with the guard.
- Production data and behaviour after apply. Nothing was applied.

## Recommended, not done
- **Edge Functions that use the service role on behalf of a user** bypass RLS, so the database guard doesn't cover them. The ones that call RPCs **as the caller** (for example `admin-set-user-ban`) are covered. A shared `_shared/mfa.ts` (`tokenAal(token)`, as in `admin-reset-mfa`) and a check in each such function is the next step. It needs redeploying every function, so it is left for its own phase.
- After the 2 legacy accounts have set up an app (or after a deadline), delete `user_2fa_settings`, `user_2fa_codes`, `user_2fa_attempts`, `send-2fa-email`, `verify-2fa-code`, `TwoFactorAuth.tsx` and the two unused `useAuth` methods, in a separate approved clean-up.
- Supabase's MFA verification rate limit is the server-side brute-force protection. Check it in Authentication → Rate Limits.
