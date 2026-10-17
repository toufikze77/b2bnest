-- Rollback for supabase/migrations/20261017190000_add_archived_at_invoices_quotes.sql (NOT yet applied).
-- Before running: restore or hard-delete archived documents as the owner decides, and deploy app code
-- that no longer reads archived_at. After the drop, archived documents become active again everywhere.
alter table public.invoices drop column archived_at;
alter table public.quotes drop column archived_at;
