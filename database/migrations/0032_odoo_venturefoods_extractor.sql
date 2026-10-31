-- 0032_odoo_venturefoods_extractor
-- Company 1 on https://venturefoods.walnutss.com. 0029 is the brand radar and stays untouched.
-- The session id and password are never columns. Journals and stock movements are not posted from imported rows.

alter table odoo_sync_jobs drop constraint odoo_sync_jobs_source_check;
alter table odoo_sync_jobs
  add constraint odoo_sync_jobs_source_check check (source in ('jsonrpc', 'file', 'web'));

alter table odoo_sync_jobs
  add column company_id smallint not null default 1 check (company_id = 1);

alter table odoo_imported_staging_records drop constraint odoo_imported_staging_records_odoo_model_check;
alter table odoo_imported_staging_records
  add constraint odoo_imported_staging_records_odoo_model_check check (odoo_model in (
    'hr.employee', 'hr.contract', 'hr.payslip', 'hr.attendance', 'hr.leave', 'hr.appraisal', 'hr.expense',
    'account.account', 'account.move', 'product.template', 'stock.quant',
    'purchase.order', 'purchase.requisition', 'res.partner'
  ));

create or replace function erp_odoo_extractor_marker() returns text
language sql immutable as $$ select 'company_1'::text $$;
revoke all on function erp_odoo_extractor_marker() from public, anon, authenticated;
