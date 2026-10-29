-- 0024_hr_operations_suite: employees, attendance, leave, payroll, appraisals, expenses,
-- contracts, documents, and quality or maintenance tickets.
--
-- 0022 already owns accounts and the audit trail, so this migration does not create a second user table.
-- Money is whole fils. A payroll run debits salaries expense and credits accrued salaries.
-- An approved employee claim uses the same pair. Cash is not credited here: paying the accrual is a later entry.
-- Existing companies gain the new permissions on the owner role. No row is removed.

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
    'ops.quality.read', 'ops.quality.manage'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;

alter table finance_settings add column salary_expense_account_id uuid;
alter table finance_settings add column salary_payable_account_id uuid;
alter table finance_settings
  add constraint finance_settings_salary_expense_fk foreign key (tenant_id, salary_expense_account_id) references accounts (tenant_id, id);
alter table finance_settings
  add constraint finance_settings_salary_payable_fk foreign key (tenant_id, salary_payable_account_id) references accounts (tenant_id, id);

alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in (
    'manual', 'reversal', 'supplier_invoice', 'goods_receipt', 'purchase_return',
    'supplier_credit_note', 'supplier_payment', 'sales_cogs',
    'customer_collection', 'kitchen_issue', 'delivery_commission', 'sales_revenue',
    'payroll', 'employee_expense'
  ));

create or replace function journal_entries_source_guard() returns trigger
language plpgsql as $$
declare
  v_source text;
begin
  if new.reverses_id is not null then
    select source_type into v_source from journal_entries where tenant_id = new.tenant_id and id = new.reverses_id;
    if v_source in ('goods_receipt', 'purchase_return') then
      raise exception 'An entry made by a goods receipt or a purchase return cannot be reversed' using errcode = 'restrict_violation';
    end if;
    if v_source in (
      'supplier_invoice', 'supplier_credit_note', 'supplier_payment', 'sales_cogs',
      'customer_collection', 'kitchen_issue', 'delivery_commission', 'sales_revenue',
      'payroll', 'employee_expense'
    ) and coalesce(current_setting('erp.source_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a source document can only be reversed by voiding the document' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;

alter table audit_activity_logs drop constraint audit_activity_logs_module_check;
alter table audit_activity_logs add constraint audit_activity_logs_module_check
  check (module in ('finance', 'inventory', 'procurement', 'sales', 'kitchen', 'delivery', 'ai', 'admin', 'hr', 'operations'));

create table hr_employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_code text not null check (char_length(employee_code) between 1 and 20),
  full_name text not null check (char_length(full_name) between 1 and 200),
  role_title text not null check (char_length(role_title) between 1 and 80),
  department text not null check (char_length(department) between 1 and 80),
  branch_id uuid,
  basic_salary_minor bigint not null check (basic_salary_minor >= 0 and basic_salary_minor <= 1000000000000),
  allowances_minor bigint not null check (allowances_minor >= 0 and allowances_minor <= 1000000000000),
  residency_expiry date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_employees_tenant_id_key unique (tenant_id, id),
  constraint hr_employees_code_key unique (tenant_id, employee_code),
  constraint hr_employees_branch_fk foreign key (tenant_id, branch_id) references branches (tenant_id, id)
);

create table hr_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  branch_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_shifts_tenant_id_key unique (tenant_id, id),
  constraint hr_shifts_branch_fk foreign key (tenant_id, branch_id) references branches (tenant_id, id)
);

create table hr_attendances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  branch_id uuid,
  check_in timestamptz not null,
  check_out timestamptz,
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0 and overtime_minutes <= 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_attendances_tenant_id_key unique (tenant_id, id),
  constraint hr_attendances_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_attendances_branch_fk foreign key (tenant_id, branch_id) references branches (tenant_id, id),
  constraint hr_attendances_span check (check_out is null or check_out >= check_in)
);

create table hr_leaves (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  leave_type text not null check (leave_type in ('annual', 'sick', 'unpaid')),
  start_date date not null,
  end_date date not null,
  days integer not null check (days >= 1 and days <= 366),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_leaves_tenant_id_key unique (tenant_id, id),
  constraint hr_leaves_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_leaves_span check (end_date >= start_date)
);

