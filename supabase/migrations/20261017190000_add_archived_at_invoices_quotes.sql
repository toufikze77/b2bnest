alter table public.invoices add column if not exists archived_at timestamptz;
alter table public.quotes add column if not exists archived_at timestamptz;
