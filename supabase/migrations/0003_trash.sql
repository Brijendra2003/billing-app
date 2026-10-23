-- Trash: deleting a client or document moves it to the trash for 30 days instead of
-- removing it. Trashed rows are hidden by RLS, and so is everything hanging off them
-- (items, payments, follow-ups, messages), so the rest of the app needs no changes.
-- Restoring brings it all back; after 30 days it is deleted for good.

alter table public.clients add column deleted_at timestamptz;
alter table public.documents add column deleted_at timestamptz;
create index clients_deleted on public.clients(deleted_at) where deleted_at is not null;
create index documents_deleted on public.documents(deleted_at) where deleted_at is not null;

-- A trashed client's name can be reused.
drop index public.clients_name_uq;
create unique index clients_name_uq on public.clients(business_id, lower(name)) where not is_archived and deleted_at is null;

-- ───────────────────────────── Hide trashed rows ─────────────────────────────
-- The exists() checks run under the caller's RLS, so they fail for trashed parents.
drop policy clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.is_member(business_id) and deleted_at is null);

drop policy documents_select on public.documents;
create policy documents_select on public.documents for select
  using (public.is_member(business_id) and deleted_at is null);

drop policy payments_select on public.payments;
create policy payments_select on public.payments for select
  using (public.is_member(business_id) and exists (select 1 from public.documents d where d.id = document_id));

drop policy followups_select on public.followups;
create policy followups_select on public.followups for select
  using (public.is_member(business_id) and exists (select 1 from public.clients c where c.id = client_id));

drop policy communications_select on public.communications;
create policy communications_select on public.communications for select
  using (
    public.is_member(business_id)
    and (document_id is null or exists (select 1 from public.documents d where d.id = document_id))
    and (client_id is null or exists (select 1 from public.clients c where c.id = client_id))
  );

-- ───────────────────────────── Purge ─────────────────────────────
-- Permanently removes anything trashed more than 30 days ago. Items, payments and
-- messages cascade with their document; follow-ups with their client.
create or replace function public.purge_expired_trash() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := now() - interval '30 days';
begin
  delete from public.documents d
   where d.deleted_at is not null
     and (d.deleted_at < v_cutoff
          or exists (select 1 from public.clients c where c.id = d.client_id and c.deleted_at < v_cutoff));
  delete from public.clients c
   where c.deleted_at < v_cutoff
     and not exists (select 1 from public.documents d where d.client_id = c.id);
end $$;

-- ───────────────────────────── Clients ─────────────────────────────
-- Trashes the client and all of its documents with the same timestamp, so restoring
-- the client brings back exactly those documents.
create or replace function public.trash_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.clients;
  v_now timestamptz := now();
begin
  select * into c from public.clients where id = p_client and deleted_at is null for update;
  if not found then raise exception 'Client not found'; end if;
  if not public.can_write(c.business_id) then raise exception 'Not allowed'; end if;

  update public.clients set deleted_at = v_now where id = p_client;
  update public.documents set deleted_at = v_now where client_id = p_client and deleted_at is null;

  insert into public.activity_log (business_id, actor_id, entity, entity_id, action, details)
  values (c.business_id, auth.uid(), 'client', c.id, 'trashed', jsonb_build_object('name', c.name));
end $$;

create or replace function public.restore_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.clients;
begin
  select * into c from public.clients where id = p_client and deleted_at is not null for update;
  if not found then raise exception 'Client not found in trash'; end if;
  if not public.can_write(c.business_id) then raise exception 'Not allowed'; end if;

  begin
    update public.clients set deleted_at = null where id = p_client;
  exception when unique_violation then
    raise exception 'Another client is already named "%". Rename it first.', c.name;
  end;
  update public.documents set deleted_at = null where client_id = p_client and deleted_at = c.deleted_at;

  insert into public.activity_log (business_id, actor_id, entity, entity_id, action, details)
  values (c.business_id, auth.uid(), 'client', c.id, 'restored', jsonb_build_object('name', c.name));
end $$;

create or replace function public.purge_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.clients;
begin
  select * into c from public.clients where id = p_client and deleted_at is not null for update;
  if not found then raise exception 'Client not found in trash'; end if;
  if not public.is_owner(c.business_id) then raise exception 'Only the owner can delete permanently'; end if;
  delete from public.documents where client_id = p_client and deleted_at is not null;
  delete from public.clients where id = p_client;
end $$;

