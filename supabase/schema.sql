-- Ejecuta este archivo en Supabase > SQL Editor.
create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

create policy "Los usuarios leen sus propios datos"
on public.app_data for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Los usuarios crean sus propios datos"
on public.app_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Los usuarios actualizan sus propios datos"
on public.app_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