create table hr_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  gross_minor bigint not null check (gross_minor >= 0),
  deductions_minor bigint not null check (deductions_minor >= 0),
  net_minor bigint not null check (net_minor >= 0),
  journal_entry_id uuid,
  status text not null default 'draft' check (status in ('draft', 'posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_payroll_runs_tenant_id_key unique (tenant_id, id),
  constraint hr_payroll_runs_period_key unique (tenant_id, period),
  constraint hr_payroll_runs_journal_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint hr_payroll_runs_posted check ((status = 'posted') = (journal_entry_id is not null)),
  constraint hr_payroll_runs_net check (net_minor = gross_minor - deductions_minor)
);

create table hr_payslips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  run_id uuid not null,
  employee_id uuid not null,
  gross_minor bigint not null check (gross_minor >= 0),
  deductions_minor bigint not null check (deductions_minor >= 0),
  net_minor bigint not null check (net_minor >= 0),
  journal_entry_id uuid,
  status text not null check (status in ('draft', 'posted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_payslips_tenant_id_key unique (tenant_id, id),
  constraint hr_payslips_run_employee_key unique (run_id, employee_id),
  constraint hr_payslips_run_fk foreign key (tenant_id, run_id) references hr_payroll_runs (tenant_id, id),
  constraint hr_payslips_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_payslips_journal_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint hr_payslips_net check (net_minor = gross_minor - deductions_minor)
);

create table hr_appraisals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  kpi_score smallint not null check (kpi_score between 0 and 100),
  reviewer_notes text not null default '' check (char_length(reviewer_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_appraisals_tenant_id_key unique (tenant_id, id),
  constraint hr_appraisals_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id)
);

create table hr_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  category text not null check (char_length(category) between 1 and 80),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  journal_entry_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_expenses_tenant_id_key unique (tenant_id, id),
  constraint hr_expenses_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_expenses_journal_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint hr_expenses_posted check ((approval_status = 'approved') = (journal_entry_id is not null))
);

create table enterprise_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  title text not null check (char_length(title) between 1 and 200),
  counterparty text not null check (char_length(counterparty) between 1 and 200),
  start_date date not null,
  end_date date not null,
  value_minor bigint not null check (value_minor >= 0 and value_minor <= 1000000000000),
  renewal_alert_days integer not null check (renewal_alert_days between 1 and 365),
  status text not null default 'active' check (status in ('active', 'ended')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint enterprise_contracts_tenant_id_key unique (tenant_id, id),
  constraint enterprise_contracts_span check (end_date >= start_date)
);

create table enterprise_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  contract_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  category text not null check (char_length(category) between 1 and 80),
  issued_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint enterprise_documents_tenant_id_key unique (tenant_id, id),
  constraint enterprise_documents_contract_fk foreign key (tenant_id, contract_id) references enterprise_contracts (tenant_id, id)
);

create table quality_maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  type text not null check (type in ('quality_inspection', 'equipment_maintenance')),
  branch_id uuid,
  asset_name text not null check (char_length(asset_name) between 1 and 200),
  severity text not null check (severity in ('low', 'medium', 'high')),
  cost_minor bigint not null check (cost_minor >= 0 and cost_minor <= 1000000000000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint quality_maintenance_tickets_tenant_id_key unique (tenant_id, id),
  constraint quality_maintenance_tickets_branch_fk foreign key (tenant_id, branch_id) references branches (tenant_id, id)
);

create index hr_employees_tenant_idx on hr_employees (tenant_id, employee_code);
create index hr_attendances_tenant_idx on hr_attendances (tenant_id, check_in desc);
create index hr_leaves_tenant_idx on hr_leaves (tenant_id, approval_status);
create index hr_payroll_runs_tenant_idx on hr_payroll_runs (tenant_id, period desc);
create index enterprise_contracts_tenant_idx on enterprise_contracts (tenant_id, end_date);
create index quality_maintenance_tickets_tenant_idx on quality_maintenance_tickets (tenant_id, status);

