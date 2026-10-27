-- 0014_procure_to_pay: purchase requests, supplier invoices matched to receipts, and their posting to the double-entry ledger.
--
-- The cycle after this migration:
--   purchase request (draft -> submitted -> approved | rejected -> converted, or cancelled)
--     -> purchase order (0013: draft -> pending_approval -> approved -> partially_received -> received)
--     -> goods receipt (0013: moves stock through the inventory module)
--     -> supplier invoice (this file: posted -> void), which posts one balanced journal entry.
--
-- What the database enforces, so no code path can get around it:
--   * A request's header and lines change only while it is a draft. It follows the allowed transitions and nothing else.
--   * A supplier invoice can only be billed for goods that were RECEIVED and are not yet invoiced: for each order line the
--     invoiced quantity (voided invoices excluded) can never pass the received quantity. The order line is locked
--     (for update) while the quantity is checked, so two concurrent invoices cannot both pass.
--   * An invoice line takes the price and tax of its order line. It cannot differ. A supplier price that differs from the order
--     is an open decision, so it is refused rather than guessed.
--   * The same supplier invoice number cannot be booked twice for one supplier while the first is not voided.
--   * An invoice exists only together with a POSTED journal entry whose source is that invoice and whose total equals the
--     invoice total. Posting itself (0012) proves the entry is balanced, the accounts are postable and the period is open.
--   * At commit the invoice's subtotal and tax must equal what its lines add up to (tax per line in basis points, summed
--     unrounded, rounded half up once).
--   * An invoice and its lines never change or get deleted. The one change is posted -> void, which needs a posted reversing entry
--     that mirrors the invoice's entry. The invoice's entry cannot be reversed in any other way.
--
-- Provisional accounting rule (needs your decision, see docs/ERP_CORE_DESIGN.md): each tenant chooses three accounts in
-- procurement_accounting. An invoice debits the inventory account by the net, debits the input-tax account by the tax (only when
-- there is tax), and credits the payable account by the total. Nothing is posted until the accounts are chosen. Receiving goods
-- does not post to the ledger, and unit costs are not changed (costing is an open decision).
--
-- Currency is KWD only (CHECK on every document), which is the single place to relax when multi-currency is decided.
-- Money is whole fils. Not built: supplier payments, credit notes, returns to supplier.
--
-- Changes to existing data when this runs: each tenant's owner role gains nine procurement permissions. No row is removed,
-- and the journal_entries and purchase_orders tables only gain constraints that every existing row already satisfies.

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
    'procurement.invoice.read', 'procurement.invoice.create', 'procurement.invoice.void'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

-- ---- ledger: entries that come from a supplier invoice ----
alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('manual', 'reversal', 'supplier_invoice'));
alter table journal_entries add constraint journal_entries_source
  check ((source_type = 'supplier_invoice') = (source_id is not null));
create unique index journal_entries_source_once on journal_entries (tenant_id, source_type, source_id) where source_id is not null;

-- An entry created by a supplier invoice is reversed by voiding the invoice, which names the entry in a transaction-local
-- setting. Nobody can reverse it on its own and leave the invoice standing.
create or replace function journal_entries_source_guard() returns trigger
language plpgsql as $$
declare
  v_source text;
