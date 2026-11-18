#!/usr/bin/env node
/**
 * Qurain (Central Kitchen) — read-only double-counting audit, run BEFORE Qurain is added to
 * company POS totals (owner decision 2026-11-18).
 *
 *   node scripts/audit-qurain-double-count.mjs --from 2026-11-01 --to 2026-11-17
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_USERNAME (or ODOO_LOGIN) / ODOO_API_KEY from the environment or
 * `.env.local`. Read-only: authenticate, search_read, read only. Never writes to Odoo and never
 * prints credentials or personal partner PII. Writes docs/phase-5/qurain-audit-<from>_<to>.md and .json.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { kuwaitRangeToOdooUtc } from './lib/pos-variance-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RPC_TIMEOUT_MS = 60_000
const PAGE = 2000
const DUP_WINDOW_MS = 10 * 60_000
const KUWAIT_OFFSET_MS = 3 * 3600_000
const ALLOWED_METHODS = new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])

export const QURAIN_RE =
  /(?:^|[^a-z])(?:al-?)?(?:qurain|qurein|kurain|gurain|qrn\d*)(?![a-z])|(?:^|[\s(«])(?:بال|لل|ال|ب|و|ل)?قرين(?=$|[\s)»،.:-])/i
export const INTERNAL_PAYMENT_RE =
  /staff|employee|internal|transfer|complimentary|comp\b|free|موظف|داخلي|تحويل|ضيافة|مجاني/i
export const SUPPLY_PRODUCT_RE =
  /staff\s*meal|employee\s*meal|transfer|supply|raw\s*material|وجبة\s*موظف|وجبات\s*الموظفين|تحويل|توريد|مواد\s*خام/i
export const OUR_SITES_RE =
  /venture\s*foods|ardiya|avenues|360|assima|promenade|salmiya|kout|npis|faips|fas\b|fahaheel|exhibition|\bexb\b|العارضية|الافنيوز|الأفنيوز|العاصمة|البروميناد|السالمية|الكوت|الفحاحيل|معرض|المعارض|بوث|بوثات/i

const fils = (n) => Math.round((Number(n) || 0) * 1000)
const kwd = (f) => (f / 1000).toFixed(3)
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const m2oName = (v) => (Array.isArray(v) ? String(v[1] ?? '') : '')
const ts = (s) => Date.parse(`${String(s).replace(' ', 'T')}Z`)

export function odooUtcToKuwaitDay(utcDateTime) {
  const ms = ts(utcDateTime)
  if (!Number.isFinite(ms)) return 'unknown'
  return new Date(ms + KUWAIT_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * Redacts personal/customer/employee names using a short SHA-256 digest so zero PII can be
 * committed into `docs/phase-5/qurain-audit-*.json` while keeping deterministic partner matching.
 */
export function redactPartnerIdentity({ partnerId, rawName, isCompany = false, internalReason = null }) {
  if (!partnerId && !rawName) {
    return { partnerId: null, kind: 'walk-in', partnerRef: null, internalReason: null }
  }
  const digest = crypto
    .createHash('sha256')
    .update(`${partnerId ?? 0}:${String(rawName ?? '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 10)
  const kind = internalReason
    ? `internal:${internalReason}`
    : isCompany
      ? 'external-company'
      : 'person-redacted'
  return {
    partnerId: partnerId ?? null,
    kind,
    partnerRef: `partner#${partnerId ?? 0}:${digest}`,
    internalReason,
  }
}

/**
 * @param {{
 *   qurainOrders: Array<Record<string, any>>,
 *   otherCompanyOrders?: Array<Record<string, any>>,
 *   internalPartnerById?: Map<number, string>,
 *   partnerMetaById?: Map<number, { isCompany: boolean, rawName: string }>,
 * }} input
 */
