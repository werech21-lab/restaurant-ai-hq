import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions, permissions } from '@/lib/auth/permissions'
import { subscribe, type BusEvent } from '@/lib/events/bus'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

import { createBranch, createBrand, getBranch, getBrand, listBranches, listBrands, updateBranch, updateBrand } from '@/modules/org'
import { createBranchSchema, createBrandSchema } from '@/modules/org/client'

/** Brands and branches against the real migrations: tenant isolation, permissions, versions, the inactive rules and audit. */

const pg = () => getPglite()
let a: AuthContext
let b: AuthContext
const events: BusEvent[] = []

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

beforeAll(async () => {
  await startDatabase()
  for (const name of ['org.brand.created', 'org.brand.updated', 'org.branch.created', 'org.branch.updated']) subscribe(name, (event) => void events.push(event))
  const ownerA = randomUUID()
  const ownerB = randomUUID()
  await createUser(ownerA)
  await createUser(ownerB)
  a = { userId: ownerA, tenantId: await bootstrapTenant('Org A', 'org-a', ownerA), permissions: new Set<string>(allPermissions) }
  b = { userId: ownerB, tenantId: await bootstrapTenant('Org B', 'org-b', ownerB), permissions: new Set<string>(allPermissions) }
}, 120_000)
afterAll(stopDatabase)

describe('brands', () => {
  it('creates a brand with an upper-case code, the caller as creator, an audit row and an event after commit', async () => {
    const { data } = await createBrand(a, { code: 'GOLD-LINE', name: 'Gold Line', status: 'active' })
    expect(data).toMatchObject({ code: 'GOLD-LINE', name: 'Gold Line', status: 'active', branchCount: 0, version: 1, createdBy: a.userId })
    const audit = await pg().query<{ action: string; actor_id: string; before: unknown }>(`select action, actor_id, before from audit_log where entity = 'brand' and entity_id = $1`, [data.id])
    expect(audit.rows).toEqual([{ action: 'create', actor_id: a.userId, before: null }])
    expect(events.map((event) => event.name)).toContain('org.brand.created')
  })

  it('upper-cases codes in the schema and rejects bad ones', () => {
    expect(createBrandSchema.parse({ code: 'gold-line', name: 'x' }).code).toBe('GOLD-LINE')
    expect(createBrandSchema.safeParse({ code: 'has space', name: 'x' }).success).toBe(false)
    expect(createBrandSchema.safeParse({ code: 'A'.repeat(21), name: 'x' }).success).toBe(false)
  })

  it('refuses a duplicate code inside a company and allows it in another', async () => {
    await createBrand(a, { code: 'DUP', name: 'One', status: 'active' })
    expect(await outcome(createBrand(a, createBrandSchema.parse({ code: 'dup', name: 'Two' })))).toBe('409:brand_code_exists')
    expect(await outcome(createBrand(b, { code: 'DUP', name: 'Other company', status: 'active' }))).toBe('ok')
  })

  it('updates with the version, never the code, and refuses a stale version', async () => {
    const { data } = await createBrand(a, { code: 'UPD', name: 'Before', status: 'active' })
    expect(await outcome(updateBrand(a, data.id, { version: 5, name: 'X', status: 'active' }))).toBe('409:version_conflict')
    const updated = await updateBrand(a, data.id, { version: 1, name: 'After', status: 'active' })
    expect(updated.data).toMatchObject({ name: 'After', code: 'UPD', version: 2 })
    const audit = await pg().query<{ before: { name: string }; after: { name: string } }>(`select before, after from audit_log where entity = 'brand' and entity_id = $1 and action = 'update'`, [data.id])
    expect(audit.rows[0].before.name).toBe('Before')
    expect(audit.rows[0].after.name).toBe('After')
  })

  it('is invisible and untouchable across companies', async () => {
    const { data } = await createBrand(a, { code: 'PRIV', name: 'Private', status: 'active' })
    expect(await outcome(getBrand(b, data.id))).toBe('404:brand_not_found')
    expect(await outcome(updateBrand(b, data.id, { version: 1, name: 'Stolen', status: 'inactive' }))).toBe('404:brand_not_found')
    expect((await listBrands(b, { limit: 100, status: 'all' })).data.map((brand) => brand.id)).not.toContain(data.id)
    expect(await outcome(createBranch(b, { brandId: data.id, code: 'X1', name: 'Into a foreign brand', timezone: 'UTC', status: 'active' }))).toBe('404:brand_not_found')
  })

  it('refuses every action without the matching permission', async () => {
    const none = only(a)
    const { data } = await createBrand(a, { code: 'PERM', name: 'Perm', status: 'active' })
    const results = await Promise.all([
      outcome(createBrand(none, { code: 'NOPE', name: 'x', status: 'active' })),
      outcome(updateBrand(only(a, permissions.orgBrandRead), data.id, { version: 1, name: 'x', status: 'active' })),
      outcome(listBrands(none, { limit: 10, status: 'all' })),
      outcome(getBrand(only(a, permissions.orgBranchRead), data.id)),
      outcome(createBranch(only(a, permissions.orgBranchRead), { brandId: data.id, code: 'NOPE', name: 'x', timezone: 'UTC', status: 'active' })),
      outcome(listBranches(only(a, permissions.orgBrandRead), { limit: 10, status: 'all' })),
    ])
    expect(results).toEqual(Array(6).fill('403:forbidden'))
  })

  it('pages with a cursor and a bounded page size', async () => {
    for (let index = 0; index < 5; index += 1) await createBrand(b, { code: `PG${index}`, name: `Paged ${index}`, status: 'active' })
    const first = await listBrands(b, { limit: 2, status: 'all' })
    expect(first.data).toHaveLength(2)
    const second = await listBrands(b, { limit: 2, status: 'all', cursor: first.nextCursor ?? undefined })
    expect(second.data.map((brand) => brand.id).filter((id) => first.data.some((seen) => seen.id === id))).toEqual([])
  })
})

