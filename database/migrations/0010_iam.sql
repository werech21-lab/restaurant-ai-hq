-- 0010_iam: user invitations and role management inside a tenant.
--
-- Nobody becomes an administrator by default:
--   * An invitation names the role explicitly. There is no default role.
--   * The server refuses to hand out a role holding permissions the inviter does not hold, and a role holding any `iam.*`
--     permission needs `iam.role.manage` on top.
--   * Only the tenant's owner role receives the new `iam.*` permissions, and only because it already holds every permission.
--   * Accepting an invitation needs a signed-in user whose confirmed email matches the invitation.
-- The invitation token is never stored. Only its SHA-256 hash is, and browsers cannot read even that column.
-- Browsers can only SELECT. Every write goes through the server.
--
-- Changes to existing data when this runs: `roles` gains `is_system` and `version` columns, the four built-in roles are flagged
-- as system roles, and each tenant's owner role gains the six `iam.*` permissions. No row is removed.

alter table roles add column if not exists is_system boolean not null default false;
alter table roles add column if not exists version integer not null default 1 check (version >= 1);
update roles set is_system = true where name in ('owner', 'accountant', 'approver', 'viewer');

create table tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  email text not null check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1),
  role_id uuid not null,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint tenant_invitations_token_key unique (token_hash),
  constraint tenant_invitations_tenant_id_key unique (tenant_id, id),
  constraint tenant_invitations_role_fk foreign key (tenant_id, role_id) references roles (tenant_id, id),
  constraint tenant_invitations_accepted_check check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null)),
  constraint tenant_invitations_revoked_check check ((status = 'revoked') = (revoked_at is not null)),
  constraint tenant_invitations_expiry_check check (expires_at > created_at)
);
-- One open invitation per email and tenant. Expired ones are revoked by the server before a new one is made.
create unique index tenant_invitations_pending_email_key on tenant_invitations (tenant_id, email) where status = 'pending';
create index tenant_invitations_tenant_idx on tenant_invitations (tenant_id, created_at desc, id desc);

create or replace function tenant_invitations_guard() returns trigger
language plpgsql as $$
begin
  if old.status <> 'pending' then
    raise exception 'A % invitation is final and cannot change', old.status using errcode = 'restrict_violation';
  end if;
  if new.tenant_id <> old.tenant_id or new.email <> old.email or new.role_id <> old.role_id
     or new.token_hash <> old.token_hash or new.created_by <> old.created_by then
    raise exception 'An invitation''s tenant, email, role and token cannot change' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function tenant_invitations_guard() from public, anon, authenticated;

create trigger tenant_invitations_guard before update on tenant_invitations for each row execute function tenant_invitations_guard();
create trigger tenant_invitations_updated_at before update on tenant_invitations for each row execute function set_updated_at();
create trigger tenant_invitations_no_delete before delete on tenant_invitations for each row execute function prevent_delete();

alter table tenant_invitations enable row level security;
revoke all on tenant_invitations from anon, authenticated;
-- token_hash is left out on purpose.
grant select (id, tenant_id, email, role_id, status, expires_at, accepted_by, accepted_at, revoked_at, version, created_at, updated_at, created_by)
  on tenant_invitations to authenticated;
create policy tenant_invitations_select on tenant_invitations for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'iam.member.read'));

-- ---- permissions ----
-- Only the owner role of each existing tenant receives them.
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join (values
  ('iam.member.read'), ('iam.member.invite'), ('iam.member.update'), ('iam.member.remove'), ('iam.role.read'), ('iam.role.manage')
) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

-- New tenants get the same. Replaces the function from 0008.
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

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  perform erp_seed_ai_rules(v_tenant, p_owner);

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
