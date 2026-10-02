# AI template generation — staging design and implementation (2026-10-01)

Status: STAGING ONLY. Nothing applied to the live Supabase project (gvftvswyrevummbvyhxa).
No edge function deployed. No customer UI enabled. Separate from the catalogue-cleanup release.
Paid generation is disabled by default in the schema (`paid_generation_enabled = false`, prices NULL, admin cap 0).

## 1. Files
| File | Purpose |
|---|---|
| `supabase/staging/ai-templates-2026-10-01.sql` | Migration (tables, RLS, grants, functions) |
| `supabase/staging/ai-templates-2026-10-01-rollback.sql` | Rollback (removes only new objects) |
| `scripts/staging/95_ai_templates_tests.sql` | 41 database checks |
| `scripts/staging/run-wave1-suite.sh` | Now also runs AI checks, 2 real-concurrency checks, rollback check |
| `src/lib/aiTemplateSchema.ts` (+ `.test.ts`) | Strict v1 output schema, safe parsing, mapping to existing creation input |

The migration lives in `supabase/staging/`, not `supabase/migrations/`, so it cannot be applied by accident.

## 2. Database objects (proposed)
- `ai_generation_config` (single row): `paid_generation_enabled`, `customer_price_credits`, `admin_price_credits`,
  `admin_budget_cap`, `admin_budget_used`, `admin_budget_period_start` (monthly reset), `reservation_ttl` (10 min).
  Readable by signed-in users (to show the price); only super admins can change enabled/price/cap/ttl;
  nobody can edit `admin_budget_used` directly (column grant).
- `ai_generation_requests`: one row per (user, idempotency key) — UNIQUE. Status reserved → settled | refunded.
  Read own only (super admin all). No direct writes.
- `ai_credit_ledger`: append-only reserve/settle/refund entries, UNIQUE (request, entry) so a refund can
  happen once. Source `personal_credits` or `admin_budget`. No prompt text. Read own only; no direct writes.
- `generated_templates`: private by default (`scope account`), owner's company stamped and membership-checked;
  owner can edit/delete while private/rejected; `submit_generated_template` → submitted;
  `review_generated_template` (super admin only) → approved/rejected. Approval does not auto-publish into
  the catalogue; publishing stays a separate admin action.
- Functions `ai_reserve_generation`, `ai_settle_generation`, `ai_refund_generation`, `ai_expire_stale_generations`:
  SECURITY DEFINER, callable by service role only (the future edge function). Customers cannot call them.

## 3. Credit rules
1. Price and budget come only from `ai_generation_config`; the browser never sends a price, balance, user or company that is trusted.
2. Reserve: repeated key → returns the existing request, no charge. Checks company membership, generation enabled,
   price set; locks the balance row (`FOR UPDATE`) so concurrent requests cannot overspend; deducts; writes ledger.
3. Provider call happens only after a successful reserve. No automatic retries.
4. Settle: only if still reserved and not expired, and output is schema v1 (full validation in the edge function
   with `aiTemplateSchema`). Stores a private template. Repeat settle returns the same template.
5. Refund: provider error, timeout, invalid output, expiry → full refund once. A settled request cannot be refunded.
6. Stale reservations (>10 min) are refunded by `ai_expire_stale_generations()` (to be scheduled).
7. Applying a generated template to create a workspace/project is free and uses the existing creation service
   (company stamping, duplicate protection, partial-failure recovery unchanged).
8. Admin catalogue drafts charge `admin_budget` only (super admin, capped monthly), never personal credits.

## 4. Provider suitability and cost estimate (current OpenAI setup)
Current setup: `OPENAI_API_KEY`, `gpt-4o-mini`, server-side (ai-assistant). Suitable: supports JSON output with a
schema, adequate for structured task lists. Assumed list prices (verify against your OpenAI invoice):
$0.15 per 1M input tokens, $0.60 per 1M output tokens; $1 = £0.78.

| Case | Input tokens | Output tokens | Cost |
|---|---|---|---|
| Typical (3 boards, ~40 tasks) | 1,500 | 2,000 | ~$0.0014 (~0.11p) |
| Worst allowed (8 boards, 120 tasks) | 2,000 | 6,000 | ~$0.0039 (~0.30p) |

Value of one credit (from `_shared/plans.ts`, monthly): Starter £19/250 = 7.6p; Professional £35/1,000 = 3.5p;
Enterprise £85/5,000 = 1.7p. Free plan: 10 credits, no revenue.

## 5. Proposed pricing (NOT approved — your decision)
- Customer: **1 credit per generation**. Worst-case provider cost (0.3p) is under a fifth of the cheapest credit (1.7p).
  Matches the existing assistant (1 credit per call). 3 credits is not justified by provider cost.
- Admin catalogue: 1 budget unit per generation; **cap 300 per month** ≈ £0.90 worst case. Enough for ~50
  missing templates × several drafts each.
- Paid generation stays disabled until you approve both numbers; enabling is one super-admin setting change.