describe('branches', () => {
  it('creates a branch under an active brand, with its brand name, timezone, audit and event', async () => {
    const { data: brand } = await createBrand(a, { code: 'BR1', name: 'Brand One', status: 'active' })
    const { data } = await createBranch(a, { brandId: brand.id, code: 'KW-01', name: 'Kuwait City', timezone: 'Asia/Kuwait', status: 'active' })
    expect(data).toMatchObject({ code: 'KW-01', brandId: brand.id, brandName: 'Brand One', timezone: 'Asia/Kuwait', status: 'active' })
    expect((await getBrand(a, brand.id)).data.branchCount).toBe(1)
    expect(events.map((event) => event.name)).toContain('org.branch.created')
    expect((await listBranches(a, { limit: 50, status: 'all', brandId: brand.id })).data.map((branch) => branch.id)).toEqual([data.id])
    expect((await getBranch(a, data.id)).data.id).toBe(data.id)
  })

  it('refuses a duplicate code, an unknown time zone and an active branch under an inactive brand', async () => {
    const { data: brand } = await createBrand(a, { code: 'BR2', name: 'Brand Two', status: 'active' })
    await createBranch(a, { brandId: brand.id, code: 'B2-1', name: 'One', timezone: 'UTC', status: 'active' })
    expect(await outcome(createBranch(a, { brandId: brand.id, code: 'B2-1', name: 'Again', timezone: 'UTC', status: 'active' }))).toBe('409:branch_code_exists')
    expect(createBranchSchema.safeParse({ brandId: brand.id, code: 'B2-2', name: 'x', timezone: 'Mars/Olympus' }).success).toBe(false)
    const { data: inactive } = await createBrand(a, { code: 'BR3', name: 'Brand Three', status: 'inactive' })
    expect(await outcome(createBranch(a, { brandId: inactive.id, code: 'B3-1', name: 'x', timezone: 'UTC', status: 'active' }))).toBe('422:brand_inactive')
    expect(await outcome(createBranch(a, { brandId: inactive.id, code: 'B3-2', name: 'x', timezone: 'UTC', status: 'inactive' }))).toBe('ok')
  })

  it('does not let a brand with active branches become inactive until they are, and not reactivate a branch under it', async () => {
    const { data: brand } = await createBrand(a, { code: 'BR4', name: 'Brand Four', status: 'active' })
    const { data: branch } = await createBranch(a, { brandId: brand.id, code: 'B4-1', name: 'Four One', timezone: 'UTC', status: 'active' })
    expect(await outcome(updateBrand(a, brand.id, { version: 1, name: 'Brand Four', status: 'inactive' }))).toBe('409:brand_has_active_branches')
    await updateBranch(a, branch.id, { version: 1, name: 'Four One', timezone: 'UTC', status: 'inactive' })
    await updateBrand(a, brand.id, { version: 1, name: 'Brand Four', status: 'inactive' })
    expect(await outcome(updateBranch(a, branch.id, { version: 2, name: 'Four One', timezone: 'UTC', status: 'active' }))).toBe('422:brand_inactive')
  })

  it('refuses a stale version and another company\'s branch', async () => {
    const { data: brand } = await createBrand(a, { code: 'BR5', name: 'Brand Five', status: 'active' })
    const { data: branch } = await createBranch(a, { brandId: brand.id, code: 'B5-1', name: 'Five One', timezone: 'UTC', status: 'active' })
    expect(await outcome(updateBranch(a, branch.id, { version: 3, name: 'x', timezone: 'UTC', status: 'active' }))).toBe('409:version_conflict')
    expect(await outcome(updateBranch(b, branch.id, { version: 1, name: 'x', timezone: 'UTC', status: 'inactive' }))).toBe('404:branch_not_found')
    expect(await outcome(getBranch(b, branch.id))).toBe('404:branch_not_found')
  })
})

