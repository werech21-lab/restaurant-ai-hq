-- Legacy bootstrap for the `products` table. It is kept so an old project can still run it, but it no longer opens any access.
--
-- The table is tenant owned and read-only for browsers since database/migrations/0009_products_tenant.sql. Run the files in
-- database/migrations in order; they add tenant_id, the row level security policy and the privileges. Do NOT add insert,
-- update or delete policies here: writes go through the server, which checks the user's permission inside their tenant.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'عام',
  price numeric(10, 3) not null check (price >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row level security on with no policy: nobody can read or write until migration 0009 adds the tenant scoped SELECT policy.
alter table public.products enable row level security;

-- These four policies used `using (true)` and let any signed-in user change any product. Dropping them is idempotent.
drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_delete_authenticated" on public.products;
