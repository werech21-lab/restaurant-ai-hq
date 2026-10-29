import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { allPermissions } from '@/lib/auth/permissions'

/**
 * Migrations run against live data, so they are tested the way they will be used: the database is brought to the
 * state production could be in (0001 to 0005), real rows are written, the remaining migrations run, and every row must
 * survive. Everything here uses an in-memory PGlite. Nothing in this file can reach a real database.
 */

const migrationsDir = path.join(process.cwd(), 'database', 'migrations')
const scriptsDir = path.join(process.cwd(), 'scripts')

const stub = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon;
  create role authenticated;
`

// Booting PGlite and replaying every migration is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

let current: PGlite | null = null

afterEach(async () => {
  await current?.close()
  current = null
})

async function migrationFiles(): Promise<string[]> {
  return (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()
}

async function apply(db: PGlite, files: string[]): Promise<void> {
  for (const file of files) await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))
}

async function databaseAt(lastMigrationPrefix: string): Promise<{ db: PGlite; remaining: string[] }> {
  const files = await migrationFiles()
  const cut = files.findIndex((file) => file.startsWith(lastMigrationPrefix))
  expect(cut, `migration ${lastMigrationPrefix} exists`).toBeGreaterThanOrEqual(0)
  const db = new PGlite({ parsers: { 20: (value: string) => Number(value), 1082: (value: string) => value } })
  current = db
  await db.exec(stub)
  await apply(db, files.slice(0, cut + 1))
  return { db, remaining: files.slice(cut + 1) }
}

async function n(db: PGlite, table: string): Promise<number> {
  const result = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`)
  return result.rows[0].n
}

/** Statements that remove or reshape data, with comments stripped so prose cannot hide or fake one. */
function destructiveStatements(sql: string): string[] {
  const code = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const pattern = /\b(drop\s+(?:table|view|column|schema|database|role|type)|truncate|delete\s+from|alter\s+table\s+\S+\s+drop\s+column)\b[^;]*/gi
  return [...code.matchAll(pattern)].map((match) => match[0].replace(/\s+/g, ' ').trim().toLowerCase())
}

