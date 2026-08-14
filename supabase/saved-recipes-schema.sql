-- Recetas guardadas por el usuario. Ejecuta una vez en Supabase > SQL Editor.
create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  name text not null,
  description text not null,
  estimated_minutes integer,
  reason text not null default '',
  ingredients_used jsonb not null default '[]'::jsonb,
  extra_ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index if not exists saved_recipes_user_created_idx on public.saved_recipes(user_id, created_at desc);
alter table public.saved_recipes enable row level security;
drop policy if exists "own_saved_recipes" on public.saved_recipes;
create policy "own_saved_recipes" on public.saved_recipes for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.saved_recipes to authenticated;
