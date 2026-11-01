-- Finish DEMO scrub: purchase-order supplier snapshots and audit metadata_json history.

create or replace function erp_scrub_demo_json_marker() returns text
language sql immutable as $$ select '0042_scrub_demo_json_and_snapshots'::text $$;

create or replace function erp_scrub_demo_json() returns integer
language plpgsql as $$
declare
  touched integer := 0;
  n integer;
begin
  alter table purchase_orders disable trigger purchase_orders_guard;
  update purchase_orders
  set supplier_name = replace(replace(supplier_name, 'DEMO', 'Archive'), 'Demo', 'Archive')
  where supplier_name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table purchase_orders enable trigger purchase_orders_guard;

  alter table supplier_invoices disable trigger supplier_invoices_guard;
  update supplier_invoices
  set supplier_invoice_number = replace(replace(supplier_invoice_number, 'DEMO', 'VF-ARCH'), 'Demo', 'VF-ARCH')
  where supplier_invoice_number ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table supplier_invoices enable trigger supplier_invoices_guard;

  update suppliers
  set name = replace(replace(name, 'DEMO', 'Archive Supplier'), 'Demo', 'Archive Supplier')
  where name ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;

  alter table audit_activity_logs disable trigger audit_activity_logs_no_update;
  update audit_activity_logs
  set metadata_json = replace(replace(metadata_json::text, 'DEMO', 'Archive'), 'Demo', 'Archive')::jsonb
  where metadata_json::text ilike '%demo%';
  get diagnostics n = row_count; touched := touched + n;
  alter table audit_activity_logs enable trigger audit_activity_logs_no_update;

  return touched;
end;
$$;

select erp_scrub_demo_json();

revoke all on function erp_scrub_demo_json() from public, anon, authenticated;
revoke execute on function erp_scrub_demo_json_marker() from public, anon, authenticated;
