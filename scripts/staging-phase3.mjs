// Posts the Phase 3 journals against the local server on Staging, then prints counts only.
//
//   node --env-file=.env.staging scripts/staging-phase3.mjs --expect-host pikqnlzkoaxoxpahztvc --i-understand-this-is-staging
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

const base = 'http://127.0.0.1:4020'
const login = await fetch(`${base}/dev/owner?next=/erp/kitchen`, { redirect: 'manual' })
const setCookie = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : []
const cookie = setCookie.map((value) => value.split(';')[0]).join('; ')
if (login.status !== 307 || !cookie.includes('aether_dev_owner=')) {
  process.stderr.write(`Owner session was not issued (status ${login.status}).\n`)
  process.exit(1)
}

async function call(method, pathName, body, key) {
  const headers = { Accept: 'application/json', cookie }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (key) headers['Idempotency-Key'] = key
  const response = await fetch(`${base}${pathName}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

function fail(step, result) {
  const code = result.payload?.error?.code ?? 'unknown'
  throw new Error(`${step} ${code} (${result.status})`)
}

const collections = await call('POST', '/api/v1/finance/collection-journals', {}, 'staging-phase3-collections-v1')
if (![200, 201].includes(collections.status)) fail('collections', collections)

const items = await call('GET', '/api/v1/inventory/items?limit=50')
const warehouses = await call('GET', '/api/v1/inventory/warehouses?limit=50')
const item = items.payload?.data?.find((row) => row.sku === 'DEMO-FLOUR')
const warehouse = warehouses.payload?.data?.find((row) => row.code === 'DEMO-MAIN')
if (!item || !warehouse) throw new Error('Missing DEMO-FLOUR or DEMO-MAIN')

const waste = await call(
  'POST',
  '/api/v1/kitchen/waste',
  { itemId: item.id, warehouseId: warehouse.id, quantity: 1, wastedOn: '2026-10-29', reason: 'DEMO phase 3 spill' },
  'staging-phase3-waste-v1'
)
if (![200, 201].includes(waste.status)) fail('waste', waste)

const scan = await call('POST', '/api/v1/ai/scan', {})
if (scan.status !== 200) fail('scan', scan)

const approvals = await call('GET', '/api/v1/ai/approvals?status=pending&actionType=scenario_choice&limit=20')
const request = approvals.payload?.data?.find((row) => row.actionType === 'scenario_choice' && row.status === 'pending')
let decision = 'none'
if (request) {
  const approved = await call(
    'POST',
    `/api/v1/ai/approvals/${request.id}/approve`,
    { version: request.version, optionKey: 'reduce_waste' },
    'staging-phase3-scenario-v1'
  )
  if (![200, 201].includes(approved.status)) fail('approve', approved)
  decision = approved.payload?.data?.status ?? 'executed'
}

const orders = await call('GET', '/api/v1/delivery/orders?limit=50')
const open = orders.payload?.data?.find((row) => row.status === 'recorded' && row.settled === false && row.commissionMinor > 0)
let settlement = 'none'
if (open) {
  const settled = await call('POST', '/api/v1/delivery/settlements', { orderId: open.id, settledOn: '2026-10-29' }, 'staging-phase3-settlement-v1')
  if (![200, 201].includes(settled.status)) fail('settlement', settled)
  settlement = 'posted'
}

const client = new pg.Client({ connectionString: url, ssl: sslOptions(process.env.DATABASE_SSL ?? 'require', process.env.DATABASE_SSL_CA) })
await client.connect()
try {
  const counts = await client.query(
    `select
       (select count(*)::int from schema_migrations) as migrations,
       (select count(*)::int from pg_tables where schemaname = 'public') as public_tables,
       (select count(*)::int from journal_entries where status = 'posted') as posted,
       (select count(*)::int from journal_entries e where e.status = 'posted' and e.source_type = 'customer_collection') as collections,
       (select count(*)::int from journal_entries e where e.status = 'posted' and e.source_type = 'kitchen_issue') as kitchen,
       (select count(*)::int from journal_entries e where e.status = 'posted' and e.source_type = 'delivery_commission') as commissions,
       (select count(*)::int from journal_entries e
         where e.status = 'posted'
           and (select coalesce(sum(debit_minor), 0) from journal_lines l where l.entry_id = e.id)
             <> (select coalesce(sum(credit_minor), 0) from journal_lines l where l.entry_id = e.id)) as unbalanced,
       (select current_stock from items where sku = 'DEMO-FLOUR') as flour,
       (select coalesce(sum(quantity), 0)::int from kitchen_waste) as waste_qty,
       (select count(*)::int from delivery_settlements) as settlements,
       (select count(*)::int from ai_action_approvals where action_type = 'scenario_choice' and status = 'executed') as scenarios`
  )
  const row = counts.rows[0]
  process.stdout.write(
    `collections_posted ${collections.payload?.data?.posted ?? 0}\n` +
      `waste_cost_minor ${waste.payload?.data?.costMinor ?? 0}\n` +
      `decision ${decision}\n` +
      `settlement ${settlement}\n` +
      `migrations ${row.migrations}\n` +
      `public_tables ${row.public_tables}\n` +
      `posted ${row.posted}\n` +
      `collection_journals ${row.collections}\n` +
      `kitchen_journals ${row.kitchen}\n` +
      `commission_journals ${row.commissions}\n` +
      `unbalanced ${row.unbalanced}\n` +
      `flour ${row.flour}\n` +
      `waste_qty ${row.waste_qty}\n` +
      `settlements ${row.settlements}\n` +
      `scenarios ${row.scenarios}\n`
  )
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Phase 3 counts failed: ${message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]')}\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
