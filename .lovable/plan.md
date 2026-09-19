# B2BNEST UI Wave 1 — Preview Foundation

## Outcome
Establish the selected refined product shell and shared visual foundation in preview only. Preserve all Wave 1 tenancy, authorization, billing, HMRC, subscription, and Super Admin behavior.

## Scope
1. Complete the repository-based UX audit with screen inventory, priorities, commercial metrics, and staged recommendations.
2. Refine semantic light/dark tokens, typography, buttons, cards, page headers, focus states, and dialog viewport behavior.
3. Refine the authenticated shell into a calm, dense sidebar plus contextual top bar while retaining the canonical company switcher, command navigation, global create, responsive drawer, and collapsed state.
4. Keep the marketing header separate and extend authenticated-shell coverage only to confirmed product destinations that currently lose it.
5. Preserve organization validation and query-cache clearing without changing business logic or data access.
6. Validate representative Dashboard, CRM, and Projects views across desktop, laptop, tablet, mobile, collapsed navigation, company switcher, and dark mode.
7. Run available build, lint, regression, and security checks; document anything blocked by the external unmanaged authentication environment.

## Explicit exclusions
- No production publish or deployment.
- No dashboard, CRM, Projects, Tasks, Calendar, Finance, AI, Workflow, Rota, or Admin feature redesign.
- No RLS, Supabase, Stripe, HMRC, subscription, role, membership, organization-stamping, or company-switch authorization changes.
- No tenant-wide data search and no new backend features.
- No mass replacement of legacy raw color classes.

## Technical details
- Keep `OrganizationContext` unchanged as the tenant source of truth.
- Use semantic CSS variables and existing Tailwind mappings; retain legacy dark-mode rules as a compatibility layer.
- Do not move Super Admin into the customer shell.
- Treat route-level lazy loading and broad dialog/accessibility remediation as later focused work unless required by a Wave 1 change.
- Record evidence and exact status lines in the staging validation report.