## 6. Output validation (v1)
Explicit `kind` (project | workspace, one-board workspace supported); project = exactly 1 board; ≤8 boards,
≤8 groups/board, ≤40 tasks/board, ≤120 tasks total; statuses backlog/todo/in-progress/review/done; views
table/board/calendar only; dayOffset 0–365; plain text only (markup, `javascript:`, event handlers, template
syntax rejected); unknown fields (automations, SQL, scripts) rejected; ≤64 KB. Preview edits are re-validated
before "Create". No customer records are sent to the model.

## 7. Test results (actual)
- Database, disposable local PostgreSQL rebuilt from the production schema baseline: full suite
  **706 PASS / 0 FAIL / 54 INFO** (was 662; +44 AI checks, all PASS). Covers: disabled by default, no price,
  cross-company refusal, reserve/idempotent retry, settle/repeat settle, no refund after settle, invalid output
  refund, provider-failure single refund, timeout and expiry sweep, insufficient credits, admin-only budget and cap,
  anon/other-user/other-company denial, forged ledger, price/budget tampering, self-approval, company-owner approval
  denied, super-admin review, two real concurrent requests (different keys: one charge; same key: one request, one charge),
  rollback removes all new tables.
- App unit tests (no provider, no database): 9 schema tests; full app suite 100/100; typecheck clean.

## 8. Not done / outstanding
- Edge function (`generate-template`) not written into the deployable functions folder, to avoid deploying against
  a live database without these tables. Next step after approval.
- Customer "Create a template with AI" screen and admin draft screen not built (no UI until pricing approved).
- No real OpenAI call made; no signed-in check possible. Cost figures are estimates from list prices.
- Live deployment: apply the migration via the migration tool only after your approval; rollback = the rollback script
  (run `ai_expire_stale_generations()` first, export the ledger if needed).

## Update — OpenAI connection and screens (preview, paid generation OFF)

**Pricing basis (estimate, not measured):** model `gpt-4o-mini`; OpenAI list price $0.15 / 1M input, $0.60 / 1M output tokens; output capped at 6,000 tokens; £1 = $1/0.78 (config `usd_to_gbp` 0.78). Estimated typical call ≈ 1,200 in / 2,500 out ≈ $0.0017 ≈ 0.13p; worst case (6,000 out) ≈ 0.3p.

**Provisional settings (configurable, not approved):** 1 customer credit per successful validated generation; 300 successful admin generations/month; separate £5/month admin provider-spend cap; applying a saved template is free. Every provider call, including failures, timeouts and retries, is logged in `ai_provider_calls` and counts towards spend.

**Built:** `generate-template` server function deployed (returns "generation disabled" while the tables are absent on live); customer "Create with AI" dialog in Template Centre (company, cost and balance shown before generating; explanation that each Generate click is a new charge; editable preview re-validated; separate explicit Create click; "Start blank" free path); admin page /admin/ai-templates (budget/settings, capped real cost test of 6 briefs incl. one prompt-injection attempt, drafts review).

**Actual results so far:** real server endpoint over HTTP against the disposable database with a stand-in provider: refunds, idempotent retry and timeout recovery PASS (part of 724 PASS / 0 FAIL / 54 INFO). App tests 101/101. **No real OpenAI generation has been run** — the sandbox has no signed-in super-admin identity. Real token usage, cost, validation failures and quality are therefore NOT yet recorded.

**Screenshot:** `docs/ai-template-dialog-disabled.png` (signed out, disabled state). Preview/editor screens not screenshotted — they need a working generation.

**Remaining before paid generation:** owner runs the capped cost test at /admin/ai-templates and sends results; pricing and budget approval; staging migration approved for live; signed-in checks of both screens.

## Capped cost test readiness (2026-10-01, 10:40 UTC)

**Which database:** the preview and the live site both use the live Supabase project `gvftvswyrevummbvyhxa`. Checked directly: none of the AI cost-test tables or functions (`ai_generation_config`, `ai_provider_calls`, `ai_probe_budget`, `ai_record_provider_call`, ...) exist there. They exist only in the disposable staging database. **The cost test cannot run or record results from the preview until the live migration is approved.** Running it from the preview now shows "Setup incomplete" and makes no OpenAI call.

**Server behaviour (edge function `generate-template`, deployed):**
- `probe_info` (platform super admin only): returns model `gpt-4o-mini`, call count, worst-case spend, monthly spend and cap, and whether setup is complete.
- `cost_probe` (super admin only): refuses with 503 `setup_incomplete` before any provider call if `ai_probe_budget` is missing; refuses with 403 `admin_spend_cap_reached` if spent + worst case > cap; skips any remaining call that would cross the cap; stops with `recording_failed` if a call cannot be recorded. No customer credits are touched.
- Worst case per call: 2,000 input + 6,000 output tokens = $0.0039 ≈ 0.30p at £1 = $1.28 (0.78). 6 calls ≈ 1.83p. Cap: £5/month (provisional).
- Admin screen shows model, calls and maximum spend and asks for confirmation before sending.