begin
  if new.reverses_id is not null then
    select source_type into v_source from journal_entries where tenant_id = new.tenant_id and id = new.reverses_id;
    if v_source = 'supplier_invoice'
       and coalesce(current_setting('erp.supplier_invoice_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a supplier invoice can only be reversed by voiding the invoice' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;
create trigger journal_entries_source_guard before insert on journal_entries for each row execute function journal_entries_source_guard();

alter table purchase_orders add constraint purchase_orders_supplier_ref_key unique (tenant_id, id, supplier_id);

-- ---- purchase requests ----

create table purchase_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  requested_by uuid not null references auth.users (id),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled')),
  needed_by date,
  reason text check (reason is null or char_length(reason) <= 1000),
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  decision_note text check (decision_note is null or char_length(decision_note) between 1 and 500),
  purchase_order_id uuid,
  converted_at timestamptz,
  converted_by uuid references auth.users (id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  cancelled_reason text check (cancelled_reason is null or char_length(cancelled_reason) between 1 and 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_requests_tenant_id_key unique (tenant_id, id),
  constraint purchase_requests_tenant_number_key unique (tenant_id, number),
  constraint purchase_requests_order_fk foreign key (tenant_id, purchase_order_id) references purchase_orders (tenant_id, id),
  constraint purchase_requests_submitted check (status in ('draft', 'cancelled') or (submitted_at is not null and submitted_by is not null)),
  constraint purchase_requests_decided check (
    status not in ('approved', 'rejected', 'converted') or (decided_at is not null and decided_by is not null)
  ),
  constraint purchase_requests_rejected check (status <> 'rejected' or decision_note is not null),
  constraint purchase_requests_converted check (
    (status = 'converted') = (purchase_order_id is not null and converted_at is not null and converted_by is not null)
  ),
  constraint purchase_requests_cancelled check (
    (status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null and cancelled_reason is not null)
  )
);
create unique index purchase_requests_order_once on purchase_requests (tenant_id, purchase_order_id) where purchase_order_id is not null;
create index purchase_requests_number_idx on purchase_requests (tenant_id, number desc, id desc);
create index purchase_requests_status_idx on purchase_requests (tenant_id, status);

create table purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  request_id uuid not null,
  line_no integer not null check (line_no >= 1),
  item_id uuid not null,
  description text not null check (char_length(description) between 1 and 300),
  quantity integer not null check (quantity between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_request_lines_line_key unique (request_id, line_no),
  constraint purchase_request_lines_request_fk foreign key (tenant_id, request_id) references purchase_requests (tenant_id, id),
  constraint purchase_request_lines_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id)
);
create index purchase_request_lines_request_idx on purchase_request_lines (tenant_id, request_id, line_no);

-- ---- the accounts a tenant's supplier invoices post to ----

create table procurement_accounting (
  tenant_id uuid primary key references tenants (id),
  inventory_account_id uuid not null,
  payable_account_id uuid not null,
  input_tax_account_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint procurement_accounting_inventory_fk foreign key (tenant_id, inventory_account_id) references accounts (tenant_id, id),
  constraint procurement_accounting_payable_fk foreign key (tenant_id, payable_account_id) references accounts (tenant_id, id),
  constraint procurement_accounting_tax_fk foreign key (tenant_id, input_tax_account_id) references accounts (tenant_id, id),
  constraint procurement_accounting_distinct check (
    inventory_account_id <> payable_account_id
    and (input_tax_account_id is null or (input_tax_account_id <> inventory_account_id and input_tax_account_id <> payable_account_id))
  )
);

-- ---- supplier invoices ----

create table supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  supplier_id uuid not null,
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  supplier_invoice_number text not null check (char_length(supplier_invoice_number) between 1 and 60),
  order_id uuid not null,
  status text not null default 'posted' check (status in ('posted', 'void')),
  invoice_date date not null,
  due_date date not null,
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  subtotal_minor bigint not null check (subtotal_minor > 0),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor > 0 and total_minor <= 1000000000000),
  notes text check (notes is null or char_length(notes) <= 1000),
  journal_entry_id uuid not null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 500),
  voided_at timestamptz,
  voided_by uuid references auth.users (id),
  void_entry_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint supplier_invoices_tenant_id_key unique (tenant_id, id),
  constraint supplier_invoices_ref_key unique (tenant_id, id, order_id),
  constraint supplier_invoices_tenant_number_key unique (tenant_id, number),
  constraint supplier_invoices_entry_key unique (tenant_id, journal_entry_id),
  constraint supplier_invoices_supplier_fk foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  constraint supplier_invoices_order_fk foreign key (tenant_id, order_id, supplier_id) references purchase_orders (tenant_id, id, supplier_id),
  constraint supplier_invoices_entry_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_invoices_void_entry_fk foreign key (tenant_id, void_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_invoices_total check (subtotal_minor + tax_minor = total_minor),
  constraint supplier_invoices_due check (due_date >= invoice_date),
  constraint supplier_invoices_void check (
    (status = 'void') = (voided_at is not null and voided_by is not null and void_reason is not null and void_entry_id is not null)
  )
);
-- The same supplier cannot bill the same number twice, unless the first booking was voided.
create unique index supplier_invoices_supplier_number_once
  on supplier_invoices (tenant_id, supplier_id, lower(supplier_invoice_number)) where status <> 'void';
