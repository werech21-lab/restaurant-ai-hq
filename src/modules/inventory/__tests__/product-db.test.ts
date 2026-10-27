import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions, permissions } from '@/lib/auth/permissions'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { createProduct, deleteProduct, listProducts, updateProduct } from '@/modules/inventory'
import { MAX_PRODUCT_PRICE_MINOR } from '@/modules/inventory/domain/types'

/** Products are tenant owned. The service is the only writer, so these tests cover the rules it enforces. */

let a: AuthContext
let b: AuthContext

const pg = () => getPglite()

function without(auth: AuthContext, ...removed: string[]): AuthContext {
  return { ...auth, permissions: new Set([...auth.permissions].filter((permission) => !removed.includes(permission))) }
}

function only(auth: AuthContext, ...granted: string[]): AuthContext {
  return { ...auth, permissions: new Set(granted) }
}

async function outcome(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'ok'
  } catch (error) {
    const typed = error as { status?: number; code?: string }
    return typed.status ? `${typed.status}:${typed.code}` : `error:${(error as Error).message}`
  }
}

const base = { name: 'Burger', category: 'Mains', priceMinor: 1_500, available: true }

async function count(table: string, tenantId?: string): Promise<number> {
  const result = tenantId
    ? await pg().query<{ n: number }>(`select count(*)::int as n from ${table} where tenant_id = $1`, [tenantId])
    : await pg().query<{ n: number }>(`select count(*)::int as n from ${table}`)
  return result.rows[0].n
}

beforeAll(async () => {
  await startDatabase()
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  await createUser(ownerA)
  await createUser(ownerB)
  a = { userId: ownerA, tenantId: await bootstrapTenant('Company A', 'products-a', ownerA), permissions: new Set<string>(allPermissions) }
  b = { userId: ownerB, tenantId: await bootstrapTenant('Company B', 'products-b', ownerB), permissions: new Set<string>(allPermissions) }
}, 120_000)
afterAll(stopDatabase)

describe('creating products', () => {
  it('stores exact fils, the caller as creator and the caller\'s tenant, and writes an audit row', async () => {
    const { data } = await createProduct(a, { ...base, priceMinor: 1_234 })
    expect(data).toMatchObject({ name: 'Burger', priceMinor: 1_234, currency: 'KWD', version: 1, createdBy: a.userId })
    const row = await pg().query<{ tenant_id: string; price: string }>('select tenant_id, price::text from products where id = $1', [data.id])
    expect(row.rows[0]).toEqual({ tenant_id: a.tenantId, price: '1.234' })
    const audit = await pg().query<{ action: string; actor_id: string; tenant_id: string; before: unknown }>(
      `select action, actor_id, tenant_id, before from audit_log where entity = 'product' and entity_id = $1`,
      [data.id]
    )
    expect(audit.rows).toEqual([{ action: 'create', actor_id: a.userId, tenant_id: a.tenantId, before: null }])
  })

  it('keeps the smallest, zero and the largest prices exact', async () => {
    for (const priceMinor of [0, 1, 999, MAX_PRODUCT_PRICE_MINOR]) {
      const { data } = await createProduct(a, { ...base, name: `P${priceMinor}`, priceMinor })
      expect(data.priceMinor).toBe(priceMinor)
    }
  })

  it('refuses a caller without inventory.item.create and writes nothing', async () => {
    const before = await count('products')
    const auditBefore = await count('audit_log')
    expect(await outcome(createProduct(without(a, permissions.inventoryItemCreate), base))).toBe('403:forbidden')
    expect(await outcome(createProduct(only(a, permissions.inventoryItemRead, permissions.inventoryItemUpdate), base))).toBe('403:forbidden')
    expect(await count('products')).toBe(before)
    expect(await count('audit_log')).toBe(auditBefore)
  })

  it('refuses a price above what the column holds instead of rounding it', async () => {
    const before = await count('products')
    expect(await outcome(createProduct(a, { ...base, priceMinor: MAX_PRODUCT_PRICE_MINOR + 1 }))).toMatch(/^error:/)
    expect(await count('products')).toBe(before)
  })
})

describe('listing products', () => {
  it('shows a company only its own products, paginated and searchable', async () => {
    for (let index = 0; index < 3; index += 1) await createProduct(b, { ...base, name: `B-only ${index}` })
    const listA = await listProducts(a, { page: 1 })
    const listB = await listProducts(b, { page: 1 })
    expect(listA.total).toBe(await count('products', a.tenantId))
    expect(listB.total).toBe(3)
    expect(listA.data.every((row) => !row.name.startsWith('B-only'))).toBe(true)
    expect(listB.data.every((row) => row.name.startsWith('B-only'))).toBe(true)

    const found = await listProducts(b, { q: 'only 1', page: 1 })
    expect(found.data.map((row) => row.name)).toEqual(['B-only 1'])
    const beyond = await listProducts(b, { page: 99 })
    expect(beyond.data).toEqual([])
    expect(beyond.total).toBe(3)
  })

  it('treats search text as text, not as a pattern or SQL', async () => {
    expect((await listProducts(b, { q: '%', page: 1 })).data).toEqual([])
    expect((await listProducts(b, { q: "'; drop table products; --", page: 1 })).data).toEqual([])
    expect(await count('products')).toBeGreaterThan(0)
  })

  it('requires inventory.item.read', async () => {
    expect(await outcome(listProducts(without(a, permissions.inventoryItemRead), { page: 1 }))).toBe('403:forbidden')
    expect(await outcome(listProducts(only(a, permissions.crmCustomerRead), { page: 1 }))).toBe('403:forbidden')
  })
})

