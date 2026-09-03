# B2BNest — Organisation Ownership Migration Design (2026-09)

**DESIGN ONLY. Production was accessed READ-ONLY.** No `ALTER TABLE`, no policy change, no
backfill, no deployment was performed. All counts below come from read-only catalog/`SELECT count(*)`
queries against production (`gvftvswyrevummbvyhxa`).

Target model:

```text
auth.users
  └── organization_members (user_id, organization_id, role, is_active)
        └── organizations                <-- AUTHORITATIVE TENANT
              └── business records (organization_id + created_by [+ assigned_to])
```

---

## 1. Ownership-column inventory (public schema)

RLS is enabled on **all 92** public tables. Ownership columns present today:

| Table | Business purpose | Ownership col(s) | org_id? | RLS model | Policies | Personal/Org | Candidate | Risk |
|---|---|---|---|---|---|---|---|---|
| organizations | tenant record | created_by | (id) | membership helpers | 3 | ORG | no | – |
| organization_members | membership | organization_id,user_id | yes | membership helpers | 3 | ORG | no | – |
| organization_invitations | invites | organization_id | yes | org admin + definer token | 1 | ORG | no | – |
| projects | company projects | organization_id,user_id | yes | `user_can_access_project` | 9 | ORG | partial (5 null org) | MED |
| project_members / project_activities / project_share_logs / project_time_entries | project children | project_id,user_id | via parent | `is_project_member`/`user_owns_project` | 3/2/2/3 | ORG | inherit only | LOW |
| todos | tasks | organization_id,user_id | yes | mixed owner+org | 4 | HYBRID | partial (1 null org) | MED |
| todo_subtasks / todo_comments / todo_history | task children | todo_id,user_id | via parent | parent-derived | 4/3/2 | ORG | inherit only | LOW |
| teams / team_members | sharing groups | owner_id / user_id | no | `owns_team`/`is_team_member` | 4/3 | ORG | YES | LOW (0 rows) |
| crm_contacts | CRM contacts | user_id | no | owner-only | 1 | ORG | YES | MED |
| crm_deals | CRM pipeline | user_id | no | owner-only | 1 | ORG | YES | MED |
| invoices | sales invoices | user_id | no | owner-only | 4 | ORG | YES | MED |
| quotes | quotations | user_id | no | owner-only | 4 | ORG | YES | MED |
| bills | purchase bills | user_id | no | owner-only | 4 | ORG | YES | MED |
| expenses / outgoings | costs | user_id | no | owner-only | 1/1 | ORG | YES | MED |
| suppliers / products_services | finance masters | user_id | no | owner-only | 1/1 | ORG | YES | LOW |
| payroll_employees / payroll_runs / payroll_run_items / payroll_submissions | payroll | user_id (+parent FKs) | no | owner-only | 1 each | ORG (sensitive) | YES | HIGH |
| documents / user_documents / user_document_templates | business documents | user_id | no | owner/free/purchased/super-admin | 4/3/1 | ORG (templates personal) | YES | MED |
| ai_workspaces / ai_workflows / ai_conversations / workflow_run_logs / business_insights | AI usage | user_id | no | owner-only | 4/4/5/2/2 | HYBRID | YES (P2) | LOW |
| bank_accounts / bank_transactions / user_integrations / integration_settings | banking + integrations | user_id | no | owner-only + definer accessors | 1/2/3/1 | HYBRID | DEFER | HIGH (credentials) |
| hmrc_integrations / hmrc_settings / hmrc_submission_logs | HMRC | organization_id,user_id | yes | membership | 4/4/3 | ORG | done | – |
| rota_employees / rota_shifts / rota_week_publications | rota | organization_id,created_by | yes | membership | 4 each | ORG | done | – |
| notes / note_categories | personal notes | user_id | no | owner-only | 4/4 | PERSONAL | no | – |
| profiles | identity | id | n/a | self + same-org + super admin | 7 | PERSONAL | no | – |
| user_roles | platform role | user_id | no | super-admin + escalation trigger | 5 | PLATFORM | no | – |
| notifications / messages / connections / user_favorites / user_favorite_tools / user_notification_preferences / user_2fa_* | personal | user_id | no | self-only | 1–3 | PERSONAL | no | – |
| staking_* / user_stakes | wallet/staking | user_id | no | self-only | 2–4 | PERSONAL | no | – |
| subscribers / payments / payment_notifications / notification_logs | billing | user_id | no | owner read, service-role write | 1–4 | HYBRID (billing unit) | BUSINESS DECISION | MED |
| audit_logs / security_audit_logs / banking_audit_logs / integration_audit_logs / payment_audit_logs / admin_audit_logs | audit | user_id / none | no | self read + super admin | 2–3 | PLATFORM | after migration | LOW |
| platform_plans / platform_tools / platform_settings / template_catalog / template_events | platform | none | no | public read published, super-admin write | 2–5 | PLATFORM | no | – |
| companies / job_postings / social_posts / advertisements / advertisement_categories / forum_* / post_* / news_articles | directory + public content | created_by / user_id / company_id | no | curated public read, owner write | 2–5 | PUBLIC | no | – |
| b2b_form_submissions / feedback_requests | inbound leads/feedback | user_id | no | owner-only | 3/4 | ORG (P2) | optional | LOW |

