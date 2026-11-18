#!/usr/bin/env node
/**
 * Standalone Read-Only Live Odoo Model Probe (`scripts/probe-odoo-models.mjs` — Phase 2.1 · F2)
 *
 *   node scripts/probe-odoo-models.mjs
 *   node scripts/probe-odoo-models.mjs --write-baseline
 *
 * Strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read` ONLY).
 * Never prints, logs, or commits credentials, URLs, usernames, or API keys.
 *
 * Probes all 8 required advisor-council models:
 *   1. `hr.attendance`
 *   2. `hr.employee` (`work_location_id` / `department_id`)
 *   3. `stock.move` (`location_id` / `location_dest_id`)
 *   4. `stock.scrap` (`location_id`)
 *   5. `stock.quant` (`location_id`)
 *   6. `mrp.bom`
 *   7. `mrp.bom.line`
 *   8. `pos.payment` (`session_id -> config_id` × `payment_date:hour` × `payment_method_id`)
 *
 * When `.env.local` is absent, exits cleanly with code 0 (unless `--require-env` -> code 2) and
 * prints clear owner `.env.local` instructions. With `--write-baseline`, writes `docs/redo/odoo-model-probe.md`
 * from verified real cached Odoo exports (`dashboard-today-2026-11-17.json` + Oct 31 export inventory)
 * with every unprobed live metric marked `غير متاح — بانتظار تشغيل فحص المالك على Mac`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(__dirname, '..')
const RPC_TIMEOUT_MS = 30_000
const PENDING_AR = 'غير متاح — بانتظار تشغيل فحص المالك على Mac'

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

export const PROBED_MODEL_SPECS = [
  {
    model: 'hr.attendance',
    dateField: 'check_in',
    branchField: 'employee_id.work_location_id',
    wantedFields: ['employee_id', 'check_in', 'check_out', 'worked_hours', 'create_date'],
  },
  {
    model: 'hr.employee',
    dateField: 'create_date',
    branchField: 'work_location_id',
    wantedFields: ['active', 'department_id', 'work_location_id', 'company_id', 'create_date'],
  },
  {
    model: 'stock.move',
    dateField: 'date',
    branchField: 'location_id / location_dest_id',
    wantedFields: ['product_id', 'location_id', 'location_dest_id', 'quantity', 'product_uom_qty', 'state', 'date', 'create_date'],
  },
  {
    model: 'stock.scrap',
    dateField: 'date_done',
    branchField: 'location_id',
    wantedFields: ['product_id', 'location_id', 'scrap_qty', 'state', 'date_done', 'create_date'],
  },
  {
    model: 'stock.quant',
    dateField: 'in_date',
    branchField: 'location_id',
    wantedFields: ['product_id', 'location_id', 'quantity', 'value', 'in_date', 'create_date'],
  },
  {
    model: 'mrp.bom',
    dateField: 'create_date',
    branchField: null,
    wantedFields: ['product_tmpl_id', 'product_id', 'product_qty', 'active', 'bom_line_ids', 'create_date'],
  },
  {
    model: 'mrp.bom.line',
    dateField: 'create_date',
    branchField: null,
    wantedFields: ['bom_id', 'product_id', 'product_qty', 'product_uom_id', 'create_date'],
  },
  {
    model: 'pos.payment',
    dateField: 'payment_date',
    branchField: 'session_id -> config_id',
    wantedFields: ['pos_order_id', 'session_id', 'payment_method_id', 'amount', 'payment_date', 'create_date'],
  },
]

export function loadEnvLocal(rootDir = DEFAULT_ROOT) {
  const f = path.join(rootDir, '.env.local')
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

function fmtInt(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : null
}

/**
 * Builds a deterministic, zero-invented-numbers baseline probe summary strictly from real cached
 * repo exports (`dashboard-today-2026-11-17.json` + `venturefoods_odoo_cids1_dump.json` + `pos-registry.json`).
 */
