#!/usr/bin/env tsx
/**
 * Read-only AR aging verification script & testable report parser helpers.
 *
 * Compares Aether BI's due-date aging buckets (`0_30`, `31_60`, `over_60`, `unapplied_credits`, `total`)
 * against either Odoo's `account.report` ("Aged Receivable") if readable via RPC, or an owner-exported
 * CSV/XLSX placed under `local-dropzone/` (`--file <path>`).
 *
 * - Read-only: NEVER writes to Odoo.
 * - Secret-safe: NEVER prints or logs `ODOO_URL`, `ODOO_DB`, logins, or API keys.
 * - Does NOT flip `PER_CUSTOMER_DUE_DATE_AGING_VERIFIED` (remains `false`).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import {
  buildArAgingDomains,
  summarizeArAging,
  type ArAgingBucketKey,
} from '../src/lib/odoo/receivable-aging'
import { isExcludedOdooEntity } from '../src/lib/odoo/excluded-entities'

export interface ArBucketTotals {
  '0_30': number
  '31_60': number
  over_60: number
  unapplied_credits: number
  total: number
}

export type ArComparisonBucketKey = keyof ArBucketTotals

export interface ArBucketComparisonRow {
  bucket: ArComparisonBucketKey
  computedKwd: number
  odooReportKwd: number
  diffKwd: number
  withinTolerance: boolean
}

export interface ArBucketComparisonResult {
  passed: boolean
  toleranceKwd: number
  rows: ArBucketComparisonRow[]
}

const BUCKET_KEYS: readonly ArComparisonBucketKey[] = [
  '0_30',
  '31_60',
  'over_60',
  'unapplied_credits',
  'total',
]

const r3 = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000

/**
 * Compares computed AR bucket totals against Odoo Aged Receivable report totals within `toleranceKwd` (default `0.001` KWD).
 */
export function compareArBucketTotals(
  computed: ArBucketTotals,
  odooReport: ArBucketTotals,
  toleranceKwd = 0.001,
): ArBucketComparisonResult {
  const tolMicros = Math.round(Math.max(0, toleranceKwd) * 1_000_000)
  const rows: ArBucketComparisonRow[] = BUCKET_KEYS.map((bucket) => {
    const computedKwd = r3(computed[bucket])
    const odooReportKwd = r3(odooReport[bucket])
    const diffKwd = r3(computedKwd - odooReportKwd)
    const absDiffMicros = Math.round(Math.abs(computedKwd - odooReportKwd) * 1_000_000)
    return {
      bucket,
      computedKwd,
      odooReportKwd,
      diffKwd,
      withinTolerance: absDiffMicros <= tolMicros,
    }
  })

  return {
    passed: rows.every((row) => row.withinTolerance),
    toleranceKwd,
    rows,
  }
}

type ColumnRole = 'label' | '0_30' | '31_60' | 'over_60' | 'unapplied_credits' | 'total'

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
}

function classifyHeader(raw: unknown): ColumnRole | null {
  const h = normalizeHeader(raw)
  if (!h) return null
  if (/^(?:partner|customer|name|account|العميل|الشريك)$/.test(h)) return 'label'
  if (/^(?:at date|as of|current|not due|في التاريخ|حالي)$/.test(h)) return '0_30'
  if (/^(?:0|1)\s*[-_]\s*30(?:\s*(?:days?|يوما?ً?))?$|^0_30$/.test(h)) return '0_30'
  if (/^31\s*[-_]\s*60(?:\s*(?:days?|يوما?ً?))?$|^31_60$/.test(h)) return '31_60'
  if (
    /^(?:over[_\s-]*60|>\s*60|61\s*[-_]\s*90|91\s*[-_]\s*120|older|>\s*120|over[_\s-]*120|أكثر من 60(?:\s*يوما?ً?)?|أقدم)$/.test(
      h,
    )
  ) {
    return 'over_60'
  }
  if (
    /^(?:unapplied[_\s-]*credits?|unapplied|credits?|دفعات غير مطابقة|رصيد دائن غير مطابق)$/.test(h)
  ) {
    return 'unapplied_credits'
  }
  if (/^(?:total|open[_\s-]*receivable(?:_kwd)?|الإجمالي)$/.test(h)) return 'total'
  return null
}

