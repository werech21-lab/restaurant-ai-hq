-- 0013_procurement: suppliers, purchase orders, goods receipts and the approval threshold setting.
--
-- Flow: draft -> pending_approval -> approved -> partially_received -> received, and cancelled. A purchase REQUEST is a draft
-- purchase order: there is no separate request table, because nothing in the brief says it needs different data or rules.
-- Whether an order needs approval is decided by procurement_settings.approval_threshold_minor. It is NULL by default, which
-- means no order needs approval. Nobody has decided a purchasing limit, so none is invented here.
--
-- What the database enforces:
--   * An order's header and lines can change only while it is a draft. After that only the status moves, along the allowed
--     transitions, and received quantities go up.
--   * A goods receipt and its lines are append-only. Inserting a receipt line raises the order line's received quantity (which can
--     never pass the ordered quantity) and moves the order to partially_received or received. Nobody has to remember to do it.
--   * A receipt can only be made against an approved or partially received order, and a line must belong to that order and item.
--   * Only an active supplier can be ordered from. Suppliers are never deleted: they are blocked.
-- Stock reaches the warehouse through the inventory module only (an IN movement referenced to the receipt). This migration adds
-- the 'purchase_receipt' reference type for it. It does not change item unit costs: how received cost becomes stock value (FIFO,
-- average) is an open decision.
--
-- Currency is KWD only. Money is whole fils. Tax per line in basis points, summed unrounded and rounded half up once per order,
-- by the same function the invoices use.
--
-- NOT built, because it needs decisions: supplier invoices and three-way matching, supplier payments, accounts payable posting
-- to the ledger, returns to supplier. See docs/ERP_CORE_DESIGN.md.
--
-- Changes to existing data when this runs: each tenant's owner role gains the procurement permissions. No row is removed.

create or replace function erp_owner_extra_permissions() returns text[]
language sql immutable as $$
  select array[
    'org.brand.read', 'org.brand.manage', 'org.branch.read', 'org.branch.manage',
    'finance.account.read', 'finance.account.manage', 'finance.journal.read', 'finance.journal.create',
    'finance.journal.post', 'finance.journal.reverse', 'finance.period.manage',
    'procurement.supplier.read', 'procurement.supplier.manage', 'procurement.order.read', 'procurement.order.create',
    'procurement.order.update', 'procurement.order.submit', 'procurement.order.approve', 'procurement.order.cancel',
    'procurement.receipt.read', 'procurement.receipt.create', 'procurement.settings.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

-- ---- inventory ledger: a receipt is traceable to the movement it caused ----
alter table stock_movements drop constraint stock_movements_reference;
alter table stock_movements drop constraint stock_movements_reference_type_check;
alter table stock_movements add constraint stock_movements_reference_type_check
  check (reference_type in ('manual', 'invoice', 'transfer', 'restock', 'purchase_receipt'));
alter table stock_movements add constraint stock_movements_reference check (
  (reference_type = 'manual' and reference_id is null)
  or (reference_type in ('invoice', 'transfer', 'restock', 'purchase_receipt') and reference_id is not null)
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'blocked')),
  payment_terms_days integer not null default 30 check (payment_terms_days between 0 and 365),
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint suppliers_tenant_id_key unique (tenant_id, id),
  constraint suppliers_tenant_code_key unique (tenant_id, code)
);
create index suppliers_name_idx on suppliers (tenant_id, name, id);

