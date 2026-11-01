-- Scrub remaining DEMO* business tokens on staging without deleting financial history.

create or replace function erp_scrub_demo_tokens_marker() returns text
language sql immutable as $$ select '0041_scrub_demo_tokens_staging'::text $$;

create or replace function erp_scrub_demo_tokens() returns integer
language plpgsql as $$
declare
  touched integer := 0;
  n integer;
begin
  update tenants
  set name = replace(replace(name, 'DEMO', 'Venture Foods'), 'Demo', 'Venture Foods'),
      slug = case when slug ilike '%demo%' then 'venture-foods-kuwait' else slug end
  where name ilike '%demo%' or slug ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update warehouses
  set code = case when code ilike '%demo%' then 'WH-ARCHIVE-SEED' else code end,
      name = replace(replace(coalesce(name, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      status = 'inactive',
      updated_at = now()
  where code ilike '%demo%' or name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update items
  set sku = case when sku ilike '%demo%' then 'VF-ARCHIVE-' || substr(md5(id::text), 1, 8) else sku end,
      name = replace(replace(coalesce(name, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      is_active = false,
      updated_at = now()
  where sku ilike '%demo%' or name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update customers
  set name = replace(replace(name, 'DEMO', 'Archive Customer'), 'Demo', 'Archive Customer'),
      notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      status = case when status = 'active' then 'blocked' else status end,
      updated_at = now()
  where name ilike '%demo%' or coalesce(notes, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  alter table suppliers disable trigger suppliers_guard;
  update suppliers
  set name = replace(replace(name, 'DEMO', 'Archive Supplier'), 'Demo', 'Archive Supplier'),
      code = case when code ilike '%demo%' then 'SUP-ARCHIVE' else code end,
      updated_at = now()
  where name ilike '%demo%' or code ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table suppliers enable trigger suppliers_guard;

  update delivery_partners
  set name = replace(replace(name, 'DEMO', 'Archive Partner'), 'Demo', 'Archive Partner'),
      code = case when code ilike '%demo%' then 'DLV-ARCHIVE' else code end
  where name ilike '%demo%' or code ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update recipes
  set name = replace(replace(name, 'DEMO', 'Archive Recipe'), 'Demo', 'Archive Recipe'),
      notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where name ilike '%demo%' or coalesce(notes, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  alter table kitchen_waste disable trigger kitchen_waste_no_update;
  update kitchen_waste
  set reason = replace(replace(reason, 'DEMO', 'Archive'), 'Demo', 'Archive')
  where reason ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table kitchen_waste enable trigger kitchen_waste_no_update;

  alter table invoices disable trigger invoices_freeze_guard;
  update invoices
  set customer_name = replace(replace(customer_name, 'DEMO', 'Archive Customer'), 'Demo', 'Archive Customer'),
      notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      updated_at = now()
  where customer_name ilike '%demo%' or coalesce(notes, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table invoices enable trigger invoices_freeze_guard;

  alter table invoice_lines disable trigger invoice_lines_draft_guard;
  update invoice_lines
  set description = replace(replace(description, 'DEMO', 'Archive'), 'Demo', 'Archive')
  where description ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table invoice_lines enable trigger invoice_lines_draft_guard;

  alter table journal_entries disable trigger journal_entries_guard;
  update journal_entries
  set memo = replace(replace(coalesce(memo, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(memo, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table journal_entries enable trigger journal_entries_guard;

  alter table journal_lines disable trigger journal_lines_guard;
  update journal_lines
  set description = replace(replace(coalesce(description, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(description, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table journal_lines enable trigger journal_lines_guard;

  alter table stock_movements disable trigger stock_movements_no_update;
  update stock_movements
  set note = replace(replace(coalesce(note, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(note, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table stock_movements enable trigger stock_movements_no_update;

  alter table payments disable trigger payments_no_update;
  update payments
  set reference = replace(replace(coalesce(reference, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(reference, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table payments enable trigger payments_no_update;

  alter table purchase_orders disable trigger purchase_orders_guard;
  update purchase_orders
  set notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(notes, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table purchase_orders enable trigger purchase_orders_guard;

  alter table purchase_order_lines disable trigger purchase_order_lines_guard;
  update purchase_order_lines
  set description = replace(replace(coalesce(description, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(description, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table purchase_order_lines enable trigger purchase_order_lines_guard;

  alter table purchase_requests disable trigger purchase_requests_guard;
  update purchase_requests
  set reason = nullif(replace(replace(coalesce(reason, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'), '')
  where coalesce(reason, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  update purchase_requests
  set decision_note = replace(replace(decision_note, 'DEMO', 'Archive'), 'Demo', 'Archive')
  where decision_note is not null and decision_note ilike '%demo%'
    and char_length(replace(replace(decision_note, 'DEMO', 'Archive'), 'Demo', 'Archive')) between 1 and 500;
  get diagnostics n = row_count; touched := touched + n;
  alter table purchase_requests enable trigger purchase_requests_guard;

  alter table purchase_request_lines disable trigger purchase_request_lines_guard;
  update purchase_request_lines
  set description = replace(replace(coalesce(description, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(description, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table purchase_request_lines enable trigger purchase_request_lines_guard;

  alter table supplier_invoices disable trigger supplier_invoices_guard;
  update supplier_invoices
  set notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      supplier_name = replace(replace(supplier_name, 'DEMO', 'Archive Supplier'), 'Demo', 'Archive Supplier')
  where coalesce(notes, '') ilike '%demo%' or supplier_name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table supplier_invoices enable trigger supplier_invoices_guard;

  alter table supplier_invoice_lines disable trigger supplier_invoice_lines_no_update;
  update supplier_invoice_lines
  set description = replace(replace(coalesce(description, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(description, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table supplier_invoice_lines enable trigger supplier_invoice_lines_no_update;

  alter table sales_quotations disable trigger sales_quotations_guard_trigger;
  update sales_quotations
  set notes = replace(replace(coalesce(notes, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      customer_name = replace(replace(customer_name, 'DEMO', 'Archive Customer'), 'Demo', 'Archive Customer')
  where coalesce(notes, '') ilike '%demo%' or customer_name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table sales_quotations enable trigger sales_quotations_guard_trigger;

  alter table sales_quotation_lines disable trigger sales_quotation_lines_draft_guard;
  update sales_quotation_lines
  set description = replace(replace(coalesce(description, ''), 'DEMO', 'Archive'), 'Demo', 'Archive')
  where coalesce(description, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table sales_quotation_lines enable trigger sales_quotation_lines_draft_guard;

  update ai_insights_alerts
  set title_ar = replace(replace(title_ar, 'DEMO', 'Archive'), 'Demo', 'Archive'),
      description_ar = replace(replace(description_ar, 'DEMO', 'Archive'), 'Demo', 'Archive'),
      updated_at = now()
  where title_ar ilike '%demo%' or description_ar ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  update ai_action_approvals
  set title_ar = replace(replace(title_ar, 'DEMO', 'Archive'), 'Demo', 'Archive'),
      summary_ar = replace(replace(summary_ar, 'DEMO', 'Archive'), 'Demo', 'Archive'),
      decision_note = replace(replace(coalesce(decision_note, ''), 'DEMO', 'Archive'), 'Demo', 'Archive'),
      updated_at = now()
  where title_ar ilike '%demo%' or summary_ar ilike '%demo%' or coalesce(decision_note, '') ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  alter table audit_activity_logs disable trigger audit_activity_logs_no_update;
  update audit_activity_logs
  set description_ar = replace(replace(description_ar, 'DEMO', 'Archive'), 'Demo', 'Archive'),
      actor_name = replace(replace(actor_name, 'DEMO', 'Archive'), 'Demo', 'Archive')
  where description_ar ilike '%demo%' or actor_name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table audit_activity_logs enable trigger audit_activity_logs_no_update;

  return touched;
end;
$$;

select erp_scrub_demo_tokens();

revoke all on function erp_scrub_demo_tokens() from public, anon, authenticated;
revoke execute on function erp_scrub_demo_tokens_marker() from public, anon, authenticated;
