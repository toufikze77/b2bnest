# Phase 24: no app shell for signed-out visitors, sign-in for actions, security headers (prepared)

**Status: prepared, not deployed.** Frontend and `vercel.json` only. There is no SQL, no Edge Function and no secret.

## What was wrong (re-verified on `main`, 53bde3f)

| Owner report / fact | In the code |
| --- | --- |
| Signed-out visitors saw the app shell on `/template-center` | `Layout.tsx` chose `AppShell` by URL prefix only. `/template-center` and `/business-tools` are public routes, so a signed-out visitor got the left menu, the company switcher, Create, the profile menu and "Sign out". |
| A host-name sign-in bypass | `ProtectedRoute.tsx` skipped the sign-in check when the host matched `/lovable\.app\|preview\|localhost/`. That covers `b2bnest.lovable.app`, every Lovable preview, any Vercel preview whose branch name contains "preview", and localhost. The data stayed protected by RLS, but the private screens rendered. |
| "Use template" while signed out | It opened the create dialog, which then failed (no user, no company). |
| Headers | `vercel.json` set only `X-Content-Type-Options` and `Referrer-Policy`. |

## What changed

1. **Layout.** The `AppShell` is used only when someone is signed in.
   - While sign-in is being checked on an app route, only the neutral page skeleton shows, so the shell never flashes.
   - A signed-out visitor gets the public `Header` on every route, exactly like Pricing.
   - The route list moved to `src/lib/appShellRoutes.ts`, unchanged, so signed-in pages keep the same layout.
2. **ProtectedRoute: bypass removed** (not limited to dev mode).
   - Nothing needs it. Lovable previews share the editor's session through `previewAuthStorage.ts`.
   - The screenshot scripts in `docs/` sign in with a real session (`sample-screens.py`). `scripts/` has no preview workflow.
   - Local `npm run dev` can sign in normally.
   - Tests show that it now redirects on preview, `lovable.app`, Vercel preview, production and localhost hosts, and in dev mode.
3. **Template Centre** (public showcase):
   - "Use template" on a card or in Preview, and "Create with AI", now link to `/auth?next=/template-center…` for a signed-out visitor, with the line "Sign in to use this template".
   - Preview stays open to everyone.
   - The create dialogs can't open without a signed-in user.
4. **Business Tools:**
   - The premium-tool sign-in card now reads "Sign in to use this tool".
   - Its button returns to the same tool after sign-in.
5. **AI Studio** (public, found in the route audit): each tab now shows "Sign in to use this tool" instead of an AI tool that the server refuses.
6. **`/payment-success`** is now wrapped in `ProtectedRoute`. It calls `create-subscription-invoice`, which needs a signed-in user. Both checkout functions already require one, so a payer always arrives signed in.
7. **`?next=`:** the new `safeReturnPath` accepts only a path on this site.
   - It rejects absolute URLs, `//host`, backslashes, whitespace and control characters (`/\t/host`), and `/auth` itself.
   - Confirmation emails keep the stricter `safeNext` allow-list, because Supabase only accepts its own redirect list.
8. **Personal data no longer logged to the browser console:**
   - CRM contact and deal data, and the user id;
   - Jira-style team members;
   - checkout buyer and payment details;
   - PayPal order;
   - template payment data.
9. **External `window.open`** calls now pass `noopener,noreferrer`. Three links that had only `rel="noreferrer"` now use `rel="noopener noreferrer"`.
10. **Headers:** see below.

## Every action on the two public pages, signed out

| Page | Action | Signed out now gets |
| --- | --- | --- |
| Template Centre | Search, Filter, Sort, categories, quick links | Works (browsing) |
| | Preview | Opens (read-only). Records an anonymous preview count, which RLS allows (`user_id` null). |
| | Use template (card) | Line "Sign in to use this template" + link to `/auth?next=/template-center…` |
| | Use template (in Preview) | Same line + same link |
| | Create with AI | Link to `/auth?next=…` (aria: "Sign in to create a template with AI") |
| Business Tools | Filters All / Free / Premium | Works |
| | Favourites | Hidden (as before) |
| | Free tools: QR code, coupon, time tracker, currency converter, business resources | Work in the browser only. No account data is read or written. |
| | Premium tool cards: CRM, finance, HMRC, rota, lead generation, etc. | "Sign in to use this tool" → `/auth?next=/business-tools?tool=…` |
| | NotePro, lead-generation buttons, "View All Documents", "Manage Quotes/Invoices" | Protected routes → sign-in with return path |
| | Create New (invoices) | Premium tool → sign-in card |

## Route table (`src/App.tsx`)