export function buildCachedBaselineProbeReport({ rootDir = DEFAULT_ROOT } = {}) {
  const dumpPath = path.join(rootDir, 'database', 'seeds', 'venturefoods_odoo_cids1_dump.json')
  const dashPath = path.join(rootDir, 'src', 'lib', '__tests__', 'fixtures', 'dashboard-today-2026-11-17.json')
  const regPath = path.join(rootDir, 'src', 'lib', 'odoo', 'pos-registry.json')

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'))
  const dash = JSON.parse(fs.readFileSync(dashPath, 'utf8')).summary
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'))

  const att = dump.models['hr.attendance'] ?? []
  const emp = dump.models['hr.employee'] ?? []
  const quants = dump.models['stock.quant'] ?? []

  const attDates = att.map((r) => r.check_in).filter(Boolean).sort()
  const empWithDept = emp.filter((e) => Array.isArray(e.department_id)).length
  const empDeptPct = emp.length > 0 ? ((empWithDept / emp.length) * 100).toFixed(1) : '0.0'

  const internalQuants = quants.filter(
    (q) =>
      Array.isArray(q.location_id) &&
      !String(q.location_id[1]).startsWith('Partners/') &&
      !String(q.location_id[1]).startsWith('Virtual Locations/'),
  )
  const qrnQuants = quants.filter((q) => Array.isArray(q.location_id) && String(q.location_id[1]).startsWith('QRN/'))
  const internalQuantPct = quants.length > 0 ? ((internalQuants.length / quants.length) * 100).toFixed(1) : '0.0'

  const dailyByBranchDays = Object.keys(dash.dailyByBranch ?? {}).sort()
  const posSpanText =
    dailyByBranchDays.length > 0
      ? `Cached daily series: ${dailyByBranchDays[0]} → ${dailyByBranchDays[dailyByBranchDays.length - 1]}; full live span: ${PENDING_AR}`
      : PENDING_AR

  const models = [
    {
      model: 'hr.attendance',
      readableText: 'yes (Oct 31 cached sample)',
      totalRowsText: `${PENDING_AR} (Oct 31 sample: ${fmtInt(att.length)} rows, 1,000-row cap)`,
      recent30dText: PENDING_AR,
      dateSpanText:
        attDates.length > 0
          ? `Sample: ${attDates[0]} → ${attDates[attDates.length - 1]} UTC (full span: ${PENDING_AR})`
          : PENDING_AR,
      branchCoverageText: `0.0% in cached sample (live work_location_id link: ${PENDING_AR})`,
      keyFields: Object.keys(att[0] ?? {}),
      notes: 'Exported without work_location_id link; closed=865, open=135 in 1,000-row sample.',
    },
    {
      model: 'hr.employee',
      readableText: 'yes (Oct 31 cached export)',
      totalRowsText: `${fmtInt(emp.length)} (Oct 31 export; live count: ${PENDING_AR})`,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: `${PENDING_AR} (department_id present on ${empWithDept}/${emp.length} = ${empDeptPct}%)`,
      keyFields: Object.keys(emp[0] ?? {}).filter((f) => f !== 'name' && f !== 'work_email'),
      notes: 'work_location_id was not included in the Oct 31 export; live fields_get probe required.',
    },
    {
      model: 'stock.move',
      readableText: PENDING_AR,
      totalRowsText: PENDING_AR,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: PENDING_AR,
      keyFields: [],
      notes: `Not included in Oct 31 export — ${PENDING_AR} (needed for Qurain QRN/Stock transfers vs branch receipts).`,
    },
    {
      model: 'stock.scrap',
      readableText: PENDING_AR,
      totalRowsText: PENDING_AR,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: PENDING_AR,
      keyFields: [],
      notes: `Not included in Oct 31 export — ${PENDING_AR}.`,
    },
    {
      model: 'stock.quant',
      readableText: 'yes (Oct 31 cached sample)',
      totalRowsText: `${PENDING_AR} (Oct 31 sample: ${fmtInt(quants.length)} rows, 1,000-row cap)`,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: `${internalQuantPct}% internal (${internalQuants.length}/${quants.length}, incl. ${qrnQuants.length} QRN/Stock rows; full live: ${PENDING_AR})`,
      keyFields: Object.keys(quants[0] ?? {}),
      notes: `Stale Oct 31 sample dropped from all prod paths; live stock.quant value/totalCount: ${PENDING_AR}.`,
    },
    {
      model: 'mrp.bom',
      readableText: PENDING_AR,
      totalRowsText: PENDING_AR,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: 'N/A (company recipes)',
      keyFields: [],
      notes: `Not in Oct 31 export — ${PENDING_AR}. service.ts checks totalCount (not just 30d create_date) so older BoMs are detected.`,
    },
    {
      model: 'mrp.bom.line',
      readableText: PENDING_AR,
      totalRowsText: PENDING_AR,
      recent30dText: PENDING_AR,
      dateSpanText: PENDING_AR,
      branchCoverageText: 'N/A (recipe components)',
      keyFields: [],
      notes: `Not in Oct 31 export — ${PENDING_AR}.`,
    },
    {
      model: 'pos.payment',
      readableText: 'yes (Nov 17 live sync payload)',
      totalRowsText: PENDING_AR,
      recent30dText: PENDING_AR,
      dateSpanText: posSpanText,
      branchCoverageText: PENDING_AR,
      keyFields: ['session_id', 'payment_method_id', 'amount', 'payment_date'],
      notes: `5-week (config × hour × method) read_group live row count & coverage: ${PENDING_AR}; ${reg.allowedPosConfigIds.length} whitelisted registers in pos-registry.json.`,
    },
  ]

  return {
    mode: 'cached-baseline',
    generatedAt: dash.lastSyncAt ?? dump.exportedAt,
    cachedSources: {
      dashboardPayloadSyncAt: dash.lastSyncAt,
      seedExportedAt: dump.exportedAt,
      whitelistedPosConfigsCount: reg.allowedPosConfigIds.length,
    },
    models,
  }
}

