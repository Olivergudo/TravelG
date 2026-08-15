-- Basic / Pro, Refrigerador y caché mínima de productos.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'basic' check (plan in ('basic', 'pro')),
  pro_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_user_profile_after_signup on auth.users;
create trigger create_user_profile_after_signup
after insert on auth.users for each row execute function public.create_user_profile();

alter table public.profiles enable row level security;
drop policy if exists "read_own_profile" on public.profiles;
create policy "read_own_profile" on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create table if not exists public.fridge_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  barcode text,
  name text not null,
  quantity numeric,
  unit text,
  custom_category text check (custom_category is null or custom_category in ('produce','meat','dairy','bakery','seasoning','drink','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists fridge_items_user_id_idx on public.fridge_items(user_id);
create unique index if not exists fridge_items_user_barcode_idx
on public.fridge_items(user_id, barcode) where barcode is not null;
alter table public.fridge_items enable row level security;
drop policy if exists "own_fridge_items" on public.fridge_items;
create policy "own_fridge_items" on public.fridge_items for all to authenticated
using (
  (select auth.uid()) = user_id and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.plan = 'pro'
      and (p.pro_expires_at is null or p.pro_expires_at > now())
  )
)
with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.plan = 'pro'
      and (p.pro_expires_at is null or p.pro_expires_at > now())
  )
);

create table if not exists public.products_cache (
  barcode text primary key,
  name text not null,
  brand text,
  quantity_text text,
  category text,
  source text not null check (source in ('open_food_facts', 'user')),
  updated_at timestamptz not null default now()
);

alter table public.products_cache enable row level security;
drop policy if exists "authenticated_read_product_cache" on public.products_cache;
create policy "authenticated_read_product_cache" on public.products_cache
for select to authenticated using (true);

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.fridge_items to authenticated;
grant select on public.products_cache to authenticated;

-- Cambia un usuario de prueba a Pro desde SQL Editor (no desde el frontend):
-- update public.profiles set plan = 'pro', pro_expires_at = null, updated_at = now()
-- where id = 'UUID_DEL_USUARIO';
