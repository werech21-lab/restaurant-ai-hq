-- 0006_inventory_ops: working inventory on top of the data model from 0003, and its link to invoices.
--
-- Decisions (from the product owner):
--   * Quantities are whole numbers, the same unit as invoice line quantities.
--   * Stock is deducted when an invoice becomes issued; an issued, unpaid invoice that is voided returns it.
--   * Not enough stock blocks the invoice. Stock can never go below zero (enforced here, not only in code).
--   * Valuation is quantity on hand x the item's unit cost.
--
-- Stock is written only by inserting rows into stock_movements (an append-only ledger). A trigger keeps
-- stock_balances (per item and warehouse) and items.current_stock in step inside the same statement, so they cannot drift.

do $$
begin
  if exists (select 1 from stock_movements) then
    raise exception 'stock_movements already has rows (thousandths). Convert them by hand before running 0006.';
  end if;
end;
$$;

drop view stock_levels;
drop table stock_movements;

-- warehouses: location, capacity (units, informational), status.
alter table warehouses
  add column location text check (location is null or char_length(location) <= 200),
  add column capacity integer check (capacity is null or capacity between 0 and 100000000),
  add column status text not null default 'active' check (status in ('active', 'inactive'));
update warehouses set status = case when is_active then 'active' else 'inactive' end;
alter table warehouses drop column is_active;
create index warehouses_tenant_status_idx on warehouses (tenant_id, status, name);

-- items: whole-number reorder level, selling price, stock on hand (maintained by the trigger below).
alter table items drop constraint items_reorder_level_milli_check;
alter table items rename column reorder_level_milli to reorder_level;
alter table items alter column reorder_level type integer using (reorder_level / 1000)::integer;
alter table items add constraint items_reorder_level_check check (reorder_level between 0 and 100000000);
alter table items drop constraint items_unit_cost_minor_check;
alter table items add constraint items_unit_cost_minor_check check (unit_cost_minor between 0 and 1000000000);
alter table items
  add column selling_price_minor bigint not null default 0 check (selling_price_minor between 0 and 1000000000),
  add column current_stock integer not null default 0 check (current_stock between 0 and 100000000);
create index items_tenant_stock_idx on items (tenant_id, current_stock, id);
create index items_tenant_sku_idx on items (tenant_id, sku, id);
create index items_low_stock_idx on items (tenant_id, current_stock) where is_active and current_stock <= reorder_level;

-- The ledger. quantity is signed: IN is positive, OUT is negative. A transfer is two TRANSFER rows that share a
-- reference_id: negative at the source warehouse, positive at the destination.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  item_id uuid not null,
  warehouse_id uuid not null,
  movement_type text not null check (movement_type in ('IN', 'OUT', 'TRANSFER')),
  quantity integer not null check (quantity <> 0 and abs(quantity) <= 1000000),
  reference_type text not null default 'manual' check (reference_type in ('manual', 'invoice', 'transfer')),
  reference_id uuid,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  foreign key (tenant_id, item_id) references items (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  constraint stock_movements_sign check (
    (movement_type = 'IN' and quantity > 0) or (movement_type = 'OUT' and quantity < 0) or movement_type = 'TRANSFER'
  ),
  constraint stock_movements_reference check (
    (reference_type = 'manual' and reference_id is null)
    or (reference_type in ('invoice', 'transfer') and reference_id is not null)
  ),
  constraint stock_movements_transfer check ((movement_type = 'TRANSFER') = (reference_type = 'transfer'))
);
create index stock_movements_item_idx on stock_movements (tenant_id, item_id, created_at desc, id desc);
create index stock_movements_warehouse_idx on stock_movements (tenant_id, warehouse_id, created_at desc, id desc);
create index stock_movements_created_idx on stock_movements (tenant_id, created_at desc, id desc);
create index stock_movements_out_idx on stock_movements (tenant_id, created_at desc) where movement_type = 'OUT';
create index stock_movements_reference_idx on stock_movements (tenant_id, reference_type, reference_id);
-- An invoice deducts (OUT) and, on void, restores (IN) each item and warehouse at most once.
create unique index stock_movements_invoice_once on stock_movements (tenant_id, reference_id, item_id, warehouse_id, movement_type)
  where reference_type = 'invoice';
create trigger stock_movements_no_update before update on stock_movements for each row execute function prevent_update();
create trigger stock_movements_no_delete before delete on stock_movements for each row execute function prevent_delete();