`company_id` on `job_postings`/`social_posts` references the **public directory** `companies` table and is
explicitly **not** a tenant key.

---

## 2. Classification summary

- **A. PERSONAL (stay user_id):** profiles, notes, note_categories, notifications, messages, connections,
  user_favorites, user_favorite_tools, user_notification_preferences, user_2fa_*, staking_*, user_stakes,
  user_document_templates.
- **B. ORGANISATION BUSINESS:** teams, team_members, crm_contacts, crm_deals, invoices, quotes, bills,
  expenses, outgoings, suppliers, products_services, payroll_*, documents, user_documents,
  project_time_entries (via parent), b2b_form_submissions, feedback_requests.
- **C. HYBRID (org boundary + user attribution):** projects, todos (+children), ai_workspaces, ai_workflows,
  ai_conversations, workflow_run_logs, business_insights, bank_accounts, user_integrations, subscribers/payments.
- **D. PLATFORM:** user_roles, platform_*, template_catalog, template_events, all audit log tables.
- **E. PUBLIC:** companies, job_postings, social_posts, advertisements(+categories), forum_*, post_*, news_articles.

---

## 3. Authoritative organisation derivation

| Table | Row ownership source | Derivation | Confidence | Ambiguous rows possible | Multi-org risk | Recommended backfill |
|---|---|---|---|---|---|---|
| projects (5 null org) | user_id | user_id → organization_members | LOW today | YES | YES | manual confirmation |
| todos (1 null org) | project_id → projects.organization_id, else user_id | parent-first | HIGH via parent | YES for parentless | YES | parent derive, else confirm |
| todo children | todo_id → todos.organization_id | parent | HIGH | no | no | parent derive |
| project children | project_id → projects.organization_id | parent | HIGH | no | no | parent derive |
| teams / team_members | owner_id | user_id → membership | n/a (0 rows) | no | no | none needed |
| crm_contacts / crm_deals | user_id | membership | LOW | YES | YES | confirmation |
| invoices / quotes / bills / expenses / outgoings / suppliers / products_services | user_id | membership | LOW | YES | YES | confirmation |
| payroll_employees | user_id | membership | LOW | YES | YES | confirmation |
| payroll_runs → run_items → submissions | parent FK | parent | HIGH | no | no | parent derive |
| documents / user_documents | user_id | membership | LOW | YES | YES | confirmation |
| ai_workspaces → workflows → conversations → run_logs | user_id then parent | membership + parent | MED | YES at root | YES | confirmation at root |
| business_insights | user_id | membership | LOW | YES | YES | confirmation |

"LOW" confidence is driven entirely by Phase 4 below.

---

## 4. Multi-organisation user analysis

Verified read-only:

