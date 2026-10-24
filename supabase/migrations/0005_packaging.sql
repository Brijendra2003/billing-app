-- Optional packaging charges on quotations and invoices, shown below courier/freight.
-- Run after 0004_performance.sql.

alter table public.documents
  add column if not exists packaging_amount numeric(14,2) not null default 0,
  add column if not exists packaging_taxable boolean not null default true,
  add column if not exists packaging_tax_rate numeric(5,2) not null default 18;