**Protected** (signed-in only; no change unless noted):

| Area | Routes |
| --- | --- |
| Core pages | `/dashboard`, `/business-overview`, `/settings`, `/settings/unassigned-projects`, `/profile-setup`, `/onboarding` |
| Business tools | `/business-tools/notepro`, `/workflow-studio`, `/integrations/whatsapp`, `/crm` |
| Support | `/support-desk`, `/support/portal` |
| Lead generation | `/lead-generation` and its 8 sub-routes |
| Rota | `/rota`, `/rota/employees`, `/rota/schedule` |
| Workspaces and projects | `/workspaces`, `/workspaces/:workspaceId`, `/project-management` |
| Admin | `/admin` and its 19 child routes (wrapped once; `AdminLayout` also checks super-admin) |
| **New in Phase 24** | `/payment-success` |

**Public on purpose:**

| Route | Why |
| --- | --- |
| `/` `/about` `/contact` `/pricing` `/help` `/blog` `/forum` `/knowledge-base` and its 7 articles | Marketing and help (unchanged). Forum posting requires sign-in. |
| `/auth` `/forgot-password` `/reset-password` | Sign-in (unchanged) |
| `/join` | Redirects to sign-in itself when signed out |
| `/template-center` `/business-tools` | Public showcase (owner decision). Actions need sign-in. |
| `/ai-studio` | Explains the AI tools. Signed out, each tab shows a sign-in step. |
| `/business-resources` `/plr` `/marketing-materials` `/categories/*` | Content. Uploads in categories need sign-in and permission. |
| `/f/:formId` `/p/:slug` `/forms/work-request` `/forms/b2b` | Public forms and pages (unchanged) |
| `/unsubscribe` | Token link from emails (unchanged) |
| `/privacy` `/terms` | Legal (unchanged) |
| `/ai-showcase` `/ai-workspace` | Redirect to `/ai-studio` |
| `*` | Not found |

## Security headers (`vercel.json`, all routes)

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` (kept) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (kept) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()`. The code uses none of these: no `getUserMedia`, `geolocation`, `PaymentRequest` or `navigator.usb`. Only clipboard writes, which aren't restricted. |
| `Content-Security-Policy-Report-Only` | see below. **Report-only: it does not block anything yet.** |

### CSP directives and why each origin is allowed

| Directive | Value | Reason |
| --- | --- | --- |
| `default-src` | `'self'` | Everything not listed comes from this site only. |
| `script-src` | `'self'` | The build has a single module script `/assets/index-*.js`. The three inline `<script>` tags in `index.html` are `application/ld+json` data, which CSP doesn't block. No Stripe.js, analytics or tag manager is loaded. |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Google Fonts CSS (Figtree) from `index.html`. `'unsafe-inline'` because Radix and Sonner inject `<style>` and `chart.tsx` writes a `<style>` tag. |
| `font-src` | `'self' data: https://fonts.gstatic.com` | Google Fonts files. |
| `img-src` | `'self' data: blob: https:` | Unsplash thumbnails; Supabase Storage (logos, avatars, attachments); OAuth avatars; image URLs people enter in landing-page and template content; `data:` and `blob:` for QR codes, PDF and image previews. |
| `connect-src` | `'self' https://gvftvswyrevummbvyhxa.supabase.co wss://gvftvswyrevummbvyhxa.supabase.co https://api.exchangerate-api.com` | Supabase REST, auth, storage and Edge Functions (HTTPS) and realtime (WebSocket). The currency converter's rates API. |
| `frame-src` | `https://www.youtube.com https://www.youtube-nocookie.com` | The tutorial video on About (`VideoTutorialSection`). |
| `worker-src` | `'self' blob:` | Safety margin for libraries that start blob workers. None were found. |
| `manifest-src` | `'self'` | `/manifest.webmanifest` |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | |
| `form-action` | `'self'` | No form posts to another site. Stripe Checkout, OAuth and the billing portal open by navigation (`window.location.href = url`), which `form-action` doesn't govern, so no Stripe host is needed. |
| `frame-ancestors` | `'none'` | Browsers ignore this inside Report-Only. `X-Frame-Options: DENY` enforces it today. |

**What I checked:** I served the production build locally with this policy **enforced** and loaded these 17 pages signed out in Chromium:
- `/`, `/pricing`, `/template-center`, `/business-tools` (and two free tools), `/ai-studio`, `/about`, `/help`;
- `/forum`, `/blog`, `/knowledge-base`, `/auth`, `/business-resources`, `/marketing-materials`, `/plr`, `/dashboard`.

