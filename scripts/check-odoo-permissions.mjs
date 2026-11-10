#!/usr/bin/env node
/**
 * Live Odoo read-permission audit for the BI service user (ODOO_LOGIN, e.g. bi_analytics).
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY from .env.local (git-ignored) and, for every
 * model below, runs search_count + search_read(limit: 1) inside its own try/catch. Nothing is written
 * to Odoo and no credential is printed or stored.
 *
 * Usage: node scripts/check-odoo-permissions.mjs [--json]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  const out = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}
const fileEnv = loadEnvFile(path.join(ROOT, '.env.local'))
const env = (k) => process.env[k] || fileEnv[k] || ''
const ODOO_URL = env('ODOO_URL').replace(/\/+$/, '')
const ODOO_DB = env('ODOO_DB')
const ODOO_LOGIN = env('ODOO_LOGIN')
const ODOO_API_KEY = env('ODOO_API_KEY')
for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY })) {
  if (!v) {
    console.error(`✖ ${k} is missing in .env.local`)
    process.exit(1)
  }
}

let rpcId = 0
async function rpc(service, method, args) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: ++rpcId, params: { service, method, args } }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) {
    const e = new Error(json.error.data?.message || json.error.message || 'Odoo error')
    e.odoo = json.error
    throw e
  }
  return json.result
}
let UID = 0
const ek = (model, method, args = [], kwargs = {}) => rpc('object', 'execute_kw', [ODOO_DB, UID, ODOO_API_KEY, model, method, args, kwargs])

/** Least-privileged standard Odoo 16 group that grants read access to each model. */
const MODELS = [
  { model: 'pos.config', domain: 'POS & Sales', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'pos.order', domain: 'POS & Sales', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'pos.order.line', domain: 'POS & Sales', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'pos.session', domain: 'POS & Sales', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'pos.payment', domain: 'POS & Sales', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'sale.order', domain: 'POS & Sales', group: 'Sales / User: All Documents (sales_team.group_sale_salesman_all_leads)' },
  { model: 'product.product', domain: 'Menu & BOM', group: 'Inventory / User (stock.group_stock_user) — also unlocks the Cost field' },
  { model: 'product.template', domain: 'Menu & BOM', group: 'Inventory / User (stock.group_stock_user)' },
  { model: 'pos.category', domain: 'Menu & BOM', group: 'Point of Sale / User (point_of_sale.group_pos_user)' },
  { model: 'mrp.bom', domain: 'Menu & BOM', group: 'Manufacturing / User (mrp.group_mrp_user)' },
  { model: 'account.move', domain: 'Accounting, Rents & Custodies', group: 'Accounting / Read-only (account.group_account_readonly)' },
  { model: 'account.move.line', domain: 'Accounting, Rents & Custodies', group: 'Accounting / Read-only (account.group_account_readonly)' },
  { model: 'account.account', domain: 'Accounting, Rents & Custodies', group: 'Accounting / Read-only (account.group_account_readonly)' },
  { model: 'account.analytic.account', domain: 'Accounting, Rents & Custodies', group: 'Analytic Accounting (analytic.group_analytic_accounting) + Accounting / Read-only' },
  { model: 'purchase.order', domain: 'Purchasing & Vendors', group: 'Purchase / User (purchase.group_purchase_user)' },
  { model: 'purchase.order.line', domain: 'Purchasing & Vendors', group: 'Purchase / User (purchase.group_purchase_user)' },
  { model: 'res.partner', domain: 'Purchasing & Vendors', group: 'Internal User (base.group_user)' },
  { model: 'stock.quant', domain: 'Inventory & Wastage', group: 'Inventory / User (stock.group_stock_user)' },
  { model: 'stock.picking', domain: 'Inventory & Wastage', group: 'Inventory / User (stock.group_stock_user)' },
  { model: 'stock.move', domain: 'Inventory & Wastage', group: 'Inventory / User (stock.group_stock_user)' },
  { model: 'stock.scrap', domain: 'Inventory & Wastage', group: 'Inventory / User (stock.group_stock_user)' },
  { model: 'hr.employee', domain: 'HR & Labor', group: 'Employees / Officer: Manage all employees (hr.group_hr_user)' },
  { model: 'hr.expense', domain: 'HR & Labor', group: 'Expenses / All Approver (hr_expense.group_hr_expense_user)' },
  { model: 'hr.attendance', domain: 'HR & Labor', group: 'Attendances / Officer: Manage all attendances (hr_attendance.group_hr_attendance_user)' },
]