- `organization_members` has **no unique constraint on user_id** → a user **can** belong to several orgs.
- Roles present in production: `owner`, `admin` (no `member` rows yet). `is_active` is true for all 7 rows.
- Production: **7 organizations, 7 memberships, 1 user belongs to >1 organization, 0 users with no org.**
- There is **no `current_organization` / active-org column** and **no organisation switcher in the UI**;
  the app resolves "the user's org" implicitly (`ensure_user_has_org`, `create_user_organization`).
- Business rows owned by the multi-org user (i.e. **ambiguous** today):

| Table | Rows | Ambiguous (multi-org owner) |
|---|---|---|
| crm_contacts | 6 | 6 |
| crm_deals | 4 | 4 |
| invoices | 3 | 3 |
| quotes | 7 | 7 |
| expenses | 2 | 2 |
| outgoings | 1 | 1 |
| suppliers | 2 | 2 |
| products_services | 3 | 1 |
| payroll_employees | 1 | 1 |
| ai_workspaces | 3 | 3 |
| ai_conversations | 11 | 11 |
| projects | 15 | 13 |
| todos | 115 | 107 |

**Conclusion:** `user_id → exactly one organization` is **NOT** safe today. Almost all business rows belong to
one multi-org user. Classification:

- **SAFE TO DERIVE:** rows whose owner belongs to exactly one active organisation (single-org users only).
- **NEEDS PARENT-DERIVED ORG:** todo children, project children, payroll run items/submissions,
  ai_workflows/ai_conversations/workflow_run_logs, todos with a project.
- **NEEDS USER CONFIRMATION:** all root rows owned by the multi-org user (CRM, finance, payroll employee,
  ai_workspaces, parentless projects/todos, documents).
- **NEEDS BUSINESS RULE:** subscribers/payments (billing unit), documents purchased vs authored.

---

## 5. Table-by-table target model

| Table | Current | Target | Keep user_id | Add org_id | Add created_by | Add assigned_to | Backfill source | RLS change | App change | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| teams | owner_id | organization_id + owner_id | n/a | YES | – | – | owner membership | YES | small | P0 |
| team_members | team_id,user_id | inherit team org | yes | no | – | – | parent | YES | small | P0 |
| projects | org_id nullable + user_id | org_id NOT NULL + created_by | yes (as created_by) | exists | rename semantics | – | confirmation for 5 nulls | tighten | small | P0 |
| todos | org_id nullable + user_id | org_id NOT NULL, created_by, assigned_to (exists) | yes | exists | – | exists | parent/confirmation | tighten | medium | P0 |
| crm_contacts | user_id | org_id + created_by + assigned_to | yes→created_by | YES | YES | YES | confirmation | YES | `CRM.tsx` | P1 |
| crm_deals | user_id | org_id + created_by + assigned_to | yes | YES | YES | YES | confirmation | YES | `CRM.tsx` | P1 |
| invoices / quotes / bills | user_id | org_id + created_by | yes | YES | YES | – | confirmation | YES | finance UI | P1 |
| expenses / outgoings / suppliers / products_services | user_id | org_id + created_by | yes | YES | YES | – | confirmation | YES | `BusinessFinanceAssistant.tsx` | P1 |
| project_time_entries | project_id,user_id | inherit project org | yes | optional denorm | – | – | parent | verify only | none | P1 |
| documents / user_documents | user_id | org_id + created_by (+visibility) | yes | YES | YES | – | confirmation | YES | document services | P2 |
| ai_workspaces | user_id | org_id + created_by | yes | YES | YES | – | confirmation | YES | `AIWorkspace.tsx` | P2 |
| ai_workflows / ai_conversations / workflow_run_logs | user_id | inherit workspace org | yes | YES (denorm) | YES | – | parent | YES | studio + edge fns | P2 |
| business_insights | user_id | org_id | yes | YES | – | – | confirmation | YES | insights UI | P2 |
| payroll_employees | user_id | org_id + created_by | yes | YES | YES | – | confirmation | YES (strict) | payroll UI | P3 (last, high sensitivity) |
| payroll_runs / run_items / submissions | user_id / parent | inherit | yes | YES on runs | – | – | parent | YES | payroll UI | P3 |
| user_document_templates, notes, personal tables | user_id | unchanged | yes | NO | – | – | – | none | none | P3 |

