# Phase 13: trial-ending emails (prepared, switched off)

Nothing in this PR has been applied, deployed, scheduled or sent, not even a test email. Production is `gvftvswyrevummbvyhxa`. Facts were read **read-only** on 28 Oct 2026.

## Who gets which email

At most three emails per trial, ever. Each is sent at most once per person and trial end (unique key on person + email + `trial_ends_at`).

| # | Kind | Subject | Sent when (defaults) |
| --- | --- | --- | --- |
| 1 | `ending_soon` | "Your B2BNEST trial ends in 3 days" | Access state `trial`, `via = 'self'`, trial ends 48–72 hours from now |
| 2 | `ended` | "Your B2BNEST trial has ended" | Access state `trial_ended`, `via = 'self'`. Sent on the first daily run after the end (so within 24 hours while the job runs daily), and never later than `catchup_max_days` (7) after it |
| 3 | `follow_up` | "Your B2BNEST information is still here" | Still `trial_ended` / `self` at least 72 hours after the end, at least 48 hours after email 2 was queued, and within 7 days of the end |

Access comes only from `public._access_state_for(uuid)`; the email rules do not re-implement it. The rules are in one function, `public._trial_email_skip_reason`, which is used both when queueing **and again when the sender claims the email**. Someone who subscribes, becomes a master account, is suspended or opts out after queueing is cancelled, never sent (tested).

**Never emailed:**
- owners and master accounts (state `owner`);
- subscribers;
- suspended accounts;
- support customers;
- anyone without a verified email;
- anyone who opted out;
- anyone whose trial ended more than 7 days ago (the catch-up rule);
- **company members whose access follows another person's account** (`via = 'company'`). Nothing is sent to them in this phase. Their company's billing owner, who is the one who would pay, gets the emails about their own trial.

**Production today** (`precheck.sql`, read-only, 28 Oct): all 8 trials ended more than 7 days ago. So **0 people** would get an email if the switch were turned on today, and 8 are skipped as `ended_too_long_ago`. Run it again before switching on.

## The kill switch, cap and timings: one row

Everything the owner can change is in `public.trial_email_settings`, a single row editable with SQL only (Admin UI later):

| Column | Default | Meaning |
| --- | --- | --- |
| `enabled` | **false** | Kill switch. While false, `queue_trial_emails()` returns 0 and the sender claims nothing (queued rows wait). |
| `daily_cap` | 50 | Emails queued per UTC day, all kinds together |
| `reminder_from_hours` / `reminder_to_hours` | 48 / 72 | Window for email 1 |
| `followup_after_hours` / `followup_gap_hours` | 72 / 48 | When email 3 may go |
| `catchup_max_days` | 7 | Never email about a trial that ended longer ago than this |

Example: `UPDATE public.trial_email_settings SET enabled = false, updated_at = now() WHERE id;`

## Opt-out, and the question for the owner (not legal advice)

Every email has a one-click unsubscribe link: `https://www.b2bnest.online/unsubscribe?token=…`. The same URL is in a `List-Unsubscribe` header.

**The link and the token**
- No sign-in is needed. The public page calls `public.email_unsubscribe(token)`, which checks the token inside the database, records the opt-out in `public.email_optouts` and cancels anything still queued.
- It gives the same answer for valid, invalid and repeated tokens. It returns nothing, so it can't be used to find out whether an account or address exists.
- The token is a 256-bit random value stored with each log row (two v4 UUIDs, 244 random bits). It is unguessable and server-side only.
- It is a **random secret, not a signature**. I chose that so there is no signing key to share between the database and the function, or to rotate; the security property (unguessable) is the same.
- **Tokens do not expire.** An unsubscribe link should keep working. Deleting the log rows (or `rollback.sql`) disables them.

**Known limits of the page**
- The page records the opt-out when it opens. Some mail security scanners open links, which could unsubscribe someone by accident. The person can ask to be re-subscribed; there is no self-service re-subscribe in this phase.
- The header is the URL form only, without `List-Unsubscribe-Post` (RFC 8058 one-click POST), because the site is a static app with no POST endpoint.

