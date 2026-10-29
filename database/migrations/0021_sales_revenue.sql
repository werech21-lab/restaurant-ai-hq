-- 0021_sales_revenue: issuing a sales invoice debits accounts receivable and credits sales revenue.
--
-- The amount is the invoice total in fils. Tax is not split into another account.
-- The entry is posted only when both accounts are saved on finance_settings.
-- Voiding an issued, unpaid invoice is the only way to reverse it.

alter table finance_settings
  add column revenue_account_id uuid;
alter table finance_settings
  add constraint finance_settings_revenue_fk foreign key (tenant_id, revenue_account_id) references accounts (tenant_id, id);

alter table journal_entries drop constraint journal_entries_source_type_check;
alter table journal_entries add constraint journal_entries_source_type_check
  check (source_type in (
    'manual', 'reversal', 'supplier_invoice', 'goods_receipt', 'purchase_return',
    'supplier_credit_note', 'supplier_payment', 'sales_cogs',
    'customer_collection', 'kitchen_issue', 'delivery_commission', 'sales_revenue'
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
      'customer_collection', 'kitchen_issue', 'delivery_commission', 'sales_revenue'
    ) and coalesce(current_setting('erp.source_void', true), '') <> new.reverses_id::text then
      raise exception 'An entry made by a source document can only be reversed by voiding the document' using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function journal_entries_source_guard() from public, anon, authenticated;
