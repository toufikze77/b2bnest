# Fix: the password reset link always said "Invalid Reset Link"

Found by the owner on the live site (7 Nov 2026). Front end only: no SQL, RLS, Edge Function or two-step sign-in code changed.

## Cause (confirmed in the code)
1. **The page looked in the wrong place.** `src/pages/ResetPassword.tsx` showed the form only when the query string had `access_token` and `refresh_token`.
   - Supabase never puts them there. The email link goes through Supabase's `/auth/v1/verify` and comes back to `/reset-password` in one of three ways:
     - with the recovery session in the **hash** (`#access_token=…&type=recovery`, the default "implicit" flow this app uses);
     - with `?code=` (PKCE flow);
     - with an error (`#error=access_denied&error_code=otp_expired&error_description=…`).
2. **The link was read and cleared before the page could see it.** supabase-js (`detectSessionInUrl`, on by default) reads the hash as soon as the client is created, which is when the app starts. It saves the session, clears the hash, and fires `PASSWORD_RECOVERY`. `/reset-password` is a lazily loaded page, so it usually mounts after all of that: there is no hash left, and the event has already been fired.
3. **Signed-in people were sent away.** `if (user && !isValidSession) <Navigate to="/" />` sent the person to the home page as soon as the library signed them in from the link.

## What changed
- **`src/lib/passwordRecovery.ts` (new)** notes the facts about the link when the app starts, on `/reset-password` only: whether it is a recovery link, whether it carried a session or a code, and any error. It keeps **no token**.
  - `src/integrations/supabase/client.ts` imports it **before** creating the client, and registers one listener: on `PASSWORD_RECOVERY` (or a `SIGNED_IN` from a recovery link) it sets a "recovery open in this tab" mark in `sessionStorage`.
  - The mark holds no token and lasts at most 1 hour. A reload of the page keeps the form.
- **`ResetPassword.tsx`, rewritten around Supabase's own events:**
  - **While it checks:** "Checking your link…", at most 6 seconds, then the form or the invalid screen.
  - **When the form shows:** on `PASSWORD_RECOVERY`, or when `getSession()` has a session and the link was a recovery link (or the mark is set). A `?code=` is exchanged **once** with `exchangeCodeForSession`.
  - **Supabase errors** in the hash or query (`error`, `error_code`, `error_description`) show: "This link has expired or was already used. Request a new one." There is a **Request a new link** button (to `/forgot-password`) and one line saying that some email scanners open links first and use them up.
  - **No link at all:**
    - signed in: goes to `/`;
    - signed out: the invalid screen, with the same button.
  - **Signed in and opening a genuine recovery link:** the form (the old redirect is gone).
  - **Tokens are never shown or logged.** After the session is set up, the hash and query are removed from the address bar (`history.replaceState`).
  - **After a successful change:** the recovery mark is cleared, and this device signs out (`signOut({ scope: 'local' })`; other devices are not signed out). The page goes to `/auth?reset=done`, where the sign-in page says "Password updated, please sign in.". It does not go straight into the app.
  - **When the change is refused:**
    - `insufficient_aal`: "You also need your two-step code; use the recovery steps in Help." with a Help link;
    - an ended session: the expired screen;
    - `same_password`, `weak_password`: plain words;
    - never a token, and never the raw AAL error.
  - **The two checks stay:** passwords must match, and be at least 6 characters.
- **`/reset-password` stays exempt** in `src/lib/access.ts` (unchanged).
- **`resetPassword` (`src/hooks/useAuth.tsx`) is unchanged.** It sends `redirectTo: <origin>/reset-password`:
  - the origin is the address the person used (`window.location.origin`: never a trailing slash);
  - `http://` becomes `https://` except on localhost;
  - so `https://www.b2bnest.online/reset-password` from the www site.

