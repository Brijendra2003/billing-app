-- SmartBill CRM — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pg_trgm;

-- ───────────────────────────── Enums ─────────────────────────────
create type public.doc_type as enum ('quotation', 'proforma', 'tax_invoice', 'credit_note');
create type public.doc_status as enum (
  'draft', 'issued', 'sent', 'accepted', 'rejected',
  'partially_paid', 'paid', 'cancelled', 'converted'
);
create type public.tax_mode as enum ('auto', 'igst', 'cgst_sgst');
create type public.member_role as enum ('owner', 'staff', 'viewer');
create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other');
create type public.comm_channel as enum ('email', 'whatsapp');
create type public.comm_status as enum ('sent', 'failed');
create type public.pricing_mode as enum ('unit', 'area');

-- ───────────────────────────── Helpers ─────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.random_token() returns text
language sql volatile as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- ───────────────────────────── Businesses ─────────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  state text not null default '',
  state_code text not null default '',
  pincode text not null default '',
  gstin text not null default '',
  pan text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  logo_path text,
  signature_path text,
  payment_qr_path text,
  upi_id text not null default '',
  bank_account_name text not null default '',
  bank_account_no text not null default '',
  bank_ifsc text not null default '',
  bank_name text not null default '',
  bank_branch text not null default '',
  -- defaults
  default_tax_rate numeric(5,2) not null default 18,
  round_off boolean not null default true,
  freight_taxable boolean not null default false,
  auto_backup_drive boolean not null default true,
  default_due_days int not null default 0,
  quotation_validity_days int not null default 15,
  default_terms text not null default '',
  quotation_terms text not null default '',
  -- numbering: tokens {PREFIX} {FY} {SEQ}
  number_format text not null default '{PREFIX}/{FY}/{SEQ}',
  seq_padding int not null default 4 check (seq_padding between 1 and 8),
  reset_yearly boolean not null default true,
  prefix_quotation text not null default 'QT',
  prefix_proforma text not null default 'PI',
  prefix_tax_invoice text not null default 'INV',
  prefix_credit_note text not null default 'CN',
  -- message templates (placeholders: {client_name} {doc_label} {number} {date} {amount} {balance} {due_date} {link} {business_name})
  email_subject_template text not null default '{doc_label} {number} from {business_name}',
  email_body_template text not null default
    E'Dear {client_name},\n\nPlease find attached {doc_label} {number} dated {date} for {amount}.\n\nYou can also view it online: {link}\n\nThank you for your business.\n\nRegards,\n{business_name}',
  whatsapp_template text not null default
    E'Dear {client_name},\nPlease find your {doc_label} *{number}* dated {date} for *{amount}*.\n\nView / download: {link}\n\nThank you,\n{business_name}',
  reminder_template text not null default
    E'Dear {client_name},\nThis is a gentle reminder that {balance} is pending against invoice *{number}* dated {date} (due {due_date}).\n\nView / download: {link}\n\nPlease ignore if already paid. Thank you,\n{business_name}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();

create table public.members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_idx on public.members(user_id);

-- Membership helpers (security definer so RLS policies can call them without recursion)
create or replace function public.is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where business_id = p_business and user_id = auth.uid())
$$;

create or replace function public.can_write(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where business_id = p_business and user_id = auth.uid() and role in ('owner', 'staff'))
$$;

create or replace function public.is_owner(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members
                 where business_id = p_business and user_id = auth.uid() and role = 'owner')
$$;

-- ───────────────────────────── Clients & products ─────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  company_name text not null default '',
  gstin text not null default '',
  email text not null default '',
  phone text not null default '',          -- E.164 digits without '+', e.g. 919876543210
  whatsapp text not null default '',       -- defaults to phone when empty
  address text not null default '',
  city text not null default '',
  state text not null default '',
  state_code text not null default '',
  pincode text not null default '',
  shipping_name text not null default '',
  shipping_address text not null default '',
  shipping_city text not null default '',
  shipping_state text not null default '',
  shipping_state_code text not null default '',
  shipping_pincode text not null default '',
  tags text[] not null default '{}',
  notes text not null default '',
  credit_days int not null default 0,
  opening_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_name_uq on public.clients(business_id, lower(name)) where not is_archived;
create index clients_name_trgm on public.clients using gin (name gin_trgm_ops);
create trigger clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  hsn_sac text not null default '',
  unit text not null default 'pcs',
  default_rate numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 18,
  pricing_mode public.pricing_mode not null default 'unit',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_name_uq on public.products(business_id, lower(name)) where not is_archived;