create table stock_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  item_id uuid not null,
  warehouse_id uuid not null,
  on_hand integer not null check (on_hand between 0 and 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint stock_balances_unique unique (tenant_id, item_id, warehouse_id),
  foreign key (tenant_id, item_id) references items (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create index stock_balances_warehouse_idx on stock_balances (tenant_id, warehouse_id);
create trigger stock_balances_updated_at before update on stock_balances for each row execute function set_updated_at();
create trigger stock_balances_no_delete before delete on stock_balances for each row execute function prevent_delete();

create or replace function apply_stock_movement() returns trigger
language plpgsql as $$
begin
  -- Update first, insert only when the pair has no balance yet. An upsert would check the proposed row (a negative
  -- quantity for an OUT) before it looks for the conflict. A negative result violates stock_balances_on_hand_check,
  -- so stock can never go below zero. The service locks the item first, which serialises writers on the same pair.
  update stock_balances set on_hand = on_hand + new.quantity
  where tenant_id = new.tenant_id and item_id = new.item_id and warehouse_id = new.warehouse_id;
  if not found then
    insert into stock_balances (tenant_id, item_id, warehouse_id, on_hand, created_by)
    values (new.tenant_id, new.item_id, new.warehouse_id, new.quantity, new.created_by);
  end if;

  update items set current_stock = current_stock + new.quantity
  where tenant_id = new.tenant_id and id = new.item_id;
  return new;
end;
$$;
create trigger stock_movements_apply after insert on stock_movements for each row execute function apply_stock_movement();

-- Invoice lines may name the item they sell and the warehouse it leaves from. Both or neither.
alter table invoice_lines
  add column item_id uuid,
  add column warehouse_id uuid,
  add constraint invoice_lines_stock_pair check ((item_id is null) = (warehouse_id is null)),
  add constraint invoice_lines_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id),
  add constraint invoice_lines_warehouse_fk foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id);
create index invoice_lines_item_idx on invoice_lines (tenant_id, item_id) where item_id is not null;

-- RLS: read-only for the signed-in user, by permission. Writes go through the API.
alter table stock_movements enable row level security;
alter table stock_balances enable row level security;

revoke all on stock_movements, stock_balances from anon, authenticated;
grant select on stock_movements, stock_balances to authenticated;

drop policy items_select on items;
drop policy warehouses_select on warehouses;
create policy items_select on items for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));
create policy warehouses_select on warehouses for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.warehouse.read'));
create policy stock_movements_select on stock_movements for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.stock.read'));
create policy stock_balances_select on stock_balances for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.stock.read'));

-- Permissions for tenants that already exist. Owner gets all of them; the other seeded roles get read access.
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
join (values
  ('owner', 'inventory.item.read'), ('owner', 'inventory.item.create'), ('owner', 'inventory.item.update'),
  ('owner', 'inventory.warehouse.read'), ('owner', 'inventory.warehouse.create'), ('owner', 'inventory.warehouse.update'),
  ('owner', 'inventory.stock.read'), ('owner', 'inventory.stock.adjust'),
  ('accountant', 'inventory.item.read'), ('accountant', 'inventory.warehouse.read'), ('accountant', 'inventory.stock.read'),
  ('approver', 'inventory.item.read'), ('approver', 'inventory.warehouse.read'), ('approver', 'inventory.stock.read'),
  ('viewer', 'inventory.item.read'), ('viewer', 'inventory.warehouse.read'), ('viewer', 'inventory.stock.read')
) as p (role_name, permission) on p.role_name = r.name
on conflict (role_id, permission) do nothing;

-- New tenants get the same permissions. Replaces the function from 0005.
create or replace function erp_bootstrap_tenant(p_name text, p_slug text, p_owner uuid) returns uuid
language plpgsql as $$
declare
  v_tenant uuid;
  v_owner_role uuid;
  v_accountant_role uuid;
  v_approver_role uuid;
  v_viewer_role uuid;
begin
  insert into tenants (name, slug, created_by) values (p_name, p_slug, p_owner) returning id into v_tenant;

  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'owner', 'Full access', p_owner) returning id into v_owner_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'accountant', 'Prepares invoices and records payments', p_owner) returning id into v_accountant_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'approver', 'Approves and voids invoices', p_owner) returning id into v_approver_role;
  insert into roles (tenant_id, name, description, created_by)
    values (v_tenant, 'viewer', 'Read only', p_owner) returning id into v_viewer_role;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_owner_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.invoice.approve', 'finance.invoice.void', 'finance.payment.create',
    'crm.customer.read', 'crm.customer.create',
    'inventory.item.read', 'inventory.item.create', 'inventory.item.update',
    'inventory.warehouse.read', 'inventory.warehouse.create', 'inventory.warehouse.update',
    'inventory.stock.read', 'inventory.stock.adjust'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_accountant_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.payment.create', 'crm.customer.read', 'crm.customer.create',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_approver_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.approve', 'finance.invoice.void', 'crm.customer.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_viewer_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'crm.customer.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read'
  ]) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
