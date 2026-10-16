# Codebase audit and fixes, 2026-10-16

Branch `claude/audit-and-fix-a1vzkh`. Live database checks were read-only queries against the
B2BNEST Supabase project (`gvftvswyrevummbvyhxa`). No migration in this branch has been applied
to it.

## 1. Stack and structure

| Area | What it is |
| --- | --- |
| Frontend | Vite + React 18 + TypeScript SPA, shadcn/ui (Radix) + Tailwind 3, React Router 7, TanStack Query, react-hook-form + zod |
| Backend | Supabase: Postgres with RLS and SECURITY DEFINER RPCs, Auth, Storage, 54 Deno Edge Functions |
| Tests | Vitest 4 + Testing Library (jsdom), 28 files / 174 tests; SQL security suites under `scripts/staging` |
| Hosting | Was Lovable; now Vercel (`vercel.json`) |
| Other | `remotion/` is a separate video project with its own `package.json`, not part of the app build |

Layout: `src/pages` (route screens, `admin/` for the super-admin console), `src/components`
(feature folders: `crm`, `project-management`, `work`, `support`, `billing`, `hmrc`, `payroll`,
`rota`, `integrations`, `workflows`, …), `src/services` and `src/lib` (data access and pure
logic, most of the unit tests), `src/integrations/supabase` (client and generated types),
`supabase/migrations` (187 files), `supabase/baseline` (production schema snapshot),
`supabase/remediation|rollback|staging` (hand-run SQL), `docs/` (previous reports).

### Routes (`src/App.tsx`)

- Public: `/`, `/about`, `/contact`, `/auth`, `/join`, `/forgot-password`, `/reset-password`,
  `/pricing`, `/business-tools`, `/template-center`, `/ai-studio`, `/forum`, `/plr`, `/privacy`,
  `/terms`, `/help`, `/blog`, `/knowledge-base` (+7 articles), `/categories/*`,
  `/marketing-materials`, `/payment-success`, `/forms/work-request`, `/forms/b2b`,
  `/f/:formId`, `/p/:slug`. Redirects: `/ai-showcase`, `/ai-workspace` → `/ai-studio`.
- Signed-in (`ProtectedRoute`): `/dashboard`, `/business-overview`, `/settings`,
  `/settings/unassigned-projects`, `/profile-setup`, `/onboarding`, `/business-tools/notepro`,
  `/workflow-studio`, `/integrations/whatsapp`, `/crm`, `/support-desk`, `/support/portal`,
  `/lead-generation/*` (8), `/rota/*` (3), `/workspaces`, `/workspaces/:id`,
  `/project-management`.
- Super admin: `/admin` + 19 child routes (users, companies, subscriptions, plans, AI, tools,
  projects, documents, social, templates, AI templates, support, analytics, audit logs, export,
  system health, settings). The page shell checks `is_super_admin`; every admin RPC re-checks
  server-side.

### Integrations

- **Supabase**: browser client in `src/integrations/supabase/client.ts`, anon key + RLS. Sensitive
  data only through SECURITY DEFINER RPCs (`get_*_safe`, `store_*`, `assert_self`).
- **Stripe**: `create-subscription-checkout`, `change-subscription-plan`, `customer-portal`,
  `create-payment`, `check-subscription`, and `stripe-webhook` (signature-verified, lease-based
  idempotency via `claim_/complete_/release_stripe_webhook_event`). Secret key and webhook secret
  are Edge Function secrets only.
- **HMRC**: `hmrc_settings` (per-user client id/secret, secret encrypted by trigger),
  `oauth-hmrc` Edge Function exchanges the code server-side, `hmrc_integrations` stores tokens,
  `src/services/hmrcService.ts` reads them via `get_hmrc_tokens`.
- **Banking**: TrueLayer through `truelayer-integration` (hardcoded to the sandbox host);
  accounts stored via `store_bank_account`, read via `get_bank_accounts_safe` /
  `get_bank_account_details`, all with `assert_self`.
- **OAuth integrations**: Google Calendar, Gmail, Outlook, iCloud, LinkedIn, X/Twitter, Facebook,
  OneDrive, Notion, Trello, Slack, WhatsApp. State is HMAC-signed (`_shared/oauth-state.ts`);
  tokens stored in `user_integrations`.
- **Other**: OpenAI and Lovable AI gateway (`LOVABLE_API_KEY`), Firecrawl, Resend/Gmail SMTP,
  Coinbase Commerce (crypto was retired in Sept, function still deployed).

## 2. Install, build, lint, typecheck, test

