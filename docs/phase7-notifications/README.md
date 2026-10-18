# Phase 7: in-app notifications and note reminders

**Status: proposed, NOT applied. Nothing is scheduled.** None of the SQL in this folder has been run on production
(`gvftvswyrevummbvyhxa`). No Edge Function, secret or cron job was created. Nothing here sends email: these are
in-app (bell) notifications only.

## What it adds

| Type | When it is created | De-duplication key | Links to |
| --- | --- | --- | --- |
| `invoice_overdue` | By the 15-minute job: invoice not archived, status not draft / paid / cancelled / void, due date before *today in the owner's time zone* (`profiles.timezone`, falling back to Europe/London if missing or invalid). Amount in the invoice's own currency. | `invoice_overdue:<invoice id>` (once per invoice, ever) | Invoices tab |
| `note_reminder` | By the 15-minute job: note not archived, not a template, `reminder_date` has passed. | `note_reminder:<note id>:<reminder epoch seconds>` (moving the reminder to a new time can notify again; the same time never twice) | `/business-tools/notepro?note=<id>` |
| `invoice_paid` | Trigger, when an invoice's status changes to paid (not archived). | `invoice_paid:<invoice id>` (paid → unpaid → paid again does **not** notify again) | Invoices tab |
| `quote_update` | Trigger, when a quote's status changes to a new non-empty value (not archived). | `quote_update:<quote id>:<status>` | Quotes tab |

Schema (`proposal.sql`, one transaction):
- `notifications.link` (in-app path only: must start with a single `/`, no spaces, ≤ 500 chars) and `notifications.dedupe_key` (≤ 200).
- Unique index `(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL`; index `(user_id, read, created_at DESC)` for the bell.
- **No CHECK on `type`**: production already has `welcome` and `info` rows, and the app writes `support`, `task_shared`,
  `project_shared` and others. New types are validated inside `_notify()` instead.
- `notification_type_prefs (user_id, type, in_app)` with own-row RLS. No row means "on".
- `generate_due_notifications(_limit default 500, max 5000)`: SECURITY DEFINER, `search_path = ''`, execute revoked from
  PUBLIC / anon / authenticated, granted to `service_role`. Returns counts as JSON.
- Triggers `invoices_notify_paid`, `quotes_notify_update`: AFTER UPDATE OF status, only when status actually changes;
  every error is caught and logged as a WARNING, so an invoice or quote update is never blocked.

What to expect on the first run: the notes that already have a reminder in the past (2 on 2026-10-18) and any sent,
unpaid invoices past their due date will each get one notification. After that, only new events.

## How to apply (after review)

1. Read `proposal.sql`. Optionally run `bash docs/phase7-notifications/run-test.sh` locally (needs Postgres 16 binaries).
2. Apply `proposal.sql` (SQL editor or as a migration). It is safe to re-run.
3. Check (verification queries below).
4. Only then schedule the job (run by hand, once):
   ```sql
   SELECT cron.schedule('b2bnest-generate-due-notifications', '*/15 * * * *', $job$SELECT public.generate_due_notifications();$job$);
   ```
5. Optional and separate: the retention job at the end of `proposal.sql` (deletes old notifications). Skip it to keep everything.

The app works before and after: until step 2 the bell reads the old columns and the in-app preferences card is hidden.

## Rollback

Run `rollback.sql` (safe to re-run). It unschedules both jobs by name, drops the triggers, functions, the preferences table,
both indexes, both constraints and both new columns. Notifications already created stay as ordinary rows unless you also
run the optional DELETE at the top of the file.

## Verification queries (read-only)

```sql
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name IN ('link', 'dedupe_key');
SELECT indexname FROM pg_indexes WHERE tablename = 'notifications' AND indexname LIKE 'notifications_user_%';
SELECT tgname FROM pg_trigger WHERE tgname IN ('invoices_notify_paid', 'quotes_notify_update');
SELECT has_function_privilege('authenticated', 'public.generate_due_notifications(integer)', 'EXECUTE') AS authenticated_can_run; -- expect false
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'b2bnest-%notification%';
SELECT type, count(*) FROM public.notifications WHERE dedupe_key IS NOT NULL GROUP BY type;
-- After scheduling: recent runs
SELECT status, return_message, start_time FROM cron.job_run_details d JOIN cron.job j USING (jobid)
 WHERE j.jobname = 'b2bnest-generate-due-notifications' ORDER BY start_time DESC LIMIT 5;
```

## Tests

- `test.sql`: one transaction, rolled back, with its own fixtures. 38 checks: no duplicate on a second run; archived, paid,
  draft, cancelled, due-today and undated invoices skipped; future reminders skipped and past ones fire once; templates and
  archived notes skipped; per-type switch-off respected; cap per run; triggers notify once; a failing notification insert
  is swallowed and the invoice update still succeeds; links must be in-app; a user cannot read or change another user's
  notifications or preferences; anon and authenticated cannot execute the generator or helpers.
  **Do not run it on production**: even rolled back, it takes locks and adds and drops a test constraint. Use a branch or `run-test.sh`.
- `run-test.sh`: throwaway local Postgres with `fixture.sql` (a minimal copy of the production shapes and Supabase grants;
  local only). Applies the proposal three times (idempotent), runs `test.sql` twice, rolls back twice and checks the schema
  matches the original, checks an injected failure leaves nothing behind, re-applies and re-tests.