There were **0 violations**. A deliberately forbidden fetch on the same page was reported, so the detector works. **Signed-in pages were not checked with the CSP.**

### Before enforcing (owner)

1. Deploy. Then, signed in and signed out, open each main page with DevTools open and look for `[Report Only] Refused to …` in the Console:
   - Home, Pricing, Template Centre (Preview and Use template), Business Tools (every free tool);
   - Dashboard, Workspaces, Projects, CRM, Invoices & quotes (create and print a PDF), Notes, Calendar;
   - Workflows, AI Studio (ask a question), Settings (upload a logo or avatar, Billing → Manage billing), Support tickets;
   - Lead generation (open a public form `/f/…`), About (video), Admin.
2. For each report, either add that origin to the matching directive (if it is a service you use) or remove what loads it.
3. Then make the one-line change in `vercel.json`:

```diff
-          "key": "Content-Security-Policy-Report-Only",
+          "key": "Content-Security-Policy",
```

**Expected reports:**
- Vercel **preview** deployments inject the Vercel toolbar (`vercel.live`), which reports on previews only and not on production. Allow `https://vercel.live` in `script-src`, `connect-src` and `frame-src` if you want previews clean.
- `X-Frame-Options: DENY` stops any site from framing B2BNEST. If you ever need the Lovable editor to frame the **Vercel** URL, use `frame-ancestors` with that origin instead. The Lovable preview runs on lovable.app, not Vercel, so today nothing needs this.

## Found but not fixed

| Finding | Why not fixed here |
| --- | --- |
| **Lead Generation keeps leads, forms and pages in browser `localStorage`** (`src/lib/leadGen.ts`). Names and emails stay on a shared computer after sign-out, and public forms only work in the same browser. | Moving them to the database needs tables, RLS and a rewrite (SQL is out of scope). Recommend a separate phase. |
| `PayrollUK` stores the employer PAYE and Accounts Office references in `localStorage`. | Payroll/HMRC area: not touched. Moderately sensitive business identifiers. |
| `ProjectManagement.tsx:2841` has the same host-name pattern, bypassing the **plan check** (`canAccessFeature`) on preview and localhost hosts. | Paywall rules are off limits this phase. The data is still protected by RLS. |
| `template_events` lets anyone, including signed-out visitors, insert rows with `user_id` null (RLS `NOT (user_id IS DISTINCT FROM auth.uid())`), so preview counts can be inflated. | Needs SQL (rate limit or authenticated-only). It is analytics only. |
| About 260 other `console.*` calls remain (no tokens or personal data in the ones checked). | Noise, not a leak. Out of scope. |
| `chart.tsx` writes a `<style>` via `dangerouslySetInnerHTML` without DOMPurify. | Its content comes only from chart configs in code (colour tokens), never from users. `NoteContentPreview` is sanitised by DOMPurify (`renderNoteHtml`). |

## Checked and fine

- **Secrets:**
  - no `sk_`/`rk_`/`whsec_`/service-role/`sb_secret_`/AWS/Google/Slack/GitHub keys or PEM blocks in `src/`, `public/`, `index.html` or `vite.config.ts`;
  - the client refuses a service-role key at start-up;
  - the Supabase URL and publishable key come from `.env.production`.
- **Storage:**
  - the Supabase session (standard);
  - the active company id, theme, sidebar state and the welcome-tour flag;
  - the template-apply idempotency key;
  - the HMRC OAuth `state` (sessionStorage);
  - the browser-only tool data (coupons, goals, cash flow, gift cards, referrals, marketing calendar) for tools that are browser-only by design.
- **`target="_blank"`:** all 18 have `rel="noopener noreferrer"` (three upgraded from `noreferrer`).
- **Open redirects:**
  - no `window.open` or redirect takes a URL from the query string;
  - `?next=` is the only one, and it is now same-origin only;
  - `?tool=`, `?tab=`, `?integration=` and `?savings=` are matched against fixed lists.

## Screenshots (`screenshots/`)

Taken in a local harness with **mocked** sign-in and data (example account `sam@taylorandco.example`) and the built-in template catalogue. Each image carries a banner saying so.

| File | What it shows |
| --- | --- |
| `template-center-signed-out-{1440,390}.png` | Public header, no app menu |
| `template-center-signed-out-{1440,390}-use-template.png` | "Sign in to use this template" on each card |
| `template-center-signed-out-{1440,390}-preview.png` | Preview open, with the sign-in line and link |
| `business-tools-signed-out-{1440,390}.png` | Public header |
| `business-tools-signed-out-1440-premium-tool.png` | "Sign in to use this tool" |
| `*-signed-in-{1440,390}.png` | The app shell, unchanged |
