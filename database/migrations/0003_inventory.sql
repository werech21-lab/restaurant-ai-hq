-- 0003_inventory: warehouses, items and an append-only stock movement ledger.
-- Stock on hand is derived from movements (view stock_levels), never stored, so it cannot drift.
-- No API exists for inventory yet. This is the data model only.

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 200),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint warehouses_tenant_id_key unique (tenant_id, id),
  constraint warehouses_tenant_code_key unique (tenant_id, code)
);
create trigger warehouses_updated_at before update on warehouses for each row execute function set_updated_at();
create trigger warehouses_no_delete before delete on warehouses for each row execute function prevent_delete();

create table items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 200),
  unit text not null check (unit in ('piece', 'kg', 'g', 'l', 'ml', 'box')),
  unit_cost_minor bigint not null default 0 check (unit_cost_minor >= 0),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  reorder_level_milli bigint not null default 0 check (reorder_level_milli >= 0),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint items_tenant_id_key unique (tenant_id, id),
  constraint items_tenant_sku_key unique (tenant_id, sku)
);
create index items_tenant_name_idx on items (tenant_id, name, id);
create trigger items_updated_at before update on items for each row execute function set_updated_at();
create trigger items_no_delete before delete on items for each row execute function prevent_delete();

-- Quantities are integer thousandths of the item's unit (1500 = 1.500 kg) so stock math never uses floats.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  item_id uuid not null,
  warehouse_id uuid not null,
  kind text not null check (kind in ('receipt', 'issue', 'adjustment', 'transfer_in', 'transfer_out')),
  quantity_milli bigint not null check (quantity_milli <> 0),
  reference text check (reference is null or char_length(reference) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  foreign key (tenant_id, item_id) references items (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  constraint stock_movements_sign check (
    (kind in ('receipt', 'transfer_in') and quantity_milli > 0)
    or (kind in ('issue', 'transfer_out') and quantity_milli < 0)
    or kind = 'adjustment'
  )
);
create index stock_movements_item_idx on stock_movements (tenant_id, item_id, warehouse_id);
create index stock_movements_created_idx on stock_movements (tenant_id, created_at desc, id desc);
create trigger stock_movements_no_update before update on stock_movements for each row execute function prevent_update();
create trigger stock_movements_no_delete before delete on stock_movements for each row execute function prevent_delete();

create view stock_levels with (security_invoker = true) as
  select tenant_id, item_id, warehouse_id, sum(quantity_milli)::bigint as on_hand_milli
  from stock_movements
  group by tenant_id, item_id, warehouse_id;

alter table warehouses enable row level security;
alter table items enable row level security;
alter table stock_movements enable row level security;

revoke all on warehouses, items, stock_movements, stock_levels from anon, authenticated;
grant select on warehouses, items, stock_movements, stock_levels to authenticated;

create policy warehouses_select on warehouses for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.stock.read'));
create policy items_select on items for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.stock.read'));
create policy stock_movements_select on stock_movements for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.stock.read'));