**Why a new table:** the existing preference tables don't fit. `user_notification_preferences` holds task-email toggles the user edits under RLS, and `notification_type_prefs` is for in-app notifications. So the opt-out has its own small, server-only table.

**The question for the owner: which emails need consent, and can people opt out of all three?** By default the opt-out stops **all three** emails, the cautious choice. My reasoning, for you or your adviser to confirm (this is not legal advice):
- Under UK PECR, direct-marketing emails to individuals need consent, unless the "soft opt-in" applies. The ICO's guidance treats someone who signed up for a free trial as a possible soft opt-in case, if they were given a chance to refuse at sign-up and in every message, and the messages are about your own similar products.
- Email 1 mostly informs about a change to the service the person is using. It is arguably a service message rather than marketing.
- Emails 2 and 3 encourage buying a plan, so they are marketing.
- **Open points:**
  - the sign-up form has no marketing opt-out or consent checkbox (checked in `src/pages/Auth.tsx`), so the soft opt-in's "chance to refuse at sign-up" is not met today;
  - many B2BNEST users are sole traders, who PECR treats as individuals;
  - whether email 1 may ignore an opt-out.

## What was reused from Phase 10

Reused:
- **SMTP:** `supabase/functions/workflow-send-email/smtp.ts` (`sendSmtp`, `SmtpStageError`), `resolveSmtp`, and `smtpOnly` from `onboarding-email-sender`. That means Microsoft 365 `SMTP_*` only, with the Gmail fallback refused, and no new secrets.
- **The outbox state machine:** `pending` / `sending` / `accepted_by_provider` / `failed` / `uncertain` / `cancelled`, at most 5 attempts, backoff 5, 15, 45 and 135 minutes. A crash after DATA becomes `uncertain` and is **never** resent automatically.
- **The claim / finish contract**, and the handler shape (service-role callers only, batch of 20, error text scrubbed of email addresses).
- **Scheduling:** pg_cron + pg_net with the same Vault secret name (`email_senders_service_role_key`).
- `scripts/flatten-function.mjs` for dashboard deploys.

Added:
- `public.trial_email_outbox` (the invitation outbox needs a company and is limited to invitation kinds);
- `trial_email_log`, `trial_email_settings`, `email_optouts`;
- the queue, claim, finish, rules and unsubscribe functions;
- `supabase/functions/_shared/trial-emails.ts` (the templates);
- `supabase/functions/trial-email-sender/` (handler, a small multipart/alternative builder with `List-Unsubscribe`, and tests);
- the `/unsubscribe` page.

The sender has **no** `*_EMAIL_ENABLED` flag: the database switch is the one switch, because the claim returns nothing while it is off.

## Templates

They are in `supabase/functions/_shared/trial-emails.ts`, with plain text plus simple HTML: brand navy `#001A4C` and blue `#0069FF`, the original wordmark PNG (many email apps block SVG), 600 px wide and mobile friendly.

**Content:**
- **Prices** come from the plan catalogue. `_shared/plans.ts` is the copy the server can import, and `planCatalogue.test.ts` keeps it identical to `src/lib/plans.ts`. A new test fails if email 2's prices and `src/lib/plans.ts` disagree.
- **Links** all start with `SITE_URL` (`https://www.b2bnest.online`), with no tracking parameters (tested).
- **"Nothing is deleted"** appears in emails 1 and 2 because Phase 12 verified it.
- **Company details** come from the Privacy Policy and Terms pages: Edeals Master Ltd, Company No. 15242148, registered office 6a-6b Calvert Road, Hastings, England, TN34 3NG, with support@b2bnest.online as the contact address. **Owner: please confirm these are correct for marketing email.**

**Previews:** run `node scripts/preview-trial-emails.mjs`; it writes `docs/phase13/previews/*.html` and `*.txt` (dummy data). Screenshots at 600 and 390 px are in `docs/phase13/screenshots/`. The logo was served from the repo's copy, because production can't be reached from here.

## Files and order

1. `precheck.sql`: read-only, counts only.
2. `proposal.sql`: one transaction. It refuses to run twice, or if Phases 12 and 12c, `support_customers` or `auth.users.email_confirmed_at` are missing. Everything new has explicit `REVOKE` / `GRANT` statements:
   - all tables are service_role only, with RLS on and no policies;
   - every function uses `SET search_path = ''`;
   - only `email_unsubscribe` is open to anon and authenticated.