create table procurement_settings (
  tenant_id uuid primary key references tenants (id),
  approval_threshold_minor bigint check (approval_threshold_minor is null or approval_threshold_minor >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  supplier_id uuid not null,
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'partially_received', 'received', 'cancelled')),
  order_date date not null,
  expected_date date,
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0 and total_minor <= 1000000000000),
  notes text check (notes is null or char_length(notes) <= 2000),
  approval_required boolean,
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id),
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  cancelled_reason text check (cancelled_reason is null or char_length(cancelled_reason) between 1 and 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_orders_tenant_id_key unique (tenant_id, id),
  constraint purchase_orders_tenant_number_key unique (tenant_id, number),
  constraint purchase_orders_supplier_fk foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  constraint purchase_orders_total check (subtotal_minor + tax_minor = total_minor),
  constraint purchase_orders_expected check (expected_date is null or expected_date >= order_date),
  constraint purchase_orders_submitted check (status in ('draft', 'cancelled') or (submitted_at is not null and submitted_by is not null)),
  constraint purchase_orders_approved check (status not in ('approved', 'partially_received', 'received') or approved_at is not null),
  constraint purchase_orders_approver check (
    status not in ('approved', 'partially_received', 'received') or approval_required is not true or approved_by is not null
  ),
  constraint purchase_orders_cancelled check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and cancelled_reason is not null))
);
create index purchase_orders_number_idx on purchase_orders (tenant_id, number desc, id desc);
create index purchase_orders_supplier_idx on purchase_orders (tenant_id, supplier_id, status);

create table purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  order_id uuid not null,
  line_no integer not null check (line_no >= 1),
  item_id uuid not null,
  description text not null check (char_length(description) between 1 and 300),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_cost_minor bigint not null check (unit_cost_minor between 0 and 1000000000),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  received_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_order_lines_order_line_key unique (order_id, line_no),
  constraint purchase_order_lines_received check (received_quantity between 0 and quantity),
  constraint purchase_order_lines_order_fk foreign key (tenant_id, order_id) references purchase_orders (tenant_id, id),
  constraint purchase_order_lines_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id),
  constraint purchase_order_lines_ref_key unique (tenant_id, id, order_id),
  constraint purchase_order_lines_item_ref_key unique (tenant_id, id, item_id)
);
create index purchase_order_lines_order_idx on purchase_order_lines (tenant_id, order_id, line_no);

create table goods_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  order_id uuid not null,
  warehouse_id uuid not null,
  receipt_date date not null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint goods_receipts_tenant_id_key unique (tenant_id, id),
  constraint goods_receipts_ref_key unique (tenant_id, id, order_id),
  constraint goods_receipts_tenant_number_key unique (tenant_id, number),
  constraint goods_receipts_order_fk foreign key (tenant_id, order_id) references purchase_orders (tenant_id, id),
  constraint goods_receipts_warehouse_fk foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create index goods_receipts_order_idx on goods_receipts (tenant_id, order_id, created_at);
create index goods_receipts_number_idx on goods_receipts (tenant_id, number desc, id desc);

create table goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  receipt_id uuid not null,
  order_id uuid not null,
  order_line_id uuid not null,
  item_id uuid not null,
  line_no integer not null check (line_no >= 1),
  quantity integer not null check (quantity between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint goods_receipt_lines_line_key unique (receipt_id, line_no),
  constraint goods_receipt_lines_order_line_once unique (receipt_id, order_line_id),
  constraint goods_receipt_lines_receipt_fk foreign key (tenant_id, receipt_id, order_id) references goods_receipts (tenant_id, id, order_id),
  constraint goods_receipt_lines_order_line_fk foreign key (tenant_id, order_line_id, order_id) references purchase_order_lines (tenant_id, id, order_id),
  constraint goods_receipt_lines_item_fk foreign key (tenant_id, order_line_id, item_id) references purchase_order_lines (tenant_id, id, item_id)
);
create index goods_receipt_lines_receipt_idx on goods_receipt_lines (tenant_id, receipt_id, line_no);

-- ---- guards ----

create or replace function suppliers_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.code <> old.code) then
    raise exception 'The company and code of a supplier cannot change' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function suppliers_guard() from public, anon, authenticated;

