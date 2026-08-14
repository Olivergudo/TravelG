-- Roomies: hogares, chat, eventos, reposiciones y suscripciones Web Push.
-- Ejecuta TODO este archivo una vez en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.household_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'message', 'product_request', 'product_available', 'product_taken',
    'product_purchased', 'replacement_reported', 'replacement_confirmed',
    'replacement_rejected'
  )),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (message is null or char_length(message) <= 1000)
);

create table if not exists public.replacement_debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  debtor_user_id uuid not null references auth.users(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null check (char_length(trim(product_name)) between 1 and 100),
  status text not null default 'pending' check (status in ('pending', 'awaiting_confirmation', 'resolved')),
  created_at timestamptz not null default now(),
  replacement_reported_at timestamptz,
  resolved_at timestamptz,
  confirmed_by uuid references auth.users(id),
  check (debtor_user_id <> owner_user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists household_members_user_idx on public.household_members(user_id);
create index if not exists household_messages_household_created_idx on public.household_messages(household_id, created_at);
create index if not exists replacement_debts_household_status_idx on public.replacement_debts(household_id, status, created_at);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create or replace function public.is_household_member(target_household uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid()
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_messages enable row level security;
alter table public.replacement_debts enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "members_read_households" on public.households;
create policy "members_read_households" on public.households for select to authenticated
using (public.is_household_member(id));

drop policy if exists "members_read_members" on public.household_members;
create policy "members_read_members" on public.household_members for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members_read_messages" on public.household_messages;
create policy "members_read_messages" on public.household_messages for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members_send_messages" on public.household_messages;
create policy "members_send_messages" on public.household_messages for insert to authenticated
with check (
  user_id = auth.uid() and type = 'message' and public.is_household_member(household_id)
);

drop policy if exists "members_read_debts" on public.replacement_debts;
create policy "members_read_debts" on public.replacement_debts for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "own_push_subscriptions" on public.push_subscriptions;
create policy "own_push_subscriptions" on public.push_subscriptions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.current_roomie_name()
returns text language sql stable set search_path = public as $$
  select left(coalesce(
    nullif(trim(auth.jwt()->'user_metadata'->>'full_name'), ''),
    nullif(trim(auth.jwt()->'user_metadata'->>'name'), ''),
    split_part(coalesce(auth.jwt()->>'email', 'Roomie'), '@', 1),
    'Roomie'
  ), 50);
$$;

create or replace function public.create_household(household_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  code text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if char_length(trim(household_name)) not between 2 and 60 then raise exception 'Invalid household name'; end if;
  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, owner_id, invite_code)
  values (trim(household_name), uid, code) returning id into new_id;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (new_id, uid, public.current_roomie_name(), 'owner');
  return new_id;
end;
$$;

create or replace function public.join_household(invitation_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select id into target_id from public.households where invite_code = upper(trim(invitation_code));
  if target_id is null then raise exception 'Invalid invitation code'; end if;
  if exists (select 1 from public.household_members where household_id = target_id and user_id = uid) then
    raise exception 'Already a member';
  end if;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (target_id, uid, public.current_roomie_name(), 'member');
  return target_id;
end;
$$;

create or replace function public.create_roomie_event(target_household uuid, event_type text, payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  event_id uuid;
  debt_id uuid;
  owner_id uuid;
  target_id uuid;
  product text;
  should_replace boolean;
begin
  if uid is null or not public.is_household_member(target_household) then raise exception 'Access denied'; end if;
  product := left(trim(coalesce(payload->>'productName', '')), 100);
  if event_type in ('product_request', 'product_taken', 'product_purchased') and product = '' then raise exception 'Product required'; end if;

  if event_type = 'product_request' then
    insert into public.household_messages (household_id, user_id, type, metadata)
    values (target_household, uid, event_type, jsonb_build_object('productName', product)) returning id into event_id;

  elsif event_type = 'product_available' then
    if not exists (select 1 from public.household_messages where id = (payload->>'requestId')::uuid and household_id = target_household and type = 'product_request') then raise exception 'Invalid request'; end if;
    insert into public.household_messages (household_id, user_id, type, metadata)
    values (target_household, uid, event_type, jsonb_build_object('requestId', payload->>'requestId', 'productName', left(payload->>'productName', 100))) returning id into event_id;

  elsif event_type = 'product_taken' then
    owner_id := (payload->>'ownerUserId')::uuid;
    should_replace := coalesce((payload->>'needsReplacement')::boolean, false);
    if owner_id = uid or not exists (select 1 from public.household_members where household_id = target_household and user_id = owner_id) then raise exception 'Invalid owner'; end if;
    if should_replace then
      insert into public.replacement_debts (household_id, debtor_user_id, owner_user_id, product_name)
      values (target_household, uid, owner_id, product) returning id into debt_id;
    end if;
    insert into public.household_messages (household_id, user_id, type, metadata)
    values (target_household, uid, event_type, jsonb_strip_nulls(jsonb_build_object('ownerUserId', owner_id, 'productName', product, 'needsReplacement', should_replace, 'debtId', debt_id))) returning id into event_id;

  elsif event_type = 'product_purchased' then
    target_id := nullif(payload->>'targetUserId', '')::uuid;
    if target_id is not null and not exists (select 1 from public.household_members where household_id = target_household and user_id = target_id) then raise exception 'Invalid target'; end if;
    insert into public.household_messages (household_id, user_id, type, metadata)
    values (target_household, uid, event_type, jsonb_strip_nulls(jsonb_build_object('productName', product, 'target', payload->>'target', 'targetUserId', target_id))) returning id into event_id;
  else
    raise exception 'Invalid event type';
  end if;
  return event_id;
end;
$$;

create or replace function public.update_replacement_debt(debt_id uuid, operation text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  debt public.replacement_debts%rowtype;
  event_id uuid;
  event_type text;
begin
  select * into debt from public.replacement_debts where id = debt_id for update;
  if debt.id is null or not public.is_household_member(debt.household_id) then raise exception 'Access denied'; end if;
  if operation = 'report' then
    if uid <> debt.debtor_user_id or debt.status <> 'pending' then raise exception 'Only debtor can report'; end if;
    update public.replacement_debts set status = 'awaiting_confirmation', replacement_reported_at = now() where id = debt.id;
    event_type := 'replacement_reported';
  elsif operation = 'confirm' then
    if uid <> debt.owner_user_id or debt.status <> 'awaiting_confirmation' then raise exception 'Only owner can confirm'; end if;
    update public.replacement_debts set status = 'resolved', resolved_at = now(), confirmed_by = uid where id = debt.id;
    event_type := 'replacement_confirmed';
  elsif operation = 'reject' then
    if uid <> debt.owner_user_id or debt.status <> 'awaiting_confirmation' then raise exception 'Only owner can reject'; end if;
    update public.replacement_debts set status = 'pending', replacement_reported_at = null where id = debt.id;
    event_type := 'replacement_rejected';
  else
    raise exception 'Invalid operation';
  end if;
  insert into public.household_messages (household_id, user_id, type, metadata)
  values (debt.household_id, uid, event_type, jsonb_build_object('debtId', debt.id, 'productName', debt.product_name, 'debtorUserId', debt.debtor_user_id, 'ownerUserId', debt.owner_user_id))
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function public.leave_household(target_household uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  current_owner uuid;
  next_owner uuid;
begin
  if uid is null or not public.is_household_member(target_household) then raise exception 'Access denied'; end if;
  select owner_id into current_owner from public.households where id = target_household for update;
  if current_owner = uid then
    select user_id into next_owner
    from public.household_members
    where household_id = target_household and user_id <> uid
    order by joined_at, id
    limit 1;
    if next_owner is null then
      delete from public.households where id = target_household;
      return;
    end if;
    update public.households set owner_id = next_owner where id = target_household;
    update public.household_members set role = 'owner' where household_id = target_household and user_id = next_owner;
  end if;
  delete from public.household_members where household_id = target_household and user_id = uid;
end;
$$;

revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
revoke all on function public.create_roomie_event(uuid, text, jsonb) from public;
revoke all on function public.update_replacement_debt(uuid, text) from public;
revoke all on function public.leave_household(uuid) from public;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.create_roomie_event(uuid, text, jsonb) to authenticated;
grant execute on function public.update_replacement_debt(uuid, text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

grant select on public.households, public.household_members, public.household_messages, public.replacement_debts to authenticated;
grant insert on public.household_messages to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_messages') then
    alter publication supabase_realtime add table public.household_messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'replacement_debts') then
    alter publication supabase_realtime add table public.replacement_debts;
  end if;
end $$;
