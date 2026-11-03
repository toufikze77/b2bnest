# Phase 39b: referral box without the "Advert" badge; no marketing checkbox at sign-up

A follow-up to Phase 39 (PR #67, merged; its SQL is applied in production). Frontend changes, plus one small SQL
proposal. **The SQL is prepared, not applied.** Nothing in production was written.

## 1. Referral box: no "Advert" badge
The owner found that people read "Advert" as an outside ad and don't open the box.

**Changed** (`ReferralSlot` in `src/components/freeTools/Promos.tsx`, used by the Setup Checklist, the Cost Calculator and Business Resources):
- The "Advert" badge is gone, and so is the box's `aria-label="Advert"`.
- The box is now labelled with what it is: the group name "Banking & finance", then "Business account: Revolut Business" (the entry's `kind` and name, in `src/data/freeToolsPromos.ts`).
- The dismiss button reads "Hide this for now".
- It keeps the existing card style. It doesn't look like an error or a warning.

**Kept, because it is the disclosure UK rules require** (ASA/CAP Code and CMA guidance on paid and commission links):
- "We may earn a commission if you open an account through this link." It sits directly under the link, in the same box, in normal body size (not small print). With two or more links it says "these links".
- `rel="sponsored noopener noreferrer"` and `target="_blank"`.
- "Not financial advice. Check the terms with the provider."

**Unchanged:**
- The Business Finance Assistant promotion (B2BNEST's own product, which never carried the label).
- The Hostinger card and its disclosure on Business Resources.

## 2. Sign-up: no marketing checkbox
- **Removed:** the checkbox on the sign-up form (`Auth.tsx`). Sign-up now sends only `signup_source` in the sign-up details: the free tool the person came from, or `signup`.
- **Unchanged:**
  - the Settings → Notifications switch (opt-in, off by default, saved through `marketing_consent_set`);
  - `ConsentRecorder`;
  - the `marketing_consents` table and every Phase 39 function. Nothing is dropped.
- **Why there is SQL:** the applied Phase 39 `marketing_consent_record_signup()` records a row only when the sign-up details hold a `marketing_consent` choice. With no checkbox, nothing would be recorded and the sign-up source would be lost.
  - **Until `docs/phase39b/proposal.sql` is applied:** nothing is recorded for new sign-ups. The person sees no error, and everything else works.
  - **After it is applied:** each new sign-up gets a row with `consented = false` and `source` = the tool id (or `signup`).

### `docs/phase39b/proposal.sql` (for the owner to approve)
It replaces only `public.marketing_consent_record_signup()`, in one transaction.

**It refuses, and changes nothing, unless all of these hold:**
- The function body is the Phase 39 body, md5 `92b26481e8c7b688d055bde1c0360953` (checked against production, read-only, 3 Nov 2026).
- Its privileges are exactly `{postgres=X, authenticated=X}`.
- Its Phase 25 guard log row is `(user, 663d400f…, 92b26481…)`.
- Phase 39b hasn't been applied already. A second apply is refused with "Phase 39b already exists".

**The new body:**
- **A row already exists:** nothing (a later choice always wins).
- **The sign-up details hold `signup_source` and no `marketing_consent`:** records `consented = false` with that source. The source must be one of the seven tool ids, otherwise `signup`. It never records `true` without an explicit choice.
- **They hold `marketing_consent`** (accounts made while the Phase 39 checkbox existed): recorded as before. An explicit yes stays yes.
- **Nothing in the sign-up details** (OAuth, older accounts): nothing recorded.

**Kept from Phase 39 / Phase 25:**
- the guard line `PERFORM public.require_aal2_if_enrolled(); -- phase25 mfa guard`;
- SECURITY DEFINER, `SET search_path = ''`;
- EXECUTE for authenticated only. `CREATE OR REPLACE` keeps the grants, and the proposal checks them afterwards.

Its guard log row is updated to the new body's `old_md5` / `new_md5` (the same pattern earlier phases used when replacing a guarded function). No row is added.

**`rollback.sql`:**
- Puts back the exact Phase 39 body and its guard log row values. Rows already recorded stay; they are `consented = false` unless someone chose yes.
- Refuses unless the Phase 39b body is the one in place.

**Security advisor:** no new warnings. The function already counts under `authenticated_security_definer_function_executable`, and the count stays 3.

### Tests (`PG_RUN_USER=postgres bash docs/phase39b/run-test.sh`): 28 / 28 PASS
- **Setup:** the shim, the Phase 35/36/37/31 fixtures and the Phase 39 proposal. It then checks that the function body, privileges and guard row equal production.
- **Before 39b:** a sign-up source alone records nothing.
- **After 39b:**
  - privileges, SECURITY DEFINER and search_path unchanged;
  - guard line kept, and the guard row matches the new body;
  - no guard row added; `marketing_consent_set` untouched.
- **Recording:**
  - Cost Calculator sign-up → `false`, `cost-calculator`, no `consented_at`;
  - recorded once only;
  - opting in later in Settings works and keeps the source;
  - an unknown source becomes `signup`;
  - an old explicit yes stays yes, and an old explicit no stays no;
  - nothing in the details → nothing recorded;
  - an existing choice is never overwritten.
- **Access:** two-step set up at aal1 is refused, aal2 works; anon is refused.
- **Apply, rollback and drift:**
  - a second apply is refused;
  - the rollback fingerprint (functions, privileges, guard log) matches exactly; no consent row is removed;
  - re-apply works; rollback is refused when 39b isn't applied;
  - changed privileges are refused, and so is a changed body; nothing is applied after a refusal.

## Marketing emails: note for the owner
- **By default:** only people with `consented = true` may be sent marketing emails.
- **Recorded "no" rows:** the `false` rows created at sign-up are not consent. They only record where the person came from.
- **Soft opt-in:** emailing people who haven't opted in is only possible under the PECR "soft opt-in". That covers existing customers, about similar products and services, with a chance to refuse at sign-up and an unsubscribe link in every message. Whether it applies is a legal call to confirm with an adviser. The sign-up form no longer offers a chance to refuse at that point, which matters for the soft opt-in.
- **Nothing is sent:** no code here sends marketing emails. The export query is in `docs/phase39/README.md`.

## Checks
See the PR.
