# HMRC tools on the Business and Scale plans only (and during the 14-day trial)

**Owner decision:** HMRC tools (the connection now; VAT and PAYE later) are a Business and Scale feature, like Workflow Studio.
- Solo doesn't include them. The 14-day trial does.
- Owner and master accounts keep their access, as `_access_state_for` gives it today.
- Platform roles still grant nothing inside a company.

**Prepared, not applied.** No SQL has been run, no Edge Function has been deployed, and no secret has been set.

## Rollout order (owner)
1. **Apply `docs/hmrc-plan/proposal.sql` after review.** It runs in one transaction and refuses, changing nothing, if any of these differ from production as read on 4 Nov 2026:
   - the hashes of `hmrc_manage_allowed`, `hmrc_can_manage`, `hmrc_connection_status`, `hmrc_audit_events`, `_access_state_for`, `user_is_organization_member` and `user_is_organization_admin`;
   - the privileges;
   - the `hmrc_connection_status` guard log row.
2. **Redeploy** `hmrc-connect-start`, `hmrc-connect-complete` and `hmrc-disconnect`, if they are already deployed. Until then, the deployed functions still refuse a Solo account (the database answers `plan_not_included`), but without the proper 403 status and message; the new frontend shows the right message from the code.
3. **Publish the frontend.**

## What I read
### How plans and access work
- **`_access_state_for(uuid)`** (production md5 `292e158f…`; body verbatim in `docs/phase37/fixture.sql`) returns `state, trial_ends_at, days_left, plan_key, subscription_status, via, owner_name`. The states, in the order it decides them:
  1. `suspended`: the profile is switched off, unless protected (super admin, admin/owner role, master account).
  2. `owner`: a `user_roles` super_admin, admin or owner, **or** a master account. `plan_key` is NULL.
  3. `subscribed` with `via = 'self'`: the person's own entitled `subscribers` row, with its `plan_key`.
  4. `subscribed` with `via = 'company'`: the entitled `subscribers` row **of the account that pays** for a company the person is an active member of (`organization_billing.billing_user_id`), with that account's `plan_key`.
  5. `trial`: own or company trial still running. `plan_key` is NULL.
  6. `trial_ended`: everything else. It covers accounts with no plan row and no trial.
- **Plan keys** are the same everywhere:
  - `starter` = Solo, `professional` = Business, `enterprise` = Scale;
  - in `src/lib/plans.ts`, `supabase/functions/_shared/plans.ts`, and `public.plan_prices` (production: exactly these three).
- **Workflow Studio's rule** is `supabase/functions/_shared/workflow-access.ts` (`WORKFLOW_PLAN_KEYS = ['professional', 'enterprise']`).
  - It includes `trial`, `owner`, and `subscribed` on those keys.
  - Any other known key is `plan_not_included`, and an unknown or missing key fails closed.
  - It is enforced in the Edge Functions and the app (`src/lib/access.ts` → `workflowsIncluded`). **It is not in the database.**
- **The HMRC rule reuses the same keys and the same treatment of states.**

### Where HMRC access was described (before this change)
- `src/pages/BusinessTools.tsx`:
  - card: "Save your HMRC details and preview VAT, payroll and tax returns. HMRC filing is not available yet.";
  - benefits: VAT/payroll/Corporation Tax previews, "HMRC connection settings", "Filing: not available yet";
  - it is a paid tool (`isPremium` = `access.hasAccess`: trial or any paid plan).
- `src/lib/plans.ts` (the Pricing page and `PricingPlans`): **no plan listed HMRC.**
- `src/pages/Help.tsx`, "How do I connect my HMRC account?": an owner or admin connects, sandbox only, no keys needed, filing not available. No plan was named.
- `supabase/functions/ai-assistant/knowledge.ts`: the same, with no plan named.
- `src/pages/Onboarding.tsx`: "Password, sessions and your HMRC connection settings." No plan claim, so it was left as it is.
- Billing pages: no HMRC mention.

## What changed
1. **`hmrc_manage_allowed`** (service role only, SECURITY INVOKER, `search_path = ''`) gains `plan_not_included`. The order of reasons is:
   - `not_signed_in`
   - `not_member`
   - `suspended`
   - `trial_ended`
   - **`plan_not_included`**
   - `not_admin`
   - `ok`

   The new line is: `state = 'subscribed'` and `lower(btrim(plan_key))` is not `professional` or `enterprise` gives `plan_not_included`. Everything else is byte for byte as before, and the grants are unchanged.
2. **`hmrc_connection_status`** returns `{access:'plan_not_included', can_manage:false, connections:[]}` for that reason, and nothing else.
   - It keeps the same Phase 25 guard line and grants (authenticated only).
   - Its guard log row is updated to the new body hash. `applied_at` is left as it was, so the rollback restores the row exactly.
3. **Unchanged:** `hmrc_can_manage` and `hmrc_audit_events`. They already allow only `ok`, so Solo is refused there too.
4. **Edge Functions:** `hmrc-connect-start`, `hmrc-connect-complete` and `hmrc-disconnect` answer HTTP 403 `{code:'plan_not_included', message:'HMRC tools are included in the Business and Scale plans.'}` and write an audit row (`refused`, reason `plan_not_included`).
   - A plan changed to Solo between start and complete is refused before HMRC is called.
   - `getFreshHmrcToken(company, deps, actingUser)` now checks the company rule when it acts for a person. Any member may use the connection, but the plan, trial and suspension rules apply to everyone. A refusal writes the same audit row.
