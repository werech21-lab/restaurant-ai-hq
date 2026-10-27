import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import { AppError } from '@/lib/api/errors'
import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError } from '@/lib/money'

type FakeUser = { id: string } | null
let currentUser: FakeUser = null
let supabaseConfigured = true

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    supabaseConfigured
      ? { auth: { getUser: async () => ({ data: { user: currentUser }, error: currentUser ? null : new Error('no session') }) } }
      : null,
}))

import { authenticate } from '@/lib/auth/context'
import { allPermissions, permissions, type Permission } from '@/lib/auth/permissions'
import { protectedRoute, toErrorResponse } from '@/lib/api/route'

const pg = () => getPglite()

type Actor = { userId: string; tenantId: string }

let counter = 0

async function newOwner(): Promise<Actor> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Tenant ${++counter}`, `auth-tenant-${counter}`, userId)
  return { userId, tenantId }
}

/** Adds a member to a tenant with a role that holds exactly `granted`. */
async function addMember(tenantId: string, ownerId: string, granted: readonly string[]): Promise<string> {
  const userId = randomUUID()
  await createUser(userId)
  const role = await pg().query<{ id: string }>(
    `insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id`,
    [tenantId, `custom-${randomUUID()}`, ownerId]
  )
  for (const permission of granted) {
    await pg().query(`insert into role_permissions (tenant_id, role_id, permission, created_by) values ($1, $2, $3, $4)`, [
      tenantId,
      role.rows[0].id,
      permission,
      ownerId,
    ])
  }
  await pg().query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [
    tenantId,
    userId,
    role.rows[0].id,
    ownerId,
  ])
  return userId
}

function request(headers: Record<string, string> = {}, url = 'http://localhost/api/v1/finance/invoices'): NextRequest {
  return new NextRequest(url, { headers })
}

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AppError) return error
    throw error
  }
  throw new Error('Expected the call to be rejected')
}

beforeAll(startDatabase)
afterAll(stopDatabase)
beforeEach(() => {
  currentUser = null
  supabaseConfigured = true
})

describe('authenticate', () => {
  it('answers 500 server_misconfigured when Supabase is not configured', async () => {
    supabaseConfigured = false
    const error = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([500, 'server_misconfigured'])
  })

  it('answers 401 when nobody is signed in', async () => {
    const error = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([401, 'unauthenticated'])
  })

  it('rejects a malformed x-tenant-id with 400', async () => {
    const owner = await newOwner()
    currentUser = { id: owner.userId }
    const error = await failure(authenticate(request({ 'x-tenant-id': "x'; drop table invoices;--" }), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([400, 'tenant_invalid'])
  })

  it('answers 403 for a signed-in user who belongs to no tenant', async () => {
    const stranger = randomUUID()
    await createUser(stranger)
    currentUser = { id: stranger }
    const error = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([403, 'no_tenant_access'])
  })

  it('resolves the tenant from membership and returns only that role\'s permissions', async () => {
    const owner = await newOwner()
    const viewer = await addMember(owner.tenantId, owner.userId, [permissions.financeInvoiceRead])
    currentUser = { id: viewer }
    const auth = await authenticate(request(), permissions.financeInvoiceRead)
    expect(auth.userId).toBe(viewer)
    expect(auth.tenantId).toBe(owner.tenantId)
    expect([...auth.permissions]).toEqual([permissions.financeInvoiceRead])
  })

  it('answers 403 forbidden when the role lacks the required permission', async () => {
    const owner = await newOwner()
    const viewer = await addMember(owner.tenantId, owner.userId, [permissions.financeInvoiceRead])
    currentUser = { id: viewer }
    for (const needed of [permissions.financeInvoiceApprove, permissions.financePaymentCreate, permissions.aiActionApprove]) {
      const error = await failure(authenticate(request(), needed))
      expect([error.status, error.code]).toEqual([403, 'forbidden'])
    }
  })

  it('answers 403 for a member with a role that has no permissions at all', async () => {
    const owner = await newOwner()
    const empty = await addMember(owner.tenantId, owner.userId, [])
    currentUser = { id: empty }
    const error = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([403, 'forbidden'])
  })

  it('refuses a tenant the user does not belong to, even with a valid header', async () => {
    const tenantA = await newOwner()
    const tenantB = await newOwner()
    currentUser = { id: tenantA.userId }
    const error = await failure(authenticate(request({ 'x-tenant-id': tenantB.tenantId }), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([403, 'no_tenant_access'])
  })

  it('requires x-tenant-id for a user in several tenants and then scopes to the chosen one', async () => {
    const tenantA = await newOwner()
    const tenantB = await newOwner()
    const shared = await addMember(tenantA.tenantId, tenantA.userId, [permissions.financeInvoiceRead])
    // The same user joins tenant B with a different role.
    const roleB = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [tenantB.tenantId])
    await pg().query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [
      tenantB.tenantId,
      shared,
      roleB.rows[0].id,
      tenantB.userId,
    ])
    currentUser = { id: shared }

    const missing = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([missing.status, missing.code]).toEqual([400, 'tenant_required'])

    const chosen = await authenticate(request({ 'x-tenant-id': tenantA.tenantId }), permissions.financeInvoiceRead)
    expect(chosen.tenantId).toBe(tenantA.tenantId)
    expect([...chosen.permissions]).toEqual([permissions.financeInvoiceRead])

    const other = await authenticate(request({ 'x-tenant-id': tenantB.tenantId }), permissions.financeInvoiceRead)
    expect(other.tenantId).toBe(tenantB.tenantId)
  })

  it('does not let the permissions of one tenant leak into another for the same user', async () => {
    const tenantA = await newOwner()
    const tenantB = await newOwner()
    const shared = await addMember(tenantA.tenantId, tenantA.userId, [permissions.financeInvoiceApprove])
    const roleB = await pg().query<{ id: string }>(`select id from roles where tenant_id = $1 and name = 'viewer'`, [tenantB.tenantId])
    await pg().query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [
      tenantB.tenantId,
      shared,
      roleB.rows[0].id,
      tenantB.userId,
    ])
    currentUser = { id: shared }
    const error = await failure(authenticate(request({ 'x-tenant-id': tenantB.tenantId }), permissions.financeInvoiceApprove))
    expect([error.status, error.code]).toEqual([403, 'forbidden'])
  })

  it('answers 403 for a suspended tenant, even for its owner', async () => {
    const owner = await newOwner()
    currentUser = { id: owner.userId }
    await authenticate(request(), permissions.financeInvoiceRead)
    await pg().query(`update tenants set status = 'suspended' where id = $1`, [owner.tenantId])
    const error = await failure(authenticate(request(), permissions.financeInvoiceRead))
    expect([error.status, error.code]).toEqual([403, 'no_tenant_access'])
  })
})

describe('role grants', () => {
  it('gives the owner role every permission in the catalogue', async () => {
    const owner = await newOwner()
    currentUser = { id: owner.userId }
    const auth = await authenticate(request(), permissions.financeInvoiceRead)
    expect([...auth.permissions].sort()).toEqual([...allPermissions].sort())
  })

  it('only seeds permissions that exist in the catalogue', async () => {
    const owner = await newOwner()
    const known = new Set<string>(allPermissions)
    const rows = await pg().query<{ permission: string; role: string }>(
      `select rp.permission, r.name as role from role_permissions rp join roles r on r.id = rp.role_id where rp.tenant_id = $1`,
      [owner.tenantId]
    )
    expect(rows.rows.length).toBeGreaterThan(0)
    expect(rows.rows.filter((row) => !known.has(row.permission))).toEqual([])
  })

  it('keeps destructive and approval permissions away from the viewer role', async () => {
    const owner = await newOwner()
    const rows = await pg().query<{ permission: string }>(
      `select rp.permission from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = $1 and r.name = 'viewer'`,
      [owner.tenantId]
    )
    const granted = rows.rows.map((row) => row.permission)
    expect(granted.length).toBeGreaterThan(0)
    const writeLike = granted.filter((permission) => !permission.endsWith('.read'))
    expect(writeLike).toEqual([])
  })

  it('uses the same permission names as the catalogue in every constant', () => {
    const values = Object.values(permissions)
    expect(new Set(values).size).toBe(values.length)
    for (const value of values) expect(value).toMatch(/^[a-z_]+\.[a-z_]+\.[a-z_]+$/)
  })
})

describe('protectedRoute and toErrorResponse', () => {
  let calls = 0
  const route = protectedRoute(permissions.financeInvoiceApprove as Permission, async ({ auth }) => {
    calls += 1
    return NextResponse.json({ tenantId: auth.tenantId })
  })

  beforeEach(() => {
    calls = 0
  })

  it('does not run the handler without a session', async () => {
    const response = await route(request(), { params: {} })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: { code: 'unauthenticated', message: 'Sign in to continue.' } })
    expect(calls).toBe(0)
  })

  it('does not run the handler without the permission', async () => {
    const owner = await newOwner()
    const viewer = await addMember(owner.tenantId, owner.userId, [permissions.financeInvoiceRead])
    currentUser = { id: viewer }
    const response = await route(request(), { params: {} })
    expect(response.status).toBe(403)
    expect(calls).toBe(0)
  })

  it('runs the handler with the resolved tenant when permitted', async () => {
    const owner = await newOwner()
    currentUser = { id: owner.userId }
    const response = await route(request(), { params: {} })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tenantId: owner.tenantId })
  })

  it('maps validation, domain, currency and database errors to the standard body', async () => {
    const zodError = z.object({ name: z.string() }).safeParse({}).error
    if (!zodError) throw new Error('expected a ZodError')
    const validation = toErrorResponse(zodError)
    expect(validation.status).toBe(422)
    expect((await validation.json()).error.code).toBe('validation_failed')

    expect(toErrorResponse(new CurrencyMismatchError('USD', 'KWD')).status).toBe(422)
    expect(toErrorResponse(new DomainError('insufficient_stock', 'short')).status).toBe(409)
    expect(toErrorResponse(new DomainError('anything_else', 'x')).status).toBe(422)
    expect(toErrorResponse({ code: '23505' }).status).toBe(409)
    expect(toErrorResponse({ code: '23503' }).status).toBe(422)
    expect(toErrorResponse({ code: '23514' }).status).toBe(422)
  })

  it('never leaks raw database errors or stack traces on unexpected failures', async () => {
    const secret = 'relation "invoices" does not exist at /srv/app/node_modules/pg/lib/client.js'
    const response = toErrorResponse(new Error(secret))
    expect(response.status).toBe(500)
    const text = JSON.stringify(await response.json())
    expect(text).not.toContain('invoices')
    expect(text).not.toContain('node_modules')
    expect(JSON.parse(text)).toEqual({ error: { code: 'internal_error', message: 'Something went wrong. Try again later.' } })
  })
})
