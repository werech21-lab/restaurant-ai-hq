/**
 * Phase 1.5 (C7) & Phase 5 · Item 6 — pure helpers for the per-register POS variance &
 * owner reconciliation audit (`66,487.040 KWD` owner reference for 1–17 Nov).
 * No I/O here: `scripts/audit-pos-variance.mjs` fetches read-only from Odoo and calls these.
 */

const KUWAIT_OFFSET_HOURS = 3
const EXPLICIT_EXCLUDED_POS_CONFIG_IDS = new Set([24, 25, 39, 40])
const QURAIN_REGISTER_RE =
  /(?:^|[^a-z])(?:al-?)?(?:qurain|qurein|kurain|gurain|qrn\d*)(?![a-z])|قرين|القرين/i
const DECOMMISSIONED_NAME_RE =
  /(?:^|[^a-z])(?:al-?)?(?:jahra|jahara|jhr\d*|heisenberg|heizenberg|hizenberg|heisenburg|haisenberg)(?![a-z])|جهراء|الجهراء|هايزن/i

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
const toFils = (n) => Math.round((Number(n) || 0) * 1000)
const fromFils = (f) => Math.round(f) / 1000

export const RECONCILIATION_BUCKETS = [
  'active-restaurant',
  'school-canteens',
  'exhibition-booths',
  'archived-whitelisted',
  'qurain-central-kitchen',
  'explicit-excluded',
  'unknown-unmapped',
]

/**
 * Classifies a `pos.config` record against `src/lib/odoo/pos-registry.json`, `active` flag,
 * explicit ID exclusions (`24, 25, 39, 40`), and Qurain / Jahra / Heisenberg markers.
 *
 * - Archived whitelisted registers (e.g. `#16`, `#35` when `active === false`) return
 *   `category: 'archived-whitelisted'` so they NEVER silently inflate active `'restaurant'` totals.
 * - Non-whitelisted registers preserve `category: 'not-whitelisted'` while exposing fine-grained
 *   `reconciliationBucket` (`'explicit-excluded'`, `'qurain-central-kitchen'`, `'unknown-unmapped'`).
 */
export function classifyRegister(configId, registry, meta = {}) {
  const active = meta.active !== false
  const name = String(meta.name ?? '')
  const excludedIds = meta.excludedIds ? new Set(meta.excludedIds) : EXPLICIT_EXCLUDED_POS_CONFIG_IDS
  const allowed = new Set(registry.allowedPosConfigIds ?? [])

  if (excludedIds.has(configId) || DECOMMISSIONED_NAME_RE.test(name)) {
    return {
      category: 'not-whitelisted',
      reconciliationBucket: 'explicit-excluded',
      location: null,
      active,
    }
  }

  if (QURAIN_REGISTER_RE.test(name)) {
    return {
      category: 'not-whitelisted',
      reconciliationBucket: 'qurain-central-kitchen',
      location: 'qurain',
      active,
    }
  }

  if (!allowed.has(configId)) {
    return {
      category: 'not-whitelisted',
      reconciliationBucket: 'unknown-unmapped',
      location: null,
      active,
    }
  }

  const loc = registry.registers?.[String(configId)]?.location ?? null
  const unit = loc ? registry.locations?.[loc]?.unit : null

  if (!active) {
    return {
      category: 'archived-whitelisted',
      reconciliationBucket: 'archived-whitelisted',
      location: loc,
      active: false,
    }
  }

  if (unit === 'exhibition') {
    return {
      category: 'exhibition',
      reconciliationBucket: 'exhibition-booths',
      location: loc,
      active: true,
    }
  }
  if (unit === 'canteen') {
    return {
      category: 'school-canteen',
      reconciliationBucket: 'school-canteens',
      location: loc,
      active: true,
    }
  }
  if (unit === 'restaurant') {
    return {
      category: 'restaurant',
      reconciliationBucket: 'active-restaurant',
      location: loc,
      active: true,
    }
  }
  return {
    category: 'not-whitelisted',
    reconciliationBucket: 'unknown-unmapped',
    location: loc,
    active,
  }
}

/**
 * Builds the config-by-config breakdown, candidate totals, and reconciliation against
 * the owner's reference figure (`66,487.04 KWD` by default).
 * @param rows  [{ configId, configName, active?, orders, grossKwd, taxKwd }]
 */