describe('migration files', () => {
  it('only drops data-bearing objects where a documented guard or conversion exists', async () => {
    const found: Record<string, string[]> = {}
    for (const file of await migrationFiles()) {
      const statements = destructiveStatements(await readFile(path.join(migrationsDir, file), 'utf8'))
      if (statements.length > 0) found[file] = statements
    }
    // 0006 replaces the thousandths ledger and its derived view. It refuses to run if the old ledger has rows, and converts is_active first.
    expect(found).toEqual({
      '0006_inventory_ops.sql': ['drop view stock_levels', 'drop table stock_movements', 'alter table warehouses drop column is_active'],
    })
  })

  it('never uses delete, truncate or drop database/schema in any migration', async () => {
    for (const file of await migrationFiles()) {
      const sql = (await readFile(path.join(migrationsDir, file), 'utf8')).replace(/--[^\n]*/g, '')
      expect(sql, file).not.toMatch(/\btruncate\b/i)
      expect(sql, file).not.toMatch(/\bdelete\s+from\b/i)
      expect(sql, file).not.toMatch(/\bdrop\s+(database|schema)\b/i)
    }
  })

  it('numbers migrations without gaps or duplicates', async () => {
    const files = await migrationFiles()
    const numbers = files.map((file) => Number(file.slice(0, 4)))
    expect(numbers).toEqual(files.map((_, index) => index + 1))
  })

  it('rolls a failed migration back and does not record it', async () => {
    const db = new PGlite()
    current = db
    await db.exec('create table schema_migrations (name text primary key, checksum text not null)')
    const apply = async () => {
      await db.exec('begin')
      try {
        await db.exec('create table migration_probe (n int)')
        await db.exec('insert into migration_probe (n) values (1)')
        await db.exec('select * from migration_missing')
        await db.exec(`insert into schema_migrations (name, checksum) values ('0099_bad.sql', 'abc')`)
        await db.exec('commit')
      } catch (error) {
        await db.exec('rollback')
        throw error
      }
    }
    await expect(apply()).rejects.toThrow()
    const table = await db.query<{ name: string | null }>(`select to_regclass('public.migration_probe') as name`)
    expect(table.rows[0].name).toBeNull()
    const recorded = await db.query<{ n: number | string }>('select count(*)::int as n from schema_migrations')
    expect(Number(recorded.rows[0].n)).toBe(0)
  })

  it('runs through the checksum-guarded runner inside one transaction per file and never resets data', async () => {
    const runner = await readFile(path.join(scriptsDir, 'migrate.mjs'), 'utf8')
    expect(runner).toContain('checksum')
    expect(runner).toContain('was changed after it was applied')
    expect(runner).toContain("client.query('begin')")
    expect(runner).toContain("client.query('rollback')")
    expect(runner.indexOf('assertMigrationTarget(url')).toBeLessThan(runner.indexOf('new pg.Client'))
    const inspection = await readFile(path.join(scriptsDir, 'staging-inspect.mjs'), 'utf8')
    expect(inspection).toContain('begin read only')
    expect(inspection).toContain("client.query('rollback')")
    expect(inspection).not.toMatch(/\b(insert\s+into|update\s+\w+\s+set|delete\s+from|drop\s+|truncate|alter\s+table)\b/i)
    expect(runner).not.toMatch(/\b(truncate|drop\s+(table|schema|database)|delete\s+from)\b/i)
  })

  it('keeps database credentials out of every test and script file', async () => {
    const offenders: string[] = []
    const roots = [path.join(process.cwd(), 'src'), scriptsDir]
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name)
        if (entry.isDirectory()) await visit(full)
        else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/migration-safety\.test\.ts$/.test(entry.name)) {
          const text = await readFile(full, 'utf8')
          const isTest = full.includes(`${path.sep}__tests__${path.sep}`)
          if (isTest && /process\.env\.DATABASE_URL|new (pg\.)?(Pool|Client)\(|^import (?!type).*from 'pg'/m.test(text)) offenders.push(full)
          if (/postgres(ql)?:\/\/[^\s'"`$]+:[^\s'"`$]+@/.test(text)) offenders.push(full)
        }
      }
    }
    for (const root of roots) await visit(root)
    expect(offenders).toEqual([])
  })
})