create or replace function purchase_orders_guard() returns trigger
language plpgsql as $$
declare
  v_supplier_status text;
  v_lines integer;
  v_unreceived integer;
  v_received integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A purchase order starts as a draft' using errcode = 'restrict_violation';
    end if;
    select status into v_supplier_status from suppliers where tenant_id = new.tenant_id and id = new.supplier_id;
    if v_supplier_status is distinct from 'active' then
      raise exception 'Only an active supplier can be ordered from' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.supplier_id <> old.supplier_id
     or new.supplier_name <> old.supplier_name or new.created_by <> old.created_by then
    raise exception 'The company, number, supplier and creator of a purchase order cannot change' using errcode = 'restrict_violation';
  end if;

  if old.status <> new.status then
    if not (
      (old.status = 'draft' and new.status in ('pending_approval', 'approved', 'cancelled'))
      or (old.status = 'pending_approval' and new.status in ('approved', 'cancelled'))
      or (old.status = 'approved' and new.status in ('partially_received', 'received', 'cancelled'))
      or (old.status = 'partially_received' and new.status = 'received')
    ) then
      raise exception 'A purchase order cannot go from % to %', old.status, new.status using errcode = 'restrict_violation';
    end if;
    if new.status = 'cancelled' and old.status = 'approved' and exists (
      select 1 from goods_receipts where tenant_id = old.tenant_id and order_id = old.id
    ) then
      raise exception 'An order that has receipts cannot be cancelled' using errcode = 'restrict_violation';
    end if;
    if new.status in ('pending_approval', 'approved') and old.status = 'draft' then
      select count(*) into v_lines from purchase_order_lines where tenant_id = new.tenant_id and order_id = new.id;
      if v_lines = 0 then
        raise exception 'A purchase order needs at least one line' using errcode = 'restrict_violation';
      end if;
    end if;
    if new.status in ('partially_received', 'received') then
      select count(*) filter (where received_quantity < quantity), count(*) filter (where received_quantity > 0)
        into v_unreceived, v_received
        from purchase_order_lines where tenant_id = new.tenant_id and order_id = new.id;
      if new.status = 'received' and v_unreceived > 0 then
        raise exception 'Not every line is fully received' using errcode = 'restrict_violation';
      end if;
      if new.status = 'partially_received' and (v_received = 0 or v_unreceived = 0) then
        raise exception 'The received quantities do not match a partial receipt' using errcode = 'restrict_violation';
      end if;
    end if;
  end if;

  if old.status <> 'draft' and (
    new.order_date <> old.order_date or new.expected_date is distinct from old.expected_date or new.currency <> old.currency
    or new.subtotal_minor <> old.subtotal_minor or new.tax_minor <> old.tax_minor or new.total_minor <> old.total_minor
    or new.notes is distinct from old.notes
  ) then
    raise exception 'Only a draft purchase order can be edited' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function purchase_orders_guard() from public, anon, authenticated;

create or replace function purchase_order_lines_guard() returns trigger
language plpgsql as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_status text;
  v_item_active boolean;
begin
  select status into v_status from purchase_orders where tenant_id = v_tenant and id = v_order for share;
  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id or new.order_id <> old.order_id or new.line_no <> old.line_no or new.item_id <> old.item_id
       or new.description <> old.description or new.quantity <> old.quantity or new.unit_cost_minor <> old.unit_cost_minor
       or new.tax_rate_bps <> old.tax_rate_bps then
      if v_status is distinct from 'draft' then
        raise exception 'Only the lines of a draft purchase order can be edited' using errcode = 'restrict_violation';
      end if;
    end if;
    if new.received_quantity < old.received_quantity then
      raise exception 'A received quantity cannot go down' using errcode = 'restrict_violation';
    end if;
    if new.received_quantity <> old.received_quantity and v_status not in ('approved', 'partially_received') then
      raise exception 'Goods can only be received against an approved order' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'Only the lines of a draft purchase order can be edited' using errcode = 'restrict_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.received_quantity <> 0 then
      raise exception 'A new line has nothing received' using errcode = 'restrict_violation';
    end if;
    select is_active into v_item_active from items where tenant_id = new.tenant_id and id = new.item_id;
    if not coalesce(v_item_active, false) then
      raise exception 'An inactive item cannot be ordered' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function purchase_order_lines_guard() from public, anon, authenticated;

