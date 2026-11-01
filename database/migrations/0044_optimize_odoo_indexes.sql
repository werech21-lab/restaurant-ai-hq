-- Accelerate Odoo-imported and suite workloads. Idempotent. Zero data mutation.

CREATE INDEX IF NOT EXISTS odoo_staging_tenant_model_idx
  ON odoo_imported_staging_records (tenant_id, odoo_model);
CREATE INDEX IF NOT EXISTS odoo_staging_tenant_apply_created_idx
  ON odoo_imported_staging_records (tenant_id, apply_status, created_at DESC);
CREATE INDEX IF NOT EXISTS odoo_staging_tenant_created_idx
  ON odoo_imported_staging_records (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS suite_records_brand_idx
  ON suite_records (tenant_id, app_key, brand_name);
CREATE INDEX IF NOT EXISTS suite_records_branch_idx
  ON suite_records (tenant_id, app_key, branch_name);
CREATE INDEX IF NOT EXISTS suite_records_department_idx
  ON suite_records (tenant_id, app_key, department);
CREATE INDEX IF NOT EXISTS suite_records_stage_idx
  ON suite_records (tenant_id, app_key, stage);

CREATE INDEX IF NOT EXISTS invoices_tenant_issue_date_idx
  ON invoices (tenant_id, issue_date);
CREATE INDEX IF NOT EXISTS invoices_tenant_status_issue_idx
  ON invoices (tenant_id, status, issue_date);

CREATE INDEX IF NOT EXISTS hr_employees_tenant_status_code_idx
  ON hr_employees (tenant_id, status, employee_code);
CREATE INDEX IF NOT EXISTS hr_employees_tenant_status_name_idx
  ON hr_employees (tenant_id, status, full_name);

CREATE INDEX IF NOT EXISTS items_tenant_active_name_idx
  ON items (tenant_id, is_active, name, id);
CREATE INDEX IF NOT EXISTS stock_movements_tenant_item_type_created_idx
  ON stock_movements (tenant_id, item_id, movement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS customers_tenant_status_name_idx
  ON customers (tenant_id, status, name);

CREATE INDEX IF NOT EXISTS branches_tenant_brand_status_idx
  ON branches (tenant_id, brand_id, status);
CREATE INDEX IF NOT EXISTS warehouses_tenant_status_code_idx
  ON warehouses (tenant_id, status, code);

CREATE OR REPLACE FUNCTION erp_optimize_odoo_indexes_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;
