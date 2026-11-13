#!/usr/bin/env node
/**
 * Safe Odoo 17 Live JSON-RPC Connection Diagnostic CLI (`scripts/test-odoo-connection.mjs`)
 *
 * Security Guarantees:
 * - Reads `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` (or `ODOO_LOGIN`), and `ODOO_API_KEY` from `.env.local` / `process.env`.
 * - NEVER logs, prints, or echoes credentials, database names, usernames, URLs, or API keys.
 * - Verifies JSON-RPC `authenticate`, `pos.config` count, latest 5 `pos.order` timestamps in `Asia/Kuwait`,
 *   Today's KWD Net Sales, and optional `stock.picking` / `account.move.line` read access.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const KUWAIT_OFFSET_MS = 3 * 3600 * 1000

function loadDotEnvLocal() {
  const envFile = path.join(ROOT, '.env.local')
  const out = {}
  if (!fs.existsSync(envFile)) return out
  const content = fs.readFileSync(envFile, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const localEnv = loadDotEnvLocal()
const ODOO_URL = (process.env.ODOO_URL || localEnv.ODOO_URL || '').trim().replace(/\/+$/, '')
const ODOO_DB = (process.env.ODOO_DB || localEnv.ODOO_DB || '').trim()
const ODOO_USERNAME = (
  process.env.ODOO_USERNAME ||
  localEnv.ODOO_USERNAME ||
  process.env.ODOO_LOGIN ||
  localEnv.ODOO_LOGIN ||
  ''
).trim()
const ODOO_API_KEY = (process.env.ODOO_API_KEY || localEnv.ODOO_API_KEY || '').trim()

function sanitizeDiagnosticMessage(msg) {
  let clean = String(msg || 'Unknown error')
  for (const secret of [ODOO_API_KEY, ODOO_USERNAME, ODOO_DB, ODOO_URL]) {
    if (secret && secret.length >= 3) {
      clean = clean.split(secret).join('[REDACTED]')
    }
  }
  return clean.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
}

function toKuwaitStamp(odooUtcDateOrder) {
  if (!odooUtcDateOrder) return { iso: null, kuwait: 'N/A', ageHours: null }
  const normalized = String(odooUtcDateOrder).trim().replace(' ', 'T') + (String(odooUtcDateOrder).endsWith('Z') ? '' : 'Z')
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) return { iso: null, kuwait: 'Invalid date', ageHours: null }
  const kw = new Date(dt.getTime() + KUWAIT_OFFSET_MS)
  const yyyy = kw.getUTCFullYear()
  const mm = String(kw.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kw.getUTCDate()).padStart(2, '0')
  const hh = String(kw.getUTCHours()).padStart(2, '0')
  const mi = String(kw.getUTCMinutes()).padStart(2, '0')
  const ageHours = Math.round((Math.max(0, Date.now() - dt.getTime()) / 3_600_000) * 10) / 10
  return {
    iso: dt.toISOString(),
    kuwaitDay: `${yyyy}-${mm}-${dd}`,
    kuwait: `${dd}/${mm}/${yyyy} ${hh}:${mi} UTC+3`,
    ageHours,
  }
}

function kuwaitDayUtcBounds(kuwaitIsoDate) {
  const startUtcMs = Date.parse(`${kuwaitIsoDate}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const endUtcMs = startUtcMs + 86_400_000
  const fmtOdooUtc = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
  return { fromUtc: fmtOdooUtc(startUtcMs), toUtc: fmtOdooUtc(endUtcMs) }
}

async function runDiagnostic() {
  console.log('======================================================================')
  console.log('  Aether BI — Safe Odoo 17 JSON-RPC Live Diagnostic (Zero Secrets)')
  console.log('======================================================================')

  const missing = []
  if (!ODOO_URL) missing.push('ODOO_URL')
  if (!ODOO_DB) missing.push('ODOO_DB')
  if (!ODOO_USERNAME) missing.push('ODOO_USERNAME')
  if (!ODOO_API_KEY) missing.push('ODOO_API_KEY')

  if (missing.length > 0) {
    console.error(`Status          : NOT CONFIGURED (missing env keys: ${missing.join(', ')})`)
    process.exitCode = 1
    return
  }

  const registryPath = path.join(ROOT, 'src/lib/odoo/pos-registry.json')
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
  const restaurantAllowedIds = (registry.allowedPosConfigIds || []).filter((id) => {
    const loc = registry.registers?.[String(id)]?.location
    return Boolean(loc && registry.locations?.[loc]?.unit === 'restaurant')
  })

  let rpcId = 0
  async function jsonRpc(service, method, args, timeoutMs = 10_000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${ODOO_URL}/jsonrpc`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          id: ++rpcId,
          params: { service, method, args },
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const payload = await res.json()
      if (payload.error) {
        const errMsg = payload.error.data?.message || payload.error.message || 'JSON-RPC error'
        throw new Error(errMsg)
      }
      return payload.result
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    const t0 = Date.now()
    const uid = await jsonRpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}], 10_000)
    const authLatencyMs = Date.now() - t0

    if (typeof uid !== 'number' || uid <= 0) {
      console.error('Auth Status     : FAILED (Invalid service credentials or inactive UID)')
      process.exitCode = 1
      return
    }

    const executeKw = (model, method, args = [], kwargs = {}, timeoutMs = 15_000) =>
      jsonRpc('object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)

    const allConfigs = await executeKw(
      'pos.config',
      'search_read',
      [[['active', 'in', [true, false]]]],
      { fields: ['id', 'name', 'active'], context: { active_test: false } },
    )
    const whitelistedFound = allConfigs.filter((c) => restaurantAllowedIds.includes(c.id))

    const latestOrders = await executeKw(
      'pos.order',
      'search_read',
      [
        [
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ['session_id.config_id', 'in', restaurantAllowedIds],
        ],
      ],
      {
        fields: ['id', 'name', 'date_order', 'amount_total', 'amount_tax', 'state'],
        order: 'date_order desc',
        limit: 5,
      },
    )

    const kwNow = new Date(Date.now() + KUWAIT_OFFSET_MS)
    const todayKuwaitIso = kwNow.toISOString().slice(0, 10)
    const { fromUtc, toUtc } = kuwaitDayUtcBounds(todayKuwaitIso)

    const todayAgg = await executeKw(
      'pos.order',
      'read_group',
      [
        [
          ['date_order', '>=', fromUtc],
          ['date_order', '<', toUtc],
          ['state', 'in', ['paid', 'done', 'invoiced']],
          ['session_id.config_id', 'in', restaurantAllowedIds],
        ],
        ['amount_total:sum', 'amount_tax:sum'],
        [],
      ],
      { lazy: false },
    )

    const todayOrdersCount = Number(todayAgg?.[0]?.__count ?? 0)
    const todayNetKwd =
      Math.round(
        ((Number(todayAgg?.[0]?.amount_total ?? 0) - Number(todayAgg?.[0]?.amount_tax ?? 0)) + Number.EPSILON) * 1000,
      ) / 1000

    let stockPickingsStatus = 'restricted'
    try {
      const canReadPicking = await executeKw('stock.picking', 'check_access_rights', ['read', false])
      if (canReadPicking === true) {
        const recentPickings = await executeKw(
          'stock.picking',
          'search_read',
          [[['state', 'in', ['done', 'assigned', 'waiting', 'confirmed']]]],
          { fields: ['id', 'state'], order: 'id desc', limit: 15 },
        )
        const doneCount = recentPickings.filter((p) => p.state === 'done').length
        stockPickingsStatus = `readable (latest ${recentPickings.length} transfers checked, ${doneCount} done)`
      }
    } catch {
      stockPickingsStatus = 'restricted (gracefully isolated)'
    }

    let receivablesStatus = 'restricted'
    try {
      const canReadAml = await executeKw('account.move.line', 'check_access_rights', ['read', false])
      if (canReadAml === true) {
        const recRows = await executeKw(
          'account.move.line',
          'read_group',
          [
            [
              ['parent_state', '=', 'posted'],
              ['account_id.account_type', '=', 'asset_receivable'],
              ['reconciled', '=', false],
            ],
            ['amount_residual:sum'],
            [],
          ],
          { lazy: false },
        )
        const openKwd = Math.round((Number(recRows?.[0]?.amount_residual ?? 0) + Number.EPSILON) * 1000) / 1000
        receivablesStatus = `readable (Open Receivable: ${openKwd.toFixed(3)} KWD)`
      }
    } catch {
      receivablesStatus = 'restricted (gracefully isolated)'
    }

    const newestStamp = latestOrders.length > 0 ? toKuwaitStamp(latestOrders[0].date_order) : null

    console.log(`Auth UID        : ${uid} (Authenticated in ${authLatencyMs} ms)`)
    console.log(
      `POS Configs     : ${allConfigs.length} total found (${whitelistedFound.length}/${restaurantAllowedIds.length} Venture Foods restaurant terminals matched)`,
    )
    console.log(
      `Latest Order    : ${newestStamp ? `${newestStamp.kuwait} (${newestStamp.ageHours}h ago — ${newestStamp.ageHours <= 24 ? 'LIVE <24h 🟢' : 'STALE >24h 🔴'})` : 'No orders found'}`,
    )
    console.log(
      `Today (${todayKuwaitIso}): ${todayOrdersCount.toLocaleString('en-US')} orders | ${todayNetKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD Net Sales`,
    )
    console.log(`Stock Transfers : ${stockPickingsStatus}`)
    console.log(`AR Clearing     : ${receivablesStatus}`)
    console.log('----------------------------------------------------------------------')
    console.log('Latest 5 POS Orders (Kuwait Time UTC+3):')
    for (const ord of latestOrders) {
      const st = toKuwaitStamp(ord.date_order)
      const net = Math.round(((Number(ord.amount_total || 0) - Number(ord.amount_tax || 0)) + Number.EPSILON) * 1000) / 1000
      console.log(`  • #${ord.id} | ${st.kuwait} | ${net.toFixed(3)} KWD | state=${ord.state}`)
    }
    console.log('======================================================================')
  } catch (err) {
    console.error(`Connection Test : FAILED — ${sanitizeDiagnosticMessage(err?.message || err)}`)
    process.exitCode = 1
  }
}

await runDiagnostic()
