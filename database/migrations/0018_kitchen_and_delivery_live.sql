-- 0018_kitchen_and_delivery_live: recorded recipes, waste and delivery orders.
--
-- These rows are operational notes for the command center. They do not move stock and they do not post a journal.
-- A commission is the amount written on the order. No commission percentage is calculated here, and nothing is sent to the ledger.
-- Browsers can only read rows of their own company. Writes stay on the server.

create table recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  name text not null check (char_length(name) between 1 and 200),
  yield_quantity integer not null check (yield_quantity between 1 and 1000000),
  notes text check (notes is null or char_length(notes) <= 1000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint recipes_tenant_id_key unique (tenant_id, id),
  constraint recipes_tenant_name_key unique (tenant_id, name)
);
create trigger recipes_updated_at before update on recipes for each row execute function set_updated_at();
create trigger recipes_no_delete before delete on recipes for each row execute function prevent_delete();

create table recipe_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  recipe_id uuid not null,
  item_id uuid not null,
  quantity integer not null check (quantity between 1 and 1000000),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint recipe_lines_recipe_fk foreign key (tenant_id, recipe_id) references recipes (tenant_id, id),
  constraint recipe_lines_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id)
);
create trigger recipe_lines_no_update before update on recipe_lines for each row execute function prevent_update();
create trigger recipe_lines_no_delete before delete on recipe_lines for each row execute function prevent_delete();

create table kitchen_waste (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  item_id uuid not null,
  quantity integer not null check (quantity between 1 and 1000000),
  wasted_on date not null,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint kitchen_waste_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id)
);
create trigger kitchen_waste_no_update before update on kitchen_waste for each row execute function prevent_update();
create trigger kitchen_waste_no_delete before delete on kitchen_waste for each row execute function prevent_delete();

create table delivery_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 200),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint delivery_partners_tenant_id_key unique (tenant_id, id),
  constraint delivery_partners_tenant_code_key unique (tenant_id, code)
);
create trigger delivery_partners_updated_at before update on delivery_partners for each row execute function set_updated_at();
create trigger delivery_partners_no_delete before delete on delivery_partners for each row execute function prevent_delete();

create table delivery_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  partner_id uuid not null,
  ordered_on date not null,
  gross_minor bigint not null check (gross_minor between 0 and 1000000000000),
  commission_minor bigint not null check (commission_minor between 0 and 1000000000000),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  status text not null check (status in ('recorded', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint delivery_orders_partner_fk foreign key (tenant_id, partner_id) references delivery_partners (tenant_id, id),
  constraint delivery_orders_commission check (commission_minor <= gross_minor)
);
create trigger delivery_orders_no_update before update on delivery_orders for each row execute function prevent_update();
create trigger delivery_orders_no_delete before delete on delivery_orders for each row execute function prevent_delete();

alter table recipes enable row level security;
alter table recipe_lines enable row level security;
alter table kitchen_waste enable row level security;
alter table delivery_partners enable row level security;
alter table delivery_orders enable row level security;

revoke all on recipes, recipe_lines, kitchen_waste, delivery_partners, delivery_orders from anon, authenticated;
grant select on recipes, recipe_lines, kitchen_waste, delivery_partners, delivery_orders to authenticated;

create policy recipes_select on recipes for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy recipe_lines_select on recipe_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy kitchen_waste_select on kitchen_waste for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy delivery_partners_select on delivery_partners for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy delivery_orders_select on delivery_orders for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
