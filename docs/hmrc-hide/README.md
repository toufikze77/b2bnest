# HMRC hide switch: keep HMRC test features away from customers until production approval

HMRC hasn't approved B2BNEST for production, so every HMRC feature runs against HMRC's **test environment**: a "VAT
return" sent today files nothing with HMRC. This switch lets the owner hide the whole HMRC test area from ordinary
customers, so nobody thinks a return was really filed.

- No code change is needed to flip it.
- It is **hidden by default.**
- Nothing here is applied or deployed.
- Production was only read (9 Nov 2026): table shape, policies, function bodies (as md5), role counts and keys. No values were read.
- This claims no HMRC approval, accountant check, penetration test or other review.

## What it does

**One setting:** `hmrc_customer_access` in the existing table `public.platform_settings`, with the value `"visible"` or `"hidden"`.
- No new table.
- Only super admins can read the whole table or write it. RLS (aal2 when enrolled) and the demo guard already exist.

| Who | `hidden` (the default) | `visible` |
| --- | --- | --- |
| A customer (any company owner, admin or member) | **No HMRC features.** One calm line where they were. The VAT return **preview and its CSV** stay. Disconnect stays for a company still connected | Today's behaviour, unchanged |
| A platform `super_admin` or `admin` (`public.user_roles`) | Today's behaviour: the owner can keep testing and setting up HMRC | Today's behaviour |

**Missing, unreadable or anything other than exactly `"visible"` counts as `hidden`, on the server and in the app.** So
customers stop seeing HMRC features as soon as the Edge Functions are redeployed and the front end is published, even
before the SQL is applied and even if the switch is never touched.

**The line customers see:** "Sending VAT returns to HMRC straight from B2BNEST is coming soon. You can still prepare your figures and download them."

### Why `super_admin` and `admin` are safe to trust

Checked on production, read-only, 9 Nov 2026:
- `user_roles` rows can be inserted, updated or deleted only by a super admin, under RLS ("Super admins can insert / update / delete customer roles"). The policies also say "never `super_admin`, never yourself".
- The only function that writes roles is `admin_set_user_role`, which requires a super admin and aal2.
- The trigger `prevent_super_admin_escalation` refuses `super_admin` through the API altogether.
- `handle_new_user` (sign-up) doesn't touch `user_roles`.

So no customer flow can create these roles, and no separate tester list is needed. Production holds `super_admin` ×2,
`admin` ×2 and `user` ×3: the owner's accounts are the only privileged ones. The owner's testing account (`admin`) keeps access.

### The server (not just the screen)

- **Every HMRC Edge Function refuses before any HMRC call, token read, state or audit row:** `hmrc-connect-start`, `-connect-complete`, `-test-call`, `-vat-obligations`, `-vat-submit`, `-vat-return-view`, `-vat-liabilities`, `-vat-payments` and `-vat-penalties`.
  - The refusal is `403 hmrc_unavailable_for_now`, "HMRC filing isn't available yet."
  - The check is in one place: `identify` in `supabase/functions/_shared/hmrc/caller.ts`, right after the session is verified.
  - It reads the switch with the service role on every call (`_shared/hmrc/access.ts`, no cache, fail closed), wired once in `serve.ts` `realDeps`.
- **`hmrc-disconnect` stays open for everyone**, so a connected customer can always delete their HMRC tokens.
- `data-export`, `account-delete` and `company-close` don't use this check and are not affected.
- **Visible is today's behaviour**, unchanged. Every existing Deno suite passes unchanged.

### The app

When HMRC is hidden for this person:
- **HMRC page** (Business Tools → HMRC Integration): the connection card, tabs, obligations, settings, the old submission log and the help block are replaced by a "VAT return" heading, the line, and the VAT return preview.
- **VAT Returns screen:** no "Use an HMRC obligation" choice, no deadline banner, and no submit, test or fraud-header test. Also gone: submission history (with Check what HMRC holds and Receipt), liabilities, payments, penalties and every sandbox scenario picker.
- **Settings:** the HMRC tab is gone (`?tab=hmrc` opens Account).
- **Business Tools card:** "VAT return preview" with the same message instead of "HMRC Integration Suite".
- **A company still connected:** its stored connection is left untouched, and an owner or admin sees **Disconnect** next to the line.
- **While access is being checked:** nothing HMRC-related flashes up.

