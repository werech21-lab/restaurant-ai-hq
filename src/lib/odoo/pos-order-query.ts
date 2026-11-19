import { getKuwaitTodayIso } from '../aether/period-delta'
import {
  companyPosRegisterIds,
  posOrderNet,
  SCHOOL_CANTEEN_BRANCH_ID,
  signedKwd,
} from './company-pos'

export const KUWAIT_OFFSET_MS = 3 * 3600 * 1000

export type PosM2O = [number, string] | false | null | undefined

const r3 = (value: number): number => Math.round((Number(value) || 0) * 1000) / 1000

function m2oId(value: unknown): number | null {
  if (Array.isArray(value) && typeof value[0] === 'number' && Number.isFinite(value[0])) {
    return value[0]
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return null
}

function m2oName(value: unknown): string {
  return Array.isArray(value) && typeof value[1] === 'string' ? value[1] : ''
}

function cleanCount(value: unknown): number {
  const parsed = Math.round(Number(value) || 0)
  return parsed > 0 ? parsed : 0
}

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
  const cleanFrom = /^\d{4}-\d{2}-\d{2}$/.test(fromKuwaitDate)
    ? fromKuwaitDate
    : getKuwaitTodayIso()
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

/**
 * One register clause: `config_id in [allowlist]`, including Qurain ids 24 and 36.
 * A company OR makes the yearly product read too slow, so the company is not part of this clause.
 */
export function posRegisterScopeClauses(input: {
  companyId?: number | null
  configIds: readonly number[]
  configField: string
  companyField: string
}): unknown[] {
  void input.companyId
  void input.companyField
  const ids = [...new Set(input.configIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (ids.length === 0) return [['id', '=', 0]]
  return [[input.configField, 'in', ids]]
}

export function buildPosOrderUtcDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  companyId?: number | null
  configIds?: readonly number[]
  nonRefundOnly?: boolean
}): unknown[] {
  const configIds = input.configIds ?? companyPosRegisterIds()
  const domain: unknown[] = [
    ['state', 'in', ['paid', 'done', 'invoiced']],
    ['date_order', '>=', input.fromUtc],
    ['date_order', '<', input.toExclusiveUtc],
    ...posRegisterScopeClauses({
      companyId: input.companyId,
      configIds,
      configField: 'session_id.config_id',
      companyField: 'company_id',
    }),
  ]
  if (input.nonRefundOnly) {
    domain.push(['amount_total', '>=', 0])
  }
  return domain
}

export function buildPosOrderKpiDomain(input: {
  fromKuwaitDate: string
  toInclusiveKuwaitDate?: string
  companyId?: number | null
  configIds?: readonly number[]
  nonRefundOnly?: boolean
}): unknown[] {
  const bounds = kuwaitDateBoundsToOdooUtc(
    input.fromKuwaitDate,
    input.toInclusiveKuwaitDate ?? input.fromKuwaitDate,
  )
  return buildPosOrderUtcDomain({
    fromUtc: bounds.fromUtc,
    toExclusiveUtc: bounds.toExclusiveUtc,
    companyId: input.companyId ?? null,
    configIds: input.configIds,
    nonRefundOnly: input.nonRefundOnly,
  })
}

export function buildPosPaymentUtcDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  companyId?: number | null
  configIds?: readonly number[]
  nonRefundOnly?: boolean
}): unknown[] {
  const configIds = input.configIds ?? companyPosRegisterIds()
  const domain: unknown[] = [
    ['pos_order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ['pos_order_id.date_order', '>=', input.fromUtc],
    ['pos_order_id.date_order', '<', input.toExclusiveUtc],
    ...posRegisterScopeClauses({
      companyId: input.companyId,
      configIds,
      configField: 'session_id.config_id',
      companyField: 'pos_order_id.company_id',
    }),
  ]
  if (input.nonRefundOnly) {
    domain.push(['pos_order_id.amount_total', '>=', 0], ['amount', '>=', 0])
  }
  return domain
}

export function describePosOrderQuery(input: {
  fromKuwaitDate: string
  toInclusiveKuwaitDate: string
  companyId: number | null
  configIds?: readonly number[]
  aggregate: 'read_group' | 'search_count'
}): string {
  const domain = buildPosOrderKpiDomain({
    fromKuwaitDate: input.fromKuwaitDate,
    toInclusiveKuwaitDate: input.toInclusiveKuwaitDate,
    companyId: input.companyId,
    configIds: input.configIds,
    nonRefundOnly: input.aggregate === 'search_count',
  })
  const call =
    input.aggregate === 'search_count'
      ? `pos.order.search_count(${JSON.stringify(domain)})`
      : `pos.order.read_group(${JSON.stringify(domain)},["amount_total:sum","amount_tax:sum"])`
  return `${call} /* ${SCHOOL_CANTEEN_BRANCH_ID} pinned config ids included in session_id.config_id */`
}

export function parseDescribedPosOrderDomain(query: string): unknown[][] {
  const trimmed = String(query ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
  const prefixMatch = /^pos\.order\.(?:search_count|read_group)\(/.exec(trimmed)
  if (!prefixMatch) {
    throw new Error('Invalid described POS order query')
  }
  const startIdx = trimmed.indexOf('[', prefixMatch[0].length)
  if (startIdx < 0) {
    throw new Error('Missing domain array in described POS order query')
  }
  let depth = 0
  let inString = false
  let escaped = false
  let endIdx = -1
  for (let i = startIdx; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '[') {
      depth += 1
    } else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        endIdx = i
        break
      }
    }
  }
  if (endIdx < startIdx) {
    throw new Error('Unterminated domain array in described POS order query')
  }
  const parsed: unknown = JSON.parse(trimmed.slice(startIdx, endIdx + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('Parsed POS order domain is not an array')
  }
  return parsed as unknown[][]
}

export interface DaySessionPricelistGroupRow {
  session_id: PosM2O
  pricelist_id?: PosM2O
  amount_total?: number
  amount_tax?: number
  __count?: number
  __range?: { 'date_order:day'?: { from?: string; to?: string } }
  'date_order:day'?: string
  day?: string
}

export interface MergedDaySessionPricelistGroup {
  key: string
  sessionId: number | null
  session_id: PosM2O
  pricelistId: number | null
  pricelistName: string
  pricelist_id?: PosM2O
  dayFromUtc: string
  __range?: { 'date_order:day'?: { from?: string; to?: string } }
  netKwd: number
  orders: number
}

function dayTokenOf(row: {
  __range?: { 'date_order:day'?: { from?: string; to?: string } }
  'date_order:day'?: string
  day?: string
}): string {
  return row.__range?.['date_order:day']?.from ?? row['date_order:day'] ?? row.day ?? ''
}

export function mergeDaySessionPricelistGroups(
  netRows: readonly DaySessionPricelistGroupRow[],
  nonRefundCountRows: readonly DaySessionPricelistGroupRow[],
): MergedDaySessionPricelistGroup[] {
  const countsByKey = new Map<string, number>()
  const metaByKey = new Map<string, DaySessionPricelistGroupRow>()

  for (const row of nonRefundCountRows) {
    const sid = m2oId(row.session_id)
    const pid = m2oId(row.pricelist_id)
    const dTok = dayTokenOf(row)
    const key = `${sid ?? 'none'}|${pid ?? 'none'}|${dTok}`
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + cleanCount(row.__count))
    if (!metaByKey.has(key)) metaByKey.set(key, row)
  }

  const netByKey = new Map<string, number>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const row of netRows) {
    const sid = m2oId(row.session_id)
    const pid = m2oId(row.pricelist_id)
    const dTok = dayTokenOf(row)
    const key = `${sid ?? 'none'}|${pid ?? 'none'}|${dTok}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
    metaByKey.set(key, row)
    netByKey.set(key, r3((netByKey.get(key) ?? 0) + posOrderNet(row.amount_total, row.amount_tax)))
  }

  for (const key of countsByKey.keys()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  return orderedKeys.map((key) => {
    const meta = metaByKey.get(key)!
    return {
      key,
      sessionId: m2oId(meta.session_id),
      session_id: meta.session_id,
      pricelistId: m2oId(meta.pricelist_id),
      pricelistName: m2oName(meta.pricelist_id),
      pricelist_id: meta.pricelist_id,
      dayFromUtc: dayTokenOf(meta),
      __range: meta.__range,
      netKwd: r3(netByKey.get(key) ?? 0),
      orders: countsByKey.get(key) ?? 0,
    }
  })
}

export interface HourGroupRow {
  amount_total?: number
  amount_tax?: number
  __count?: number
  __range?: { 'date_order:hour'?: { from?: string; to?: string } }
  'date_order:hour'?: string
  hour?: string | number
}

export interface MergedHourGroup {
  key: string
  hourFromUtc: string
  __range?: { 'date_order:hour'?: { from?: string; to?: string } }
  netKwd: number
  orders: number
}

function hourTokenOf(row: {
  __range?: { 'date_order:hour'?: { from?: string; to?: string } }
  'date_order:hour'?: string
  hour?: string | number
}): string {
  if (row.__range?.['date_order:hour']?.from) return row.__range['date_order:hour'].from
  if (row['date_order:hour'] !== undefined) return String(row['date_order:hour'])
  if (row.hour !== undefined) return String(row.hour)
  return ''
}

export function mergeHourGroups(
  netRows: readonly HourGroupRow[],
  nonRefundCountRows: readonly HourGroupRow[],
): MergedHourGroup[] {
  const countsByKey = new Map<string, number>()
  const metaByKey = new Map<string, HourGroupRow>()

  for (const row of nonRefundCountRows) {
    const key = hourTokenOf(row)
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + cleanCount(row.__count))
    if (!metaByKey.has(key)) metaByKey.set(key, row)
  }

  const netByKey = new Map<string, number>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const row of netRows) {
    const key = hourTokenOf(row)
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
    metaByKey.set(key, row)
    netByKey.set(key, r3((netByKey.get(key) ?? 0) + posOrderNet(row.amount_total, row.amount_tax)))
  }

  for (const key of countsByKey.keys()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  return orderedKeys.map((key) => {
    const meta = metaByKey.get(key)!
    return {
      key,
      hourFromUtc: hourTokenOf(meta),
      __range: meta.__range,
      netKwd: r3(netByKey.get(key) ?? 0),
      orders: countsByKey.get(key) ?? 0,
    }
  })
}

export interface SessionHourGroupRow extends HourGroupRow {
  session_id: PosM2O
}

export interface MergedSessionHourGroup extends MergedHourGroup {
  sessionId: number | null
  session_id: PosM2O
}

export function mergeSessionHourGroups(
  netRows: readonly SessionHourGroupRow[],
  nonRefundCountRows: readonly SessionHourGroupRow[],
): MergedSessionHourGroup[] {
  const countsByKey = new Map<string, number>()
  const metaByKey = new Map<string, SessionHourGroupRow>()

  for (const row of nonRefundCountRows) {
    const sid = m2oId(row.session_id)
    const hTok = hourTokenOf(row)
    const key = `${sid ?? 'none'}|${hTok}`
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + cleanCount(row.__count))
    if (!metaByKey.has(key)) metaByKey.set(key, row)
  }

  const netByKey = new Map<string, number>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const row of netRows) {
    const sid = m2oId(row.session_id)
    const hTok = hourTokenOf(row)
    const key = `${sid ?? 'none'}|${hTok}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
    metaByKey.set(key, row)
    netByKey.set(key, r3((netByKey.get(key) ?? 0) + posOrderNet(row.amount_total, row.amount_tax)))
  }

  for (const key of countsByKey.keys()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  return orderedKeys.map((key) => {
    const meta = metaByKey.get(key)!
    return {
      key,
      sessionId: m2oId(meta.session_id),
      session_id: meta.session_id,
      hourFromUtc: hourTokenOf(meta),
      __range: meta.__range,
      netKwd: r3(netByKey.get(key) ?? 0),
      orders: countsByKey.get(key) ?? 0,
    }
  })
}

