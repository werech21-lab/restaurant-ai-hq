-- 0015_p2p_financial_completion: goods-received-not-invoiced (GRNI) accounting, three-way match with tolerances, purchase returns,
-- supplier credit notes and supplier payments with settlement.
--
-- The cycle after this migration:
--   request -> order -> goods receipt -> supplier invoice (matched) -> payment(s) -> settled
--                            \-> purchase return -> supplier credit note
--
-- Two accounting bases, chosen per company in procurement_accounting (provisional, see docs/ERP_CORE_DESIGN.md section 14):
--   invoice_basis  (the default, and what 0014 did): stock is booked to the ledger when the supplier invoice is booked.
--                  Dr inventory (billed net), Dr input tax, Cr payable. Receipts and returns post nothing.
--   receipt_basis  (perpetual): stock is booked when it is received, at the purchase-order price.
--                  Receipt:  Dr inventory, Cr GRNI.            Return:   Dr GRNI, Cr inventory.
--                  Invoice:  Dr GRNI (order price x qty), Dr/Cr purchase price variance (billed - order), Dr input tax, Cr payable.
--                  Credit:   Dr payable, Cr GRNI, Cr/Dr purchase price variance, Cr input tax.
--   Valuation stays quantity x price. No FIFO or average cost is introduced; item unit costs are not changed.
--
-- What the database enforces, so no code path can get around it:
--   * Three-way match. An invoice line can bill only what was received, minus what was returned, minus what is already billed
--     (net of credit notes). The order line is locked (for update) while the quantity is checked. The billed price may differ from
--     the order price only inside the company's price tolerance (basis points of the order price); the tax of the whole invoice
--     may differ from the tax at the order's rates only inside the tax tolerance (fils). The order price and rate are copied onto
--     the line by the database itself, and the variances are recomputed at commit and must equal what the invoice stores.
--   * Every ledger entry of a document is checked at commit against the document's lines: the right accounts, the right
--     amounts. A receipt, return, invoice, credit note or payment cannot exist with an entry that does not describe it.
--   * Every document moves stock or money exactly once: one entry per source (unique index), a unique supplier invoice, credit
--     note and payment reference while not void, and a receipt/return has stock movements that equal its lines.
--   * A return cannot exceed what was received. A credit note covers only goods that were billed and are no longer held
--     (returned), and never more than the invoice's open balance. A payment is fully allocated to invoices of the same
--     supplier and never beyond an invoice's open balance (total - paid - credited). Invoices are locked while allocated, so two
--     concurrent payments or credits cannot both pass.
--   * An invoice with a payment or a credit note cannot be voided. A payment or a credit note is voided only by a reversing entry.
--   * Receipts, returns and allocations never change or get deleted. Credit notes and payments change only posted -> void.
--   * The accounts, the basis and the tolerances: the basis cannot change once a receipt or an invoice exists, and the accounts
--     cannot change once a procurement entry was posted (a change would split one balance across two accounts).
--
-- Not built, on purpose, because each needs a decision: refunds of paid invoices, advance payments (unallocated), payment
-- approval, variance approval above the tolerance, return voiding, multi-currency, FIFO or average costing.
--
-- Changes to existing data when this runs: each tenant's owner role gains eight procurement permissions, and procurement
-- tables gain columns whose defaults keep every existing row valid. No row is removed. 0014 never produced a variance, so the
-- new variance columns default to zero.

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
    'procurement.creditnote.read', 'procurement.creditnote.create', 'procurement.creditnote.void'
  ]
$$;
revoke all on function erp_owner_extra_permissions() from public, anon, authenticated;

-- ---- ledger: entries that come from procurement documents ----
alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('manual', 'reversal', 'supplier_invoice', 'goods_receipt', 'purchase_return', 'supplier_credit_note', 'supplier_payment'));
alter table journal_entries drop constraint journal_entries_source;
alter table journal_entries add constraint journal_entries_source
  check ((source_type not in ('manual', 'reversal')) = (source_id is not null));

