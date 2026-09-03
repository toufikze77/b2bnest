# B2BNest — Tenant architecture & staging security validation (2026-09)

Read-only review. **No schema, RLS, storage, data or production configuration was changed.**
Scope: Phases 1–5 of the tenant architecture brief. Phase 2 migration work is deliberately **not** implemented.

---

## 1. Ownership-key inventory (all `public` tables)

RLS is enabled on **every** table in `public` (92/92 verified).

Key columns actually present:

| Key column | Tables |
|---|---|
| `organization_id` | `projects`, `todos`, `organization_members`, `organization_invitations`, `hmrc_integrations`, `hmrc_settings`, `hmrc_submission_logs`, `rota_employees`, `rota_shifts`, `rota_week_publications` |
| `company_id` | `job_postings`, `social_posts` (both reference `public.companies`, a *directory/profile* table keyed by `created_by`, **not** the tenant table) |
| `user_id` only | 60+ tables — all CRM, finance, documents, notes, AI, payroll, integrations, staking, social/forum, preferences |
| neither | `organizations`, `companies`, `teams` (`owner_id`), `profiles` (`id`), platform tables, public content tables |

**Two identifier families exist.** `organizations` (+ `organization_members`) is the **authoritative tenant**;
`companies` is a *business-directory profile* record owned by `created_by` and is only used by `job_postings` and
`social_posts`. `company_id` must **not** be promoted to a tenant key.

---

## 2/3. Classification and tenant-safety table

Categories: **A** personal, **B** tenant/company, **C** platform/system, **D** public.

| Table | Cat | Ownership key | RLS model | Tenant-isolation safe? | Recommended action | Risk |
|---|---|---|---|---|---|---|
| `organizations` | B | `id` / `created_by` | membership helpers (`user_is_organization_member/admin/owner`) | YES | none | – |
| `organization_members` | B | `organization_id` | membership helpers | YES | none | – |
| `organization_invitations` | B | `organization_id` | org-admin + definer token lookup | YES | none | – |
| `projects` | B | `organization_id` + `user_id` | `user_can_access_project` / membership | YES | none | – |
| `project_members`, `project_activities`, `project_time_entries`, `project_share_logs` | B | project FK | `is_project_member` / `user_owns_project` | YES (inherits project) | none | – |
| `todos`, `todo_subtasks`, `todo_comments`, `todo_history` | B | `organization_id` / `user_id` | mixed org + owner | Mostly (personal todos are user-scoped by design) | keep; verify org path in tests | LOW |
| `hmrc_integrations`, `hmrc_settings`, `hmrc_submission_logs` | B | `organization_id` | membership | YES | none | – |
| `rota_employees`, `rota_shifts`, `rota_week_publications` | B | `organization_id` | membership | YES | none | – |
| `teams`, `team_members` | B | `owner_id` | `owns_team` / `is_team_member` | Partial — teams are **not** attached to an organization | **Migrate:** add `organization_id` | MED |
| `crm_contacts`, `crm_deals` | B | `user_id` | owner-only | NO tenant sharing (private-per-user); no leakage | **Migrate:** add `organization_id`, membership RLS | MED |
| `invoices`, `quotes`, `bills`, `expenses`, `outgoings`, `suppliers`, `products_services` | B | `user_id` | owner-only | Same as above | **Migrate** | MED |
| `payroll_employees`, `payroll_runs`, `payroll_run_items`, `payroll_submissions` | B | `user_id` | owner-only | Same | **Migrate** | MED |
| `documents`, `user_documents`, `user_document_templates` | B | `user_id` | owner / free / purchased / super-admin | Same | **Migrate** (org-shared business files) | MED |
| `notes`, `note_categories` | A/B | `user_id` | owner-only | Safe as personal | keep user-scoped; optional org sharing later | LOW |
| `ai_workspaces`, `ai_workflows`, `ai_conversations`, `workflow_run_logs`, `business_insights`, `user_ai_preferences` | B (usage is billed per account) | `user_id` | owner-only | Safe, not shared | **Migrate later** (org AI usage rollup) | LOW/MED |
| `bank_accounts`, `bank_transactions`, `integration_settings`, `user_integrations` | B | `user_id` | owner-only + definer accessors | Safe, not shared | Migrate only if company-level banking is a product goal | LOW |
| `b2b_form_submissions`, `feedback_requests` | B | `user_id` | owner-only | Safe | keep | – |
| `subscribers`, `payments`, `payment_notifications`, `notification_logs` | C/B | `user_id` | owner read, service-role write | Safe (billing is per account today) | Decide account-vs-org billing before migrating | MED (product) |
| `profiles` | A | `id` | self + same-org colleagues + super admin | YES | none | – |
| `user_roles` | C | `user_id` | super-admin only + escalation trigger | YES | none | – |
| `user_favorites`, `user_favorite_tools`, `user_notification_preferences`, `user_2fa_*`, `notifications`, `messages`, `connections` | A | `user_id` | self-only | YES | keep user-scoped | – |
| `staking_*`, `user_stakes` | A | `user_id` | self-only + public pools/tiers | YES | keep | – |
| `audit_logs`, `security_audit_logs`, `banking_audit_logs`, `integration_audit_logs`, `payment_audit_logs`, `admin_audit_logs` | C | `user_id` / none | self read + `is_super_admin`, no user write/delete | YES | add org column only when tenant tables migrate | LOW |
| `platform_plans`, `platform_tools`, `platform_settings`, `template_catalog`, `template_events` | C/D | none | public read of published rows, super-admin write | YES | none | – |
| `companies`, `job_postings`, `social_posts`, `advertisements`, `advertisement_categories` | D (+B author) | `created_by` / `user_id` / `company_id` | owner write, curated public read | YES | none — directory data is public by design | – |
| `forum_posts`, `forum_replies`, `post_comments`, `post_likes`, `news_articles` | D | `user_id` | public read, owner write | YES | none | – |

