# Two-step sign-in: design for real enforcement (proposal, nothing built)

Status: **proposal only.** Nothing here is built, configured, migrated or deployed. Phase 11a made the screens truthful
("Two-step sign-in is not active yet"); this document is for the owner to choose how to make it real.

## Where things stand (verified 2026-10-23)

- `signIn()` (`src/hooks/useAuth.tsx`) calls only `supabase.auth.signInWithPassword`. A correct password gives a full
  session. No second factor is checked anywhere, client or server.
- `user_2fa_settings` has 2 rows in production, both `is_enabled = true` (read-only count). Those two accounts were never
  asked for a code. Phase 11a leaves the rows and the `send-2fa-email` / `verify-2fa-code` functions untouched.
- The old "turn on" flow generated the code in the browser with `Math.random`, logged it to the console and showed it in
  a toast. A code the browser makes and checks is not a second factor; it is removed in Phase 11a.
- RLS policies check `auth.uid()` only, so any session from a password alone can read everything the user owns.

## What "enforced" has to mean

1. The second factor is checked **by Supabase Auth**, not by our UI. The session's `aal` claim (in the JWT) is `aal1`
   after the password and `aal2` only after a verified factor.
2. Protected data is unreachable at `aal1` for enrolled users. That must be enforced in the **database** (RLS) and in
   **Edge Functions**, because anyone holding an `aal1` token can call the REST API directly; a client-side redirect is
   not enough.
3. Users who have not enrolled are unaffected until the owner decides to require it for everyone.

## Options

| | A. Supabase TOTP (authenticator app) | B. Supabase phone (SMS) | C. Keep our own email codes |
|---|---|---|---|
| Who verifies | Supabase Auth (`mfa.enroll` / `challenge` / `verify`) | Supabase Auth | Our Edge Functions |
| Gives `aal2` in the JWT | Yes | Yes | **No**: RLS can't see it, so data stays reachable with a password only |
| Cost / setup | Free, in the dashboard (Auth → Multi-factor) | SMS provider (e.g. Twilio) and per-message cost | Email sender (Phase 10, still off) |
| Phishing / SIM swap | Good | SIM-swap risk | Mailbox takeover = account takeover |

**Recommendation: A (TOTP via Supabase Auth MFA).** It is the only option that gives a server-checked `aal2` at no
extra cost. B can be added later as a second factor type. C should be retired: it cannot be enforced by RLS.

## How enforcement would work (option A)

- **Enrol** (Settings → Security): `supabase.auth.mfa.enroll({ factorType: 'totp' })` → show the QR code →
  `challenge` + `verify` with the 6-digit code. Show the factor as "On" **only** when `mfa.listFactors()` returns a
  verified factor.
- **Sign in:** after the password, call `mfa.getAuthenticatorAssuranceLevel()`. If `nextLevel = 'aal2'` and
  `currentLevel = 'aal1'`, show the code screen and keep the app locked until `verify` succeeds.
- **Database (the part that makes it real):** a restrictive policy on every table holding company or personal data, e.g.
  `create policy require_aal2_if_enrolled on <table> as restrictive for all to authenticated using (public.mfa_ok());`
  with `mfa_ok()` = `(auth.jwt()->>'aal') = 'aal2' or not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified')`.
  It would need a migration with tests and a rollback, and a review of every `security definer` RPC, which bypasses RLS.
- **Edge Functions:** the same check on the caller's JWT before doing anything for an enrolled user.
- **Session:** existing `aal1` sessions of enrolled users are blocked by RLS at once; they are asked for the code on the
  next request (the UI handles the error by showing the code screen).

## The two accounts with `is_enabled = true`

Their old setting never did anything, so it can't simply be switched over. Recommended: on first sign-in after launch,
show "Set up two-step sign-in" (one tap to enrol a TOTP factor, or "Later"). Do not lock them out, because they have
never had a working factor. Once they are migrated, delete `user_2fa_settings` / `user_2fa_codes` and the two old
functions in a separate, approved clean-up.

## Recovery

- Supabase has no built-in backup codes. Options: (1) allow a second TOTP factor (e.g. a second phone) and recommend it;
  (2) owner-assisted reset: support verifies identity, then an admin-only, audited Edge Function unenrols the factor
  (`auth.admin.mfa.deleteFactor`). Recommended: both, with (2) logged to `audit_logs`.
- Never let a reset happen from an `aal1` session alone.

## Decisions for the owner

1. Option A (TOTP) as the first factor type? (recommended)
2. Optional for everyone, or required for company owners/admins? (suggest: required for owners/admins after 30 days)
3. Recovery: second factor plus support reset? (recommended)
4. Approve a migration adding the restrictive `aal2` policies, prepared with tests and a rollback, applied only after approval.
