-- Rollback for supabase/migrations/20261017184901_add_invoices_paid_at.sql (already applied to production).
-- Deploy app code that no longer reads or writes invoices.paid_at FIRST, then run this.
-- Dropping the column discards every recorded paid date.
alter table public.invoices drop column paid_at;