create index supplier_invoices_number_idx on supplier_invoices (tenant_id, number desc, id desc);
create index supplier_invoices_order_idx on supplier_invoices (tenant_id, order_id, status);

create table supplier_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  invoice_id uuid not null,
  order_id uuid not null,
  order_line_id uuid not null,
  item_id uuid not null,
  line_no integer not null check (line_no >= 1),
  description text not null check (char_length(description) between 1 and 300),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_cost_minor bigint not null check (unit_cost_minor between 0 and 1000000000),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint supplier_invoice_lines_line_key unique (invoice_id, line_no),
  constraint supplier_invoice_lines_order_line_once unique (invoice_id, order_line_id),
  constraint supplier_invoice_lines_invoice_fk foreign key (tenant_id, invoice_id, order_id) references supplier_invoices (tenant_id, id, order_id),
  constraint supplier_invoice_lines_order_line_fk foreign key (tenant_id, order_line_id, order_id) references purchase_order_lines (tenant_id, id, order_id),
  constraint supplier_invoice_lines_item_fk foreign key (tenant_id, order_line_id, item_id) references purchase_order_lines (tenant_id, id, item_id)
);
create index supplier_invoice_lines_invoice_idx on supplier_invoice_lines (tenant_id, invoice_id, line_no);
create index supplier_invoice_lines_order_line_idx on supplier_invoice_lines (tenant_id, order_line_id);

-- ---- guards ----

create or replace function purchase_requests_guard() returns trigger
language plpgsql as $$
declare
  v_lines integer;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A purchase request starts as a draft' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.requested_by <> old.requested_by or new.created_by <> old.created_by then
    raise exception 'The company, number, requester and creator of a purchase request cannot change' using errcode = 'restrict_violation';
  end if;

  if old.status <> new.status then
    if not (
      (old.status = 'draft' and new.status in ('submitted', 'cancelled'))
      or (old.status = 'submitted' and new.status in ('approved', 'rejected', 'cancelled'))
      or (old.status = 'approved' and new.status in ('converted', 'cancelled'))
    ) then
      raise exception 'A purchase request cannot go from % to %', old.status, new.status using errcode = 'restrict_violation';
    end if;
    if old.status = 'draft' and new.status = 'submitted' then
      select count(*) into v_lines from purchase_request_lines where tenant_id = new.tenant_id and request_id = new.id;
      if v_lines = 0 then
        raise exception 'A purchase request needs at least one line' using errcode = 'restrict_violation';
      end if;
    end if;
  end if;

  if old.status <> 'draft' and (new.needed_by is distinct from old.needed_by or new.reason is distinct from old.reason) then
    raise exception 'Only a draft purchase request can be edited' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function purchase_requests_guard() from public, anon, authenticated;

create or replace function purchase_request_lines_guard() returns trigger
language plpgsql as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_request uuid := coalesce(new.request_id, old.request_id);
  v_status text;
  v_item_active boolean;
begin
  select status into v_status from purchase_requests where tenant_id = v_tenant and id = v_request for share;
  if v_status is distinct from 'draft' then
    raise exception 'Only the lines of a draft purchase request can be edited' using errcode = 'restrict_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.request_id <> old.request_id) then
    raise exception 'A line cannot move to another request' using errcode = 'restrict_violation';
  end if;
  select is_active into v_item_active from items where tenant_id = new.tenant_id and id = new.item_id;
  if not coalesce(v_item_active, false) then
    raise exception 'An inactive item cannot be requested' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function purchase_request_lines_guard() from public, anon, authenticated;

create or replace function procurement_accounting_guard() returns trigger
language plpgsql as $$
declare
  v_type text;
  v_ok boolean;
