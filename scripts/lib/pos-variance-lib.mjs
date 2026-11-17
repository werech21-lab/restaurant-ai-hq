/**
 * Phase 5 · Item 6 — pure helpers for the per-register POS variance audit.
 * No I/O here: the CLI (`scripts/audit-pos-variance.mjs`) fetches from Odoo and calls these.
 */

const KUWAIT_OFFSET_HOURS = 3

/** Kuwait calendar day [from, to] (inclusive) -> Odoo UTC `date_order` bounds (`YYYY-MM-DD HH:MM:SS`). */
export function kuwaitRangeToOdooUtc(fromIso, toInclusiveIso) {
  const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ')
  const from = new Date(`${fromIso}T00:00:00Z`)
  from.setUTCHours(from.getUTCHours() - KUWAIT_OFFSET_HOURS)
  const toExcl = new Date(`${toInclusiveIso}T00:00:00Z`)
  toExcl.setUTCDate(toExcl.getUTCDate() + 1)
  toExcl.setUTCHours(toExcl.getUTCHours() - KUWAIT_OFFSET_HOURS)
  return { fromUtc: fmt(from), toExclusiveUtc: fmt(toExcl) }
}

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000

/**
 * Classifies a pos.config id against the positive whitelist in `src/lib/odoo/pos-registry.json`.
 * Returns one of: restaurant | school-canteen | exhibition | not-whitelisted.
 */
export function classifyRegister(configId, registry) {
  const allowed = new Set(registry.allowedPosConfigIds ?? [])
  if (!allowed.has(configId)) return { category: 'not-whitelisted', location: null }
  const loc = registry.registers?.[String(configId)]?.location ?? null
  const unit = loc ? registry.locations?.[loc]?.unit : null
  if (unit === 'exhibition') return { category: 'exhibition', location: loc }
  if (unit === 'canteen') return { category: 'school-canteen', location: loc }
  if (unit === 'restaurant') return { category: 'restaurant', location: loc }
  return { category: 'not-whitelisted', location: loc }
}

/**
 * Builds the per-register breakdown and the candidate totals the dashboard could be showing.
 * @param rows  [{ configId, configName, orders, grossKwd, taxKwd }]
 */
export function buildVarianceReport(rows, registry, { targetVarianceKwd = 1723, toleranceKwd = 1 } = {}) {
  const registers = rows
    .map((r) => {
      const { category, location } = classifyRegister(r.configId, registry)
      const netKwd = r3((r.grossKwd ?? 0) - (r.taxKwd ?? 0))
      return {
        configId: r.configId,
        configName: r.configName ?? `pos.config ${r.configId}`,
        category,
        location,
        orders: Math.round(r.orders ?? 0),
        netKwd,
      }
    })
    .sort((a, b) => a.category.localeCompare(b.category) || b.netKwd - a.netKwd)

  const sumBy = (pred) => r3(registers.filter(pred).reduce((s, r) => s + r.netKwd, 0))
  /** @type {Record<string, { netKwd: number, orders: number, registers: number }>} */
  const byCategory = {}
  for (const c of ['restaurant', 'school-canteen', 'exhibition', 'not-whitelisted']) {
    byCategory[c] = {
      netKwd: sumBy((r) => r.category === c),
      orders: registers.filter((r) => r.category === c).reduce((s, r) => s + r.orders, 0),
      registers: registers.filter((r) => r.category === c).length,
    }
  }

  const totals = {
    allRegisters: sumBy(() => true),
    whitelisted: sumBy((r) => r.category !== 'not-whitelisted'),
    whitelistedExclBooths: sumBy((r) => r.category === 'restaurant' || r.category === 'school-canteen'),
    restaurantsOnly: sumBy((r) => r.category === 'restaurant'),
  }

  const labels = {
    allRegisters: 'All Odoo registers',
    whitelisted: 'Whitelisted (restaurants + canteens + booths)',
    whitelistedExclBooths: 'Restaurants + canteens (booths excluded)',
    restaurantsOnly: 'Restaurants only',
  }
  const keys = Object.keys(totals)
  const gaps = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const diff = r3(totals[keys[i]] - totals[keys[j]])
      gaps.push({
        a: keys[i],
        b: keys[j],
        label: `${labels[keys[i]]} − ${labels[keys[j]]}`,
        diffKwd: diff,
        matchesTarget: Math.abs(Math.abs(diff) - targetVarianceKwd) <= toleranceKwd,
      })
    }
  }
  // Single registers or categories whose net alone explains the target.
  const singleRegisterMatches = registers.filter(
    (r) => Math.abs(Math.abs(r.netKwd) - targetVarianceKwd) <= toleranceKwd,
  )

  return { registers, byCategory, totals, labels, gaps, singleRegisterMatches, targetVarianceKwd, toleranceKwd }
}

