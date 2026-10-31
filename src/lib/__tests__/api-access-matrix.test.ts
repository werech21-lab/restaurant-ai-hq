import { randomUUID } from 'node:crypto'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'

let currentUser: { id: string } | null = null

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser }, error: currentUser ? null : new Error('no session') }) },
  }),
}))

/**
 * Every API route is called, with every HTTP method it exports, as four kinds of caller. The route files are loaded for
 * real, so a route added without `protectedRoute`, or protected by too weak a permission, fails here.
 */

type Handler = (request: NextRequest, context: { params: Promise<Record<string, string>> }) => Promise<Response>
type RouteCase = { route: string; method: string; handler: Handler }

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const
const apiDir = path.join(process.cwd(), 'src', 'app', 'api')

/** Routes that a read-only member may legitimately POST to: the command bar only reads. */
const READ_ONLY_POST = new Set(['/api/v1/ai/command'])

/**
 * Routes for a signed-in person who has no company yet (accepting an invitation). They prove who the caller is, take no
 * tenant and need no permission, so the permission and tenant checks below do not apply: an empty body is a 422 instead.
 */
const SESSION_ONLY = new Set(['/api/v1/iam/invitations/accept'])

async function routeFiles(directory: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await routeFiles(full)))
    else if (entry.name === 'route.ts') found.push(full)
  }
  return found.sort()
}

function isHandler(value: unknown): value is Handler {
  return typeof value === 'function'
}

async function loadCases(): Promise<RouteCase[]> {
  const cases: RouteCase[] = []
  for (const file of await routeFiles(apiDir)) {
    const route = '/' + path.relative(path.join(process.cwd(), 'src', 'app'), path.dirname(file)).split(path.sep).join('/')
    const loaded: Record<string, unknown> = await import(/* @vite-ignore */ pathToFileURL(file).href)
    for (const method of METHODS) {
      const handler = loaded[method]
      if (isHandler(handler)) cases.push({ route, method, handler })
    }
  }
  return cases
}

function call(testCase: RouteCase, headers: Record<string, string> = {}): Promise<Response> {
  const url = testCase.route.replace(/\[[a-zA-Z]+\]/g, () => randomUUID())
  const params: Record<string, string> = {}
  for (const name of testCase.route.matchAll(/\[([a-zA-Z]+)\]/g)) params[name[1]] = randomUUID()
  const hasBody = testCase.method !== 'GET' && testCase.method !== 'DELETE'
  const request = new NextRequest(`http://localhost${url}`, {
    method: testCase.method,
    headers: { 'content-type': 'application/json', 'idempotency-key': `matrix-${randomUUID()}`, ...headers },
    body: hasBody ? '{}' : undefined,
  })
  return testCase.handler(request, { params: Promise.resolve(params) })
}

async function errorCode(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null)
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error
    if (typeof error === 'object' && error !== null && 'code' in error) return String((error as { code: unknown }).code)
  }
  return null
}

let cases: RouteCase[] = []
let owner: { userId: string; tenantId: string }
let other: { userId: string; tenantId: string }
let noPermissions: string
let viewer: string

async function member(tenantId: string, ownerId: string, roleName: string | null): Promise<string> {
  const userId = randomUUID()
  await createUser(userId)
  const pg = getPglite()
  let roleId: string
  if (roleName) {
    roleId = (await pg.query<{ id: string }>('select id from roles where tenant_id = $1 and name = $2', [tenantId, roleName])).rows[0].id
  } else {
    roleId = (
      await pg.query<{ id: string }>(`insert into roles (tenant_id, name, created_by) values ($1, $2, $3) returning id`, [tenantId, `empty-${randomUUID()}`, ownerId])
    ).rows[0].id
  }
  await pg.query(`insert into tenant_members (tenant_id, user_id, role_id, created_by) values ($1, $2, $3, $4)`, [tenantId, userId, roleId, ownerId])
  return userId
}

async function newOwner(label: string): Promise<{ userId: string; tenantId: string }> {
  const userId = randomUUID()
  await createUser(userId)
  const tenantId = await bootstrapTenant(`Matrix ${label}`, `matrix-${label}`, userId)
  return { userId, tenantId }
}

beforeAll(async () => {
  await startDatabase()
  owner = await newOwner('a')
  other = await newOwner('b')
  noPermissions = await member(owner.tenantId, owner.userId, null)
  viewer = await member(owner.tenantId, owner.userId, 'viewer')
  cases = await loadCases()
}, 120_000)
afterAll(stopDatabase)

describe('the API surface', () => {
  it('finds every route file and method (a count that only moves on purpose)', () => {
    expect(new Set(cases.map((testCase) => testCase.route)).size).toBe(152)
    expect(cases.length).toBe(216)
  })
})