**Separate proposal for the live database (NOT applied):** apply `supabase/staging/ai-templates-2026-10-01.sql` (now includes `ai_probe_budget()`, service-role only). Rollback: `supabase/staging/ai-templates-2026-10-01-rollback.sql`. Paid generation stays off after applying (`paid_generation_enabled = false`).

**Actual checks, reported separately:**
- Staging endpoint checks over real HTTP with a local stand-in AI (no OpenAI): CP-01..CP-05 PASS — non-admin refused, preflight figures returned, 2 calls recorded with token counts and no credits charged, cap refused before any call, missing setup refused before any call.
- Live deployed function: unsigned request returns 401 (checked).
- Not yet done: any real OpenAI call. Actual token usage, cost and quality remain unmeasured.
- Separate totals: security suite 729 PASS / 0 FAIL / 54 INFO (includes the 5 new CP checks); app tests 101/101 using mocked AI.

## One-off capped OpenAI cost test (owner-approved 2026-10-01)

**Uses live Supabase infrastructure** (project gvftvswyrevummbvyhxa): a temporary table and a temporary function. The larger AI schema is NOT applied; customer credits, subscriptions and paid generation are untouched (paid generation stays disabled).

- Migration: `supabase/staging/cost-test-lock-2026-10-01.sql` — rollback: `supabase/staging/cost-test-lock-2026-10-01-rollback.sql`
- Table `public.staging_cost_test_runs`: primary key `id = 1` (CHECK) is the atomic single-run lock; `planned_calls` CHECK 1–4; RLS enabled, no policies; anon/authenticated have no privileges; service_role only. (Linter INFO "RLS enabled, no policy" is intentional: deny-all.)
- Function `staging-cost-test`: server-side super-admin check (`is_super_admin`); accepts only `{"mode":"plan"|"status"|"run"}` — any prompt/model field is refused; model fixed to gpt-4o-mini; 4 fixed synthetic prompts; no retries; 45s timeout per call; failures/timeouts count toward the 4 calls; results saved after every call; key read from `OPENAI_STAGING_KEY`; no secrets or auth headers logged.
- Limits and cost (OpenAI list price $0.15 / $0.60 per 1M tokens): ≤1,200 input + ≤2,500 output tokens per call → worst case $0.00168/call, **$0.0072 per batch ≈ £0.0056 (estimate, £1 = $1.28)**, under the £0.05 ceiling (checked server-side before the run).

### Pre-run verification (actual)
- Throwaway PostgreSQL: 7/7 — server can claim the run; second run blocked; no second row; calls capped at 4; anon and authenticated denied; RLS on; rollback removes the table.
- Function unit tests (stand-in provider): 4/4 — signed-out 401, non-admin 403, prompt/model fields 400, one run then 409; 3 concurrent runs → one 200, two 409, exactly 4 provider calls; provider errors and timeouts count, no retries.
- Live: table exists, 0 rows, RLS on, anon/authenticated no SELECT/INSERT, service_role yes; deployed function refuses signed-out requests (401).
- Not verified: the admin screen signed in as super admin (no signed-in session available to the agent).

### Results — run FAILED (2026-10-02 23:37:06–23:37:09 UTC, run by super admin)
Read from `staging_cost_test_runs` id=1 (status `finished`). The run lock is used and was NOT reset; no further OpenAI calls were made.

| Call | Business | HTTP | OpenAI error code | Tokens in/out | Cost | Time |
|---|---|---|---|---|---|---|
| 1 | Hair salon | 429 | credit_balance_exhausted | 0 / 0 | $0 | 2.2s |
| 2 | Building contractor | 429 | credit_balance_exhausted | 0 / 0 | $0 | 0.6s |
| 3 | Accountancy practice | 429 | credit_balance_exhausted | 0 / 0 | $0 | 0.1s |
| 4 | Café | 429 | credit_balance_exhausted | 0 / 0 | $0 | 0.6s |

- **Cause:** OpenAI refused every call before running the model because the staging key's OpenAI project/organisation has no prepaid credit balance. This is a billing state, not a key-permission, model-access or request-format fault: a bad key returns 401, missing model access returns 403/404, and a malformed request returns 400. The request reached OpenAI and was authenticated.
- **Safe error message:** not recorded — the function stores only the error code (max 60 chars), by design. Function logs contain no extra detail (it never logs responses, keys or headers).
- **Cost and template quality remain UNMEASURED.** No tokens were used; no template was produced.
- To retry: add credit to the OpenAI organisation/project behind the staging key; then a second run needs separate owner approval (reset of the lock or a new lock row).
- Customer paid generation remains disabled. The obsolete six-call "Real cost test" panel was removed from the admin page.

### Second run approval (2 Oct 2026, 23:53 UTC)
Owner added $5 credit and approved one additional four-call run (same model, prompts, no retries, £0.05 ceiling, no customer credits). Run 1 record (four 429 credit_balance_exhausted) preserved unchanged as record 1. Lock widened to ids 1 and 2 only; the function now claims record 2 atomically, so exactly one more run is possible across tabs/devices. Results: pending.
