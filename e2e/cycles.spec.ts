import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { expect, test, type Page } from '@playwright/test'

type Person = { userId: string; cookie: string }
type Company = { tenantId: string; owner: Person; viewer: Person }
type Runtime = { baseUrl: string; databaseUrl: string; companyA: Company; companyB: Company }

const runtimePath = path.join(tmpdir(), 'aether-e2e-runtime.json')

async function runtime(): Promise<Runtime> {
  return JSON.parse(await readFile(runtimePath, 'utf8')) as Runtime
}

async function signIn(page: Page, person: Person, baseUrl: string): Promise<void> {
  await page.context().addCookies([{ name: 'aether_e2e', value: person.cookie, url: baseUrl, httpOnly: true, sameSite: 'Lax' }])
}

async function call(page: Page, method: string, apiPath: string, body?: unknown, key?: string): Promise<{ status: number; payload: { data?: Record<string, unknown> } & Record<string, unknown> }> {
  const result = await page.evaluate(
    async ({ method, apiPath, body, key }) => {
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (key) headers['Idempotency-Key'] = key
      const response = await fetch(apiPath, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      const payload = (await response.json().catch(() => null)) as { data?: Record<string, unknown> } | null
      return { status: response.status, payload }
    },
    { method, apiPath, body, key }
  )
  return result as { status: number; payload: { data?: Record<string, unknown> } & Record<string, unknown> }
}

function dataOf(result: { status: number; payload: { data?: Record<string, unknown> } }, statuses: number[]): Record<string, unknown> {
  expect(statuses, JSON.stringify(result.payload)).toContain(result.status)
  const data = result.payload.data
  expect(data, JSON.stringify(result.payload)).toBeTruthy()
  return data as Record<string, unknown>
}

test('arabic and english screens, then procure-to-pay and quote-to-cash against the local database', async ({ page }) => {
  test.setTimeout(420_000)
  const world = await runtime()
  await page.goto('/')
  await expect(page.getByText('غرفة القيادة تقرأ القاعدة المتصلة. الصفر يعني أنه لا توجد حركة بعد، ولا تُجمع أرقام أكثر من شركة.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByText('The executive room reads the connected database. Zero means there is no movement yet, and figures from more than one company are not combined.')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')

  await signIn(page, world.companyA.owner, world.baseUrl)
  await page.goto('/erp/finance')
  await expect(page.getByRole('heading', { name: 'Finance: invoices and payments' })).toBeVisible()
  await expect(page.getByText(/0\.000/).first()).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'AR', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'المالية: الفواتير والمدفوعات' })).toBeVisible()

  await page.goto('/erp/iam')
  await expect(page.getByRole('tablist', { name: 'الأعضاء والصلاحيات' })).toBeVisible()
  await page.goto('/erp/procurement')
  await expect(page.getByRole('heading', { name: 'دورة المشتريات: من الطلب إلى الدفع' })).toBeVisible()

  const anonymous = await page.context().browser()?.newContext()
  if (!anonymous) throw new Error('The browser did not open a second context.')
  const outsider = await anonymous.newPage()
  await outsider.goto('/erp/finance')
  await expect(outsider).toHaveURL(/\/login/)
  const unsigned = await call(outsider, 'POST', '/api/v1/finance/accounts', { code: 'NOPE', name: 'Nope', type: 'asset', parentId: null, isPostable: true }, 'e2e-unsigned-account')
  expect(unsigned.status).toBe(401)
  await anonymous.close()

  const viewer = await page.context().browser()?.newContext()
  if (!viewer) throw new Error('The browser did not open a viewer context.')
  const viewerPage = await viewer.newPage()
  await signIn(viewerPage, world.companyA.viewer, world.baseUrl)
  await viewerPage.goto('/erp/finance')
  const forbidden = await call(viewerPage, 'POST', '/api/v1/finance/accounts', { code: 'NOPE', name: 'Nope', type: 'asset', parentId: null, isPostable: true }, 'e2e-viewer-account')
  expect(forbidden.status).toBe(403)
  await viewer.close()

  const account = async (code: string, type: string) =>
    dataOf(await call(page, 'POST', '/api/v1/finance/accounts', { code, name: code, type, parentId: null, isPostable: true }, `e2e-acct-${code}`), [201])
  const inventory = await account('1400', 'asset')
  const bank = await account('1100', 'asset')
  const payable = await account('2100', 'liability')
  const grni = await account('2150', 'liability')
  const tax = await account('1310', 'asset')
  const ppv = await account('5100', 'expense')
  const cogs = await account('5200', 'expense')
  dataOf(await call(page, 'POST', '/api/v1/finance/periods', { name: 'FY2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }, 'e2e-period'), [201])
  const saved = await call(page, 'PATCH', '/api/v1/procurement/accounting', {
    version: 0,
    inventoryAccountId: inventory.id,
    payableAccountId: payable.id,
    inputTaxAccountId: tax.id,
    accountingBasis: 'receipt_basis',
    grniAccountId: grni.id,
    ppvAccountId: ppv.id,
    costingMethod: 'moving_weighted_average',
    cogsAccountId: cogs.id,
    priceToleranceBps: 0,
    taxToleranceMinor: 0,
  })
  expect(saved.status, JSON.stringify(saved.payload)).toBe(200)

  const supplier = dataOf(
    await call(page, 'POST', '/api/v1/procurement/suppliers', { code: 'MILL', name: 'Synthetic Mill', paymentTermsDays: 30, notes: null }, 'e2e-supplier'),
    [201]
  )

  const warehouse = dataOf(
    await call(page, 'POST', '/api/v1/inventory/warehouses', { code: 'MAIN', name: 'Main', location: null, capacity: null, status: 'active' }, 'e2e-warehouse'),
    [201]
  )
  const item = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/inventory/items',
      { sku: 'FLOUR', name: 'Flour', unit: 'piece', unitCostMinor: 800, sellingPriceMinor: 1_500, reorderLevel: 0, isActive: true },
      'e2e-item'
    ),
    [201]
  )
  const request = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/procurement/requests',
      { neededBy: null, reason: 'DEMO e2e flour', lines: [{ itemId: item.id, description: 'Flour', quantity: 10 }] },
      'e2e-request'
    ),
    [201]
  )
  const submittedRequest = dataOf(await call(page, 'POST', `/api/v1/procurement/requests/${String(request.id)}/submit`, { version: request.version }), [200])
  const approved = dataOf(await call(page, 'POST', `/api/v1/procurement/requests/${String(request.id)}/approve`, { version: submittedRequest.version }), [200])
  const requestLines = approved.lines as Array<{ id: string }>
  const ordered = dataOf(
    await call(
      page,
      'POST',
      `/api/v1/procurement/requests/${String(approved.id)}/convert`,
      {
        version: approved.version,
        supplierId: supplier.id,
        orderDate: '2026-10-01',
        expectedDate: null,
        notes: null,
        lines: [{ requestLineId: requestLines[0].id, unitCostMinor: 1_000, taxRateBps: 0 }],
      },
      'e2e-convert-request'
    ),
    [201]
  )
  expect(ordered.status).toBe('converted')
  const order = ordered.order as { id: string; version: number; lines: Array<{ id: string }> }
  const lines = order.lines
  const submitted = dataOf(await call(page, 'POST', `/api/v1/procurement/orders/${String(order.id)}/submit`, { version: order.version }), [200])
  const receiptBody = { version: submitted.version, warehouseId: warehouse.id, receiptDate: '2026-10-02', notes: null, lines: [{ orderLineId: lines[0].id, quantity: 10 }] }
  const receipt = dataOf(await call(page, 'POST', `/api/v1/procurement/orders/${String(order.id)}/receipts`, receiptBody, 'e2e-receipt'), [201])
  const receiptReplay = dataOf(await call(page, 'POST', `/api/v1/procurement/orders/${String(order.id)}/receipts`, receiptBody, 'e2e-receipt'), [200, 201])
  expect(receiptReplay.id).toBe(receipt.id)
  expect(receipt.journalEntryId).toBeTruthy()
  dataOf(
    await call(
      page,
      'POST',
      '/api/v1/procurement/returns',
      { orderId: order.id, warehouseId: warehouse.id, returnDate: '2026-10-03', reason: 'Damaged', lines: [{ orderLineId: lines[0].id, quantity: 1 }] },
      'e2e-return'
    ),
    [201]
  )
  const billed = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/procurement/invoices',
      {
        orderId: order.id,
        supplierInvoiceNumber: 'SI-E2E-1',
        invoiceDate: '2026-10-04',
        currency: 'KWD',
        expectedTotalMinor: null,
        notes: null,
        lines: [{ orderLineId: lines[0].id, quantity: 9, unitCostMinor: 1_000, taxRateBps: 0 }],
      },
      'e2e-supplier-invoice'
    ),
    [201]
  )
  expect(billed.currency).toBe('KWD')
  expect(billed.journalEntryId).toBeTruthy()
  const supplierPayment = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/procurement/payments',
      {
        supplierId: supplier.id,
        paymentDate: '2026-10-05',
        amountMinor: 4_000,
        currency: 'KWD',
        method: 'bank_transfer',
        reference: 'TRF-E2E-1',
        paidFromAccountId: bank.id,
        notes: null,
        allocations: [{ invoiceId: billed.id, amountMinor: 4_000 }],
      },
      'e2e-supplier-payment'
    ),
    [201]
  )
  expect(supplierPayment.currency).toBe('KWD')

  const customer = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/crm/customers',
      { name: 'Synthetic Cafe', customerType: 'company', email: null, phone: null, taxId: null, address: null, creditLimitMinor: null, status: 'active', notes: null },
      'e2e-customer'
    ),
    [201]
  )
  const quote = dataOf(
    await call(
      page,
      'POST',
      '/api/v1/crm/quotations',
      {
        customerId: customer.id,
        leadId: null,
        validUntil: '2026-12-31',
        notes: null,
        lines: [{ description: 'Flour', quantity: 4, unitPriceMinor: 1_500, taxRateBps: 0, itemId: item.id, warehouseId: warehouse.id }],
      },
      'e2e-quote'
    ),
    [201]
  )
  const sent = dataOf(await call(page, 'POST', `/api/v1/crm/quotations/${String(quote.id)}/send`, { version: quote.version }), [200])
  const accepted = dataOf(await call(page, 'POST', `/api/v1/crm/quotations/${String(quote.id)}/accept`, { version: sent.version }), [200])
  const converted = dataOf(await call(page, 'POST', `/api/v1/crm/quotations/${String(quote.id)}/convert`, { version: accepted.version }, 'e2e-convert'), [200])
  const invoice = converted.invoice as { id: string; number: string; version: number; currency: string; cogsEntryId: string | null; totalMinor: number }
  expect(invoice.currency).toBe('KWD')
  expect(invoice.totalMinor).toBe(6_000)
  expect(invoice.cogsEntryId).toBeTruthy()
  const collected = dataOf(
    await call(
      page,
      'POST',
      `/api/v1/finance/invoices/${invoice.id}/payments`,
      { version: invoice.version, amountMinor: 2_000, currency: 'KWD', method: 'knet', paidAt: '2026-10-28T09:00:00.000Z', reference: null },
      'e2e-collection'
    ),
    [201]
  )
  const collectedInvoice = collected.invoice as { status: string; paidMinor: number }
  expect(collectedInvoice).toMatchObject({ status: 'partially_paid', paidMinor: 2_000 })

  await page.goto('/erp/finance')
  await expect(page.getByText(invoice.number)).toBeVisible({ timeout: 60_000 })

  const other = await page.context().browser()?.newContext()
  if (!other) throw new Error('The browser did not open the second company.')
  const otherPage = await other.newPage()
  await signIn(otherPage, world.companyB.owner, world.baseUrl)
  await otherPage.goto('/erp/finance')
  const hidden = await call(otherPage, 'GET', `/api/v1/finance/invoices/${invoice.id}`)
  expect(hidden.status).toBe(404)
  await expect(otherPage.getByText(invoice.number)).toHaveCount(0)
  await other.close()

  const client = new pg.Client({ connectionString: world.databaseUrl, ssl: false })
  await client.connect()
  try {
    const stock = await client.query<{ on_hand: number; average: string }>(
      'select current_stock as on_hand, unit_cost_minor::text as average from items where tenant_id = $1 and id = $2',
      [world.companyA.tenantId, item.id]
    )
    expect(stock.rows[0]).toMatchObject({ on_hand: 5, average: '1000' })
    const balance = async (accountId: unknown) =>
      Number(
        (
          await client.query<{ n: string }>(
            `select coalesce(sum(l.debit_minor - l.credit_minor), 0)::text as n
               from journal_lines l join journal_entries e on e.tenant_id = l.tenant_id and e.id = l.entry_id
              where l.tenant_id = $1 and l.account_id = $2 and e.status = 'posted'`,
            [world.companyA.tenantId, accountId]
          )
        ).rows[0].n
      )
    expect(await balance(inventory.id)).toBe(5_000)
    expect(await balance(cogs.id)).toBe(4_000)
    const unbalanced = await client.query<{ n: number }>(
      `select count(*)::int as n from journal_entries e
        where e.tenant_id = $1 and e.status = 'posted'
          and (select coalesce(sum(debit_minor), 0) from journal_lines where entry_id = e.id) <>
              (select coalesce(sum(credit_minor), 0) from journal_lines where entry_id = e.id)`,
      [world.companyA.tenantId]
    )
    expect(unbalanced.rows[0].n).toBe(0)
    const leaked = await client.query<{ n: number }>('select count(*)::int as n from invoices where tenant_id = $1 and id = $2', [
      world.companyB.tenantId,
      invoice.id,
    ])
    expect(leaked.rows[0].n).toBe(0)
    const suppliers = await client.query<{ n: number }>("select count(*)::int as n from suppliers where tenant_id = $1 and code = 'MILL'", [
      world.companyA.tenantId,
    ])
    expect(suppliers.rows[0].n).toBe(1)
    const receipts = await client.query<{ n: number }>('select count(*)::int as n from goods_receipts where tenant_id = $1 and id = $2', [
      world.companyA.tenantId,
      receipt.id,
    ])
    expect(receipts.rows[0].n).toBe(1)
  } finally {
    await client.end()
  }
})