describe('unauthenticated callers', () => {
  it('get 401 from every route and method, and no route leaks data or an internal error', async () => {
    currentUser = null
    const failures: string[] = []
    for (const testCase of cases) {
      const response = await call(testCase)
      const code = await errorCode(response)
      if (response.status !== 401 || code !== 'unauthenticated') failures.push(`${testCase.method} ${testCase.route} -> ${response.status} ${code}`)
    }
    expect(failures).toEqual([])
  })
})

describe('members whose role holds no permission', () => {
  it('get 403 from every route and method', async () => {
    currentUser = { id: noPermissions }
    const failures: string[] = []
    for (const testCase of cases) {
      if (SESSION_ONLY.has(testCase.route)) continue
      const response = await call(testCase)
      const code = await errorCode(response)
      if (response.status !== 403 || code !== 'forbidden') failures.push(`${testCase.method} ${testCase.route} -> ${response.status} ${code}`)
    }
    expect(failures).toEqual([])
  })
})

describe('read-only members (the viewer role)', () => {
  it('get 403 from every route that changes data', async () => {
    currentUser = { id: viewer }
    const failures: string[] = []
    for (const testCase of cases) {
      if (testCase.method === 'GET' || READ_ONLY_POST.has(testCase.route) || SESSION_ONLY.has(testCase.route)) continue
      const response = await call(testCase)
      const code = await errorCode(response)
      if (response.status !== 403 || code !== 'forbidden') failures.push(`${testCase.method} ${testCase.route} -> ${response.status} ${code}`)
    }
    expect(failures).toEqual([])
  })

  it('cannot approve or reject an AI request, approve or void an invoice, or record a payment', async () => {
    currentUser = { id: viewer }
    const must = [
      ['POST', '/api/v1/ai/approvals/[id]/approve'],
      ['POST', '/api/v1/ai/approvals/[id]/reject'],
      ['POST', '/api/v1/finance/invoices/[id]/approve'],
      ['POST', '/api/v1/finance/invoices/[id]/void'],
      ['POST', '/api/v1/finance/invoices/[id]/payments'],
      ['POST', '/api/v1/crm/quotations/[id]/convert'],
      ['POST', '/api/v1/inventory/movements'],
    ]
    for (const [method, route] of must) {
      const testCase = cases.find((candidate) => candidate.method === method && candidate.route === route)
      expect(testCase, `${method} ${route} exists`).toBeDefined()
      if (testCase) expect((await call(testCase)).status, `${method} ${route}`).toBe(403)
    }
  })
})

describe('callers who name a company they do not belong to', () => {
  it('get 403 from every route when x-tenant-id is another company\'s id', async () => {
    currentUser = { id: owner.userId }
    const failures: string[] = []
    for (const testCase of cases) {
      if (SESSION_ONLY.has(testCase.route)) continue
      const response = await call(testCase, { 'x-tenant-id': other.tenantId })
      const code = await errorCode(response)
      if (response.status !== 403 || code !== 'no_tenant_access') failures.push(`${testCase.method} ${testCase.route} -> ${response.status} ${code}`)
    }
    expect(failures).toEqual([])
  })

  it('get 400 from every route when x-tenant-id is not a UUID', async () => {
    currentUser = { id: owner.userId }
    const failures: string[] = []
    for (const testCase of cases) {
      if (SESSION_ONLY.has(testCase.route)) continue
      const response = await call(testCase, { 'x-tenant-id': "' or 1=1 --" })
      if (response.status !== 400) failures.push(`${testCase.method} ${testCase.route} -> ${response.status}`)
    }
    expect(failures).toEqual([])
  })
})

describe('the owner of a company', () => {
  it('passes authentication on every route: the answer is never 401 or 403', async () => {
    currentUser = { id: owner.userId }
    const failures: string[] = []
    for (const testCase of cases) {
      const response = await call(testCase)
      if (response.status === 401 || response.status === 403) failures.push(`${testCase.method} ${testCase.route} -> ${response.status}`)
      if (response.status >= 500) failures.push(`${testCase.method} ${testCase.route} -> ${response.status} (server error)`)
    }
    expect(failures).toEqual([])
  })
})

describe('session-only routes', () => {
  it('ignore any tenant header, need a signed-in user, and reject a body without a token with 422', async () => {
    const accept = cases.find((candidate) => candidate.route === '/api/v1/iam/invitations/accept')
    expect(accept).toBeDefined()
    if (!accept) return
    currentUser = { id: noPermissions }
    expect((await call(accept)).status).toBe(422)
    expect((await call(accept, { 'x-tenant-id': other.tenantId })).status).toBe(422)
    currentUser = null
    expect((await call(accept)).status).toBe(401)
  })
})