| Check | Before | After this branch |
| --- | --- | --- |
| `npm ci` | **Fails**: lockfile out of sync with `package.json`; npm 10 resolver crash (`reading 'edgesOut'`) caused by vitest 4.1.x | Passes on npm 10 |
| `bun install` | **Fails**: `bun.lock` resolves 328 packages from Lovable's private registry (HTTP 403) | Unchanged, do not use bun |
| postinstall | `onnxruntime-node` (via unused `@huggingface/transformers`) downloads a native binary; fails behind a proxy | Dependency removed |
| `npm run build` | Passes (one 1.4 MB main chunk, warning only) | Passes |
| `tsc -p tsconfig.app.json` | Passes, but only because a transitive dep leaked `@types/node` | Passes without it |
| `vitest run` | **3 failed / 171 passed, 176 unhandled errors** (WorkflowStudio test mocks) | 174 / 174 pass, 0 errors |
| `npm run lint` | 584 problems (518 errors, 66 warnings) | 577 (511 errors, 66 warnings) |

Lint breakdown (after): 479 `no-explicit-any`, 42 `react-hooks/exhaustive-deps` (warn),
22 `react-refresh/only-export-components` (warn), 16 `no-empty`, 7 `no-useless-escape`,
6 `prefer-const`, 1 each of `no-unused-expressions` (`crm/ContactsImportExport.tsx`),
`no-require-imports` (`tailwind.config.ts`), `no-empty-object-type` (`ui/textarea.tsx`).
About 40 of the files are Deno Edge Functions and rollback copies, which are linted with
browser globals. The 6 `rules-of-hooks` errors were fixed. Note `tsconfig` has `strict: false`.

## 3. Findings

### Broken behaviour (fixed here)

- `PublicWorkRequest` sent `Authorization: Bearer undefined` (`VITE_SUPABASE_ANON_KEY` is never
  defined), so `/forms/work-request` never worked.
- `get_hmrc_tokens` returned the stored `ENC:…` values without decrypting them (see §5).
- Links to routes that don't exist: `/privacy-policy` (Security guide) and `/projects` (AI
  template dialog, "Start blank instead").
- WorkflowStudio tests: unstable mocked `user` caused an infinite reload loop; mock lacked `rpc`.

### Dead code

54 files are never imported (from `knip`). Removed only the three tied to an unused heavy
dependency: `pages/AIShowcase.tsx` (unrouted), `components/AIDocumentDemo.tsx`,
`services/aiClassificationService.ts`. The rest are left for you to decide, notably
`components/crm/IntegrationsTab.tsx`, `crm/ServicesTab.tsx`, `checkout/PayPalCheckout.tsx`,
`integrations/OAuthConnectCard.tsx`, `services/aiPlatformService.ts` (links to a non-existent
`/market`), `services/templateApplyService.ts`, `utils/priorityColors.ts`,
`utils/inputValidation.ts`, `lib/index.ts`. Unused packages still installed:
`@paypal/paypal-js`, `chart.js`, `react-chartjs-2`, `dompurify`, `embla-carousel-react`,
`next-themes`, `react-resizable-panels`, `vaul`, 8 Radix packages, `@tailwindcss/typography`.
Also `supabase/functions/create-coinbase-charge` after the crypto retirement, and two parallel
shared folders (`supabase/functions/_shared` and `supabase/functions/shared`).

### Outdated dependencies and advisories

Majors behind: React 18 → 19, Vite 6 → 8, Tailwind 3 → 4, zod 3 → 4, date-fns 3 → 4,
react-day-picker 8 → 10, lucide-react 0.462 → 1.x, @hookform/resolvers 3 → 5, sonner 1 → 2,
TypeScript 5 → 7, ESLint 9 → 10. `npm audit`: 15 (6 high) — `braces`/`chokidar` (dev, via
Tailwind 3), `postcss-selector-parser`, `uuid` via `exceljs`, and `quill`.
`package.json` overrides `quill` to `^2.0.3`, but `react-quill@2.0.0` is built for Quill 1;
the NotePro editor should be checked by hand.

### Hardcoded keys and secrets

- No service-role key, Stripe secret, webhook secret or OAuth secret in client code. Edge
  Functions read all secrets from `Deno.env`.
- The anon key and project URL were hardcoded in `client.ts` (now read from env) and are in the
  committed `.env`. Both are public values, so this is acceptable, but `.env` is tracked despite
  being in `.gitignore`. Untrack it once Lovable is no longer building the app.
- Two names for the same purpose: `ENCRYPTION_SECRET` and `INTEGRATION_ENCRYPTION_SECRET`.

