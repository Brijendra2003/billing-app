-- If the owner's auth user is deleted, their membership is deleted with it but the
-- business stays. Let the next signed-in user adopt a business that has no members,
-- instead of being locked out with "No access".
create or replace function public.bootstrap_business() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select business_id into v_id from public.members where user_id = auth.uid() limit 1;
  if v_id is not null then return v_id; end if;

  lock table public.businesses in exclusive mode;

  -- Adopt an orphaned business (no members at all).
  select b.id into v_id from public.businesses b
   where not exists (select 1 from public.members m where m.business_id = b.id)
   order by b.created_at
   limit 1;
  if v_id is not null then
    insert into public.members (business_id, user_id, role) values (v_id, auth.uid(), 'owner');
    return v_id;
  end if;

  -- Any other existing business belongs to someone else.
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
