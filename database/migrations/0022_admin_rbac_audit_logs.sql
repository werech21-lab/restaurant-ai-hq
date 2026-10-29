-- 0022_admin_rbac_audit_logs: member status, granular flags, and the security activity log.
--
-- Existing role permissions stay the source of access. A flag set to false removes that one ability
-- from the member. A missing flag changes nothing, so current members keep the access they already have.
-- Suspended, revoked and deleted members lose tenant access immediately.
-- The activity log is append-only. Owner and admin are the only roles that can read it.

alter table tenant_members
  add column status text not null default 'active' check (status in ('active', 'suspended', 'revoked', 'deleted')),
  add column branch_scope uuid,
  add column permission_flags jsonb not null default '{}'::jsonb,
  add column version integer not null default 1 check (version >= 1);

alter table tenant_members
  add constraint tenant_members_flags_object check (jsonb_typeof(permission_flags) = 'object'),
  add constraint tenant_members_branch_fk foreign key (tenant_id, branch_scope) references branches (tenant_id, id);

create or replace function auth_tenant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_members where user_id = auth.uid() and status = 'active'
$$;

create or replace function auth_has_permission(p_tenant uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from tenant_members m
    join role_permissions rp on rp.role_id = m.role_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant
      and m.status = 'active'
      and rp.permission = p_permission
      and not (
        (p_permission = 'finance.journal.post' and m.permission_flags->>'can_post_journal' = 'false')
        or (p_permission in ('procurement.order.approve', 'procurement.request.approve') and m.permission_flags->>'can_approve_po' = 'false')
        or (p_permission = 'finance.invoice.approve' and m.permission_flags->>'can_approve_invoice' = 'false')
        or (p_permission = 'ai.action.approve' and m.permission_flags->>'can_execute_ai' = 'false')
        or (p_permission like 'iam.%' and m.permission_flags->>'can_manage_users' = 'false')
        or (p_permission in (
          'inventory.stock.adjust', 'inventory.item.create', 'inventory.item.update',
          'inventory.warehouse.create', 'inventory.warehouse.update'
        ) and m.permission_flags->>'can_manage_inventory' = 'false')
      )
  )
$$;

revoke all on function auth_tenant_ids() from public, anon;
revoke all on function auth_has_permission(uuid, text) from public, anon;
grant execute on function auth_tenant_ids() to authenticated;
grant execute on function auth_has_permission(uuid, text) to authenticated;

create table audit_activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  actor_id uuid not null references auth.users (id),
  actor_name text not null check (char_length(actor_name) between 1 and 200),
  actor_role text not null check (char_length(actor_role) between 1 and 80),
  action_type text not null check (char_length(action_type) between 1 and 80),
  module text not null check (module in ('finance', 'inventory', 'procurement', 'sales', 'kitchen', 'delivery', 'ai', 'admin')),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid not null,
  description_ar text not null check (char_length(description_ar) between 1 and 500),
  metadata_json jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint audit_activity_logs_metadata_object check (jsonb_typeof(metadata_json) = 'object')
);
create index audit_activity_logs_recent_idx on audit_activity_logs (tenant_id, created_at desc);
create index audit_activity_logs_module_idx on audit_activity_logs (tenant_id, module);
create trigger audit_activity_logs_no_update before update on audit_activity_logs for each row execute function prevent_update();
create trigger audit_activity_logs_no_delete before delete on audit_activity_logs for each row execute function prevent_delete();

create table tenant_security_settings (
  tenant_id uuid primary key references tenants (id),
  session_minutes integer not null default 120 check (session_minutes between 15 and 720),
  books_locked boolean not null default false,
  plan_code text not null default 'enterprise' check (plan_code in ('enterprise', 'staging')),
  plan_name_ar text not null default 'مؤسسي',
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);
create trigger tenant_security_settings_updated_at before update on tenant_security_settings for each row execute function set_updated_at();

create or replace function erp_seed_admin_roles(p_tenant uuid, p_actor uuid) returns void
language plpgsql as $$
declare
  v_admin uuid;
  v_manager uuid;
  v_operations uuid;
