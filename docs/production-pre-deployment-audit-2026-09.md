# B2BNEST — Final production pre-deployment audit (2026-09-19)

Read-only audit. No production deployment, no production data change, no pricing change,
no new features, no UI redesign was performed in this task.

Evidence base:
- Full isolated staging suite re-run: `scripts/staging/run-wave1-suite.sh` (disposable local PostgreSQL, rebuilt from the production schema baseline).
- Read-only production queries (counts, RLS state, grants, storage buckets).
- Production bundle build (`bun run build`).
- Headless route smoke over the running staging preview (unauthenticated session).

---

## A. PRODUCTION READINESS

**READY** — for an application-only release. The Wave 1 database package is already live in
production; no new migration has to run for this release.

## B. Test totals

| Category | Count |
|---|---|
| PASS | 668 (642 suite assertions + 26 audit checks) |
| FAIL | 0 |
| WARNING | 4 |
| INFO | 56 (54 suite INFO + 2 audit INFO) |

Suite line: `TOTAL SECURITY CHECKS: 642 PASS / 0 FAIL / 54 INFO` (exit 0).

Coverage confirmed by the suite and source review: cross-tenant reads, cross-tenant writes,
cross-company access, RLS coverage on every `public` table, `organization_members` boundaries,
company-level filtering, projects, todos/tasks and children, calendar/rota, CRM, invoices and
finance, analytics/overview, goals, AI Studio data, notifications, integration/OAuth records,
user and team selectors, spreadsheet imports, templates, storage access, edge functions and
service-role-only operations.

Warnings:
1. Authenticated live production regression (signup/login, Google auth, invitations, Stripe
   checkout, real company A→B→A switch) could not be executed — the Supabase project is
   external/unmanaged, so no test session can be minted. These are listed in section G as
   mandatory post-deployment tests. No evidence was fabricated.
2. Four storage buckets are public by design (`advertisement-images`, `company-logos`,
   `service-images`, `user-avatars`). Unchanged by this release; confirm no private business
   documents are ever written to them.
3. `src/pages/PLR.tsx` still shows "LIMITED TIME OFFER" on the unrelated PLR product page. It is
   not part of the retired first-1000 promotion; left untouched deliberately.
4. Main JavaScript bundle is ~4.1 MB (1.1 MB gzipped); routes are not lazy-loaded. Performance
   only, no functional or security impact. Scheduled in the UI Wave 1 backlog.

Info:
- 11 edge functions run with `verify_jwt = false` (public forms, OAuth callbacks, news, 2FA).
  Each validates its own input; unchanged by this release.
- Unauthenticated visits to protected pages produce expected 401/400 responses from RLS.
  This is correct denial behaviour, not a defect.

## C. Remaining blockers

Deployment blockers: **none**.

Open owner-decision items (fail-closed, do not block this release):
1. 3 production projects still have no company assigned. Evidence is ambiguous; no assignment
   was guessed. Owner must resolve them at `/settings/unassigned-projects`.
2. 4 tasks whose company differs from their parent project's company were preserved as-is and
   not overwritten. Owner review required.
3. Authenticated production regression cannot be automated from here (external/unmanaged
   Supabase). Owner must run section G manually after deployment.

## D. Staging → Production changes

Application only. What would change on the live site:
1. Retired promotion removed: first-1000 banner, mock signup counter, countdown timer and its
   urgency copy, and the 66%-off badges. Prices, discounts, Stripe configuration and plan
   entitlements are untouched (Starter £19/£190, Professional £35/£350, Enterprise £85/£850).
2. Company-assignment hardening for rota: employee and shift creation now use the explicitly
   selected company validated through `assertActiveOrganization`, replacing the previous
   first-company fallback. Business Overview keeps read-only behaviour.
3. Wave 1 product shell/UI refinements already validated in staging (grouped sidebar, context
   bar, command palette, quick create, semantic tokens, responsive drawer, dialog and mobile
   overflow fixes).
4. Documentation and backlog updates (no runtime effect).

No database change, no RLS change, no Stripe change, no entitlement change, no edge function
change is part of this release.

## E. Database migrations that would run

**None.** The Wave 1 ownership package
(`supabase/migrations/20260919100312_…` / `supabase/remediation/organization-wave1-2026-09.sql`)
is already applied in production, verified live: `wave1_unresolved_rows` exists with 7 recorded
rows, the `user_is_organization_member` helper is present, 0 public tables without RLS, 0 anon
write grants, 0 `PUBLIC` grants.