-- A receipt or a return is never reversed (a mistake is corrected by a return or a credit note). An invoice, a credit note or a
-- payment is reversed by voiding its document, which names the entry in a transaction-local setting. Nobody can reverse such an
-- entry on its own and leave the document standing.
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
    if v_source in ('supplier_invoice', 'supplier_credit_note', 'supplier_payment')
       and coalesce(current_setting('erp.source_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a procurement document can only be reversed by voiding the document' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;

-- Reads used by the guards below. Net = debit - credit over the lines of one entry on one account.
create or replace function journal_net(p_tenant uuid, p_entry uuid, p_account uuid) returns numeric
language sql stable as $$
  select coalesce(sum(debit_minor - credit_minor), 0) from journal_lines
   where tenant_id = p_tenant and entry_id = p_entry and account_id = p_account
$$;
revoke all on function journal_net(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function journal_debit_total(p_tenant uuid, p_entry uuid) returns numeric
language sql stable as $$
  select coalesce(sum(debit_minor), 0) from journal_lines where tenant_id = p_tenant and entry_id = p_entry
$$;
revoke all on function journal_debit_total(uuid, uuid) from public, anon, authenticated;

-- ---- accounting settings ----
alter table procurement_accounting
  add column accounting_basis text not null default 'invoice_basis' check (accounting_basis in ('invoice_basis', 'receipt_basis')),
  add column grni_account_id uuid,
  add column ppv_account_id uuid,
  add column price_tolerance_bps integer not null default 0 check (price_tolerance_bps between 0 and 10000),
  add column tax_tolerance_minor bigint not null default 0 check (tax_tolerance_minor between 0 and 1000000000);
alter table procurement_accounting
  add constraint procurement_accounting_grni_fk foreign key (tenant_id, grni_account_id) references accounts (tenant_id, id),
  add constraint procurement_accounting_ppv_fk foreign key (tenant_id, ppv_account_id) references accounts (tenant_id, id),
  add constraint procurement_accounting_basis check (accounting_basis = 'invoice_basis' or (grni_account_id is not null and ppv_account_id is not null));

create or replace function procurement_accounting_guard() returns trigger
language plpgsql as $$
declare
  v_type text;
  v_ok boolean;
  v_ids uuid[];
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
  if new.grni_account_id is not null then
    select type, is_active and is_postable into v_type, v_ok from accounts where tenant_id = new.tenant_id and id = new.grni_account_id;
    if v_type is distinct from 'liability' or not coalesce(v_ok, false) then
      raise exception 'The GRNI account must be an active, postable liability account' using errcode = 'restrict_violation';
    end if;
  end if;
  if new.ppv_account_id is not null then
    select type, is_active and is_postable into v_type, v_ok from accounts where tenant_id = new.tenant_id and id = new.ppv_account_id;
    if v_type is distinct from 'expense' or not coalesce(v_ok, false) then
      raise exception 'The purchase price variance account must be an active, postable expense account' using errcode = 'restrict_violation';
    end if;
  end if;
  v_ids := array_remove(array[new.inventory_account_id, new.payable_account_id, new.input_tax_account_id, new.grni_account_id, new.ppv_account_id], null);
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x) then
    raise exception 'The procurement accounts must all be different' using errcode = 'restrict_violation';
  end if;
  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id then
      raise exception 'The company of the accounting settings cannot change' using errcode = 'restrict_violation';
    end if;
    if new.accounting_basis <> old.accounting_basis and (
      exists (select 1 from goods_receipts where tenant_id = new.tenant_id)
      or exists (select 1 from supplier_invoices where tenant_id = new.tenant_id)
    ) then
      raise exception 'The accounting basis cannot change once a receipt or a supplier invoice exists' using errcode = 'restrict_violation';
    end if;
    if (
      new.inventory_account_id <> old.inventory_account_id or new.payable_account_id <> old.payable_account_id
      or new.input_tax_account_id is distinct from old.input_tax_account_id
      or new.grni_account_id is distinct from old.grni_account_id or new.ppv_account_id is distinct from old.ppv_account_id
    ) and exists (
      select 1 from journal_entries
       where tenant_id = new.tenant_id
         and source_type in ('supplier_invoice', 'goods_receipt', 'purchase_return', 'supplier_credit_note', 'supplier_payment')
    ) then
      raise exception 'The procurement accounts cannot change once a procurement entry was posted' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function procurement_accounting_guard() from public, anon, authenticated;

-- ---- order lines: what went back to the supplier ----
alter table purchase_order_lines
  add column returned_quantity integer not null default 0 check (returned_quantity >= 0),
  add constraint purchase_order_lines_returned check (returned_quantity <= received_quantity);

create or replace function purchase_order_lines_guard() returns trigger
language plpgsql as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_status text;
  v_item_active boolean;
begin
  select status into v_status from purchase_orders where tenant_id = v_tenant and id = v_order for share;
  if tg_op = 'UPDATE' then
    if new.tenant_id <> old.tenant_id or new.order_id <> old.order_id or new.line_no <> old.line_no or new.item_id <> old.item_id
       or new.description <> old.description or new.quantity <> old.quantity or new.unit_cost_minor <> old.unit_cost_minor
       or new.tax_rate_bps <> old.tax_rate_bps then
      if v_status is distinct from 'draft' then
        raise exception 'Only the lines of a draft purchase order can be edited' using errcode = 'restrict_violation';
      end if;
    end if;
    if new.received_quantity < old.received_quantity then
      raise exception 'A received quantity cannot go down' using errcode = 'restrict_violation';
    end if;
    if new.received_quantity <> old.received_quantity and v_status not in ('approved', 'partially_received') then
      raise exception 'Goods can only be received against an approved order' using errcode = 'restrict_violation';
    end if;
    if new.returned_quantity <> old.returned_quantity and (
      new.returned_quantity < old.returned_quantity or coalesce(current_setting('erp.return_apply', true), '') <> 'on'
    ) then
      raise exception 'A returned quantity only goes up, and only through a purchase return' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  if v_status is distinct from 'draft' then
    raise exception 'Only the lines of a draft purchase order can be edited' using errcode = 'restrict_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.received_quantity <> 0 or new.returned_quantity <> 0 then
      raise exception 'A new line has nothing received' using errcode = 'restrict_violation';
    end if;
    select is_active into v_item_active from items where tenant_id = new.tenant_id and id = new.item_id;
    if not coalesce(v_item_active, false) then
      raise exception 'An inactive item cannot be ordered' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  return old;
end;
$$;
revoke all on function purchase_order_lines_guard() from public, anon, authenticated;

-- ---- inventory ledger: a return is traceable to the movement it caused ----
alter table stock_movements drop constraint stock_movements_reference;
alter table stock_movements drop constraint stock_movements_reference_type_check;
alter table stock_movements add constraint stock_movements_reference_type_check
  check (reference_type in ('manual', 'invoice', 'transfer', 'restock', 'purchase_receipt', 'purchase_return'));
alter table stock_movements add constraint stock_movements_reference check (
  (reference_type = 'manual' and reference_id is null)
  or (reference_type in ('invoice', 'transfer', 'restock', 'purchase_receipt', 'purchase_return') and reference_id is not null)
);

-- ---- goods receipts: the entry that books the stock (receipt basis only) ----
alter table goods_receipts
  add column journal_entry_id uuid,
  add column value_minor bigint not null default 0 check (value_minor between 0 and 1000000000000),
  add constraint goods_receipts_entry_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  add constraint goods_receipts_entry_value check (journal_entry_id is null or value_minor > 0);
create unique index goods_receipts_entry_once on goods_receipts (tenant_id, journal_entry_id) where journal_entry_id is not null;

create or replace function goods_receipts_guard() returns trigger
language plpgsql as $$
declare
  v_status text;
  v_entry journal_entries%rowtype;
begin
  select status into v_status from purchase_orders where tenant_id = new.tenant_id and id = new.order_id for share;
  if v_status not in ('approved', 'partially_received') then
    raise exception 'Goods can only be received against an approved order' using errcode = 'restrict_violation';
  end if;
  if new.journal_entry_id is not null then
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'goods_receipt' or v_entry.source_id is distinct from new.id then
      raise exception 'A goods receipt needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function goods_receipts_guard() from public, anon, authenticated;

-- Runs at commit: the receipt's value equals its lines at the order prices, the stock it moved equals its lines, and on the
-- receipt basis the entry is Dr inventory / Cr GRNI for exactly that value.
create or replace function goods_receipts_posting() returns trigger
language plpgsql as $$
declare
  v_value numeric;
  v_quantity numeric;
  v_moved numeric;
  v_acc procurement_accounting%rowtype;
begin
  select coalesce(sum(l.quantity::numeric * ol.unit_cost_minor), 0), coalesce(sum(l.quantity), 0)
    into v_value, v_quantity
    from goods_receipt_lines l
    join purchase_order_lines ol on ol.tenant_id = l.tenant_id and ol.id = l.order_line_id
   where l.tenant_id = new.tenant_id and l.receipt_id = new.id;
  if v_value <> new.value_minor then
    raise exception 'The receipt value does not match its lines' using errcode = 'restrict_violation';
  end if;
  select coalesce(sum(quantity), 0) into v_moved from stock_movements
   where tenant_id = new.tenant_id and reference_type = 'purchase_receipt' and reference_id = new.id and quantity > 0;
  if v_moved <> v_quantity then
    raise exception 'The stock moved by a receipt must equal its lines' using errcode = 'restrict_violation';
  end if;
  select * into v_acc from procurement_accounting where tenant_id = new.tenant_id;
  if found and v_acc.accounting_basis = 'receipt_basis' and v_value > 0 then
    if new.journal_entry_id is null then
      raise exception 'A receipt on the receipt basis needs its journal entry' using errcode = 'restrict_violation';
    end if;
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> v_value
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> -v_value
       or journal_debit_total(new.tenant_id, new.journal_entry_id) <> v_value then
      raise exception 'The receipt entry must debit inventory and credit GRNI by the receipt value' using errcode = 'restrict_violation';
    end if;
  elsif new.journal_entry_id is not null then
    raise exception 'A receipt posts to the ledger only on the receipt basis' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function goods_receipts_posting() from public, anon, authenticated;

-- ---- supplier invoices: the match ----
alter table supplier_invoices
  add column accounting_basis text not null default 'invoice_basis' check (accounting_basis in ('invoice_basis', 'receipt_basis')),
  add column price_variance_minor bigint not null default 0,
  add column tax_variance_minor bigint not null default 0,
  add constraint supplier_invoices_supplier_ref_key unique (tenant_id, id, supplier_id);
alter table supplier_invoice_lines
  add column po_unit_cost_minor bigint check (po_unit_cost_minor is null or po_unit_cost_minor between 0 and 1000000000),
  add column po_tax_rate_bps integer check (po_tax_rate_bps is null or po_tax_rate_bps between 0 and 10000),
  add constraint supplier_invoice_lines_invoice_key unique (tenant_id, id, invoice_id);

-- What an invoice has been paid and credited. Both ignore voided payments and credit notes.
create or replace function supplier_invoice_paid(p_tenant uuid, p_invoice uuid) returns numeric
language plpgsql stable as $$
begin
  return (
    select coalesce(sum(a.amount_minor), 0)
      from supplier_payment_allocations a
      join supplier_payments p on p.tenant_id = a.tenant_id and p.id = a.payment_id
     where a.tenant_id = p_tenant and a.invoice_id = p_invoice and p.status = 'posted'
  );
end;
$$;
revoke all on function supplier_invoice_paid(uuid, uuid) from public, anon, authenticated;

create or replace function supplier_invoice_credited(p_tenant uuid, p_invoice uuid) returns numeric
language plpgsql stable as $$
begin
  return (
    select coalesce(sum(total_minor), 0) from supplier_credit_notes where tenant_id = p_tenant and invoice_id = p_invoice and status = 'posted'
  );
end;
$$;
revoke all on function supplier_invoice_credited(uuid, uuid) from public, anon, authenticated;

create or replace function supplier_invoices_guard() returns trigger
language plpgsql as $$
declare
  v_order_supplier uuid;
  v_entry journal_entries%rowtype;
  v_basis text;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'posted' then
      raise exception 'A supplier invoice is created posted' using errcode = 'restrict_violation';
    end if;
    select supplier_id into v_order_supplier from purchase_orders where tenant_id = new.tenant_id and id = new.order_id;
    if v_order_supplier is distinct from new.supplier_id then
      raise exception 'The supplier of an invoice must be the supplier of its purchase order' using errcode = 'restrict_violation';
    end if;
    select accounting_basis into v_basis from procurement_accounting where tenant_id = new.tenant_id;
    if new.accounting_basis is distinct from coalesce(v_basis, 'invoice_basis') then
      raise exception 'The invoice must use the accounting basis of the company' using errcode = 'restrict_violation';
    end if;
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'supplier_invoice' or v_entry.source_id is distinct from new.id then
      raise exception 'A supplier invoice needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
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
     or new.notes is distinct from old.notes or new.journal_entry_id <> old.journal_entry_id or new.created_by <> old.created_by
     or new.accounting_basis <> old.accounting_basis or new.price_variance_minor <> old.price_variance_minor
     or new.tax_variance_minor <> old.tax_variance_minor then
    raise exception 'Only the status of a supplier invoice can change, and only to void' using errcode = 'restrict_violation';
  end if;
  if supplier_invoice_paid(new.tenant_id, new.id) > 0 then
    raise exception 'An invoice with a payment cannot be voided; void the payment first' using errcode = 'restrict_violation';
  end if;
  if supplier_invoice_credited(new.tenant_id, new.id) > 0 then
    raise exception 'An invoice with a credit note cannot be voided; void the credit note first' using errcode = 'restrict_violation';
  end if;
  select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.void_entry_id for share;
  if not found or v_entry.status <> 'posted' or v_entry.reverses_id is distinct from old.journal_entry_id then
    raise exception 'Voiding needs a posted entry that reverses the invoice entry' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_invoices_guard() from public, anon, authenticated;

-- Runs at commit. The totals are what the lines add up to (tax per line in basis points, summed unrounded, rounded half up once),
-- the stored variances are what the lines say, the tax variance is inside the tolerance, and the journal entry describes
-- the invoice account by account.
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
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> v_po_net
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.ppv_account_id) <> v_price_variance
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> 0 then
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

-- Billing is limited to what was received, minus what went back, minus what is already billed (net of credit notes). The order
-- line is locked so concurrent invoices, returns and credit notes queue up. The order price and rate are copied onto the line by
-- the database, and the billed price must be inside the tolerance.
create or replace function supplier_invoice_lines_guard() returns trigger
language plpgsql as $$
declare
  v_line purchase_order_lines%rowtype;
  v_invoiced numeric;
  v_credited numeric;
  v_tolerance integer;
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
  new.po_unit_cost_minor := v_line.unit_cost_minor;
  new.po_tax_rate_bps := v_line.tax_rate_bps;
  select coalesce((select price_tolerance_bps from procurement_accounting where tenant_id = new.tenant_id), 0) into v_tolerance;
  if abs(new.unit_cost_minor - v_line.unit_cost_minor)::numeric * 10000 > v_tolerance::numeric * v_line.unit_cost_minor then
    raise exception 'The billed price of line % is beyond the price tolerance', v_line.line_no using errcode = 'restrict_violation';
  end if;
  select coalesce(sum(l.quantity), 0) into v_invoiced
    from supplier_invoice_lines l
    join supplier_invoices i on i.tenant_id = l.tenant_id and i.id = l.invoice_id
    where l.tenant_id = new.tenant_id and l.order_line_id = new.order_line_id and i.status <> 'void';
  select coalesce(sum(cl.quantity), 0) into v_credited
    from supplier_credit_note_lines cl
    join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
    where cl.tenant_id = new.tenant_id and cl.order_line_id = new.order_line_id and c.status <> 'void';
  if (v_invoiced - v_credited) + new.quantity > v_line.received_quantity - v_line.returned_quantity then
    raise exception 'Only % of line % is received and not yet invoiced',
      v_line.received_quantity - v_line.returned_quantity - (v_invoiced - v_credited), v_line.line_no using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_invoice_lines_guard() from public, anon, authenticated;

-- ---- purchase returns ----
create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  supplier_id uuid not null,
  order_id uuid not null,
  warehouse_id uuid not null,
  return_date date not null,
  reason text not null check (char_length(reason) between 1 and 500),
  value_minor bigint not null check (value_minor between 0 and 1000000000000),
  journal_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_returns_tenant_id_key unique (tenant_id, id),
  constraint purchase_returns_ref_key unique (tenant_id, id, order_id),
  constraint purchase_returns_tenant_number_key unique (tenant_id, number),
  constraint purchase_returns_order_fk foreign key (tenant_id, order_id, supplier_id) references purchase_orders (tenant_id, id, supplier_id),
  constraint purchase_returns_warehouse_fk foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  constraint purchase_returns_entry_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint purchase_returns_entry_value check (journal_entry_id is null or value_minor > 0)
);
create unique index purchase_returns_entry_once on purchase_returns (tenant_id, journal_entry_id) where journal_entry_id is not null;
create index purchase_returns_order_idx on purchase_returns (tenant_id, order_id, created_at);
create index purchase_returns_number_idx on purchase_returns (tenant_id, number desc, id desc);