**No cross-tenant read/write path was found in RLS itself.** The residual issue is *under-sharing*
(user-scoped where company-scoped is intended), not leakage.

---

## 4. Canonical tenant model (proposed — not implemented)

```text
auth.users
   └── profiles (1:1, personal)
        └── organization_members (user_id, organization_id, role)
             └── organizations            <-- AUTHORITATIVE TENANT
                  └── tenant-owned business data (organization_id)
```

- Tenant key: **`organizations.id`**, resolved through `organization_members`.
- `companies` stays a public business-directory profile; **`company_id` is never a tenant key**.
- Platform role: `super_admin` in `user_roles` (`is_super_admin(auth.uid())`).
- Customer roles: `organization_members.role` = `owner` (also `organizations.created_by`) / `admin` / `member`.
- Standard policy shape for migrated tables:
  - SELECT: `public.user_is_organization_member(organization_id)`
  - INSERT/UPDATE: member for own rows, `user_is_organization_admin(organization_id)` for others
  - DELETE: owner of the row or organization admin
- `user_id` is retained on every migrated table as the *author/record owner*, alongside `organization_id`.

---

## 5. Storage buckets

| Bucket | Purpose | Public | Tenant/private content? | SELECT | INSERT | UPDATE | DELETE | Classification |
|---|---|---|---|---|---|---|---|---|
| `user-avatars` | profile pictures rendered in header/public pages | **true** | No | public URL (no RLS policy) | `auth.uid() = folder[1]` | same | same | PUBLIC PRESENTATION |
| `company-logos` | logos embedded in invoices, cards, signatures, landing pages | **true** | No (logos are published anyway) | public URL | `auth.uid() = folder[1]` | same | same | PUBLIC PRESENTATION |
| `advertisement-images` | marketplace/ad imagery | **true** | No | public URL | `auth.uid() = folder[1]` | same | same | PUBLIC PRESENTATION |
| `service-images` | service listing imagery | **true** | No | public URL | `auth.uid() = folder[1]` | same | same | PUBLIC PRESENTATION |

- Writes/updates/deletes are path-scoped to `auth.uid()` → **cross-tenant write and delete are impossible**.
- Reads are unauthenticated for anyone holding the object path (`<user_id>/<file>`) → accepted for presentation assets.
- **No bucket currently stores private tenant documents** (`documents.file_url` holds external links).
- Recommendation (not implemented): create a **new private bucket `tenant-documents`** with
  `organization_id/<...>` paths + membership-scoped policies **before** any real customer file upload feature ships.
  Do not privatise the four existing buckets.

---

## 6. Remaining security risks