3. `data-step-test-account.sql`: the bounded test (rollout step 3).
4. `schedule.sql`: the two cron jobs (rollout step 4). `schedule-rollback.sql` undoes it.
5. `rollback.sql`: drops everything Phase 13 added. Run `schedule-rollback.sql` first.

## Rollout (nothing here is switched on by this PR)

1. **Apply `proposal.sql`.** The switch stays OFF. `SELECT public.queue_trial_emails();` returns 0.
2. **Deploy `trial-email-sender`** (`verify_jwt = true`). For a dashboard deploy, run `node scripts/flatten-function.mjs trial-email-sender`; it produces 8 files. Call it once with the service-role key: expect `{"status":"ran","claimed":0,…}`; without the key it returns 401.
3. **Bounded test with ONE account the owner controls**, using `data-step-test-account.sql`:
   - (a) Check the account: `trial` or `trial_ended`, via `self`, verified. Check that nothing else is queued.
   - (b) Move that account's trial end to 60 hours from now, set `daily_cap = 1`, switch on and queue. Expect exactly 1 row, for that account only. **Only do (b) if `precheck.sql` shows 0 "WOULD BE QUEUED" for everyone else.**
   - (c) Call the sender once by hand, then read the row (`accepted_by_provider` with a `250 …` reply). Check the inbox, spam folder, links and the unsubscribe page.
   - (d) Switch off and set the cap back to 50.
4. **Schedule** with `schedule.sql`:
   - the queue runs daily at 09:07 UTC (SQL only);
   - the sender runs every 10 minutes through pg_net, with the Vault service-role key;
   - while the switch is off, both do nothing.
5. **The owner switches it on:** `UPDATE public.trial_email_settings SET enabled = true, updated_at = now() WHERE id;`. Watch the outbox for a day.

**Sending limits**
- **Microsoft 365 (Exchange Online):** a mailbox can send to at most 10,000 recipients a day and 30 messages a minute. This is Microsoft's published limit; I did not check this tenant.
- **This setup sends far less:** at most 50 emails are queued a day, and at most 20 are sent per run, one connection at a time. Each run is one Supabase Edge Function call that must finish within the function's time limit.
- **pg_net** stops waiting after 60 seconds, as for the Phase 10 senders.

**SPF / DKIM**
- The From address is the existing `SMTP_FROM`. The Phase 10 README records it as `notifications@b2bnest.online`; secrets are not readable, so I haven't re-checked it.
- Custom DKIM for `b2bnest.online` is still an open owner task. Without it, mail from `@b2bnest.online` through Microsoft 365 is more likely to land in spam or fail DMARC checks.
- **Recommendation:** finish DKIM for `b2bnest.online` before step 5. The bounded test in step 3 is fine without it, and it will show where the email lands.

## Tests

Run `PG_RUN_USER=postgres bash docs/phase13/run-test.sh` from the repo root. It uses a throwaway Postgres 16 on port 55442.

Every earlier suite runs **unchanged**, before and after Phase 13. Production today means Phase 12 (as live) plus 12b and 12c.

| Suite | Before Phase 13 | After Phase 13 |
| --- | --- | --- |
| `docs/phase12/test.sql` | 79/81 | 79/81 (the same two expected failures since 12c, docs/phase12c/README.md) |
| `docs/phase12b/test.sql` | 51/51 | 51/51 |
| `docs/phase12c/test.sql` | 49/49 | 49/49 |
| `docs/phase13/test.sql` | | **60/60**, plus re-apply after rollback ✓ and second apply refused ✓ |

## Not verified

- Anything on production beyond read-only readings. Nothing was applied.
- Real SMTP delivery through Microsoft 365, inbox placement (DKIM, SPF, DMARC) and the `SMTP_FROM` value.
- How mail apps render the HTML (only Chromium screenshots).
- Whether the logo URL is reachable on the live site.
- Whether mail scanners trigger the unsubscribe link.
- The legal basis question above.