const fmt = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function renderVarianceMarkdown(report, meta) {
  const L = []
  L.push(`# POS variance audit — ${meta.fromIso} → ${meta.toIso} (Asia/Kuwait)`)
  L.push('')
  L.push(`Generated ${meta.generatedAt} from live Odoo 17 \`pos.order\` (state paid/done/invoiced), net = amount_total − amount_tax, grouped by \`session_id.config_id\`.`)
  L.push(`Target variance under investigation: **${fmt(report.targetVarianceKwd)} KWD** (match tolerance ±${fmt(report.toleranceKwd)}).`)
  L.push('')
  L.push('## Candidate totals')
  L.push('')
  L.push('| Basis | Net KWD |')
  L.push('|---|---:|')
  for (const [k, v] of Object.entries(report.totals)) L.push(`| ${report.labels[k]} | ${fmt(v)} |`)
  L.push('')
  L.push('## Gaps between bases')
  L.push('')
  L.push('| Gap | KWD | Explains target? |')
  L.push('|---|---:|:---:|')
  for (const g of report.gaps) L.push(`| ${g.label} | ${fmt(g.diffKwd)} | ${g.matchesTarget ? '✅' : ''} |`)
  L.push('')
  L.push('## By category')
  L.push('')
  L.push('| Category | Registers | Orders | Net KWD |')
  L.push('|---|---:|---:|---:|')
  for (const [c, v] of Object.entries(report.byCategory)) L.push(`| ${c} | ${v.registers} | ${v.orders} | ${fmt(v.netKwd)} |`)
  L.push('')
  L.push('## Exhibition booths (أكشاك المعارض) — founder decision required')
  L.push('')
  const booths = report.registers.filter((r) => r.category === 'exhibition')
  if (booths.length === 0) L.push('_No booth sales in this window._')
  else {
    L.push('| pos.config | Register | Orders | Net KWD |')
    L.push('|---:|---|---:|---:|')
    for (const r of booths) L.push(`| ${r.configId} | ${r.configName} | ${r.orders} | ${fmt(r.netKwd)} |`)
    L.push('')
    L.push(`Booths total **${fmt(report.byCategory.exhibition.netKwd)} KWD**. Decide: include booths in active totals (current registry behaviour) or report them separately.`)
  }
  L.push('')
  L.push('## Every register')
  L.push('')
  L.push('| pos.config | Register | Category | Location | Orders | Net KWD |')
  L.push('|---:|---|---|---|---:|---:|')
  for (const r of report.registers)
    L.push(`| ${r.configId} | ${r.configName} | ${r.category} | ${r.location ?? '—'} | ${r.orders} | ${fmt(r.netKwd)} |`)
  if (report.singleRegisterMatches.length > 0) {
    L.push('')
    L.push('## Single registers whose net alone ≈ target')
    for (const r of report.singleRegisterMatches) L.push(`- pos.config ${r.configId} ${r.configName}: ${fmt(r.netKwd)} KWD`)
  }
  L.push('')
  return L.join('\n')
}
