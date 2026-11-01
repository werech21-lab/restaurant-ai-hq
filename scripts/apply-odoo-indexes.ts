/**
 * Applies CREATE INDEX IF NOT EXISTS for Odoo-scale company tables on the connected Postgres.
 * Never drops, truncates, or rewrites row data.
 *
 *   npx tsx --env-file=.env.local scripts/apply-odoo-indexes.ts
 *   npx tsx --env-file=.env.staging scripts/apply-odoo-indexes.ts
 */
import pg from 'pg'

const STATEMENTS = [
  // Invoices / orders (hot date windows)
  `CREATE INDEX IF NOT EXISTS invoices_tenant_issue_date_desc_idx ON invoices (tenant_id, issue_date DESC)`,
  `CREATE INDEX IF NOT EXISTS invoices_tenant_created_desc_idx ON invoices (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS invoices_tenant_status_created_idx ON invoices (tenant_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS invoices_tenant_customer_created_idx ON invoices (tenant_id, customer_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS purchase_orders_tenant_created_desc_idx ON purchase_orders (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS purchase_orders_tenant_status_created_idx ON purchase_orders (tenant_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS purchase_orders_tenant_supplier_created_idx ON purchase_orders (tenant_id, supplier_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sales_quotations_tenant_created_desc_idx ON sales_quotations (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS sales_quotations_tenant_status_created_idx ON sales_quotations (tenant_id, status, created_at DESC)`,

  // Products / customers text lookup
  `CREATE INDEX IF NOT EXISTS items_tenant_sku_lower_idx ON items (tenant_id, lower(sku))`,
  `CREATE INDEX IF NOT EXISTS items_tenant_name_lower_idx ON items (tenant_id, lower(name))`,
  `CREATE INDEX IF NOT EXISTS customers_tenant_name_lower_idx ON customers (tenant_id, lower(name))`,
  `CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx ON customers (tenant_id, phone)`,
  `CREATE INDEX IF NOT EXISTS customers_tenant_email_lower_idx ON customers (tenant_id, lower(email))`,
  `CREATE INDEX IF NOT EXISTS suppliers_tenant_name_lower_idx ON suppliers (tenant_id, lower(name))`,

  // Stock + journal
  `CREATE INDEX IF NOT EXISTS stock_movements_tenant_created_desc_idx ON stock_movements (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_tenant_type_created_idx ON stock_movements (tenant_id, movement_type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_tenant_item_created_idx ON stock_movements (tenant_id, item_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS journal_entries_tenant_date_desc_idx ON journal_entries (tenant_id, entry_date DESC)`,
  `CREATE INDEX IF NOT EXISTS journal_lines_tenant_account_idx ON journal_lines (tenant_id, account_id)`,

  // Org / brands / branches
  `CREATE INDEX IF NOT EXISTS brands_tenant_status_name_idx ON brands (tenant_id, status, name)`,
  `CREATE INDEX IF NOT EXISTS branches_tenant_status_name_idx ON branches (tenant_id, status, name)`,

  // Odoo staging archive
  `CREATE INDEX IF NOT EXISTS odoo_staging_tenant_model_idx ON odoo_imported_staging_records (tenant_id, odoo_model)`,
  `CREATE INDEX IF NOT EXISTS odoo_staging_tenant_apply_created_idx ON odoo_imported_staging_records (tenant_id, apply_status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS odoo_staging_tenant_created_idx ON odoo_imported_staging_records (tenant_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS odoo_staging_tenant_model_external_idx ON odoo_imported_staging_records (tenant_id, odoo_model, external_id)`,

  // Suite (6×10)
  `CREATE INDEX IF NOT EXISTS suite_records_brand_idx ON suite_records (tenant_id, app_key, brand_name)`,
  `CREATE INDEX IF NOT EXISTS suite_records_branch_idx ON suite_records (tenant_id, app_key, branch_name)`,
  `CREATE INDEX IF NOT EXISTS suite_records_department_idx ON suite_records (tenant_id, app_key, department)`,
  `CREATE INDEX IF NOT EXISTS suite_records_stage_idx ON suite_records (tenant_id, app_key, stage)`,

  // HR Odoo roster
  `CREATE INDEX IF NOT EXISTS hr_employees_tenant_status_code_idx ON hr_employees (tenant_id, status, employee_code)`,
  `CREATE INDEX IF NOT EXISTS hr_employees_tenant_status_name_idx ON hr_employees (tenant_id, status, full_name)`,
] as const

function resolveUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is not set')
  if (url.startsWith('file:')) {
    throw new Error('DATABASE_URL points at SQLite. Use the Postgres company database (.env.local / .env.staging).')
  }
  return url
}

async function main() {
  const connectionString = resolveUrl()
  const sslMode = process.env.DATABASE_SSL ?? 'require'
  const ssl =
    sslMode === 'disable'
      ? false
      : sslMode === 'verify'
        ? process.env.DATABASE_SSL_CA
          ? { rejectUnauthorized: true, ca: process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n') }
          : true
        : { rejectUnauthorized: false }

  const client = new pg.Client({ connectionString, ssl })
  await client.connect()
  const started = Date.now()
  let applied = 0
  let skipped = 0
  try {
    for (const sql of STATEMENTS) {
      const name = /IF NOT EXISTS\s+(\S+)/i.exec(sql)?.[1] ?? 'index'
      const before = await client.query<{ exists: boolean }>(
        `select to_regclass($1) is not null as exists`,
        [`public.${name}`]
      )
      // Indexes are not tables — use pg_class
      const exists = (
        await client.query<{ ok: boolean }>(
          `select exists (
             select 1 from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
             where c.relkind = 'i' and n.nspname = 'public' and c.relname = $1
           ) as ok`,
          [name]
        )
      ).rows[0]?.ok
      await client.query(sql)
      if (exists) {
        skipped += 1
        process.stdout.write(`skip   ${name}\n`)
      } else {
        applied += 1
        process.stdout.write(`apply  ${name}\n`)
      }
      void before
    }
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          applied,
          alreadyPresent: skipped,
          total: STATEMENTS.length,
          elapsedMs: Date.now() - started,
        },
        null,
        2
      ) + '\n'
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