function parseNumericCell(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  let s = String(raw ?? '').trim()
  if (!s || s === '-' || s === '—') return 0
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  s = s.replace(/kwd|د\.ك|\$|,/gi, '').replace(/\s+/g, '')
  const val = Number(s)
  if (!Number.isFinite(val)) return 0
  return negative ? -Math.abs(val) : val
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsvMatrix(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return lines.map(splitCsvLine)
}

function isTotalLabel(raw: unknown): boolean {
  const s = normalizeHeader(raw)
  return /^(?:total|grand total|الإجمالي|المجموع)$/.test(s)
}

/**
 * Extracts AR bucket totals from tabular Aged Receivable rows (CSV or XLSX matrix).
 * Supports both Odoo native exports (`At Date`, `1 - 30`, `31 - 60`, `61 - 90`, `91 - 120`, `Older`, `Total`)
 * and normalized bucket CSVs (`0_30`, `31_60`, `over_60`, `unapplied_credits`, `total`).
 */
export function parseAgedReceivableReportRows(rows: readonly (readonly unknown[])[]): ArBucketTotals {
  let headerRowIdx = -1
  let columnRoles: (ColumnRole | null)[] = []

  for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
    const roles = rows[r].map(classifyHeader)
    const agingHits = roles.filter(
      (role) =>
        role === '0_30' ||
        role === '31_60' ||
        role === 'over_60' ||
        role === 'unapplied_credits' ||
        role === 'total',
    ).length
    if (agingHits >= 2) {
      headerRowIdx = r
      columnRoles = roles
      break
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('No Aged Receivable aging columns found in export.')
  }

  const hasBucketCols = columnRoles.some(
    (role) => role === '0_30' || role === '31_60' || role === 'over_60',
  )
  if (!hasBucketCols) {
    throw new Error('Aged Receivable export is missing aging bucket columns (0-30 / 31-60 / >60).')
  }

  const hasExplicitUnappliedCol = columnRoles.includes('unapplied_credits')
  const hasExplicitTotalCol = columnRoles.includes('total')

  const dataRows = rows.slice(headerRowIdx + 1).filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
  const totalRow = dataRows.find((r) => r.some((cell, idx) => (columnRoles[idx] === 'label' || idx === 0) && isTotalLabel(cell)))

  if (totalRow) {
    let b0 = 0
    let b31 = 0
    let b60 = 0
    let unapplied = 0
    let explicitTotal = 0

    for (let c = 0; c < columnRoles.length; c += 1) {
      const role = columnRoles[c]
      if (!role || role === 'label') continue
      const val = parseNumericCell(totalRow[c])
      if (role === '0_30') b0 += val
      else if (role === '31_60') b31 += val
      else if (role === 'over_60') b60 += val
      else if (role === 'unapplied_credits') unapplied += val
      else if (role === 'total') explicitTotal += val
    }

    const debitsSum = b0 + b31 + b60
    if (hasExplicitUnappliedCol) {
      if (unapplied > 0 && hasExplicitTotalCol && Math.abs(r3(debitsSum - unapplied - explicitTotal)) <= 0.001) {
        unapplied = -unapplied
      }
    } else if (hasExplicitTotalCol && explicitTotal < debitsSum - 0.0005) {
      unapplied = explicitTotal - debitsSum
    }

    const total = hasExplicitTotalCol ? explicitTotal : debitsSum + unapplied
    return {
      '0_30': r3(b0),
      '31_60': r3(b31),
      over_60: r3(b60),
      unapplied_credits: r3(unapplied),
      total: r3(total),
    }
  }

  let b0 = 0
  let b31 = 0
  let b60 = 0
  let unapplied = 0
  let explicitTotal = 0

  for (const row of dataRows) {
    let row0 = 0
    let row31 = 0
    let row60 = 0
    let rowUnapplied = 0
    let rowTotal = 0

    for (let c = 0; c < columnRoles.length; c += 1) {
      const role = columnRoles[c]
      if (!role || role === 'label') continue
      const val = parseNumericCell(row[c])
      if (role === '0_30') row0 += val
      else if (role === '31_60') row31 += val
      else if (role === 'over_60') row60 += val
      else if (role === 'unapplied_credits') rowUnapplied += val
      else if (role === 'total') rowTotal += val
    }

    if (hasExplicitUnappliedCol) {
      b0 += Math.max(0, row0)
      b31 += Math.max(0, row31)
      b60 += Math.max(0, row60)
      if (row0 < 0) unapplied += row0
      if (row31 < 0) unapplied += row31
      if (row60 < 0) unapplied += row60
      if (
        rowUnapplied > 0 &&
        hasExplicitTotalCol &&
        Math.abs(r3(row0 + row31 + row60 - rowUnapplied - rowTotal)) <= 0.001
      ) {
        unapplied -= rowUnapplied
      } else {
        unapplied += rowUnapplied
      }
    } else {
      for (const [setter, val] of [
        ['0_30', row0],
        ['31_60', row31],
        ['over_60', row60],
      ] as const) {
        if (val < 0) {
          unapplied += val
        } else {
          if (setter === '0_30') b0 += val
          else if (setter === '31_60') b31 += val
          else b60 += val
        }
      }
    }

    if (hasExplicitTotalCol) {
      explicitTotal += rowTotal
    }
  }

  const debitsSum = b0 + b31 + b60
  const total = hasExplicitTotalCol ? explicitTotal : debitsSum + unapplied
  return {
    '0_30': r3(b0),
    '31_60': r3(b31),
    over_60: r3(b60),
    unapplied_credits: r3(unapplied),
    total: r3(total),
  }
}

/**
 * Parses an Aged Receivable CSV export into canonical AR bucket totals (`0_30`, `31_60`, `over_60`, `unapplied_credits`, `total`).
 */
export function parseAgedReceivableReportCsv(csvText: string): ArBucketTotals {
  return parseAgedReceivableReportRows(parseCsvMatrix(csvText))
}

/**
 * Parses an Aged Receivable XLSX/XLS workbook buffer into canonical AR bucket totals.
 */
export function parseAgedReceivableReportXlsx(buffer: Buffer): ArBucketTotals {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('Aged Receivable workbook contains no worksheets.')
  }
  const sheet = wb.Sheets[firstSheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseAgedReceivableReportRows(matrix)
}

interface OdooCreds {
  url: string
  db: string
  login: string
  apiKey: string
}

function loadEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}