---

## 6. Foreign key design

All new columns: `organization_id uuid REFERENCES public.organizations(id)`.

| Group | ON DELETE | Rationale |
|---|---|---|
| invoices, quotes, bills, expenses, outgoings, payments, payroll_* | **RESTRICT** | financial/statutory records must never disappear with an org row |
| documents, user_documents | **RESTRICT** | retention/compliance |
| crm_contacts, crm_deals, suppliers, products_services | **RESTRICT** | commercially valuable; delete must be explicit |
| projects, todos (+children), teams | **CASCADE** | operational work objects; org deletion is a real teardown |
| ai_workspaces, ai_workflows, ai_conversations, workflow_run_logs, business_insights | **CASCADE** | derived/ephemeral |
| audit/log tables (future org column) | **SET NULL** | audit trail must survive tenant deletion |

Index every new `organization_id`, plus composite `(organization_id, created_at desc)` on list-heavy tables
(invoices, quotes, todos, crm_contacts, documents).

---

## 7. Target RLS design

Standard shape for organisation-owned tables (`authenticated` role only):

```text
SELECT : public.user_is_organization_member(organization_id)
INSERT : public.user_is_organization_member(organization_id) AND created_by = auth.uid()
UPDATE : created_by = auth.uid()  OR  public.user_is_organization_admin(organization_id)
         WITH CHECK organization_id unchanged (enforced by trigger)
DELETE : public.user_is_organization_admin(organization_id)
```

Variations:

| Table group | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| projects/todos/teams | member | member | creator, assignee or admin | admin or creator |
| CRM | member | member | creator/assignee or admin | admin |
| finance (invoices, quotes, bills, expenses, outgoings, suppliers, products) | member (BUSINESS DECISION: restrict to owner/admin?) | member | creator or admin | admin |
| documents | member + existing free/purchased rules | member | creator or admin | admin |
| AI tables | member | member | creator or admin | creator or admin |
| payroll | **owner/admin only** | owner/admin | owner/admin | owner |
| personal tables | unchanged self-only | unchanged | unchanged | unchanged |

Super admin access only via explicit `public.is_super_admin(auth.uid())` inside dedicated
`SECURITY DEFINER` admin RPCs — never as a broad table policy. No global `admin`/`owner`
`user_roles` checks without tenant membership. `organization_id` immutability enforced by a
`BEFORE UPDATE` trigger, not only by `WITH CHECK`.

---

## 8. Role model

Platform: `super_admin` (in `user_roles`). Organisation: `owner`, `admin`, `member`
(`organization_members.role`; production currently contains only `owner`/`admin`).

| Object | owner | admin | member |
|---|---|---|---|
| Projects/tasks | full | full | read all, write own/assigned |
| Teams | full | full | read |
| CRM | full | full | read all, write own/assigned (**BUSINESS DECISION**: should members see the whole pipeline?) |
| Invoices/quotes | full | full | **BUSINESS DECISION** (read-only vs create draft) |
| Bills/expenses | full | full | create own, read own (**BUSINESS DECISION**) |
| Suppliers/products | full | full | read |
| Documents | full | full | read org docs, write own |
| AI workspaces | full | full | use, write own |
| Payroll | full | full | **no access** (recommended) |
| Billing/subscription | owner only | read | none |
| Org settings/members | full | manage members below own role | read |

Adding the `member` role to production data is itself a **BUSINESS DECISION** (today everyone is owner/admin).

---

## 9. Same-tenant sharing problems