create trigger hr_employees_updated_at before update on hr_employees for each row execute function set_updated_at();
create trigger hr_shifts_updated_at before update on hr_shifts for each row execute function set_updated_at();
create trigger hr_attendances_updated_at before update on hr_attendances for each row execute function set_updated_at();
create trigger hr_leaves_updated_at before update on hr_leaves for each row execute function set_updated_at();
create trigger hr_payroll_runs_updated_at before update on hr_payroll_runs for each row execute function set_updated_at();
create trigger hr_payroll_runs_no_delete before delete on hr_payroll_runs for each row execute function prevent_delete();
create trigger hr_payslips_updated_at before update on hr_payslips for each row execute function set_updated_at();
create trigger hr_payslips_no_delete before delete on hr_payslips for each row execute function prevent_delete();
create trigger hr_appraisals_updated_at before update on hr_appraisals for each row execute function set_updated_at();
create trigger hr_expenses_updated_at before update on hr_expenses for each row execute function set_updated_at();
create trigger enterprise_contracts_updated_at before update on enterprise_contracts for each row execute function set_updated_at();
create trigger enterprise_documents_updated_at before update on enterprise_documents for each row execute function set_updated_at();
create trigger quality_maintenance_tickets_updated_at before update on quality_maintenance_tickets for each row execute function set_updated_at();

alter table hr_employees enable row level security;
alter table hr_shifts enable row level security;
alter table hr_attendances enable row level security;
alter table hr_leaves enable row level security;
alter table hr_payroll_runs enable row level security;
alter table hr_payslips enable row level security;
alter table hr_appraisals enable row level security;
alter table hr_expenses enable row level security;
alter table enterprise_contracts enable row level security;
alter table enterprise_documents enable row level security;
alter table quality_maintenance_tickets enable row level security;

revoke all on hr_employees, hr_shifts, hr_attendances, hr_leaves, hr_payroll_runs, hr_payslips, hr_appraisals, hr_expenses,
  enterprise_contracts, enterprise_documents, quality_maintenance_tickets from anon, authenticated;
grant select on hr_employees, hr_shifts, hr_attendances, hr_leaves, hr_payroll_runs, hr_payslips, hr_appraisals, hr_expenses,
  enterprise_contracts, enterprise_documents, quality_maintenance_tickets to authenticated;

create policy hr_employees_select on hr_employees for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.employee.read'));
create policy hr_shifts_select on hr_shifts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.attendance.read'));
create policy hr_attendances_select on hr_attendances for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.attendance.read'));
create policy hr_leaves_select on hr_leaves for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.leave.read'));
create policy hr_payroll_runs_select on hr_payroll_runs for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.payroll.read'));
create policy hr_payslips_select on hr_payslips for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.payroll.read'));
create policy hr_appraisals_select on hr_appraisals for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.appraisal.read'));
create policy hr_expenses_select on hr_expenses for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'hr.expense.read'));
create policy enterprise_contracts_select on enterprise_contracts for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ops.contract.read'));
create policy enterprise_documents_select on enterprise_documents for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ops.document.read'));
create policy quality_maintenance_tickets_select on quality_maintenance_tickets for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'ops.quality.read'));

-- Live rows for companies that already exist. A fresh database has no tenant, so this does nothing there.
do $$
declare
  t record;
  v_expense uuid;
  v_payable uuid;
  v_entry_date date;
  v_emp1 uuid;
  v_emp2 uuid;
  v_emp3 uuid;
  v_run uuid;
  v_expense_id uuid;
  v_entry uuid;
  v_claim uuid;
  v_number integer;
  v_net bigint := 1070000;
  v_claim_minor bigint := 15000;
