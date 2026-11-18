#!/usr/bin/env node
/**
 * Qurain (Central Kitchen) — read-only double-counting audit, run BEFORE Qurain is added to
 * company totals (owner decision 2026-11-18).
 *
 *   node scripts/audit-qurain-double-count.mjs --from 2026-11-01 --to 2026-11-17
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_USERNAME (or ODOO_LOGIN) / ODOO_API_KEY from the environment or
 * `.env.local`. Read-only: authenticate, search_read, read only. Never writes to Odoo and never
 * prints credentials. Writes docs/phase-5/qurain-audit-<from>_<to>.md and .json.
 *
 * What it checks, for every paid/done/invoiced pos.order on a Qurain pos.config in the window:
 *  A. Non-customer orders (filtered out of the "customer sales" figure), by reason:
 *     - internal partner: the customer is one of our own companies / branches / staff
 *       (res.partner linked to a res.company or res.users, or named like one of our sites);
 *     - internal payment method: paid with a staff / internal / transfer / complimentary method;
 *     - supply lines: every line is a raw material / transfer / staff-meal product;
 *     - zero-value orders.
 *  B. Duplicates with another company register (whitelisted pos.config in pos-registry.json):
 *     same pos_reference, or same partner + same amount_total within ±10 minutes.
 * The remainder is reported as "customer sales (candidate)". Nothing is counted in the app until the
 * owner approves this report.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { kuwaitRangeToOdooUtc } from './lib/pos-variance-lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RPC_TIMEOUT_MS = 60_000
const PAGE = 2000
const DUP_WINDOW_MS = 10 * 60_000

const QURAIN_RE = /(?:^|[^a-z])(?:al-?)?(?:qurain|qurein|kurain|gurain|qrn\d*)(?![a-z])|(?:^|[\s(«])(?:بال|لل|ال|ب|و|ل)?قرين(?=$|[\s)»،.:-])/i
const INTERNAL_PAYMENT_RE = /staff|employee|internal|transfer|complimentary|comp\b|free|موظف|داخلي|تحويل|ضيافة|مجاني/i
const SUPPLY_PRODUCT_RE = /staff\s*meal|employee\s*meal|transfer|supply|raw\s*material|وجبة\s*موظف|وجبات\s*الموظفين|تحويل|توريد|مواد\s*خام/i
const OUR_SITES_RE = /venture\s*foods|ardiya|avenues|360|assima|promenade|salmiya|kout|npis|faips|العارضية|الافنيوز|الأفنيوز|العاصمة|البروميناد|السالمية|الكوت/i

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

const fils = (n) => Math.round((Number(n) || 0) * 1000)
const kwd = (f) => (f / 1000).toFixed(3)
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const m2oName = (v) => (Array.isArray(v) ? String(v[1] ?? '') : '')

async function main() {
  const fromIso = arg('from', '2026-11-01')
  const toIso = arg('to', '2026-11-17')
  if (!baseUrl || !db || !login || !apiKey) {
    console.error('Missing ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY (env or .env.local).')
    process.exit(2)
  }
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/odoo/pos-registry.json'), 'utf8'))
  const companyIds = new Set(registry.allowedPosConfigIds)

  const uid = await rpc('common', 'authenticate', [db, login, apiKey, {}])
  if (!uid) throw new Error('Authentication failed')
  const kw = (model, method, a, k = {}) => rpc('object', 'execute_kw', [db, uid, apiKey, model, method, a, k])
  const searchAll = async (model, domain, fields) => {
    const out = []
    for (let offset = 0; ; offset += PAGE) {
      const rows = await kw(model, 'search_read', [domain], { fields, limit: PAGE, offset, order: 'id asc', context: { active_test: false } })
      out.push(...rows)
      if (rows.length < PAGE) return out
    }
  }

  // 1. Qurain registers (active and archived), by name.
  const configs = await searchAll('pos.config', [], ['id', 'name', 'active', 'company_id'])
  const qurainConfigs = configs.filter((c) => QURAIN_RE.test(String(c.name)))
  const qurainIds = new Set(qurainConfigs.map((c) => c.id))

  const { fromUtc, toExclusiveUtc } = kuwaitRangeToOdooUtc(fromIso, toIso)
  const window = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', fromUtc],
    ['date_order', '<', toExclusiveUtc],
  ]
  const orderFields = ['id', 'name', 'pos_reference', 'partner_id', 'amount_total', 'amount_tax', 'date_order', 'config_id', 'payment_ids', 'lines']
  const qurainOrders = qurainIds.size
    ? await searchAll('pos.order', [...window, ['session_id.config_id', 'in', [...qurainIds]]], orderFields)
    : []

  // 2. Partners, payments and lines of those orders.
  const partnerIds = [...new Set(qurainOrders.map((o) => m2oId(o.partner_id)).filter(Boolean))]
  const partners = partnerIds.length ? await kw('res.partner', 'read', [partnerIds, ['id', 'name', 'is_company', 'user_ids', 'employee_ids']]) : []
  const companies = await searchAll('res.company', [], ['id', 'partner_id'])
  const companyPartnerIds = new Set(companies.map((c) => m2oId(c.partner_id)).filter(Boolean))
  const internalPartner = new Map(
    partners.map((p) => [
      p.id,
      companyPartnerIds.has(p.id) ? 'company partner'
        : (p.user_ids?.length ?? 0) > 0 ? 'user (staff) partner'
        : (p.employee_ids?.length ?? 0) > 0 ? 'employee partner'
        : OUR_SITES_RE.test(String(p.name)) ? 'named like one of our sites'
        : null,
    ]),
  )
  const paymentIds = qurainOrders.flatMap((o) => o.payment_ids ?? [])
  const payments = paymentIds.length ? await searchAll('pos.payment', [['id', 'in', paymentIds]], ['id', 'pos_order_id', 'payment_method_id', 'amount']) : []
  const paymentMethodsByOrder = new Map()
  for (const p of payments) {
    const oid = m2oId(p.pos_order_id)
    const list = paymentMethodsByOrder.get(oid) ?? []
    list.push(m2oName(p.payment_method_id))
    paymentMethodsByOrder.set(oid, list)
  }
  const lineIds = qurainOrders.flatMap((o) => o.lines ?? [])
  const lines = lineIds.length ? await searchAll('pos.order.line', [['id', 'in', lineIds]], ['id', 'order_id', 'product_id', 'price_subtotal_incl']) : []
  const linesByOrder = new Map()
  for (const l of lines) {
    const oid = m2oId(l.order_id)
    const list = linesByOrder.get(oid) ?? []
    list.push(m2oName(l.product_id))
    linesByOrder.set(oid, list)
  }

  // 3. Other company registers' orders in the same window, for the duplicate check.
  const others = await searchAll('pos.order', [...window, ['session_id.config_id', 'in', [...companyIds].filter((id) => !qurainIds.has(id))]], ['id', 'pos_reference', 'partner_id', 'amount_total', 'date_order', 'config_id'])
  const byRef = new Map()
  const byPartnerAmount = new Map()
  for (const o of others) {
    if (o.pos_reference) byRef.set(String(o.pos_reference), o)
    const pid = m2oId(o.partner_id)
    if (pid) {
      const key = `${pid}|${fils(o.amount_total)}`
      const list = byPartnerAmount.get(key) ?? []
      list.push(o)
      byPartnerAmount.set(key, list)
    }
  }
  const ts = (s) => Date.parse(`${String(s).replace(' ', 'T')}Z`)

  // 4. Classify each Qurain order.
  const buckets = { customer: [], internalPartner: [], internalPayment: [], supplyLines: [], zeroValue: [], duplicate: [] }
  for (const o of qurainOrders) {
    const pid = m2oId(o.partner_id)
    const methods = paymentMethodsByOrder.get(o.id) ?? []
    const products = linesByOrder.get(o.id) ?? []
    let dup = o.pos_reference ? byRef.get(String(o.pos_reference)) : null
    if (!dup && pid) {
      dup = (byPartnerAmount.get(`${pid}|${fils(o.amount_total)}`) ?? []).find((x) => Math.abs(ts(x.date_order) - ts(o.date_order)) <= DUP_WINDOW_MS) ?? null
    }
    const row = { id: o.id, name: o.name, pos_reference: o.pos_reference, partner: m2oName(o.partner_id), amountFils: fils(o.amount_total), taxFils: fils(o.amount_tax), date_order: o.date_order, config: m2oName(o.config_id), methods, products }
    if (dup) buckets.duplicate.push({ ...row, reason: `matches order ${dup.id} on ${m2oName(dup.config_id)}` })
    else if (pid && internalPartner.get(pid)) buckets.internalPartner.push({ ...row, reason: internalPartner.get(pid) })
    else if (methods.length && methods.every((m) => INTERNAL_PAYMENT_RE.test(m))) buckets.internalPayment.push({ ...row, reason: methods.join(', ') })
    else if (products.length && products.every((p) => SUPPLY_PRODUCT_RE.test(p))) buckets.supplyLines.push({ ...row, reason: 'all lines are supply / transfer / staff-meal products' })
    else if (row.amountFils === 0) buckets.zeroValue.push({ ...row, reason: 'zero value' })
    else buckets.customer.push(row)
  }
  const sum = (rows) => ({ orders: rows.length, grossKwd: kwd(rows.reduce((s, r) => s + r.amountFils, 0)), netKwd: kwd(rows.reduce((s, r) => s + r.amountFils - r.taxFils, 0)) })
  const summary = Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, sum(v)]))

  const meta = { fromIso, toIso, generatedAt: new Date().toISOString(), qurainConfigs: qurainConfigs.map((c) => ({ id: c.id, name: c.name, active: c.active })), comparedAgainstOrders: others.length }
  const outDir = path.join(ROOT, 'docs', 'phase-5')
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.join(outDir, `qurain-audit-${fromIso}_${toIso}`)
  fs.writeFileSync(`${base}.json`, JSON.stringify({ meta, summary, filtered: { ...buckets, customer: undefined } }, null, 2))
  const md = [
    `# Qurain (Central Kitchen) — double-counting audit ${fromIso} → ${toIso}`,
    '',
    `Generated ${meta.generatedAt} from live Odoo (read-only). Qurain registers: ${meta.qurainConfigs.map((c) => `#${c.id} ${c.name}${c.active ? '' : ' (archived)'}`).join(', ') || 'none found'}.`,
    `Compared against ${others.length} orders on the other company registers.`,
    '',
    '| Bucket | Orders | Gross KWD | Net KWD |',
    '|---|---:|---:|---:|',
    ...Object.entries(summary).map(([k, v]) => `| ${k} | ${v.orders} | ${v.grossKwd} | ${v.netKwd} |`),
    '',
    '`customer` is the candidate figure to count; every other bucket is filtered out (see the JSON for each order and its reason).',
  ].join('\n')
  fs.writeFileSync(`${base}.md`, `${md}\n`)
  console.log(md)
}

main().catch((err) => {
  console.error('Qurain audit failed:', redact(err?.message || err))
  process.exit(1)
})