| Table | Current behaviour | Owner sees | Admin sees | Other member sees | Expected | Benefit | Category |
|---|---|---|---|---|---|---|---|
| crm_contacts / crm_deals | creator-only | own only | own only | own only | whole company pipeline | shared CRM | PRODUCT LIMITATION |
| invoices / quotes / bills | creator-only | own only | own only | own only | company ledger | correct finance | PRODUCT LIMITATION |
| expenses / outgoings / suppliers / products_services | creator-only | own only | own only | own only | company-wide | accurate reporting | PRODUCT LIMITATION |
| payroll_* | creator-only | own only | own only | own only | owner/admin company-wide | HR correctness | PRODUCT LIMITATION |
| documents / user_documents | creator-only | own only | own only | own only | company library | collaboration | PRODUCT LIMITATION |
| ai_workspaces/workflows/insights | creator-only | own only | own only | own only | shared automation | reuse + credit rollup | PRODUCT LIMITATION |
| teams | owner_id only, no org link | owner only | no | no | org-bound teams | closes parallel sharing channel | **SECURITY-ADJACENT** (governance) |
| projects/todos with NULL organization_id | creator-only | own only | no | no | org visible | fixes orphans | PRODUCT LIMITATION + data quality |
| notes, notifications, favourites, 2FA, staking | private | self | self | self | private | – | NORMAL PERSONAL ISOLATION |

No cross-tenant leak; the defect class is **under-sharing**, plus one governance gap (`teams`).

---

## 10. Application code impact

Query sites found for candidate tables (read-only scan):

| Table | Caller files | Current filter | Target filter | FE | Server | RPC |
|---|---|---|---|---|---|---|
| crm_contacts, crm_deals | `src/components/CRM.tsx` (8 calls), `src/pages/Onboarding.tsx`, `src/pages/BusinessOverview.tsx` | `.eq('user_id', user.id)` / insert `user_id` | `.eq('organization_id', orgId)`, insert `{organization_id, created_by}` | YES | – | admin RPCs |
| invoices, quotes, bills, expenses, outgoings, suppliers, products_services | `src/components/BusinessFinanceAssistant.tsx` (13 calls), `UserDashboard.tsx`, `QuoteInvoiceCreationSection.tsx`, `BusinessOverview.tsx`, `supabase/functions/create-subscription-invoice` | user_id | organization_id + created_by | YES | edge fn (invoice creation) | admin RPCs |
| payroll_employees/runs/run_items | `src/components/payroll/{PayrollUK,PayRunGenerator,EmployeeForm,EmployeeList}.tsx` | user_id | organization_id, role-gated | YES | – | – |
| documents, user_documents | `src/services/documentService.ts`, `src/services/userDocumentService.ts`, `unifiedSearchService.ts`, `Onboarding.tsx` | user_id | organization_id + created_by | YES | – | admin_documents_summary |
| ai_workspaces/workflows/conversations/run_logs/business_insights | `src/pages/AIWorkspace.tsx`, `WorkflowStudio.tsx`, `src/components/ai/WorkflowBuilder.tsx`, `IntelligentAnalytics.tsx`, `supabase/functions/{ai-assistant,ai-business-assistant,business-insights,workflow-execute}` | user_id | organization_id (+created_by) | YES | YES (4 edge fns) | – |
| teams/team_members | `src/lib/teamProjectHelpers.ts` (already routes through organization_members) | org membership | unchanged after teams gain org_id | small | – | `add_team_member`, `get_user_teams` |
| projects/todos | `ProjectManagement.tsx`, `TodoList.tsx`, `templateApplyService.ts`, `workspaceTemplateApply.ts` | mixed user_id/org | organization_id first | YES | – | `get_user_projects`, `add_project_member` |

A shared `useCurrentOrganization()` hook (resolving and, later, switching the active org) is a
**prerequisite** for all of the above — it does not exist today.

---

## 11. RPC / function impact