create table purchase_return_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  return_id uuid not null,
  order_id uuid not null,
  order_line_id uuid not null,
  item_id uuid not null,
  line_no integer not null check (line_no >= 1),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_cost_minor bigint not null check (unit_cost_minor between 0 and 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint purchase_return_lines_line_key unique (return_id, line_no),
  constraint purchase_return_lines_order_line_once unique (return_id, order_line_id),
  constraint purchase_return_lines_return_fk foreign key (tenant_id, return_id, order_id) references purchase_returns (tenant_id, id, order_id),
  constraint purchase_return_lines_order_line_fk foreign key (tenant_id, order_line_id, order_id) references purchase_order_lines (tenant_id, id, order_id),
  constraint purchase_return_lines_item_fk foreign key (tenant_id, order_line_id, item_id) references purchase_order_lines (tenant_id, id, item_id)
);
create index purchase_return_lines_return_idx on purchase_return_lines (tenant_id, return_id, line_no);

create or replace function purchase_returns_guard() returns trigger
language plpgsql as $$
declare
  v_entry journal_entries%rowtype;
begin
  if not exists (select 1 from purchase_orders where tenant_id = new.tenant_id and id = new.order_id and supplier_id = new.supplier_id) then
    raise exception 'The supplier of a return must be the supplier of its purchase order' using errcode = 'restrict_violation';
  end if;
  if new.journal_entry_id is not null then
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'purchase_return' or v_entry.source_id is distinct from new.id then
      raise exception 'A purchase return needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function purchase_returns_guard() from public, anon, authenticated;