function readOdooCreds(): OdooCreds | null {
  const fileEnv = loadEnvFile(path.join(process.cwd(), '.env.local'))
  const get = (k: string) => (process.env[k] || fileEnv[k] || '').trim()
  const url = get('ODOO_URL').replace(/\/+$/, '')
  const db = get('ODOO_DB')
  const login = get('ODOO_USERNAME') || get('ODOO_LOGIN')
  const apiKey = get('ODOO_API_KEY')
  if (!url || !db || !login || !apiKey) return null
  return { url, db, login, apiKey }
}

function createReadOnlyOdooClient(creds: OdooCreds) {
  let rpcId = 0
  let uid: number | null = null

  const rpc = async <T>(service: string, method: string, args: unknown[]): Promise<T> => {
    const res = await fetch(`${creds.url}/jsonrpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        id: ++rpcId,
        params: { service, method, args },
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`)
    const payload = (await res.json()) as { result?: T; error?: { message?: string } }
    if (payload.error) {
      throw new Error(payload.error.message || 'Odoo RPC error')
    }
    return payload.result as T
  }

  const authenticate = async (): Promise<number> => {
    if (uid !== null) return uid
    const authed = await rpc<number | false>('common', 'authenticate', [
      creds.db,
      creds.login,
      creds.apiKey,
      {},
    ])
    if (typeof authed !== 'number' || authed <= 0) {
      throw new Error('Odoo authentication failed')
    }
    uid = authed
    return authed
  }

  return async function executeOdoo<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    const allowedMethods = new Set([
      'search_read',
      'read_group',
      'search_count',
      'fields_get',
      'check_access_rights',
      'read',
    ])
    const allowedReportMethods = new Set(['get_options', 'get_report_informations'])
    const isReadOnlyReportCall = model === 'account.report' && allowedReportMethods.has(method)
    if (!allowedMethods.has(method) && !isReadOnlyReportCall) {
      throw new Error(`Refused non-read-only Odoo method: ${method}`)
    }
    const authedUid = await authenticate()
    return rpc<T>('object', 'execute_kw', [
      creds.db,
      authedUid,
      creds.apiKey,
      model,
      method,
      args,
      kwargs,
    ])
  }
}

