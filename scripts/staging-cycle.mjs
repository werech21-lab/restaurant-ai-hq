// Idempotent procure-to-pay and quote-to-cash against the local server, which is connected to Staging.
// A sales order is not a separate record: accepting a quotation and converting it creates the sales invoice.
// Customer payment is recorded on that invoice. The balanced sales journal is the cost-of-goods entry the invoice posts.
//
//   node scripts/staging-cycle.mjs
const base = 'http://127.0.0.1:4020'

const login = await fetch(`${base}/dev/owner?next=/erp/finance`, { redirect: 'manual' })
const setCookie = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : []
const cookie = setCookie.map((value) => value.split(';')[0]).join('; ')
if (login.status !== 307 || !cookie.includes('aether_dev_owner=')) {
  process.stderr.write(`Owner session was not issued (status ${login.status}).\n`)
  process.exit(1)
}

async function call(method, path, body, key) {
  const headers = { Accept: 'application/json', cookie }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

function dataOf(result, statuses) {
  if (!statuses.includes(result.status) || !result.payload?.data) {
    const code = result.payload?.error?.code ?? 'unknown'
    throw new Error(`${code} (${result.status})`)
  }
  return result.payload.data
}

function byCode(rows, field, value) {
  const found = rows.find((row) => row[field] === value)
  if (!found) throw new Error(`Missing ${field}=${value}`)
  return found
}

const accountPage = await call('GET', '/api/v1/finance/accounts?limit=50')
const accountRows = accountPage.payload?.data
if (!Array.isArray(accountRows)) throw new Error('accounts')
const inventory = byCode(accountRows, 'code', '1200')
const payable = byCode(accountRows, 'code', '2000')
const cogs = byCode(accountRows, 'code', '5200')

const accounting = dataOf(await call('GET', '/api/v1/procurement/accounting'), [200])
if (accounting.version === 0) {
  dataOf(
    await call('PATCH', '/api/v1/procurement/accounting', {
      version: 0,
      inventoryAccountId: inventory.id,
      payableAccountId: payable.id,
      inputTaxAccountId: null,
      accountingBasis: 'invoice_basis',
      costingMethod: 'moving_weighted_average',
      cogsAccountId: cogs.id,
      grniAccountId: null,
      ppvAccountId: null,
      priceToleranceBps: 0,
      taxToleranceMinor: 0,
    }),
    [200]
  )
}

const suppliers = dataOf(await call('GET', '/api/v1/procurement/suppliers?limit=50'), [200])
const supplier = byCode(suppliers, 'code', 'DEMO')
const warehouses = dataOf(await call('GET', '/api/v1/inventory/warehouses?limit=50'), [200])
const warehouse = byCode(warehouses, 'code', 'DEMO-MAIN')
const items = dataOf(await call('GET', '/api/v1/inventory/items?limit=50'), [200])
const item = byCode(items, 'sku', 'DEMO-FLOUR')
const customers = dataOf(await call('GET', '/api/v1/crm/customers?limit=50'), [200])
const customer = customers.find((row) => row.name === 'DEMO cafe')
if (!customer) throw new Error('Missing customer')

let request = dataOf(
  await call(
    'POST',
    '/api/v1/procurement/requests',
    { neededBy: null, reason: 'DEMO staging cycle', lines: [{ itemId: item.id, description: 'DEMO flour', quantity: 10 }] },
    'staging-cycle-request-v1'
  ),
  [200, 201]
)
if (request.status === 'draft') request = dataOf(await call('POST', `/api/v1/procurement/requests/${request.id}/submit`, { version: request.version }), [200])
if (request.status === 'submitted') request = dataOf(await call('POST', `/api/v1/procurement/requests/${request.id}/approve`, { version: request.version }), [200])

let order
if (request.status === 'approved') {
  const converted = dataOf(
    await call(
      'POST',
      `/api/v1/procurement/requests/${request.id}/convert`,
      {
        version: request.version,
        supplierId: supplier.id,
        orderDate: '2026-10-20',
        expectedDate: null,
        notes: null,
        lines: [{ requestLineId: request.lines[0].id, unitCostMinor: 1_000, taxRateBps: 0 }],
      },
      'staging-cycle-convert-v1'
    ),
    [200, 201]
  )
  order = converted.order
} else {
  order = dataOf(await call('GET', `/api/v1/procurement/orders/${request.purchaseOrderId}`), [200])
}
if (order.status === 'draft') order = dataOf(await call('POST', `/api/v1/procurement/orders/${order.id}/submit`, { version: order.version }), [200])
if (order.status === 'pending_approval') order = dataOf(await call('POST', `/api/v1/procurement/orders/${order.id}/approve`, { version: order.version }), [200])

if (order.status === 'approved') {
  order = dataOf(
    await call(
      'POST',
      `/api/v1/procurement/orders/${order.id}/receipts`,
      { version: order.version, warehouseId: warehouse.id, receiptDate: '2026-10-21', notes: null, lines: [{ orderLineId: order.lines[0].id, quantity: 10 }] },
      'staging-cycle-receipt-v1'
    ),
    [200, 201]
  )
  order = dataOf(await call('GET', `/api/v1/procurement/orders/${order.orderId ?? order.id}`), [200])
}

const billed = dataOf(
  await call(
    'POST',
    '/api/v1/procurement/invoices',
    {
      orderId: order.id,
      supplierInvoiceNumber: 'DEMO-SI-1',
      invoiceDate: '2026-10-22',
      currency: 'KWD',
      expectedTotalMinor: 10_000,
      notes: null,
      lines: [{ orderLineId: order.lines[0].id, quantity: 10, unitCostMinor: 1_000, taxRateBps: 0 }],
    },
    'staging-cycle-supplier-invoice-v1'
  ),
  [200, 201]
)

const quote = dataOf(
  await call(
    'POST',
    '/api/v1/crm/quotations',
    {
      customerId: customer.id,
      leadId: null,
      validUntil: '2026-12-31',
      notes: 'DEMO staging cycle',
      lines: [{ description: 'DEMO flour', quantity: 4, unitPriceMinor: 1_500, taxRateBps: 0, itemId: item.id, warehouseId: warehouse.id }],
    },
    'staging-cycle-quote-v1'
  ),
  [200, 201]
)
let quotation = quote
if (quotation.status === 'draft') quotation = dataOf(await call('POST', `/api/v1/crm/quotations/${quotation.id}/send`, { version: quotation.version }), [200])
if (quotation.status === 'sent') quotation = dataOf(await call('POST', `/api/v1/crm/quotations/${quotation.id}/accept`, { version: quotation.version }), [200])
let sold = quotation
if (quotation.status === 'accepted') {
  sold = dataOf(await call('POST', `/api/v1/crm/quotations/${quotation.id}/convert`, { version: quotation.version }, 'staging-cycle-sale-v1'), [200])
}
const invoice = sold.invoice ?? sold
if ((invoice.status === 'issued' || invoice.status === 'partially_paid') && invoice.totalMinor) {
  const paid = await call(
    'POST',
    `/api/v1/finance/invoices/${invoice.id}/payments`,
    { version: invoice.version, amountMinor: invoice.totalMinor, currency: 'KWD', method: 'knet', paidAt: '2026-10-28T09:00:00.000Z', reference: 'DEMO-PAY-1' },
    'staging-cycle-payment-v1'
  )
  if (![200, 201].includes(paid.status)) throw new Error(paid.payload?.error?.code ?? `payment ${paid.status}`)
}

const home = await fetch(base)
const html = await home.text()
process.stdout.write(
  `supplier_invoice_minor ${billed.totalMinor} journal ${billed.journalEntryId ? 'yes' : 'no'} sales_total_minor ${invoice.totalMinor} cogs ${invoice.cogsEntryId ? 'yes' : 'no'} home ${home.status} collected ${html.includes('6.000')} expense ${html.includes('10.000')}\n`
)
