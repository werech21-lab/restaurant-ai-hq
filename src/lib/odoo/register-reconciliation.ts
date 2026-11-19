import {
  companyPosConfigAllowed,
  isExhibitionConfigId,
  isPinnedSchoolCanteenConfigId,
} from './company-pos'
import { isExcludedOdooEntity, isExcludedRecordId } from './excluded-entities'

/** Included POS configs only. Excluded ids and names never enter the company total. */
export type RegisterBucket = 'restaurant' | 'school-canteen' | 'exhibition-booths'

export type RegisterReconciliationRow = {
  configId: number
  configName: string
  bucket: RegisterBucket
  netKwd: number
  orders: number
}

export type RegisterReconciliation = {
  rows: RegisterReconciliationRow[]
  includedNetKwd: number
  companyNetKwd: number
  gapKwd: number
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000

/**
 * A register is included only when the existing POS allow-list accepts it.
 * Explicit exclusions (24, 25, 39, 40), Qurain, Jahra and Heisenberg stay out.
 */
export function classifyIncludedRegister(configId: number, name: string): RegisterBucket | null {
  if (!Number.isInteger(configId)) return null
  if (isExcludedRecordId('pos_config', configId)) return null
  if (isExcludedOdooEntity(name)) return null
  if (!companyPosConfigAllowed(configId, name, true)) return null
  if (isPinnedSchoolCanteenConfigId(configId)) return 'school-canteen'
  if (isExhibitionConfigId(configId)) return 'exhibition-booths'
  return 'restaurant'
}

/**
 * Ties each included pos.config net to the company POS net already computed
 * from the same orders. Returns null when there is no register row to show.
 */
export function buildRegisterReconciliation(
  rows: ReadonlyArray<{ configId: number; configName: string; netKwd: number; orders: number }>,
  companyNetKwd: number,
): RegisterReconciliation | null {
  const kept: RegisterReconciliationRow[] = []
  let rawIncluded = 0
  for (const row of rows) {
    if (!Number.isFinite(row.netKwd)) continue
    const bucket = classifyIncludedRegister(row.configId, row.configName)
    if (!bucket) continue
    rawIncluded += row.netKwd
    kept.push({
      configId: row.configId,
      configName: row.configName.trim() || `pos.config ${row.configId}`,
      bucket,
      netKwd: r3(row.netKwd),
      orders: Number.isFinite(row.orders) ? Math.round(row.orders) : 0,
    })
  }
  if (kept.length === 0) return null
  kept.sort(
    (a, b) => a.bucket.localeCompare(b.bucket) || b.netKwd - a.netKwd || a.configId - b.configId,
  )
  const includedNetKwd = r3(rawIncluded)
  const company = Number.isFinite(companyNetKwd) ? r3(companyNetKwd) : includedNetKwd
  return {
    rows: kept,
    includedNetKwd,
    companyNetKwd: company,
    gapKwd: r3(company - includedNetKwd),
  }
}