create index products_name_trgm on public.products using gin (name gin_trgm_ops);
create trigger products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- ───────────────────────────── Documents ─────────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_type public.doc_type not null,
  status public.doc_status not null default 'draft',
  number text,
  fy text,
  issue_date date not null default current_date,
  due_date date,
  valid_until date,
  client_id uuid references public.clients(id) on delete restrict,
  bill_to jsonb not null default '{}'::jsonb,
  ship_to jsonb,
  place_of_supply_state_code text not null default '',
  tax_mode public.tax_mode not null default 'auto',
  freight_amount numeric(14,2) not null default 0,
  freight_taxable boolean not null default false,
  freight_tax_rate numeric(5,2) not null default 18,
  apply_round_off boolean not null default true,
  subtotal numeric(14,2) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) generated always as (grand_total - amount_paid) stored,
  notes text not null default '',
  terms text not null default '',
  reference text not null default '',      -- client PO number etc.
  converted_from_id uuid references public.documents(id) on delete set null,
  share_token text not null unique default public.random_token(),
  created_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index documents_number_uq on public.documents(business_id, doc_type, number) where number is not null;
create index documents_business_type_date on public.documents(business_id, doc_type, issue_date desc);
create index documents_client on public.documents(client_id);
create trigger documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  position int not null default 0,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  description text not null default '',
  hsn_sac text not null default '',
  unit text not null default 'pcs',
  pricing_mode public.pricing_mode not null default 'unit',
  length numeric(12,3),
  breadth numeric(12,3),
  dimension_unit text,
  qty numeric(14,3) not null default 1,
  rate numeric(14,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 18,
  taxable_amount numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0
);
create index document_items_doc on public.document_items(document_id, position);

-- ───────────────────────────── Payments ─────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'upi',
  reference text not null default '',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_business_date on public.payments(business_id, paid_on desc);
create index payments_document on public.payments(document_id);

-- Keep documents.amount_paid / status in sync with payments.
create or replace function public.sync_document_payments() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid;
  v_paid numeric(14,2);
begin
  -- On update the payment may have moved to another document, so resync both.
  for v_doc in
    select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.document_id end,
      case when tg_op <> 'DELETE' then new.document_id end
    ]) as x where x is not null
  loop
    select coalesce(sum(amount), 0) into v_paid from public.payments where document_id = v_doc;
    update public.documents d
       set amount_paid = v_paid,
           status = case
             when d.status in ('cancelled', 'draft', 'converted') then d.status
             when v_paid >= d.grand_total and d.grand_total > 0 then 'paid'::public.doc_status
             when v_paid > 0 then 'partially_paid'::public.doc_status
             when d.status in ('paid', 'partially_paid') then 'issued'::public.doc_status
             else d.status
           end
     where d.id = v_doc;
  end loop;
  return null;
end $$;
create trigger payments_sync after insert or update or delete on public.payments
  for each row execute function public.sync_document_payments();

-- ───────────────────────────── Communications / follow-ups / activity ─────────────────────────────
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  channel public.comm_channel not null,
  to_address text not null default '',
  subject text not null default '',
  body text not null default '',
  status public.comm_status not null default 'sent',
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index communications_doc on public.communications(document_id, created_at desc);
create index communications_client on public.communications(client_id, created_at desc);

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  due_on date not null,
  note text not null,
  done boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index followups_business_due on public.followups(business_id, done, due_on);

