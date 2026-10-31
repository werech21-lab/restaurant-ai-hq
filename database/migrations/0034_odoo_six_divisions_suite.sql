-- 0034_odoo_six_divisions_suite
-- Super-Odoo boards for the six Venture Foods divisions. No DEMO rows.
-- 0031 to 0033 already shipped, so this file is 0034.

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
    'admin.odoo.read', 'admin.odoo.sync',
    'suite.board.read', 'suite.board.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(array['suite.board.read', 'suite.board.manage']::text[]) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

create table suite_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  app_key text not null check (app_key in (
    'crm_pipeline', 'sales_orders', 'pos_sessions', 'subscriptions',
    'analytic', 'mrp', 'plm', 'maintenance', 'recruitment',
    'projects', 'timesheets', 'helpdesk',
    'website', 'ecommerce', 'email', 'automation'
  )),
  title text not null check (char_length(title) between 1 and 200),
  stage text not null check (char_length(stage) between 1 and 40),
  brand_name text not null default '' check (char_length(brand_name) <= 80),
  branch_name text not null default '' check (char_length(branch_name) <= 80),
  department text not null default '' check (char_length(department) <= 80),
  assignee text not null default '' check (char_length(assignee) <= 120),
  amount_minor bigint not null default 0 check (amount_minor >= 0 and amount_minor <= 1000000000000),
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint suite_records_tenant_id_key unique (tenant_id, id),
  constraint suite_records_span check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index suite_records_board_idx on suite_records (tenant_id, app_key, stage, sort_order);
create trigger suite_records_updated_at before update on suite_records for each row execute function set_updated_at();
alter table suite_records enable row level security;
revoke all on suite_records from anon, authenticated;
grant select on suite_records to authenticated;
create policy suite_records_select on suite_records for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'suite.board.read'));

create or replace function erp_seed_suite_records() returns void
language plpgsql as $$
declare
  t record;
  brands text[] := array['Farm Brown', 'Karak Cafeteria', 'China Garden', 'The Noodle Bar', 'Franks Steak', 'Shawarma Tahina'];
  branches text[] := array['360 Mall', 'Al Kout', 'Ardiya', 'Avenues', 'Salmiya 1', 'Sharq HQ', 'Promenade', 'Aswaq Al Qurain', 'Al Rai', 'Hawally'];
  depts text[] := array['Rest. Operations', 'Kitchen', 'HR & Admin', 'Finance', 'Procurement', 'Delivery'];
  i int;
  b int;