export interface SessionGroupRow {
  session_id: PosM2O
  amount_total?: number
  amount_tax?: number
  __count?: number
}

export interface MergedSessionGroup {
  key: string
  sessionId: number | null
  session_id: PosM2O
  netKwd: number
  orders: number
}

export function mergeSessionGroups(
  netRows: readonly SessionGroupRow[],
  nonRefundCountRows: readonly SessionGroupRow[],
): MergedSessionGroup[] {
  const countsByKey = new Map<string, number>()
  const metaByKey = new Map<string, SessionGroupRow>()

  for (const row of nonRefundCountRows) {
    const sid = m2oId(row.session_id)
    const key = `${sid ?? 'none'}`
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + cleanCount(row.__count))
    if (!metaByKey.has(key)) metaByKey.set(key, row)
  }

  const netByKey = new Map<string, number>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const row of netRows) {
    const sid = m2oId(row.session_id)
    const key = `${sid ?? 'none'}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
    metaByKey.set(key, row)
    netByKey.set(key, r3((netByKey.get(key) ?? 0) + posOrderNet(row.amount_total, row.amount_tax)))
  }

  for (const key of countsByKey.keys()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  return orderedKeys.map((key) => {
    const meta = metaByKey.get(key)!
    return {
      key,
      sessionId: m2oId(meta.session_id),
      session_id: meta.session_id,
      netKwd: r3(netByKey.get(key) ?? 0),
      orders: countsByKey.get(key) ?? 0,
    }
  })
}

export interface SessionPaymentGroupRow {
  session_id: PosM2O
  payment_method_id: PosM2O
  amount?: number
  __count?: number
}

export interface MergedSessionPaymentGroup {
  key: string
  sessionId: number | null
  session_id: PosM2O
  paymentMethodId: number | null
  paymentMethodName: string
  payment_method_id: PosM2O
  netKwd: number
  orders: number
}

export function mergeSessionPaymentGroups(
  netRows: readonly SessionPaymentGroupRow[],
  nonRefundCountRows: readonly SessionPaymentGroupRow[],
): MergedSessionPaymentGroup[] {
  const countsByKey = new Map<string, number>()
  const metaByKey = new Map<string, SessionPaymentGroupRow>()

  for (const row of nonRefundCountRows) {
    const sid = m2oId(row.session_id)
    const pmid = m2oId(row.payment_method_id)
    const pmName = m2oName(row.payment_method_id)
    const key = `${sid ?? 'none'}|${pmid ?? (pmName || 'none')}`
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + cleanCount(row.__count))
    if (!metaByKey.has(key)) metaByKey.set(key, row)
  }

  const netByKey = new Map<string, number>()
  const orderedKeys: string[] = []
  const seenKeys = new Set<string>()

  for (const row of netRows) {
    const sid = m2oId(row.session_id)
    const pmid = m2oId(row.payment_method_id)
    const pmName = m2oName(row.payment_method_id)
    const key = `${sid ?? 'none'}|${pmid ?? (pmName || 'none')}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
    metaByKey.set(key, row)
    netByKey.set(key, r3((netByKey.get(key) ?? 0) + signedKwd(row.amount)))
  }

  for (const key of countsByKey.keys()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      orderedKeys.push(key)
    }
  }

  return orderedKeys.map((key) => {
    const meta = metaByKey.get(key)!
    return {
      key,
      sessionId: m2oId(meta.session_id),
      session_id: meta.session_id,
      paymentMethodId: m2oId(meta.payment_method_id),
      paymentMethodName: m2oName(meta.payment_method_id),
      payment_method_id: meta.payment_method_id,
      netKwd: r3(netByKey.get(key) ?? 0),
      orders: countsByKey.get(key) ?? 0,
    }
  })
}

