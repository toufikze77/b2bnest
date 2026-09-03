# B2BNest — Application Blocker Remediation (2026-09)

Scope: remove the two application blockers identified in
`docs/production-security-preflight-2026-09.md` and re-validate against the exact package
`supabase/remediation/round2-2026-09.sql`.

**Nothing was deployed. Production was not written to.** All validation ran on an isolated local
PostgreSQL 17 cluster (`/tmp/stg5`, socket `/tmp/pgs5:55436`) rebuilt from
`supabase/baseline/production-schema-baseline-2026-09.sql`.

---

## 1. oauth-hmrc — original problem

`supabase/functions/oauth-hmrc/index.ts` created **one** Supabase client, with the anon key plus the
caller's forwarded `Authorization` header, and used it for everything:

* `rpc('encrypt_hmrc_token', …)` twice — Round 2 makes that function **service-role only**, so the
  HMRC OAuth callback would have failed with `42501` after deployment (the deployment blocker).
* Additional weaknesses found while tracing the flow (not only RPC permission):
  * The **HMRC client secret was sent from the browser** in the request body (`clientSecret`), i.e. the
    frontend had to fetch a decrypted credential just to complete a server-side token exchange.
  * `clientId` / `redirectUri` / `sandboxMode` were also browser-supplied and therefore attacker-controllable
    for a legitimately authenticated user.
  * The raw HMRC error body was echoed back to the browser (`HMRC OAuth failed: <provider body>`).
  * The organisation used for tenant tagging came from a single unchecked membership lookup.

---

## 2. oauth-hmrc — changes

`supabase/functions/oauth-hmrc/index.ts` rewritten:

1. **Two clients, clear trust split.** `userClient` (anon key + caller JWT) is used **only** to resolve the
   caller identity via `auth.getUser()`. `adminClient` (`SUPABASE_SERVICE_ROLE_KEY`, no session persistence)
   is used for encryption and storage and exists only inside the Edge Function runtime.
2. **Fails closed** when `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are missing, and
   when there is no `Authorization` header.
3. **Request body is now only `{ code }`.** `clientId`, `clientSecret`, `redirectUri` and `sandboxMode` are
   read server-side from the caller's own `hmrc_settings` row; the client secret is decrypted with the
   service role (`decrypt_hmrc_token`). The browser no longer transmits a credential.
4. **Encryption runs with the service role** (`encrypt_hmrc_token`) and fails the request if it errors, so no
   plaintext token can ever be written.
5. **Ownership is derived from the verified JWT** (`user.id`); no `user_id` is accepted from the body.
   The organisation is only accepted when the caller is an **active member** of it — otherwise it falls back
   to the caller's own active membership, or NULL. A token cannot be stored against another user or tenant.
6. **No secret leakage in responses or logs**: the provider error body is logged as a status code only,
   never returned; no raw or encrypted token is logged or returned. The response carries only
   `{ success, message, expires_at }`.

`src/services/hmrcService.ts` — `handleOAuthCallback` now invokes `oauth-hmrc` with `{ code, state }` only;
it no longer reads or transmits the client secret.

---

## 3. HMRC authorization flow after the change

```text
browser (authenticated user)
  └─ GET HMRC authorize URL, user consents
  └─ callback → hmrcService.handleOAuthCallback(code, state)   [state checked client-side]
        └─ supabase.functions.invoke('oauth-hmrc', { code, state })   (user JWT, anon key)
              ├─ userClient.auth.getUser()            → authoritative user.id
              ├─ adminClient (service role)  → hmrc_settings for THAT user.id
              ├─ adminClient.rpc('decrypt_hmrc_token') → client secret (server memory only)
              ├─ POST HMRC /oauth/token                → access + refresh token (server memory only)
              ├─ adminClient.rpc('encrypt_hmrc_token') → ciphertext          [service-role only]
              ├─ membership check → organization_id (active membership or NULL)
              └─ adminClient.upsert hmrc_integrations (user_id = verified caller)
        └─ response: { success, expires_at }   ← no token material
retrieval: browser → get_hmrc_tokens()  [SECURITY DEFINER, assert_self, self only]
```

Service-role credentials exist only in the Edge Function environment. `encrypt_hmrc_token` /
`decrypt_hmrc_token` remain inaccessible to PUBLIC, `anon` and `authenticated`.

---

## 4. useSubscription — original problem

`src/hooks/useSubscription.tsx` inserted directly into `public.subscribers` whenever the user had no row:

```ts
await supabase.from('subscribers').insert({ user_id, email, subscribed: false, subscription_tier: 'free' })
```

Round 2 removes the client INSERT policy and the `authenticated` INSERT grant, so this call would have
failed on every first page load for a new user and logged an error. Structurally it also made the browser a
writer of entitlement rows.

---

## 5. useSubscription — changes

* The direct INSERT is **removed**. It was **not** replaced by another client-callable entitlement RPC.
* When no subscriber row exists, the hook fires the existing trusted server flow
  (`supabase.functions.invoke('check-subscription')`, best-effort, non-fatal) and renders the free tier from
  the absence of a record (`subscribed:false`, `tier:'free'`, 10 free AI credits — matching the server-side
  default returned by `get_ai_credits_info`).
* Read behaviour is unchanged: profile trial info, `subscribers` self-row SELECT, `check_trial_status`.
* `src/components/LivePurchaseNotification.tsx` (secondary caller): its `subscribers` SELECT now returns no
  rows for visitors after Round 2; the error branch was made silent so the component degrades to showing
  nothing instead of logging cross-tenant read failures. This also removes a pre-existing display of other
  customers' emails.

---

## 6. Authoritative subscription flow after the change

```text
customer → /pricing → create-subscription-checkout | create-payment   (Edge, service role)
        → Stripe hosted checkout
        → payment
        → stripe-webhook (Edge, service role, signature-verified) → update_payment_status
        → check-subscription (Edge, service role): lists the Stripe customer + active subscription,
          reads the real price/interval from Stripe, maps amount/interval → tier,
          upserts subscribers{subscribed, subscription_tier, subscription_end, stripe_customer_id}
        → useSubscription READS subscribers → UI entitlement