-- ───────────────────────────── Documents ─────────────────────────────
-- Returns the doc_type so the app knows which list to go back to.
create or replace function public.trash_document(p_document uuid) returns public.doc_type
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
begin
  select * into d from public.documents where id = p_document and deleted_at is null for update;
  if not found then raise exception 'Document not found'; end if;
  if not public.can_write(d.business_id) then raise exception 'Not allowed'; end if;

  update public.documents set deleted_at = now() where id = p_document;

  -- Reopen the quotation / proforma this was converted from, so it can be converted again.
  if d.converted_from_id is not null and d.doc_type <> 'credit_note' then
    update public.documents s
       set status = case when s.doc_type = 'quotation' then 'accepted'::public.doc_status else 'issued'::public.doc_status end
     where s.id = d.converted_from_id
       and s.status = 'converted'
       and s.deleted_at is null
       and not exists (select 1 from public.documents o
                        where o.converted_from_id = s.id and o.deleted_at is null and o.doc_type <> 'credit_note');
    -- An unissued draft hands a carried-over proforma advance back (the payments trigger
    -- recomputes the proforma's paid status). Issued invoices keep their payments.
    if found and d.status = 'draft' then
      update public.payments set document_id = d.converted_from_id where document_id = p_document;
    end if;
  end if;

  insert into public.activity_log (business_id, actor_id, entity, entity_id, action, details)
  values (d.business_id, auth.uid(), 'document', d.id, 'trashed', jsonb_build_object('number', d.number));
  return d.doc_type;
end $$;

create or replace function public.restore_document(p_document uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
  v_client text;
begin
  select * into d from public.documents where id = p_document and deleted_at is not null for update;
  if not found then raise exception 'Document not found in trash'; end if;
  if not public.can_write(d.business_id) then raise exception 'Not allowed'; end if;
  select name into v_client from public.clients where id = d.client_id and deleted_at is not null;
  if v_client is not null then raise exception 'Restore the client "%" first.', v_client; end if;

  update public.documents set deleted_at = null where id = p_document;

  if d.converted_from_id is not null and d.doc_type <> 'credit_note' then
    update public.documents s set status = 'converted'
     where s.id = d.converted_from_id and s.deleted_at is null
       and s.status in ('issued', 'sent', 'accepted', 'rejected', 'partially_paid', 'paid');
    -- Undo the hand-back above: the advance follows the draft again.
    if found and d.status = 'draft' then
      update public.payments set document_id = p_document where document_id = d.converted_from_id;
    end if;
  end if;

  insert into public.activity_log (business_id, actor_id, entity, entity_id, action, details)
  values (d.business_id, auth.uid(), 'document', d.id, 'restored', jsonb_build_object('number', d.number));
end $$;

create or replace function public.purge_document(p_document uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.documents;
begin
  select * into d from public.documents where id = p_document and deleted_at is not null for update;
  if not found then raise exception 'Document not found in trash'; end if;
  if not public.is_owner(d.business_id) then raise exception 'Only the owner can delete permanently'; end if;
  delete from public.documents where id = p_document;
end $$;

-- ───────────────────────────── Listing ─────────────────────────────
-- Documents trashed together with their client are listed under the client only.
create or replace function public.trash_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'company_name', c.company_name,
               'deleted_at', c.deleted_at,
               'documents', (select count(*) from public.documents d where d.client_id = c.id and d.deleted_at = c.deleted_at),
               'payments', (select count(*) from public.payments p join public.documents d on d.id = p.document_id
                             where d.client_id = c.id and d.deleted_at = c.deleted_at)
             ) order by c.deleted_at desc)
        from public.clients c
       where c.deleted_at is not null and public.is_member(c.business_id)), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'doc_type', d.doc_type,
               'status', d.status,
               'number', d.number,
               'issue_date', d.issue_date,
               'grand_total', d.grand_total,
               'client_name', d.bill_to->>'name',
               'deleted_at', d.deleted_at,
               'payments', (select count(*) from public.payments p where p.document_id = d.id)
             ) order by d.deleted_at desc)
        from public.documents d
        left join public.clients c on c.id = d.client_id
       where d.deleted_at is not null and public.is_member(d.business_id)
         and (c.deleted_at is null or c.deleted_at <> d.deleted_at)), '[]'::jsonb)
  )
$$;

grant execute on function public.purge_expired_trash() to authenticated;
grant execute on function public.trash_client(uuid) to authenticated;
grant execute on function public.restore_client(uuid) to authenticated;
grant execute on function public.purge_client(uuid) to authenticated;
grant execute on function public.trash_document(uuid) to authenticated;
grant execute on function public.restore_document(uuid) to authenticated;
grant execute on function public.purge_document(uuid) to authenticated;
grant execute on function public.trash_list() to authenticated;

-- The app purges expired items whenever the Trash page is opened. To also purge on a
-- schedule, enable pg_cron (Database → Extensions) and run:
--   select cron.schedule('purge-trash', '0 3 * * *', 'select public.purge_expired_trash()');
