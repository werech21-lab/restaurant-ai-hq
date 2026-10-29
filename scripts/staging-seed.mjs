// Idempotent staging sample: one company, a chart of accounts, and master records. No journals and no payments.
// Refuses every database except the approved staging project, before connecting.
//
//   node --env-file=.env.staging scripts/staging-seed.mjs --expect-host pikqnlzkoaxoxpahztvc --i-understand-this-is-staging
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { assertMigrationTarget, sslOptions } from './migrate-lib.mjs'

const expectIndex = process.argv.indexOf('--expect-host')
const expectHost = expectIndex === -1 ? undefined : process.argv[expectIndex + 1]
const acknowledged = process.argv.includes('--i-understand-this-is-staging')
const url = process.env.DATABASE_URL
if (!url) {
  process.stderr.write('DATABASE_URL is not set.\n')
  process.exit(1)
}

const approvedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database', 'approved-staging-targets.json')
const approved = JSON.parse(await readFile(approvedPath, 'utf8')).projects
try {
  assertMigrationTarget(url, { expectHost, acknowledged, approved })
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}

const email = 'demo-owner@aether-staging.invalid'
const slug = 'aether-demo'
const accounts = [
  ['1000', 'Cash', 'asset'],
  ['1200', 'Inventory', 'asset'],
  ['1300', 'Input tax', 'asset'],
  ['1400', 'Goods received not invoiced', 'asset'],
  ['2000', 'Accounts payable', 'liability'],
  ['4000', 'Sales', 'revenue'],
  ['5100', 'Purchase price variance', 'expense'],
  ['5200', 'Cost of goods', 'expense'],
  ['5300', 'Delivery commission', 'expense'],
  ['1100', 'Accounts receivable', 'asset'],
]

const client = new pg.Client({ connectionString: url, ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA) })
await client.connect()

function ownerValue(column, id) {
  const now = new Date().toISOString()
  const values = {
    id,
    instance_id: '00000000-0000-0000-0000-000000000000',
    aud: 'authenticated',
    role: 'authenticated',
    email,
    encrypted_password: '',
    email_confirmed_at: now,
    confirmation_token: '',
    recovery_token: '',
    email_change_token_new: '',
    email_change: '',
    email_change_token_current: '',
    reauthentication_token: '',
    phone: '',
    phone_change: '',
    phone_change_token: '',
    email_change_confirm_status: 0,
    is_sso_user: false,
    is_anonymous: false,
    raw_app_meta_data: { provider: 'email', providers: ['email'] },
    raw_user_meta_data: {},
    created_at: now,
    updated_at: now,
  }
  return Object.prototype.hasOwnProperty.call(values, column) ? values[column] : undefined
}

