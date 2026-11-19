#!/usr/bin/env node
/**
 * Qurain (central kitchen) — read-only monthly listing.
 *
 * Qurain stays excluded from company totals. This script only lists what Odoo
 * already has, so the founder can decide whether to include it later.
 * It never writes to Odoo, never changes inclusion, and never prints credentials.
 *
 * Credentials: ODOO_URL, ODOO_DB, ODOO_USERNAME (or ODOO_LOGIN), ODOO_API_KEY
 * in the environment or in `.env.local` (not committed).
 *
 *   node scripts/audit-qurain-monthly.mjs --from 2026-01-01 --to 2026-11-30
 *
 * Writes docs/phase-5/qurain-monthly-<from>_<to>.md and .json.
 * If account.move.line cannot be read, the accounts section is omitted.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { kuwaitRangeToOdooUtc } from './lib/pos-variance-lib.mjs'
import {
  buildQurainMonthlyReport,
  isQurainLabel,
  monthKey,
  renderQurainMonthlyMarkdown,
} from './lib/qurain-audit-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RPC_TIMEOUT_MS = 60_000
const ALLOWED_METHODS = new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local')
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const env = { ...loadEnvLocal(), ...process.env }
const baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '')
const db = String(env.ODOO_DB || '').trim()
const login = String(env.ODOO_USERNAME || env.ODOO_LOGIN || '').trim()
const apiKey = String(env.ODOO_API_KEY || '').trim()

function redact(message) {
  let text = String(message || 'Unknown error')
  for (const secret of [apiKey, login, db, baseUrl]) {
    if (secret && secret.length >= 3) text = text.split(secret).join('[REDACTED]')
  }
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
}

async function rpc(service, method, args) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
      signal: ctrl.signal,
    })
    const body = await res.json()
    if (body.error) throw new Error(body.error?.data?.message || body.error?.message || 'Odoo RPC error')
    return body.result
  } finally {
    clearTimeout(timer)
  }
}

const m2oId = (value) => (Array.isArray(value) ? value[0] : typeof value === 'number' ? value : null)
const m2oName = (value) => (Array.isArray(value) ? String(value[1] ?? '') : '')
const netKwd = (total, tax) => Math.round(((Number(total) || 0) - (Number(tax) || 0)) * 1000) / 1000

async function main() {
  const fromIso = arg('from', '2026-01-01')
  const toIso = arg('to', '2026-11-30')
  if (!baseUrl || !db || !login || !apiKey) {
    console.error('Missing ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY (env or .env.local).')
    process.exit(2)
  }
  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, args, kwargs = {}) => {
    if (!ALLOWED_METHODS.has(method)) throw new Error(`Refusing Odoo method ${method}`)
    return rpc('object', 'execute_kw', [db, uid, apiKey, model, method, args, kwargs])
  }

  const configs = await kw(
    'pos.config',
    'search_read',
    [[]],
    { fields: ['id', 'name', 'active'], limit: 500, context: { active_test: false } },
  )
  const qurainConfigs = configs.filter((row) => isQurainLabel(row.name))
  const qurainIds = qurainConfigs.map((row) => row.id)
  const { fromUtc, toExclusiveUtc } = kuwaitRangeToOdooUtc(fromIso, toIso)

  let sales = []
  if (qurainIds.length > 0) {
    const groups = await kw(
      'pos.order',
      'read_group',
      [[
        ['state', 'in', ['paid', 'done', 'invoiced']],
        ['session_id.config_id', 'in', qurainIds],
        ['date_order', '>=', fromUtc],
        ['date_order', '<', toExclusiveUtc],
      ], ['amount_total:sum', 'amount_tax:sum'], ['session_id.config_id', 'date_order:month']],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    )
    sales = groups
      .map((row) => {
        const configId = m2oId(row['session_id.config_id'] ?? row.config_id)
        const month = monthKey(row['date_order:month'] ?? row.date_order)
        if (!configId || !month) return null
        return {
          month,
          configId,
          configName: m2oName(row['session_id.config_id'] ?? row.config_id),
          orders: Math.round(Number(row.__count) || 0),
          netKwd: netKwd(row.amount_total, row.amount_tax),
        }
      })
      .filter(Boolean)
  }

  let accounts = null
  try {
    const accountRows = await kw(
      'account.account',
      'search_read',
      [[]],
      { fields: ['id', 'name', 'code'], limit: 2000 },
    )
    const qurainAccounts = accountRows.filter((row) => isQurainLabel(`${row.code ?? ''} ${row.name ?? ''}`))
    if (qurainAccounts.length === 0) {
      accounts = []
    } else {
      const groups = await kw(
        'account.move.line',
        'read_group',
        [[
          ['parent_state', '=', 'posted'],
          ['account_id', 'in', qurainAccounts.map((row) => row.id)],
          ['date', '>=', fromIso],
          ['date', '<', toExclusiveUtc.slice(0, 10)],
        ], ['debit:sum', 'credit:sum'], ['account_id', 'date:month']],
        { lazy: false },
      )
      accounts = groups
        .map((row) => {
          const accountId = m2oId(row.account_id)
          const month = monthKey(row['date:month'] ?? row.date)
          if (!accountId || !month) return null
          return {
            month,
            accountId,
            accountName: m2oName(row.account_id),
            debitKwd: Math.round((Number(row.debit) || 0) * 1000) / 1000,
            creditKwd: Math.round((Number(row.credit) || 0) * 1000) / 1000,
          }
        })
        .filter(Boolean)
    }
  } catch {
    accounts = null
  }

  const report = buildQurainMonthlyReport({ configs: qurainConfigs, sales, accounts })
  const meta = { fromIso, toIso, generatedAt: new Date().toISOString() }
  const outDir = path.join(ROOT, 'docs/phase-5')
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.join(outDir, `qurain-monthly-${fromIso}_${toIso}`)
  fs.writeFileSync(`${base}.json`, `${JSON.stringify({ meta, report }, null, 2)}\n`)
  fs.writeFileSync(`${base}.md`, renderQurainMonthlyMarkdown(report, meta))
  console.log(`Wrote ${base}.md`)
  console.log(`Qurain configs: ${report.configs.length}. Sales rows: ${report.sales.length}. Accounts: ${report.accounts == null ? 'omitted' : report.accounts.length}.`)
}

main().catch((err) => {
  console.error('Qurain monthly audit failed:', redact(err?.message || err))
  process.exit(1)
})