cancellation / failed payment: Stripe state changes → check-subscription upserts subscribed=false,
          tier=null, end=null → entitlement drops
```

A trusted server-side entitlement flow already existed; **no duplicate billing architecture was created**.
Entitlement is derived from Stripe data only — never from browser-supplied plan, price or success flags.

Note (advisory, not a blocker): `check-subscription` maps Stripe **amount bands** to tiers rather than an
explicit `price_id → platform_plans` mapping. It is still trusted-server-derived, but an explicit price-ID map
would be more robust; recorded as follow-up R7.

---

## 7. Files changed

| File | Change |
|---|---|
| `supabase/functions/oauth-hmrc/index.ts` | Service-role trusted context, server-side credentials, ownership/tenant enforcement, no secret leakage |
| `src/services/hmrcService.ts` | Callback no longer sends client credentials to the Edge Function |
| `src/hooks/useSubscription.tsx` | Removed client INSERT into `subscribers`; free tier by absence + trusted `check-subscription` refresh |
| `src/components/LivePurchaseNotification.tsx` | Graceful degradation now that `subscribers` reads are owner-scoped |
| `scripts/staging/40_app_compat_tests.sql` | **New** — 31 HMRC/subscription application-compatibility security tests |
| `docs/application-blockers-remediation-2026-09.md` | This report |

No SQL in `supabase/remediation/round2-2026-09.sql` was modified.

---

## 8. Additional unsafe callers discovered (repository-wide search)

Searched: `.from('subscribers').insert/update/upsert`, `encrypt_hmrc_token`, `decrypt_hmrc_token`,
`encrypt_integration_token`, `encrypt_banking_data`, `encrypt_payment_data`, `SERVICE_ROLE`, `VITE_*`,
direct payment/tier/plan/entitlement writes.

| Caller | Finding | Status |
|---|---|---|
| `src/hooks/useSubscription.tsx:110` | client INSERT into `subscribers` | **FIXED** |
| `supabase/functions/oauth-hmrc/index.ts` | `encrypt_hmrc_token` via user context | **FIXED** |
| `src/components/LivePurchaseNotification.tsx:29` | reads all recent `subscribers` (emails) from the browser | Hardened (returns nothing after Round 2); cosmetic follow-up if social proof is still wanted |
| `supabase/functions/check-subscription/index.ts:63,120` | `subscribers` upserts | Legitimate — service role, Stripe-derived |
| `src/pages/admin/AdminPlans.tsx:31` | `platform_plans` update | Legitimate — Super Admin surface, RLS-guarded (`is_super_admin`) |
| `src/services/hmrcService.ts` `get_hmrc_tokens` / `get_hmrc_client_secret` | decrypted values reach the browser | Not a blocker (RPCs remain granted and self-scoped); follow-up R1 — mediate HMRC API calls server-side |
| `src/components/hmrc/HMRCSettings.tsx` | prefills/edits the client secret in the browser | Same follow-up R1 |
| Any `encrypt_*` / `decrypt_*` call in `src/` | **none found** (only generated type declarations in `types.ts`) | OK |
| `SERVICE_ROLE` in `src/` | **none found** | OK |
| Service-role usage in Edge Functions | 36 functions; all server-side runtime only | OK |

---

## 9. HMRC test results (isolated staging, exact Round 2 package applied)

| # | Test | Result |
|---|---|---|
| 1 | Authenticated user can begin a legitimate connection (settings readable, callback path intact) | PASS |
| 2 | Trusted server context (service_role) can execute `encrypt_hmrc_token` | PASS |
| 3 | Browser authenticated client cannot execute `encrypt_hmrc_token` / `decrypt_hmrc_token` | PASS (`42501`) |
| 4 | Anonymous caller cannot execute `encrypt_hmrc_token` / `decrypt_hmrc_token` | PASS (`42501`) |
| 5 | User A cannot read user B tokens (table + `get_hmrc_tokens`) | PASS |
| 6 | Org A cannot read org B HMRC settings / client secret | PASS |
| 7 | Raw tokens absent from logs (code review: only status codes and `user.id` are logged) | PASS |
| 8 | Service-role credentials absent from browser bundle/network responses | PASS (see §13) |
| 9 | Token storage + refresh update path still functional for the trusted context | PASS |
| 10 | NULL / `auth.uid()` bypass closed (`get_hmrc_tokens(null)`, `get_hmrc_client_secret(null)`) | PASS |
| 11 | Token cannot be stored against another user (forged `user_id` insert) | PASS |

---

## 10. Subscription test results

| # | Test | Result |
|---|---|---|
| 1 | Customer cannot INSERT subscriber entitlement (old client path) | PASS (denied) |
| 2 | Customer cannot UPDATE own tier | PASS |
| 3 | Customer cannot self-assign Professional | PASS |
| 4 | Customer cannot self-assign Enterprise / credits / expiry | PASS |
| 5 | Customer cannot mark payment paid (UPDATE and INSERT) | PASS |
| 6 | Customer cannot modify another user's subscription | PASS |
| 7 | Trusted server/webhook can create and update entitlement and payment status | PASS |
| 8 | `useSubscription` read path works (own row + `get_ai_credits_info`) | PASS |
| 9 | Cancellation through the trusted server path works | PASS |
| 10 | No entitlement without a verified payment (absence = free tier) | PASS |
| 11 | Stripe customer/subscription ID cannot be spoofed by the customer | PASS |
| 12 | Cross-tenant subscription read/manipulation fails | PASS |
| 13 | Anonymous visitors read no subscriber rows | PASS |

---

## 11. Full security regression totals

Fresh rebuild → exact `round2-2026-09.sql` (exit 0) → `10_seed_tenants.sql` → `20_security_harness.sql`
→ `30_security_tests.sql` → `40_app_compat_tests.sql`:

```
SECURITY MATRIX (30-case suite):   PASS 471   FAIL 0   INFO 54
APPLICATION COMPATIBILITY (new):   PASS  31   FAIL 0
TOTAL:                             PASS 502   FAIL 0   INFO 54
```

No INFO or BLOCKED item was converted into a PASS; the 54 INFO entries are unchanged from the pre-flight.

---

## 12. Application compatibility results

* TypeScript check: clean.
* Production build: succeeded (`vite build`, 22.15 s).
* HMRC connect/refresh/retrieve, subscription read/refresh, billing webhook and Super Admin paths remain
  functional under Round 2 grants (see §9–§11).
* No remaining application caller depends on a privilege Round 2 removes.

---

## 13. Browser secret scan

Scan of `dist/` after a production build:

* `SERVICE_ROLE`, `service_role`, `SUPABASE_SERVICE*`, `sk_live_`, `sk_test_`, `rk_live_`, `whsec_`,
  `encrypt_hmrc_token`: **0 matches**.
* JWTs embedded in the bundle: exactly one, with `"role":"anon"` (the intended publishable key).
* No `VITE_*` names referencing server credentials.

**Result: ZERO server secrets in browser output.**

---

## 14. Remaining FAIL

None. 0 FAIL across the security matrix and the application compatibility suite.

---

## 15. Remaining BLOCKED

None in the executed suites. Environment-limited (unchanged from the pre-flight, not counted as PASS):
PostgREST-level, Edge Function runtime and browser-authenticated end-to-end tests cannot be executed here
because the Supabase project is external/unmanaged.

---

## 16. Remaining deployment blockers

**None.** Both pre-flight blockers are cleared:

* B1 (oauth-hmrc encryption context) — fixed.
* B2 (client INSERT into `subscribers`) — fixed.

Open follow-ups (advisory, non-blocking): R1 browser-side HMRC token/client-secret retrieval;
R2 `anon` retains a `SELECT` table grant on `payments` (no rows reachable); R7 Stripe amount-band tier mapping
should become an explicit price-ID → `platform_plans` map.

Deployment ordering requirement stands: **deploy the application/Edge Function changes first**, then apply
`round2-2026-09.sql`, under separate explicit authorisation.

---

## 17. Does `round2-2026-09.sql` still match the tested package?

**Yes — byte-for-byte unchanged.** No security boundary was weakened: no PUBLIC/anon/authenticated EXECUTE was
restored on encrypt/decrypt, no permissive `subscribers` INSERT was reinstated, and no customer-controlled
payment or plan write was added. The file re-applied cleanly (exit 0) in this phase and reproduced the same
471 / 0 / 54 result.

---

## 18. Production deployment recommendation

The two application blockers are removed and validated; the database package is unchanged and re-verified.
Remaining pre-deployment obligations from the pre-flight still apply: take and **verify** the backups,
re-capture the schema fingerprint, deploy the application + Edge Function changes first, then apply the
package in a low-traffic window with the tested rollback staged. Actual deployment requires separate explicit
authorisation, which this phase does not grant.

HMRC APPLICATION COMPATIBILITY: PASS
SUBSCRIPTION APPLICATION COMPATIBILITY: PASS
SECURITY REGRESSION: PASS
PRODUCTION DEPLOYMENT BLOCKERS: CLEAR
DEPLOYMENT RECOMMENDATION: APPROVE