begin
  select type, is_active and is_postable into v_type, v_ok from accounts where tenant_id = new.tenant_id and id = new.inventory_account_id;
  if v_type is distinct from 'asset' or not coalesce(v_ok, false) then
    raise exception 'The inventory account must be an active, postable asset account' using errcode = 'restrict_violation';
  end if;
  select type, is_active and is_postable into v_type, v_ok from accounts where tenant_id = new.tenant_id and id = new.payable_account_id;
  if v_type is distinct from 'liability' or not coalesce(v_ok, false) then
    raise exception 'The payable account must be an active, postable liability account' using errcode = 'restrict_violation';
  end if;
  if new.input_tax_account_id is not null then
    select is_active and is_postable into v_ok from accounts where tenant_id = new.tenant_id and id = new.input_tax_account_id;
    if not coalesce(v_ok, false) then
      raise exception 'The input tax account must be active and postable' using errcode = 'restrict_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.tenant_id <> old.tenant_id then
    raise exception 'The company of the accounting settings cannot change' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function procurement_accounting_guard() from public, anon, authenticated;

create or replace function supplier_invoices_guard() returns trigger
language plpgsql as $$
declare
  v_order_supplier uuid;
  v_entry journal_entries%rowtype;
  v_debit numeric;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'posted' then
      raise exception 'A supplier invoice is created posted' using errcode = 'restrict_violation';
    end if;
    select supplier_id into v_order_supplier from purchase_orders where tenant_id = new.tenant_id and id = new.order_id;
    if v_order_supplier is distinct from new.supplier_id then
      raise exception 'The supplier of an invoice must be the supplier of its purchase order' using errcode = 'restrict_violation';
    end if;
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'supplier_invoice' or v_entry.source_id is distinct from new.id then
      raise exception 'A supplier invoice needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
    end if;
    select coalesce(sum(debit_minor), 0) into v_debit from journal_lines where tenant_id = new.tenant_id and entry_id = new.journal_entry_id;
    if v_debit <> new.total_minor then
      raise exception 'The invoice total must equal the total of its journal entry' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if old.status = 'void' then
    raise exception 'A voided supplier invoice is final' using errcode = 'restrict_violation';
  end if;
  if new.status <> 'void' then
    raise exception 'A posted supplier invoice cannot change' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.supplier_id <> old.supplier_id
     or new.supplier_name <> old.supplier_name or new.supplier_invoice_number <> old.supplier_invoice_number
     or new.order_id <> old.order_id or new.invoice_date <> old.invoice_date or new.due_date <> old.due_date
     or new.subtotal_minor <> old.subtotal_minor or new.tax_minor <> old.tax_minor or new.total_minor <> old.total_minor
     or new.notes is distinct from old.notes or new.journal_entry_id <> old.journal_entry_id or new.created_by <> old.created_by then
    raise exception 'Only the status of a supplier invoice can change, and only to void' using errcode = 'restrict_violation';
  end if;
  select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.void_entry_id for share;
  if not found or v_entry.status <> 'posted' or v_entry.reverses_id is distinct from old.journal_entry_id then
    raise exception 'Voiding needs a posted entry that reverses the invoice entry' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_invoices_guard() from public, anon, authenticated;

-- Runs at commit: what the lines add up to must be what the invoice says. Tax per line, summed unrounded, rounded half up once.
create or replace function supplier_invoices_totals() returns trigger
language plpgsql as $$
declare
  v_lines integer;
  v_subtotal numeric;
  v_tax_numerator numeric;
begin
  select count(*), coalesce(sum(quantity::numeric * unit_cost_minor), 0), coalesce(sum(quantity::numeric * unit_cost_minor * tax_rate_bps), 0)
    into v_lines, v_subtotal, v_tax_numerator
    from supplier_invoice_lines where tenant_id = new.tenant_id and invoice_id = new.id;
  if v_lines = 0 then
    raise exception 'A supplier invoice needs at least one line' using errcode = 'restrict_violation';
  end if;
  if v_subtotal <> new.subtotal_minor or floor((v_tax_numerator + 5000) / 10000) <> new.tax_minor then
    raise exception 'The invoice totals do not match its lines' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function supplier_invoices_totals() from public, anon, authenticated;

-- Billing is limited to what was received and is not yet invoiced. The order line is locked so concurrent invoices queue up.
create or replace function supplier_invoice_lines_guard() returns trigger
language plpgsql as $$
declare
  v_line purchase_order_lines%rowtype;
  v_invoiced numeric;
