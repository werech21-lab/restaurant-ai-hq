-- 0009_products_tenant: the legacy `products` table becomes tenant owned and read-only for browsers.
--
-- Before: supabase/schema.sql gave every signed-in user insert, update and delete on every product (`using (true)`), and the
-- table had no tenant. Any user of any company could change any product.
--
-- After:
--   * Every product belongs to one tenant. Its tenant cannot be changed once set.
--   * Browsers (role `authenticated`) can only SELECT, and only products of a tenant they belong to whose role holds
--     `inventory.item.read`. Membership and permission come from tenant_members and role_permissions through the RLS
--     helpers, never from a value the client sends.
--   * All writes go through the server (inventory product service), which checks `inventory.item.create` and
--     `inventory.item.update`, scopes by the caller's tenant, checks the row version and writes the audit row.
--   * `anon` has no access.
--
-- Safe on a database that already holds products: the table is only altered, no row is changed or removed. Existing rows have
-- no tenant, so nobody can read them until an operator assigns them (see docs/PHASE_1_1_REPORT.md). The new constraint is
-- NOT VALID, so it applies to every new and updated row and leaves the old rows alone until they are assigned and the
-- constraint is validated.

-- Same definition as supabase/schema.sql, so a fresh database (or a test database) ends in the same shape as a live one.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'عام',
  price numeric(10, 3) not null check (price >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists tenant_id uuid references tenants (id);
alter table public.products add column if not exists created_by uuid references auth.users (id);
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists version integer not null default 1 check (version >= 1);

alter table public.products
  add constraint products_owner_required check (tenant_id is not null and created_by is not null) not valid;
alter table public.products
  add constraint products_name_length check (char_length(name) between 1 and 200) not valid;

create index if not exists products_tenant_idx on public.products (tenant_id, created_at desc);

create or replace function products_guard() returns trigger
language plpgsql as $$
begin
  if old.tenant_id is not null and new.tenant_id is distinct from old.tenant_id then
    raise exception 'The company of a product cannot be changed' using errcode = 'restrict_violation';
  end if;
  if old.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'The creator of a product cannot be changed' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function products_guard() from public, anon, authenticated;

create trigger products_guard before update on public.products for each row execute function products_guard();
create trigger products_updated_at before update on public.products for each row execute function set_updated_at();

-- ---- access ----
alter table public.products enable row level security;

drop policy if exists "products_select_authenticated" on public.products;
drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_delete_authenticated" on public.products;

revoke all on public.products from anon, authenticated;
grant select on public.products to authenticated;

create policy products_select on public.products for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));
