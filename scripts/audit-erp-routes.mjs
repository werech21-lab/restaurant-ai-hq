/**
 * Additive route liveness audit against production (or BASE_URL).
 * Accepts 200/301/302/307/308 as healthy (auth redirects still prove the route exists).
 */
const base = (process.env.BASE_URL || 'https://www.aetherbi.com').replace(/\/$/, '')

const paths = [
  '/login',
  '/dashboard',
  '/pos',
  '/inventory',
  '/sales',
  '/purchases',
  '/hr',
  '/crm',
  '/accounting',
  '/recipes',
  '/kds',
  '/delivery-hub',
  '/erp',
  '/erp/hr',
  '/erp/inventory',
  '/erp/finance',
  '/erp/sales-crm',
  '/erp/projects',
  '/erp/aggregator-radar',
  '/erp/intelligence',
  '/erp/governance',
  '/erp/compliance',
  '/erp/archive',
  '/erp/odoo-sync',
]

const okStatuses = new Set([200, 301, 302, 303, 307, 308])

const rows = []
let failures = 0
for (const path of paths) {
  const url = `${base}${path}`
  try {
    const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'aetherbi-route-audit' } })
    const ok = okStatuses.has(res.status)
    if (!ok) failures += 1
    rows.push({ path, status: res.status, ok })
    console.log(`${ok ? 'OK ' : 'FAIL'} ${res.status} ${path}`)
  } catch (error) {
    failures += 1
    rows.push({ path, status: 'ERR', ok: false })
    console.error(`FAIL ERR ${path}`, error instanceof Error ? error.message : error)
  }
}

console.log('\n--- Markdown table ---')
console.log('| Path | Status | Healthy |')
console.log('|---|---:|:---:|')
for (const row of rows) {
  console.log(`| ${row.path} | ${row.status} | ${row.ok ? 'yes' : 'no'} |`)
}

if (failures > 0) {
  console.error(`\nRoute audit failed: ${failures} unhealthy path(s).`)
  process.exit(1)
}
console.log('\nRoute audit passed.')