begin
  -- Lines belong to the transaction that creates the invoice. A posted invoice never gains a line later.
  if not exists (select 1 from supplier_invoices where tenant_id = new.tenant_id and id = new.invoice_id and created_at = now()) then
    raise exception 'The lines of a supplier invoice can only be added while the invoice is being created' using errcode = 'restrict_violation';
  end if;
  select * into v_line from purchase_order_lines
    where tenant_id = new.tenant_id and id = new.order_line_id and order_id = new.order_id
    for update;
  if not found then
    raise exception 'An invoice line must belong to the purchase order' using errcode = 'restrict_violation';
  end if;
  if new.unit_cost_minor <> v_line.unit_cost_minor or new.tax_rate_bps <> v_line.tax_rate_bps then
    raise exception 'An invoice line must use the price and tax of its order line' using errcode = 'restrict_violation';
  end if;
  select coalesce(sum(l.quantity), 0) into v_invoiced
    from supplier_invoice_lines l
    join supplier_invoices i on i.tenant_id = l.tenant_id and i.id = l.invoice_id
    where l.tenant_id = new.tenant_id and l.order_line_id = new.order_line_id and i.status <> 'void';
  if v_invoiced + new.quantity > v_line.received_quantity then
    raise exception 'Only % of line % is received and not yet invoiced', v_line.received_quantity - v_invoiced, v_line.line_no
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_invoice_lines_guard() from public, anon, authenticated;

create trigger purchase_requests_guard before insert or update on purchase_requests for each row execute function purchase_requests_guard();
create trigger purchase_requests_updated_at before update on purchase_requests for each row execute function set_updated_at();
create trigger purchase_requests_no_delete before delete on purchase_requests for each row execute function prevent_delete();

create trigger purchase_request_lines_guard before insert or update or delete on purchase_request_lines for each row execute function purchase_request_lines_guard();
create trigger purchase_request_lines_updated_at before update on purchase_request_lines for each row execute function set_updated_at();

create trigger procurement_accounting_guard before insert or update on procurement_accounting for each row execute function procurement_accounting_guard();
create trigger procurement_accounting_updated_at before update on procurement_accounting for each row execute function set_updated_at();
create trigger procurement_accounting_no_delete before delete on procurement_accounting for each row execute function prevent_delete();

create trigger supplier_invoices_guard before insert or update on supplier_invoices for each row execute function supplier_invoices_guard();
create trigger supplier_invoices_updated_at before update on supplier_invoices for each row execute function set_updated_at();
create trigger supplier_invoices_no_delete before delete on supplier_invoices for each row execute function prevent_delete();
create constraint trigger supplier_invoices_totals after insert on supplier_invoices
  deferrable initially deferred for each row execute function supplier_invoices_totals();

create trigger supplier_invoice_lines_guard before insert on supplier_invoice_lines for each row execute function supplier_invoice_lines_guard();
create trigger supplier_invoice_lines_no_update before update on supplier_invoice_lines for each row execute function prevent_update();
create trigger supplier_invoice_lines_no_delete before delete on supplier_invoice_lines for each row execute function prevent_delete();

-- ---- access ----
alter table purchase_requests enable row level security;
alter table purchase_request_lines enable row level security;
alter table procurement_accounting enable row level security;
alter table supplier_invoices enable row level security;
alter table supplier_invoice_lines enable row level security;
revoke all on purchase_requests, purchase_request_lines, procurement_accounting, supplier_invoices, supplier_invoice_lines from anon, authenticated;
grant select on purchase_requests, purchase_request_lines, procurement_accounting, supplier_invoices, supplier_invoice_lines to authenticated;

create policy purchase_requests_select on purchase_requests for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.request.read'));
create policy purchase_request_lines_select on purchase_request_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.request.read'));
create policy procurement_accounting_select on procurement_accounting for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.invoice.read'));
create policy supplier_invoices_select on supplier_invoices for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.invoice.read'));
create policy supplier_invoice_lines_select on supplier_invoice_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.invoice.read'));

-- Existing tenants: the owner role gains the new permissions.
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;