type M2O = [number, string] | false
const m2oId = (v: unknown): number | null => (Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null)
const m2oName = (v: unknown): string => (Array.isArray(v) && typeof v[1] === 'string' ? v[1] : '')

async function computeLiveOdooArBuckets(
  executeOdoo: ReturnType<typeof createReadOnlyOdooClient>,
  asOfIso: string,
): Promise<{ companyId: number | null; totals: ArBucketTotals }> {
  const companies = await executeOdoo<{ id: number }[]>(
    'res.company',
    'search_read',
    [[]],
    { fields: ['id'], limit: 1 },
  )
  const companyId = companies?.[0]?.id ?? null
  const arDomain: unknown[][] = [
    ...(companyId !== null ? [['company_id', '=', companyId]] : []),
    ['parent_state', '=', 'posted'],
    ['account_id.account_type', '=', 'asset_receivable'],
    ['reconciled', '=', false],
  ]

  const domains = buildArAgingDomains(arDomain, asOfIso)
  const [debitRowsByBucket, creditRows] = await Promise.all([
    Promise.all(
      domains.debitDomains.map((d) =>
        executeOdoo<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
          'account.move.line',
          'read_group',
          [d.domain, ['amount_residual:sum'], ['account_id']],
          { lazy: false },
        ),
      ),
    ),
    executeOdoo<{ account_id: M2O; amount_residual?: number; __count?: number }[]>(
      'account.move.line',
      'read_group',
      [domains.creditDomain, ['amount_residual:sum'], ['account_id']],
      { lazy: false },
    ),
  ])

  const groupTotal = (
    rows: { account_id: M2O; amount_residual?: number; __count?: number }[],
  ) =>
    rows
      .filter((r) => m2oId(r.account_id) !== null && !isExcludedOdooEntity(m2oName(r.account_id)))
      .reduce(
        (acc, r) => ({
          residualKwd: acc.residualKwd + (Number(r.amount_residual) || 0),
          linesCount: acc.linesCount + Math.max(0, Number(r.__count) || 0),
        }),
        { residualKwd: 0, linesCount: 0 },
      )

  const debitsByBucket = Object.fromEntries(
    domains.debitDomains.map((d, idx) => [d.key, groupTotal(debitRowsByBucket[idx])]),
  ) as Partial<Record<ArAgingBucketKey, { residualKwd: number; linesCount: number }>>

  const aging = summarizeArAging({
    debitsByBucket,
    credits: groupTotal(creditRows),
  })

  const byKey = Object.fromEntries(aging.buckets.map((b) => [b.key, b.residualKwd])) as Record<
    ArAgingBucketKey,
    number
  >

  return {
    companyId,
    totals: {
      '0_30': byKey['0_30'] ?? 0,
      '31_60': byKey['31_60'] ?? 0,
      over_60: byKey.over_60 ?? 0,
      unapplied_credits: aging.unappliedCreditsKwd,
      total: aging.openReceivableKwd,
    },
  }
}