| Function | Tables | Current authorisation | Target | Change | SECDEF | Risk |
|---|---|---|---|---|---|---|
| `owns_team` | teams | owner_id = auth.uid() | + org membership | YES | yes | LOW |
| `is_team_member` | team_members | membership row | + org membership | YES | yes | LOW |
| `get_user_teams` | teams, team_members | user match / assert_self | org-scoped | YES | yes | LOW |
| `get_team_members_with_profiles` | team_members | team membership | org membership | YES | yes | MED (PII) |
| `add_team_member` | teams, team_members | team owner | org admin | YES | yes | MED |
| `add_project_member`, `is_project_member`, `user_owns_project`, `user_can_access_project`, `get_user_projects` | projects + children | project/owner based | org membership first | YES (tighten) | yes | MED |
| `check_and_deduct_ai_credit` | subscribers/ai | user (assert_self) | org credits if billing moves | BUSINESS DECISION | yes | MED |
| `admin_company_detail`, `admin_overview_stats`, `admin_tools_overview`, `admin_ai_stats`, `admin_analytics_series`, `admin_documents_summary`, `admin_list_users`, `admin_system_health` | CRM/finance/docs/AI | `is_super_admin` | unchanged guard, re-point counts to organization_id | YES (counting only) | yes | LOW |
| `update_*_updated_at` triggers | bills, ai_workspaces, project_time_entries | n/a | unchanged | no | mixed | – |
| `ensure_user_has_org`, `create_user_organization` | organizations/members | self | must return a deterministic primary org | YES | yes | MED |

---

## 12. Production data-quality counts (read-only, no PII)

```text
organizations                         7
organization_members                  7   (inactive: 0; roles present: owner, admin)
users belonging to >1 organization    1
profiles with no organization         0
projects                             15   (organization_id NULL: 5)
todos                               115   (organization_id NULL: 1)
todos with missing parent project     0
todo/project organization mismatch    1
teams / team_members                  0 / 0
crm_contacts / crm_deals              6 / 4
invoices / quotes / bills             3 / 7 / 0
expenses / outgoings                  2 / 1
suppliers / products_services         2 / 3
payroll_employees / payroll_runs      1 / 1
documents / user_documents            0 / 0
ai_workspaces / ai_workflows / ai_conversations   3 / 6 / 11
business_insights / workflow_run_logs 9 / 0
project_time_entries                  0
```

Risks: (a) one multi-org user owns the overwhelming majority of business rows; (b) 5 projects and 1 todo
carry no organisation; (c) 1 todo disagrees with its project's organisation. Nothing was repaired.

---

## 13. Ambiguous-row analysis

| Class | Rows | Handling |
|---|---|---|
| SAFE TO DERIVE | rows owned by the 6 single-org users (small remainder of each table) | automated backfill from `organization_members` |
| NEEDS PARENT-DERIVED ORG | todo children, project children, payroll run items/submissions, ai_workflows/conversations/run_logs, 114 todos with a project | parent join backfill |
| NEEDS USER CONFIRMATION | all root rows of the multi-org user (≈13 projects, 6 contacts, 4 deals, 10 invoices/quotes, 5 finance rows, 1 payroll employee, 3 AI workspaces, parentless todos, 5 NULL-org projects) | interactive assignment step before Wave execution |
| NEEDS BUSINESS RULE | subscribers/payments billing unit; documents purchased vs authored; the 1 todo/project mismatch | product decision |

**No ambiguous row may be auto-assigned.**

---

## 14. Zero-downtime migration strategy (per wave)

- **A — Add columns:** nullable `organization_id`, `created_by`, `assigned_to`; add indexes `CONCURRENTLY`.
- **B — Backfill:** parent-derived first, then single-org users; ambiguous rows deliberately left NULL and
  written to a `migration_ambiguous_rows` staging table (staging only) for owner confirmation.
- **C — Verify:** 100% resolution query per table; zero NULL org, zero parent/child org mismatch.
- **D — Dual-compatible app:** reads use `organization_id IS NOT NULL ? org filter : user filter`; writes
  populate both `user_id` and `organization_id`/`created_by`.
- **E — Add tenant-aware RLS additively:** new org policies alongside existing owner policies.
- **F — Switch app** to org-only reads; remove the dual path.
- **G — `SET NOT NULL`** + immutability trigger, add FK with the Section 6 delete rule.
- **H — Remove obsolete owner-only policies** and legacy filters after a soak period.

Each phase is its own migration with a matching rollback script, validated on the local staging harness
(`scripts/staging/rebuild-from-baseline.sh`) before production.

---

## 15. Migration waves