export function classifyQurainAuditOrders({
  qurainOrders,
  otherCompanyOrders = [],
  internalPartnerById = new Map(),
  partnerMetaById = new Map(),
}) {
  const byRef = new Map()
  const byPartnerAmount = new Map()
  const otherOrderIds = new Set()
  let otherBranchesGrossFils = 0
  let otherBranchesNetFils = 0

  for (const o of otherCompanyOrders) {
    if (typeof o.id === 'number') otherOrderIds.add(o.id)
    const gross = fils(o.amount_total)
    const tax = fils(o.amount_tax)
    otherBranchesGrossFils += gross
    otherBranchesNetFils += gross - tax
    if (o.pos_reference) byRef.set(String(o.pos_reference), o)
    const pid = m2oId(o.partner_id)
    if (pid) {
      const key = `${pid}|${gross}`
      const list = byPartnerAmount.get(key) ?? []
      list.push(o)
      byPartnerAmount.set(key, list)
    }
  }

  const buckets = {
    customer: [],
    internalPartner: [],
    internalPayment: [],
    supplyLines: [],
    zeroValue: [],
    duplicate: [],
  }

  for (const o of qurainOrders) {
    const pid = m2oId(o.partner_id)
    const rawPartnerName = partnerMetaById.get(pid)?.rawName ?? m2oName(o.partner_id)
    const isCompany = Boolean(partnerMetaById.get(pid)?.isCompany)
    const internalReason =
      (pid ? internalPartnerById.get(pid) : null) ??
      (rawPartnerName && OUR_SITES_RE.test(rawPartnerName) ? 'named like one of our sites' : null)
    const partnerInfo = redactPartnerIdentity({
      partnerId: pid,
      rawName: rawPartnerName,
      isCompany,
      internalReason,
    })

    const methods = o.methods ?? []
    const products = o.products ?? []
    const grossFils = fils(o.amount_total)
    const taxFils = fils(o.amount_tax)
    const netFils = grossFils - taxFils
    const cfgId = m2oId(o.config_id)
    const cfgName = m2oName(o.config_id) || `pos.config #${cfgId ?? 0}`
    const kuwaitDay = odooUtcToKuwaitDay(o.date_order)

    let dup = o.pos_reference ? byRef.get(String(o.pos_reference)) : null
    if (!dup && pid) {
      dup =
        (byPartnerAmount.get(`${pid}|${grossFils}`) ?? []).find(
          (x) => Math.abs(ts(x.date_order) - ts(o.date_order)) <= DUP_WINDOW_MS,
        ) ?? null
    }

    const row = {
      id: o.id,
      name: o.name,
      pos_reference: o.pos_reference,
      partnerRef: partnerInfo.partnerRef,
      partnerKind: partnerInfo.kind,
      amountFils: grossFils,
      taxFils,
      netFils,
      date_order: o.date_order,
      kuwaitDay,
      configId: cfgId,
      config: cfgName,
      methods,
      products,
    }

    if (dup) {
      buckets.duplicate.push({
        ...row,
        reason: `matches order ${dup.id} on ${m2oName(dup.config_id)}`,
      })
    } else if (internalReason) {
      buckets.internalPartner.push({ ...row, reason: internalReason })
    } else if (methods.length && methods.every((m) => INTERNAL_PAYMENT_RE.test(m))) {
      buckets.internalPayment.push({ ...row, reason: methods.join(', ') })
    } else if (products.length && products.every((p) => SUPPLY_PRODUCT_RE.test(p))) {
      buckets.supplyLines.push({
        ...row,
        reason: 'all lines are supply / transfer / staff-meal products',
      })
    } else if (grossFils === 0) {
      buckets.zeroValue.push({ ...row, reason: 'zero value' })
    } else {
      buckets.customer.push(row)
    }
  }

  const sumRows = (rows) => {
    const gross = rows.reduce((s, r) => s + r.amountFils, 0)
    const net = rows.reduce((s, r) => s + r.netFils, 0)
    return {
      orders: rows.length,
      grossFils: gross,
      netFils: net,
      grossKwd: kwd(gross),
      netKwd: kwd(net),
    }
  }

  const summary = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, sumRows(v)]))

  /** @type {Record<string, { orders: number, grossFils: number, netFils: number, grossKwd: number, netKwd: number }>} */
  const byDay = {}
  /** @type {Record<string, { configId: number | null, configName: string, orders: number, grossFils: number, netFils: number, grossKwd: number, netKwd: number }>} */
  const byConfig = {}
  for (const r of buckets.customer) {
    const d = byDay[r.kuwaitDay] ?? { orders: 0, grossFils: 0, netFils: 0 }
    d.orders += 1
    d.grossFils += r.amountFils
    d.netFils += r.netFils
    byDay[r.kuwaitDay] = { ...d, grossKwd: kwd(d.grossFils), netKwd: kwd(d.netFils) }

    const ck = String(r.configId ?? 'unknown')
    const c = byConfig[ck] ?? {
      configId: r.configId,
      configName: r.config,
      orders: 0,
      grossFils: 0,
      netFils: 0,
    }
    c.orders += 1
    c.grossFils += r.amountFils
    c.netFils += r.netFils
    byConfig[ck] = { ...c, grossKwd: kwd(c.grossFils), netKwd: kwd(c.netFils) }
  }

  const customerOrderIds = buckets.customer.map((r) => r.id).sort((a, b) => a - b)
  const uniqueCustomerIds = new Set(customerOrderIds)
  const overlappingOrderIdsWithBranches = customerOrderIds.filter((id) => otherOrderIds.has(id))
  const qurainCustomerNetFils = summary.customer.netFils
  const candidateHeadlineNetFils = otherBranchesNetFils + qurainCustomerNetFils

  return {
    summary,
    customer: {
      orderIds: customerOrderIds,
      orders: buckets.customer,
      byDay,
      byConfig,
    },
    filtered: {
      internalPartner: buckets.internalPartner,
      internalPayment: buckets.internalPayment,
      supplyLines: buckets.supplyLines,
      zeroValue: buckets.zeroValue,
      duplicate: buckets.duplicate,
    },
    companyComparison: {
      otherBranchesOrders: otherCompanyOrders.length,
      otherBranchesGrossFils,
      otherBranchesNetFils,
      otherBranchesNetKwd: kwd(otherBranchesNetFils),
      qurainCustomerOrders: buckets.customer.length,
      qurainCustomerNetFils,
      qurainCustomerNetKwd: kwd(qurainCustomerNetFils),
      candidateHeadlineNetFils,
      candidateHeadlineNetKwd: kwd(candidateHeadlineNetFils),
    },
    integrity: {
      hasDuplicateOrderIds: uniqueCustomerIds.size !== customerOrderIds.length,
      overlappingOrderIdsWithBranches,
    },
  }
}

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

