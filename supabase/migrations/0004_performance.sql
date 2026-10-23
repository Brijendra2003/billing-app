-- Faster reads. Run after 0003_trash.sql.
--
-- The select policies called is_member(business_id) for every row, which runs a
-- lookup on members per row. `business_id in (select my_business_ids())` is evaluated
-- once per query instead (Supabase's recommended RLS pattern).

create or replace function public.my_business_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select business_id from public.members where user_id = auth.uid()
$$;
grant execute on function public.my_business_ids() to authenticated;

drop policy clients_select on public.clients;
create policy clients_select on public.clients for select
  using (business_id in (select public.my_business_ids()) and deleted_at is null);

drop policy products_select on public.products;
create policy products_select on public.products for select
  using (business_id in (select public.my_business_ids()));

drop policy documents_select on public.documents;
create policy documents_select on public.documents for select
  using (business_id in (select public.my_business_ids()) and deleted_at is null);

drop policy payments_select on public.payments;
create policy payments_select on public.payments for select
  using (business_id in (select public.my_business_ids()) and exists (select 1 from public.documents d where d.id = document_id));

drop policy followups_select on public.followups;
create policy followups_select on public.followups for select
  using (business_id in (select public.my_business_ids()) and exists (select 1 from public.clients c where c.id = client_id));

drop policy communications_select on public.communications;
create policy communications_select on public.communications for select
  using (
    business_id in (select public.my_business_ids())
    and (document_id is null or exists (select 1 from public.documents d where d.id = document_id))
    and (client_id is null or exists (select 1 from public.clients c where c.id = client_id))
  );

drop policy number_sequences_select on public.number_sequences;
create policy number_sequences_select on public.number_sequences for select
  using (business_id in (select public.my_business_ids()));

drop policy activity_select on public.activity_log;
create policy activity_select on public.activity_log for select
  using (business_id in (select public.my_business_ids()));

-- documents' own policy already limits the subquery to the caller's live documents.
drop policy items_select on public.document_items;
create policy items_select on public.document_items for select
  using (exists (select 1 from public.documents d where d.id = document_id));

-- Indexes for filters the pages use that had none.
create index if not exists payments_client on public.payments(client_id);
create index if not exists followups_client on public.followups(client_id, done, due_on);
create index if not exists documents_business_updated on public.documents(business_id, updated_at desc);
create index if not exists documents_converted_from on public.documents(converted_from_id) where converted_from_id is not null;