| Wave | Tables | Dependencies | Risk | Complexity | Testing | Rollback |
|---|---|---|---|---|---|---|
| **1 — Core tenant foundation** | teams, team_members, projects (5 NULL org), todos (1 NULL org) + children, project_* children, `useCurrentOrganization()` hook | organizations/members only | LOW (teams empty; projects/todos already have the column) | LOW–MED | full A/B matrix on projects/tasks | easy (drop column / restore policies) |
| **2 — CRM** | crm_contacts, crm_deals | Wave 1 hook | LOW (10 rows) | LOW | CRM matrix | easy |
| **3 — Finance** | invoices, quotes, bills, expenses, outgoings, suppliers, products_services | Wave 1; RESTRICT FKs | MED | MED | finance matrix + totals parity | medium (no cascade) |
| **4 — Work management** | project_time_entries, workflows scheduling, todo history/comments cleanup | Waves 1,3 | LOW | LOW | parity tests | easy |
| **5 — AI + documents** | ai_workspaces/workflows/conversations/run_logs, business_insights, documents, user_documents | Wave 1; 4 edge functions | MED (server code) | MED | AI + docs matrix, edge fn tests | medium |
| **6 — Payroll / high sensitivity** | payroll_employees, payroll_runs, run_items, submissions | Waves 1,3; strict roles | HIGH (PII) | MED | payroll role matrix | medium |
| **Deferred** | subscribers/payments (billing unit), bank_accounts, user_integrations, audit org column, private storage bucket | business decisions | – | – | – | – |

No wave may span more than one production transaction group; never migrate all tables at once.

---

## 16. Per-wave test plan

Actors: A-owner, A-admin, A-member, B-owner, B-admin, B-member, SUPER_ADMIN, ANON.
Run through PostgREST with real JWTs on staging, database-enforced (never UI-only).

For each migrated table:

1. A → A rows: SELECT/INSERT/UPDATE/DELETE per role matrix → expected ALLOW/DENY.
2. A → B rows by guessed UUID: SELECT 0 rows; UPDATE/DELETE 0 rows affected.
3. B → A: symmetric.
4. Same-org sharing: A-admin sees rows created by A-member (new behaviour) — must PASS.
5. Member restrictions: member cannot delete, cannot read payroll, per Section 8.
6. INSERT with a foreign `organization_id` → RLS violation.
7. UPDATE attempting to change `organization_id` → blocked by trigger.
8. RPC bypass: every function in Section 11 called by A against B → `Not authorized`.
9. Direct REST: `GET /rest/v1/<table>?organization_id=eq.<B>` as A → 0 rows.
10. ANON on every migrated table → 0 rows / denied.
11. SUPER_ADMIN admin RPCs → allowed + `admin_audit_logs` row written.
12. **Personal-data regression:** notes, notifications, favourites, 2FA, staking, personal templates remain
    invisible to colleagues after the wave (explicit DENY assertions).
13. Row-count parity before/after backfill per table.

Extend `scripts/staging/30_security_tests.sql` and `40_app_compat_tests.sql` per wave; a wave ships only at
0 FAIL.

---

## 17. Billing and plan effect

| Item | Current | Desired | Migration dependency |
|---|---|---|---|
| Subscription record | `subscribers.user_id` (4 rows), service-role writes | one subscription per organisation | needs billing-unit decision before any org rollup |
| Seats / users per plan | not enforced | seats counted from `organization_members` | Wave 1 |
| Projects per plan | counted per user | counted per organisation | Wave 1 |
| AI credits | `check_and_deduct_ai_credit(user)` | pooled org credits | Wave 5 + billing decision |
| Invoice/workflow limits | per user | per organisation | Waves 3/5 |
| Storage quota | none | per organisation | Phase 17 bucket |

**No billing change is proposed here.** Conflict: an organisation with several paying users currently has
several independent subscriptions.

---

## 18. Future storage model (design only, not created)

The four existing public buckets (`user-avatars`, `company-logos`, `advertisement-images`, `service-images`)
stay public presentation assets — unchanged. When the Documents feature migrates (Wave 5) and real uploads
ship, add a **private** bucket `tenant-documents`:

- Paths: `<organization_id>/<document_id>/<filename>`.
- Policies: SELECT/INSERT/UPDATE/DELETE gated by `user_is_organization_member((storage.foldername(name))[1]::uuid)`,
  DELETE additionally admin-only.