/** Extra field-level checks that matter for the analytics. */
const FIELD_CHECKS = [
  { model: 'product.product', field: 'standard_price', label: 'product.product · standard_price (Cost)', group: 'Inventory / User (stock.group_stock_user) or Accounting / Read-only' },
  { model: 'purchase.order.line', field: 'price_unit', label: 'purchase.order.line · price_unit', group: 'Purchase / User (purchase.group_purchase_user)' },
  { model: 'stock.move', field: 'price_unit', label: 'stock.move · price_unit (scrap valuation)', group: 'Inventory / User (stock.group_stock_user)' },
]

const classify = (e) => {
  const text = `${e.message} ${JSON.stringify(e.odoo ?? {})}`
  if (/doesn't exist|does not exist|Object .* doesn't exist|KeyError/i.test(text)) return 'NOT INSTALLED'
  if (/AccessError|access right|not allowed to access|AccessDenied|record rules/i.test(text)) return 'ACCESS DENIED'
  return 'ERROR'
}

const results = []
const fieldResults = []
try {
  UID = await rpc('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}])
} catch (e) {
  console.error(`✖ Authentication failed: ${e.message}`)
  process.exit(1)
}
if (!UID) {
  console.error('✖ Authentication failed (check ODOO_LOGIN / ODOO_API_KEY)')
  process.exit(1)
}

for (const m of MODELS) {
  const row = { ...m, status: '', count: null, note: '' }
  try {
    const count = await ek(m.model, 'search_count', [[]])
    await ek(m.model, 'search_read', [[]], { fields: ['id', 'display_name'], limit: 1 })
    row.status = 'READ OK'
    row.count = count
  } catch (e) {
    row.status = classify(e)
    row.note = (e.message || '').split('\n')[0].slice(0, 140)
  }
  results.push(row)
}

for (const f of FIELD_CHECKS) {
  const parent = results.find((r) => r.model === f.model)
  if (parent?.status !== 'READ OK') {
    fieldResults.push({ ...f, status: 'SKIPPED (model not readable)' })
    continue
  }
  try {
    await ek(f.model, 'search_read', [[]], { fields: ['id', f.field], limit: 1 })
    fieldResults.push({ ...f, status: 'READ OK' })
  } catch (e) {
    fieldResults.push({ ...f, status: classify(e) })
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), login: ODOO_LOGIN, uid: UID, models: results, fields: fieldResults }, null, 2))
} else {
  const icon = (s) => (s === 'READ OK' ? '✅ READ OK' : s === 'ACCESS DENIED' ? '❌ ACCESS DENIED' : s === 'NOT INSTALLED' ? '⚪ NOT INSTALLED' : `⚠️ ${s}`)
  console.log(`\nOdoo read audit · ${ODOO_URL} · db=${ODOO_DB} · user=${ODOO_LOGIN} (uid ${UID})\n`)
  console.log('| Model | Domain | Status | Record Count |')
  console.log('|---|---|---|---:|')
  for (const r of results) console.log(`| ${r.model} | ${r.domain} | ${icon(r.status)} | ${r.count ?? '—'} |`)
  console.log('\n| Field | Status |')
  console.log('|---|---|')
  for (const f of fieldResults) console.log(`| ${f.label} | ${icon(f.status)} |`)
  const missing = [...results.filter((r) => r.status === 'ACCESS DENIED'), ...fieldResults.filter((f) => f.status === 'ACCESS DENIED')]
  if (missing.length) {
    console.log('\nRead-only groups to request from IT:')
    for (const m of missing) console.log(`- ${m.model ?? m.label}${m.field ? `.${m.field}` : ''}: ${m.group}`)
  } else {
    console.log('\nAll audited models and fields are readable.')
  }
}