begin
  insert into roles (tenant_id, name, description, is_system, created_by)
  values (p_tenant, 'admin', 'Manages accounts and security', true, p_actor)
  on conflict (tenant_id, name) do nothing;
  insert into roles (tenant_id, name, description, is_system, created_by)
  values (p_tenant, 'manager', 'Approves purchases and reads the branch', true, p_actor)
  on conflict (tenant_id, name) do nothing;
  insert into roles (tenant_id, name, description, is_system, created_by)
  values (p_tenant, 'operations', 'Runs stock and the kitchen floor', true, p_actor)
  on conflict (tenant_id, name) do nothing;

  select id into v_admin from roles where tenant_id = p_tenant and name = 'admin';
  select id into v_manager from roles where tenant_id = p_tenant and name = 'manager';
  select id into v_operations from roles where tenant_id = p_tenant and name = 'operations';

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select p_tenant, v_admin, permission, p_actor
  from unnest(array[
    'iam.member.read', 'iam.member.invite', 'iam.member.update', 'iam.member.remove', 'iam.role.read', 'iam.role.manage',
    'finance.invoice.read', 'finance.journal.read', 'ai.action.read', 'org.branch.read'
  ]) as permission
  on conflict (role_id, permission) do nothing;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select p_tenant, v_manager, permission, p_actor
  from unnest(array[
    'finance.invoice.read', 'procurement.order.read', 'procurement.order.approve', 'procurement.request.approve',
    'inventory.item.read', 'inventory.stock.read', 'org.branch.read'
  ]) as permission
  on conflict (role_id, permission) do nothing;

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select p_tenant, v_operations, permission, p_actor
  from unnest(array[
    'inventory.item.read', 'inventory.warehouse.read', 'inventory.stock.read', 'inventory.stock.adjust'
  ]) as permission
  on conflict (role_id, permission) do nothing;

  insert into tenant_security_settings (tenant_id, created_by)
  values (p_tenant, p_actor)
  on conflict (tenant_id) do nothing;
end;
$$;
revoke all on function erp_seed_admin_roles(uuid, uuid) from public, anon, authenticated;

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

  insert into role_permissions (tenant_id, role_id, permission, created_by)
  select v_tenant, v_owner_role, permission, p_owner from unnest(erp_owner_extra_permissions()) as permission;

  insert into finance_settings (tenant_id, created_by) values (v_tenant, p_owner);
  insert into tenant_members (tenant_id, user_id, role_id, created_by) values (v_tenant, p_owner, v_owner_role, p_owner);
  insert into profiles (id) values (p_owner) on conflict (id) do nothing;
  perform erp_seed_ai_rules(v_tenant, p_owner);
  perform erp_seed_admin_roles(v_tenant, p_owner);
  return v_tenant;
end;
$$;
revoke all on function erp_bootstrap_tenant(text, text, uuid) from public, anon, authenticated;

insert into tenant_security_settings (tenant_id, plan_code, plan_name_ar, created_by)
select t.id, 'staging', 'تجريبي', t.created_by from tenants t
on conflict (tenant_id) do nothing;

select erp_seed_admin_roles(t.id, t.created_by) from tenants t;

create or replace function journal_entries_books_lock() returns trigger
language plpgsql as $$
begin
  if new.status = 'posted' and exists (
    select 1 from tenant_security_settings s where s.tenant_id = new.tenant_id and s.books_locked
  ) then
    raise exception 'books_locked' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_books_lock() from public, anon, authenticated;
create trigger journal_entries_books_lock before insert or update on journal_entries
  for each row execute function journal_entries_books_lock();