Migration hygiene checks (for the record):
- Idempotent: 68 `IF NOT EXISTS` / `IF EXISTS` / `CREATE OR REPLACE` guards in the Wave 1 package.
- Ordering safe: journal and reconciliation tables are created before any backfill reads them.
- The only `DELETE` is against the package's own `wave1_unresolved_rows` scratch table; no
  customer table is truncated, dropped or column-dropped.
- Existing customer data is not overwritten: rows that already carry a company are left alone and
  ambiguous rows are recorded, not guessed.
- No RLS policy weakened and no `PUBLIC`/anon permission reintroduced (verified live).

## F. Rollback plan

1. Application: revert the published version from the project History/version list. The live site
   returns to the previous build immediately; no data migration is involved.
2. Database: nothing to roll back for this release. If the already-applied Wave 1 package ever has
   to be reversed, run `supabase/remediation/organization-wave1-2026-09-rollback.sql`, which
   restores prior ownership values from `wave1_backfill_journal`. Round 2 controls have a separate
   `round2-2026-09-rollback.sql`.
3. Never roll back because an unauthorized cross-company request was correctly denied.
4. Take a database snapshot immediately before any future DB change; not required for this
   application-only release.

## G. Post-deployment smoke tests (run on the live site)

1. Sign up a new test account, sign out, sign back in; Google sign-in if enabled.
2. Create a company; confirm the new company appears in the top-bar switcher.
3. Invite a user, accept the invitation, confirm the assigned role and permissions.
4. As a two-company user, switch A → B → A and confirm no list keeps rows from the previous
   company (projects, tasks, CRM, invoices, calendar, analytics).
5. Create a project and a task; confirm both are stamped with the selected company.
6. Import a small spreadsheet of projects; confirm it refuses to run with no company selected and
   stamps the selected company when one is chosen.
7. Apply a template; confirm it uses the selected company, never the first company.
8. Create a rota employee and a shift; confirm both are stamped with the selected company.
9. CRM: create, edit and delete one contact.
10. Invoicing/finance: create a draft invoice and one expense; confirm totals.
11. Calendar/rota schedule loads for the selected company only.
12. Analytics and goals load with company-scoped numbers.
13. AI Studio: run one prompt, confirm credits deduct.
14. Integrations: open the settings page and confirm connected accounts list without errors.
15. Stripe/billing: open checkout for one plan and confirm the displayed price matches
    £19/£35/£85 monthly; cancel before paying.
16. Notifications appear and can be dismissed.
17. Security smoke: signed in as company A, request a known company B record id directly; the
    request must be denied. Guessed UUIDs must return nothing.
18. Responsive check at 1440, 1024, 768 and 390 px on Dashboard, Projects and CRM — no horizontal
    overflow.
19. Confirm no first-1000 banner, counter or countdown appears anywhere.
20. Watch error logs for 15 minutes; never log secrets or personal data.

## H. Recommendation

The current build is **technically ready for production deployment**. All 642 tenant-isolation and
security assertions pass with zero failures, the production security posture (RLS everywhere, no
anon write grants, no `PUBLIC` grants, Round 2 controls) is intact, the release is
application-only with no migration and a one-click version revert, and the two outstanding
historical-data items remain fail-closed owner decisions rather than defects. Authenticated
end-to-end regression must be completed manually using section G immediately after deployment.

Deployment is **not** performed by this audit and remains an explicit owner action.

## Production environment requirements (no secret values shown)

- Supabase: project URL, publishable/anon key and project id present; database reachable read-only
  from the audit tooling.
- Environment variables present: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID`.
- Email: Gmail SMTP credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) configured, per the
  Gmail-only email standard.
- Stripe: secret and webhook keys are held as edge-function secrets; confirm the live-mode keys and
  the webhook endpoint in the Stripe dashboard before charging real customers.
- OAuth: redirect URLs for every connected provider must list `https://b2bnest.online`,
  `https://www.b2bnest.online` and the Supabase callback host.
- Supabase Auth: Site URL and Redirect URLs must include both custom-domain forms, otherwise
  sign-in and password reset links break.
- 51 edge functions deployed; `supabase/config.toml` JWT settings unchanged by this release.