## Two-step sign-in (Phase 25)
- **Supabase's own rule:** Supabase Auth refuses to change a password from a session that is only `aal1` when the person has a verified authenticator (error code `insufficient_aal`: "AAL2 session is required to update email or password when MFA is enabled").
- **The database policies are not involved.** The `require_aal2_if_enrolled` policies apply to the app's tables, not to Supabase Auth's own `auth.users` update.
- **What the person sees:** a recovery link gives an `aal1` session. `TwoStepGate` (unchanged) locks every route, `/reset-password` included, until the 6-digit code is entered. Then the session is `aal2`, the reset page opens and shows the form (from the recovery mark), and the change works.
- **If they have lost their authenticator:** they can't pass the code screen. That is intended, and there is no bypass. They use the recovery steps in Help: a backup phone, or the owner-assisted "Reset two-step sign-in" (Phase 25). If `insufficient_aal` ever reaches the page, it shows the plain two-step message above, never the raw error.

## Owner checks (Supabase Dashboard; not changed by this PR)
1. **Redirect URLs:** Authentication → URL Configuration → **Redirect URLs** must contain:
   - `https://www.b2bnest.online/reset-password`;
   - `https://b2bnest.online/reset-password` if the site is also used without www;
   - or a pattern such as `https://www.b2bnest.online/**`.
   If the address isn't listed, Supabase sends the person to the **Site URL** instead (the home page), not to the reset page.
2. **Site URL:** in the same place, it should be `https://www.b2bnest.online`.
3. **Email template:** Authentication → Email Templates → **Reset password**. The link should be the standard `{{ .ConfirmationURL }}`, which goes through `/auth/v1/verify` and then to the redirect above. A custom template that links straight to `/reset-password?token=…` would need a different page and is not supported here.

## Owner test steps
1. **Request a link:** sign out, open `https://www.b2bnest.online/forgot-password`, enter your email and send.
2. **Open the link:** open the email and click the link. Expect "Checking your link…" for a moment, then **Reset Your Password**. The address bar shows only `/reset-password`.
3. **Change the password:** enter a new password twice and press **Update Password**. Expect the sign-in page with "Password updated, please sign in."
4. **Sign in:** sign in with the new password.
5. **Expired link:** click the same email link again. Expect "This link has expired or was already used. Request a new one." and a **Request a new link** button.
6. **Already signed in:** while signed in, request a new link and open it in the same browser. Expect the form, not the home page.
7. **No link:** open `/reset-password` directly. Signed out: the invalid screen. Signed in: the home page.
8. **With two-step sign-in:** for an account that has an authenticator app, open a reset link. Expect the 6-digit code screen first, then the form.

## Checks
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 509 (baseline 510) |
| `npx vitest run` | 170 files, 1,596 tests, exit 0, no "Unhandled" |
| `npm run build` | OK |

New tests:
- **`src/pages/ResetPassword.test.tsx` (14):**
  - a hash session shows the form, the tokens are never rendered, and the hash is cleared;
  - the `PASSWORD_RECOVERY` event arriving after mount shows the form;
  - a link already read by the app shows the form;
  - `?code=` is exchanged once, then the form; a failed exchange shows the expired message;
  - an expired hash error shows the message, the scanner note and the new-link button;
  - no link: signed out gives the invalid screen, signed in goes to `/`;
  - signed in with a recovery link shows the form;
  - a link with no session is invalid after the wait;
  - mismatch and too-short passwords are still blocked;
  - success signs out locally and goes to `/auth?reset=done`;
  - `insufficient_aal` shows the two-step message with Help;
  - an ended session shows the expired screen.
- **`src/lib/passwordRecovery.test.ts` (4).**
- **`src/pages/Auth.test.tsx` (+1):** the "Password updated" message.

---

# Part 2: a reset link that survives email link scanners