try {
  const migrations = await client.query('select count(*)::int as n from schema_migrations')
  const tables = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public'")
  process.stdout.write(`migrations ${migrations.rows[0].n}\npublic_tables ${tables.rows[0].n}\n`)

  await client.query('begin')
  const found = await client.query('select id from auth.users where email = $1', [email])
  let ownerId = found.rows[0]?.id
  if (!ownerId) {
    ownerId = crypto.randomUUID()
    const needed = await client.query(
      `select column_name from information_schema.columns
       where table_schema = 'auth' and table_name = 'users' and is_nullable = 'NO' and column_default is null
       order by ordinal_position`
    )
    const columns = []
    const params = []
    const missing = []
    for (const row of needed.rows) {
      const value = ownerValue(row.column_name, ownerId)
      if (value === undefined) missing.push(row.column_name)
      else {
        columns.push(row.column_name)
        params.push(value)
      }
    }
    if (!columns.includes('email')) {
      columns.push('email')
      params.push(email)
    }
    if (missing.length > 0) throw new Error(`auth.users needs columns the seed does not set: ${missing.join(', ')}`)
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
    await client.query(`insert into auth.users (${columns.join(', ')}) values (${placeholders})`, params)
  }

  const tenant = await client.query('select id from tenants where slug = $1', [slug])
  let tenantId = tenant.rows[0]?.id
  if (!tenantId) {
    const created = await client.query('select erp_bootstrap_tenant($1, $2, $3) as id', ['Aether Demo', slug, ownerId])
    tenantId = created.rows[0].id
  }

  for (const [code, name, type] of accounts) {
    await client.query(
      `insert into accounts (tenant_id, code, name, type, is_postable, created_by)
       values ($1, $2, $3, $4, true, $5)
       on conflict (tenant_id, code) do nothing`,
      [tenantId, code, name, type, ownerId]
    )
  }
  const period = await client.query('select id from fiscal_periods where tenant_id = $1 and name = $2', [tenantId, 'FY2026'])
  if (period.rows.length === 0) {
    await client.query(
      `insert into fiscal_periods (tenant_id, name, starts_on, ends_on, created_by)
       values ($1, 'FY2026', '2026-01-01', '2026-12-31', $2)`,
      [tenantId, ownerId]
    )
  }
  await client.query(
    `insert into warehouses (tenant_id, code, name, status, created_by)
     values ($1, 'DEMO-MAIN', 'DEMO main warehouse', 'active', $2)
     on conflict (tenant_id, code) do nothing`,
    [tenantId, ownerId]
  )
  await client.query(
    `insert into items (tenant_id, sku, name, unit, unit_cost_minor, selling_price_minor, reorder_level, is_active, created_by)
     values ($1, 'DEMO-FLOUR', 'DEMO flour', 'piece', 800, 1500, 5, true, $2)
     on conflict (tenant_id, sku) do nothing`,
    [tenantId, ownerId]
  )
  await client.query(
    `insert into suppliers (tenant_id, code, name, payment_terms_days, notes, created_by)
     values ($1, 'DEMO', 'DEMO mill', 30, 'DEMO staging seed', $2)
     on conflict (tenant_id, code) do nothing`,
    [tenantId, ownerId]
  )
  const customer = await client.query('select id from customers where tenant_id = $1 and name = $2', [tenantId, 'DEMO cafe'])
  if (customer.rows.length === 0) {
    await client.query(
      `insert into customers (tenant_id, name, status, customer_type, notes, created_by)
       values ($1, 'DEMO cafe', 'active', 'company', 'DEMO staging seed', $2)`,
      [tenantId, ownerId]
    )
  }
  const kitchen = await client.query("select to_regclass('public.recipes') is not null as ok")
  if (kitchen.rows[0].ok) {
    const flour = await client.query('select id from items where tenant_id = $1 and sku = $2', [tenantId, 'DEMO-FLOUR'])
    const itemId = flour.rows[0]?.id
    if (itemId) {
      const recipe = await client.query(
        `insert into recipes (tenant_id, name, yield_quantity, notes, created_by)
         values ($1, 'DEMO bread', 1, 'DEMO staging seed', $2)
         on conflict (tenant_id, name) do update set name = excluded.name
         returning id`,
        [tenantId, ownerId]
      )
      const recipeId = recipe.rows[0].id
      const line = await client.query('select id from recipe_lines where tenant_id = $1 and recipe_id = $2 and item_id = $3', [tenantId, recipeId, itemId])
      if (line.rows.length === 0) {
        await client.query(
          'insert into recipe_lines (tenant_id, recipe_id, item_id, quantity, created_by) values ($1, $2, $3, 1, $4)',
          [tenantId, recipeId, itemId, ownerId]
        )
      }
      const waste = await client.query("select id from kitchen_waste where tenant_id = $1 and reason = 'DEMO spill'", [tenantId])
      if (waste.rows.length === 0) {
        await client.query(
          'insert into kitchen_waste (tenant_id, item_id, quantity, wasted_on, reason, created_by) values ($1, $2, 1, $3, $4, $5)',
          [tenantId, itemId, '2026-10-28', 'DEMO spill', ownerId]
        )
      }
    }
    const partner = await client.query(
      `insert into delivery_partners (tenant_id, code, name, commission_bps, created_by)
       values ($1, 'DEMO', 'DEMO rider', 0, $2)
       on conflict (tenant_id, code) do update set name = excluded.name
       returning id`,
      [tenantId, ownerId]
    )
    const existingOrder = await client.query(
      "select id from delivery_orders where tenant_id = $1 and partner_id = $2 and ordered_on = '2026-10-28'",
      [tenantId, partner.rows[0].id]
    )
    if (existingOrder.rows.length === 0) {
      await client.query(
        `insert into delivery_orders (tenant_id, partner_id, ordered_on, gross_minor, commission_minor, status, created_by)
         values ($1, $2, '2026-10-28', 2000, 500, 'recorded', $3)`,
        [tenantId, partner.rows[0].id, ownerId]
      )
    }
  }
  const operational = await client.query(
    `select exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'finance_settings' and column_name = 'receivable_account_id'
     ) as ok`
  )
  if (operational.rows[0].ok) {
    await client.query(
      `update finance_settings s
          set receivable_account_id = ar.id,
              collection_account_id = cash.id,
              commission_account_id = fee.id
         from accounts cash, accounts ar, accounts fee
        where s.tenant_id = $1
          and cash.tenant_id = s.tenant_id and cash.code = '1000'
          and ar.tenant_id = s.tenant_id and ar.code = '1100'
          and fee.tenant_id = s.tenant_id and fee.code = '5300'
          and s.receivable_account_id is null`,
      [tenantId]
    )
  }
  const revenueColumn = await client.query(
    `select exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'finance_settings' and column_name = 'revenue_account_id'
     ) as ok`
  )
  if (revenueColumn.rows[0].ok) {
    await client.query(
      `update finance_settings s
          set revenue_account_id = sales.id
         from accounts sales
        where s.tenant_id = $1
          and sales.tenant_id = s.tenant_id and sales.code = '4000'
          and s.revenue_account_id is null`,
      [tenantId]
    )
  }
  await client.query('commit')

  const counts = await client.query(
    `select
       (select count(*)::int from accounts where tenant_id = $1) as accounts,
       (select count(*)::int from fiscal_periods where tenant_id = $1) as periods,
       (select count(*)::int from warehouses where tenant_id = $1) as warehouses,
       (select count(*)::int from items where tenant_id = $1) as items,
       (select count(*)::int from suppliers where tenant_id = $1) as suppliers,
       (select count(*)::int from customers where tenant_id = $1) as customers,
       (select count(*)::int from tenants where status = 'active') as active_tenants`,
    [tenantId]
  )
  const row = counts.rows[0]
  process.stdout.write(
    `tenant ${slug} accounts ${row.accounts} periods ${row.periods} warehouses ${row.warehouses} items ${row.items} suppliers ${row.suppliers} customers ${row.customers} active_tenants ${row.active_tenants}\n`
  )
} catch (error) {
  await client.query('rollback').catch(() => undefined)
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Seed failed: ${message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
