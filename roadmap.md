# Super Admin multi-tenant upgrade — status

- [x] Inspect existing schema, auth, roles, RLS (no new architecture introduced)
- [x] Additive migration: `organizations.status/suspended_at/suspension_reason`
- [x] Admin RPCs: `admin_list_companies`, `admin_company_detail`, `admin_set_company_status`,
      `admin_update_company`, enriched `admin_list_users`, extended `admin_overview_stats`
- [x] Drop superseded function overloads (PostgREST ambiguity fixed)
- [x] `/admin/companies` list + `/admin/companies/:id` detail (overview, users, subscription, usage, activity, security)
- [x] `/admin/users`: company, company role, plan filter, last login, suspend/reactivate, role change
- [x] Dashboard cards: trial / suspended / cancelled / new companies, MRR + ARR
- [x] Tenant isolation checklist: `docs/tenant-isolation-checklist.md`
- [x] Verified: anonymous + non-admin calls to admin RPCs return `Not authorized`; super admin calls succeed
- [ ] Customer self-service data export (deliberately not built)

# Wave 1 final blockers and product UI modernisation audit

- [x] Prepare fail-closed deterministic reconciliation for B2BNEST and AI NEST (staging/package only)
- [x] Keep AINEST unresolved while preserving owner-only transitional access
- [x] Prepare, but do not execute, future NESTPRO TRADE and NG TELECOM LTD operations
- [x] Verify every project import and template path uses the validated active company
- [x] Expand multi-company import/template/tamper regression coverage and rerun the full staging suite
- [x] Complete authenticated product UI/UX, responsive, accessibility, and performance audit
- [x] Write the UI modernisation audit and separate Wave A–D implementation plan
- [x] Confirm no production database, organisation, project, task, or deployment changes

# UI/UX modernisation — UI Wave 1 preview

- [x] Complete repository and major-screen UX audit
- [x] Select refined product-shell direction
- [x] Implement semantic shell and shared primitive refinements
- [x] Preserve company switching and cache isolation; verify via staging suite and source review
- [x] Validate Dashboard, CRM, and Projects at requested viewports
- [x] Run regression/security checks and write staging validation report
- [x] Publish the exact final blocker report and canonical 32-section UI audit
- [x] Remove multi-company first-membership fallback and validate core mobile overflow
- [ ] Production publish (blocked by explicit prohibition; separate authorization required)

# Post-Wave-1 product experience / UI modernization (UI Wave 1 authorized 2026-09-30; later waves not authorized)

- [x] Deep codebase UI audit and 30-section report: `docs/ui-ux-modernization-audit-2026-09.md`
- [x] Wave 1 operational completion: validated build published; historical assignments resolved; production signed-in, live webhook and live invoice-email checks passed (owner-confirmed); Wave 1 CLOSED 2026-09-30
- [x] UI Wave 1 — Foundation completion implemented in preview (page frame + breadcrumbs, backgrounds, sidebar IA, notifications panel, lazy routes): `docs/ui-wave1-foundation-report-2026-09-30.md`
  - [x] Build, typecheck, five-width overflow, keyboard/focus, active-state checks
  - [ ] Owner signed-in review (notifications data, company switching, deep links)
  - [x] Notification panel fixes + 4/4 targeted tests
  - [x] Tenant/security suite re-run: 642 PASS / 0 FAIL / 54 INFO (2026-09-30)
  - [ ] Production publish (after owner review)
