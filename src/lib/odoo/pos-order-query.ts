import { getKuwaitTodayIso } from '@/lib/aether/period-delta'
import { companyPosRegisterIds, SCHOOL_CANTEEN_BRANCH_ID } from '@/lib/odoo/company-pos'

export const KUWAIT_OFFSET_MS = 3 * 3600 * 1000

/**
 * Kuwait calendar dates (`YYYY-MM-DD`) to Odoo naive UTC.
 * The end bound is exclusive: the next Kuwait midnight.
 */
export function kuwaitDateBoundsToOdooUtc(
  fromKuwaitDate: string,
  toInclusiveKuwaitDate = fromKuwaitDate,
): {
  fromUtc: string
  toInclusiveUtc: string
  toExclusiveUtc: string
} {
  const cleanFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromKuwaitDate) ? fromKuwaitDate : getKuwaitTodayIso()
  const cleanTo =
    /^\d{4}-\d{2}-\d{2}$/.test(toInclusiveKuwaitDate) && toInclusiveKuwaitDate >= cleanFrom
      ? toInclusiveKuwaitDate
      : cleanFrom

  const startUtcMs = Date.parse(`${cleanFrom}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const endInclusiveUtcMs = Date.parse(`${cleanTo}T23:59:59.000Z`) - KUWAIT_OFFSET_MS
  const endExclusiveUtcMs = Date.parse(`${cleanTo}T00:00:00.000Z`) + 86_400_000 - KUWAIT_OFFSET_MS
  const fmtOdooUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')

  return {
    fromUtc: fmtOdooUtc(startUtcMs),
    toInclusiveUtc: fmtOdooUtc(endInclusiveUtcMs),
    toExclusiveUtc: fmtOdooUtc(endExclusiveUtcMs),
  }
}

export function describePosOrderQuery(input: {
  fromKuwaitDate: string
  toInclusiveKuwaitDate: string
  companyId: number | null
  configIds?: readonly number[]
  aggregate: 'read_group' | 'search_count'
}): string {
  const bounds = kuwaitDateBoundsToOdooUtc(input.fromKuwaitDate, input.toInclusiveKuwaitDate)
  const configIds = input.configIds ?? companyPosRegisterIds()
  const domain: unknown[] = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', bounds.fromUtc],
    ['date_order', '<', bounds.toExclusiveUtc],
  ]
  if (input.companyId !== null && Number.isInteger(input.companyId)) {
    domain.push(['company_id', '=', input.companyId])
  }
  if (input.aggregate === 'search_count') {
    domain.push(['amount_total', '>=', 0])
  }
  domain.push(['session_id.config_id', 'in', [...configIds]])
  const call =
    input.aggregate === 'search_count'
      ? `pos.order.search_count(${JSON.stringify(domain)})`
      : `pos.order.read_group(${JSON.stringify(domain)},["amount_total:sum","amount_tax:sum"])`
  return `${call} /* ${SCHOOL_CANTEEN_BRANCH_ID} pinned config ids included in session_id.config_id */`
}
