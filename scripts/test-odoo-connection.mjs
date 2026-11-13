#!/usr/bin/env node
/**
 * Safe Odoo 17 Live JSON-RPC Connection Diagnostic CLI (`scripts/test-odoo-connection.mjs`)
 *
 * Security Guarantees:
 * - Reads `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME` (or `ODOO_LOGIN`), and `ODOO_API_KEY` from `.env.local` / `process.env`.
 * - Zero hardcoded URLs, database names, usernames, or API keys anywhere in source.
 * - NEVER logs, prints, or echoes credentials, database names, usernames, URLs, or API keys.
 * - Normalizes trailing slashes (`${baseUrl}/jsonrpc`), enforces `8000ms` AbortController timeout,
 *   lists discovered `pos.config` branches, and prints today's live `pos.order` `read_group` totals
 *   and `latestRecordAt` in `Asia/Kuwait` (`UTC+3`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const KUWAIT_OFFSET_MS = 3 * 3600 * 1000
const RPC_TIMEOUT_MS = 8_000

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
const baseUrl = (process.env.ODOO_URL || localEnv.ODOO_URL || '').trim().replace(/\/+$/, '')
const ODOO_DB = (process.env.ODOO_DB || localEnv.ODOO_DB || '').trim()
const ODOO_USERNAME = (
  process.env.ODOO_USERNAME ||
  localEnv.ODOO_USERNAME ||
  process.env.ODOO_LOGIN ||
  localEnv.ODOO_LOGIN ||
  ''
).trim()
const ODOO_API_KEY = (process.env.ODOO_API_KEY || localEnv.ODOO_API_KEY || '').trim()
const CRON_SECRET = (process.env.CRON_SECRET || localEnv.CRON_SECRET || '').trim()

function sanitizeDiagnosticMessage(msg) {
  let clean = String(msg || 'Unknown error')
  for (const secret of [ODOO_API_KEY, ODOO_USERNAME, ODOO_DB, baseUrl, CRON_SECRET]) {
    if (secret && secret.length >= 3) {
      clean = clean.split(secret).join('[REDACTED]')
    }
  }
  clean = clean.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  clean = clean.replace(/\b[a-f0-9]{32,64}\b/gi, '[REDACTED_KEY]')
  return clean
}

function toKuwaitStamp(odooUtcDateOrder) {
  if (!odooUtcDateOrder) return { utcIso: null, kuwaitIso: null, kuwait: 'N/A', ageHours: null }
  const normalized =
    String(odooUtcDateOrder).trim().replace(' ', 'T') +
    (String(odooUtcDateOrder).endsWith('Z') ? '' : 'Z')
  const dt = new Date(normalized)
  if (Number.isNaN(dt.getTime())) {
    return { utcIso: null, kuwaitIso: null, kuwait: 'Invalid date', ageHours: null }
  }
  const kw = new Date(dt.getTime() + KUWAIT_OFFSET_MS)
  const yyyy = kw.getUTCFullYear()
  const mm = String(kw.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kw.getUTCDate()).padStart(2, '0')
  const hh = String(kw.getUTCHours()).padStart(2, '0')
  const mi = String(kw.getUTCMinutes()).padStart(2, '0')
  const ss = String(kw.getUTCSeconds()).padStart(2, '0')
  const ageHours = Math.round((Math.max(0, Date.now() - dt.getTime()) / 3_600_000) * 10) / 10
  return {
    utcIso: dt.toISOString(),
    kuwaitIso: `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+03:00`,
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

function mapTerminalToBranch(cfgId, cfgName, registry) {
  const regEntry = registry.registers?.[String(cfgId)]
  if (regEntry) {
    const loc = regEntry.location
    if (loc === 'call-center') return 'ardiya'
    if (registry.locations?.[loc]?.unit === 'restaurant') return loc
    return null
  }
  const lower = String(cfgName || '').toLowerCase()
  if (/exhibition|exebition|exb|bazaar|booth|catering|test|training|admin|closed|demo/i.test(lower)) {
    return null
  }
  if (/avenues|افنيوز|الأفنيوز/.test(lower)) return 'avenues'
  if (/360/.test(lower)) return '360-mall'
  if (/assima|asima|عاصمة|العاصمة/.test(lower)) return 'assima'
  if (/promenade|بروميناد/.test(lower)) return 'promenade'
  if (/salmiya|salmyia|سالمية|السالمية/.test(lower)) return 'salmiya'
  if (/kout|كوت|الكوت/.test(lower)) return 'al-kout'
  if (/ardiya|central|call\s*center|عارضية|العارضية/.test(lower)) return 'ardiya'
  return null
}

async function runDiagnostic() {
  console.log('======================================================================')
  console.log('  Aether BI — Safe Odoo 17 JSON-RPC Live Diagnostic (Zero Secrets)')
  console.log('======================================================================')

  const missing = []
  if (!baseUrl) missing.push('ODOO_URL')
  if (!ODOO_DB) missing.push('ODOO_DB')
  if (!ODOO_USERNAME) missing.push('ODOO_USERNAME')
  if (!ODOO_API_KEY) missing.push('ODOO_API_KEY')

  if (missing.length > 0) {
    console.error(`Status          : NOT CONFIGURED (missing env keys: ${missing.join(', ')})`)
    console.error('Action          : Populate .env.local (untracked) using .env.example keys.')
    process.exitCode = 1
    return
  }

  const registryPath = path.join(ROOT, 'src/lib/odoo/pos-registry.json')
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))

  let rpcId = 0
  async function jsonRpc(service, method, args, timeoutMs = RPC_TIMEOUT_MS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${baseUrl}/jsonrpc`, {
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
    const uid = await jsonRpc(
      'common',
      'authenticate',
      [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}],
      RPC_TIMEOUT_MS,
    )
    const authLatencyMs = Date.now() - t0

    if (typeof uid !== 'number' || uid <= 0) {
      const isShortUsername = !ODOO_USERNAME.includes('@')
      console.error('Auth Status     : FAILED (DiagnosticCode: AUTH_REJECTED_CHECK_DB_OR_USER_LOGIN)')
      console.error('Troubleshooting (zero secrets displayed):')
      if (isShortUsername) {
        console.error(
          '  1) ODOO_USERNAME is currently a short handle (no "@"). In Odoo 17 Settings -> Users, check whether the user "Login" field requires the full email address (e.g. user@company.com).',
        )
      } else {
        console.error(
          '  1) Verify ODOO_USERNAME matches the exact "Login" field in Odoo 17 Settings -> Users & Companies -> Users.',
        )
      }
      console.error(
        '  2) Confirm ODOO_DB matches the exact Odoo 17 database slug (case-sensitive).',
      )
      console.error(
        '  3) Regenerate ODOO_API_KEY in Odoo 17 under My Profile -> Account Security -> New API Key for that exact user.',
      )
      process.exitCode = 1
      return
    }

    const executeKw = (model, method, args = [], kwargs = {}, timeoutMs = RPC_TIMEOUT_MS) =>
      jsonRpc('object', 'execute_kw', [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs], timeoutMs)

    const allConfigs = await executeKw(
      'pos.config',
      'search_read',
      [[['active', 'in', [true, false]]]],
      { fields: ['id', 'name', 'company_id', 'active'], context: { active_test: false } },
    )

    const branchTerminals = new Map()
    const restaurantConfigIds = []
    let unmappedConfigCount = 0
    for (const c of allConfigs) {
      const branch = mapTerminalToBranch(c.id, c.name, registry)
      if (branch) {
        restaurantConfigIds.push(c.id)
        branchTerminals.set(branch, (branchTerminals.get(branch) || 0) + 1)
      } else {
        unmappedConfigCount += 1
      }
    }

    const latestOrders = await executeKw(
      'pos.order',
      'search_read',
      [[['state', 'in', ['paid', 'done', 'invoiced']]]],
      {
        fields: ['id', 'date_order', 'amount_total', 'amount_tax', 'config_id', 'state'],
        order: 'date_order desc',
        limit: 5,
      },
    )

    const kwNow = new Date(Date.now() + KUWAIT_OFFSET_MS)
    const todayKuwaitIso = kwNow.toISOString().slice(0, 10)
    const { fromUtc, toUtc } = kuwaitDayUtcBounds(todayKuwaitIso)

    const rgStart = Date.now()
    const [todayRestAgg, todayCompanyAgg] = await Promise.all([
      executeKw(
        'pos.order',
        'read_group',
        [
          [
            ['date_order', '>=', fromUtc],
            ['date_order', '<', toUtc],
            ['state', 'in', ['paid', 'done', 'invoiced']],
            ['session_id.config_id', 'in', restaurantConfigIds],
          ],
          ['amount_total:sum', 'amount_tax:sum'],
          [],
        ],
        { lazy: false },
      ),
      executeKw(
        'pos.order',
        'read_group',
        [
          [
            ['date_order', '>=', fromUtc],
            ['date_order', '<', toUtc],
            ['state', 'in', ['paid', 'done', 'invoiced']],
          ],
          ['amount_total:sum', 'amount_tax:sum'],
          [],
        ],
        { lazy: false },
      ),
    ])
    const rgLatencyMs = Date.now() - rgStart

    const todayRestOrders = Number(todayRestAgg?.[0]?.__count ?? 0)
    const todayRestNetKwd =
      Math.round(
        ((Number(todayRestAgg?.[0]?.amount_total ?? 0) -
          Number(todayRestAgg?.[0]?.amount_tax ?? 0)) +
          Number.EPSILON) *
          1000,
      ) / 1000

    const todayCompanyOrders = Number(todayCompanyAgg?.[0]?.__count ?? 0)
    const todayCompanyNetKwd =
      Math.round(
        ((Number(todayCompanyAgg?.[0]?.amount_total ?? 0) -
          Number(todayCompanyAgg?.[0]?.amount_tax ?? 0)) +
          Number.EPSILON) *
          1000,
      ) / 1000

    const newestStamp = latestOrders.length > 0 ? toKuwaitStamp(latestOrders[0].date_order) : null
    const branchSummary = [...branchTerminals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([b, cnt]) => `${b}(${cnt})`)
      .join(', ')

    console.log(`Auth UID        : ${uid} (Authenticated in ${authLatencyMs} ms | Timeout=${RPC_TIMEOUT_MS}ms)`)
    console.log(
      `POS Configs     : ${allConfigs.length} total (${restaurantConfigIds.length} mapped across ${branchTerminals.size} branches; ${unmappedConfigCount} seasonal/auxiliary preserved in company totals)`,
    )
    console.log(`Mapped Branches : ${branchSummary}`)
    console.log(
      `Latest Receipt  : ${newestStamp ? `${newestStamp.kuwaitIso} (${newestStamp.kuwait} | ${newestStamp.ageHours}h ago — ${newestStamp.ageHours <= 24 ? 'LIVE <24h 🟢' : 'STALE >24h 🔴'})` : 'No orders found'}`,
    )
    console.log(
      `Today (${todayKuwaitIso}): ${todayRestOrders.toLocaleString('en-US')} restaurant orders (${todayRestNetKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD) | Company Total: ${todayCompanyOrders.toLocaleString('en-US')} orders (${todayCompanyNetKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD) [read_group ${rgLatencyMs} ms]`,
    )
    console.log('----------------------------------------------------------------------')
    console.log('Latest 5 POS Receipts (Asia/Kuwait +03:00):')
    for (const ord of latestOrders) {
      const st = toKuwaitStamp(ord.date_order)
      const net =
        Math.round(
          ((Number(ord.amount_total || 0) - Number(ord.amount_tax || 0)) + Number.EPSILON) * 1000,
        ) / 1000
      const termLabel = Array.isArray(ord.config_id) ? ord.config_id[1] : 'POS'
      console.log(`  • #${ord.id} | ${st.kuwaitIso} | ${net.toFixed(3)} KWD | ${termLabel} | state=${ord.state}`)
    }
    console.log('======================================================================')
  } catch (err) {
    console.error(`Connection Test : FAILED — ${sanitizeDiagnosticMessage(err?.message || err)}`)
    process.exitCode = 1
  }
}

await runDiagnostic()