| # | Risk | Severity |
|---|---|---|
| R1 | Business tables scoped by `user_id` only — company owners/admins cannot see colleagues' records; a departing user retains data | MEDIUM (functional + governance) |
| R2 | `teams` has no `organization_id`; team membership is a parallel sharing channel outside the org boundary | MEDIUM |
| R3 | Public asset buckets readable by known path | LOW/ACCEPTED |
| R4 | Legacy `app_role` values (`owner`, `admin`, `manager`, `moderator`) remain in the enum; no longer grant cross-tenant access but are confusing | LOW |
| R5 | Leaked-password protection disabled; Postgres has pending security patches (dashboard actions) | LOW/PLATFORM |
| R6 | Supabase linter reports 127 SECURITY DEFINER execute warnings — reviewed, all guarded internally, but should be re-triaged after migration | INFO |
| R7 | Billing (`subscribers`, `payments`) is per user, not per organization — an org with several paying users has no single subscription | MEDIUM (product) |

---

## 7. Staging / test environment status

Inspected the repository:

| Item | Present? |
|---|---|
| Supabase CLI config (`supabase/config.toml`) | YES (project_id + function JWT settings only) |
| Local Supabase config (`supabase start` / db seed) | **NO** — no `seed.sql`, no local db config |
| Staging Supabase project / second env file | **NO** — single `.env` pointing at production `gvftvswyrevummbvyhxa` |
| Seed data | **NO** |
| Automated tests | Vitest configured; only `src/test/teamInvitation.e2e.test.ts` (UI-level, not RLS) |
| Test/staging migrations | **NO** — 5 migration files, all production |
| Browser auth for tests | `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` → no session can be minted |

**Conclusion: no safe isolated environment exists.** Recommended setup (to be executed by the project owner):

1. Create a second Supabase project `b2bnest-staging` in the same org.
2. `supabase link --project-ref <staging-ref>` and `supabase db push` to replay `supabase/migrations/` in order.
3. Add `.env.staging` with the staging `VITE_SUPABASE_URL` / publishable key; never commit service-role keys.
4. Recreate the four storage buckets in staging with identical policies.
5. Add `supabase/seed.sql` creating Company A (A1 owner, A2 member), Company B (B1 owner, B2 member) and one
   super admin, plus one identifiable record per tenant table (`A-...` / `B-...` naming).
6. Run the Phase 5 matrix with the anon key + real staging logins (never the service-role key).
7. Optionally run the same stack locally via `supabase start` for offline iteration.

---

## 8. Company A/B test matrix (to execute on staging)

Actors: A1 (owner A), A2 (member A), B1 (owner B), B2 (member B), SA (super admin), ANON.

### 8.1 Per-resource CRUD matrix

For each resource: CRM contacts, CRM deals, projects, tasks/todos, teams, invoices, quotes, bills, expenses,
payroll, documents, AI workspaces/conversations, organization members, organization settings, subscriptions,
audit logs, storage objects.

| # | Actor | Operation | Expected |
|---|---|---|---|
| 1 | A1/A2 | SELECT own-company rows | ALLOW |
| 2 | A1/A2 | INSERT with own `organization_id` | ALLOW |
| 3 | A2 (member) | UPDATE own-authored row | ALLOW |
| 4 | A2 (member) | UPDATE colleague's row | per role rule (admin/owner only) |
| 5 | A1 (owner) | DELETE company row | ALLOW |
| 6 | A1/A2 | SELECT Company B rows | **0 rows** |
| 7 | A1/A2 | UPDATE Company B row by known UUID | **0 rows affected** |
| 8 | A1/A2 | DELETE Company B row by known UUID | **0 rows affected** |
| 9 | A1/A2 | INSERT supplying Company B `organization_id` | **denied (RLS violation)** |
| 10 | B1/B2 | Repeat 6–9 against Company A | same expectations |
| 11 | ANON | SELECT any tenant table | **0 rows / denied** |

### 8.2 API / RPC / escalation