async function probeAccountReportAgedReceivable(
  executeOdoo: ReturnType<typeof createReadOnlyOdooClient>,
  asOfIso: string,
): Promise<{
  modelReadable: boolean
  reportId: number | null
  totals: ArBucketTotals | null
  note: string
}> {
  try {
    const canRead = await executeOdoo<boolean>('account.report', 'check_access_rights', [
      'read',
      false,
    ])
    if (canRead !== true) {
      return {
        modelReadable: false,
        reportId: null,
        totals: null,
        note: 'account.report read access denied; supply --file <local-dropzone export> for offline reconciliation.',
      }
    }
    const reports = await executeOdoo<{ id: number; name?: string }[]>(
      'account.report',
      'search_read',
      [[['name', 'ilike', 'Aged Receivable']]],
      { fields: ['id', 'name'], limit: 5 },
    )
    const hit = reports?.[0]
    if (!hit) {
      return {
        modelReadable: true,
        reportId: null,
        totals: null,
        note: 'Aged Receivable account.report record not found; supply --file <local-dropzone export>.',
      }
    }
    try {
      const options = await executeOdoo<Record<string, unknown>>(
        'account.report',
        'get_options',
        [[hit.id], { date: { date_to: asOfIso, mode: 'single', filter: 'custom' } }],
      )
      const info = await executeOdoo<{
        column_headers_render_data?: { level_col_data?: { name?: string }[][] }
        lines?: { name?: string; columns?: { no_format?: unknown; name?: unknown }[] }[]
      }>('account.report', 'get_report_informations', [[hit.id], options])
      const headerLevels = info?.column_headers_render_data?.level_col_data
      const leafHeaders = headerLevels?.[headerLevels.length - 1]?.map((c) => c.name ?? '') ?? []
      if (leafHeaders.length > 0 && Array.isArray(info?.lines) && info.lines.length > 0) {
        const matrix: unknown[][] = [
          ['Partner', ...leafHeaders],
          ...info.lines.map((ln) => [
            ln.name ?? '',
            ...(ln.columns ?? []).map((col) => col.no_format ?? col.name ?? 0),
          ]),
        ]
        const totals = parseAgedReceivableReportRows(matrix)
        return {
          modelReadable: true,
          reportId: hit.id,
          totals,
          note: `Extracted totals from live account.report #${hit.id} (${hit.name ?? 'Aged Receivable'}).`,
        }
      }
    } catch {
      // Fall through cleanly if account.report RPC helpers differ or are restricted.
    }
    return {
      modelReadable: true,
      reportId: hit.id,
      totals: null,
      note: `Found account.report #${hit.id} (${hit.name ?? 'Aged Receivable'}), but report lines require --file <local-dropzone export>.`,
    }
  } catch {
    return {
      modelReadable: false,
      reportId: null,
      totals: null,
      note: 'account.report unavailable (Community edition or restricted); supply --file <local-dropzone export>.',
    }
  }
}

function resolveInputFilePath(rawFileArg: string): string {
  const candidate = path.resolve(process.cwd(), rawFileArg)
  if (fs.existsSync(candidate)) return candidate
  const dropzoneCandidate = path.resolve(process.cwd(), 'local-dropzone', rawFileArg)
  if (fs.existsSync(dropzoneCandidate)) return dropzoneCandidate
  throw new Error(`AR export file not found: ${rawFileArg}`)
}

