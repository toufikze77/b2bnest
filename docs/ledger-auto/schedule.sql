-- PREPARED, NOT APPLIED. Finance phase 3a, owner step 2b (docs/ledger-auto/README.md): apply AFTER proposal.sql.
-- One pg_cron job (pg_cron is installed in production, docs/phase13/schedule.sql): every minute, look at up to 200
-- waiting invoices. Plain SQL, no HTTP and no secret. While no company has switched automatic postings on, it is a
-- no-op (the queue is empty). Safe to re-run: cron.schedule with an existing job name replaces that job.
-- To stop it: SELECT cron.unschedule('b2bnest-ledger-auto-queue');
SELECT cron.schedule('b2bnest-ledger-auto-queue', '* * * * *', $job$ SELECT public.ledger_process_queue(NULL, 200); $job$);
