-- Accountant (CA) contact, used by "Share to CA" on the invoice list.
-- Run after 0005_packaging.sql.

alter table public.businesses
  add column if not exists ca_name text not null default '',
  add column if not exists ca_whatsapp text not null default '';
