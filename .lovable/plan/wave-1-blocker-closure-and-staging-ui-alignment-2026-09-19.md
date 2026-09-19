# Wave 1 blocker closure and staging UI alignment

## Outcome
Deliver the two exact reports requested, reconcile contradictory historical counts with current evidence, preserve the completed tenant-safety fixes, and complete only the staging UI scope that can be changed without touching business logic or production.

## Blocker verification
- Re-run the isolated Wave 1 suite and report both the original 574-check baseline and the expanded current total without conflating PASS and INFO counts.
- Verify every spreadsheet/import and template creation path still requires the validated active company and keeps project/task company IDs aligned.
- Document the explicit owner-driven reconciliation workflow for the three ambiguous projects and 12-task simulated safety case; clearly separate that test fixture from current production read-only evidence.
- Make no production writes, deployments, inferred assignments, RLS weakening, billing changes, or HMRC changes.

## UI audit and staging scope
- Consolidate the existing repository-wide audit into `docs/product-ui-modernization-audit-2026-09.md` with all 32 requested sections, market-pattern decisions, growth rationale, deprecation list, staging screenshots, risks, and rollout strategy.
- Keep the public site and Super Admin shells separate.
- Validate the implemented staging foundation: authenticated sidebar, top context bar, company switcher, command palette, quick create, semantic tokens, responsive drawer, dialogs, and shared primitives.
- Review Dashboard, Projects, Tasks, and Calendar against the requested core-surface criteria. Apply only low-risk presentation refinements that preserve their current queries, mutations, permissions, deep links, and company stamping; mark any larger workflow redesign as the next separately approved UI wave.

## Validation and reports
- Create `docs/organization-wave1-final-blockers-2026-09.md` with the exact blocker findings, reconciliation mechanism, import/template coverage, rollback result, and unchanged-production boundary.
- Update visual checks at 1440, 1280, 1024, 768, and 390 pixels for the authenticated core screens where preview access permits.
- Run focused lint/build checks and the complete isolated Wave 1 suite.
- End the final report with the seven exact status lines requested and keep `PRODUCTION DEPLOYMENT AUTHORIZED: NO`.
