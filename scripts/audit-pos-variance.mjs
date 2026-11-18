#!/usr/bin/env node
/**
 * Phase 1.5 (C7) — per-register POS variance & owner reconciliation audit straight from Odoo 17.
 *
 *   node scripts/audit-pos-variance.mjs --from 2026-11-01 --to 2026-11-17 [--owner-ref 66487.04] [--write-redo-doc]
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_USERNAME (or ODOO_LOGIN) / ODOO_API_KEY from the environment or
 * `.env.local`. Strictly read-only (`authenticate`, `search_read`, `read_group`, `read`).
 * Never prints credentials and never modifies app totals.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildVarianceReport,
  kuwaitRangeToOdooUtc,
  renderReconciliationRedoMarkdown,
  renderVarianceMarkdown,
} from './lib/pos-variance-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RPC_TIMEOUT_MS = 30_000
const ALLOWED_METHODS = new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
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

export async function runPosVarianceCli({
  fromIso = '2026-11-01',
  toIso = '2026-11-17',
  ownerRefKwd = 66487.04,
  targetKwd = 242.391,
  writeRedoDoc = false,
  envIn = process.env,
} = {}) {
  const env = { ...loadEnvLocal(), ...envIn }
  const baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '')
  const db = String(env.ODOO_DB || '').trim()
  const login = String(env.ODOO_USERNAME || env.ODOO_LOGIN || '').trim()
  const apiKey = String(env.ODOO_API_KEY || '').trim()

  const redact = (msg) => {
    let s = String(msg || 'Unknown error')
    for (const secret of [apiKey, login, db, baseUrl]) {
      if (secret && secret.length >= 3) s = s.split(secret).join('[REDACTED]')
    }
    return s.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  }

  if (!baseUrl || !db || !login || !apiKey) {
    const err = new Error('Missing ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY (env or .env.local).')
    err.code = 'MISSING_ENV'
    throw err
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
      if (body.error) throw new Error(redact(body.error?.data?.message || body.error?.message || 'Odoo RPC error'))
      return body.result
    } finally {
      clearTimeout(t)
    }
  }

  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/odoo/pos-registry.json'), 'utf8'))

  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, a, k = {}) => {
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(`Blocked non-read-only Odoo method: ${method}`)
    }
    return rpc('object', 'execute_kw', [db, uid, apiKey, model, method, a, k])
  }

  // Read ALL pos.config records (active AND archived) so #16, #35, #36, [24,25,39,40], and Qurain are classified accurately.
  const allConfigs = await kw('pos.config', 'search_read', [[]], {
    fields: ['id', 'name', 'active'],
    order: 'id asc',
    limit: 500,
    context: { active_test: false },
  })
  const configMetaById = new Map(allConfigs.map((c) => [c.id, { name: String(c.name ?? ''), active: c.active !== false }]))

  const { fromUtc, toExclusiveUtc } = kuwaitRangeToOdooUtc(fromIso, toIso)
  const domain = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', fromUtc],
    ['date_order', '<', toExclusiveUtc],
  ]

  const byConfig = new Map()
  for (const c of allConfigs) {
    byConfig.set(c.id, {
      configId: c.id,
      configName: String(c.name ?? `pos.config ${c.id}`),
      active: c.active !== false,
      orders: 0,
      grossKwd: 0,
      taxKwd: 0,
    })
  }

  let groupedByConfigDirectly = false
  try {
    const configGroups = await kw(
      'pos.order',
      'read_group',
      [domain, ['amount_total:sum', 'amount_tax:sum'], ['config_id']],
      { lazy: false, context: { active_test: false } },
    )
    groupedByConfigDirectly = true
    for (const g of configGroups) {
      const cfg = Array.isArray(g.config_id) ? g.config_id : null
      const id = cfg ? cfg[0] : 0
      const meta = configMetaById.get(id)
      const row = byConfig.get(id) ?? {
        configId: id,
        configName: meta?.name ?? (cfg ? String(cfg[1]) : 'No session / config'),
        active: meta ? meta.active : true,
        orders: 0,
        grossKwd: 0,
        taxKwd: 0,
      }
      row.orders += Number(g.__count) || 0
      row.grossKwd += Number(g.amount_total) || 0
      row.taxKwd += Number(g.amount_tax) || 0
      byConfig.set(id, row)
    }
  } catch {
    const sessionGroups = await kw(
      'pos.order',
      'read_group',
      [domain, ['amount_total:sum', 'amount_tax:sum'], ['session_id']],
      { lazy: false, context: { active_test: false } },
    )
    const sessionIds = sessionGroups.map((g) => (Array.isArray(g.session_id) ? g.session_id[0] : null)).filter(Boolean)
    const sessions = sessionIds.length
      ? await kw('pos.session', 'read', [sessionIds, ['config_id']], { context: { active_test: false } })
      : []
    const cfgOfSession = new Map(sessions.map((s) => [s.id, Array.isArray(s.config_id) ? s.config_id : null]))
    for (const g of sessionGroups) {
      const sid = Array.isArray(g.session_id) ? g.session_id[0] : null
      const cfg = sid ? cfgOfSession.get(sid) : null
      const id = cfg ? cfg[0] : 0
      const meta = configMetaById.get(id)
      const row = byConfig.get(id) ?? {
        configId: id,
        configName: meta?.name ?? (cfg ? String(cfg[1]) : 'No session / config'),
        active: meta ? meta.active : true,
        orders: 0,
        grossKwd: 0,
        taxKwd: 0,
      }
      row.orders += Number(g.__count) || 0
      row.grossKwd += Number(g.amount_total) || 0
      row.taxKwd += Number(g.amount_tax) || 0
      byConfig.set(id, row)
    }
  }

  // Ensure #36 is explicitly surfaced even if absent from pos.config (e.g. deleted or restricted).
  if (!byConfig.has(36)) {
    byConfig.set(36, {
      configId: 36,
      configName: 'pos.config #36 (absent in Odoo pos.config)',
      active: false,
      orders: 0,
      grossKwd: 0,
      taxKwd: 0,
    })
  }

  const report = buildVarianceReport([...byConfig.values()], registry, {
    targetVarianceKwd: targetKwd,
    ownerReferenceKwd: ownerRefKwd,
  })
  const meta = {
    fromIso,
    toIso,
    generatedAt: new Date().toISOString(),
    groupedBy: groupedByConfigDirectly ? 'pos.order.config_id' : 'pos.order.session_id',
  }

  const outDir = path.join(ROOT, 'docs', 'phase-5')
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.join(outDir, `pos-variance-${fromIso}_${toIso}`)
  fs.writeFileSync(`${base}.md`, `${redact(renderVarianceMarkdown(report, meta))}\n`)
  fs.writeFileSync(`${base}.json`, `${redact(JSON.stringify({ meta, ...report }, null, 2))}\n`)

  let redoDocPath = null
  if (writeRedoDoc) {
    const redoDir = path.join(ROOT, 'docs', 'redo')
    fs.mkdirSync(redoDir, { recursive: true })
    redoDocPath = path.join(redoDir, 'reconciliation-1-17-nov.md')
    fs.writeFileSync(redoDocPath, `${redact(renderReconciliationRedoMarkdown(report, meta))}\n`)
  }

  return { meta, report, base, redoDocPath }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  const fromIso = arg('from', '2026-11-01')
  const toIso = arg('to', '2026-11-17')
  const ownerRefKwd = Number(arg('owner-ref', '66487.04'))
  const targetKwd = Number(arg('target', '242.391'))
  const writeRedoDoc = hasFlag('write-redo-doc')

  runPosVarianceCli({ fromIso, toIso, ownerRefKwd, targetKwd, writeRedoDoc })
    .then(({ report, base, redoDocPath }) => {
      console.log(`Wrote ${path.relative(ROOT, base)}.md / .json`)
      if (redoDocPath) console.log(`Wrote ${path.relative(ROOT, redoDocPath)}`)
      for (const row of report.ownerReconciliation) {
        console.log(
          `  ${row.label.padEnd(64)} ${row.basisNetKwd.toFixed(3)} KWD (vs owner: ${row.deltaKwd >= 0 ? '+' : ''}${row.deltaKwd.toFixed(3)})`,
        )
      }
    })
    .catch((err) => {
      console.error('POS variance audit failed:', err?.message || err)
      process.exit(err?.code === 'MISSING_ENV' ? 2 : 1)
    })
}
