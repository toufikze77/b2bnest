-- Rollback for docs/phase4b-document-email/proposal.sql. Removes the email log and its limit helper.
-- Effect: the history of which documents were emailed (outcome, recipient domain) is lost. Invoice and quote rows,
-- including any status already set to "sent", are not touched. Deploying-wise: switch DOCUMENT_EMAIL_ENABLED off (or
-- undeploy send-document-email) first; without the table the function refuses to send ("limit couldn't be checked").
BEGIN;
DROP FUNCTION IF EXISTS public.document_email_recent_counts(uuid, uuid, timestamptz);
DROP TABLE IF EXISTS public.document_email_log;
COMMIT;