-- The order line is locked while the returned quantity is checked, so two concurrent returns cannot both pass.
create or replace function purchase_return_lines_guard() returns trigger
language plpgsql as $$
declare
  v_line purchase_order_lines%rowtype;
begin
  if not exists (select 1 from purchase_returns where tenant_id = new.tenant_id and id = new.return_id and created_at = now()) then
    raise exception 'The lines of a purchase return can only be added while the return is being created' using errcode = 'restrict_violation';
  end if;
  select * into v_line from purchase_order_lines
    where tenant_id = new.tenant_id and id = new.order_line_id and order_id = new.order_id
    for update;
  if not found then
    raise exception 'A return line must belong to the purchase order' using errcode = 'restrict_violation';
  end if;
  new.unit_cost_minor := v_line.unit_cost_minor;
  if v_line.returned_quantity + new.quantity > v_line.received_quantity then
    raise exception 'Only % of line % can still be returned', v_line.received_quantity - v_line.returned_quantity, v_line.line_no
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function purchase_return_lines_guard() from public, anon, authenticated;

create or replace function purchase_return_lines_apply() returns trigger
language plpgsql as $$
begin
  perform set_config('erp.return_apply', 'on', true);
  update purchase_order_lines set returned_quantity = returned_quantity + new.quantity
    where tenant_id = new.tenant_id and id = new.order_line_id;
  perform set_config('erp.return_apply', '', true);
  return new;
