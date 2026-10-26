create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'عام',
  price numeric(10, 3) not null check (price >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_delete_authenticated" on public.products;

create policy "products_select_authenticated"
  on public.products for select
  to authenticated
  using (true);

create policy "products_insert_authenticated"
  on public.products for insert
  to authenticated
  with check (true);

create policy "products_update_authenticated"
  on public.products for update
  to authenticated
  using (true)
  with check (true);

create policy "products_delete_authenticated"
  on public.products for delete
  to authenticated
  using (true);
