-- 0001_core: tenants, users' profiles, RBAC, audit, idempotency, sequences, shared functions and RLS helpers.
-- Authentication users live in Supabase's auth.users. Every tenant-scoped table below carries tenant_id.
-- Writes come from the server API over a direct connection (role postgres, which bypasses RLS).
-- Browsers talking to Supabase directly can only read rows of their own tenant. No insert/update/delete policy exists.

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function prevent_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Rows in % cannot be deleted', tg_table_name using errcode = 'restrict_violation';
end;
$$;

create or replace function prevent_update() returns trigger
language plpgsql as $$
begin
  raise exception 'Rows in % are immutable', tg_table_name using errcode = 'restrict_violation';
end;
$$;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 63),
  status text not null default 'active' check (status in ('active', 'suspended')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint tenants_slug_key unique (slug)
);
create trigger tenants_updated_at before update on tenants for each row execute function set_updated_at();

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint roles_tenant_name_key unique (tenant_id, name),
  constraint roles_tenant_id_key unique (tenant_id, id)
);
create trigger roles_updated_at before update on roles for each row execute function set_updated_at();

create table role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+\.[a-z_]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  primary key (role_id, permission),
  foreign key (tenant_id, role_id) references roles (tenant_id, id) on delete cascade
);
create index role_permissions_tenant_idx on role_permissions (tenant_id);
create trigger role_permissions_updated_at before update on role_permissions for each row execute function set_updated_at();

create table tenant_members (
  tenant_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, role_id) references roles (tenant_id, id)
);
create index tenant_members_user_idx on tenant_members (user_id);
create trigger tenant_members_updated_at before update on tenant_members for each row execute function set_updated_at();

-- Append-only audit trail. Exception to the tenant-table column rule: no updated_at, because rows never change.
create table audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references tenants (id),
  actor_id uuid not null references auth.users (id),
  entity text not null check (char_length(entity) between 1 and 80),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (tenant_id, entity, entity_id, created_at desc);
create index audit_log_actor_idx on audit_log (tenant_id, actor_id, created_at desc);
create trigger audit_log_no_update before update on audit_log for each row execute function prevent_update();
create trigger audit_log_no_delete before delete on audit_log for each row execute function prevent_delete();

create table idempotency_keys (
  tenant_id uuid not null references tenants (id),
  scope text not null check (char_length(scope) between 1 and 80),
  key text not null check (char_length(key) between 8 and 128),
  request_hash text not null,
  response_status smallint check (response_status in (200, 201)),
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, scope, key)
);
create index idempotency_keys_created_idx on idempotency_keys (created_at);

create table tenant_sequences (
  tenant_id uuid not null references tenants (id),
  name text not null check (char_length(name) between 1 and 80),
  last_value bigint not null check (last_value >= 1),
  primary key (tenant_id, name)
);

-- RLS helpers. security definer so policies can read tenant_members without recursion.
create or replace function auth_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_members where user_id = auth.uid()
$$;

create or replace function auth_has_permission(p_tenant uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from tenant_members m
    join role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid() and m.tenant_id = p_tenant and rp.permission = p_permission
  )
$$;

revoke all on function auth_tenant_ids() from public, anon;
revoke all on function auth_has_permission(uuid, text) from public, anon;
grant execute on function auth_tenant_ids() to authenticated;
grant execute on function auth_has_permission(uuid, text) to authenticated;

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table tenant_members enable row level security;
alter table audit_log enable row level security;
alter table idempotency_keys enable row level security;
alter table tenant_sequences enable row level security;

revoke all on tenants, profiles, roles, role_permissions, tenant_members, audit_log, idempotency_keys, tenant_sequences from anon, authenticated;
grant select on tenants, profiles, roles, role_permissions, tenant_members, audit_log to authenticated;

create policy tenants_select on tenants for select to authenticated
  using (id in (select auth_tenant_ids()));
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid());
create policy roles_select on roles for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy role_permissions_select on role_permissions for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy tenant_members_select on tenant_members for select to authenticated
  using (tenant_id in (select auth_tenant_ids()));
create policy audit_log_select on audit_log for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.invoice.read'));