export function buildVarianceReport(
  rows,
  registry,
  { targetVarianceKwd = 242.391, ownerReferenceKwd = 66487.04, toleranceKwd = 1 } = {},
) {
  const registers = rows
    .map((r) => {
      const cls = classifyRegister(r.configId, registry, {
        active: r.active,
        name: r.configName,
      })
      const netFils = toFils(r.grossKwd ?? 0) - toFils(r.taxKwd ?? 0)
      return {
        configId: r.configId,
        configName: r.configName ?? `pos.config ${r.configId}`,
        active: cls.active,
        category: cls.category,
        reconciliationBucket: cls.reconciliationBucket,
        location: cls.location,
        orders: Math.round(r.orders ?? 0),
        grossKwd: r3(r.grossKwd ?? 0),
        taxKwd: r3(r.taxKwd ?? 0),
        netKwd: fromFils(netFils),
        netFils,
      }
    })
    .sort(
      (a, b) =>
        RECONCILIATION_BUCKETS.indexOf(a.reconciliationBucket) -
          RECONCILIATION_BUCKETS.indexOf(b.reconciliationBucket) ||
        b.netFils - a.netFils ||
        a.configId - b.configId,
    )

  const sumFils = (pred) => registers.filter(pred).reduce((s, r) => s + r.netFils, 0)
  const sumBy = (pred) => fromFils(sumFils(pred))

  /** @type {Record<string, { netKwd: number, orders: number, registers: number }>} */
  const byCategory = {}
  for (const c of ['restaurant', 'school-canteen', 'exhibition', 'archived-whitelisted', 'not-whitelisted']) {
    byCategory[c] = {
      netKwd: sumBy((r) => r.category === c),
      orders: registers.filter((r) => r.category === c).reduce((s, r) => s + r.orders, 0),
      registers: registers.filter((r) => r.category === c).length,
    }
  }

  /** @type {Record<string, { netKwd: number, orders: number, registers: number }>} */
  const byReconciliationBucket = {}
  for (const b of RECONCILIATION_BUCKETS) {
    byReconciliationBucket[b] = {
      netKwd: sumBy((r) => r.reconciliationBucket === b),
      orders: registers.filter((r) => r.reconciliationBucket === b).reduce((s, r) => s + r.orders, 0),
      registers: registers.filter((r) => r.reconciliationBucket === b).length,
    }
  }

  const totals = {
    allRegisters: sumBy(() => true),
    whitelisted: sumBy(
      (r) => r.category === 'restaurant' || r.category === 'school-canteen' || r.category === 'exhibition',
    ),
    whitelistedExclBooths: sumBy((r) => r.category === 'restaurant' || r.category === 'school-canteen'),
    restaurantsOnly: sumBy((r) => r.category === 'restaurant'),
    whitelistedInclArchived: sumBy(
      (r) =>
        r.category === 'restaurant' ||
        r.category === 'school-canteen' ||
        r.category === 'exhibition' ||
        r.category === 'archived-whitelisted',
    ),
    whitelistedExclBoothsInclArchived: sumBy(
      (r) => r.category === 'restaurant' || r.category === 'school-canteen' || r.category === 'archived-whitelisted',
    ),
  }

  const labels = {
    allRegisters: 'All Odoo registers (active + archived + non-whitelisted)',
    whitelisted: 'Active whitelisted (restaurants + canteens + booths — current app total)',
    whitelistedExclBooths: 'Active restaurants + canteens (booths excluded)',
    restaurantsOnly: 'Active restaurants only (canteens & booths excluded)',
    whitelistedInclArchived: 'Whitelisted incl. archived #16/#35 (with booths)',
    whitelistedExclBoothsInclArchived: 'Restaurants + canteens + archived #16/#35 (booths excluded)',
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

  const ownerRefFils = toFils(ownerReferenceKwd)
  const ownerReconciliation = Object.entries(totals).map(([basisKey, valKwd]) => {
    const deltaFils = toFils(valKwd) - ownerRefFils
    return {
      basisKey,
      label: labels[basisKey],
      basisNetKwd: valKwd,
      ownerReferenceKwd: fromFils(ownerRefFils),
      deltaKwd: fromFils(deltaFils),
      withinOneKwd: Math.abs(deltaFils) <= toFils(toleranceKwd),
    }
  })

  const singleRegisterMatches = registers.filter(
    (r) => Math.abs(Math.abs(r.netKwd) - targetVarianceKwd) <= toleranceKwd,
  )

  return {
    registers,
    byCategory,
    byReconciliationBucket,
    totals,
    labels,
    gaps,
    ownerReferenceKwd: fromFils(ownerRefFils),
    ownerReconciliation,
    singleRegisterMatches,
    targetVarianceKwd,
    toleranceKwd,
  }
}

const fmt = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtSigned = (n) => `${n >= 0 ? '+' : ''}${fmt(n)}`

export function renderVarianceMarkdown(report, meta) {
  const L = []
  L.push(`# POS variance audit — ${meta.fromIso} → ${meta.toIso} (Asia/Kuwait)`)
  L.push('')
  L.push(`Generated ${meta.generatedAt} from live Odoo 17 \`pos.order\` (state paid/done/invoiced), net = amount_total − amount_tax, with \`pos.config\` read via \`active_test: false\`.`)
  L.push(`Target variance under investigation: **${fmt(report.targetVarianceKwd)} KWD** (match tolerance ±${fmt(report.toleranceKwd)}).`)
  L.push('')
  L.push('## Candidate totals')
  L.push('')
  L.push('| Basis | Net KWD | vs Owner Reference |')
  L.push('|---|---:|---:|')
  for (const row of report.ownerReconciliation) {
    L.push(`| ${row.label} | ${fmt(row.basisNetKwd)} | ${fmtSigned(row.deltaKwd)} |`)
  }
  L.push('')
  L.push('## By reconciliation bucket')
  L.push('')
  L.push('| Bucket | Registers | Orders | Net KWD |')
  L.push('|---|---:|---:|---:|')
  for (const [b, v] of Object.entries(report.byReconciliationBucket)) {
    L.push(`| ${b} | ${v.registers} | ${v.orders} | ${fmt(v.netKwd)} |`)
  }
  L.push('')
  L.push('## Every register')
  L.push('')
  L.push('| pos.config | Active | Register | Reconciliation Bucket | Location | Orders | Net KWD |')
  L.push('|---:|:---:|---|---|---|---:|---:|')
  for (const r of report.registers) {
    L.push(
      `| #${r.configId} | ${r.active ? 'yes' : 'archived'} | ${r.configName} | ${r.reconciliationBucket} | ${r.location ?? '—'} | ${r.orders} | ${fmt(r.netKwd)} |`,
    )
  }
  L.push('')
  return L.join('\n')
}

export function renderReconciliationRedoMarkdown(report, meta) {
  const L = []
  L.push(`# Reconciliation — ${meta.fromIso} → ${meta.toIso} vs Owner Reference (${fmt(report.ownerReferenceKwd)} KWD)`)
  L.push('')
  L.push(`- **Generated**: \`${meta.generatedAt}\` (read-only Odoo 17 \`pos.order.read_group\` + \`pos.config.search_read\` with \`active_test: false\`)`)
  L.push(`- **Window**: \`${meta.fromIso}\` → \`${meta.toIso}\` inclusive (\`Asia/Kuwait\`, UTC+3)`)
  L.push(`- **Filter**: \`state in ['paid', 'done', 'invoiced']\`, \`net = amount_total − amount_tax\``)
  L.push(`- **Owner reference**: **${fmt(report.ownerReferenceKwd)} KWD**`)
  L.push(`- **Policy**: Read-only diagnostic only — app totals are NOT changed without explicit owner approval.`)
  L.push('')
  L.push('## 1. Candidate Totals vs Owner Reference')
  L.push('')
  L.push('| Candidate Basis | Net KWD | Delta vs Owner (`Basis − Owner`) |')
  L.push('|---|---:|---:|')
  for (const row of report.ownerReconciliation) {
    L.push(`| ${row.label} | ${fmt(row.basisNetKwd)} | ${fmtSigned(row.deltaKwd)} |`)
  }
  L.push('')
  L.push('## 2. Summary by Classification Bucket')
  L.push('')
  L.push('| Bucket | Registers | Orders | Net KWD |')
  L.push('|---|---:|---:|---:|')
  for (const [bucket, val] of Object.entries(report.byReconciliationBucket)) {
    L.push(`| \`${bucket}\` | ${val.registers} | ${val.orders} | ${fmt(val.netKwd)} |`)
  }
  L.push('')
  L.push('## 3. Spotlight Registers (#16, #35, #36, Excluded [24, 25, 39, 40], Booths, Canteens, Qurain)')
  L.push('')
  const spotlight = report.registers.filter(
    (r) =>
      [16, 24, 25, 35, 36, 39, 40, 41, 42, 43].includes(r.configId) ||
      r.reconciliationBucket === 'archived-whitelisted' ||
      r.reconciliationBucket === 'unknown-unmapped' ||
      r.reconciliationBucket === 'exhibition-booths' ||
      r.reconciliationBucket === 'qurain-central-kitchen',
  )
  L.push('| Config | Active | Name | Bucket | Location | Orders | Net KWD |')
  L.push('|---:|:---:|---|---|---|---:|---:|')
  for (const r of spotlight) {
    L.push(
      `| #${r.configId} | ${r.active ? 'active' : 'archived'} | ${r.configName} | \`${r.reconciliationBucket}\` | ${r.location ?? '—'} | ${r.orders} | ${fmt(r.netKwd)} |`,
    )
  }
  L.push('')
  L.push('## 4. Complete Config-by-Config Ledger')
  L.push('')
  L.push('| Config | Active | Name | Bucket | Location | Orders | Gross KWD | Tax KWD | Net KWD |')
  L.push('|---:|:---:|---|---|---|---:|---:|---:|---:|')
  for (const r of report.registers) {
    L.push(
      `| #${r.configId} | ${r.active ? 'active' : 'archived'} | ${r.configName} | \`${r.reconciliationBucket}\` | ${r.location ?? '—'} | ${r.orders} | ${fmt(r.grossKwd)} | ${fmt(r.taxKwd)} | ${fmt(r.netKwd)} |`,
    )
  }
  L.push('')
  return L.join('\n')
}