5. **Frontend:**
   - The HMRC tool and Settings → HMRC show "HMRC tools are included in the Business and Scale plans." with See plans. Members (not owner or admin) also get "Ask an owner or admin of … about the plan." There is no connect button and no figures.
   - The Business Tools card: "…Filing is not available yet. Included in Business and Scale, and during the 14-day trial." This matches the Workflow Studio wording. Benefits now end with "Business and Scale plans".
   - Pricing:
     - Business lists "HMRC Integration: connect your company to HMRC (filing not available yet)".
     - Scale says "Everything in Business, including Workflow Studio and HMRC Integration".
     - Solo is unchanged, because it never listed HMRC.
     - No price, credit or other plan copy changed.
   - Help FAQ and `knowledge.ts`: new sentences only (not deployed). They say only the connection exists and filing is not available yet.

## State / plan matrix (each row is tested in the local suite)
| Person, company | `_access_state_for` | `hmrc_manage_allowed` | can manage | status (`access`) | audit |
|---|---|---|---|---|---|
| Business owner | subscribed, professional | ok | yes | ok | yes |
| Admin of a Business company (paid by the owner) | subscribed via company, professional | ok | yes | ok | yes |
| Member of a Business company | subscribed via company, professional | not_admin | no | ok (read-only) | no |
| Scale owner | subscribed, enterprise | ok | yes | ok | yes |
| Solo owner | subscribed, starter | **plan_not_included** | no | plan_not_included | no |
| Admin of a Solo company (paid by a Solo owner) | subscribed via company, starter | **plan_not_included** | no | plan_not_included | no |
| Member of a Solo company | subscribed via company, starter | **plan_not_included** | no | plan_not_included | no |
| Paying with no plan key | subscribed, NULL | **plan_not_included** (fails closed) | no | plan_not_included | no |
| Owner on the 14-day trial | trial | ok | yes | ok | yes |
| Trial ended | trial_ended | trial_ended | no | trial_ended | no |
| No plan row and no trial | trial_ended | trial_ended | no | trial_ended | no |
| Suspended | suspended | suspended | no | suspended | no |
| Master account who is an admin of a Solo company | owner | ok (owner state keeps access) | yes | ok | yes |
| Super admin / master account not in the company | owner | not_member | no | HMRC_NOT_ALLOWED | no |
| Another company's owner | — | not_member | no | HMRC_NOT_ALLOWED | no |
| Signed out / anon | — | not_signed_in / permission denied | no | permission denied | no |

**Production data on 4 Nov 2026:** 9 `subscribers` rows, none entitled (`_access_entitled` false), all with `plan_key` NULL. So no paying account loses HMRC access today. A future paying row without a plan key would be `plan_not_included` until its `plan_key` is set, the same as Workflow Studio.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 510 (baseline 510) |
| `npx vitest run` | 1,459 / 1,459 pass (150 files) |
| `npm run build` | OK |
| Deno `_shared/hmrc/hmrc_test.ts` | 19 / 19 pass |
| `deno check` of the three functions | clean |
| Deno `ai-assistant` (knowledge and handler) | 29 / 29 pass |
| Local SQL suite (`PG_RUN_USER=postgres bash docs/hmrc-plan/run-test.sh`) | 86 / 86 PASS |

- **vitest:** 7 new tests in `hmrcP0.test.tsx` and `src/test/hmrcPlan.test.ts`.
- **Deno:** 2 new tests.
- **The SQL suite covers:**
  - production hashes and the guard row;
  - the full matrix above for all four functions;
  - anon, and authenticated callers kept off the rule;
  - the rollback fingerprint (every public function body, privilege, SECURITY DEFINER flag, config, volatility, and the guard log) restored exactly;
  - re-apply, and a second apply refused;
  - rollback refused when the rule isn't applied;
  - privilege, guard-row and HMRC-function drift refused, with nothing applied.
- **Deno blocks:** `deno.land` and `esm.sh` are blocked here, so the Deno runs used the local asserts stand-in and the `createClient` stub, as in HMRC P0.

## Security advisor expectations
No new warnings. The same three authenticated-callable SECURITY DEFINER functions as HMRC P0 remain, with no new function and no grant change.

## Rollback
`rollback.sql` puts back the exact HMRC P0 bodies of `hmrc_manage_allowed` (md5 `9da6644e…`) and `hmrc_connection_status` (md5 `588c2a91…`), and the latter's guard log values.
- It refuses unless the plan rule is the version in place.
- No data changes, and no force is needed: nothing is stored by this change.

## Risks and not done
- **Paying accounts without a plan key fail closed.** The same rule already applies to workflows; set `plan_key` for those accounts.
- **Old Edge Function deploys** still refuse Solo accounts but answer without a 403 or a message until redeployed (step 2). The database refuses either way.
- **Plan keys are not shared in code.** The plan rule is written in SQL, and the frontend copy isn't driven by `WORKFLOW_PLAN_KEYS`. A test checks the SQL uses exactly those keys, but a shared HMRC rule module like `workflow-access.ts` wasn't added, because the server already decides.
- **Onboarding's "HMRC connection settings" line is unchanged.** It makes no plan claim.

## Finance expansion: phase 2 ledger foundation
The Finance ledger (chart of accounts, balanced journals, trial balance) reuses this plan rule, `hmrc_manage_allowed`, for Business, Scale and the trial. It sends nothing to HMRC. See [docs/ledger/README.md](../ledger/README.md).