export async function runQurainAuditCli({ fromIso, toIso, envIn = process.env } = {}) {
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
  const companyIds = new Set(registry.allowedPosConfigIds)

  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, a, k = {}) => {
    if (!ALLOWED_METHODS.has(method)) {
      throw new Error(`Blocked non-read-only Odoo method: ${method}`)
    }
    return rpc('object', 'execute_kw', [db, uid, apiKey, model, method, a, k])
  }
  const searchAll = async (model, domain, fields) => {
    const out = []
    for (let offset = 0; ; offset += PAGE) {
      const rows = await kw(model, 'search_read', [domain], {
        fields,
        limit: PAGE,
        offset,
        order: 'id asc',
        context: { active_test: false },
      })
      out.push(...rows)
      if (rows.length < PAGE) return out
    }
  }

  const configs = await searchAll('pos.config', [], ['id', 'name', 'active', 'company_id'])
  const activeCompanyIds = new Set(
    configs.filter((c) => c.active !== false && companyIds.has(c.id)).map((c) => c.id),
  )
  const qurainConfigs = configs.filter((c) => QURAIN_RE.test(String(c.name)))
  const qurainIds = new Set(qurainConfigs.map((c) => c.id))

  const { fromUtc, toExclusiveUtc } = kuwaitRangeToOdooUtc(fromIso, toIso)
  const window = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', fromUtc],
    ['date_order', '<', toExclusiveUtc],
  ]
  const orderFields = [
    'id',
    'name',
    'pos_reference',
    'partner_id',
    'amount_total',
    'amount_tax',
    'date_order',
    'config_id',
    'payment_ids',
    'lines',
  ]
  const rawQurainOrders = qurainIds.size
    ? await searchAll('pos.order', [...window, ['session_id.config_id', 'in', [...qurainIds]]], orderFields)
    : []

  const partnerIds = [...new Set(rawQurainOrders.map((o) => m2oId(o.partner_id)).filter(Boolean))]
  const partners = partnerIds.length
    ? await kw('res.partner', 'read', [partnerIds, ['id', 'name', 'is_company', 'user_ids', 'employee_ids']])
    : []
  const companies = await searchAll('res.company', [], ['id', 'partner_id'])
  const companyPartnerIds = new Set(companies.map((c) => m2oId(c.partner_id)).filter(Boolean))

  const internalPartnerById = new Map(
    partners.map((p) => [
      p.id,
      companyPartnerIds.has(p.id)
        ? 'company partner'
        : (p.user_ids?.length ?? 0) > 0
          ? 'user (staff) partner'
          : (p.employee_ids?.length ?? 0) > 0
            ? 'employee partner'
            : OUR_SITES_RE.test(String(p.name))
              ? 'named like one of our sites'
              : null,
    ]),
  )
  const partnerMetaById = new Map(
    partners.map((p) => [p.id, { isCompany: Boolean(p.is_company), rawName: String(p.name ?? '') }]),
  )

  const paymentIds = rawQurainOrders.flatMap((o) => o.payment_ids ?? [])
  const payments = paymentIds.length
    ? await searchAll('pos.payment', [['id', 'in', paymentIds]], ['id', 'pos_order_id', 'payment_method_id', 'amount'])
    : []
  const paymentMethodsByOrder = new Map()
  for (const p of payments) {
    const oid = m2oId(p.pos_order_id)
    const list = paymentMethodsByOrder.get(oid) ?? []
    list.push(m2oName(p.payment_method_id))
    paymentMethodsByOrder.set(oid, list)
  }

  const lineIds = rawQurainOrders.flatMap((o) => o.lines ?? [])
  const lines = lineIds.length
    ? await searchAll('pos.order.line', [['id', 'in', lineIds]], ['id', 'order_id', 'product_id', 'price_subtotal_incl'])
    : []
  const linesByOrder = new Map()
  for (const l of lines) {
    const oid = m2oId(l.order_id)
    const list = linesByOrder.get(oid) ?? []
    list.push(m2oName(l.product_id))
    linesByOrder.set(oid, list)
  }

  const qurainOrders = rawQurainOrders.map((o) => ({
    ...o,
    methods: paymentMethodsByOrder.get(o.id) ?? [],
    products: linesByOrder.get(o.id) ?? [],
  }))

  const otherRegisterIds = [...activeCompanyIds].filter((id) => !qurainIds.has(id))
  const otherCompanyOrders = otherRegisterIds.length
    ? await searchAll(
        'pos.order',
        [...window, ['session_id.config_id', 'in', otherRegisterIds]],
        ['id', 'pos_reference', 'partner_id', 'amount_total', 'amount_tax', 'date_order', 'config_id'],
      )
    : []

  const audit = classifyQurainAuditOrders({
    qurainOrders,
    otherCompanyOrders,
    internalPartnerById,
    partnerMetaById,
  })

  const meta = {
    fromIso,
    toIso,
    generatedAt: new Date().toISOString(),
    qurainConfigs: qurainConfigs.map((c) => ({ id: c.id, name: c.name, active: c.active })),
    comparedAgainstOrders: otherCompanyOrders.length,
    piiRedacted: true,
  }
  const outDir = path.join(ROOT, 'docs', 'phase-5')
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.join(outDir, `qurain-audit-${fromIso}_${toIso}`)
  const jsonPayload = redact(JSON.stringify({ meta, ...audit }, null, 2))
  fs.writeFileSync(`${base}.json`, `${jsonPayload}\n`)

  const md = [
    `# Qurain (Central Kitchen) — double-counting audit ${fromIso} → ${toIso}`,
    '',
    `Generated ${meta.generatedAt} from live Odoo (read-only; personal partner names SHA-256 redacted).`,
    `Qurain registers: ${meta.qurainConfigs.map((c) => `#${c.id} ${c.name}${c.active ? '' : ' (archived)'}`).join(', ') || 'none found'}.`,
    `Compared against ${otherCompanyOrders.length} orders on the active whitelisted company registers.`,
    '',
    '| Bucket | Orders | Gross KWD | Net KWD |',
    '|---|---:|---:|---:|',
    ...Object.entries(audit.summary).map(
      ([k, v]) => `| ${k} | ${v.orders} | ${v.grossKwd} | ${v.netKwd} |`,
    ),
    '',
    `- Other active branches net: **${audit.companyComparison.otherBranchesNetKwd} KWD** (${audit.companyComparison.otherBranchesOrders} orders)`,
    `- Qurain customer candidate net: **${audit.companyComparison.qurainCustomerNetKwd} KWD** (${audit.companyComparison.qurainCustomerOrders} orders)`,
    `- Candidate headline (Σbranches + Qurain): **${audit.companyComparison.candidateHeadlineNetKwd} KWD**`,
    `- Duplicate order IDs across registers: **${audit.integrity.overlappingOrderIdsWithBranches.length}**`,
    '',
    '`customer` is the candidate figure to count once approved by the owner; every other bucket is filtered out with explicit reasons.',
  ].join('\n')
  fs.writeFileSync(`${base}.md`, `${redact(md)}\n`)
  return { meta, ...audit, outBase: base, markdown: md }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href

if (isDirectRun) {
  const fromIso = arg('from', '2026-11-01')
  const toIso = arg('to', '2026-11-17')
  runQurainAuditCli({ fromIso, toIso })
    .then((res) => {
      console.log(res.markdown)
    })
    .catch((err) => {
      console.error('Qurain audit failed:', err?.message || err)
      process.exit(err?.code === 'MISSING_ENV' ? 2 : 1)
    })
}
