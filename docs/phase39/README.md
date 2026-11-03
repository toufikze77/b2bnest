# Phase 39: free tools sign-up funnel, free tier after the trial, referral links next to the task

**Prepared, not applied.** Nothing here has touched production: no SQL applied, no Edge Function changed or deployed.

## Rollout order
1. **Owner applies `docs/phase39/proposal.sql`** (one transaction). It refuses, changing nothing, if:
   - it has already been applied;
   - `_access_state_for`, `mfa_ok` or `require_aal2_if_enrolled` differ from the 3 Nov 2026 production bodies;
   - `auth.users.id` is not the uuid primary key;
   - a Phase 39 function name is already taken.
2. **Publish the frontend.** It works before step 1 as well:
   - the tools keep working in the browser (Phase 38);
   - the save line says "Saving to your account needs a database update";
   - sign-up works;
   - the Settings switch says "Saving this choice needs a database update." and stays off.
3. **Optional:** add `https://www.b2bnest.online/business-tools?tool=*` to Supabase Auth's redirect allow-list (Authentication → URL configuration).
   - With it, someone who signs up from a free tool comes back to that tool from the confirmation email.
   - Without it, Supabase sends them to the Site URL (home), as today.
   - `safeNext` now allows `/business-tools`.

Rollback: `docs/phase39/rollback.sql`.
- It refuses while either table has rows, unless you `SET LOCAL app.phase39_force = 'on'` after `BEGIN`.
- Export both tables first. Keep the consent export, because under UK GDPR you must be able to show when and how each person agreed.

Tests: `PG_RUN_USER=postgres bash docs/phase39/run-test.sh` (disposable local Postgres 16). **85 checks, all PASS.**

## What was read first (read-only)
- **Access states:** `_access_state_for(uid)` returns owner, subscribed (self or company), trial, trial_ended or suspended.
  - An account with no profile and no plan is `trial_ended`.
  - `PaywallGate`:
    - signed out or loading: passes;
    - Phase 38 free-tool URLs (`/business-tools?tool=<free tool>`): pass for everyone;
    - suspended: only the narrow exempt list;
    - trial_ended: the paywall, except exempt routes.
  - Paying accounts: pass. Paid tools inside Business Tools also check `useSubscription().isPremium`.
- **Sign-up:** `useAuth.signUp` → `supabase.auth.signUp` with `data {full_name, company_name}` and `emailRedirectTo = confirmationRedirect(...)`.
  - `next` survives sign-in through `safeReturnPath`.
  - The confirmation email uses the stricter `safeNext` allow-list.
  - After sign-up the form switches to sign-in. The person confirms by email, then signs in.
- **Existing consent fields:** none for marketing.
  - `user_notification_preferences` holds task-email switches.
  - `email_optouts` is an opt-out list for the trial emails.
  - `marketing_audiences` / `marketing_campaigns` are the CRM feature.
  - So a new `marketing_consents` table was needed.
  - Service emails and their preferences are unchanged.
- **The seven tools' storage (Phase 38):**
  - ROI scenarios: `b2bnest.roi.scenarios.v1`;
  - goals: `goalTrackerGoals`;
  - surveys: `b2bnest.surveys.v1`;
  - checklist: `b2bnest.setupChecklist.v1`;
  - Cost, Compliance and Best Practices saved nothing.
- **Business Resources:** Revolut Business and Hostinger referral cards, from `src/data/referralLinks.ts`.

## Design
### Free tier
- **Trial-ended and no-plan accounts:**
  - keep every free tool, including saving to the account;
  - can open the Business Tools list (`/business-tools`), where a paid tool still shows the trial-ended screen;
  - see one line on the free tools: "Your trial has ended. The free tools stay free. See plans to unlock the rest." ("See plans" goes to /pricing).
- **Suspended accounts:** the Phase 38 behaviour.
  - The tools open and work in the browser.
  - Nothing is read from or written to the account; the line says so.
  - No plan buttons. The Business Tools list stays closed.
- **Unchanged:** paid tools, billing, credits and AI Edge Functions.

### Save to account (`public.free_tool_items`, `src/lib/freeToolItems.ts`)
- **ROI Calculator:**
  - Anyone can calculate a scenario and see the results.
  - Signed out, "Save to compare" and "Export CSV" show "Create a free account to save and download".
  - Signed in, each scenario is an item, compared side by side.
  - Scenarios saved in the browser before Phase 39 are still shown.
