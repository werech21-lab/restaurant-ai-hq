-- 0017_inventory_valuation: experimental moving weighted average and sales COGS.
--
-- The column default on procurement_accounting and inventory_settings is order_price. A company already saved, and every
-- insert that omits the column, keeps today's books: receipts stay at the order price and a sale posts no COGS. Moving
-- weighted average starts only when the company saves it, and it is not a production-approved policy.
--
-- item_cost_events is append-only. A later receipt, return, invoice variance or void writes a new row. It never updates
-- a previous cost row or a previous journal entry.
--
-- sales_cogs is reversible only by voiding the sales invoice, which names the entry in erp.source_void. A goods receipt
-- and a purchase return stay non-reversible.

alter table procurement_accounting
  add column costing_method text not null default 'order_price'
    check (costing_method in ('order_price', 'moving_weighted_average')),
  add column cogs_account_id uuid;
alter table procurement_accounting
  add constraint procurement_accounting_cogs_fk foreign key (tenant_id, cogs_account_id) references accounts (tenant_id, id),
  add constraint procurement_accounting_costing check (costing_method = 'order_price' or cogs_account_id is not null);

create table inventory_settings (
  tenant_id uuid primary key references tenants (id),
  costing_method text not null default 'order_price' check (costing_method in ('order_price', 'moving_weighted_average')),
  cogs_account_id uuid,
  inventory_account_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint inventory_settings_method check (
    costing_method = 'order_price' or (cogs_account_id is not null and inventory_account_id is not null)
  ),
  constraint inventory_settings_cogs_fk foreign key (tenant_id, cogs_account_id) references accounts (tenant_id, id),
  constraint inventory_settings_inventory_fk foreign key (tenant_id, inventory_account_id) references accounts (tenant_id, id)
);

create table item_cost_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  item_id uuid not null,
  kind text not null check (kind in ('receipt', 'issue', 'purchase_return', 'invoice_variance', 'restore')),
  qty_before integer not null check (qty_before >= 0),
  average_before_minor bigint not null check (average_before_minor >= 0),
  qty_delta integer not null,
  unit_cost_minor bigint not null check (unit_cost_minor >= 0),
  value_delta_minor bigint not null,
  average_after_minor bigint not null check (average_after_minor >= 0),
  reference_type text not null,
  reference_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint item_cost_events_item_fk foreign key (tenant_id, item_id) references items (tenant_id, id)
);
create index item_cost_events_item_idx on item_cost_events (tenant_id, item_id, created_at);
create index item_cost_events_reference_idx on item_cost_events (tenant_id, reference_type, reference_id);

create trigger item_cost_events_no_update before update on item_cost_events
  for each row execute function prevent_update();
create trigger item_cost_events_no_delete before delete on item_cost_events
  for each row execute function prevent_delete();
create trigger inventory_settings_no_delete before delete on inventory_settings
  for each row execute function prevent_delete();

alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in (
    'manual', 'reversal', 'supplier_invoice', 'goods_receipt', 'purchase_return',
    'supplier_credit_note', 'supplier_payment', 'sales_cogs'
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
    if v_source in ('supplier_invoice', 'supplier_credit_note', 'supplier_payment', 'sales_cogs')
       and coalesce(current_setting('erp.source_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a source document can only be reversed by voiding the document' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;

alter table inventory_settings enable row level security;
alter table item_cost_events enable row level security;
revoke all on inventory_settings from anon, authenticated;
revoke all on item_cost_events from anon, authenticated;
grant select on inventory_settings to authenticated;
grant select on item_cost_events to authenticated;

create policy inventory_settings_select on inventory_settings for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));
create policy item_cost_events_select on item_cost_events for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'inventory.item.read'));

-- A moving-average company may put the still-on-hand part of a price variance on inventory, on this new document only.
-- Order price still requires the whole variance on the variance account and nothing on inventory. GRNI is unchanged.
create or replace function supplier_invoices_totals() returns trigger
language plpgsql as $$
declare
  v_lines integer;
  v_subtotal numeric;
  v_tax_numerator numeric;
  v_po_net numeric;
  v_po_rate_numerator numeric;
  v_price_variance numeric;
  v_tax_variance numeric;
  v_inventory numeric;
  v_variance_account numeric;
  v_acc procurement_accounting%rowtype;
