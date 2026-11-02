# Phase 36: Platform Overview analytics (super admin)

Every Platform Overview card (`/admin`) is now a link (keyboard reachable, focus ring, `aria-label` "<card>: open
details") to `/admin/overview/:metric`: one route, one page (`src/pages/admin/AdminMetricDetail.tsx`), one config per
metric (`src/lib/adminMetrics.ts`). The cards and their numbers are unchanged, except the AI card (below).

The route sits inside `/admin`, so it has the same guard as every admin page (`AdminLayout`: super admin, two-step code,
two-step set-up). Every RPC it calls also checks `require_aal2_admin()` + `is_super_admin` on the server.

## Rollout
1. (Optional but recommended) apply `docs/phase36/proposal.sql`: one new read-only function, nothing changed.
2. Publish the frontend.

Without step 1 the pages work; four sections say "Not available until the Phase 36 database update (docs/phase36) is
applied" (trials ending, AI by plan, AI refunds per day, top AI users with email and company).

## Cards → pages → data

| Card | Page | Data source | Views |
|---|---|---|---|
| Total Users | `/admin/overview/users-total` | existing: `admin_overview_stats`, `admin_analytics_series` | Management |
| Active Users | `users-active` | existing: same | Management |
| New Users (30d) | `users-new` | existing: same | Management |
| Total Companies | `companies-total` | existing: `admin_overview_stats`, `admin_list_companies`; new: `admin_overview_series('trials_ending')` | Management, Business development |
| Active Companies | `companies-active` | same | Management, Business development |
| Trial Companies | `companies-trial` | same | Management, Business development |
| Suspended Companies | `companies-suspended` | same | Management, Operations, Business development |
| Cancelled Companies | `companies-cancelled` | same | Management, Operations, Business development |
| New Companies (30d) | `companies-new` | same | Management, Business development |
| Active Subscriptions | `subscriptions-active` | existing: `admin_overview_stats`, `admin_list_subscriptions`, `admin_analytics_series` | Management |
| No plan | `no-plan` | existing: same; new: `trials_ending` | Management, Business development |
| Paid Subscribers | `paid-subscribers` | existing: same | Management, Business development |
| Monthly Recurring Revenue | `mrr` | existing: same | Management, Business development |
| Annual Recurring Revenue | `arr` | existing: same | Management, Business development |
| Total Revenue | `total-revenue` | existing: `admin_overview_stats`, `admin_analytics_series` (payments) | Management |
| AI Usage | `ai-usage` | existing: `admin_ai_ledger_summary` (Phase 35), `admin_overview_stats`, `admin_list_subscriptions`; new: `ai_daily`, `ai_by_plan`, `ai_top_users` | Management, Operations, Business development |
| Active Projects | `active-projects` | existing: `admin_overview_stats`, `admin_list_projects`, `admin_analytics_series` | Management, Operations |
| Documents Created | `documents` | existing: `admin_documents_summary`, `admin_analytics_series` | Management |
| Storage Used | `storage` | existing: `admin_documents_summary` | Operations |
| Support Tickets | `support` | existing: `admin_support_overview` | Operations |
| Social Activity | `social` | existing: `admin_social_stats`, `admin_analytics_series` | Management |

Every page: definition, 7 / 30 / 90 days (default 30), headlines with change against the previous period where a history
exists, charts (recharts) with a screen-reader summary and data table, tables with client-side CSV export (cells that
would run as a spreadsheet formula get a leading apostrophe), notes saying what is and isn't available, and empty states
("No AI usage yet." etc.) instead of empty charts. List RPCs are asked for at most 1,000 rows; a page says when there are
more.

## Real versus not available
- **Real:** every number shown comes from an RPC above. MRR uses each subscription's real Stripe price
  (`_subscriber_monthly_value`); plan names and list prices come from the plan catalogue (Solo £19, Business £59,
  Scale £89 a month). Revenue is payments recorded as paid. AI cost comes from the ledger's token counts × `ai_model_prices`.
- **Assumption, stated on the page:** GBP figures for the OpenAI cost use `USD_TO_GBP = 0.79`
  (`src/lib/adminMetricsCore.ts`). "Cost vs revenue" compares that with MRR × days ÷ 30.
- **Not available (said on the page, not drawn):** MRR / subscription history (no new-versus-cancelled or MRR trend),
  trial-to-paid conversion (trial start and subscription start aren't stored together), recent sign-ins ("active users"
  means not suspended), AI-drafted contracts as documents (they stay in the browser; the AI page counts them).
- **Not shown on purpose:** post text (social), document titles and support request text. The AI ledger holds no prompts,
  answers or documents.

## The AI card on Platform Overview
Credits used in the last 30 days (net, from `admin_ai_ledger_summary(30)`) and the OpenAI cost, with the total number of
conversations as the secondary line. While the ledger is empty (it has 0 rows until someone uses AI after Phase 35), or if
the ledger RPC fails, the card keeps its old value (conversations) labelled "From conversations (no AI credits used yet)".

## SQL: `admin_overview_series(_metric, _days)`
One function, four metrics (`trials_ending` max 25, `ai_by_plan`, `ai_top_users` max 10, `ai_daily`), days clamped to
1..365, unknown metric refused (22023). SECURITY DEFINER, `search_path ''`, `require_aal2_admin()` first line (recorded in
`phase25_mfa_guard_log` like the others), `is_super_admin(auth.uid())`. Executable by authenticated, service_role,
postgres; not anon. Returns only name, email and company name as personal data (as the admin screens already do).

Tests: `PG_RUN_USER=postgres bash docs/phase36/run-test.sh` (disposable Postgres 16, built on the Phase 35 fixture with
production function bodies and the Phase 35 proposal): 32 checks: privileges, guard log, anon / normal user / no-aal2
refused, every metric's numbers and fields, caps, clamping, an empty ledger, rollback, re-apply, second apply refused.

### Security advisor expectations
- `authenticated_security_definer_function_executable` (WARN): +1 (`admin_overview_series`), like every admin RPC.
- Nothing else: no table, no policy, no anon grant, `search_path` pinned.
