# Sign-up / confirmation callbacks for invitations and the support portal

Code inspection plus read-only checks on 2026-10-16. Nothing in Supabase Auth was changed.

## How intent is carried (from the code)

1. A signed-out person opens an invitation link:
   - Staff: `/join?token=<64 hex>`. `JoinCompany` sends them to `/auth?next=/join?token=<token>`.
   - Customer: `/support/portal?org=<uuid>`, or from a ticket email `/support/portal?org=<uuid>&ticket=<uuid>`.
     `ProtectedRoute` sends them to `/auth?next=<same path and query>`.
2. `/auth` keeps `next` only if its path is on the allow-list in `safeNext`: `/join`, `/support/portal`, `/support-desk`, `/settings`.
   Anything else becomes `/`, so there are no open redirects.
3. **Existing account**: after sign-in, `/auth` navigates to `next`. No email is involved and no password reset is needed.
4. **New account**: `supabase.auth.signUp(..., { emailRedirectTo: <current origin> + next })`. Supabase Auth sends **its own**
   confirmation email. This is separate from the support/invitation senders, which stay off. The confirmation link returns
   the person to `emailRedirectTo` **only if that URL matches the Auth Redirect URLs list**. If it doesn't, Supabase sends
   them to the Site URL and the invitation or portal intent is lost (they must reopen the original link).
5. On return the session is picked up from the URL. `/join` then shows the invitation and accepting needs a verified email;
   the portal claims the customer access for the verified email.
   "Resend confirmation" on `/auth` uses the same `emailRedirectTo`.

Evidence: the auth audit log shows sign-ups do require email confirmation (3 sign-ups, 3 confirmation requests in 60 days).
The log does not record redirect targets, and the Redirect URLs list can't be read through the tools I have, so it is **unverified**.

## Exact production callback URLs to allow

Supabase pattern rules: `*` matches any characters except `.` and `/`, and `**` matches anything. The tokens and ids above
contain no `.` or `/`, so each entry below matches only its own page:

| Entry for Auth → URL Configuration → Redirect URLs | Used by |
| --- | --- |
| `https://www.b2bnest.online/join?token=*` | staff invitation, new account |
| `https://www.b2bnest.online/support/portal?org=*` | customer invitation and ticket-email links (`&ticket=` also matches) |
| `https://www.b2bnest.online/support/portal` | portal without a company in the link |
| `https://www.b2bnest.online/support-desk` | staff sent to the desk |
| `https://www.b2bnest.online/settings*` | `/settings` and `/settings?tab=members` |
| `https://www.b2bnest.online/` | sign-up with no intent; Google sign-in (`redirectTo: origin + '/'`) |
| `https://www.b2bnest.online/reset-password` | password reset |

Site URL: `https://www.b2bnest.online`.

**Hostnames:** the callback uses whatever host the person is on (`window.location.origin`). The site's canonical host is
`www.b2bnest.online`. If `b2bnest.online` (no www) or `b2bnest.co.uk` serve the app themselves instead of redirecting to
www, each needs the same entries. I couldn't check this: outbound requests to those domains are blocked from this sandbox.

**Previews:** the main Lovable preview uses the production database. On Lovable preview hosts (`lovable.app`), `ProtectedRoute`
deliberately skips the sign-in redirect, so the customer-portal intent test **cannot** be done there. Use the production
site or a Vercel preview for that step. A Vercel preview additionally needs
`https://b2bnest-git-*-toufik-s-projects.vercel.app/join?token=*` and `.../support/portal?org=*`. Don't add a broad `/**`.

## Preview for the first sign-up test (decision 5: not the live site)

- Preview: branch `claude/release-10-11` (the exact combined release). Vercel's stable branch address for the `b2bnest` project
  should be `https://b2bnest-git-claude-release-10-11-toufik-s-projects.vercel.app`. **Unverified**: this sandbox can't reach
  Vercel, and with no PR I can't see its build status. Please confirm it opens. If Vercel Deployment Protection asks for a Vercel
  login, the test accounts need a shareable link, or protection switched off for previews.
- The preview uses the production database, so test accounts and test company only.
- Auth path on that host: password sign-in works anywhere. `ProtectedRoute`'s preview bypass only matches `lovable.app`,
  `preview` and `localhost`, so it does **not** apply on this Vercel host: signed-out visitors are sent to `/auth?next=…` as in production.
- For sign-up confirmation to return there, add exactly these Redirect URLs (no `/**`):
  `https://b2bnest-git-claude-release-10-11-toufik-s-projects.vercel.app/join?token=*`,
  `https://b2bnest-git-claude-release-10-11-toufik-s-projects.vercel.app/support/portal?org=*`,
  `https://b2bnest-git-claude-release-10-11-toufik-s-projects.vercel.app/settings*`,
  `https://b2bnest-git-claude-release-10-11-toufik-s-projects.vercel.app/`.
- What's proven by tests (`src/lib/onboarding.test.ts`): the confirmation URL is exactly the invitation or portal page
  (token, company and ticket kept); it matches only these exact entries under Supabase's documented matching rules; unsafe
  or foreign `next` values fall back to `/`; production entries don't cover the preview host, and other hosts and pages don't match.
- What's **not** proven: that Supabase actually returns there after confirmation. That needs the one bounded test below on the
  preview, after the entries are added.

## Owner check (dashboard, read-only, about 2 minutes)

1. Auth → URL Configuration: copy the Site URL and the Redirect URLs list into our chat (they contain no secrets).
   I'll compare it with the table above and propose only the missing entries.
2. Auth → Emails → SMTP Settings: tell me whether custom SMTP is enabled and which sender address it shows (don't share passwords).
   Supabase Auth email and the support/invitation senders are separate paths. Neither will be changed without approval.
3. Auth → Providers → Email: is "Confirm email" on? (The logs suggest yes.)

## Bounded verification after the allow-list is confirmed (needs approval: Supabase Auth sends one confirmation email)

With the labelled test company and a **new** authorised test address:
open a staff invitation link signed out → create account → open the confirmation email → expect to land on `/join?token=…`
signed in, then Accept. Repeat once for a customer portal link (production site, not the Lovable preview).