- **Goal Tracker, Survey Builder, Setup Checklist:**
  - Signed out, they work with browser saving.
  - After the first real edit, a dismissible "Keep … on all your devices" card appears (dismissed for the session).
  - The Survey Builder's copy and download need an account.
  - Signed in, the collection is one item ("My goals", "My surveys", "My checklist"), saved after each change.
- **Cost Calculator and Compliance Checker:**
  - The result is visible to everyone.
  - "Save this result" (and the Cost Calculator's CSV) need an account.
  - Signed in, saved results are listed with a date (2 Nov 2026), and can be opened or deleted.
- **The prompt:** one compact inline card, with "Create a free account" (`/auth?next=<this tool>&mode=signup`) and "Sign in".
  - "Not now" closes it. It never blocks the tool.
- **Work in progress:** the ROI form, the cost amounts and the compliance answers are kept in sessionStorage for the tab, so they are still there after signing in.
  - The other tools already keep their work in localStorage.
- **The one-time move:**
  - After signing in, if this browser has Phase 38 data, a card offers "Move what you saved in this browser to your account". Nothing moves silently.
  - After the move, "It worked: remove the browser copy" (asks first) or "Keep both".
  - "No thanks" moves nothing. The answer is remembered per account and tool.
- **Errors in words:**
  - the 50-item limit;
  - over 64 KB;
  - two-step code needed;
  - suspended;
  - offline;
  - "needs a database update".

### Marketing consent (`public.marketing_consents`)
- **On the sign-up form:** the checkbox "Send me tips and offers about B2BNEST. You can unsubscribe at any time." is unticked and not required.
- **What is kept:** the choice (`marketing_consent`) and the free tool signed up from (`signup_source`) go into the sign-up details Supabase Auth keeps.
  - The source is one of the seven tool ids, else `signup`.
  - No other personal data.
- **Recording it:** after the first sign-in (and after two-step verification), `ConsentRecorder` calls `marketing_consent_record_signup()` once.
  - It writes the row only if none exists, so a later choice always wins.
- **Settings → Notifications:** "Tips and offers by email" switch, saved through `marketing_consent_set()`. The saved state is announced (`aria-live`).
- **Why functions and not a write policy:** users have SELECT only on their own row.
  - Inserts and updates go through two SECURITY DEFINER functions, so `consented_at`, `updated_at` and `consent_text_version` always come from the server.
  - A browser can't backdate a consent or change the wording version.
  - Withdrawing works even for a suspended account.
- **Not sent:** no marketing email, no new Edge Function, no tracking.

**Exporting people who agreed** (SQL editor, as the owner). Only `consented = true` may be emailed for marketing:
```sql
select u.email, c.source, c.consent_text_version, c.consented_at, c.updated_at
  from public.marketing_consents c join auth.users u on u.id = c.user_id
 where c.consented
 order by c.consented_at;
```
Wording v1 is in the table comment. If the wording changes, bump the version in `marketing_consent_set` / `marketing_consent_record_signup` and in `src/lib/marketingConsent.ts`.

### Referral links next to the task
- **Config:** `src/data/freeToolsPromos.ts` holds ordered groups; entries carry `contexts`. It ships one group ("Banking & finance") and one entry, Revolut Business, from `src/data/referralLinks.ts`.
- **Where `ReferralSlot` appears:**
  - the Setup Checklist's "open a business bank account" step;
  - under the Cost Calculator total ("Need a business account?");
  - the Business Resources page, above the other partner card (Hostinger stays there).
  - No other tool has one.
- **What each slot shows:**
  - "Advert";
  - "We may earn a commission if you open an account through these links.";
  - `rel="sponsored noopener noreferrer"`, `target="_blank"`;
  - "Not financial advice. Check the terms with the provider.".
- **Behaviour:**
  - A group selector appears only when two or more groups have entries in that place.
  - An entry with no link is never shown.
  - Dismissed for the session, per place.
- **Business Finance Assistant promotion:** shown only after a money result (ROI result; a Cost Calculator total above £0) and on the Business Tools overview. Never a pop-up.
- **The Phase 38 generic advert card (`FreeToolsBanner`) is removed:**
  - it showed the bank link above every free tool, including tools where it doesn't help (goals, surveys, best practices);
  - the new slots put it next to the task;
  - its Finance Assistant part moved to the promotion above.

### Text
- Help FAQ "Do I need an account…" now covers the free tier, and there is a new "Can I buy AI credit top-ups?" FAQ.
- The Help assistant answers "Can I buy top-ups?" with "Top-ups are not available yet.", and has a free-tier answer.
- `knowledge.ts` has one sentence added (not deployed).
- The Financial tools guide line about ROI is updated, and the Cost Calculator note no longer says "Nothing you type is saved".
- `noInventedClaims` now allows "free account", because the free tier exists. The freemium marketing phrases are still banned.

## SQL details
- **`free_tool_items`:** `id`, `user_id` (FK auth.users, cascade), `tool` CHECK (seven ids), `name` (1 to 120), `data` jsonb (object or array, `pg_column_size` ≤ 64 KB), `created_at`, `updated_at`.
- **Trigger `_free_tool_item_guard`** (not SECURITY DEFINER):
  - 50 per user per tool, under an advisory lock (`FREE_TOOL_ITEM_LIMIT`);
  - owner and tool fixed (`FREE_TOOL_ITEM_FIXED`);
  - server timestamps; name trimmed.
- **RLS on `free_tool_items`:**
  - own rows for SELECT, INSERT, UPDATE and DELETE;
  - restrictive `require_aal2_if_enrolled`;
  - restrictive write policies using `free_tools_write_ok()` (signed in and not suspended), so suspended accounts are read-only.
  - No company sharing, nothing for anon.
- **`marketing_consents`:** `user_id` PK (FK, cascade), `consented`, `source` CHECK, `consent_text_version`, `consented_at`, `updated_at`.
  - RLS: own SELECT plus restrictive aal2. Users have no INSERT/UPDATE/DELETE grant.
- **Functions:** `free_tools_write_ok()`, `marketing_consent_set(boolean, text)` and `marketing_consent_record_signup()`.
  - SECURITY DEFINER, `SET search_path = ''`, with the Phase 25 guard line.
  - Guard log rows (kind `user`).
  - EXECUTE for authenticated only (revoked from PUBLIC, anon and service_role).

### Security advisor expectations after applying
- **+3 `authenticated_security_definer_function_executable`:** `free_tools_write_ok`, `marketing_consent_set`, `marketing_consent_record_signup`.
  - These are intended: each checks `auth.uid()`, carries the MFA guard and touches only the caller's own data.
- **No new `anon_security_definer_function_executable`**, `function_search_path_mutable`, `rls_disabled_in_public` or `policy_exists_rls_disabled`.
- **`_free_tool_item_guard`** is a plain trigger function; no one can execute it directly.

### What the local suite covers (85 checks)
- **Access:** production helper hashes; privileges and grants; SECURITY DEFINER and search_path; guard log md5s; RLS and restrictive policies; no anon policies.
- **Saving:**
  - trial-ended, no-row and trial accounts can save;
  - paying accounts see only their own rows;
  - others' rows can't be updated, deleted, planted or handed over;
  - the tool CHECK (paid tool, NotePro), name, data type and 64 KB limits.
- **Limits:** 50 per tool (51st refused; per tool; per user; works again after a delete).
- **Suspended:** reads only; every write refused or no-op.
- **Two-step verification:** aal1 sees nothing and can't save or consent; aal2 works.
- **anon:** cannot read, write or call anything.
- **Consent:**
  - sign-up yes with the tool as source; unknown source becomes `signup`;
  - recorded once; a withdrawal is never overridden;
  - no direct insert, update or delete;
  - bad source refused; each row is changed only by its owner.
- **Deleting a user** removes their items and consent.
- **Rollback and re-apply:**
  - rollback refuses with data, and changes nothing;
  - forced rollback returns the catalogue fingerprint exactly to before Phase 39;
  - re-apply works; a second apply is refused; an empty rollback needs no force;
  - a taken name and a changed helper are refused, with nothing applied.

## Checks
- tsc: clean.
- eslint: 510 (baseline 510).
- vitest: 1,425 / 1,425 pass.
- build: OK.
- Deno `ai-assistant` (knowledge and handler): 29 / 29 pass, with a local stand-in for the blocked deno.land asserts module.
- Local SQL suite: 85 / 85 PASS.

## Risks and not done
- **A draft can be lost across tabs:** if the confirmation email opens a new tab, the sessionStorage draft (ROI form, cost amounts, compliance answers) isn't there. Goals, surveys and checklist ticks are in localStorage and survive.
- **The confirmation redirect** returns people to their tool only once the allow-list entry in rollout step 3 is added.
- **Sign-up details:** the consent choice sits in Supabase Auth's sign-up details until the first sign-in records it. OAuth sign-ups have no checkbox; they can use the Settings switch.
- **Pre-existing, not from this phase:** at 375 px the signed-out header is 5 px wider than the screen on every page.
