import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { expect, test, type Page } from '@playwright/test'

type Person = { userId: string; cookie: string }
type Company = { tenantId: string; owner: Person; viewer: Person }
type Runtime = { baseUrl: string; databaseUrl: string; companyA: Company; companyB: Company }
type Payload = { data?: Record<string, unknown>; error?: { code?: string } }

const runtimePath = path.join(tmpdir(), 'aether-e2e-runtime.json')

async function runtime(): Promise<Runtime> {
  return JSON.parse(await readFile(runtimePath, 'utf8')) as Runtime
}

async function signIn(page: Page, person: Person, baseUrl: string): Promise<void> {
  await page.context().addCookies([{ name: 'aether_e2e', value: person.cookie, url: baseUrl, httpOnly: true, sameSite: 'Lax' }])
}

async function call(page: Page, method: string, apiPath: string, body?: unknown, key?: string, headers: Record<string, string> = {}): Promise<{ status: number; payload: Payload }> {
  return page.evaluate(
    async ({ method, apiPath, body, key, headers }) => {
      const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
      if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
      if (key) requestHeaders['Idempotency-Key'] = key
      const response = await fetch(apiPath, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) })
      const payload = (await response.json().catch(() => null)) as Payload | null
      return { status: response.status, payload: payload ?? {} }
    },
    { method, apiPath, body, key, headers }
  )
}

test('a tampered session is signed out', async ({ page }) => {
  const world = await runtime()
  const broken = `${world.companyB.owner.cookie.slice(0, -1)}x`
  await page.context().addCookies([{ name: 'aether_e2e', value: broken, url: world.baseUrl, httpOnly: true, sameSite: 'Lax' }])
  await page.goto('/erp/finance')
  await expect(page).toHaveURL(/\/login/)
  const denied = await call(page, 'GET', '/api/v1/finance/invoices/summary')
  expect(denied.status).toBe(401)
})

test('a viewer cannot create an account', async ({ page }) => {
  const world = await runtime()
  await signIn(page, world.companyB.viewer, world.baseUrl)
  await page.goto('/erp/finance')
  const forbidden = await call(page, 'POST', '/api/v1/finance/accounts', { code: '1199', name: 'Blocked', type: 'asset', parentId: null, isPostable: true }, 'e2e-viewer-blocked')
  expect(forbidden.status).toBe(403)
  expect(forbidden.payload.error?.code).toBe('forbidden')
})

test('naming another company does not grant its data', async ({ page }) => {
  const world = await runtime()
  await signIn(page, world.companyB.owner, world.baseUrl)
  await page.goto('/erp/finance')
  const crossed = await call(page, 'GET', '/api/v1/finance/invoices/summary', undefined, undefined, { 'x-tenant-id': world.companyA.tenantId })
  expect(crossed.status).toBe(403)
  expect(crossed.payload.error?.code).toBe('no_tenant_access')
})

test('the same idempotency key with a different body is refused and writes one row', async ({ page }) => {
  const world = await runtime()
  await signIn(page, world.companyB.owner, world.baseUrl)
  await page.goto('/erp/inventory')
  const body = { code: 'FAIL-WH', name: 'First', location: null, capacity: null, status: 'active' }
  const created = await call(page, 'POST', '/api/v1/inventory/warehouses', body, 'e2e-fail-wh')
  expect(created.status).toBe(201)
  const reused = await call(page, 'POST', '/api/v1/inventory/warehouses', { ...body, name: 'Second' }, 'e2e-fail-wh')
  expect(reused.status).toBe(422)
  expect(reused.payload.error?.code).toBe('idempotency_key_reused')
  const client = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await client.connect()
  try {
    const rows = await client.query<{ n: number }>("select count(*)::int as n from warehouses where tenant_id = $1 and code = 'FAIL-WH'", [world.companyB.tenantId])
    expect(rows.rows[0].n).toBe(1)
  } finally {
    await client.end()
  }
})

