-- Correcciones manuales y reglas aprendidas de categorías del Refrigerador.
-- Compatible con registros existentes: custom_category es nullable.
alter table public.fridge_items
add column if not exists custom_category text null
check (custom_category is null or custom_category in ('produce','meat','dairy','bakery','seasoning','drink','other'));

create table if not exists public.fridge_category_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_name text not null,
  category text not null check (category in ('produce','meat','dairy','bakery','seasoning','drink','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, normalized_name)
);

alter table public.fridge_category_rules enable row level security;
drop policy if exists "own_fridge_category_rules" on public.fridge_category_rules;
create policy "own_fridge_category_rules" on public.fridge_category_rules
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.fridge_category_rules to authenticated;
