-- 0011_org: brands and branches, plus the way new permissions reach tenant owners.
--
-- Structure only. A brand belongs to one tenant; a branch belongs to one brand. Nothing else in the system points at
-- them yet: no invoice, stock movement or member is scoped to a branch. Whether a member may be limited to a branch is a
-- decision that has not been made (docs/ERP_CORE_DESIGN.md section 11), so no existing query or policy changes.
--
-- Browsers can only SELECT, gated by permission. Every write goes through the server. Rows are never deleted: a brand or
-- branch is made inactive. An inactive brand cannot hold an active branch, and a branch cannot move to another brand.
--
-- erp_owner_extra_permissions() lists the permissions that were added after migration 0010 and belong to a new tenant's
-- owner role. Each later migration replaces it with the full list and backfills existing owners. The function is not
-- callable by browsers.
--
-- Changes to existing data when this runs: each tenant's owner role gains four org.* permissions. No row is removed.

create or replace function erp_owner_extra_permissions() returns text[]
language sql immutable as $$
  select array['org.brand.read', 'org.brand.manage', 'org.branch.read', 'org.branch.manage']
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

create table brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  code text not null check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint brands_tenant_id_key unique (tenant_id, id),
  constraint brands_tenant_code_key unique (tenant_id, code)
);
create index brands_tenant_name_idx on brands (tenant_id, name, id);

create table branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  brand_id uuid not null,
  code text not null check (code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 200),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint branches_tenant_id_key unique (tenant_id, id),
  constraint branches_tenant_code_key unique (tenant_id, code),
  constraint branches_brand_fk foreign key (tenant_id, brand_id) references brands (tenant_id, id)
);
create index branches_tenant_name_idx on branches (tenant_id, name, id);
create index branches_brand_idx on branches (tenant_id, brand_id);

create or replace function brands_guard() returns trigger
language plpgsql as $$
begin
  if new.tenant_id <> old.tenant_id or new.code <> old.code then
    raise exception 'The company and code of a brand cannot change' using errcode = 'restrict_violation';
  end if;
  if new.status = 'inactive' and old.status = 'active'
     and exists (select 1 from branches where tenant_id = new.tenant_id and brand_id = new.id and status = 'active') then
    raise exception 'A brand with active branches cannot be made inactive' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function brands_guard() from public, anon, authenticated;

create or replace function branches_guard() returns trigger
language plpgsql as $$
declare
  v_brand_status text;
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.code <> old.code or new.brand_id <> old.brand_id) then
    raise exception 'The company, brand and code of a branch cannot change' using errcode = 'restrict_violation';
  end if;
  if new.status = 'active' then
    -- The share lock makes a concurrent brand deactivation wait for this branch to commit, and vice versa.
    select status into v_brand_status from brands where tenant_id = new.tenant_id and id = new.brand_id for share;
    if v_brand_status is distinct from 'active' then
      raise exception 'An active branch needs an active brand' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function branches_guard() from public, anon, authenticated;

create trigger brands_guard before update on brands for each row execute function brands_guard();
create trigger brands_updated_at before update on brands for each row execute function set_updated_at();
create trigger brands_no_delete before delete on brands for each row execute function prevent_delete();
create trigger branches_guard before insert or update on branches for each row execute function branches_guard();
create trigger branches_updated_at before update on branches for each row execute function set_updated_at();
create trigger branches_no_delete before delete on branches for each row execute function prevent_delete();

alter table brands enable row level security;
alter table branches enable row level security;
revoke all on brands, branches from anon, authenticated;
grant select on brands, branches to authenticated;
create policy brands_select on brands for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'org.brand.read'));
create policy branches_select on branches for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'org.branch.read'));

-- Existing tenants: the owner role gains the org permissions (it already holds every permission).
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

-- New tenants. Replaces the function from 0010.
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

  insert into roles (tenant_id, name, description, is_system, created_by)
    values (v_tenant, 'owner', 'Full access', true, p_owner) returning id into v_owner_role;
  insert into roles (tenant_id, name, description, is_system, created_by)
    values (v_tenant, 'accountant', 'Prepares invoices and records payments', true, p_owner) returning id into v_accountant_role;
  insert into roles (tenant_id, name, description, is_system, created_by)
    values (v_tenant, 'approver', 'Approves and voids invoices', true, p_owner) returning id into v_approver_role;
  insert into roles (tenant_id, name, description, is_system, created_by)
    values (v_tenant, 'viewer', 'Read only', true, p_owner) returning id into v_viewer_role;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_owner_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.invoice.approve', 'finance.invoice.void', 'finance.payment.create',
    'crm.customer.read', 'crm.customer.create', 'crm.customer.update',
    'crm.lead.read', 'crm.lead.create', 'crm.lead.update',
    'crm.quotation.read', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.accept', 'crm.quotation.convert',
    'inventory.item.read', 'inventory.item.create', 'inventory.item.update',
    'inventory.warehouse.read', 'inventory.warehouse.create', 'inventory.warehouse.update',
    'inventory.stock.read', 'inventory.stock.adjust',
    'ai.insight.read', 'ai.insight.update', 'ai.scan.run', 'ai.action.read', 'ai.action.approve', 'ai.rule.read', 'ai.rule.update',
    'iam.member.read', 'iam.member.invite', 'iam.member.update', 'iam.member.remove', 'iam.role.read', 'iam.role.manage'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_accountant_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.payment.create', 'crm.customer.read', 'crm.customer.create', 'crm.customer.update',
    'crm.lead.read', 'crm.lead.create', 'crm.lead.update',
    'crm.quotation.read', 'crm.quotation.create', 'crm.quotation.update', 'crm.quotation.accept', 'crm.quotation.convert',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.insight.update', 'ai.scan.run', 'ai.action.read', 'ai.rule.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_approver_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.approve', 'finance.invoice.void', 'crm.customer.read',
    'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.action.read', 'ai.action.approve'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_viewer_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'crm.customer.read', 'crm.lead.read', 'crm.quotation.read',
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read',
    'ai.insight.read', 'ai.action.read'
  ]) as permission;

  -- Permissions added by later migrations. See erp_owner_extra_permissions().
  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_owner_role, permission, p_owner from unnest(erp_owner_extra_permissions()) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  perform erp_seed_ai_rules(v_tenant, p_owner);

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