export type UtcWindow = { fromUtc: string; toUtc: string }

/** Closed-year reads only. Today stays on the default 8s RPC cap. */
export const YEAR_CLOSED_READ_TIMEOUT_MS = 45_000

/**
 * Yearly payments stay grouped by session and method so each branch keeps its
 * channel split. The closed window is read per register (one config id) under
 * the 45s cap, then cached.
 */
export const YEAR_PAYMENT_GROUP_BY = ['session_id', 'payment_method_id'] as const

export const YEAR_REGISTER_READ_CONCURRENCY = 8

export interface YearChannelPayment {
  configId: number | null
  methodName: string
  netKwd: number
  orders: number
}

/** Each payment is added once, to one branch channel or to the unmapped bucket. */
export function foldYearBranchChannels(input: {
  payments: readonly YearChannelPayment[]
  branchOfConfig: (configId: number) => string | null
  isDeliveryConfig: (configId: number) => boolean
  channelOf: (methodName: string, isDelivery: boolean) => string
  branchIds: readonly string[]
  channelKeys: readonly string[]
}): {
  byBranch: Record<string, Record<string, { netKwd: number; orders: number }>>
  unmapped: Record<string, { netKwd: number; orders: number }>
  totalNet: number
} {
  const blank = () => Object.fromEntries(input.channelKeys.map((key) => [key, { netKwd: 0, orders: 0 }]))
  const byBranch: Record<string, Record<string, { netKwd: number; orders: number }>> = {}
  for (const id of input.branchIds) byBranch[id] = blank()
  const unmapped = blank()
  let totalNet = 0
  for (const payment of input.payments) {
    totalNet += payment.netKwd
    const branch = payment.configId == null ? null : input.branchOfConfig(payment.configId)
    const channel = input.channelOf(
      payment.methodName,
      payment.configId != null && input.isDeliveryConfig(payment.configId),
    )
    const bucket = branch && byBranch[branch] ? byBranch[branch] : unmapped
    const cell = bucket[channel] ?? (bucket[channel] = { netKwd: 0, orders: 0 })
    cell.netKwd += payment.netKwd
    cell.orders += payment.orders
  }
  return { byBranch, unmapped, totalNet }
}