| # | Actor | Attempt | Expected |
|---|---|---|---|
| 12 | A2 | Direct PostgREST `GET /rest/v1/<table>?organization_id=eq.<B>` | 0 rows |
| 13 | A2 | `rpc('admin_list_companies')`, `admin_company_detail`, `admin_set_user_role`, `admin_set_company_status` | `Not authorized` |
| 14 | ANON | Any `admin_*`, `decrypt_*`, `create_payment_record`, `update_payment_status` | `42501 permission denied` |
| 15 | A2 | `rpc('add_project_member', <B project>, A2, 'admin')` | `Not authorized` |
| 16 | A2 | `rpc('add_team_member', <B team>, A2, 'admin')` | `Not authorized` |
| 17 | A2 | `rpc('get_user_projects', B1)` / `get_user_teams(B1)` | `Not authorized` |
| 18 | A2 | `rpc('get_team_members_with_profiles', <B team>)` | `Not authorized` |
| 19 | A2 | `rpc('check_and_deduct_ai_credit', B1, 100)` | `Not authorized` |
| 20 | A2 | INSERT/UPDATE `user_roles` (self → `admin` / `super_admin`) | denied by policy + trigger |
| 21 | A2 | UPDATE `organization_members.role` (self → `admin`/`owner`) | denied |
| 22 | A1 | UPDATE Company B `organization_members` / `organizations` / `subscribers` | 0 rows |
| 23 | A1 | UPDATE own `subscribers.subscription_tier` to a higher plan | denied (service-role only) |
| 24 | A2 | INSERT into `admin_audit_logs` / `payment_audit_logs` for another user | denied |
| 25 | A2 | UPDATE/DELETE any audit row | denied |
| 26 | A2 | Storage upload to `B2/<file>` path in each bucket | denied |
| 27 | A2 | Storage UPDATE/DELETE of a Company B object | denied |
| 28 | A2 | Storage download of a Company B object in a **private** bucket (once created) | denied |
| 29 | SA | All `admin_*` RPCs | ALLOW + row written to `admin_audit_logs` |
| 30 | SA | Verify audit entry contents (admin id, action, target, timestamp) | present |

Every expectation must be produced by the **database** (RLS / SECURITY DEFINER), executed with the anon key and a
real user JWT — never through the UI.

---

## 9. Tables/functions requiring future migration

Schema (add `organization_id uuid references public.organizations(id)`, backfill from the owner's primary org,
then switch RLS to membership helpers):

`crm_contacts`, `crm_deals`, `invoices`, `quotes`, `bills`, `expenses`, `outgoings`, `suppliers`,
`products_services`, `documents`, `user_documents`, `payroll_employees`, `payroll_runs`, `payroll_run_items`,
`payroll_submissions`, `teams` (+ `team_members` inherit), `ai_workspaces`, `ai_workflows`, `ai_conversations`,
`workflow_run_logs`, `business_insights`, `project_time_entries` (inherit via project — verify only).

Functions to revisit at the same time: `owns_team` / `is_team_member` (add org check), `get_user_teams`,
`get_team_members_with_profiles`, `check_and_deduct_ai_credit` (org-level credits if billing moves to org),
`admin_company_detail` / `admin_overview_stats` (count org-scoped rows), plus the `documents` and CRM policies.

## 10. Tables that should NOT be migrated

`profiles`, `user_roles`, `user_favorites`, `user_favorite_tools`, `user_notification_preferences`,
`user_2fa_settings/codes/attempts`, `notifications`, `messages`, `connections`, `notes`, `note_categories`,
`staking_*`, `user_stakes`, `forum_*`, `post_*`, `news_articles`, `advertisements`, `advertisement_categories`,
`companies`, `job_postings`, `social_posts`, `platform_plans`, `platform_tools`, `platform_settings`,
`template_catalog`, `template_events`, `admin_audit_logs`.

---

## 11. Recommended implementation order

1. Stand up the isolated staging project + seed data (Section 7).
2. Execute the Section 8 matrix against **current** production schema replayed on staging; record real PASS/FAIL.
3. Fix anything the live tests reveal.
4. Decide the billing unit (user vs organization) — this gates the AI-credit and subscription migration.
5. Migrate `teams` → `organization_id` (smallest tenant gap, unblocks team-based sharing).
6. Migrate CRM + finance tables (largest business value), one additive migration per domain:
   add column → backfill → add org policies → keep owner policies → verify → drop redundant owner-only policies.
7. Migrate documents/AI tables.
8. Create the private `tenant-documents` bucket with membership-scoped policies before shipping file uploads.
9. Re-run the full matrix after every migration step.
10. Platform hygiene: enable leaked-password protection, upgrade Postgres, retire legacy `app_role` values.

---

## 12. Production readiness

**NOT PRODUCTION READY for strict multi-tenancy.**

No cross-tenant leak was found by static inspection, and all seven remediation fixes are in place — but the live
authenticated Company A vs Company B matrix has **never been executed**, no staging environment exists, business
tables are still user-scoped rather than organization-scoped, and `teams` sits outside the tenant boundary.
Static inspection is not a PASS. Readiness may only be declared after the Section 8 matrix runs on an isolated
environment and every DENY expectation is observed.