### The owner's control

**Admin → Settings → "HMRC features for customers"** (super admins only):
- It shows the current state, when it changed and who changed it.
- It has two buttons: **Show HMRC test features to customers** and **Hide HMRC test features from customers**.
- Writes go through `hmrc_set_customer_access`: super admin, aal2 (`require_aal2_admin`), an admin audit entry (`settings.hmrc_customer_access`) in the same transaction, and who and when on the row.
- The demo account isn't a super admin, so it is refused.

**Manual fallback** (for the owner's assistant, in the Supabase SQL editor, after the SQL is applied):

```sql
UPDATE public.platform_settings SET value = '"hidden"', updated_at = now() WHERE key = 'hmrc_customer_access';   -- hide
UPDATE public.platform_settings SET value = '"visible"', updated_at = now() WHERE key = 'hmrc_customer_access';  -- show
```

These two statements write no admin audit entry; the Admin page does.

## The three states of the world

| State | What customers get |
| --- | --- |
| **hidden** (default) | No HMRC features. The preview and CSV only, and Disconnect if connected |
| **visible** | HMRC's test environment, exactly as today, labelled TEST ENVIRONMENT everywhere |
| **production** (later, not built) | Only after HMRC approves production. Code changes are needed then (production is refused in `config.ts`); the switch doesn't open production. At that point `HMRC_PRODUCTION_APPROVED` in `src/lib/hmrcAccess.ts` is set to true so the wording guard allows reviewed claims |

## SQL waiting to be applied

`docs/hmrc-hide/proposal.sql` is one transaction, additive only, and **not applied**. It:
- seeds the row as `"hidden"`;
- adds a SELECT policy so every signed-in person can read **that key only** (anon reads nothing);
- adds `hmrc_set_customer_access(text)` and `hmrc_customer_access_status()`. Both are SECURITY DEFINER with `search_path = ''`, for super admins only, and not callable by anon.

It refuses unless production matches what was read: 148 tables, the `platform_settings` columns and its four policies, no existing `hmrc_customer_access` row, and the md5 of `is_super_admin`, `require_aal2_admin` and `admin_log_action`.

`rollback.sql` removes the two functions, the policy and the row. Customers are then hidden (fail closed), and the audit entries stay.

**Tests:** `PG_RUN_USER=postgres bash docs/hmrc-hide/run-test.sh`, on a disposable local Postgres: **41 PASS, 0 FAIL**. They cover:
- seeded hidden;
- a customer and a platform admin read only the HMRC key and can't write it, add settings, flip it or read who changed it;
- a customer can't give themselves `admin` or `super_admin`;
- anon reads nothing and can call neither function;
- a super admin needs aal2, then flips it with an audit entry and who and when; only `visible` or `hidden` is accepted;
- the demo account is refused;
- the rollback restores the exact state;
- a second apply is refused, and an existing row is never overwritten;
- drift is refused.

`fixture.sql` gives the local copy production's `platform_settings`, `user_roles` rules and `admin_log_action` (md5 checked).

## Owner steps

1. **Apply the SQL** (after review): `docs/hmrc-hide/proposal.sql` in the Supabase SQL editor.
2. **Redeploy the HMRC Edge Functions.** They all use the changed shared code:

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
   ```

   - JWT verification stays on. Never use `--no-verify-jwt`.
   - No new secret is needed.
   - The P7d CORS change rides along if you haven't deployed it yet.
3. **Publish the front end.** From here customers see the HMRC area hidden.
4. **Flip the switch** whenever you want: Admin → Settings → "HMRC features for customers". Nothing is needed to keep it hidden.

**Check after rollout:**
- Signed in as an ordinary customer, Business Tools shows "VAT return preview" and the page shows the line and the preview. Settings has no HMRC tab.
- Signed in as your `admin` account, you see everything as before.

**To flip back:** use the other button, or run the fallback SQL. Changes take effect on the next page load and the next function call; nothing is cached.

## Copy audit (step 5)

Customer-facing text was searched (pages, articles, plan lists, the assistant's knowledge, email templates, `public/`,
`index.html`) for anything saying or implying that B2BNEST **already** files VAT with HMRC, is MTD compatible, or is
HMRC approved or recognised.

**Clear-cut filing claims found: none.** Every mention says "test environment" or "filing not available yet", so no
wording was changed for that reason.

**Owner decisions** (not claims of filing, but worth a look while HMRC is hidden):

| File:line | Text | Why it's listed |
| --- | --- | --- |
| `src/pages/articles/IntegrationsGuide.tsx:252` | "HMRC integration requires additional verification. Setup can take 2-3 business days for approval." | Not true of the current connection (instant, test environment) and mentions "approval". Suggest removing |
| `src/pages/articles/IntegrationsGuide.tsx:243-244` | "Valid HMRC Government Gateway credentials", "MTD-enabled business account" | Prerequisites for production, not for today's test connection |
| `src/pages/KnowledgeBase.tsx:69, 70, 85, 115` | "obtain Client ID/Secret from HMRC Developer Hub…" | Out of date: customers need no keys (B2BNEST uses its own HMRC application). Describes a hidden feature |
| `src/pages/Help.tsx:30-31` | "How do I connect my HMRC account?" (test environment, test VAT return) | Honest, but describes features hidden from customers |
| `src/pages/categories/MarketingMaterials.tsx:56-59` | Promo "HMRC Integration" (test environment) | Promotes a hidden feature |
| `src/lib/plans.ts:101, 118` | "HMRC Integration: connect your company to HMRC (filing not available yet)" | Plan feature for a hidden feature (plans weren't changed, as asked) |
| `src/components/LiveCostSavingsCalculator.tsx:28` | HMRC Integration counted against FreeAgent | Compares with software that does file |
| `supabase/functions/ai-assistant/knowledge.ts:166-175` | The assistant describes connecting and test submissions | Honest, but may tell a customer about hidden features |
| `src/pages/Onboarding.tsx:259` | "Security & HMRC: … your HMRC connection settings" | Points to the Settings tab that is hidden |
| `src/pages/PrivacyPolicy.tsx:52` | "…sending a VAT return…" (test environment only) | Accurate either way. Keep |
| `src/pages/articles/FinancialToolsGuide.tsx:293` | "File VAT returns with HMRC on time to avoid penalties" | Advice to the customer, not a claim. Keep |

**Guard:** `src/test/hmrcHideClaims.test.ts` keeps the one list. It fails on "HMRC approved/accredited/certified", "HMRC recognised", "MTD/Making Tax Digital compatible/compliant/ready/approved", "ready for MTD", "files your VAT return" and "we/B2BNEST file/submit/send VAT returns to HMRC" in customer-facing copy, while `HMRC_PRODUCTION_APPROVED` is false.

`src/test/noInventedClaims.test.ts` already banned "coming soon". It now allows only the one exact sentence above.

## Risks

- **Customers mid-connection** when the switch is hidden: `hmrc-connect-complete` refuses, so the sign-in doesn't finish. Nothing is stored and they can connect later.
- **`hmrc-disconnect` stays open while hidden, on purpose.** It only deletes tokens, under the usual owner or admin check.
- **The owner's accounts depend on `user_roles`.** Removing your `admin` or `super_admin` role would also hide HMRC from you.
- **The front end decides only what it shows.** The real refusal is in the Edge Functions. An old browser tab that still shows HMRC buttons gets "HMRC filing isn't available yet." when used.
- **Before the SQL is applied,** customers can't read the setting at all, so they see hidden. Your accounts still see everything, because of the role.

## Out of scope

- Production: refused in code; this switch doesn't open it.
- Changing HMRC behaviour when visible, the fraud headers, the immutable tables, plans, prices, Stripe, other RLS, or secrets.
- Deleting any stored HMRC data. Connections and submission records stay as they are.
- The owner-decision wording above.
- A per-company or per-person tester list. Not needed, because roles can't be self-granted.
