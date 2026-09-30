# UI Wave 1 — Foundation completion report (2026-09-30)

Preview only. Not published to production.

## Reconciled before editing
Already present and preserved: AppShell (shadcn Sidebar, collapsible icon rail, skip link, company switcher, command search, quick create, profile menu); Tasks/Calendar/Goals URL handling; query-aware sidebar active state; `PageHeader`; `/settings/unassigned-projects` route; semantic `surface` tokens. Not repeated.

## Implemented
1. **AppShell completed** — notification bell now opens a real panel; Settings stays active on `/settings/*`; sidebar highlights only the most specific matching item (Calendar no longer also highlights Projects; Expenses no longer also highlights All business tools).
2. **Page frame standardised** — new `PageContainer` (narrow/default/wide widths, shared gutters); `PageHeader` gains breadcrumbs, a default bottom margin and tightened type. Applied to Settings, CRM, Projects & tasks, Unassigned projects. Business overview heading uses the shared type scale.
3. **Conflicting backgrounds removed** — Settings, CRM, Projects (`bg-muted/20`), Business overview (slate→blue gradient), Business tools (`bg-slate-100` and slate sticky bar → `surface`/`border` tokens, bar now sits under the top bar). Light theme remains default; theme toggle untouched.
4. **Sidebar organisation** — "Unassigned projects" removed from Work; now under Settings → Company data (`/settings?tab=companies`), with breadcrumb back. Settings tabs are URL-addressable (`?tab=billing|notifications|hmrc|companies`) and scroll horizontally on phones.
5. **Notifications panel** — (hardened 00:20 UTC: unread badge uses an exact server count of all unread rows incl. NULL `read`; Mark all read updates all the user's unread rows; state clears on sign-out/user change and stale responses are discarded; mark-read failures show an alert) — reads the signed-in user's `notifications` (existing RLS: select/update where `auth.uid() = user_id`); unread badge + accessible name ("Notifications, N unread"), mark one/all read, loading skeleton, empty and error-with-retry states, link to preferences. Visible at every width including mobile (was hidden below 1024 px).
6. **Route-level lazy loading** — 79 screens lazy-loaded; Home, Auth, 404, Layout, ProtectedRoute stay eager. Suspense fallback renders inside the shell so the header/sidebar never flash. ProtectedRoute, auth redirects and all URLs unchanged.
7. **Mobile overflow fixes** found during checks: CRM contacts toolbar, CRM analytics row, Business tools filter chips and invoices header now wrap.

No database migration, no RLS/billing/HMRC/organisation logic changes, no new tools, Documents & Templates not restored, dashboard consolidation left for UI Wave 2.

## Changed files
- src/App.tsx
- src/components/shell/AppShell.tsx
- src/components/shell/NotificationsPanel.tsx (new) + NotificationsPanel.test.tsx (new)
- src/components/shell/RouteFallback.tsx (new)
- src/components/ui/page-container.tsx (new)
- src/components/ui/page-header.tsx
- src/pages/Settings.tsx, CRMPage.tsx, ProjectManagementPage.tsx, CompanyReconciliation.tsx, BusinessOverview.tsx, BusinessTools.tsx
- src/components/crm/ContactsView.tsx, src/components/crm/AnalyticsTab.tsx

## Validation (actual results, this session)
| Check | Result |
|---|---|
| Build | PASS (build OK, 2026-09-30 00:14 UTC) |
| TypeScript typecheck | PASS (0 errors) |
| Notification panel tests (vitest, `NotificationsPanel.test.tsx`) | 4/4 PASS — full unread count beyond 20-row preview (57); mark-all updates every unread row for the user (no id list/limit); explicit error on mark-read failure; state cleared on sign-out and stale previous-user response ignored |
| Visual 390/768/1024/1280/1440 × Dashboard, Settings, CRM, Projects, Business overview, Business tools | 30/30 no horizontal overflow (before: CRM and Business tools overflowed at 390) |
| Sidebar active state (Calendar, Goals, Expenses, Unassigned) | PASS — exactly one active item each |
| Settings → Company data → Unassigned projects link | PASS |
| Keyboard: first Tab = "Skip to content"; Escape closes notifications and returns focus to bell | PASS |
| Notifications panel at 390 px (empty state) | PASS (screenshot) |
| Signed-in checks (unread list, mark read, company switching, direct links with data) | NOT RUN — sandbox has no signed-in session for this project; owner to verify |
| Full tenant/security suite (`scripts/staging/run-wave1-suite.sh`, fresh disposable PostgreSQL 17.9 on local socket, rebuilt from production schema baseline: 92 tables / 981 columns) | **642 PASS / 0 FAIL / 54 INFO** — run 2026-09-30 ~00:20 UTC, exit 0 |

Screenshots (before_* / after_*): Files → ui-wave1-screenshots.zip. **All screenshots are signed-out captures** (no signed-in session available in the sandbox); screens show the "sign in" states inside the shell.

## Pending before production publish
- Owner signed-in review of the preview: notifications with real data, company switching on CRM/Projects, deep links (`/project-management?view=calendar`, `/settings?tab=billing`).
- GitHub sync confirmed by owner; this update syncs automatically.