describe('the database itself', () => {
  it('refuses to move a branch to another brand, change a code, or delete a row, even for the owner role', async () => {
    const { data: one } = await createBrand(a, { code: 'DB1', name: 'DB One', status: 'active' })
    const { data: two } = await createBrand(a, { code: 'DB2', name: 'DB Two', status: 'active' })
    const { data: branch } = await createBranch(a, { brandId: one.id, code: 'DB1-1', name: 'x', timezone: 'UTC', status: 'active' })
    await expect(pg().query('update branches set brand_id = $2 where id = $1', [branch.id, two.id])).rejects.toThrow(/cannot change/)
    await expect(pg().query(`update branches set code = 'OTHER' where id = $1`, [branch.id])).rejects.toThrow(/cannot change/)
    await expect(pg().query(`update brands set code = 'OTHER' where id = $1`, [one.id])).rejects.toThrow(/cannot change/)
    await expect(pg().query('delete from branches where id = $1', [branch.id])).rejects.toThrow(/cannot be deleted/)
    await expect(pg().query('delete from brands where id = $1', [one.id])).rejects.toThrow(/cannot be deleted/)
  })

  it('refuses a branch whose brand belongs to another company', async () => {
    const { data: brandB } = await createBrand(b, { code: 'FKB', name: 'FK B', status: 'active' })
    await expect(
      pg().query(`insert into branches (tenant_id, brand_id, code, name, created_by) values ($1, $2, 'FK-1', 'x', $3)`, [a.tenantId, brandB.id, a.userId])
    ).rejects.toThrow()
  })

  it('refuses an active branch under an inactive brand even when the service is bypassed', async () => {
    const { data: brand } = await createBrand(a, { code: 'BYP', name: 'Bypass', status: 'inactive' })
    await expect(
      pg().query(`insert into branches (tenant_id, brand_id, code, name, status, created_by) values ($1, $2, 'BYP-1', 'x', 'active', $3)`, [a.tenantId, brand.id, a.userId])
    ).rejects.toThrow(/active brand/)
  })

  it('gives the owner role the org permissions for a company created by the bootstrap function', async () => {
    const owner = await pg().query<{ permission: string }>(
      `select rp.permission from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1 and r.name = 'owner' and rp.permission like 'org.%' order by 1`,
      [a.tenantId]
    )
    expect(owner.rows.map((row) => row.permission)).toEqual(['org.branch.manage', 'org.branch.read', 'org.brand.manage', 'org.brand.read'])
    const viewer = await pg().query(`select 1 from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1 and r.name <> 'owner' and rp.permission like 'org.%'`, [a.tenantId])
    expect(viewer.rows).toEqual([])
  })
})