end;
$$;
revoke all on function purchase_return_lines_apply() from public, anon, authenticated;

-- Runs at commit: value = lines at the order prices, the stock that left equals the lines, and on the receipt basis the entry is
-- Dr GRNI / Cr inventory for exactly that value.
create or replace function purchase_returns_posting() returns trigger
language plpgsql as $$
declare
  v_value numeric;
  v_quantity numeric;
  v_moved numeric;
  v_lines integer;
  v_acc procurement_accounting%rowtype;
begin
  select count(*), coalesce(sum(quantity::numeric * unit_cost_minor), 0), coalesce(sum(quantity), 0)
    into v_lines, v_value, v_quantity from purchase_return_lines where tenant_id = new.tenant_id and return_id = new.id;
  if v_lines = 0 then
    raise exception 'A purchase return needs at least one line' using errcode = 'restrict_violation';
  end if;
  if v_value <> new.value_minor then
    raise exception 'The return value does not match its lines' using errcode = 'restrict_violation';
  end if;
  select coalesce(-sum(quantity), 0) into v_moved from stock_movements
   where tenant_id = new.tenant_id and reference_type = 'purchase_return' and reference_id = new.id and quantity < 0;
  if v_moved <> v_quantity then
    raise exception 'The stock moved by a return must equal its lines' using errcode = 'restrict_violation';
  end if;
  select * into v_acc from procurement_accounting where tenant_id = new.tenant_id;
  if found and v_acc.accounting_basis = 'receipt_basis' and v_value > 0 then
    if new.journal_entry_id is null then
      raise exception 'A return on the receipt basis needs its journal entry' using errcode = 'restrict_violation';
    end if;
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> v_value
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> -v_value
       or journal_debit_total(new.tenant_id, new.journal_entry_id) <> v_value then
      raise exception 'The return entry must debit GRNI and credit inventory by the return value' using errcode = 'restrict_violation';
    end if;
  elsif new.journal_entry_id is not null then
    raise exception 'A return posts to the ledger only on the receipt basis' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function purchase_returns_posting() from public, anon, authenticated;

-- ---- supplier credit notes ----
create table supplier_credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  supplier_id uuid not null,
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  supplier_credit_note_number text not null check (char_length(supplier_credit_note_number) between 1 and 60),
  invoice_id uuid not null,
  order_id uuid not null,
  status text not null default 'posted' check (status in ('posted', 'void')),
  credit_date date not null,
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  subtotal_minor bigint not null check (subtotal_minor > 0),
  tax_minor bigint not null check (tax_minor >= 0),
  total_minor bigint not null check (total_minor > 0 and total_minor <= 1000000000000),
  reason text not null check (char_length(reason) between 1 and 500),
  journal_entry_id uuid not null,
  void_reason text check (void_reason is null or char_length(void_reason) between 1 and 500),
  voided_at timestamptz,
  voided_by uuid references auth.users (id),
  void_entry_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint supplier_credit_notes_tenant_id_key unique (tenant_id, id),
  constraint supplier_credit_notes_ref_key unique (tenant_id, id, invoice_id),
  constraint supplier_credit_notes_tenant_number_key unique (tenant_id, number),
  constraint supplier_credit_notes_entry_key unique (tenant_id, journal_entry_id),
  constraint supplier_credit_notes_invoice_fk foreign key (tenant_id, invoice_id, order_id) references supplier_invoices (tenant_id, id, order_id),
  constraint supplier_credit_notes_supplier_fk foreign key (tenant_id, invoice_id, supplier_id) references supplier_invoices (tenant_id, id, supplier_id),
  constraint supplier_credit_notes_entry_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_credit_notes_void_entry_fk foreign key (tenant_id, void_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_credit_notes_total check (subtotal_minor + tax_minor = total_minor),
  constraint supplier_credit_notes_void check (
    (status = 'void') = (voided_at is not null and voided_by is not null and void_reason is not null and void_entry_id is not null)
  )
);
create unique index supplier_credit_notes_supplier_number_once
  on supplier_credit_notes (tenant_id, supplier_id, lower(supplier_credit_note_number)) where status <> 'void';
create index supplier_credit_notes_number_idx on supplier_credit_notes (tenant_id, number desc, id desc);
create index supplier_credit_notes_invoice_idx on supplier_credit_notes (tenant_id, invoice_id, status);

create table supplier_credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  credit_note_id uuid not null,
  invoice_id uuid not null,
  order_id uuid,
  order_line_id uuid,
  invoice_line_id uuid not null,
  item_id uuid,
  line_no integer not null check (line_no >= 1),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_cost_minor bigint not null check (unit_cost_minor between 0 and 1000000000),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint supplier_credit_note_lines_line_key unique (credit_note_id, line_no),
  constraint supplier_credit_note_lines_invoice_line_once unique (credit_note_id, invoice_line_id),
  constraint supplier_credit_note_lines_note_fk foreign key (tenant_id, credit_note_id, invoice_id) references supplier_credit_notes (tenant_id, id, invoice_id),
  constraint supplier_credit_note_lines_invoice_line_fk foreign key (tenant_id, invoice_line_id, invoice_id) references supplier_invoice_lines (tenant_id, id, invoice_id)
);
create index supplier_credit_note_lines_note_idx on supplier_credit_note_lines (tenant_id, credit_note_id, line_no);
create index supplier_credit_note_lines_order_line_idx on supplier_credit_note_lines (tenant_id, order_line_id);