- Access exclusively via short-lived signed URLs; no public URL.
- Not created in this phase.

---

## 19. Priority matrix

Scores 1–5 (5 = highest).

| Candidate | Priority | Business | Security | Sharing impact | Migration risk | Dependencies |
|---|---|---|---|---|---|---|
| teams / team_members | P0 | 3 | 4 | 4 | 1 | 1 |
| projects (+NULL org) | P0 | 5 | 3 | 5 | 2 | 4 |
| todos (+children) | P0 | 5 | 2 | 5 | 3 | 5 |
| crm_contacts / crm_deals | P1 | 5 | 2 | 5 | 2 | 2 |
| invoices / quotes / bills | P1 | 5 | 3 | 5 | 3 | 3 |
| expenses / outgoings / suppliers / products_services | P1 | 4 | 2 | 4 | 2 | 2 |
| documents / user_documents | P2 | 4 | 4 | 4 | 3 | 3 |
| ai_* / business_insights / workflow_run_logs | P2 | 3 | 2 | 3 | 3 | 4 |
| payroll_* | P2 (execute last) | 4 | 5 | 3 | 4 | 3 |
| subscribers / payments | P2 (blocked) | 5 | 3 | 3 | 4 | 5 |
| bank_accounts / user_integrations | P3 | 2 | 5 | 2 | 5 | 3 |
| notes, notifications, favourites, 2FA, staking, personal templates | P3 (leave user-scoped) | – | – | – | – | – |

---

## 20. Business decisions required

1. **Billing unit** — per user or per organisation? Gates subscribers/payments and AI credits.
2. **Member visibility of finance** — can a `member` see company invoices/expenses, or owner/admin only?
3. **CRM visibility** — full pipeline for all members, or assigned-only?
4. **Payroll access** — confirm owner/admin only (recommended).
5. **Multi-org UX** — introduce an explicit active-organisation switcher, or restrict users to one org?
6. **Ambiguous-row assignment** — who confirms the multi-org user's ~150 rows, and through what UI?
7. **Documents ownership** — purchased templates stay personal; authored documents become org-owned?
8. **Legacy `app_role` values** (`owner`, `admin`, `manager`, `moderator`) — retire from the enum?
9. **The 1 todo whose organisation differs from its project's** — parent wins, or keep as-is?

---

## 21. Recommended FIRST migration wave

**WAVE 1 — CORE TENANT FOUNDATION**: `teams`, `team_members`, `projects`, `todos` (+ project/todo children),
plus the application `useCurrentOrganization()` hook.

Why first: `teams` is empty (zero-risk schema change that closes the last governance gap), `projects` and
`todos` already carry `organization_id` so only 5 + 1 rows need resolution, every later wave depends on the
org-resolution hook, and rollback is trivial.

---

## 22. Remaining risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | One multi-org user owns ~90% of business rows → mass ambiguity | HIGH | mandatory confirmation step; never auto-assign |
| R2 | No active-organisation concept in UI or schema | HIGH | build `useCurrentOrganization()` in Wave 1 |
| R3 | 5 projects / 1 todo with NULL organisation, 1 todo/project mismatch | MED | resolve during Wave 1 |
| R4 | Four edge functions write AI tables with user scope | MED | update in Wave 5 alongside RLS |
| R5 | Billing remains per user | MED | decision 1 before Waves 5/6 |
| R6 | Payroll PII widening if roles are mis-set | HIGH | owner/admin only, execute last, explicit DENY tests |
| R7 | Dual-write window may create org/user disagreement | MED | parity queries in Phase C/F of each wave |
| R8 | No Supabase staging project (local harness only) | MED | continue rebuild-from-baseline validation per wave |

---

```text
ORGANIZATION OWNERSHIP DESIGN: PASS
DATA BACKFILL READINESS: PARTIAL
RECOMMENDED FIRST WAVE: WAVE 1 — CORE TENANT FOUNDATION (teams, projects, todos + children)
PRODUCTION CHANGES AUTHORIZED: NO
```