export function renderModelProbeMarkdown(probe) {
  const L = []
  const isBaseline = probe.mode === 'cached-baseline'
  L.push('# Odoo 17 Read-Only Model Probe (Phase 2.1 · F2)')
  L.push('')
  L.push(`- **Mode**: ${isBaseline ? `Verified cached baseline (${PENDING_AR})` : 'Live read-only Odoo 17 RPC probe'}`)
  L.push(`- **Reference timestamp**: \`${probe.generatedAt}\``)
  L.push('- **RPC policy**: strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read`) — zero writes, zero credentials logged')
  if (isBaseline && probe.cachedSources) {
    L.push(
      `- **Verified cached inputs**: \`dashboard-today-2026-11-17.json\` (\`${probe.cachedSources.dashboardPayloadSyncAt}\`), \`venturefoods_odoo_cids1_dump.json\` (\`${probe.cachedSources.seedExportedAt}\`, test/audit baseline only — removed from prod paths), \`pos-registry.json\` (${probe.cachedSources.whitelistedPosConfigsCount} whitelisted registers)`,
    )
  }
  L.push('')
  L.push('## 1. Model Coverage Summary (8 Required Advisor Council Models)')
  L.push('')

  if (isBaseline) {
    L.push('| Model | Readable | Total Rows (`search_count([])`) | 30d Recent Rows | Date Span (`min → max`) | % With Branch / Location | Verified Fields | Notes |')
    L.push('|---|:---:|---|---|---|---|---|---|')
    for (const m of probe.models ?? []) {
      L.push(
        `| \`${m.model}\` | ${m.readableText} | ${m.totalRowsText} | ${m.recent30dText} | ${m.dateSpanText} | ${m.branchCoverageText} | ${(m.keyFields ?? []).join(', ') || PENDING_AR} | ${m.notes ?? '—'} |`,
      )
    }
    L.push('')
    L.push('## 2. Owner Action on Mac (Live Read-Only Capture)')
    L.push('')
    L.push('When `.env.local` (`ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`) is present in the repo root on the Mac, run:')
    L.push('')
    L.push('```bash')
    L.push('node scripts/probe-odoo-models.mjs')
    L.push('# or run all read-only Phase 1 & Phase 2 Mac probes together:')
    L.push('node scripts/run-mac-readonly-probes.mjs')
    L.push('```')
    L.push('')
    L.push('This overwrites `docs/redo/odoo-model-probe.md` and `docs/redo/odoo-model-probe.json` with live read-only counts, date spans, and branch coverage percentages (with automatic secret redaction).')
    L.push('')
    return L.join('\n')
  }

  L.push('| Model | Readable | Total Rows | 30d Recent Rows | Date Span | % With Branch / Location | Key Fields Present | Notes |')
  L.push('|---|:---:|---:|---:|---|---:|---|---|')
  for (const m of probe.models ?? []) {
    const span = m.dateSpan ? `${m.dateSpan.min ?? '—'} → ${m.dateSpan.max ?? '—'}` : '—'
    const cov = typeof m.branchCoveragePct === 'number' ? `${m.branchCoveragePct.toFixed(1)}%` : '—'
    const rec = typeof m.recentCount === 'number' ? fmtInt(m.recentCount) : '—'
    const tot = typeof m.rowCount === 'number' ? fmtInt(m.rowCount) : '—'
    L.push(
      `| \`${m.model}\` | ${m.readable ? 'yes' : 'no'} | ${tot} | ${rec} | ${span} | ${cov} | ${(m.keyFields ?? []).join(', ') || '—'} | ${m.notes ?? '—'} |`,
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

export async function runLiveOdooModelProbe({ baseUrl, db, login, apiKey, redact, rootDir = DEFAULT_ROOT, nowMs = Date.now() }) {
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
  const safeCount = async (model, domain) => {
    try {
      return Number(await kw(model, 'search_count', [domain])) || 0
    } catch {
      return null
    }
  }

  const since30d = new Date(nowMs - 30 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
  let empHasWorkLoc = false
  let empWorkLocCount = 0
  try {
    const empMeta = await kw('hr.employee', 'fields_get', [['work_location_id']], { attributes: ['type'] })
    if (empMeta && 'work_location_id' in empMeta) {
      empHasWorkLoc = true
      empWorkLocCount = (await safeCount('hr.employee', [['work_location_id', '!=', false]])) ?? 0
    }
  } catch {
    empHasWorkLoc = false
  }

  const models = []
  for (const spec of PROBED_MODEL_SPECS) {
    try {
      const fieldsMeta = await kw(spec.model, 'fields_get', [spec.wantedFields], { attributes: ['type', 'string'] })
      const keyFields = Object.keys(fieldsMeta || {})
      const rowCount = Number(await kw(spec.model, 'search_count', [[]])) || 0
      const recentDateField =
        spec.dateField && keyFields.includes(spec.dateField)
          ? spec.dateField
          : keyFields.includes('create_date')
            ? 'create_date'
            : null
      const recentCount =
        recentDateField && rowCount > 0 ? await safeCount(spec.model, [[recentDateField, '>=', since30d]]) : rowCount === 0 ? 0 : null

      let dateSpan = null
      if (spec.dateField && keyFields.includes(spec.dateField) && rowCount > 0) {
        const [minRows, maxRows] = await Promise.all([
          kw(spec.model, 'search_read', [[[spec.dateField, '!=', false]]], {
            fields: [spec.dateField],
            order: `${spec.dateField} asc`,
            limit: 1,
          }).catch(() => []),
          kw(spec.model, 'search_read', [[[spec.dateField, '!=', false]]], {
            fields: [spec.dateField],
            order: `${spec.dateField} desc`,
            limit: 1,
          }).catch(() => []),
        ])
        dateSpan = {
          field: spec.dateField,
          min: minRows?.[0]?.[spec.dateField] ?? null,
          max: maxRows?.[0]?.[spec.dateField] ?? null,
        }
      }

      let branchCoveragePct = null
      const notesParts = []
      if (rowCount === 0) {
        notesParts.push('0 records in Odoo')
      }

      if (spec.model === 'hr.employee') {
        branchCoveragePct = rowCount > 0 && keyFields.includes('work_location_id') ? (empWorkLocCount / rowCount) * 100 : 0
        if (rowCount > 0 && keyFields.includes('department_id')) {
          const deptCnt = (await safeCount('hr.employee', [['department_id', '!=', false]])) ?? 0
          notesParts.push(`department_id=${((deptCnt / rowCount) * 100).toFixed(1)}%`)
        }
      } else if (spec.model === 'hr.attendance') {
        if (rowCount === 0 || !empHasWorkLoc || empWorkLocCount === 0) {
          branchCoveragePct = 0
        } else {
          const cnt = (await safeCount('hr.attendance', [['employee_id.work_location_id', '!=', false]])) ?? 0
          branchCoveragePct = (cnt / rowCount) * 100
        }
      } else if (spec.model === 'stock.move' && rowCount > 0) {
        const cnt =
          (await safeCount('stock.move', ['|', ['location_id', '!=', false], ['location_dest_id', '!=', false]])) ??
          (await safeCount('stock.move', [['location_dest_id', '!=', false]])) ??
          0
        branchCoveragePct = (cnt / rowCount) * 100
      } else if (spec.model === 'stock.scrap' && rowCount > 0 && keyFields.includes('location_id')) {
        const cnt = (await safeCount('stock.scrap', [['location_id', '!=', false]])) ?? 0
        branchCoveragePct = (cnt / rowCount) * 100
      } else if (spec.model === 'stock.quant' && rowCount > 0 && keyFields.includes('location_id')) {
        const cnt =
          (await safeCount('stock.quant', [['location_id.usage', '=', 'internal']])) ??
          (await safeCount('stock.quant', [['location_id', '!=', false]])) ??
          0
        branchCoveragePct = (cnt / rowCount) * 100
        notesParts.push('internal stock locations %')
      } else if (spec.model === 'pos.payment' && rowCount > 0 && keyFields.includes('session_id')) {
        const cnt =
          (await safeCount('pos.payment', [['session_id.config_id', '!=', false]])) ??
          (await safeCount('pos.payment', [['session_id', '!=', false]])) ??
          0
        branchCoveragePct = (cnt / rowCount) * 100
        try {
          const grp = await kw(
            'pos.payment',
            'read_group',
            [[['payment_date', '!=', false]], ['amount:sum'], ['session_id', 'payment_method_id', 'payment_date:hour']],
            { lazy: false, limit: 3, context: { tz: 'Asia/Kuwait' } },
          )
          const sid = Array.isArray(grp?.[0]?.session_id) ? grp[0].session_id[0] : null
          if (sid) {
            const sess = await kw('pos.session', 'read', [[sid], ['config_id']])
            notesParts.push(
              Array.isArray(sess?.[0]?.config_id)
                ? 'config × hour × method read_group OK'
                : 'session read missing config_id',
            )
          }
        } catch {
          notesParts.push('config × hour × method read_group failed')
        }
      }

      models.push({
        model: spec.model,
        readable: true,
        rowCount,
        recentCount,
        keyFields,
        dateSpan,
        branchCoveragePct,
        notes: notesParts.join('; ') || 'OK',
      })
    } catch (err) {
      models.push({
        model: spec.model,
        readable: false,
        rowCount: null,
        recentCount: null,
        keyFields: [],
        dateSpan: null,
        branchCoveragePct: null,
        notes: redact(err?.message || 'Access denied or model unavailable'),
      })
    }
  }

  const registry = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/lib/odoo/pos-registry.json'), 'utf8'))
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
    mode: 'live',
    generatedAt: new Date(nowMs).toISOString(),
    models,
    excludedAnalyticCheck,
  }
  const redoDir = path.join(rootDir, 'docs', 'redo')
  fs.mkdirSync(redoDir, { recursive: true })
  fs.writeFileSync(path.join(redoDir, 'odoo-model-probe.json'), `${redact(JSON.stringify(probe, null, 2))}\n`)
  fs.writeFileSync(path.join(redoDir, 'odoo-model-probe.md'), `${redact(renderModelProbeMarkdown(probe))}\n`)
  return probe
}

async function main() {
  const requireEnv = process.argv.includes('--require-env')
  const writeBaseline = process.argv.includes('--write-baseline')
  const env = { ...loadEnvLocal(DEFAULT_ROOT), ...process.env }
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
    const redoDir = path.join(DEFAULT_ROOT, 'docs', 'redo')
    const mdPath = path.join(redoDir, 'odoo-model-probe.md')
    if (writeBaseline || !fs.existsSync(mdPath)) {
      fs.mkdirSync(redoDir, { recursive: true })
      const baseline = buildCachedBaselineProbeReport({ rootDir: DEFAULT_ROOT })
      fs.writeFileSync(mdPath, `${renderModelProbeMarkdown(baseline)}\n`, 'utf8')
    }
    console.log(
      [
        '======================================================================',
        '  AetherBI — Phase 2.1 Read-Only Odoo Model Probe (.env.local absent)',
        '======================================================================',
        '',
        'No live Odoo credentials were found in `.env.local` or process environment.',
        `Unprobed live metrics remain marked «${PENDING_AR}» with zero invented counts.`,
        '',
        'Owner steps on the Mac with `.env.local`:',
        '  1. Confirm `.env.local` exists in the repo root (untracked by git) with:',
        '     ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY',
        '  2. Run this standalone read-only probe:',
        '     node scripts/probe-odoo-models.mjs',
        '  3. Review generated artifacts (zero secrets/PII):',
        '     - docs/redo/odoo-model-probe.md',
        '     - docs/redo/odoo-model-probe.json',
        '',
      ].join('\n'),
    )
    process.exit(requireEnv ? 2 : 0)
  }

  await runLiveOdooModelProbe({ baseUrl, db, login, apiKey, redact, rootDir: DEFAULT_ROOT })
  console.log('Wrote docs/redo/odoo-model-probe.{md,json}')
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  main().catch((err) => {
    console.error('Read-only Odoo model probe failed:', err?.message || err)
    process.exit(1)
  })
}