begin
  for t in select id, created_by from tenants loop
    if exists (select 1 from hr_employees where tenant_id = t.id) then
      continue;
    end if;

    select id into v_expense from accounts
      where tenant_id = t.id and code = '6100' and type = 'expense' and is_postable and is_active;
    if v_expense is null then
      insert into accounts (tenant_id, code, name, type, is_postable, is_active, created_by)
      values (t.id, '6100', 'مصروف الرواتب', 'expense', true, true, t.created_by)
      on conflict (tenant_id, code) do nothing;
      select id into v_expense from accounts
        where tenant_id = t.id and code = '6100' and type = 'expense' and is_postable and is_active;
    end if;
    if v_expense is null then
      insert into accounts (tenant_id, code, name, type, is_postable, is_active, created_by)
      values (t.id, '6110', 'مصروف الرواتب', 'expense', true, true, t.created_by)
      on conflict (tenant_id, code) do nothing;
      select id into v_expense from accounts
        where tenant_id = t.id and code = '6110' and type = 'expense' and is_postable and is_active;
    end if;

    select id into v_payable from accounts
      where tenant_id = t.id and code = '2300' and type = 'liability' and is_postable and is_active;
    if v_payable is null then
      insert into accounts (tenant_id, code, name, type, is_postable, is_active, created_by)
      values (t.id, '2300', 'رواتب مستحقة', 'liability', true, true, t.created_by)
      on conflict (tenant_id, code) do nothing;
      select id into v_payable from accounts
        where tenant_id = t.id and code = '2300' and type = 'liability' and is_postable and is_active;
    end if;
    if v_payable is null then
      insert into accounts (tenant_id, code, name, type, is_postable, is_active, created_by)
      values (t.id, '2310', 'رواتب مستحقة', 'liability', true, true, t.created_by)
      on conflict (tenant_id, code) do nothing;
      select id into v_payable from accounts
        where tenant_id = t.id and code = '2310' and type = 'liability' and is_postable and is_active;
    end if;

    update finance_settings
      set salary_expense_account_id = coalesce(salary_expense_account_id, v_expense),
          salary_payable_account_id = coalesce(salary_payable_account_id, v_payable)
      where tenant_id = t.id;

    insert into hr_employees (tenant_id, employee_code, full_name, role_title, department, basic_salary_minor, allowances_minor, residency_expiry, status, created_by)
    values (t.id, 'EMP-001', 'فاطمة الكندري', 'رئيس المطبخ', 'المطبخ', 400000, 50000, '2027-04-30', 'active', t.created_by)
    returning id into v_emp1;
    insert into hr_employees (tenant_id, employee_code, full_name, role_title, department, basic_salary_minor, allowances_minor, residency_expiry, status, created_by)
    values (t.id, 'EMP-002', 'خالد المطيري', 'أمين الصندوق', 'المبيعات', 250000, 25000, '2026-12-15', 'active', t.created_by)
    returning id into v_emp2;
    insert into hr_employees (tenant_id, employee_code, full_name, role_title, department, basic_salary_minor, allowances_minor, residency_expiry, status, created_by)
    values (t.id, 'EMP-003', 'سارة الهاجري', 'مشرفة الفرع', 'التشغيل', 350000, 40000, '2027-08-01', 'active', t.created_by)
    returning id into v_emp3;

    insert into hr_shifts (tenant_id, name, weekday, starts_at, ends_at, created_by)
    values (t.id, 'وردية المطبخ الصباحية', 0, '06:00', '14:00', t.created_by);

    insert into hr_attendances (tenant_id, employee_id, check_in, check_out, overtime_minutes, created_by)
    values (t.id, v_emp1, timestamptz '2026-10-28 06:02+00', timestamptz '2026-10-28 14:30+00', 30, t.created_by);

    insert into hr_leaves (tenant_id, employee_id, leave_type, start_date, end_date, days, approval_status, created_by)
    values
      (t.id, v_emp2, 'annual', '2026-11-02', '2026-11-04', 3, 'pending', t.created_by),
      (t.id, v_emp3, 'sick', '2026-10-20', '2026-10-21', 2, 'approved', t.created_by);

    insert into hr_appraisals (tenant_id, employee_id, rating, kpi_score, reviewer_notes, created_by)
    values (t.id, v_emp1, 5, 92, 'التزام الوردية وجودة التحضير', t.created_by);

    insert into hr_expenses (tenant_id, employee_id, category, amount_minor, approval_status, created_by)
    values (t.id, v_emp3, 'مواصلات عهدة', 15000, 'pending', t.created_by)
    returning id into v_expense_id;

    insert into enterprise_contracts (tenant_id, title, counterparty, start_date, end_date, value_minor, renewal_alert_days, status, created_by)
    values (t.id, 'عقد توريد خضار', 'مؤسسة النخيل', '2026-01-01', '2026-11-15', 2400000, 30, 'active', t.created_by)
    returning id into v_entry;

    insert into enterprise_documents (tenant_id, contract_id, title, category, issued_on, created_by)
    values (t.id, v_entry, 'رخصة سلامة الغذاء', 'سلامة غذائية', '2026-02-01', t.created_by);

    insert into quality_maintenance_tickets (tenant_id, type, asset_name, severity, cost_minor, status, created_by)
    values
      (t.id, 'quality_inspection', 'خط التحضير البارد', 'medium', 0, 'open', t.created_by),
      (t.id, 'equipment_maintenance', 'فرن البيتزا', 'high', 75000, 'in_progress', t.created_by);

    select p.ends_on into v_entry_date
    from fiscal_periods p
    where p.tenant_id = t.id and p.status = 'open' and current_date between p.starts_on and p.ends_on
    limit 1;
    if v_entry_date is null then
      select p.ends_on into v_entry_date
      from fiscal_periods p
      where p.tenant_id = t.id and p.status = 'open'
      order by p.ends_on desc
      limit 1;
    else
      v_entry_date := current_date;
    end if;

    if v_entry_date is null or v_expense is null or v_payable is null then
      continue;
    end if;
    if exists (select 1 from tenant_security_settings s where s.tenant_id = t.id and s.books_locked) then
      continue;
    end if;

    insert into hr_payroll_runs (tenant_id, period, gross_minor, deductions_minor, net_minor, status, created_by)
    values (t.id, to_char(v_entry_date, 'YYYY-MM'), 1115000, 45000, v_net, 'draft', t.created_by)
    returning id into v_run;

    insert into hr_payslips (tenant_id, run_id, employee_id, gross_minor, deductions_minor, net_minor, status, created_by)
    values
      (t.id, v_run, v_emp1, 450000, 20000, 430000, 'draft', t.created_by),
      (t.id, v_run, v_emp2, 275000, 10000, 265000, 'draft', t.created_by),
      (t.id, v_run, v_emp3, 390000, 15000, 375000, 'draft', t.created_by);

    insert into tenant_sequences (tenant_id, name, last_value)
    values (t.id, 'journal', 1)
    on conflict (tenant_id, name) do update set last_value = tenant_sequences.last_value + 1
    returning last_value into v_number;

    insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by)
    values (t.id, v_number, v_entry_date, 'مسير رواتب ' || to_char(v_entry_date, 'YYYY-MM'), 'payroll', v_run, t.created_by)
    returning id into v_entry;

    insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, description, created_by)
    values
      (t.id, v_entry, 1, v_expense, v_net, 0, 'مصروف الرواتب', t.created_by),
      (t.id, v_entry, 2, v_payable, 0, v_net, 'رواتب مستحقة', t.created_by);

    update journal_entries set status = 'posted', posted_by = t.created_by where tenant_id = t.id and id = v_entry;
    update hr_payroll_runs set status = 'posted', journal_entry_id = v_entry where tenant_id = t.id and id = v_run;
    update hr_payslips set status = 'posted', journal_entry_id = v_entry where tenant_id = t.id and run_id = v_run;

    insert into tenant_sequences (tenant_id, name, last_value)
    values (t.id, 'journal', 1)
    on conflict (tenant_id, name) do update set last_value = tenant_sequences.last_value + 1
    returning last_value into v_number;

    insert into journal_entries (tenant_id, number, entry_date, memo, source_type, source_id, created_by)
    values (t.id, v_number, v_entry_date, 'عهدة موظف', 'employee_expense', v_expense_id, t.created_by)
    returning id into v_claim;

    insert into journal_lines (tenant_id, entry_id, line_no, account_id, debit_minor, credit_minor, description, created_by)
    values
      (t.id, v_claim, 1, v_expense, v_claim_minor, 0, 'مصروف عهدة موظف', t.created_by),
      (t.id, v_claim, 2, v_payable, 0, v_claim_minor, 'رواتب مستحقة', t.created_by);

    update journal_entries set status = 'posted', posted_by = t.created_by where tenant_id = t.id and id = v_claim;
    update hr_expenses set approval_status = 'approved', journal_entry_id = v_claim where tenant_id = t.id and id = v_expense_id;

    insert into audit_activity_logs (
      tenant_id, actor_id, actor_name, actor_role, action_type, module, entity_type, entity_id, description_ar, metadata_json, created_at
    ) values
      (t.id, t.created_by, 'مستخدم', 'owner', 'posted', 'hr', 'payroll_run', v_run, 'ترحيل مسير الرواتب',
        jsonb_build_object('amountMinor', v_net, 'currency', 'KWD'), now()),
      (t.id, t.created_by, 'مستخدم', 'owner', 'approved', 'hr', 'employee_expense', v_expense_id, 'اعتماد عهدة موظف',
        jsonb_build_object('amountMinor', v_claim_minor, 'currency', 'KWD'), now());
  end loop;
end;
$$;
