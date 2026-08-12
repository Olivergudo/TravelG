-- Esquema normalizado de Gasto Listo.
-- Ejecuta TODO este archivo en Supabase > SQL Editor > New query.

create table if not exists public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null,
  icon text,
  position integer not null default 0,
  primary key (user_id, id)
);

alter table public.categories
  add column if not exists position integer not null default 0;

create table if not exists public.expenses (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  description text not null,
  amount numeric(14,2) not null,
  category_id text not null,
  date date not null,
  time time,
  source text,
  purchase_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.pending_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  normalized_name text not null,
  default_quantity numeric not null default 1,
  checked boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id)
);

alter table public.pending_products
  add column if not exists checked boolean not null default false;

create table if not exists public.purchases (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  supermarket_name text not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  total numeric(14,2) not null,
  source text,
  expense_id text,
  primary key (user_id, id)
);

create table if not exists public.purchase_items (
  user_id uuid not null,
  id text not null,
  purchase_id text not null,
  source_pending_product_id text,
  product_name text not null,
  raw_product_name text,
  normalized_name text not null,
  quantity numeric not null,
  unit_price numeric(14,2) not null,
  total_price numeric(14,2) not null,
  created_at timestamptz not null,
  primary key (user_id, id),
  foreign key (user_id, purchase_id)
    references public.purchases(user_id, id) on delete cascade
);

create table if not exists public.active_purchases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id text not null,
  started_at timestamptz not null
);

create table if not exists public.active_purchase_items (
  user_id uuid not null references public.active_purchases(user_id) on delete cascade,
  position integer not null,
  source_pending_product_id text,
  product_name text not null,
  quantity numeric not null,
  unit_price numeric(14,2) not null,
  added_during_shopping boolean not null,
  add_to_pending boolean not null,
  primary key (user_id, position)
);

alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.pending_products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.active_purchases enable row level security;
alter table public.active_purchase_items enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'categories', 'expenses', 'pending_products', 'purchases',
    'purchase_items', 'active_purchases', 'active_purchase_items'
  ] loop
    execute format('drop policy if exists "own_rows" on public.%I', table_name);
    execute format(
      'create policy "own_rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end $$;

create or replace function public.save_app_data(payload jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  active jsonb := payload->'activePurchase';
begin
  if uid is null then raise exception 'Authentication required'; end if;

  delete from active_purchase_items where user_id = uid;
  delete from active_purchases where user_id = uid;
  delete from purchase_items where user_id = uid;
  delete from purchases where user_id = uid;
  delete from expenses where user_id = uid;
  delete from pending_products where user_id = uid;
  delete from categories where user_id = uid;

  insert into categories (user_id, id, name, color, icon, position)
  select uid, c->>'id', coalesce(c->>'name', ''), coalesce(c->>'color', '#4f8f73'),
    coalesce(c->>'emoji', c->>'icon', '💸'), ordinality::integer
  from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb))
    with ordinality as x(c, ordinality);

  insert into expenses
    (user_id,id,description,amount,category_id,date,time,source,purchase_id,created_at,updated_at)
  select uid, e->>'id', e->>'description', (e->>'amount')::numeric,
    e->>'categoryId', (e->>'date')::date, nullif(e->>'time','')::time,
    e->>'source', e->>'purchaseId', (e->>'createdAt')::timestamptz,
    (e->>'updatedAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'expenses', '[]'::jsonb)) e;

  insert into pending_products
    (user_id,id,name,normalized_name,default_quantity,checked,created_at,updated_at)
  select uid, p->>'id', p->>'name', p->>'normalizedName',
    (p->>'defaultQuantity')::numeric, coalesce((p->>'checked')::boolean, false), (p->>'createdAt')::timestamptz,
    (p->>'updatedAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'pendingProducts', '[]'::jsonb)) p;

  insert into purchases
    (user_id,id,supermarket_name,started_at,completed_at,total,source,expense_id)
  select uid, p->>'id', p->>'supermarketName', (p->>'startedAt')::timestamptz,
    (p->>'completedAt')::timestamptz, (p->>'total')::numeric,
    p->>'source', p->>'expenseId'
  from jsonb_array_elements(coalesce(payload->'purchases', '[]'::jsonb)) p;

  insert into purchase_items
    (user_id,id,purchase_id,source_pending_product_id,product_name,raw_product_name,
     normalized_name,quantity,unit_price,total_price,created_at)
  select uid, i->>'id', p->>'id', i->>'sourcePendingProductId', i->>'productName',
    i->>'rawProductName', i->>'normalizedName', (i->>'quantity')::numeric,
    (i->>'unitPrice')::numeric, (i->>'totalPrice')::numeric,
    (i->>'createdAt')::timestamptz
  from jsonb_array_elements(coalesce(payload->'purchases', '[]'::jsonb)) p
  cross join lateral jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) i;

  if active is not null and active <> 'null'::jsonb then
    insert into active_purchases (user_id,id,started_at)
    values (uid, active->>'id', (active->>'startedAt')::timestamptz);

    insert into active_purchase_items
      (user_id,position,source_pending_product_id,product_name,quantity,unit_price,
       added_during_shopping,add_to_pending)
    select uid, ordinality::integer, i->>'sourcePendingProductId', i->>'productName',
      (i->>'quantity')::numeric, (i->>'unitPrice')::numeric,
      (i->>'addedDuringShopping')::boolean, (i->>'addToPending')::boolean
    from jsonb_array_elements(coalesce(active->'items', '[]'::jsonb))
      with ordinality as x(i, ordinality);
  end if;
end;
$$;

create or replace function public.load_app_data()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from categories where user_id = uid)
     and not exists (select 1 from expenses where user_id = uid)
     and not exists (select 1 from pending_products where user_id = uid)
     and not exists (select 1 from purchases where user_id = uid)
     and not exists (select 1 from active_purchases where user_id = uid) then
    return null;
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'categories', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',id,'name',name,'color',color,'icon',icon)) order by position, id)
      from categories where user_id=uid), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',id,'description',description,'amount',amount,'categoryId',category_id,
      'date',date,'time',time,'source',source,'purchaseId',purchase_id,
      'createdAt',created_at,'updatedAt',updated_at)) order by created_at)
      from expenses where user_id=uid), '[]'::jsonb),
    'pendingProducts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'name',name,'normalizedName',normalized_name,'defaultQuantity',default_quantity,'checked',checked,
      'createdAt',created_at,'updatedAt',updated_at) order by created_at)
      from pending_products where user_id=uid), '[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',p.id,'supermarketName',p.supermarket_name,'startedAt',p.started_at,
      'completedAt',p.completed_at,'total',p.total,'source',p.source,'expenseId',p.expense_id,
      'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id',i.id,'purchaseId',i.purchase_id,'sourcePendingProductId',i.source_pending_product_id,
        'productName',i.product_name,'rawProductName',i.raw_product_name,
        'normalizedName',i.normalized_name,'quantity',i.quantity,'unitPrice',i.unit_price,
        'totalPrice',i.total_price,'createdAt',i.created_at)) order by i.created_at)
        from purchase_items i where i.user_id=uid and i.purchase_id=p.id), '[]'::jsonb)
      )) order by p.completed_at) from purchases p where p.user_id=uid), '[]'::jsonb),
    'activePurchase', (select jsonb_build_object(
      'id',a.id,'startedAt',a.started_at,
      'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'sourcePendingProductId',i.source_pending_product_id,'productName',i.product_name,
        'quantity',i.quantity,'unitPrice',i.unit_price,'addedDuringShopping',i.added_during_shopping,
        'addToPending',i.add_to_pending)) order by i.position)
        from active_purchase_items i where i.user_id=uid), '[]'::jsonb))
      from active_purchases a where a.user_id=uid)
  ) into result;
  return jsonb_strip_nulls(result);
end;
$$;

revoke all on function public.save_app_data(jsonb) from public;
revoke all on function public.load_app_data() from public;
grant execute on function public.save_app_data(jsonb) to authenticated;
grant execute on function public.load_app_data() to authenticated;