export function yearReadCall(window: UtcWindow): {
  kwargs: { lazy: false; context?: { year_live_slice: true } }
  timeout?: { timeoutMs: number; timeoutCapMs: number }
} {
  const fromMs = Date.parse(`${window.fromUtc.replace(' ', 'T')}Z`)
  const toMs = Date.parse(`${window.toUtc.replace(' ', 'T')}Z`)
  const liveSlice = Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs - fromMs <= 2 * 86_400_000
  if (liveSlice) return { kwargs: { lazy: false, context: { year_live_slice: true } } }
  return {
    kwargs: { lazy: false },
    timeout: { timeoutMs: YEAR_CLOSED_READ_TIMEOUT_MS, timeoutCapMs: YEAR_CLOSED_READ_TIMEOUT_MS },
  }
}

/** Yesterday and earlier inside the year. Empty when the year starts today. */
export function yearClosedWindow(yearFromUtc: string, todayFromUtc: string): UtcWindow | null {
  if (yearFromUtc >= todayFromUtc) return null
  return { fromUtc: yearFromUtc, toUtc: todayFromUtc }
}

const YEAR_CLOSED_TTL_MS = 30 * 60 * 1000
const YEAR_CLOSED_MAX = 32
const yearClosedRows = new Map<string, { rows: unknown[]; at: number }>()