create or replace function supplier_credit_notes_guard() returns trigger
language plpgsql as $$
declare
  v_invoice supplier_invoices%rowtype;
  v_entry journal_entries%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'posted' then
      raise exception 'A supplier credit note is created posted' using errcode = 'restrict_violation';
    end if;
    -- The invoice is locked while the credit note is created, so a concurrent payment or credit queues behind it.
    select * into v_invoice from supplier_invoices where tenant_id = new.tenant_id and id = new.invoice_id for update;
    if not found or v_invoice.status <> 'posted' then
      raise exception 'A credit note needs a posted supplier invoice' using errcode = 'restrict_violation';
    end if;
    if new.credit_date < v_invoice.invoice_date then
      raise exception 'A credit note cannot be dated before its invoice' using errcode = 'restrict_violation';
    end if;
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'supplier_credit_note' or v_entry.source_id is distinct from new.id then
      raise exception 'A supplier credit note needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if old.status = 'void' then
    raise exception 'A voided supplier credit note is final' using errcode = 'restrict_violation';
  end if;
  if new.status <> 'void' then
    raise exception 'A posted supplier credit note cannot change' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.supplier_id <> old.supplier_id
     or new.supplier_credit_note_number <> old.supplier_credit_note_number or new.invoice_id <> old.invoice_id
     or new.order_id <> old.order_id or new.credit_date <> old.credit_date or new.subtotal_minor <> old.subtotal_minor
     or new.tax_minor <> old.tax_minor or new.total_minor <> old.total_minor or new.reason <> old.reason
     or new.journal_entry_id <> old.journal_entry_id or new.created_by <> old.created_by then
    raise exception 'Only the status of a supplier credit note can change, and only to void' using errcode = 'restrict_violation';
  end if;
  select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.void_entry_id for share;
  if not found or v_entry.status <> 'posted' or v_entry.reverses_id is distinct from old.journal_entry_id then
    raise exception 'Voiding needs a posted entry that reverses the credit note entry' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_credit_notes_guard() from public, anon, authenticated;

-- A credit line mirrors one invoice line: the billed price and rate, and only goods that were billed and are no longer held.
create or replace function supplier_credit_note_lines_guard() returns trigger
language plpgsql as $$
declare
  v_il supplier_invoice_lines%rowtype;
  v_line purchase_order_lines%rowtype;
  v_invoiced numeric;
  v_credited numeric;
  v_on_invoice_line numeric;
begin
  if not exists (select 1 from supplier_credit_notes where tenant_id = new.tenant_id and id = new.credit_note_id and created_at = now()) then
    raise exception 'The lines of a credit note can only be added while the credit note is being created' using errcode = 'restrict_violation';
  end if;
  select * into v_il from supplier_invoice_lines where tenant_id = new.tenant_id and id = new.invoice_line_id and invoice_id = new.invoice_id;
  if not found then
    raise exception 'A credit line must belong to a line of the invoice' using errcode = 'restrict_violation';
  end if;
  select * into v_line from purchase_order_lines where tenant_id = new.tenant_id and id = v_il.order_line_id for update;
  new.order_id := v_il.order_id;
  new.order_line_id := v_il.order_line_id;
  new.item_id := v_il.item_id;
  if new.unit_cost_minor <> v_il.unit_cost_minor or new.tax_rate_bps <> v_il.tax_rate_bps then
    raise exception 'A credit line must use the billed price and tax of its invoice line' using errcode = 'restrict_violation';
  end if;
  select coalesce(sum(cl.quantity), 0) into v_on_invoice_line
    from supplier_credit_note_lines cl
    join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
    where cl.tenant_id = new.tenant_id and cl.invoice_line_id = new.invoice_line_id and c.status <> 'void';
  if v_on_invoice_line + new.quantity > v_il.quantity then
    raise exception 'Only % of invoice line % can still be credited', v_il.quantity - v_on_invoice_line, v_il.line_no using errcode = 'restrict_violation';
  end if;
  select coalesce(sum(l.quantity), 0) into v_invoiced
    from supplier_invoice_lines l
    join supplier_invoices i on i.tenant_id = l.tenant_id and i.id = l.invoice_id
    where l.tenant_id = new.tenant_id and l.order_line_id = v_il.order_line_id and i.status <> 'void';
  select coalesce(sum(cl.quantity), 0) into v_credited
    from supplier_credit_note_lines cl
    join supplier_credit_notes c on c.tenant_id = cl.tenant_id and c.id = cl.credit_note_id
    where cl.tenant_id = new.tenant_id and cl.order_line_id = v_il.order_line_id and c.status <> 'void';
  if (v_invoiced - v_credited) - (v_line.received_quantity - v_line.returned_quantity) < new.quantity then
    raise exception 'Only % of line % was returned and is not yet credited',
      greatest((v_invoiced - v_credited) - (v_line.received_quantity - v_line.returned_quantity), 0), v_line.line_no using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_credit_note_lines_guard() from public, anon, authenticated;

-- Runs at commit: totals from the lines, the invoice's open balance not overdrawn, and the entry describes the credit note.
create or replace function supplier_credit_notes_totals() returns trigger
language plpgsql as $$
declare
  v_lines integer;
  v_subtotal numeric;
  v_tax_numerator numeric;
  v_po_net numeric;
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
    if journal_net(new.tenant_id, new.journal_entry_id, v_acc.grni_account_id) <> -v_po_net
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.ppv_account_id) <> -(v_subtotal - v_po_net)
       or journal_net(new.tenant_id, new.journal_entry_id, v_acc.inventory_account_id) <> 0 then
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