test('selling more than the warehouse holds is refused and leaves the stock at zero', async ({ page }) => {
  const world = await runtime()
  await signIn(page, world.companyB.owner, world.baseUrl)
  await page.goto('/erp/finance')
  const warehouse = await call(page, 'POST', '/api/v1/inventory/warehouses', { code: 'EMPTY', name: 'Empty', location: null, capacity: null, status: 'active' }, 'e2e-empty-wh')
  const item = await call(
    page,
    'POST',
    '/api/v1/inventory/items',
    { sku: 'NONE', name: 'None', unit: 'piece', unitCostMinor: 100, sellingPriceMinor: 200, reorderLevel: 0, isActive: true },
    'e2e-empty-item'
  )
  const customer = await call(
    page,
    'POST',
    '/api/v1/crm/customers',
    { name: 'Empty Cafe', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null },
    'e2e-empty-customer'
  )
  expect(warehouse.status).toBe(201)
  expect(item.status).toBe(201)
  expect(customer.status).toBe(201)
  const draft = await call(
    page,
    'POST',
    '/api/v1/finance/invoices',
    {
      customerId: customer.payload.data?.id,
      issueDate: '2026-10-28',
      dueDate: '2026-11-28',
      notes: null,
      lines: [{ description: 'None', quantity: 1, unitPriceMinor: 200, taxRateBps: 0, itemId: item.payload.data?.id, warehouseId: warehouse.payload.data?.id }],
    },
    'e2e-empty-invoice'
  )
  expect(draft.status).toBe(201)
  const issued = await call(page, 'POST', `/api/v1/finance/invoices/${String(draft.payload.data?.id)}/submit`, { version: draft.payload.data?.version })
  expect(issued.status).toBe(409)
  expect(issued.payload.error?.code).toBe('insufficient_stock')
  const client = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await client.connect()
  try {
    const stock = await client.query<{ n: number }>('select current_stock as n from items where tenant_id = $1 and id = $2', [world.companyB.tenantId, item.payload.data?.id])
    expect(stock.rows[0].n).toBe(0)
    const status = await client.query<{ status: string }>('select status from invoices where tenant_id = $1 and id = $2', [world.companyB.tenantId, draft.payload.data?.id])
    expect(status.rows[0].status).toBe('draft')
  } finally {
    await client.end()
  }
})

test('an unbalanced journal cannot be posted', async ({ page }) => {
  const world = await runtime()
  await signIn(page, world.companyB.owner, world.baseUrl)
  await page.goto('/erp/ledger')
  const account = async (code: string, type: string) => {
    const created = await call(page, 'POST', '/api/v1/finance/accounts', { code, name: code, type, parentId: null, isPostable: true }, `e2e-fail-${code}`)
    expect(created.status).toBe(201)
    return String(created.payload.data?.id)
  }
  const debit = await account('1499', 'asset')
  const credit = await account('4199', 'revenue')
  const period = await call(page, 'POST', '/api/v1/finance/periods', { name: 'FY2026-B', startsOn: '2026-01-01', endsOn: '2026-12-31' }, 'e2e-fail-period')
  expect(period.status).toBe(201)
  const draft = await call(
    page,
    'POST',
    '/api/v1/finance/journal-entries',
    {
      entryDate: '2026-10-28',
      memo: 'Unbalanced',
      currency: 'KWD',
      lines: [
        { accountId: debit, debitMinor: 100, creditMinor: 0, description: '' },
        { accountId: credit, debitMinor: 0, creditMinor: 40, description: '' },
      ],
    },
    'e2e-unbalanced'
  )
  expect(draft.status).toBe(201)
  const posted = await call(page, 'POST', `/api/v1/finance/journal-entries/${String(draft.payload.data?.id)}/post`, { version: draft.payload.data?.version })
  expect(posted.status).toBe(422)
  expect(posted.payload.error?.code).toBe('unbalanced_entry')
  const client = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await client.connect()
  try {
    const row = await client.query<{ status: string }>('select status from journal_entries where tenant_id = $1 and id = $2', [world.companyB.tenantId, draft.payload.data?.id])
    expect(row.rows[0].status).toBe('draft')
  } finally {
    await client.end()
  }
})

test('closing the database session mid-transaction drops the uncommitted company', async () => {
  const world = await runtime()
  const id = randomUUID()
  const slug = `disconnect-${id.slice(0, 8)}`
  const writer = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await writer.connect()
  await writer.query('begin')
  await writer.query('insert into tenants (id, name, slug, created_by) values ($1, $2, $3, $4)', [id, 'Dropped', slug, world.companyA.owner.userId])
  await writer.end()
  const reader = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await reader.connect()
  try {
    const left = await reader.query<{ n: number }>('select count(*)::int as n from tenants where id = $1', [id])
    expect(left.rows[0].n).toBe(0)
  } finally {
    await reader.end()
  }
})
