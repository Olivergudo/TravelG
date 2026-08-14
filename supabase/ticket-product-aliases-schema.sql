-- Memoria personal del clasificador de productos de ticket.
-- Ejecuta una vez en Supabase > SQL Editor.
create table if not exists public.ticket_product_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_name text not null,
  raw_name_normalized text not null,
  display_name text not null,
  classification text not null check (classification in ('food', 'non_food')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, raw_name_normalized)
);

create index if not exists ticket_product_aliases_user_idx
on public.ticket_product_aliases(user_id);

alter table public.ticket_product_aliases enable row level security;
drop policy if exists "own_ticket_product_aliases" on public.ticket_product_aliases;
create policy "own_ticket_product_aliases" on public.ticket_product_aliases
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.ticket_product_aliases to authenticated;