-- ---- supplier payments ----
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  number integer not null check (number >= 1),
  supplier_id uuid not null,
  supplier_name text not null check (char_length(supplier_name) between 1 and 200),
  status text not null default 'posted' check (status in ('posted', 'void')),
  payment_date date not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000),
  currency char(3) not null default 'KWD' check (currency = 'KWD'),
  method text not null check (method in ('cash', 'bank_transfer', 'cheque')),
  reference text check (reference is null or char_length(reference) between 1 and 100),
  paid_from_account_id uuid not null,
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
  constraint supplier_payments_tenant_id_key unique (tenant_id, id),
  constraint supplier_payments_supplier_ref_key unique (tenant_id, id, supplier_id),
  constraint supplier_payments_tenant_number_key unique (tenant_id, number),
  constraint supplier_payments_entry_key unique (tenant_id, journal_entry_id),
  constraint supplier_payments_supplier_fk foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  constraint supplier_payments_account_fk foreign key (tenant_id, paid_from_account_id) references accounts (tenant_id, id),
  constraint supplier_payments_entry_fk foreign key (tenant_id, journal_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_payments_void_entry_fk foreign key (tenant_id, void_entry_id) references journal_entries (tenant_id, id),
  constraint supplier_payments_void check (
    (status = 'void') = (voided_at is not null and voided_by is not null and void_reason is not null and void_entry_id is not null)
  )
);
-- The same bank or cheque reference cannot be booked twice for one supplier, unless the first booking was voided.
create unique index supplier_payments_reference_once
  on supplier_payments (tenant_id, supplier_id, lower(reference)) where status <> 'void' and reference is not null;
create index supplier_payments_number_idx on supplier_payments (tenant_id, number desc, id desc);

create table supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id),
  payment_id uuid not null,
  supplier_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 1000000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  constraint supplier_payment_allocations_once unique (payment_id, invoice_id),
  constraint supplier_payment_allocations_payment_fk foreign key (tenant_id, payment_id, supplier_id) references supplier_payments (tenant_id, id, supplier_id),
  constraint supplier_payment_allocations_invoice_fk foreign key (tenant_id, invoice_id, supplier_id) references supplier_invoices (tenant_id, id, supplier_id)
);
create index supplier_payment_allocations_invoice_idx on supplier_payment_allocations (tenant_id, invoice_id);
create index supplier_payment_allocations_payment_idx on supplier_payment_allocations (tenant_id, payment_id);

create or replace function supplier_payments_guard() returns trigger
language plpgsql as $$
declare
  v_entry journal_entries%rowtype;
  v_type text;
  v_ok boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'posted' then
      raise exception 'A supplier payment is created posted' using errcode = 'restrict_violation';
    end if;
    select type, is_active and is_postable into v_type, v_ok from accounts where tenant_id = new.tenant_id and id = new.paid_from_account_id;
    if v_type is distinct from 'asset' or not coalesce(v_ok, false) then
      raise exception 'A payment is made from an active, postable asset account' using errcode = 'restrict_violation';
    end if;
    select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.journal_entry_id for share;
    if not found or v_entry.status <> 'posted' or v_entry.source_type <> 'supplier_payment' or v_entry.source_id is distinct from new.id then
      raise exception 'A supplier payment needs a posted journal entry that comes from it' using errcode = 'restrict_violation';
    end if;
    return new;
  end if;

  if old.status = 'void' then
    raise exception 'A voided supplier payment is final' using errcode = 'restrict_violation';
  end if;
  if new.status <> 'void' then
    raise exception 'A posted supplier payment cannot change' using errcode = 'restrict_violation';
  end if;
  if new.tenant_id <> old.tenant_id or new.number <> old.number or new.supplier_id <> old.supplier_id
     or new.payment_date <> old.payment_date or new.amount_minor <> old.amount_minor or new.method <> old.method
     or new.reference is distinct from old.reference or new.paid_from_account_id <> old.paid_from_account_id
     or new.notes is distinct from old.notes or new.journal_entry_id <> old.journal_entry_id or new.created_by <> old.created_by then
    raise exception 'Only the status of a supplier payment can change, and only to void' using errcode = 'restrict_violation';
  end if;
  select * into v_entry from journal_entries where tenant_id = new.tenant_id and id = new.void_entry_id for share;
  if not found or v_entry.status <> 'posted' or v_entry.reverses_id is distinct from old.journal_entry_id then
    raise exception 'Voiding needs a posted entry that reverses the payment entry' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_payments_guard() from public, anon, authenticated;

-- The invoice is locked while it is paid, so two concurrent payments (or a payment and a credit note) cannot both take the
-- same balance. Total - paid - credited - this amount cannot go below zero.
create or replace function supplier_payment_allocations_guard() returns trigger
language plpgsql as $$
declare
  v_payment supplier_payments%rowtype;
  v_invoice supplier_invoices%rowtype;
begin
  select * into v_payment from supplier_payments where tenant_id = new.tenant_id and id = new.payment_id and created_at = now();
  if not found or v_payment.status <> 'posted' then
    raise exception 'Allocations can only be added while the payment is being created' using errcode = 'restrict_violation';
  end if;
  select * into v_invoice from supplier_invoices where tenant_id = new.tenant_id and id = new.invoice_id for update;
  if not found or v_invoice.status <> 'posted' then
    raise exception 'A payment can only be allocated to a posted supplier invoice' using errcode = 'restrict_violation';
  end if;
  if v_payment.payment_date < v_invoice.invoice_date then
    raise exception 'A payment cannot be dated before the invoice it pays' using errcode = 'restrict_violation';
  end if;
  if supplier_invoice_paid(new.tenant_id, new.invoice_id) + supplier_invoice_credited(new.tenant_id, new.invoice_id) + new.amount_minor > v_invoice.total_minor then
    raise exception 'The payment is more than the open balance of invoice %', v_invoice.number using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;