function parseCliArgs(argv: readonly string[]): {
  file?: string
  asOf: string
  tolerance: number
} {
  let file: string | undefined
  let asOf = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  let tolerance = 0.001

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file' && argv[i + 1]) {
      file = argv[++i]
    } else if (arg.startsWith('--file=')) {
      file = arg.slice('--file='.length)
    } else if (arg === '--as-of' && argv[i + 1]) {
      asOf = argv[++i]
    } else if (arg.startsWith('--as-of=')) {
      asOf = arg.slice('--as-of='.length)
    } else if (arg === '--tolerance' && argv[i + 1]) {
      tolerance = Number(argv[++i]) || 0.001
    } else if (arg.startsWith('--tolerance=')) {
      tolerance = Number(arg.slice('--tolerance='.length)) || 0.001
    }
  }
  return { file, asOf, tolerance }
}

function printComparisonTable(result: ArBucketComparisonResult): void {
  process.stdout.write(`AR Aging Comparison (tolerance ±${result.toleranceKwd.toFixed(3)} KWD)\n`)
  for (const row of result.rows) {
    const status = row.withinTolerance ? 'PASS' : 'DIFF'
    process.stdout.write(
      `  [${status}] ${row.bucket.padEnd(18)} computed=${row.computedKwd.toFixed(3).padStart(12)}  odoo=${row.odooReportKwd.toFixed(3).padStart(12)}  diff=${row.diffKwd.toFixed(3).padStart(10)}\n`,
    )
  }
}

/**
 * CLI entrypoint for read-only AR aging verification.
 */
export async function runVerifyArAgingCli(argv = process.argv.slice(2)): Promise<number> {
  const args = parseCliArgs(argv)
  let reportTotals: ArBucketTotals | null = null

  if (args.file) {
    const resolved = resolveInputFilePath(args.file)
    const lower = resolved.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      reportTotals = parseAgedReceivableReportXlsx(fs.readFileSync(resolved))
    } else {
      reportTotals = parseAgedReceivableReportCsv(fs.readFileSync(resolved, 'utf8'))
    }
    process.stdout.write(`Loaded Odoo Aged Receivable export: ${path.basename(resolved)}\n`)
  }

  const creds = readOdooCreds()
  if (!creds) {
    if (reportTotals) {
      process.stdout.write(
        `Parsed export bucket totals (as-of ${args.asOf}): ${JSON.stringify(reportTotals)}\n`,
      )
    }
    process.stderr.write(
      'Odoo environment is not configured; cannot compare live Odoo AR buckets. Leaving PER_CUSTOMER_DUE_DATE_AGING_VERIFIED = false.\n',
    )
    return 1
  }

  const executeOdoo = createReadOnlyOdooClient(creds)
  const [{ companyId, totals: computedTotals }, reportProbe] = await Promise.all([
    computeLiveOdooArBuckets(executeOdoo, args.asOf),
    reportTotals ? Promise.resolve(null) : probeAccountReportAgedReceivable(executeOdoo, args.asOf),
  ])

  process.stdout.write(
    `Computed live Odoo AR buckets (companyId=${String(companyId)}, asOf=${args.asOf}): ${JSON.stringify(computedTotals)}\n`,
  )

  if (!reportTotals && reportProbe?.totals) {
    reportTotals = reportProbe.totals
    process.stdout.write(`${reportProbe.note}\n`)
  }

  if (!reportTotals) {
    process.stdout.write(`Odoo account.report probe: ${reportProbe?.note ?? 'unavailable'}\n`)
    process.stderr.write(
      'No Odoo Aged Receivable report baseline available; re-run with --file local-dropzone/<export>.csv|xlsx.\n',
    )
    return 1
  }

  const comparison = compareArBucketTotals(computedTotals, reportTotals, args.tolerance)
  printComparisonTable(comparison)
  process.stdout.write(
    `Verification ${comparison.passed ? 'PASSED' : 'FAILED'} (PER_CUSTOMER_DUE_DATE_AGING_VERIFIED remains false).\n`,
  )
  return comparison.passed ? 0 : 1
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isDirectCli) {
  runVerifyArAgingCli()
    .then((code) => {
      process.exitCode = code
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      process.stderr.write(`verify-ar-aging failed: ${msg}\n`)
      process.exitCode = 1
    })
}