begin
  for t in select id, created_by from tenants loop
    if exists (select 1 from suite_records where tenant_id = t.id) then
      continue;
    end if;

    for i in 1..6 loop
      insert into suite_records (tenant_id, app_key, title, stage, brand_name, branch_name, department, assignee, amount_minor, starts_on, ends_on, sort_order, created_by)
      values
        (t.id, 'crm_pipeline', 'Lead ' || brands[i] || ' corporate catering', (array['new','qualified','proposal','won'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Sales', 'Sales team', 250000 * i, current_date - (i * 2), current_date + 14, i, t.created_by),
        (t.id, 'sales_orders', 'SO-' || lpad(i::text, 4, '0') || ' ' || brands[i], (array['quotation','confirmed','delivered','invoiced'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Sales', 'Order desk', 180000 * i, current_date - i, current_date + 7, i, t.created_by),
        (t.id, 'pos_sessions', 'POS ' || branches[i] || ' open', (array['opening','selling','closing','closed'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Front of house', 'Cashier', 95000 * i, current_date, current_date, i, t.created_by),
        (t.id, 'subscriptions', brands[i] || ' meal plan', (array['draft','active','paused','closed'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Sales', 'Subscriptions', 45000 * i, current_date, current_date + 30, i, t.created_by),
        (t.id, 'analytic', brands[i] || ' contribution', 'posted', brands[i], branches[i], 'Finance', 'Controller', 120000 * i, current_date - 1, current_date - 1, i, t.created_by),
        (t.id, 'mrp', 'WO ' || brands[i] || ' prep', (array['planned','progress','done','cancelled'])[1 + ((i - 1) % 4)], brands[i], 'Central Kitchen', 'Kitchen', 'Kitchen lead', 0, current_date, current_date + 1, i, t.created_by),
        (t.id, 'plm', brands[i] || ' menu v' || i, (array['draft','review','approved','released'])[1 + ((i - 1) % 4)], brands[i], 'Central Kitchen', 'Product', 'Chef', 0, current_date - 5, current_date + 10, i, t.created_by),
        (t.id, 'maintenance', branches[i] || ' oven service', (array['request','scheduled','in_progress','done'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Maintenance', 'Tech', 35000, current_date, current_date + 3, i, t.created_by),
        (t.id, 'recruitment', 'Chef ' || brands[i], (array['new','interview','offer','hired'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'HR & Admin', 'Recruiter', 0, current_date, current_date + 21, i, t.created_by),
        (t.id, 'projects', 'Launch ' || brands[i] || ' ' || branches[i], (array['backlog','active','blocked','done'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Projects', 'PM', 0, current_date, current_date + 45, i, t.created_by),
        (t.id, 'timesheets', brands[i] || ' setup hours', 'logged', brands[i], branches[i], depts[i], 'Staff', 0, current_date - 1, current_date - 1, i, t.created_by),
        (t.id, 'helpdesk', branches[i] || ' POS offline', (array['new','progress','waiting','solved'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'Support', 'Helpdesk', 0, current_date, current_date + 2, i, t.created_by),
        (t.id, 'website', brands[i] || ' landing page', (array['draft','published','archived'])[1 + ((i - 1) % 3)], brands[i], branches[i], 'Marketing', 'Web', 0, current_date, null, i, t.created_by),
        (t.id, 'ecommerce', 'Online order ' || brands[i], (array['cart','paid','preparing','delivered'])[1 + ((i - 1) % 4)], brands[i], branches[i], 'eCommerce', 'Web', 12500 * i, current_date, current_date, i, t.created_by),
        (t.id, 'email', brands[i] || ' Friday offer', (array['draft','scheduled','sent','done'])[1 + ((i - 1) % 4)], brands[i], '', 'Marketing', 'CRM', 0, current_date, current_date + 1, i, t.created_by),
        (t.id, 'automation', 'Win-back ' || brands[i], (array['draft','running','paused','done'])[1 + ((i - 1) % 4)], brands[i], '', 'Marketing', 'Automation', 0, current_date, current_date + 14, i, t.created_by);
    end loop;

    for b in 7..10 loop
      insert into suite_records (tenant_id, app_key, title, stage, brand_name, branch_name, department, assignee, amount_minor, starts_on, ends_on, sort_order, created_by)
      values
        (t.id, 'pos_sessions', 'POS ' || branches[b] || ' standby', 'opening', brands[1 + ((b - 1) % 6)], branches[b], 'Front of house', 'Cashier', 0, current_date, current_date, b, t.created_by),
        (t.id, 'maintenance', branches[b] || ' cold room check', 'scheduled', brands[1 + ((b - 1) % 6)], branches[b], 'Maintenance', 'Tech', 12000, current_date, current_date + 5, b, t.created_by),
        (t.id, 'helpdesk', branches[b] || ' delivery tablet', 'new', brands[1 + ((b - 1) % 6)], branches[b], 'Support', 'Helpdesk', 0, current_date, current_date + 1, b, t.created_by);
    end loop;
  end loop;
end;
$$;
revoke all on function erp_seed_suite_records() from public, anon, authenticated;

select erp_seed_suite_records();

create or replace function erp_odoo_six_divisions_marker() returns text
language sql immutable as $$ select 'odoo_six_divisions_suite'::text $$;
revoke all on function erp_odoo_six_divisions_marker() from public, anon, authenticated;
