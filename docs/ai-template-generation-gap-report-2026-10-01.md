# AI template generation — credit infrastructure inspection and gap report (2026-10-01)

Status: PREVIEW ONLY. No database change applied. No AI generation code shipped yet —
brief §3 requires gaps to be reported before building anything that depends on them.

## 0. Owner-confirmed results recorded
Toufik's signed-in checks of the template destinations and the new Settings security
sections: **owner-confirmed PASS** (2026-09-30). Recorded separately from automated tests.

## 1. Done in this step (frontend, preview)
- Customer catalogue (`src/pages/TemplateCenter.tsx`) now drops every template for which
  `getTemplateAvailability(t).available` is false at load time. Because search, views,
  category/subcategory lists and counts are all derived from that list, unavailable
  templates no longer appear anywhere in the customer catalogue.
- Definitions are retained: `src/data/workspaceTemplates.ts` is unchanged and the admin
  catalogue (`AdminTemplates.tsx`, `includeUnpublished: true`) still lists them for review.

## 2. What exists today (traced)
| Area | Current behaviour | Source |
|---|---|---|
| Auth | Edge function reads bearer token, `auth.getUser` | `supabase/functions/ai-assistant/index.ts` |
| Balance | `subscribers.ai_credits_remaining / ai_credits_limit / ai_credits_reset_date`, **per user** | baseline schema |
| Charging | `check_and_deduct_ai_credit(user, n)` — `SELECT … FOR UPDATE`, monthly reset, deducts immediately | baseline L2248 |
| Concurrency | Row lock prevents overspend between concurrent calls | same |
| Provider | Direct OpenAI call with `OPENAI_API_KEY`, `gpt-4o-mini`, server-side | ai-assistant L10, L341 |
| Display | `get_ai_credits_info`, `AICreditsDisplay.tsx` | |

## 3. Gaps that block the brief's requirements
1. **No reservation / settlement / refund.** Credit is deducted before the provider call;
   failed, timed-out or invalid generations are never refunded.
2. **No durable idempotency.** A retried request is charged again.
3. **No credit ledger.** Only the running balance is stored; there is no auditable record of
   each charge, refund or reason.
4. **No platform/admin budget.** Admin-generated catalogue drafts have nowhere to be charged
   except a personal balance — the brief forbids that.
5. **Credits are per user, not per company.** The customer path must show "selected company";
   charges will come from the signed-in user's own balance unless company credits are designed.
6. **No store for generated/private templates or draft catalogue entries** with account/company
   scope and an admin review/publish state.
7. **No server-side company membership check** exists in the AI functions (the assistant is
   not company-scoped).
8. `check_and_deduct_ai_credit` is executable by `authenticated` for their own user id; harmless
   (only burns own credits) but a reserve/settle model should be service-role only.

## 4. Proposed database changes (NOT applied — needs your approval)
- `ai_credit_ledger` (id, user_id, organization_id, request_id UNIQUE, kind
  reserve|settle|refund|admin_budget, amount, feature, status, created_at). No prompt text stored.
- `ai_generation_requests` (request_id PK = client idempotency key + user, user_id,
  organization_id, status pending|succeeded|failed|refunded, cost, expires_at, result_template_id).
- `ai_platform_budget` (single row, credits_remaining, updated_by) — super-admin only.
- `generated_templates` (id, owner_user_id, organization_id NULL, scope account|company,
  schema_version, definition jsonb, review_status private|submitted|approved|rejected,
  published_template_slug NULL).
- Functions (SECURITY DEFINER, service_role only): `ai_reserve(request_id,user,org,cost)`,
  `ai_settle(request_id)`, `ai_refund(request_id,reason)`, `ai_expire_stale()`.
- RLS: ledger/requests readable by own user only; generated_templates by owner, or company
  members when scope=company; publication writable only by `has_role(uid,'admin')`.
- Every table: GRANT to authenticated (select only where applicable) + service_role; no anon.
- Rollback: drop the four tables and five functions; existing `subscribers` untouched.

## 5. Credit rules proposed
- Cost shown before any charge (proposed: 3 credits per generation — **please confirm**).
- Reserve → provider call → validate against strict schema → settle; any failure/timeout/invalid
  output → refund. Stale reservations refunded after 10 min.
- Same idempotency key never charged twice; no automatic retries.
- Applying a generated template to create a workspace/project is free.
- Insufficient credits → offer blank/manual template path.

## 6. Decisions needed from the owner
1. Approve the §4 schema for a staging test (preview project only, not live).
2. Customer charging source: user's own credits (as today) or new company credits?
3. Generation cost per template.
4. Platform budget size for admin catalogue drafts.
5. Provider: keep existing OpenAI key or use the built-in Lovable AI service.

## 7. Tests
Frontend change only. Remaining brief §7 tests depend on §4 and are not yet run; nothing here
claims they passed.
