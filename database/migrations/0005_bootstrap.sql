-- 0005_bootstrap: a function that creates a tenant with its default roles, permissions, finance settings and owner.
-- Run it from the Supabase SQL editor or psql as the database owner:
--   select erp_bootstrap_tenant('Aether Restaurants', 'aether', '<auth.users id of the owner>');
-- It is not callable through the Supabase API (execute is revoked below).
-- The role/permission matrix below is seed data. Change it per tenant in role_permissions.

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
    'crm.customer.read', 'crm.customer.create', 'inventory.stock.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_accountant_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.create', 'finance.invoice.update', 'finance.invoice.submit',
    'finance.payment.create', 'crm.customer.read', 'crm.customer.create'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_approver_role, permission, p_owner
  from unnest(array[
    'finance.invoice.read', 'finance.invoice.approve', 'finance.invoice.void', 'crm.customer.read'
  ]) as permission;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_viewer_role, permission, p_owner
  from unnest(array['finance.invoice.read', 'crm.customer.read', 'inventory.stock.read']) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);

  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);

  insert into profiles (id) values (p_owner) on conflict (id) do nothing;

  return v_tenant;
end;
$$;

revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;
