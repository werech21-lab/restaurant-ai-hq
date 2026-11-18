#!/usr/bin/env node
/**
 * Unified Read-Only Owner Runner for Mac Live Odoo Captures (`scripts/run-mac-readonly-probes.mjs`)
 *
 *   node scripts/run-mac-readonly-probes.mjs
 *
 * Strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read` ONLY).
 * Never prints, logs, or commits credentials, URLs, usernames, or API keys.
 *
 * Captures in one deterministic pass when `.env.local` is present on the owner's Mac:
 *   (a) Booth-era `OdooLiveSummary` fixture (`src/lib/__tests__/fixtures/dashboard-booth-era-live.json`)
 *   (b) Qurain Central Kitchen double-count audit (`docs/phase-5/qurain-audit-2026-11-01_2026-11-17.{json,md}` + current month)
 *   (c) 1–17 Nov POS reconciliation vs owner reference `66,487.04 KWD` (`docs/redo/reconciliation-1-17-nov.md`)
 *   (d) Phase 2.1 Live Odoo Model Probe (`docs/redo/odoo-model-probe.md` + `.json`)
 *
 * If `.env.local` / Odoo credentials are absent, exits cleanly (code 0 unless `--require-env`)
 * with step-by-step owner instructions.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runQurainAuditCli } from './audit-qurain-double-count.mjs'
import { runPosVarianceCli } from './audit-pos-variance.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC_TIMEOUT_MS = 30_000
const KUWAIT_OFFSET_MS = 3 * 3600_000

export const ALLOWED_ODOO_METHODS = new Set([
  'fields_get',
  'search_count',
  'search_read',
  'read_group',
  'read',
])

export function assertReadOnlyOdooMethod(method) {
  if (!ALLOWED_ODOO_METHODS.has(String(method))) {
    throw new Error(
      `Security violation: "${String(method)}" is blocked. Only read-only Odoo methods (${[...ALLOWED_ODOO_METHODS].join(', ')}) are permitted.`,
    )
  }
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

function getKuwaitTodayIso(nowMs = Date.now()) {
  return new Date(nowMs + KUWAIT_OFFSET_MS).toISOString().slice(0, 10)
}

export function renderModelProbeMarkdown(probe) {
  const L = []
  L.push('# Odoo 17 Read-Only Model Probe (Phase 2.1 · F2)')
  L.push('')
  L.push(`- **Generated**: \`${probe.generatedAt}\``)
  L.push('- **RPC policy**: strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read`)')
  L.push('')
  L.push('## 1. Model Coverage Summary')
  L.push('')
  L.push('| Model | Readable | Total Rows | Date Span | % With Branch / Location | Key Fields Present | Notes |')
  L.push('|---|:---:|---:|---|---:|---|---|')
  for (const m of probe.models ?? []) {
    const span = m.dateSpan ? `${m.dateSpan.min ?? '—'} → ${m.dateSpan.max ?? '—'}` : '—'
    const cov = typeof m.branchCoveragePct === 'number' ? `${m.branchCoveragePct.toFixed(1)}%` : '—'
    L.push(
      `| \`${m.model}\` | ${m.readable ? 'yes' : 'no'} | ${m.rowCount ?? '—'} | ${span} | ${cov} | ${(m.keyFields ?? []).join(', ') || '—'} | ${m.notes ?? '—'} |`,
    )
  }
  if (Array.isArray(probe.excludedAnalyticCheck) && probe.excludedAnalyticCheck.length > 0) {
    L.push('')
    L.push('## 2. `excludedBranchAnalyticIds` Verification (Phase 1.3)')
    L.push('')
    L.push('| Analytic ID | Active | Code | Name |')
    L.push('|---:|:---:|---|---|')
    for (const a of probe.excludedAnalyticCheck) {
      L.push(`| ${a.id} | ${a.active ? 'yes' : 'no'} | ${a.code || '—'} | ${a.name} |`)
    }
  }
  L.push('')
  return L.join('\n')
}

async function runPhase21ModelProbe({ baseUrl, db, login, apiKey, redact }) {
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

  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, a, k = {}) => {
    assertReadOnlyOdooMethod(method)
    return rpc('object', 'execute_kw', [db, uid, apiKey, model, method, a, k])
  }

  const specs = [
    { model: 'hr.attendance', dateField: 'check_in', branchField: 'employee_id', wantedFields: ['employee_id', 'check_in', 'check_out', 'worked_hours'] },
    { model: 'hr.employee', dateField: null, branchField: 'work_location_id', wantedFields: ['name', 'active', 'department_id', 'work_location_id', 'company_id'] },
    { model: 'stock.move', dateField: 'date', branchField: 'location_dest_id', wantedFields: ['product_id', 'location_id', 'location_dest_id', 'quantity', 'product_uom_qty', 'state', 'date'] },
    { model: 'stock.scrap', dateField: 'date_done', branchField: 'location_id', wantedFields: ['product_id', 'location_id', 'scrap_qty', 'state', 'date_done'] },
    { model: 'stock.quant', dateField: null, branchField: 'location_id', wantedFields: ['product_id', 'location_id', 'quantity', 'value'] },
    { model: 'mrp.bom', dateField: null, branchField: null, wantedFields: ['product_tmpl_id', 'product_id', 'product_qty', 'active', 'bom_line_ids'] },
    { model: 'mrp.bom.line', dateField: null, branchField: null, wantedFields: ['bom_id', 'product_id', 'product_qty', 'product_uom_id'] },
    { model: 'pos.payment', dateField: 'payment_date', branchField: 'session_id', wantedFields: ['pos_order_id', 'session_id', 'payment_method_id', 'amount', 'payment_date'] },
  ]

  const models = []
  for (const spec of specs) {
    try {
      const fieldsMeta = await kw(spec.model, 'fields_get', [spec.wantedFields], { attributes: ['type', 'string'] })
      const keyFields = Object.keys(fieldsMeta || {})
      const rowCount = await kw(spec.model, 'search_count', [[]])
      let dateSpan = null
      if (spec.dateField && keyFields.includes(spec.dateField) && rowCount > 0) {
        const [minRows, maxRows] = await Promise.all([
          kw(spec.model, 'search_read', [[[spec.dateField, '!=', false]]], {
            fields: [spec.dateField],
            order: `${spec.dateField} asc`,
            limit: 1,
          }),
          kw(spec.model, 'search_read', [[[spec.dateField, '!=', false]]], {
            fields: [spec.dateField],
            order: `${spec.dateField} desc`,
            limit: 1,
          }),
        ])
        dateSpan = {
          min: minRows?.[0]?.[spec.dateField] ?? null,
          max: maxRows?.[0]?.[spec.dateField] ?? null,
        }
      }
      let branchCoveragePct = null
      if (spec.branchField && keyFields.includes(spec.branchField) && rowCount > 0) {
        const withBranch = await kw(spec.model, 'search_count', [[[spec.branchField, '!=', false]]])
        branchCoveragePct = (Number(withBranch) / Number(rowCount)) * 100
      }
      models.push({
        model: spec.model,
        readable: true,
        rowCount,
        keyFields,
        dateSpan,
        branchCoveragePct,
        notes: rowCount === 0 ? '0 records in Odoo' : 'OK',
      })
    } catch (err) {
      models.push({
        model: spec.model,
        readable: false,
        rowCount: null,
        keyFields: [],
        dateSpan: null,
        branchCoveragePct: null,
        notes: redact(err?.message || 'Access denied or model unavailable'),
      })
    }
  }

  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/odoo/pos-registry.json'), 'utf8'))
  let excludedAnalyticCheck = []
  try {
    const ids = registry.excludedBranchAnalyticIds ?? []
    if (ids.length > 0) {
      const rows = await kw('account.analytic.account', 'read', [ids, ['id', 'name', 'code', 'active']], {
        context: { active_test: false },
      })
      excludedAnalyticCheck = rows.map((r) => ({
        id: r.id,
        name: String(r.name ?? ''),
        code: String(r.code ?? ''),
        active: r.active !== false,
      }))
    }
  } catch {
    excludedAnalyticCheck = []
  }

  const probe = {
    generatedAt: new Date().toISOString(),
    models,
    excludedAnalyticCheck,
  }
  const redoDir = path.join(ROOT, 'docs', 'redo')
  fs.mkdirSync(redoDir, { recursive: true })
  fs.writeFileSync(path.join(redoDir, 'odoo-model-probe.json'), `${redact(JSON.stringify(probe, null, 2))}\n`)
  fs.writeFileSync(path.join(redoDir, 'odoo-model-probe.md'), `${redact(renderModelProbeMarkdown(probe))}\n`)
  return probe
}

function captureBoothEraSummaryFixture({ env, redact }) {
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const serverOnlyShim = path.join(__dirname, 'tsx-server-only-shim.cjs')
  const outFixturePath = path.join(ROOT, 'src', 'lib', '__tests__', 'fixtures', 'dashboard-booth-era-live.json')
  const tmpScript = path.join(ROOT, `.tmp-booth-fixture-${process.pid}.mts`)

  const code = `
import fs from 'node:fs';
import { bustOdooLiveCache, fetchLiveOdooSnapshot } from './src/lib/odoo-live-connector';
(async () => {
  bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true });
  const snap = await fetchLiveOdooSnapshot({
    period: 'custom',
    customFrom: '2026-11-01',
    customTo: '2026-11-17',
    forceRefresh: true,
  });
  if (!snap.connected || !snap.summary) {
    throw new Error('Live Odoo snapshot returned disconnected');
  }
  fs.writeFileSync(${JSON.stringify(outFixturePath)}, JSON.stringify(snap.summary, null, 2) + '\\n');
})();
`
  try {
    fs.writeFileSync(tmpScript, code, 'utf8')
    execFileSync(process.execPath, [tsxCli, '-r', serverOnlyShim, tmpScript], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    })
    const sanitized = redact(fs.readFileSync(outFixturePath, 'utf8'))
    fs.writeFileSync(outFixturePath, sanitized)
    return outFixturePath
  } finally {
    if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript)
  }
}

async function main() {
  const requireEnv = process.argv.includes('--require-env')
  const env = { ...loadEnvLocal(), ...process.env }
  const baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '')
  const db = String(env.ODOO_DB || '').trim()
  const login = String(env.ODOO_USERNAME || env.ODOO_LOGIN || env.ODOO_USER || '').trim()
  const apiKey = String(env.ODOO_API_KEY || env.ODOO_PASSWORD || '').trim()
  const password = String(env.ODOO_PASSWORD || '').trim()

  const redact = (msg) => {
    let s = String(msg || '')
    for (const secret of [apiKey, password, login, db, baseUrl]) {
      if (secret && secret.length >= 3) s = s.split(secret).join('[REDACTED]')
    }
    return s.replace(/https?:\/\/[^\s"'<>]+/gi, '[REDACTED_URL]')
  }

  if (!baseUrl || !db || !login || !apiKey) {
    console.log(
      [
        '======================================================================',
        '  AetherBI — Read-Only Mac Odoo Probes (SKIPPED: .env.local absent)',
        '======================================================================',
        '',
        'No live Odoo credentials were found in `.env.local` or process environment.',
        'Per Owner Rule (ANTIGRAVITY-MASTER-PROMPT.md line 73 & 83), nothing was estimated',
        'or invented, and Qurain POS sales remain «غير متاح» until this probe runs.',
        '',
        'Owner steps on the Mac with `.env.local`:',
        '  1. Confirm `.env.local` is in the repo root (untracked by git) with:',
        '     ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY',
        '  2. Run this single read-only command:',
        '     node scripts/run-mac-readonly-probes.mjs',
        '  3. Inspect generated files before committing (zero secrets/PII):',
        '     - src/lib/__tests__/fixtures/dashboard-booth-era-live.json',
        '     - docs/phase-5/qurain-audit-2026-11-01_2026-11-17.{json,md}',
        '     - docs/phase-5/qurain-audit-<month-start>_<today>.{json,md}',
        '     - docs/redo/reconciliation-1-17-nov.md',
        '     - docs/redo/odoo-model-probe.{md,json}',
        '',
      ].join('\n'),
    )
    process.exit(requireEnv ? 2 : 0)
  }

  const todayIso = getKuwaitTodayIso()
  const monthStartIso = `${todayIso.slice(0, 7)}-01`

  console.log('1/4 Capturing booth-era OdooLiveSummary fixture (read-only)...')
  const fixturePath = captureBoothEraSummaryFixture({ env, redact })
  console.log(`  Wrote ${path.relative(ROOT, fixturePath)}`)

  console.log('2/4 Running Qurain Central Kitchen double-count audits (read-only)...')
  const q1 = await runQurainAuditCli({ fromIso: '2026-11-01', toIso: '2026-11-17', envIn: env })
  console.log(`  Wrote ${path.relative(ROOT, q1.outBase)}.{json,md}`)
  if (monthStartIso !== '2026-11-01' || todayIso !== '2026-11-17') {
    const q2 = await runQurainAuditCli({ fromIso: monthStartIso, toIso: todayIso, envIn: env })
    console.log(`  Wrote ${path.relative(ROOT, q2.outBase)}.{json,md}`)
  }

  console.log('3/4 Running 1–17 Nov POS reconciliation vs 66,487.04 KWD (read-only)...')
  const rec = await runPosVarianceCli({
    fromIso: '2026-11-01',
    toIso: '2026-11-17',
    ownerRefKwd: 66487.04,
    writeRedoDoc: true,
    envIn: env,
  })
  console.log(`  Wrote ${path.relative(ROOT, rec.redoDocPath)}`)

  console.log('4/4 Running Phase 2.1 Odoo model coverage probe (read-only)...')
  await runPhase21ModelProbe({ baseUrl, db, login, apiKey, redact })
  console.log('  Wrote docs/redo/odoo-model-probe.{md,json}')
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((err) => {
    console.error('Read-only Mac probe failed:', err?.message || err)
    process.exit(1)
  })
}