begin
  select count(*),
         coalesce(sum(quantity::numeric * unit_cost_minor), 0),
         coalesce(sum(quantity::numeric * unit_cost_minor * tax_rate_bps), 0),
         coalesce(sum(quantity::numeric * coalesce(po_unit_cost_minor, unit_cost_minor)), 0),
         coalesce(sum(quantity::numeric * unit_cost_minor * coalesce(po_tax_rate_bps, tax_rate_bps)), 0)
    into v_lines, v_subtotal, v_tax_numerator, v_po_net, v_po_rate_numerator
    from supplier_invoice_lines where tenant_id = new.tenant_id and invoice_id = new.id;
  if v_lines = 0 then
    raise exception 'A supplier invoice needs at least one line' using errcode = 'restrict_violation';
  end if;
  if v_subtotal <> new.subtotal_minor or floor((v_tax_numerator + 5000) / 10000) <> new.tax_minor then
    raise exception 'The invoice totals do not match its lines' using errcode = 'restrict_violation';
  end if;
  v_price_variance := v_subtotal - v_po_net;
  v_tax_variance := new.tax_minor - floor((v_po_rate_numerator + 5000) / 10000);
  if new.price_variance_minor <> v_price_variance or new.tax_variance_minor <> v_tax_variance then
    raise exception 'The invoice variances do not match its lines' using errcode = 'restrict_violation';
  end if;
  select * into v_acc from procurement_accounting where tenant_id = new.tenant_id;
  if not found then
    raise exception 'The procurement accounts are not set up' using errcode = 'restrict_violation';
  end if;
  if abs(v_tax_variance) > v_acc.tax_tolerance_minor then
    raise exception 'The tax variance of % is beyond the tolerance of %', v_tax_variance, v_acc.tax_tolerance_minor using errcode = 'restrict_violation';
  end if;
  if new.accounting_basis = 'receipt_basis' then
    v_inventory := journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id);
    v_variance_account := journal_net(new.tenant_id, new.journal_entry_id, v_acc.ppv_account_id);
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> v_po_net
       or v_inventory + v_variance_account <> v_price_variance
       or (v_acc.costing_method <> 'moving_weighted_average' and (v_variance_account <> v_price_variance or v_inventory <> 0))
       or (v_price_variance = 0 and v_inventory <> 0)
       or (v_price_variance > 0 and (v_inventory < 0 or v_inventory > v_price_variance))
       or (v_price_variance < 0 and (v_inventory > 0 or v_inventory < v_price_variance)) then
      raise exception 'The invoice entry must clear GRNI at the order price and book the price variance' using errcode = 'restrict_violation';
    end if;
  elsif journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> v_subtotal then
    raise exception 'The invoice entry must debit inventory by the invoice net' using errcode = 'restrict_violation';
  end if;
  if new.tax_minor > 0 and (v_acc.input_tax_account_id is null
     or journal_net(new.tenant_id, new.journal_entry_id, v_acc.input_tax_account_id) <> new.tax_minor) then
    raise exception 'The invoice entry must debit input tax by the invoice tax' using errcode = 'restrict_violation';
  end if;
  if journal_net(new.tenant_id, new.journal_entry_id, v_acc.payable_account_id) <> -new.total_minor then
    raise exception 'The invoice entry must credit the payable account by the invoice total' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function supplier_invoices_totals() from public, anon, authenticated;

create or replace function supplier_credit_notes_totals() returns trigger
language plpgsql as $$
declare
  v_lines integer;
  v_subtotal numeric;
  v_tax_numerator numeric;
  v_po_net numeric;
  v_variance numeric;
  v_inventory numeric;
  v_variance_account numeric;
  v_invoice supplier_invoices%rowtype;
  v_acc procurement_accounting%rowtype;
begin
  select count(*), coalesce(sum(cl.quantity::numeric * cl.unit_cost_minor), 0), coalesce(sum(cl.quantity::numeric * cl.unit_cost_minor * cl.tax_rate_bps), 0),
         coalesce(sum(cl.quantity::numeric * ol.unit_cost_minor), 0)
    into v_lines, v_subtotal, v_tax_numerator, v_po_net
    from supplier_credit_note_lines cl
    join purchase_order_lines ol on ol.tenant_id = cl.tenant_id and ol.id = cl.order_line_id
   where cl.tenant_id = new.tenant_id and cl.credit_note_id = new.id;
  if v_lines = 0 then
    raise exception 'A supplier credit note needs at least one line' using errcode = 'restrict_violation';
  end if;
  if v_subtotal <> new.subtotal_minor or floor((v_tax_numerator + 5000) / 10000) <> new.tax_minor then
    raise exception 'The credit note totals do not match its lines' using errcode = 'restrict_violation';
  end if;
  select * into v_invoice from supplier_invoices where tenant_id = new.tenant_id and id = new.invoice_id;
  if new.status = 'posted' and supplier_invoice_paid(new.tenant_id, new.invoice_id) + supplier_invoice_credited(new.tenant_id, new.invoice_id) > v_invoice.total_minor then
    raise exception 'A credit note cannot exceed the open balance of its invoice' using errcode = 'restrict_violation';
  end if;
  select * into v_acc from procurement_accounting where tenant_id = new.tenant_id;
  if not found then
    raise exception 'The procurement accounts are not set up' using errcode = 'restrict_violation';
  end if;
  if v_invoice.accounting_basis = 'receipt_basis' then
    v_variance := v_subtotal - v_po_net;
    v_inventory := journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id);
    v_variance_account := journal_net(new.tenant_id, new.journal_entry_id, v_acc.ppv_account_id);
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> -v_po_net
       or v_inventory + v_variance_account <> -v_variance
       or (v_acc.costing_method <> 'moving_weighted_average' and (v_variance_account <> -v_variance or v_inventory <> 0))
       or (v_variance = 0 and v_inventory <> 0)
       or (v_variance > 0 and (v_inventory > 0 or v_inventory < -v_variance))
       or (v_variance < 0 and (v_inventory < 0 or v_inventory > -v_variance)) then
      raise exception 'The credit note entry must credit GRNI at the order price and reverse the price variance' using errcode = 'restrict_violation';
    end if;
  elsif journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> -v_subtotal then
    raise exception 'The credit note entry must credit inventory by the credit net' using errcode = 'restrict_violation';
  end if;
  if new.tax_minor > 0 and (v_acc.input_tax_account_id is null
     or journal_net(new.tenant_id, new.journal_entry_id, v_acc.input_tax_account_id) <> -new.tax_minor) then
    raise exception 'The credit note entry must credit input tax by the credit tax' using errcode = 'restrict_violation';
  end if;
  if journal_net(new.tenant_id, new.journal_entry_id, v_acc.payable_account_id) <> new.total_minor then
    raise exception 'The credit note entry must debit the payable account by the credit total' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function supplier_credit_notes_totals() from public, anon, authenticated;
