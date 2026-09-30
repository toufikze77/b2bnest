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