revoke all on function supplier_payment_allocations_guard() from public, anon, authenticated;

-- Runs at commit: the allocations add up to the payment, and the entry is Dr payable / Cr the paying account for that amount.
create or replace function supplier_payments_totals() returns trigger
language plpgsql as $$
declare
  v_count integer;
  v_sum numeric;
  v_acc procurement_accounting%rowtype;
begin
  select count(*), coalesce(sum(amount_minor), 0) into v_count, v_sum
    from supplier_payment_allocations where tenant_id = new.tenant_id and payment_id = new.id;
  if v_count = 0 or v_sum <> new.amount_minor then
    raise exception 'A payment must be allocated in full to supplier invoices' using errcode = 'restrict_violation';
  end if;
  select * into v_acc from procurement_accounting where tenant_id = new.tenant_id;
  if not found then
    raise exception 'The procurement accounts are not set up' using errcode = 'restrict_violation';
  end if;
  if journal_net(new.tenant_id, new.journal_entry_id, v_acc.payable_account_id) <> new.amount_minor
     or journal_net(new.tenant_id, new.journal_entry_id, new.paid_from_account_id) <> -new.amount_minor
     or journal_debit_total(new.tenant_id, new.journal_entry_id) <> new.amount_minor then
    raise exception 'The payment entry must debit the payable account and credit the paying account by the amount' using errcode = 'restrict_violation';
  end if;
  return null;
end;
$$;
revoke all on function supplier_payments_totals() from public, anon, authenticated;

-- ---- triggers ----
create constraint trigger goods_receipts_posting after insert on goods_receipts
  deferrable initially deferred for each row execute function goods_receipts_posting();

create trigger purchase_returns_guard before insert on purchase_returns for each row execute function purchase_returns_guard();
create constraint trigger purchase_returns_posting after insert on purchase_returns
  deferrable initially deferred for each row execute function purchase_returns_posting();
create trigger purchase_returns_no_update before update on purchase_returns for each row execute function prevent_update();
create trigger purchase_returns_no_delete before delete on purchase_returns for each row execute function prevent_delete();
create trigger purchase_return_lines_guard before insert on purchase_return_lines for each row execute function purchase_return_lines_guard();
create trigger purchase_return_lines_apply after insert on purchase_return_lines for each row execute function purchase_return_lines_apply();
create trigger purchase_return_lines_no_update before update on purchase_return_lines for each row execute function prevent_update();
create trigger purchase_return_lines_no_delete before delete on purchase_return_lines for each row execute function prevent_delete();

create trigger supplier_credit_notes_guard before insert or update on supplier_credit_notes for each row execute function supplier_credit_notes_guard();
create constraint trigger supplier_credit_notes_totals after insert on supplier_credit_notes
  deferrable initially deferred for each row execute function supplier_credit_notes_totals();
create trigger supplier_credit_notes_updated_at before update on supplier_credit_notes for each row execute function set_updated_at();
create trigger supplier_credit_notes_no_delete before delete on supplier_credit_notes for each row execute function prevent_delete();
create trigger supplier_credit_note_lines_guard before insert on supplier_credit_note_lines for each row execute function supplier_credit_note_lines_guard();
create trigger supplier_credit_note_lines_no_update before update on supplier_credit_note_lines for each row execute function prevent_update();
create trigger supplier_credit_note_lines_no_delete before delete on supplier_credit_note_lines for each row execute function prevent_delete();

create trigger supplier_payments_guard before insert or update on supplier_payments for each row execute function supplier_payments_guard();
create constraint trigger supplier_payments_totals after insert on supplier_payments
  deferrable initially deferred for each row execute function supplier_payments_totals();
create trigger supplier_payments_updated_at before update on supplier_payments for each row execute function set_updated_at();
create trigger supplier_payments_no_delete before delete on supplier_payments for each row execute function prevent_delete();
create trigger supplier_payment_allocations_guard before insert on supplier_payment_allocations for each row execute function supplier_payment_allocations_guard();
create trigger supplier_payment_allocations_no_update before update on supplier_payment_allocations for each row execute function prevent_update();
create trigger supplier_payment_allocations_no_delete before delete on supplier_payment_allocations for each row execute function prevent_delete();

-- ---- access ----
alter table purchase_returns enable row level security;
alter table purchase_return_lines enable row level security;
alter table supplier_credit_notes enable row level security;
alter table supplier_credit_note_lines enable row level security;
alter table supplier_payments enable row level security;
alter table supplier_payment_allocations enable row level security;
revoke all on purchase_returns, purchase_return_lines, supplier_credit_notes, supplier_credit_note_lines, supplier_payments, supplier_payment_allocations from anon, authenticated;
grant select on purchase_returns, purchase_return_lines, supplier_credit_notes, supplier_credit_note_lines, supplier_payments, supplier_payment_allocations to authenticated;

create policy purchase_returns_select on purchase_returns for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.return.read'));
create policy purchase_return_lines_select on purchase_return_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.return.read'));
create policy supplier_credit_notes_select on supplier_credit_notes for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.creditnote.read'));
create policy supplier_credit_note_lines_select on supplier_credit_note_lines for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.creditnote.read'));
create policy supplier_payments_select on supplier_payments for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.payment.read'));
create policy supplier_payment_allocations_select on supplier_payment_allocations for select to authenticated
  using (tenant_id in (select auth_tenant_ids()) and auth_has_permission(tenant_id, 'procurement.payment.read'));

-- Existing tenants: the owner role gains the new permissions.
insert into role_permissions (tenant_id, role_id, permission, created_by)
select r.tenant_id, r.id, p.permission, r.created_by
from roles r
cross join unnest(erp_owner_extra_permissions()) as p (permission)
where r.name = 'owner' and r.is_system
on conflict (role_id, permission) do nothing;
