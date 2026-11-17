#!/usr/bin/env node
/**
 * Phase 5 · Item 6 — per-register POS variance audit straight from Odoo 17.
 *
 *   node scripts/audit-pos-variance.mjs --from 2026-11-01 --to 2026-11-17 [--target 1723]
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_USERNAME (or ODOO_LOGIN) / ODOO_API_KEY from the environment or
 * `.env.local`. Read-only (authenticate, search_read, read_group). Never prints credentials.
 * Writes docs/phase-5/pos-variance-<from>_<to>.md and .json.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildVarianceReport,
  kuwaitRangeToOdooUtc,
  renderVarianceMarkdown,
} from './lib/pos-variance-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RPC_TIMEOUT_MS = 30_000

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function loadEnvLocal() {
  const f = path.join(ROOT, '.env.local')
  const out = {}
  if (!fs.existsSync(f)) return out
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[line.slice(0, eq).trim()] = v
  }
  return out
}

const env = { ...loadEnvLocal(), ...process.env }
const baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '')
const db = String(env.ODOO_DB || '').trim()
const login = String(env.ODOO_USERNAME || env.ODOO_LOGIN || '').trim()
const apiKey = String(env.ODOO_API_KEY || '').trim()

function redact(msg) {
  let s = String(msg || 'Unknown error')
  for (const secret of [apiKey, login, db, baseUrl]) if (secret && secret.length >= 3) s = s.split(secret).join('[REDACTED]')
  return s.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
}

async function rpc(service, method, args) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
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
    clearTimeout(t)
  }
}

async function main() {
  const fromIso = arg('from', '2026-11-01')
  const toIso = arg('to', '2026-11-17')
  const target = Number(arg('target', '1723'))
  if (!baseUrl || !db || !login || !apiKey) {
    console.error('Missing ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY (env or .env.local).')
    process.exit(2)
  }
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/odoo/pos-registry.json'), 'utf8'))

  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, a, k = {}) => rpc('object', 'execute_kw', [db, uid, apiKey, model, method, a, k])

  const { fromUtc, toExclusiveUtc } = kuwaitRangeToOdooUtc(fromIso, toIso)
  const domain = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', fromUtc],
    ['date_order', '<', toExclusiveUtc],
  ]

  const groups = await kw('pos.order', 'read_group', [domain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false })
  const sessionIds = groups.map((g) => (Array.isArray(g.session_id) ? g.session_id[0] : null)).filter(Boolean)
  const sessions = sessionIds.length
    ? await kw('pos.session', 'read', [sessionIds, ['config_id']])
    : []
  const cfgOfSession = new Map(sessions.map((s) => [s.id, Array.isArray(s.config_id) ? s.config_id : null]))

  const byConfig = new Map()
  for (const g of groups) {
    const sid = Array.isArray(g.session_id) ? g.session_id[0] : null
    const cfg = sid ? cfgOfSession.get(sid) : null
    const id = cfg ? cfg[0] : 0
    const row = byConfig.get(id) ?? { configId: id, configName: cfg ? cfg[1] : 'No session / config', orders: 0, grossKwd: 0, taxKwd: 0 }
    row.orders += Number(g.__count) || 0
    row.grossKwd += Number(g.amount_total) || 0
    row.taxKwd += Number(g.amount_tax) || 0
    byConfig.set(id, row)
  }

  const report = buildVarianceReport([...byConfig.values()], registry, { targetVarianceKwd: target })
  const meta = { fromIso, toIso, generatedAt: new Date().toISOString() }
  const outDir = path.join(ROOT, 'docs', 'phase-5')
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.join(outDir, `pos-variance-${fromIso}_${toIso}`)
  fs.writeFileSync(`${base}.md`, renderVarianceMarkdown(report, meta))
  fs.writeFileSync(`${base}.json`, JSON.stringify({ meta, ...report }, null, 2))

  console.log(`Wrote ${path.relative(ROOT, base)}.md / .json`)
  for (const [k, v] of Object.entries(report.totals)) console.log(`  ${report.labels[k].padEnd(48)} ${v.toFixed(3)} KWD`)
  const hits = report.gaps.filter((g) => g.matchesTarget)
  console.log(hits.length ? `Gap(s) matching ${target} KWD:\n${hits.map((h) => `  ${h.label}: ${h.diffKwd.toFixed(3)}`).join('\n')}` : `No basis gap matches ${target} KWD — see per-register table.`)
}

main().catch((err) => {
  console.error('POS variance audit failed:', redact(err?.message || err))
  process.exit(1)
})
