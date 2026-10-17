alter table public.invoices add column if not exists paid_at timestamptz;
comment on column public.invoices.paid_at is 'When the owner marked the invoice as paid. Null = not recorded.';