create or replace function goods_receipts_guard() returns trigger
language plpgsql as $$
declare
  v_status text;
begin
  select status into v_status from purchase_orders where tenant_id = new.tenant_id and id = new.order_id for share;
  if v_status not in ('approved', 'partially_received') then
    raise exception 'Goods can only be received against an approved order' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function goods_receipts_guard() from public, anon, authenticated;

-- Receiving raises the order line's received quantity and moves the order along. It is the only way either changes.
create or replace function goods_receipt_lines_apply() returns trigger
language plpgsql as $$
declare
  v_open integer;
  v_any integer;
  v_status text;
begin
  update purchase_order_lines
    set received_quantity = received_quantity + new.quantity
    where tenant_id = new.tenant_id and id = new.order_line_id;
  select count(*) filter (where received_quantity < quantity), count(*) filter (where received_quantity > 0)
    into v_open, v_any
    from purchase_order_lines where tenant_id = new.tenant_id and order_id = new.order_id;
  v_status := case when v_open = 0 then 'received' else 'partially_received' end;
  update purchase_orders set status = v_status
    where tenant_id = new.tenant_id and id = new.order_id and status <> v_status;
  return new;
end;
$$;
revoke all on function goods_receipt_lines_apply() from public, anon, authenticated;

create trigger suppliers_guard before insert or update on suppliers for each row execute function suppliers_guard();
create trigger suppliers_updated_at before update on suppliers for each row execute function set_updated_at();
create trigger suppliers_no_delete before delete on suppliers for each row execute function prevent_delete();

create trigger procurement_settings_updated_at before update on procurement_settings for each row execute function set_updated_at();
create trigger procurement_settings_no_delete before delete on procurement_settings for each row execute function prevent_delete();

create trigger purchase_orders_guard before insert or update on purchase_orders for each row execute function purchase_orders_guard();
create trigger purchase_orders_updated_at before update on purchase_orders for each row execute function set_updated_at();
create trigger purchase_orders_no_delete before delete on purchase_orders for each row execute function prevent_delete();

create trigger purchase_order_lines_guard before insert or update or delete on purchase_order_lines for each row execute function purchase_order_lines_guard();
create trigger purchase_order_lines_updated_at before update on purchase_order_lines for each row execute function set_updated_at();

create trigger goods_receipts_guard before insert on goods_receipts for each row execute function goods_receipts_guard();
create trigger goods_receipts_no_update before update on goods_receipts for each row execute function prevent_update();
create trigger goods_receipts_no_delete before delete on goods_receipts for each row execute function prevent_delete();

create trigger goods_receipt_lines_apply after insert on goods_receipt_lines for each row execute function goods_receipt_lines_apply();
create trigger goods_receipt_lines_no_update before update on goods_receipt_lines for each row execute function prevent_update();
create trigger goods_receipt_lines_no_delete before delete on goods_receipt_lines for each row execute function prevent_delete();

-- ---- access ----
alter table suppliers enable row level security;
alter table procurement_settings enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;
alter table goods_receipts enable row level security;
alter table goods_receipt_lines enable row level security;
revoke all on suppliers, procurement_settings, purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines from anon, authenticated;
grant select on suppliers, procurement_settings, purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines to authenticated;

create policy suppliers_select on suppliers for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.supplier.read'));
create policy procurement_settings_select on procurement_settings for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.order.read'));
create policy purchase_orders_select on purchase_orders for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.order.read'));
create policy purchase_order_lines_select on purchase_order_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.order.read'));
create policy goods_receipts_select on goods_receipts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.receipt.read'));
create policy goods_receipt_lines_select on goods_receipt_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.receipt.read'));

-- Existing tenants: the owner role gains the new permissions.
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;