describe('changing products', () => {
  it('updates with the current version, bumps it and records before and after', async () => {
    const { data } = await createProduct(a, base)
    const updated = (await updateProduct(a, data.id, { version: data.version, name: 'Burger XL', category: 'Mains', priceMinor: 2_000, available: false })).data
    expect(updated).toMatchObject({ name: 'Burger XL', priceMinor: 2_000, available: false, version: 2 })
    const audit = await pg().query<{ before: { name: string }; after: { name: string } }>(
      `select before, after from audit_log where entity = 'product' and entity_id = $1 and action = 'update'`,
      [data.id]
    )
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].before.name).toBe('Burger')
    expect(audit.rows[0].after.name).toBe('Burger XL')
  })

  it('answers 409 version_conflict for a stale version, and changes nothing', async () => {
    const { data } = await createProduct(a, base)
    await updateProduct(a, data.id, { ...base, version: 1, name: 'First edit' })
    expect(await outcome(updateProduct(a, data.id, { ...base, version: 1, name: 'Stale edit' }))).toBe('409:version_conflict')
    expect(await outcome(deleteProduct(a, data.id, { version: 1 }))).toBe('409:version_conflict')
    const row = await pg().query<{ name: string; version: number }>('select name, version from products where id = $1', [data.id])
    expect(row.rows[0]).toEqual({ name: 'First edit', version: 2 })
  })

  it('refuses update and delete without inventory.item.update, even to the creator', async () => {
    const { data } = await createProduct(a, base)
    const reader = only(a, permissions.inventoryItemRead, permissions.inventoryItemCreate)
    expect(await outcome(updateProduct(reader, data.id, { ...base, version: 1, name: 'Hacked' }))).toBe('403:forbidden')
    expect(await outcome(deleteProduct(reader, data.id, { version: 1 }))).toBe('403:forbidden')
    expect((await pg().query<{ name: string }>('select name from products where id = $1', [data.id])).rows[0].name).toBe('Burger')
  })

  it('deletes with the current version and keeps the product in the audit row', async () => {
    const { data } = await createProduct(a, { ...base, name: 'Short lived' })
    await deleteProduct(a, data.id, { version: 1 })
    expect((await pg().query('select 1 from products where id = $1', [data.id])).rows).toHaveLength(0)
    const audit = await pg().query<{ before: { name: string }; after: unknown }>(
      `select before, after from audit_log where entity = 'product' and entity_id = $1 and action = 'delete'`,
      [data.id]
    )
    expect(audit.rows).toEqual([{ before: expect.objectContaining({ name: 'Short lived' }), after: null }])
  })
})

describe('isolation between companies', () => {
  it('answers 404 for another company\'s product on update and delete, the same as for a missing one, and changes nothing', async () => {
    const { data } = await createProduct(a, { ...base, name: 'Only A' })
    const snapshot = async () => JSON.stringify((await pg().query('select * from products where id = $1', [data.id])).rows)
    const before = await snapshot()
    const auditBefore = await count('audit_log')

    expect(await outcome(updateProduct(b, data.id, { ...base, version: 1, name: 'Stolen' }))).toBe('404:product_not_found')
    expect(await outcome(deleteProduct(b, data.id, { version: 1 }))).toBe('404:product_not_found')
    expect(await outcome(updateProduct(b, randomUUID(), { ...base, version: 1 }))).toBe('404:product_not_found')

    expect(await snapshot()).toBe(before)
    expect(await count('audit_log')).toBe(auditBefore)
  })

  it('cannot be pointed at another company through the input, because the tenant comes from the caller', async () => {
    const hostile = { ...base, name: 'Hostile', tenantId: b.tenantId, tenant_id: b.tenantId } as typeof base
    const { data } = await createProduct(a, hostile)
    const row = await pg().query<{ tenant_id: string }>('select tenant_id from products where id = $1', [data.id])
    expect(row.rows[0].tenant_id).toBe(a.tenantId)
  })

  it('does not let the database move a product to another company', async () => {
    const { data } = await createProduct(a, base)
    await expect(pg().query('update products set tenant_id = $1 where id = $2', [b.tenantId, data.id])).rejects.toThrow(/cannot be changed/)
    await expect(pg().query('update products set created_by = $1 where id = $2', [b.userId, data.id])).rejects.toThrow(/cannot be changed/)
  })

  it('does not accept a product without a tenant or creator', async () => {
    await expect(pg().query(`insert into products (name, price, created_by) values ('Orphan', 1, $1)`, [a.userId])).rejects.toThrow(/products_owner_required/)
    await expect(pg().query(`insert into products (tenant_id, name, price) values ($1, 'No creator', 1)`, [a.tenantId])).rejects.toThrow(/products_owner_required/)
  })
})