## 4. RPC caller checks (token, banking, admin)

Every client call passes the signed-in user's own id (`user.id` from `useAuth` or
`auth.getUser()`); none forwards an id from a URL or form. On the live database:

- Token and banking RPCs (`get_integration_tokens`, `store_integration_tokens`,
  `get_user_integrations_safe`, `get_hmrc_tokens`, `get_hmrc_client_secret`,
  `get_bank_accounts_safe`, `get_bank_account_details`, `store_bank_account`,
  `get_user_payments`, `get_ai_credits_info`) call `public.assert_self`. That rejects anon
  callers and any id that is not `auth.uid()`, and only lets service_role through. `anon` has no
  EXECUTE on them.
- Edge Functions that use the service role take the user id from a verified JWT or an
  HMAC-signed OAuth state, never from the request body.
- Admin RPCs (`admin_*`) check `is_super_admin(auth.uid())` server-side.
- **Gaps found, fixed by migration `20261016193100`**: `check_trial_status`,
  `get_notification_preferences`, `log_user_action`, `ensure_user_has_org` trusted the id
  argument. Any signed-in user could expire someone else's trial, read their preferences, forge
  audit-log rows in their name, or create an org owned by them.
- Still open (low): `is_super_admin`, `is_admin_or_owner`, `has_role` and the
  `user_is_organization_*` helpers are executable by `anon`, so anyone can test whether a given
  user id is an admin. `get_user_staking_tier` / `preview_user_emissions` read any user's
  staking data (crypto feature, retired).

## 5. HMRC tokens compared with the other integrations

| | HMRC | Other OAuth integrations |
| --- | --- | --- |
| Table | `hmrc_integrations` | `user_integrations` |
| Write | `oauth-hmrc` (service role) calls `encrypt_hmrc_token`, then upserts | `store_integration_tokens` RPC encrypts inside the DB; some functions AES-encrypt first |
| Read | `get_hmrc_tokens` → **returned the raw `ENC:` value** | `get_integration_tokens` decrypts |
| Audit log | none | `integration_audit_logs` on every read |
| Refresh | none: the token is unusable after `expires_at` | `shared/token-refresh.ts` (AES path only) |

Fixed: migration `20261016193000` makes `get_hmrc_tokens` decrypt (legacy plain text still
works) and return the newest row first. No HMRC token rows exist yet, so nobody was affected.

Still inconsistent:

1. **None of this is encryption.** `encrypt_hmrc_token`, `encrypt_integration_token` and
   `encrypt_banking_data` all return `'ENC:' || base64(value)`. Anyone with table read access,
   a backup or a leaked dump can read every token, client secret and account number.
2. **Two incompatible schemes write to `user_integrations`.** `store_integration_tokens` stores
   base64 `ENC:`. `oauth-onedrive`, `oauth-twitter` and `shared/token-refresh.ts` use AES-GCM
   (`shared/crypto.ts`, key = secret padded to 32 chars). `oauth-twitter` AES-encrypts and then
   passes the result to `store_integration_tokens`, so it is stored double-wrapped.
   `token-refresh.ts` AES-decrypts rows that were stored as base64, which fails. Google Calendar,
   Notion, Trello and Slack sync are likely broken after the first token expiry.
3. HMRC client secrets go back to the browser (`getSettings` → `get_hmrc_client_secret`) and are
   written from the browser. Only the Edge Function needs them.
4. Access tokens are handed to the browser by both `get_hmrc_tokens` and `get_integration_tokens`.
5. `hmrc_integrations` is unique on `(user_id, organization_id)`. With a NULL org every
   reconnect inserts another row instead of updating.
6. `hmrcService.submitFPS` is simulated. It sleeps, invents an `FPS-XXXX` id and logs it as a
   real submission.

## 6. Vercel

- `vercel.json`: framework `vite`, install `npm ci` (so Vercel does not pick bun and the private
  registry), build `npm run build`, output `dist`, SPA rewrite `/(.*)` → `/index.html` (static
  files are served first), immutable cache on `/assets/*`, `nosniff` + referrer policy headers.
- Env vars (Production and Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  (`VITE_SUPABASE_ANON_KEY` is accepted as an alias). Nothing else is read by the client. The
  client throws if given a service-role key.
- Outside the repo: add the Vercel domains to Supabase Auth Site URL and Redirect URLs. Update
  the `SITE_URL` / `APP_URL` Edge Function secrets and every OAuth app's redirect URI if the
  domain changes. Point Stripe success/cancel URLs at the new domain.