describe('upgrading a database that already holds data', () => {
  async function seedProductionLikeData(db: PGlite) {
    const owner = randomUUID()
    await db.query('insert into auth.users (id) values ($1)', [owner])
    const tenant = (await db.query<{ id: string }>(`select erp_bootstrap_tenant('Live Tenant', 'live', $1) as id`, [owner])).rows[0].id

    const active = (
      await db.query<{ id: string }>(
        `insert into customers (tenant_id, name, status, created_by) values ($1, 'Active Co', 'active', $2) returning id`,
        [tenant, owner]
      )
    ).rows[0].id
    await db.query(`insert into customers (tenant_id, name, status, created_by) values ($1, 'Old Co', 'inactive', $2)`, [tenant, owner])
    await db.query(`insert into contacts (tenant_id, customer_id, name, created_by) values ($1, $2, 'Contact', $3)`, [tenant, active, owner])
    await db.query(`insert into deals (tenant_id, customer_id, title, stage, value_minor, created_by) values ($1, $2, 'Early', 'lead', 1500, $3)`, [
      tenant,
      active,
      owner,
    ])
    await db.query(`insert into deals (tenant_id, customer_id, title, stage, value_minor, created_by) values ($1, $2, 'Done', 'won', 9000, $3)`, [
      tenant,
      active,
      owner,
    ])
    await db.query(`insert into warehouses (tenant_id, code, name, is_active, created_by) values ($1, 'A', 'Live', true, $2)`, [tenant, owner])
    await db.query(`insert into warehouses (tenant_id, code, name, is_active, created_by) values ($1, 'B', 'Closed', false, $2)`, [tenant, owner])
    await db.query(
      `insert into items (tenant_id, sku, name, unit, unit_cost_minor, reorder_level_milli, created_by) values ($1, 'S1', 'Sugar', 'kg', 750, 5000, $2)`,
      [tenant, owner]
    )
    // Invoice totals are checked against the lines at commit, so both rows go in one transaction.
    const invoice = randomUUID()
    await db.transaction(async (tx) => {
      await tx.query(
        `insert into invoices (id, tenant_id, number, customer_id, customer_name, status, issue_date, due_date, subtotal_minor, tax_minor, total_minor, created_by)
         values ($1, $2, 'INV-000001', $3, 'Active Co', 'draft', current_date, current_date + 30, 10000, 500, 10500, $4)`,
        [invoice, tenant, active, owner]
      )
      await tx.query(
        `insert into invoice_lines (tenant_id, invoice_id, position, description, quantity, unit_price_minor, tax_rate_bps, created_by)
         values ($1, $2, 1, 'Goods', 2, 5000, 500, $3)`,
        [tenant, invoice, owner]
      )
      await tx.query(`update invoices set status = 'issued', submitted_at = now() where id = $1`, [invoice])
    })
    await db.query(
      `insert into audit_log (tenant_id, actor_id, entity, entity_id, action, before, after) values ($1, $2, 'invoice', $3, 'create', null, '{}'::jsonb)`,
      [tenant, owner, invoice]
    )
    return { tenant, owner, invoice }
  }

  it('keeps every existing row and converts values safely when 0006 to the latest migration run', async () => {
    const { db, remaining } = await databaseAt('0005')
    expect(remaining.length).toBeGreaterThanOrEqual(3)
    const seeded = await seedProductionLikeData(db)
    const before = {
      customers: await n(db, 'customers'),
      contacts: await n(db, 'contacts'),
      deals: await n(db, 'deals'),
      warehouses: await n(db, 'warehouses'),
      items: await n(db, 'items'),
      invoices: await n(db, 'invoices'),
      lines: await n(db, 'invoice_lines'),
      audit: await n(db, 'audit_log'),
      tenants: await n(db, 'tenants'),
    }

    await apply(db, remaining)

    expect(await n(db, 'customers')).toBe(before.customers)
    expect(await n(db, 'contacts')).toBe(before.contacts)
    expect(await n(db, 'crm_leads_pipeline')).toBe(before.deals)
    expect(await n(db, 'warehouses')).toBe(before.warehouses)
    expect(await n(db, 'items')).toBe(before.items)
    expect(await n(db, 'invoices')).toBe(before.invoices)
    expect(await n(db, 'invoice_lines')).toBe(before.lines)
    expect(await n(db, 'audit_log')).toBeGreaterThanOrEqual(before.audit)
    expect(await n(db, 'tenants')).toBe(before.tenants)

    const invoice = await db.query<{ number: string; total_minor: number; status: string; paid_minor: number }>(
      'select number, total_minor, status, paid_minor from invoices where id = $1',
      [seeded.invoice]
    )
    expect(invoice.rows[0]).toEqual({ number: 'INV-000001', total_minor: 10500, status: 'issued', paid_minor: 0 })

    const customers = await db.query<{ name: string; status: string }>('select name, status from customers order by name')
    expect(customers.rows).toEqual([
      { name: 'Active Co', status: 'active' },
      { name: 'Old Co', status: 'blocked' },
    ])

    const leads = await db.query<{ title: string; stage: string; probability: number; expected_revenue_minor: number }>(
      'select title, stage, probability, expected_revenue_minor from crm_leads_pipeline order by title'
    )
    expect(leads.rows).toEqual([
      { title: 'Done', stage: 'won', probability: 100, expected_revenue_minor: 9000 },
      { title: 'Early', stage: 'new', probability: 0, expected_revenue_minor: 1500 },
    ])

    const warehouses = await db.query<{ code: string; status: string }>('select code, status from warehouses order by code')
    expect(warehouses.rows).toEqual([
      { code: 'A', status: 'active' },
      { code: 'B', status: 'inactive' },
    ])

    const items = await db.query<{ sku: string; reorder_level: number; unit_cost_minor: number; current_stock: number }>(
      'select sku, reorder_level, unit_cost_minor, current_stock from items'
    )
    expect(items.rows).toEqual([{ sku: 'S1', reorder_level: 5, unit_cost_minor: 750, current_stock: 0 }])
  })

  it('gives tenants created before the later migrations every permission their owner role needs', async () => {
    const { db, remaining } = await databaseAt('0005')
    const seeded = await seedProductionLikeData(db)
    await apply(db, remaining)

    const owner = await db.query<{ permission: string }>(
      `select rp.permission from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1 and r.name = 'owner'`,
      [seeded.tenant]
    )
    expect(owner.rows.map((row) => row.permission).sort()).toEqual([...allPermissions].sort())

    const viewer = await db.query<{ permission: string }>(
      `select rp.permission from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1 and r.name = 'viewer'`,
      [seeded.tenant]
    )
    expect(viewer.rows.map((row) => row.permission).filter((permission) => !permission.endsWith('.read'))).toEqual([])

    const rules = await n(db, `erp_automation_rules where tenant_id = '${seeded.tenant}'`)
    expect(rules).toBeGreaterThan(0)
  })

  it('refuses to run 0006 when the old stock ledger holds rows, and changes nothing', async () => {
    const { db, remaining } = await databaseAt('0005')
    const seeded = await seedProductionLikeData(db)
    const item = (await db.query<{ id: string }>('select id from items limit 1')).rows[0].id
    const warehouse = (await db.query<{ id: string }>(`select id from warehouses where code = 'A'`)).rows[0].id
    await db.query(
      `insert into stock_movements (tenant_id, item_id, warehouse_id, kind, quantity_milli, created_by) values ($1, $2, $3, 'receipt', 12500, $4)`,
      [seeded.tenant, item, warehouse, seeded.owner]
    )

    await expect(apply(db, remaining)).rejects.toThrow(/stock_movements already has rows/)

    expect(await n(db, 'stock_movements')).toBe(1)
    const column = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'warehouses' and column_name = 'is_active'`
    )
    expect(column.rows).toHaveLength(1)
    expect(await n(db, 'warehouses')).toBe(2)
    expect(await n(db, 'items')).toBe(1)
  })

  it('applies from an empty database to the latest schema without error', async () => {
    const { db, remaining } = await databaseAt('0001')
    expect(remaining).toHaveLength(23)
    await apply(db, remaining)
    expect(await n(db, 'tenants')).toBe(0)
    expect(await n(db, 'invoices')).toBe(0)
    expect(await n(db, 'items')).toBe(0)
    expect(await n(db, 'journal_entries')).toBe(0)
    expect(await n(db, 'stock_movements')).toBe(0)
    const tables = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public'`)
    expect(tables.rows[0].n).toBeGreaterThan(20)

    const defaults = await db.query<{ table_name: string; column_default: string }>(
      `select table_name, column_default from information_schema.columns
       where table_schema = 'public' and column_name = 'costing_method' order by table_name`
    )
    expect(defaults.rows.map((row) => row.table_name)).toEqual(['inventory_settings', 'procurement_accounting'])
    expect(defaults.rows.every((row) => row.column_default.includes('order_price'))).toBe(true)

    const guarded = await db.query<{ name: string; enabled: boolean }>(
      `select c.relname as name, c.relrowsecurity as enabled
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname in ('tenants', 'invoices', 'items', 'journal_entries', 'stock_movements')
       order by c.relname`
    )
    expect(guarded.rows.map((row) => row.name)).toEqual(['invoices', 'items', 'journal_entries', 'stock_movements', 'tenants'])
    expect(guarded.rows.every((row) => row.enabled === true)).toBe(true)
  })
})