create table public.activity_log (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_entity on public.activity_log(entity_id, created_at desc);

-- ───────────────────────────── Numbering ─────────────────────────────
create table public.number_sequences (
  business_id uuid not null references public.businesses(id) on delete cascade,
  doc_type public.doc_type not null,
  period text not null,               -- financial year like '2026-27', or 'all' when not resetting yearly
  next_value int not null default 1 check (next_value > 0),
  primary key (business_id, doc_type, period)
);

create or replace function public.financial_year(p_date date) returns text
language sql immutable as $$
  select case when extract(month from p_date) >= 4
    then extract(year from p_date)::int || '-' || lpad(((extract(year from p_date)::int + 1) % 100)::text, 2, '0')
    else (extract(year from p_date)::int - 1) || '-' || lpad((extract(year from p_date)::int % 100)::text, 2, '0')
  end
$$;

-- Atomically allocates a number and moves a draft to 'issued'.
create or replace function public.issue_document(p_document uuid) returns public.documents
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
  b public.businesses;
  v_fy text;
  v_period text;
  v_seq int;
  v_prefix text;
  v_number text;
begin
  select * into d from public.documents where id = p_document for update;
  if not found then raise exception 'Document not found'; end if;
  if not public.can_write(d.business_id) then raise exception 'Not allowed'; end if;
  if d.status <> 'draft' then return d; end if;

  select * into b from public.businesses where id = d.business_id;
  v_fy := public.financial_year(d.issue_date);
  v_period := case when b.reset_yearly then v_fy else 'all' end;

  insert into public.number_sequences as s (business_id, doc_type, period, next_value)
  values (d.business_id, d.doc_type, v_period, 2)
  on conflict (business_id, doc_type, period)
  do update set next_value = s.next_value + 1
  returning s.next_value - 1 into v_seq;

  v_prefix := case d.doc_type
    when 'quotation' then b.prefix_quotation
    when 'proforma' then b.prefix_proforma
    when 'tax_invoice' then b.prefix_tax_invoice
    else b.prefix_credit_note end;

  v_number := replace(replace(replace(b.number_format,
                '{PREFIX}', v_prefix),
                '{FY}', right(v_fy, 5)),
                '{SEQ}', lpad(v_seq::text, b.seq_padding, '0'));

  update public.documents
     set number = v_number, fy = v_fy, issued_at = now(),
         status = case
           when amount_paid > 0 and amount_paid >= grand_total then 'paid'::public.doc_status
           when amount_paid > 0 then 'partially_paid'::public.doc_status
           else 'issued'::public.doc_status
         end
   where id = p_document
  returning * into d;

  insert into public.activity_log (business_id, actor_id, entity, entity_id, action, details)
  values (d.business_id, auth.uid(), 'document', d.id, 'issued', jsonb_build_object('number', v_number));

  return d;
end $$;

-- First signed-in user with no business becomes the owner of a new one.
-- Only works while no business exists, so stray sign-ups never get access.
create or replace function public.bootstrap_business() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select business_id into v_id from public.members where user_id = auth.uid() limit 1;
  if v_id is not null then return v_id; end if;

  lock table public.businesses in exclusive mode;
  if exists (select 1 from public.businesses) then return null; end if;

  insert into public.businesses (
    name, address, city, state, state_code, pincode, gstin, email, phone,
    bank_account_name, bank_account_no, bank_ifsc, bank_name, bank_branch, default_terms, quotation_terms
  ) values (
    'SN SAFETY SIGNAGES',
    'Unit No. 135, 1st Floor, Dewan Industrial Estate No. 1, Navghar Road, Vasai East',
    'Vasai East', 'Maharashtra', '27', '401210', '27AOBPY0011L1ZZ',
    'snsafteysignages@gmail.com', '918530072419',
    'SN SAFETY SIGNAGES', '006861900003847', 'YESB0000068', 'Yes Bank', 'Vasai East',
    E'1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.',
    E'1. Prices are valid until the date mentioned above.\n2. GST extra as applicable.'
  ) returning id into v_id;

  insert into public.members (business_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end $$;

-- ───────────────────────────── Row Level Security ─────────────────────────────
alter table public.businesses enable row level security;
alter table public.members enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.payments enable row level security;
alter table public.communications enable row level security;
alter table public.followups enable row level security;
alter table public.activity_log enable row level security;
alter table public.number_sequences enable row level security;

create policy businesses_select on public.businesses for select using (public.is_member(id));
create policy businesses_update on public.businesses for update using (public.is_owner(id)) with check (public.is_owner(id));

create policy members_select on public.members for select using (public.is_member(business_id));
create policy members_owner_all on public.members for all using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- Generic policies for business-scoped tables
do $$
declare t text;
begin
  foreach t in array array['clients', 'products', 'documents', 'payments', 'communications', 'followups', 'number_sequences']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_member(business_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.can_write(business_id))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.can_write(business_id)) with check (public.can_write(business_id))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.can_write(business_id))', t);
  end loop;
end $$;

create policy activity_select on public.activity_log for select using (public.is_member(business_id));
create policy activity_insert on public.activity_log for insert with check (public.can_write(business_id));

create policy items_select on public.document_items for select
  using (exists (select 1 from public.documents d where d.id = document_id and public.is_member(d.business_id)));
create policy items_write on public.document_items for all
  using (exists (select 1 from public.documents d where d.id = document_id and public.can_write(d.business_id)))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.can_write(d.business_id)));

grant execute on function public.issue_document(uuid) to authenticated;
grant execute on function public.bootstrap_business() to authenticated;

-- ───────────────────────────── Storage (logo, signature, payment QR) ─────────────────────────────
insert into storage.buckets (id, name, public) values ('branding', 'branding', false)
on conflict (id) do nothing;

create policy branding_read on storage.objects for select
  using (bucket_id = 'branding' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy branding_insert on storage.objects for insert
  with check (bucket_id = 'branding' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy branding_update on storage.objects for update
  using (bucket_id = 'branding' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy branding_delete on storage.objects for delete
  using (bucket_id = 'branding' and public.is_owner(((storage.foldername(name))[1])::uuid));