insert into audit_activity_logs (
  tenant_id, actor_id, actor_name, actor_role, action_type, module, entity_type, entity_id, description_ar, metadata_json, created_at
)
select
  e.tenant_id,
  e.posted_by,
  coalesce(nullif(p.display_name, ''), 'مستخدم'),
  coalesce(r.name, 'owner'),
  'posted',
  case e.source_type
    when 'supplier_invoice' then 'procurement'
    when 'goods_receipt' then 'procurement'
    when 'purchase_return' then 'procurement'
    when 'supplier_credit_note' then 'procurement'
    when 'supplier_payment' then 'procurement'
    when 'kitchen_issue' then 'kitchen'
    when 'delivery_commission' then 'delivery'
    else 'finance'
  end,
  'journal_entry',
  e.id,
  case e.source_type
    when 'sales_revenue' then 'ترحيل إيراد المبيعات'
    when 'customer_collection' then 'تحصيل من عميل'
    when 'sales_cogs' then 'ترحيل تكلفة البضاعة المباعة'
    when 'kitchen_issue' then 'صرف مخزون للمطبخ'
    when 'delivery_commission' then 'ترحيل عمولة التوصيل'
    when 'supplier_invoice' then 'ترحيل فاتورة مورد'
    else 'ترحيل قيد ' || left(e.memo, 80)
  end,
  jsonb_build_object(
    'amountMinor', (select coalesce(sum(l.debit_minor), 0)::bigint from journal_lines l where l.tenant_id = e.tenant_id and l.entry_id = e.id),
    'currency', 'KWD',
    'sourceType', e.source_type,
    'memo', e.memo
  ),
  coalesce(e.posted_at, e.created_at)
from journal_entries e
left join profiles p on p.id = e.posted_by
left join tenant_members m on m.tenant_id = e.tenant_id and m.user_id = e.posted_by
left join roles r on r.tenant_id = e.tenant_id and r.id = m.role_id
where e.status = 'posted' and e.posted_by is not null;

insert into audit_activity_logs (
  tenant_id, actor_id, actor_name, actor_role, action_type, module, entity_type, entity_id, description_ar, metadata_json, created_at
)
select
  a.tenant_id,
  a.actor_id,
  coalesce(nullif(p.display_name, ''), 'مستخدم'),
  coalesce(r.name, 'owner'),
  a.action,
  case
    when a.entity in ('invoice', 'payment', 'journal_entry', 'account', 'fiscal_period') then 'finance'
    when a.entity in ('item', 'warehouse', 'stock_movement', 'product') then 'inventory'
    when a.entity like 'supplier%' or a.entity like 'purchase%' or a.entity like 'goods_%' then 'procurement'
    when a.entity in ('customer', 'lead', 'quotation', 'sales_quotation') then 'sales'
    when a.entity like 'kitchen%' or a.entity in ('recipe', 'recipe_line') then 'kitchen'
    when a.entity like 'delivery%' then 'delivery'
    when a.entity like 'ai_%' then 'ai'
    else 'admin'
  end,
  a.entity,
  a.entity_id,
  left(case a.action when 'create' then 'إنشاء ' when 'update' then 'تعديل ' else 'حذف ' end || a.entity, 500),
  case
    when jsonb_typeof(coalesce(a.after, a.before)) = 'object' then coalesce(a.after, a.before)
    else '{}'::jsonb
  end,
  a.created_at
from audit_log a
left join profiles p on p.id = a.actor_id
left join tenant_members m on m.tenant_id = a.tenant_id and m.user_id = a.actor_id
left join roles r on r.tenant_id = a.tenant_id and r.id = m.role_id;

alter table audit_activity_logs enable row level security;
alter table tenant_security_settings enable row level security;
revoke all on audit_activity_logs, tenant_security_settings from anon, authenticated;
grant select on audit_activity_logs, tenant_security_settings to authenticated;

create policy audit_activity_logs_select on audit_activity_logs for select to authenticated
  using (
    tenant_id in (select auth_tenant_ids())
    and auth_has_permission(tenant_id, 'iam.member.read')
    and exists (
      select 1 from tenant_members m
      join roles r on r.tenant_id = m.tenant_id and r.id = m.role_id
      where m.user_id = auth.uid() and m.tenant_id = audit_activity_logs.tenant_id
        and m.status = 'active' and r.name in ('owner', 'admin')
    )
  );

create policy tenant_security_settings_select on tenant_security_settings for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'iam.member.read'));
