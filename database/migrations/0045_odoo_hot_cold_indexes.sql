-- Additional composite / text indexes for hot-window lists and Odoo archive scans.
-- Idempotent. Zero row mutation.

CREATE INDEX IF NOT EXISTS invoices_tenant_issue_date_desc_idx ON invoices (tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS invoices_tenant_created_desc_idx ON invoices (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_tenant_status_created_idx ON invoices (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_tenant_customer_created_idx ON invoices (tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS purchase_orders_tenant_created_desc_idx ON purchase_orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_status_created_idx ON purchase_orders (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_tenant_supplier_created_idx ON purchase_orders (tenant_id, supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sales_quotations_tenant_created_desc_idx ON sales_quotations (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_quotations_tenant_status_created_idx ON sales_quotations (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS items_tenant_sku_lower_idx ON items (tenant_id, lower(sku));
CREATE INDEX IF NOT EXISTS items_tenant_name_lower_idx ON items (tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS customers_tenant_name_lower_idx ON customers (tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx ON customers (tenant_id, phone);
CREATE INDEX IF NOT EXISTS customers_tenant_email_lower_idx ON customers (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS suppliers_tenant_name_lower_idx ON suppliers (tenant_id, lower(name));

CREATE INDEX IF NOT EXISTS stock_movements_tenant_created_desc_idx ON stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tenant_type_created_idx ON stock_movements (tenant_id, movement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_tenant_item_created_idx ON stock_movements (tenant_id, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS journal_entries_tenant_date_desc_idx ON journal_entries (tenant_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS journal_lines_tenant_account_idx ON journal_lines (tenant_id, account_id);

CREATE INDEX IF NOT EXISTS brands_tenant_status_name_idx ON brands (tenant_id, status, name);
CREATE INDEX IF NOT EXISTS branches_tenant_status_name_idx ON branches (tenant_id, status, name);

CREATE INDEX IF NOT EXISTS odoo_staging_tenant_model_external_idx ON odoo_imported_staging_records (tenant_id, odoo_model, external_id);

CREATE OR REPLACE FUNCTION erp_odoo_hot_cold_indexes_marker() RETURNS void
LANGUAGE sql AS $$ SELECT NULL $$;
