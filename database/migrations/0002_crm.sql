-- 0002_crm: customers, contacts, deals. Child tables use composite foreign keys (tenant_id, id)
-- so a row can never reference a parent that belongs to another tenant.

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  name text not null check (char_length(name) between 1 and 200),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  phone text check (phone is null or char_length(phone) between 3 and 32),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text check (notes is null or char_length(notes) <= 2000),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint customers_tenant_id_key unique (tenant_id, id)
);
create unique index customers_tenant_email_key on customers (tenant_id, lower(email)) where email is not null;
create index customers_tenant_name_idx on customers (tenant_id, name, id);
create index customers_tenant_created_idx on customers (tenant_id, created_at desc, id desc);
create trigger customers_updated_at before update on customers for each row execute function set_updated_at();
create trigger customers_no_delete before delete on customers for each row execute function prevent_delete();

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  customer_id uuid not null,
  name text not null check (char_length(name) between 1 and 200),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+$')),
  phone text check (phone is null or char_length(phone) between 3 and 32),
  job_title text check (job_title is null or char_length(job_title) <= 120),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint contacts_tenant_id_key unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id)
);
create index contacts_customer_idx on contacts (tenant_id, customer_id);
create trigger contacts_updated_at before update on contacts for each row execute function set_updated_at();

create table deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  customer_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  stage text not null default 'lead' check (stage in ('lead', 'qualified', 'proposal', 'won', 'lost')),
  value_minor bigint not null default 0 check (value_minor >= 0),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  expected_close_date date,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint deals_tenant_id_key unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id)
);
create index deals_customer_idx on deals (tenant_id, customer_id);
create index deals_stage_idx on deals (tenant_id, stage, created_at desc);
create trigger deals_updated_at before update on deals for each row execute function set_updated_at();

alter table customers enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;

revoke all on customers, contacts, deals from anon, authenticated;
grant select on customers, contacts, deals to authenticated;

create policy customers_select on customers for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.customer.read'));
create policy contacts_select on contacts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.customer.read'));
create policy deals_select on deals for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'crm.customer.read'));
