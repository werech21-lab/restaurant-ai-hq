-- 0004_finance: settings, invoices, invoice lines, payments.
-- Money is bigint fils (KWD has three decimals). Tax is per line (basis points, 1500 = 15.00%).
-- Invoice tax is the sum of unrounded line tax, rounded half up ONCE per invoice.
-- Invoices and payments are never deleted. Drafts can be voided. Issued invoices with payments cannot.

create table finance_settings (
  tenant_id uuid primary key references tenants (id),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  invoice_prefix text not null default 'INV' check (invoice_prefix ~ '^[A-Z0-9]{1,8}$'),
  -- An invoice whose total is strictly greater than this needs approval before it is issued. 5,000.000 KWD.
  approval_threshold_minor bigint not null default 5000000 check (approval_threshold_minor >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);
create trigger finance_settings_updated_at before update on finance_settings for each row execute function set_updated_at();
create trigger finance_settings_no_delete before delete on finance_settings for each row execute function prevent_delete();

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number text not null check (char_length(number) between 1 and 40),
  customer_id uuid not null,
  customer_name text not null check (char_length(customer_name) between 1 and 200),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'issued', 'partially_paid', 'paid', 'void')),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  issue_date date not null,
  due_date date not null,
  notes text check (notes is null or char_length(notes) <= 2000),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  requires_approval boolean not null default false,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint invoices_tenant_id_key unique (tenant_id, id),
  constraint invoices_tenant_number_key unique (tenant_id, number),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  constraint invoices_dates check (due_date >= issue_date),
  constraint invoices_total check (total_minor = subtotal_minor + tax_minor),
  constraint invoices_paid_within_total check (paid_minor <= total_minor),
  constraint invoices_paid_status check (status <> 'paid' or paid_minor = total_minor),
  constraint invoices_payment_state check (paid_minor = 0 or status in ('issued', 'partially_paid', 'paid')),
  constraint invoices_void_fields check (status <> 'void' or (voided_at is not null and void_reason is not null)),
  constraint invoices_approval_fields check (approved_at is null or requires_approval)
);
create index invoices_tenant_created_idx on invoices (tenant_id, created_at desc, id desc);
create index invoices_tenant_due_idx on invoices (tenant_id, due_date, id);
create index invoices_tenant_total_idx on invoices (tenant_id, total_minor, id);
create index invoices_tenant_status_idx on invoices (tenant_id, status);
create index invoices_tenant_customer_idx on invoices (tenant_id, customer_id);
create index invoices_open_due_idx on invoices (tenant_id, due_date) where status in ('issued', 'partially_paid');
create trigger invoices_updated_at before update on invoices for each row execute function set_updated_at();
create trigger invoices_no_delete before delete on invoices for each row execute function prevent_delete();

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  invoice_id uuid not null,
  position integer not null check (position >= 1),
  description text not null check (char_length(description) between 1 and 300),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 1000000000),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  line_net_minor bigint generated always as (quantity::bigint * unit_price_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint invoice_lines_invoice_position_key unique (invoice_id, position),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id)
);
create index invoice_lines_invoice_idx on invoice_lines (tenant_id, invoice_id);
create trigger invoice_lines_updated_at before update on invoice_lines for each row execute function set_updated_at();

-- Lines may only change while their invoice is a draft. After that the invoice is a financial record.
create or replace function invoice_lines_draft_only() returns trigger
language plpgsql as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_status text;
begin
  select status into v_status from invoices where id = v_invoice;
  if v_status is distinct from 'draft' then
    raise exception 'Invoice lines can only change while the invoice is a draft' using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_lines_draft_guard before insert or update or delete on invoice_lines
  for each row execute function invoice_lines_draft_only();

-- At commit, every invoice's stored subtotal and tax must equal what its lines produce (tax rounded half up once).
create or replace function invoice_totals_match_lines() returns trigger
language plpgsql as $$
declare
  v_subtotal numeric;
  v_tax numeric;
begin
  select coalesce(sum(line_net_minor), 0),
         floor((coalesce(sum(line_net_minor::numeric * tax_rate_bps), 0) + 5000) / 10000)
    into v_subtotal, v_tax
    from invoice_lines
    where invoice_id = new.id;
  if new.subtotal_minor <> v_subtotal or new.tax_minor <> v_tax then
    raise exception 'Invoice totals do not match the invoice lines' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;
create constraint trigger invoices_totals_check after insert or update of subtotal_minor, tax_minor on invoices
  deferrable initially deferred for each row execute function invoice_totals_match_lines();

-- Once an invoice leaves draft its commercial fields are frozen, void is final, and paid_minor only goes up.
create or replace function invoices_freeze() returns trigger
language plpgsql as $$
begin
  if old.status = 'void' then
    raise exception 'A void invoice cannot change' using errcode = 'restrict_violation';
  end if;
  if old.status <> 'draft' and (
    new.number, new.customer_id, new.customer_name, new.currency, new.issue_date, new.due_date,
    new.subtotal_minor, new.tax_minor, new.total_minor
  ) is distinct from (
    old.number, old.customer_id, old.customer_name, old.currency, old.issue_date, old.due_date,
    old.subtotal_minor, old.tax_minor, old.total_minor
  ) then
    raise exception 'An invoice that is no longer a draft cannot change its amounts, dates or customer' using errcode = 'restrict_violation';
  end if;
  if new.paid_minor < old.paid_minor then
    raise exception 'Paid amount cannot decrease' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
create trigger invoices_freeze_guard before update on invoices for each row execute function invoices_freeze();

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  method text not null check (method in ('cash', 'card', 'knet', 'bank_transfer')),
  paid_at timestamptz not null,
  reference text check (reference is null or char_length(reference) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id)
);
create index payments_invoice_idx on payments (tenant_id, invoice_id, paid_at desc);
create index payments_tenant_paid_idx on payments (tenant_id, paid_at desc, id desc);
create trigger payments_no_update before update on payments for each row execute function prevent_update();
create trigger payments_no_delete before delete on payments for each row execute function prevent_delete();

alter table finance_settings enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;

revoke all on finance_settings, invoices, invoice_lines, payments from anon, authenticated;
grant select on finance_settings, invoices, invoice_lines, payments to authenticated;

create policy finance_settings_select on finance_settings for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.invoice.read'));
create policy invoices_select on invoices for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.invoice.read'));
create policy invoice_lines_select on invoice_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.invoice.read'));
create policy payments_select on payments for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'finance.invoice.read'));