## Why
- **What the Supabase auth logs show (7 Nov 2026):** every time a reset email was requested (`POST /auth/v1/recover`, 200), the one-time link was opened by an automatic visitor 2 to 3 seconds later: `GET /auth/v1/verify?token=…&type=recovery`, user agent `Chrome/113.0.0.0 Windows`, not the owner's browser.
- **That visit uses up the token.** When the owner then clicked, Supabase answered "403: Email link is invalid or has expired / One-time token not found".
- **This is an email link scanner, not an expired link.** While the email link is the plain `{{ .ConfirmationURL }}`, which verifies on a simple GET, every reset fails the same way.

## What changed
- **`/reset-password` supports the scanner-proof link** `https://www.b2bnest.online/reset-password?token_hash=<hash>&type=recovery`:
  - **Nothing is verified on load.** The page shows "Reset your password. Click the button to continue." with a **Continue** button. A scanner that only loads the page doesn't click, so the token stays unused. supabase-js does not act on `token_hash` by itself.
  - **On Continue** (once, however many clicks), the page calls `supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`. The hash leaves the address bar at that moment (`history.replaceState`). It is never logged or shown.
  - **Success:** the recovery session exists and the same new-password form shows, with the same rules. Someone with two-step sign-in enters their code first, as before.
  - **Failure:** the existing "This link has expired or was already used. Request a new one." with the **Request a new link** button.
- **The older formats still work:** `#access_token=…&type=recovery`, `?code=` and the errors in the hash. Emails already sent, and the current template, keep working until the template is switched.
- **Forgot-password screen:**
  - it now says "If the link says expired, wait 60 seconds and request one new link, then click it once.";
  - after sending, it shows "Check your spam folder; Gmail may fold repeat emails (click the three dots).";
  - Supabase's limit of one email a minute per address (429, "you can only request this after N seconds") is shown as "A link was sent less than a minute ago. Wait 60 seconds, then request one new link."

## Owner step, after this is published
1. **Site URL:** in the Supabase Dashboard → Authentication → URL Configuration, check that **Site URL** is `https://www.b2bnest.online`.
2. **Template:** in Authentication → Emails → **Reset password**, replace the link with:
   ```html
   <p><a href="{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
   ```
3. **Save.** No redirect-URL change is needed for this link: it goes straight to the site, not through `/auth/v1/verify`.

Publish the frontend **before** switching the template. The old page doesn't know `token_hash`.

## Owner test steps (after the template change)
1. **Request a link:** sign out, open `https://www.b2bnest.online/forgot-password`, enter your email and send. Requesting again within 60 seconds is refused by Supabase (429): wait a minute between requests.
2. **Wait first:** wait at least 10 seconds after the email arrives, so a scanner can open it first.
3. **Click the link once.** Expect "Reset your password. Click the button to continue." The address bar still shows the link.
4. **Press Continue.** Expect the **Reset Your Password** form. The address bar now shows only `/reset-password`.
5. **Change the password:** enter a new password twice and press **Update Password**. Expect the sign-in page with "Password updated, please sign in." Then sign in with the new password.
6. **Use the link again:** open the same email link again and press Continue. Expect "This link has expired or was already used." and **Request a new link**.
7. **Optional check:** the Supabase auth logs should show a `GET /reset-password…` page load from the scanner, but **no** `/auth/v1/verify` call until you press Continue.

## Checks (part 2)
| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx eslint .` | 509 (baseline 510) |
| `npx vitest run` | 172 files, 1,610 tests, exit 0, no "Unhandled" |
| `npm run build` | OK |

New tests:
- **`ResetPassword.test.tsx` (+4):**
  - `token_hash`: no verify on load, the Continue button shows, and the hash is never rendered;
  - one `verifyOtp({ token_hash, type: 'recovery' })` call even on a double click, then the hash leaves the URL and the form shows;
  - failure shows the expired message and the new-link button;
  - the form rules are unchanged after Continue.
  - The old hash and code tests are unchanged and still pass.
- **`passwordRecovery.test.ts` (+1).**
- **`ForgotPassword.test.tsx` (3, new):** the 60-second hint, the spam/Gmail hint, and the 429 message.