- [x] UI Wave 2 — Activation implemented in preview (awaiting owner signed-in review before publish): one dashboard, needs attention, first-run checklist, shared states, quick actions; report docs/ui-wave2-activation-report-2026-09-30.md
- [x] UI Wave 2 final revision: year shown on out-of-year dates, "Completed this week" replaced (no completion history), 13–14px text, deadlines action; suite 662/0/54. Signed-in owner review pending; unpublished.
- [x] UI Wave 2 save fixes (task select columns; project save sends only real columns and checks one updated row) — owner-confirmed signed-in PASS for all four final checks on 2026-09-30; published.
- [x] Projects & tasks refresh flash fixed (skeleton until the selected company's data loads; placeholder data removed); mocked full-screen browser checks, create/edit shortcuts, deadline in UK + New York; suite 662/0/54. Unpublished.
- [ ] Owner signed-in check: no flash on refresh; save a Dashboard deadline and confirm the exact date after refresh (real database).
  - [ ] Proposals needing review: company-scoped contacts/invoices, company invitation flow, cross-device checklist dismissal
- [ ] UI Wave 3 — Work & customers (projects views, tasks, calendar, CRM table + side panel)
- [ ] UI Wave 4 — Money & insights (invoices/quotes consolidation, finance tables, analytics)
- [ ] UI Wave 5 — Scale (AI Studio, integrations, team, settings, admin token alignment)
- [ ] Constraint: Wave 1 tenant architecture and Round 2 controls frozen; each wave gated by 642 PASS / 0 FAIL and five-width visual checks

# Retired promotion removal + Wave 1 cleanup verification

- [x] Remove first-1000, countdown, urgency counters, and related promotional UI without changing Stripe or entitlements
- [x] Preserve published pricing at Starter £19/£190, Professional £35/£350, and Enterprise £85/£850
- [x] Verify import, template, and rota creation require the validated selected company
- [x] Verify historical-project cleanup remains fail-closed and document unresolved owner decisions without guessing
- [x] Re-run the complete Wave 1 safety suite on a disposable local PostgreSQL harness (642/0/54, 2026-09-30)

# Final production pre-deployment audit (2026-09-19)

- [x] Re-run the complete security and tenant-isolation suite (642 PASS / 0 FAIL / 54 INFO)
- [x] Verify production RLS coverage, grants and Wave 1 package already applied
- [x] Confirm the pending release is application-only with no migration
- [x] Publish `docs/production-pre-deployment-audit-2026-09.md`
- [x] Owner: resolved 3 unassigned projects and task/company mismatches
- [x] Owner: published the release and confirmed all signed-in post-deployment checks passed

## Billing — recurring Stripe subscriptions (2026-09)
- [x] Server-side plan catalogue with stable Stripe price lookup keys (£19/£190, £35/£350, £85/£850)
- [x] Subscription checkout (mode: subscription) replacing one-off plan payments
- [x] Idempotent, signature-verified webhook covering the subscription lifecycle
- [x] Subscriber fields for subscription id, price, plan, interval, status, period, cancellation
- [x] Stripe Customer Portal via Settings → Billing
- [x] Legacy stale price path and invoice mislabelling removed
- [x] Tenant/security suite re-run: 642 PASS / 0 FAIL / 54 INFO
- [x] Owner: Stripe test-mode validation completed; live webhook delivery and automatic invoice emails confirmed
- [ ] Owner: decide whether any legacy live subscriptions need a migration proposal
- [x] Owner: publish to production after Stripe validation

# Wave 1 closure (2026-09-30)

- [x] Automated migration, isolation and rollback evidence preserved: 642 PASS / 0 FAIL / 54 INFO
- [x] Signed-in tests 1–16 and A–I passed (owner-confirmed)
- [x] Live Stripe webhook delivery passed (owner-confirmed)
- [x] Live automatic customer invoice emails passed (owner-confirmed)
- [x] Git synchronization verified before closure documentation update
- [x] **WAVE 1 CLOSED**
- [x] Next task: GUI modernisation authorized — UI Wave 1 in preview

## Crypto content retirement (2026-09-30) — preview done, not published
- [x] Remove crypto pages, footer Invest section, price sidebars, crypto checkout, converter tool, crypto images, crypto SEO/sitemap/llms.txt
- [ ] Real 410/404 for retired URLs — blocked: Lovable static hosting serves the app with HTTP 200 on every path; mitigated with noindex on not-found
- [ ] Delete news_articles rows + fetch-news cron, retire fetch-news and create-coinbase-charge functions — needs owner authorization (database/backend change)
- [ ] Post-publish HTTP/asset verification on www.b2bnest.online

## Workspace templates (preview)
- [x] Distinguish project vs workspace templates; /workspaces view with Table/Board/Calendar
- [x] Owner signed-in check: create workspace template in selected company, switch company and confirm it is hidden (owner-confirmed)
- [ ] Schema for full workspaces/groups/custom columns — awaits owner approval (docs/workspace-templates-2026-09-30.md)
- [x] Durable duplicate protection: DB table applied (production DB, unused until publish), 9 app + 20 DB tests, suite 662/0/54
- [x] Owner signed-in checks (all five) — owner-confirmed 2026-09-30
- [x] Published full preview (owner chose "publish everything") — commit bdbd9e7, 2026-09-30 ~01:49 UTC
- [x] Workspace template code-review fixes (keyed state, safe status updates, verified cleanup, column order, empty groups, retry, tests)
- [ ] Transactional creation and cross-device duplicate protection — not built; awaits owner approval (same-browser duplicate protection done)

- [ ] Owner signed-in re-check: Edit project deadline + task editing in Projects & tasks (preview, unpublished)
- [x] UI Wave 3 (Work and Customers) in preview, unpublished: shared view switcher and URL filters, list table, calendar agenda, workspace filters, CRM DataTable and side panel. 81/81 tests, suite 662/0/54. Owner signed-in review pending. Report: docs/ui-wave3-work-customers-report-2026-09-30.md
- [x] Wave 3 follow-up: template kind/availability fix, security moved from CRM to Settings/Admin (preview). Template behaviour had FAILED owner review.
- [ ] Owner signed-in checks for the above (blocked: owner sign-in).
- [ ] Company-scoped audit log (needs approved schema change).

- [x] Hide unavailable templates from customer catalogue (preview)
- [ ] AI template generation — blocked on owner decisions in docs/ai-template-generation-gap-report-2026-10-01.md
