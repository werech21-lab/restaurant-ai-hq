import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { collectProductsReport, formatProductsReport, type Queryable } from '../../../scripts/ops-lib.mjs'

/**
 * The products report on an in-memory database shaped like a live project that has legacy rows: migrations 0001 to 0008,
 * the old products table with three rows, then 0009. The report must count rows without a tenant, change nothing, and
 * run only read statements.
 */

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 })

const migrationsDir = path.join(process.cwd(), 'database', 'migrations')

const legacySchema = `
  create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    category text not null default 'عام',
    price numeric(10, 3) not null check (price >= 0),
    available boolean not null default true,
    created_at timestamptz not null default now()
  );
`

const stub = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create role anon;
  create role authenticated;
`

let db: PGlite
const statements: string[] = []

const spy: Queryable = {
  query: async (text, params) => {
    statements.push(text.trim().toLowerCase())
    return db.query(text, params)
  },
}

async function fingerprint(): Promise<string> {
  const tables = ['products', 'tenants', 'audit_log']
  const parts: string[] = []
  for (const table of tables) {
    const exists = (await db.query<{ ok: boolean }>(`select to_regclass('public.${table}') is not null as ok`)).rows[0].ok
    if (!exists) continue
    parts.push((await db.query(`select * from public.${table} order by 1`)).rows.map((row) => JSON.stringify(row)).join('|'))
  }
  return createHash('sha256').update(parts.join('#')).digest('hex')
}

async function apply(filter: (name: string) => boolean): Promise<void> {
  for (const file of (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql') && filter(name)).sort()) {
    await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'))
  }
}

beforeAll(async () => {
  db = new PGlite({ parsers: { 20: (value: string) => Number(value), 1082: (value: string) => value } })
  await db.exec(stub)
})
afterAll(async () => db.close())

describe('before migration 0009', () => {
  it('reports every row as having no tenant, and says the migration is not applied', async () => {
    await apply((name) => name < '0009')
    await db.exec(legacySchema)
    for (const [name, price] of [['legacy-1', '1.500'], ['legacy-2', '0.001'], ['legacy-3', '12.250']]) {
      await db.query('insert into products (name, price) values ($1, $2)', [name, price])
    }
    const before = await fingerprint()
    statements.length = 0
    const report = await collectProductsReport(spy)
    expect(report).toMatchObject({ state: 'before_0009', total: 3, withoutTenant: 3, withTenant: 0, tenants: 0, byTenant: [] })
    expect(await fingerprint()).toBe(before)
  })

  it('runs only reads, inside a read-only transaction that is rolled back', () => {
    expect(statements[0]).toBe('begin read only')
    expect(statements.at(-1)).toBe('rollback')
    for (const statement of statements.slice(1, -1)) expect(statement).toMatch(/^select /)
    expect(statements.some((statement) => /\b(insert|update|delete|alter|drop|create|truncate|grant)\b\s/.test(statement.replace(/\s+/g, ' ').replace(/^select .*? from /, '')))).toBe(false)
  })

  it('cannot write even if it tried: the transaction is read only', async () => {
    await db.query('begin read only')
    await expect(db.query(`insert into products (name, price) values ('x', 1)`)).rejects.toThrow(/read-only/i)
    await db.query('rollback')
  })
})

describe('after migration 0009', () => {
  it('keeps the legacy rows untouched and still counts them as missing a tenant', async () => {
    const before = await fingerprint()
    await apply((name) => name >= '0009')
    const report = await collectProductsReport(spy)
    expect(report).toMatchObject({ state: 'after_0009', total: 3, withoutTenant: 3, withTenant: 0, withoutCreator: 3, tenants: 0 })
    const after = (await db.query(`select name, price::text, tenant_id from products order by name`)).rows
    expect(after).toEqual([
      { name: 'legacy-1', price: '1.500', tenant_id: null },
      { name: 'legacy-2', price: '0.001', tenant_id: null },
      { name: 'legacy-3', price: '12.250', tenant_id: null },
    ])
    expect(before).toBeTruthy()
  })

  it('counts rows per tenant once some are assigned (by hand here, never by the report)', async () => {
    const owner = (await db.query<{ id: string }>(`insert into auth.users (id) values (gen_random_uuid()) returning id`)).rows[0].id
    const tenant = (await db.query<{ id: string }>('select erp_bootstrap_tenant($1, $2, $3) as id', ['Report Co', 'report-co', owner])).rows[0].id
    await db.query(`update products set tenant_id = $1, created_by = $2 where name = 'legacy-1'`, [tenant, owner])
    await db.query(`insert into products (tenant_id, created_by, name, price) values ($1, $2, 'new-1', 2)`, [tenant, owner])
    const before = await fingerprint()
    const report = await collectProductsReport(spy)
    expect(report).toMatchObject({ total: 4, withoutTenant: 2, withTenant: 2, withoutCreator: 2, tenants: 1, byTenant: [{ tenantId: tenant, products: 2 }] })
    expect(await fingerprint()).toBe(before)
  })

  it('prints counts and tenant ids only, never a product name or price', async () => {
    const report = await collectProductsReport(spy)
    const text = formatProductsReport(report, { host: 'db.example.test', user: 'postgres', database: 'postgres' })
    expect(text).toContain('rows WITHOUT tenant_id:     2')
    expect(text).not.toMatch(/legacy-|new-1|12\.250/)
    expect(text).toContain('no company')
  })
})
