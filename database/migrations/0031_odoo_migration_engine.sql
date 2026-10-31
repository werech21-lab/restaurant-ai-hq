-- 0031_odoo_migration_engine
-- Staging ledger for pulls from the Venture Foods Odoo site.
-- 0029 is the brand portfolio and 0030 removed the placeholder radar rows, so this file is 0031.
-- Passwords and API keys are never stored. Money stays in fils. Stock and invoices are not posted from here.

create or replace function erp_owner_extra_permissions() returns text[]
language sql immutable as $$
  select array[
    'org.brand.read', 'org.brand.manage', 'org.branch.read', 'org.branch.manage',
    'finance.account.read', 'finance.account.manage', 'finance.journal.read', 'finance.journal.create',
    'finance.journal.post', 'finance.journal.reverse', 'finance.period.manage',
    'procurement.supplier.read', 'procurement.supplier.manage', 'procurement.order.read', 'procurement.order.create',
    'procurement.order.update', 'procurement.order.submit', 'procurement.order.approve', 'procurement.order.cancel',
    'procurement.receipt.read', 'procurement.receipt.create', 'procurement.settings.manage',
    'procurement.request.read', 'procurement.request.create', 'procurement.request.submit', 'procurement.request.approve',
    'procurement.request.cancel', 'procurement.request.convert',
    'procurement.invoice.read', 'procurement.invoice.create', 'procurement.invoice.void',
    'procurement.payment.read', 'procurement.payment.create', 'procurement.payment.void',
    'procurement.return.read', 'procurement.return.create',
    'procurement.creditnote.read', 'procurement.creditnote.create', 'procurement.creditnote.void',
    'hr.employee.read', 'hr.employee.manage', 'hr.attendance.read', 'hr.attendance.manage',
    'hr.leave.read', 'hr.leave.approve', 'hr.payroll.read', 'hr.payroll.run',
    'hr.appraisal.read', 'hr.appraisal.manage', 'hr.expense.read', 'hr.expense.approve',
    'ops.contract.read', 'ops.contract.manage', 'ops.document.read', 'ops.document.manage',
    'ops.quality.read', 'ops.quality.manage',
    'gov.contract.read', 'gov.contract.analyze', 'gov.compliance.read', 'gov.compliance.enforce',
    'gov.memory.read', 'gov.archive.read', 'gov.archive.route',
    'gov.telemetry.read', 'gov.telemetry.record', 'gov.radar.read', 'gov.radar.manage',
    'gov.violation.read', 'gov.violation.manage', 'gov.monitor.read', 'gov.monitor.manage',
    'gov.inquiry.read', 'gov.inquiry.manage', 'gov.task.read', 'gov.task.dispatch',
    'hr.appointment.read', 'hr.appointment.manage',
    'gov.aggregator.read', 'gov.aggregator.manage',
    'admin.odoo.read', 'admin.odoo.sync'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

create table odoo_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  source text not null check (source in ('jsonrpc', 'file')),
  odoo_base_url text not null check (odoo_base_url = 'https://venturefoods.walnutss.com'),
  database_name text check (database_name is null or char_length(database_name) between 1 and 80),
  login_name text check (login_name is null or char_length(login_name) between 1 and 200),
  status text not null check (status in ('completed', 'failed')),
  models_requested text[] not null,
  records_pulled integer not null default 0 check (records_pulled >= 0 and records_pulled <= 100000),
  records_applied integer not null default 0 check (records_applied >= 0 and records_applied <= 100000),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  version integer not null default 1 check (version >= 1)
);

create table odoo_imported_staging_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  job_id uuid not null references odoo_sync_jobs (id),
  odoo_model text not null check (odoo_model in (
    'hr.employee', 'hr.payslip', 'hr.attendance', 'hr.leave', 'account.account', 'account.move',
    'product.template', 'stock.quant', 'purchase.order', 'res.partner'
  )),
  external_id text not null check (char_length(external_id) between 1 and 80),
  display_name text not null check (char_length(display_name) between 1 and 200),
  payload jsonb not null,
  apply_status text not null check (apply_status in ('staged', 'applied', 'skipped')),
  target_table text check (target_table is null or target_table in ('customers', 'hr_employees', 'items')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, odoo_model, external_id)
);

alter table odoo_imported_staging_records
  add constraint odoo_imported_payload_object check (jsonb_typeof(payload) = 'object');

create index odoo_sync_jobs_tenant_idx on odoo_sync_jobs (tenant_id, created_at desc);
create index odoo_imported_staging_job_idx on odoo_imported_staging_records (tenant_id, job_id);

create trigger odoo_sync_jobs_updated_at before update on odoo_sync_jobs for each row execute function set_updated_at();
create trigger odoo_imported_staging_updated_at before update on odoo_imported_staging_records for each row execute function set_updated_at();

alter table odoo_sync_jobs enable row level security;
alter table odoo_imported_staging_records enable row level security;
revoke all on odoo_sync_jobs, odoo_imported_staging_records from anon, authenticated;
grant select on odoo_sync_jobs, odoo_imported_staging_records to authenticated;

create policy odoo_sync_jobs_select on odoo_sync_jobs for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'admin.odoo.read'));
create policy odoo_imported_staging_select on odoo_imported_staging_records for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'admin.odoo.read'));

create or replace function erp_odoo_sync_marker() returns text
language sql immutable as $$ select 'odoo_sync_jobs'::text $$;
revoke all on function erp_odoo_sync_marker() from public, anon, authenticated;
