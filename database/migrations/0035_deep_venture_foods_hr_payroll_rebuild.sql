-- Deep Venture Foods HR / Payroll rebuild: Odoo-parity columns, contracts, custody, loans, overtime, documents.
-- Employee rows are promoted from the Odoo dump by scripts/seed-venture-hr-from-dump.mjs (not invented DEMO codes).

drop function if exists erp_hr_deep_rebuild_marker();

alter table hr_employees drop constraint if exists hr_employees_department_check;
alter table hr_employees alter column department type text;
alter table hr_employees add constraint hr_employees_department_check check (char_length(department) between 1 and 200);

alter table hr_employees drop constraint if exists hr_employees_role_title_check;
alter table hr_employees alter column role_title type text;
alter table hr_employees add constraint hr_employees_role_title_check check (char_length(role_title) between 1 and 120);

alter table hr_employees
  add column if not exists badge_code text,
  add column if not exists work_email text,
  add column if not exists work_phone text,
  add column if not exists mobile_phone text,
  add column if not exists work_location text,
  add column if not exists department_root text,
  add column if not exists odoo_id integer,
  add column if not exists has_running_contract boolean not null default false,
  add column if not exists avatar_initials text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hr_employees_badge_key'
  ) then
    alter table hr_employees
      add constraint hr_employees_badge_key unique (tenant_id, badge_code);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'hr_employees_odoo_key'
  ) then
    alter table hr_employees
      add constraint hr_employees_odoo_key unique (tenant_id, odoo_id);
  end if;
end $$;

create table if not exists hr_contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  odoo_id integer,
  name text not null check (char_length(name) between 1 and 200),
  date_start date not null,
  date_end date,
  wage_minor bigint not null check (wage_minor >= 0 and wage_minor <= 1000000000000),
  state text not null check (state in ('draft', 'open', 'close', 'cancel')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_contracts_tenant_id_key unique (tenant_id, id),
  constraint hr_contracts_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_contracts_odoo_key unique (tenant_id, odoo_id)
);

create table if not exists hr_custody (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  item_name text not null check (char_length(item_name) between 1 and 200),
  serial_or_ref text not null default '' check (char_length(serial_or_ref) <= 120),
  issued_on date not null,
  returned_on date,
  status text not null default 'open' check (status in ('open', 'returned', 'lost')),
  notes_ar text not null default '' check (char_length(notes_ar) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_custody_tenant_id_key unique (tenant_id, id),
  constraint hr_custody_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id)
);

create table if not exists hr_loans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  principal_minor bigint not null check (principal_minor > 0 and principal_minor <= 1000000000000),
  remaining_minor bigint not null check (remaining_minor >= 0 and remaining_minor <= 1000000000000),
  installment_minor bigint not null check (installment_minor >= 0 and installment_minor <= 1000000000000),
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'settled', 'cancelled')),
  notes_ar text not null default '' check (char_length(notes_ar) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_loans_tenant_id_key unique (tenant_id, id),
  constraint hr_loans_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id),
  constraint hr_loans_remaining check (remaining_minor <= principal_minor)
);

create table if not exists hr_overtimes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  work_date date not null,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  amount_minor bigint not null default 0 check (amount_minor >= 0 and amount_minor <= 1000000000000),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid', 'rejected')),
  notes_ar text not null default '' check (char_length(notes_ar) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_overtimes_tenant_id_key unique (tenant_id, id),
  constraint hr_overtimes_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id)
);

create table if not exists hr_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  employee_id uuid not null,
  doc_type text not null check (doc_type in ('contract', 'civil_id', 'passport', 'residency', 'certificate', 'other')),
  title text not null check (char_length(title) between 1 and 200),
  issued_on date,
  expires_on date,
  status text not null default 'valid' check (status in ('valid', 'expired', 'missing')),
  notes_ar text not null default '' check (char_length(notes_ar) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint hr_documents_tenant_id_key unique (tenant_id, id),
  constraint hr_documents_employee_fk foreign key (tenant_id, employee_id) references hr_employees (tenant_id, id)
);

create index if not exists hr_employees_department_root_idx on hr_employees (tenant_id, department_root);
create index if not exists hr_employees_work_location_idx on hr_employees (tenant_id, work_location);
create index if not exists hr_contracts_employee_state_idx on hr_contracts (tenant_id, employee_id, state);
create index if not exists hr_custody_employee_idx on hr_custody (tenant_id, employee_id);
create index if not exists hr_loans_employee_idx on hr_loans (tenant_id, employee_id);
create index if not exists hr_overtimes_employee_idx on hr_overtimes (tenant_id, employee_id);
create index if not exists hr_documents_employee_idx on hr_documents (tenant_id, employee_id);

-- Soft-retire the Odoo Administrator system row from operational HR facets (never DEMO).
update hr_employees
set status = 'inactive',
    department_root = coalesce(department_root, 'System'),
    updated_at = now()
where employee_code = 'O1' or (odoo_id = 1 and full_name = 'Administrator');

-- Ensure no EMP-/DEMO placeholder codes remain.
delete from hr_employees
where employee_code ~* '^(EMP-|DEMO)'
  and not exists (select 1 from hr_payslips p where p.tenant_id = hr_employees.tenant_id and p.employee_id = hr_employees.id);

drop function if exists erp_hr_deep_rebuild_marker();
create function erp_hr_deep_rebuild_marker() returns text
language sql immutable as $$ select '0035_deep_venture_foods_hr_payroll_rebuild'::text $$;