export function clearYearClosedCache(): void {
  yearClosedRows.clear()
}

function readYearClosedCache(key: string, now: number): unknown[] | undefined {
  const hit = yearClosedRows.get(key)
  if (!hit) return undefined
  if (now - hit.at > YEAR_CLOSED_TTL_MS) {
    yearClosedRows.delete(key)
    return undefined
  }
  return hit.rows
}

function writeYearClosedCache(key: string, rows: unknown[], now: number): void {
  yearClosedRows.set(key, { rows, at: now })
  while (yearClosedRows.size > YEAR_CLOSED_MAX) {
    const oldest = yearClosedRows.keys().next().value
    if (!oldest) break
    yearClosedRows.delete(oldest)
  }
}

/**
 * Closed days of the year are read once and reused for 30 minutes, up to 32 keys.
 * Only today is read on later calls. A failed today read still fails the section.
 */
export async function readClosedYearPlusToday<T>(input: {
  cacheKey: string
  closed: UtcWindow | null
  today: UtcWindow
  read: (window: UtcWindow) => Promise<T[]>
  merge: (rows: readonly T[]) => T[]
}): Promise<T[]> {
  const now = Date.now()
  let closedRows: T[] = []
  if (input.closed) {
    const hit = readYearClosedCache(input.cacheKey, now) as T[] | undefined
    if (hit) {
      closedRows = hit
    } else {
      closedRows = await input.read(input.closed)
      writeYearClosedCache(input.cacheKey, closedRows, now)
    }
  }
  const todayRows = await input.read(input.today)
  return input.merge([...closedRows, ...todayRows])
}

export function mergeProductLineGroups<
  T extends { product_id?: PosM2O; price_subtotal?: number; qty?: number; __count?: number },
>(rows: readonly T[]): T[] {
  const map = new Map<number, T>()
  for (const row of rows) {
    const id = m2oId(row.product_id)
    if (id === null) continue
    const prev = map.get(id)
    if (!prev) {
      map.set(id, { ...row })
      continue
    }
    prev.price_subtotal = (Number(prev.price_subtotal) || 0) + (Number(row.price_subtotal) || 0)
    prev.qty = (Number(prev.qty) || 0) + (Number(row.qty) || 0)
    prev.__count = (Number(prev.__count) || 0) + (Number(row.__count) || 0)
  }
  return [...map.values()]
}

export function mergeRowsByKey<T extends { __count?: number }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
  numericFields: readonly (keyof T)[],
): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...row })
      continue
    }
    for (const field of numericFields) {
      const left = Number(prev[field]) || 0
      const right = Number(row[field]) || 0
      ;(prev[field] as number) = left + right
    }
    prev.__count = (Number(prev.__count) || 0) + (Number(row.__count) || 0)
  }
  return [...map.values()]
}
