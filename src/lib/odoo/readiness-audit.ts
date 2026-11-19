/**
 * Pure data-readiness rules for the admin audit.
 * No I/O. Callers pass what a read-only Odoo probe already returned.
 * Sales scope reuses the active pos.config allow-list and the Qurain name
 * classifier. This module does not change company totals.
 */
import { isQurainLabel } from '../../../scripts/lib/qurain-audit-lib.mjs'
import { getKuwaitTodayIso } from '@/lib/aether/period-delta'
import { companyPosConfigAllowed, isDeliveryQurainConfig, posOrderNet } from '@/lib/odoo/company-pos'
import { isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import {
  KUWAIT_OFFSET_MS,
  buildPosOrderUtcDomain,
  buildPosPaymentUtcDomain,
  kuwaitDateBoundsToOdooUtc,
} from '@/lib/odoo/pos-order-query'

export const READINESS_AUDIT_PATH = '/api/admin/readiness-audit'
export const READINESS_BUDGET_MS = 60_000
/** Leave room for one in-flight RPC (the connector caps a call at 8s) inside the route budget. */
export const READINESS_MIN_REMAINING_MS = 9_000
export const COMPLETENESS_GO_MIN_PCT = 80
export const SEASONS_MIN_HISTORY_DAYS = 365
export const COMPLETENESS_SAMPLE_SIZE = 80
export const READINESS_PAGE_SIZE = 200
export const MAX_ZERO_COST_PRODUCTS = 2_000
export const CASHIER_CONFIG_IDS = [24, 16, 35] as const
/** Delivery (Qurain) and Delivery (Qurain Temp). Included in withQurain by id, even when excluded or inactive. */
export const QURAIN_SCOPE_CONFIG_IDS = [24, 36] as const
export const CASHIER_FROM_KUWAIT = '2026-01-01'
export const POS_SALE_STATES = ['paid', 'done', 'invoiced'] as const
export const NO_COST_TOP_SIZES = [50, 80] as const

export const ODOO_READ_METHODS = ['search_read', 'read', 'read_group', 'search_count', 'fields_get'] as const
export type OdooReadMethod = (typeof ODOO_READ_METHODS)[number]

const READ_METHOD_SET: ReadonlySet<string> = new Set(ODOO_READ_METHODS)

export function isOdooReadMethod(method: string): method is OdooReadMethod {
  return READ_METHOD_SET.has(method)
}

export type AdvisorId = 'finance' | 'platforms' | 'warehouse' | 'staff' | 'seasons'
export type ScopeName = 'withoutQurain' | 'withQurain'
export type ReadinessDecision = 'GO' | 'HOLD' | 'OFF'
export type ModelAccess = 'ok' | 'missing' | 'denied' | 'error' | 'unchecked'

export interface ModelSpec {
  model: string
  dateField: string | null
  keyFields: readonly string[]
  requiredFields: readonly string[]
  countDomain: readonly (readonly unknown[])[]
  extraFields: readonly string[]
  /** A readable model with zero rows can still pass. Scrap is often legitimately empty. */
  emptyRowsAllowed: boolean
}

export const READINESS_MODEL_SPECS: readonly ModelSpec[] = [
  {
    model: 'account.move',
    dateField: 'date',
    keyFields: ['date', 'state', 'move_type', 'amount_total', 'journal_id'],
    requiredFields: ['date', 'state', 'amount_total'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'account.move.line',
    dateField: 'date',
    keyFields: ['move_id', 'account_id', 'debit', 'credit', 'date'],
    requiredFields: ['move_id', 'account_id', 'date'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'pos.order',
    dateField: 'date_order',
    keyFields: ['date_order', 'state', 'amount_total', 'amount_tax', 'session_id'],
    requiredFields: ['date_order', 'state', 'amount_total', 'session_id'],
    countDomain: [],
    extraFields: ['config_id'],
    emptyRowsAllowed: false,
  },
  {
    model: 'account.analytic.line',
    dateField: 'date',
    keyFields: ['date', 'amount', 'account_id', 'name'],
    requiredFields: ['date', 'amount', 'account_id'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'pos.order.line',
    dateField: 'create_date',
    keyFields: ['order_id', 'product_id', 'qty', 'price_subtotal'],
    requiredFields: ['order_id', 'product_id', 'qty', 'price_subtotal'],
    countDomain: [],
    extraFields: ['price_subtotal_incl'],
    emptyRowsAllowed: false,
  },
  {
    model: 'pos.payment',
    dateField: 'payment_date',
    keyFields: ['pos_order_id', 'payment_method_id', 'amount'],
    requiredFields: ['pos_order_id', 'payment_method_id', 'amount'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'product.product',
    dateField: 'create_date',
    keyFields: ['name', 'default_code', 'standard_price'],
    // standard_price is company-dependent and may be absent from fields_get. The cost scan reads it separately.
    requiredFields: ['name'],
    countDomain: [['active', '=', true]],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'stock.quant',
    dateField: 'in_date',
    keyFields: ['product_id', 'location_id', 'quantity'],
    requiredFields: ['product_id', 'location_id', 'quantity'],
    countDomain: [],
    extraFields: ['create_date'],
    emptyRowsAllowed: false,
  },
  {
    model: 'stock.move',
    dateField: 'date',
    keyFields: ['product_id', 'product_uom_qty', 'state', 'date', 'location_id', 'location_dest_id'],
    requiredFields: ['product_id', 'state', 'date'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'stock.scrap',
    dateField: 'date_done',
    keyFields: ['product_id', 'scrap_qty', 'state', 'date_done'],
    requiredFields: ['product_id', 'scrap_qty'],
    countDomain: [],
    extraFields: ['create_date'],
    emptyRowsAllowed: true,
  },
  {
    model: 'mrp.bom',
    dateField: 'create_date',
    keyFields: ['product_tmpl_id', 'product_qty', 'type'],
    requiredFields: ['product_qty', 'type'],
    countDomain: [],
    extraFields: ['product_id'],
    emptyRowsAllowed: false,
  },
  {
    model: 'purchase.order.line',
    dateField: 'create_date',
    keyFields: ['product_id', 'product_qty', 'price_unit', 'price_subtotal', 'order_id'],
    requiredFields: ['product_id', 'product_qty', 'price_unit', 'order_id'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
  {
    model: 'hr.attendance',
    dateField: 'check_in',
    keyFields: ['employee_id', 'check_in', 'check_out'],
    requiredFields: ['employee_id', 'check_in'],
    countDomain: [],
    extraFields: ['work_location_id', 'department_id', 'branch_id', 'pos_config_id', 'config_id', 'analytic_account_id'],
    emptyRowsAllowed: false,
  },
  {
    model: 'hr.employee',
    dateField: 'create_date',
    keyFields: ['name', 'work_location_id', 'department_id'],
    requiredFields: ['name'],
    countDomain: [['active', '=', true]],
    extraFields: ['branch_id'],
    emptyRowsAllowed: false,
  },
  {
    model: 'hr.payslip',
    dateField: 'date_from',
    keyFields: ['employee_id', 'date_from', 'date_to', 'state'],
    requiredFields: ['employee_id', 'date_from', 'state'],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  },
]

export const ADVISOR_MODELS: Record<AdvisorId, readonly string[]> = {
  finance: ['account.move', 'account.move.line', 'pos.order', 'account.analytic.line'],
  platforms: ['pos.order', 'pos.order.line', 'pos.payment'],
  warehouse: ['product.product', 'stock.quant', 'stock.move', 'stock.scrap', 'mrp.bom', 'purchase.order.line'],
  staff: ['hr.attendance', 'hr.employee', 'hr.payslip'],
  seasons: ['pos.order'],
}

export const ADVISOR_TITLES: Record<AdvisorId, string> = {
  finance: 'Finance',
  platforms: 'Platforms',
  warehouse: 'Warehouse',
  staff: 'Staff',
  seasons: 'Seasons',
}

const ADVISOR_ORDER: readonly AdvisorId[] = ['finance', 'platforms', 'warehouse', 'staff', 'seasons']

/** Direct attendance columns that can name a branch, then employee columns, in preference order. */
export const ATTENDANCE_BRANCH_FIELDS = [
  'work_location_id',
  'department_id',
  'branch_id',
  'pos_config_id',
  'config_id',
  'analytic_account_id',
] as const

export const EMPLOYEE_BRANCH_FIELDS = ['work_location_id', 'department_id', 'branch_id'] as const

export function isReadinessAuditRole(role: string): role is 'admin' | 'auditor' {
  return role === 'admin' || role === 'auditor'
}

export function isDeliveryQurainName(name: string | null | undefined): boolean {
  return isQurainLabel(String(name ?? '')) === true
}

export function classifyOdooReadFailure(message: string): Exclude<ModelAccess, 'ok' | 'unchecked'> {
  const msg = message.toLowerCase()
  if (
    msg.includes('does not exist') ||
    msg.includes("doesn't exist") ||
    msg.includes('unknown object') ||
    msg.includes('unknown model')
  ) {
    return 'missing'
  }
  if (msg.includes('access') || msg.includes('forbidden') || msg.includes('not allowed')) {
    return 'denied'
  }
  return 'error'
}

export function isFatalOdooFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === 'BudgetStop') return false
  if (error.name === 'OdooConnectorError') return true
  const msg = error.message.toLowerCase()
  return msg.includes('not configured') || msg.includes('auth_rejected') || msg.includes('authentication rejected')
}

export function shiftKuwaitDate(isoDate: string, deltaDays: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + deltaDays * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Inclusive Kuwait calendar window. 30 days is today and the previous 29 Kuwait dates. */
export function trailingKuwaitWindow(today: string, days: number): { from: string; to: string } {
  const span = Math.max(1, Math.round(days))
  return { from: shiftKuwaitDate(today, -(span - 1)), to: today }
}

export function odooNaiveUtcToKuwaitDate(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const text = String(raw).trim()
  if (!text || text === 'false') return null
  const withT = text.includes('T') ? text : text.replace(' ', 'T')
  const iso = /(?:Z|[+-]\d{2}:\d{2})$/.test(withT) ? withT : `${withT}Z`
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return new Date(ms + KUWAIT_OFFSET_MS).toISOString().slice(0, 10)
}

export function historyDaySpan(earliestRaw: string | null, latestRaw: string | null): number | null {
  const earliest = odooNaiveUtcToKuwaitDate(earliestRaw)
  const latest = odooNaiveUtcToKuwaitDate(latestRaw)
  if (!earliest || !latest) return null
  const start = Date.parse(`${earliest}T00:00:00.000Z`)
  const end = Date.parse(`${latest}T00:00:00.000Z`)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.round((end - start) / 86_400_000)
}

export function salesStatesMatchPosOrderQuery(): boolean {
  const domain = buildPosOrderUtcDomain({
    fromUtc: '2026-01-01 00:00:00',
    toExclusiveUtc: '2026-01-02 00:00:00',
    configIds: [1],
  })
  const clause = domain.find((row) => row[0] === 'state' && row[1] === 'in')
  const states = clause?.[2]
  if (!Array.isArray(states)) return false
  return states.length === POS_SALE_STATES.length && POS_SALE_STATES.every((state, index) => states[index] === state)
}

export function buildPosOrderLineDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
}): unknown[][] {
  return [
    ['order_id.state', 'in', [...POS_SALE_STATES]],
    ['order_id.date_order', '>=', input.fromUtc],
    ['order_id.date_order', '<', input.toExclusiveUtc],
    ['order_id.session_id.config_id', 'in', [...input.configIds]],
  ]
}

export function buildCashierOrderDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
  configField: string
}): unknown[][] {
  return [
    ['state', 'in', [...POS_SALE_STATES]],
    ['date_order', '>=', input.fromUtc],
    ['date_order', '<', input.toExclusiveUtc],
    [input.configField, 'in', [...input.configIds]],
  ]
}

export function probeFieldNames(spec: ModelSpec): string[] {
  return [
    ...new Set(
      [...spec.keyFields, ...spec.requiredFields, ...spec.extraFields, spec.dateField].filter(
        (field): field is string => typeof field === 'string' && field.length > 0,
      ),
    ),
  ]
}

export interface PosConfigRow {
  id: number
  name: string
  active: boolean
  companyId?: number | null
}

export interface QurainRegister {
  id: number
  name: string
  active: boolean
  explicitlyExcluded: boolean
  includedInWithQurain: boolean
}

export interface ResolvedScopes {
  withoutQurain: number[]
  withQurain: number[]
  qurain: QurainRegister[]
}

const FORCED_QURAIN_IDS = new Set<number>(QURAIN_SCOPE_CONFIG_IDS)

/**
 * `withoutQurain` is the company allow-list with Qurain registers removed.
 * `withQurain` is that list plus configs 24 and 36 by id (Delivery (Qurain)
 * and Delivery (Qurain Temp)), including when 24 is explicitly excluded or 36
 * is inactive. Other Qurain names the allow-list rejects stay out of both.
 */
export function resolveReadinessScopes(configs: readonly PosConfigRow[]): ResolvedScopes {
  const withIds: number[] = []
  const withoutIds: number[] = []
  const qurain: QurainRegister[] = []
  const seenQurain = new Set<number>()
  for (const row of configs) {
    if (!Number.isInteger(row.id) || row.id <= 0) continue
    const name = row.name ?? ''
    const active = row.active !== false
    const explicitlyExcluded = isExcludedRecordId('pos_config', row.id)
    const forced = FORCED_QURAIN_IDS.has(row.id)
    const qurainName = forced || isDeliveryQurainName(name) || isDeliveryQurainConfig(name)
    const inCompanyTotals = active && companyPosConfigAllowed(row.id, name, true)
    if (qurainName) {
      seenQurain.add(row.id)
      qurain.push({
        id: row.id,
        name,
        active,
        explicitlyExcluded,
        includedInWithQurain: forced || inCompanyTotals,
      })
    }
    if (forced || inCompanyTotals) withIds.push(row.id)
    if (inCompanyTotals && !qurainName) withoutIds.push(row.id)
  }
  for (const id of QURAIN_SCOPE_CONFIG_IDS) {
    if (!withIds.includes(id)) withIds.push(id)
    if (!seenQurain.has(id)) {
      qurain.push({
        id,
        name: `pos.config ${id}`,
        active: false,
        explicitlyExcluded: isExcludedRecordId('pos_config', id),
        includedInWithQurain: true,
      })
    }
  }
  const withoutQurain = [...new Set(withoutIds)].sort((a, b) => a - b)
  const withQurain = [...new Set(withIds)].sort((a, b) => a - b)
  qurain.sort((a, b) => a.id - b.id)
  return { withoutQurain, withQurain, qurain }
}

/** Company context for company-dependent fields such as standard_price. */
export function odooCompanyContext(
  companyIds: readonly number[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const ids = [...new Set(companyIds.filter((id) => Number.isInteger(id) && id > 0))]
  const context: Record<string, unknown> = { active_test: false, ...extra }
  if (ids.length > 0) {
    context.allowed_company_ids = ids
    context.force_company = ids[0]
  }
  return context
}

export type ListedCost =
  | { known: true; standardPriceKwd: number; source: 'product.product' | 'product.template' }
  | { known: false }

/**
 * A missing key is not a zero cost. A present value of false, null, or <= 0 is a known zero-or-negative cost.
 */
export function listedProductCost(
  variant: { hasStandardPrice: boolean; standardPrice: unknown },
  template: { hasStandardPrice: boolean; standardPrice: unknown } | null,
): ListedCost {
  if (variant.hasStandardPrice) {
    return { known: true, standardPriceKwd: costNumber(variant.standardPrice), source: 'product.product' }
  }
  if (template?.hasStandardPrice) {
    return { known: true, standardPriceKwd: costNumber(template.standardPrice), source: 'product.template' }
  }
  return { known: false }
}

export type StandardPriceCase = 'not_readable' | 'company_context_zero' | 'truly_zero' | 'mixed'

export interface StandardPriceFieldProbe {
  present: boolean
  groups: string | null
}

export interface StandardPriceDiagnosis {
  /** Which situation the founder should act on. Counts below are the full split. */
  case: StandardPriceCase
  readable: boolean
  readReturnsKey: boolean
  productField: StandardPriceFieldProbe
  templateField: StandardPriceFieldProbe
  companiesTried: number[]
  counts: {
    /** (a) The integration user cannot read standard_price. */
    notReadable: number
    /** (b) Readable, but at least one company context returns <= 0 while another returns a cost. */
    companyContextZero: number
    /** (c) Readable, and every company context that returned the key has cost <= 0. */
    trulyZero: number
  }
}

export type CompanyCostReading = number | 'absent'

/**
 * Classifies each product after standard_price was read once per company in scope.
 * A missing key is case (a), not a zero. A zero in one company and a positive cost in another is case (b).
 */
export function classifyStandardPrice(input: {
  productField: StandardPriceFieldProbe
  templateField: StandardPriceFieldProbe
  readReturnsKey: boolean
  companiesTried: readonly number[]
  activeProducts: number
  observations: readonly { values: readonly CompanyCostReading[] }[]
}): StandardPriceDiagnosis {
  const fieldReadable = input.productField.present || input.templateField.present || input.readReturnsKey
  const base = {
    readable: fieldReadable,
    readReturnsKey: input.readReturnsKey,
    productField: input.productField,
    templateField: input.templateField,
    companiesTried: [...input.companiesTried],
  }
  if (!fieldReadable) {
    return {
      ...base,
      case: 'not_readable',
      counts: { notReadable: Math.max(0, input.activeProducts), companyContextZero: 0, trulyZero: 0 },
    }
  }
  let notReadable = 0
  let companyContextZero = 0
  let trulyZero = 0
  for (const observation of input.observations) {
    const bucket = costObservationCase(observation.values)
    if (bucket === 'not_readable') notReadable += 1
    else if (bucket === 'company_context_zero') companyContextZero += 1
    else if (bucket === 'truly_zero') trulyZero += 1
  }
  const caseName: StandardPriceCase =
    companyContextZero > 0 && trulyZero > 0
      ? 'mixed'
      : companyContextZero > 0
        ? 'company_context_zero'
        : notReadable > 0 && trulyZero === 0
          ? 'not_readable'
          : 'truly_zero'
  return { ...base, case: caseName, counts: { notReadable, companyContextZero, trulyZero } }
}

function costObservationCase(
  values: readonly CompanyCostReading[],
): 'not_readable' | 'company_context_zero' | 'truly_zero' | 'has_cost' {
  let sawPositive = false
  let sawZero = false
  let sawNumber = false
  let sawAbsent = false
  for (const value of values) {
    if (value === 'absent') {
      sawAbsent = true
      continue
    }
    sawNumber = true
    if (value <= 0) sawZero = true
    else sawPositive = true
  }
  if (!sawNumber) return 'not_readable'
  if (sawPositive && sawZero) return 'company_context_zero'
  if (sawAbsent && !sawPositive) return 'not_readable'
  if (sawZero) return 'truly_zero'
  return 'has_cost'
}

export function standardPriceFieldProbe(payload: unknown): StandardPriceFieldProbe {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { present: false, groups: null }
  const info = (payload as Record<string, unknown>).standard_price
  if (!info || typeof info !== 'object' || Array.isArray(info)) return { present: false, groups: null }
  const groups = (info as Record<string, unknown>).groups
  if (Array.isArray(groups)) return { present: true, groups: groups.map(String).join(', ') || null }
  if (typeof groups === 'string' && groups.trim()) return { present: true, groups: groups }
  return { present: true, groups: null }
}

function costNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return r3(value)
  if (value === false || value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? r3(parsed) : 0
}

export function buildAuditPosOrderDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
}): unknown[][] {
  return [
    ['state', 'in', [...POS_SALE_STATES]],
    ['date_order', '>=', input.fromUtc],
    ['date_order', '<', input.toExclusiveUtc],
    ['config_id', 'in', [...input.configIds]],
  ]
}

export function buildAuditLineDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
}): unknown[][] {
  return [
    ['order_id.state', 'in', [...POS_SALE_STATES]],
    ['order_id.date_order', '>=', input.fromUtc],
    ['order_id.date_order', '<', input.toExclusiveUtc],
    ['order_id.config_id', 'in', [...input.configIds]],
  ]
}

export function sumPosOrderGroups(rows: readonly Record<string, unknown>[]): { orders: number; netKwd: number } {
  let orders = 0
  let total = 0
  let tax = 0
  for (const row of rows) {
    orders += Math.max(0, Math.round(Number(row.__count) || 0))
    total += Number(row.amount_total) || 0
    tax += Number(row.amount_tax) || 0
  }
  return { orders, netKwd: posOrderNet(total, tax) }
}

export function isFilledOdooValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (typeof value === 'number') return Number.isFinite(value)
  return true
}

export function fieldCompletenessPct(
  rows: readonly Record<string, unknown>[],
  fields: readonly string[],
): number | null {
  if (rows.length === 0 || fields.length === 0) return null
  let filled = 0
  let total = 0
  for (const row of rows) {
    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) continue
      total += 1
      if (isFilledOdooValue(row[field])) filled += 1
    }
  }
  if (total === 0) return null
  return Math.round((filled / total) * 1000) / 10
}

export function r3(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1000) / 1000
}

function toFils(kwd: number): bigint {
  if (!Number.isFinite(kwd)) return 0n
  return BigInt(Math.round(kwd * 1000))
}

export function m2oId(value: unknown): number | null {
  if (Array.isArray(value) && typeof value[0] === 'number' && Number.isFinite(value[0])) return value[0]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

export function m2oName(value: unknown): string {
  return Array.isArray(value) && typeof value[1] === 'string' ? value[1] : ''
}

export function asRecordList(value: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(value)) {
    return value.filter((row): row is Record<string, unknown> => isRecord(row))
  }
  if (isRecord(value) && Array.isArray(value.groups)) {
    return value.groups.filter((row): row is Record<string, unknown> => isRecord(row))
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface ModelFact {
  model: string
  exists: boolean
  readable: boolean
  access: ModelAccess
  rowCount: number | null
  completenessPct: number | null
  completenessMeasured: boolean
  sampleSize: number
  keyFields: string[]
  missingRequiredFields: string[]
  earliest: string | null
  latest: string | null
  emptyRowsAllowed: boolean
}

export interface ScopedOrders {
  orders: number
  earliest: string | null
  latest: string | null
  historyDays: number | null
}

export interface ChannelRow {
  paymentMethodId: number | null
  paymentMethodName: string
  amountKwd: number
  payments: number
}

export interface ProductInput {
  id: number
  name: string
  defaultCode: string | null
  standardPriceKwd: number
  costSource?: 'product.product' | 'product.template'
}

export interface LineAgg {
  productId: number
  qty: number
  netKwd: number
}

export interface NoCostProductRow {
  productId: number
  name: string
  defaultCode: string | null
  standardPriceKwd: number
  qty30: number
  netKwd30: number
  qty60: number
  netKwd60: number
  priority: 'P1' | 'P2'
  costSource: 'product.product' | 'product.template'
}

export interface NoCostTop {
  products: number
  netKwd: number
  shareOfNoCostSales60Pct: number | null
  shareOfAllSales60Pct: number | null
}

export interface NoCostTotals {
  p1Count: number
  p2Count: number
  noCostSales60NetKwd: number
  allSales60NetKwd: number
  top50: NoCostTop
  top80: NoCostTop
}

export interface NoCostScope {
  rows: NoCostProductRow[]
  totals: NoCostTotals
}

export interface CashierCheck {
  configId: number
  name: string | null
  active: boolean | null
  found: boolean
  read: boolean
  orders: number | null
  netKwd: number | null
  companyId: number | null
  firstOrderAt: string | null
  lastOrderAt: string | null
  firstOrderKuwait: string | null
  lastOrderKuwait: string | null
  window: { fromKuwait: string; toKuwait: string }
}

export interface ScopeReport {
  name: ScopeName
  includesQurain: boolean
  label: string
  configIds: number[]
  orders: number | null
  earliest: string | null
  latest: string | null
  earliestKuwait: string | null
  latestKuwait: string | null
  historyDays: number | null
  orders2026: number | null
  netKwd2026: number | null
}

export interface ModelReport {
  model: string
  exists: boolean
  readable: boolean
  access: ModelAccess
  rowCount: number | null
  completenessPct: number | null
  sampleSize: number
  keyFields: string[]
  missingRequiredFields: string[]
  earliest: string | null
  latest: string | null
  earliestKuwait: string | null
  latestKuwait: string | null
}

export interface BranchLink {
  via: string | null
  populated: boolean
}

export interface AdvisorReport {
  id: AdvisorId
  title: string
  decision: ReadinessDecision
  reason: string
  hidden?: boolean
  models: ModelReport[]
  channels?: {
    windowDays: 60
    withoutQurain: ChannelRow[] | null
    withQurain: ChannelRow[] | null
  }
  branchLink?: BranchLink
}

export interface ReadinessReport {
  ok: true
  readOnly: true
  generatedAt: string
  partial: boolean
  budgetMs: number
  elapsedMs: number
  currency: 'KWD'
  kuwaitToday: string
  salesStates: readonly ['paid', 'done', 'invoiced']
  scopes: Record<ScopeName, ScopeReport>
  qurainRegisters: QurainRegister[]
  standardPrice: StandardPriceDiagnosis | null
  advisors: AdvisorReport[]
  productsWithoutCost: {
    truncated: boolean
    scanned: boolean
    lineSalesRead: boolean
    costFieldAbsent: number
    withoutQurain: NoCostScope
    withQurain: NoCostScope
  }
  cashiers: CashierCheck[]
  notes: string[]
}

export interface LineSalesInput {
  days30: readonly LineAgg[]
  days60: readonly LineAgg[]
  allNet60Kwd: number
}

export interface AuditFacts {
  generatedAt: string
  elapsedMs: number
  budgetMs: number
  partial: boolean
  kuwaitToday: string
  scopesReady: boolean
  configs: readonly PosConfigRow[]
  models: Readonly<Record<string, ModelFact>>
  scopedOrders: Record<ScopeName, ScopedOrders | null>
  channels: Record<ScopeName, ChannelRow[] | null>
  products: readonly ProductInput[]
  productsScanned: boolean
  productsTruncated: boolean
  lineSalesRead: boolean
  lineSales: Record<ScopeName, LineSalesInput>
  scopeWindow?: Record<ScopeName, { orders: number; netKwd: number } | null>
  costReadable?: boolean
  costAbsentCount?: number
  standardPrice?: StandardPriceDiagnosis | null
  cashiersRead: boolean
  cashierSums: readonly Record<string, unknown>[]
  cashierMins: readonly Record<string, unknown>[]
  cashierMaxes: readonly Record<string, unknown>[]
  cashierConfigField: string
  staff: {
    attendanceFields: readonly string[]
    employeeFields: readonly string[]
    attendanceSample: readonly Record<string, unknown>[]
    employeeSample: readonly Record<string, unknown>[]
  } | null
}

export function uncheckedModelFact(spec: ModelSpec): ModelFact {
  return {
    model: spec.model,
    exists: false,
    readable: false,
    access: 'unchecked',
    rowCount: null,
    completenessPct: null,
    completenessMeasured: false,
    sampleSize: 0,
    keyFields: [...spec.keyFields],
    missingRequiredFields: [],
    earliest: null,
    latest: null,
    emptyRowsAllowed: spec.emptyRowsAllowed,
  }
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function modelBlock(fact: ModelFact | undefined): string | null {
  const model = fact?.model ?? 'model'
  if (!fact || fact.access === 'unchecked') {
    return `HOLD: ${model} was not checked before the time budget.`
  }
  if (fact.access === 'missing' || !fact.exists) return `HOLD: ${model} is not installed.`
  if (fact.access === 'denied') return `HOLD: ${model} is not readable.`
  if (fact.access === 'error' || !fact.readable) return `HOLD: ${model} could not be read.`
  if (fact.missingRequiredFields.length > 0) {
    return `HOLD: ${model} is missing ${fact.missingRequiredFields.join(', ')}.`
  }
  if (fact.rowCount == null) return `HOLD: ${model} row count is unknown.`
  if (fact.rowCount === 0 && !fact.emptyRowsAllowed) return `HOLD: ${model} has no rows.`
  if (fact.rowCount > 0 && !fact.completenessMeasured) {
    return `HOLD: ${model} completeness was not measured.`
  }
  if (fact.completenessPct != null && fact.completenessPct < COMPLETENESS_GO_MIN_PCT) {
    return `HOLD: ${model} key fields are ${formatPct(fact.completenessPct)}% complete (need ${COMPLETENESS_GO_MIN_PCT}%).`
  }
  return null
}

function firstModelBlock(facts: AuditFacts, advisor: AdvisorId): string | null {
  for (const model of ADVISOR_MODELS[advisor]) {
    const block = modelBlock(facts.models[model])
    if (block) return block
  }
  return null
}

function toModelReport(fact: ModelFact): ModelReport {
  return {
    model: fact.model,
    exists: fact.exists,
    readable: fact.readable,
    access: fact.access,
    rowCount: fact.rowCount,
    completenessPct: fact.completenessPct,
    sampleSize: fact.sampleSize,
    keyFields: fact.keyFields,
    missingRequiredFields: fact.missingRequiredFields,
    earliest: fact.earliest,
    latest: fact.latest,
    earliestKuwait: odooNaiveUtcToKuwaitDate(fact.earliest),
    latestKuwait: odooNaiveUtcToKuwaitDate(fact.latest),
  }
}

function scopeOrders(facts: AuditFacts, scope: ScopeName): ScopedOrders | null {
  return facts.scopedOrders[scope]
}

function decideFinance(facts: AuditFacts): string {
  const blocked = firstModelBlock(facts, 'finance')
  if (blocked) return blocked
  if (!facts.scopesReady) {
    return 'HOLD: the active register list was not read, so in-scope pos.order totals are unknown.'
  }
  const scoped = scopeOrders(facts, 'withQurain')
  if (!scoped) return 'HOLD: pos.order history on the with-Qurain scope was not read.'
  if (scoped.orders <= 0) {
    return 'HOLD: pos.order has no paid, done, or invoiced orders on the active registers (with Delivery/Qurain).'
  }
  return 'GO: account.move, account.move.line, pos.order, and account.analytic.line are readable and key fields are at least 80% complete.'
}

function decidePlatforms(facts: AuditFacts): string {
  const blocked = firstModelBlock(facts, 'platforms')
  if (blocked) return blocked
  if (!facts.scopesReady) {
    return 'HOLD: the active register list was not read, so payment methods cannot be scoped.'
  }
  const scoped = scopeOrders(facts, 'withQurain')
  if (!scoped) return 'HOLD: pos.order history on the with-Qurain scope was not read.'
  if (scoped.orders <= 0) {
    return 'HOLD: pos.order has no paid, done, or invoiced orders on the active registers (with Delivery/Qurain).'
  }
  const channels = facts.channels.withQurain
  if (channels == null) return 'HOLD: pos.payment could not be grouped by payment method.'
  const methods = channels.length
  return `GO: pos.order, pos.order.line, and pos.payment are readable, and payments group by method (${methods} methods on the with-Qurain scope in the last 60 Kuwait days).`
}

function decideWarehouse(facts: AuditFacts, withQurain: NoCostScope): string {
  const blocked = firstModelBlock(facts, 'warehouse')
  if (blocked) return blocked
  if (!facts.scopesReady) {
    return 'HOLD: the active register list was not read, so 60-day sales of zero-cost products are unknown.'
  }
  if (!facts.productsScanned) return 'HOLD: the zero-cost product scan did not finish.'
  if (facts.costReadable === false) {
    return 'HOLD: standard_price was absent on product.product and product.template, so a missing cost was not treated as zero.'
  }
  if (facts.standardPrice?.case === 'not_readable') {
    const productGroups = facts.standardPrice.productField.groups ?? 'none'
    const templateGroups = facts.standardPrice.templateField.groups ?? 'none'
    return `HOLD: standard_price is not readable for the integration user (${facts.standardPrice.counts.notReadable} active products). product.product groups: ${productGroups}. product.template groups: ${templateGroups}. The user needs read access on the cost field before accounting can enter or check costs.`
  }
  if (facts.productsTruncated) return 'HOLD: the zero-cost product scan was truncated before the time budget.'
  if (!facts.lineSalesRead) return 'HOLD: pos.order.line sales for the cost gap could not be grouped.'
  if (withQurain.totals.p1Count > 0) {
    const count = withQurain.totals.p1Count
    const noun = count === 1 ? 'product' : 'products'
    const verb = count === 1 ? 'has' : 'have'
    return `HOLD: ${count} active ${noun} sold in the last 60 days ${verb} a true standard_price <= 0 in every company in scope. Accounting needs to enter those costs.`
  }
  const contextZeros = facts.standardPrice?.counts.companyContextZero ?? 0
  if (contextZeros > 0) {
    return `GO: product cost, stock, scrap, bills of materials, and purchase lines are readable. ${contextZeros} products read as 0 in one company and have a cost in another, so that zero is the company context rather than a missing cost.`
  }
  return `GO: product cost, stock, scrap, bills of materials, and purchase lines are readable. No active product sold in the last 60 days has standard_price <= 0 (${withQurain.totals.p2Count} unsold zero-cost products remain).`
}

export function resolveAttendanceBranchLink(input: {
  attendanceFields: readonly string[]
  employeeFields: readonly string[]
  attendanceSample: readonly Record<string, unknown>[]
  employeeSample: readonly Record<string, unknown>[]
}): BranchLink {
  const attendance = new Set(input.attendanceFields)
  for (const field of ATTENDANCE_BRANCH_FIELDS) {
    if (!attendance.has(field)) continue
    if (input.attendanceSample.some((row) => isFilledOdooValue(row[field]))) {
      return { via: `hr.attendance.${field}`, populated: true }
    }
  }
  const employee = new Set(input.employeeFields)
  const canReachEmployee = attendance.has('employee_id')
  if (canReachEmployee) {
    for (const field of EMPLOYEE_BRANCH_FIELDS) {
      if (!employee.has(field)) continue
      if (input.employeeSample.some((row) => isFilledOdooValue(row[field]))) {
        return { via: `hr.employee.${field}`, populated: true }
      }
    }
  }
  for (const field of ATTENDANCE_BRANCH_FIELDS) {
    if (attendance.has(field)) return { via: `hr.attendance.${field}`, populated: false }
  }
  if (canReachEmployee) {
    for (const field of EMPLOYEE_BRANCH_FIELDS) {
      if (employee.has(field)) return { via: `hr.employee.${field}`, populated: false }
    }
  }
  return { via: null, populated: false }
}

function decideStaff(facts: AuditFacts): { reason: string; branchLink: BranchLink; hidden: boolean } {
  const attendance = facts.models['hr.attendance']
  const payslip = facts.models['hr.payslip']
  const branchLink = facts.staff ? resolveAttendanceBranchLink(facts.staff) : { via: null, populated: false }
  if (attendance?.access === 'ok' && attendance.rowCount === 0 && payslip?.access === 'denied') {
    return {
      reason: 'OFF: hr.attendance has no rows and hr.payslip is not readable, so the staff advisor is hidden.',
      branchLink,
      hidden: true,
    }
  }
  const blocked = firstModelBlock(facts, 'staff')
  if (blocked) return { reason: blocked, branchLink, hidden: false }
  if (!facts.staff) {
    return { reason: 'HOLD: attendance branch fields were not read.', branchLink, hidden: false }
  }
  if (!branchLink.populated) {
    if (branchLink.via) {
      return {
        reason: `HOLD: attendance has ${branchLink.via} but it is empty on the sample, so it cannot be tied to a branch.`,
        branchLink,
        hidden: false,
      }
    }
    return {
      reason: 'HOLD: attendance cannot be linked to a branch (no work location, department, or branch field on hr.attendance or hr.employee).',
      branchLink,
      hidden: false,
    }
  }
  return {
    reason: `GO: hr.attendance, hr.employee, and hr.payslip are readable, and attendance links to a branch via ${branchLink.via}.`,
    branchLink,
    hidden: false,
  }
}

function decideSeasons(facts: AuditFacts): string {
  const blocked = firstModelBlock(facts, 'seasons')
  if (blocked) return blocked
  if (!facts.scopesReady) {
    return 'HOLD: the active register list was not read, so pos.order history depth is unknown.'
  }
  const scoped = scopeOrders(facts, 'withQurain')
  const without = scopeOrders(facts, 'withoutQurain')
  if (!scoped) return 'HOLD: pos.order history on the with-Qurain scope was not read.'
  if (scoped.orders <= 0) {
    return 'HOLD: with-Qurain pos.order history has no paid, done, or invoiced orders.'
  }
  if (scoped.historyDays == null || !scoped.earliest || !scoped.latest) {
    return 'HOLD: with-Qurain pos.order dates were not read.'
  }
  const earliest = odooNaiveUtcToKuwaitDate(scoped.earliest)
  const latest = odooNaiveUtcToKuwaitDate(scoped.latest)
  const withoutDays = without?.historyDays
  const withoutNote =
    withoutDays == null ? '' : ` Without Qurain: ${withoutDays} days.`
  if (scoped.historyDays < SEASONS_MIN_HISTORY_DAYS) {
    return `HOLD: with-Qurain pos.order history covers ${scoped.historyDays} days (${earliest} to ${latest}); year-over-year needs at least ${SEASONS_MIN_HISTORY_DAYS}.${withoutNote}`
  }
  return `GO: with-Qurain pos.order history covers ${scoped.historyDays} days (${earliest} to ${latest}), which is at least ${SEASONS_MIN_HISTORY_DAYS}.${withoutNote}`
}

function indexLines(rows: readonly LineAgg[]): Map<number, { qty: number; netKwd: number }> {
  const map = new Map<number, { qty: number; netKwd: number }>()
  for (const row of rows) {
    if (!Number.isInteger(row.productId) || row.productId <= 0) continue
    const prev = map.get(row.productId) ?? { qty: 0, netKwd: 0 }
    map.set(row.productId, {
      qty: r3(prev.qty + row.qty),
      netKwd: r3(prev.netKwd + row.netKwd),
    })
  }
  return map
}

function sharePct(partKwd: number, wholeKwd: number): number | null {
  const whole = toFils(wholeKwd)
  if (whole === 0n) return null
  const part = toFils(partKwd)
  return Number((part * 1000n) / whole) / 10
}

function topSlice(rows: readonly NoCostProductRow[], size: number, allSales60NetKwd: number, noCostNet: number): NoCostTop {
  const taken = rows.slice(0, size)
  let net = 0
  for (const row of taken) net = r3(net + row.netKwd60)
  return {
    products: taken.length,
    netKwd: net,
    shareOfNoCostSales60Pct: sharePct(net, noCostNet),
    shareOfAllSales60Pct: sharePct(net, allSales60NetKwd),
  }
}

export function buildNoCostScope(products: readonly ProductInput[], sales: LineSalesInput): NoCostScope {
  const days30 = indexLines(sales.days30)
  const days60 = indexLines(sales.days60)
  const seen = new Set<number>()
  const rows: NoCostProductRow[] = []
  for (const product of products) {
    if (!Number.isInteger(product.id) || product.id <= 0 || seen.has(product.id)) continue
    if (toFils(product.standardPriceKwd) > 0n) continue
    seen.add(product.id)
    const recent = days30.get(product.id) ?? { qty: 0, netKwd: 0 }
    const window = days60.get(product.id) ?? { qty: 0, netKwd: 0 }
    const sold = toFils(window.qty) !== 0n || toFils(window.netKwd) !== 0n
    rows.push({
      productId: product.id,
      name: product.name.trim() || `Product ${product.id}`,
      defaultCode: product.defaultCode,
      standardPriceKwd: r3(product.standardPriceKwd),
      qty30: recent.qty,
      netKwd30: recent.netKwd,
      qty60: window.qty,
      netKwd60: window.netKwd,
      priority: sold ? 'P1' : 'P2',
      costSource: product.costSource ?? 'product.product',
    })
  }
  rows.sort((a, b) => b.netKwd60 - a.netKwd60 || b.qty60 - a.qty60 || a.productId - b.productId)
  let noCostNet = 0
  let p1Count = 0
  let p2Count = 0
  for (const row of rows) {
    noCostNet = r3(noCostNet + row.netKwd60)
    if (row.priority === 'P1') p1Count += 1
    else p2Count += 1
  }
  const allSales60NetKwd = r3(sales.allNet60Kwd)
  return {
    rows,
    totals: {
      p1Count,
      p2Count,
      noCostSales60NetKwd: noCostNet,
      allSales60NetKwd,
      top50: topSlice(rows, 50, allSales60NetKwd, noCostNet),
      top80: topSlice(rows, 80, allSales60NetKwd, noCostNet),
    },
  }
}

export function sumLineNet(rows: readonly LineAgg[]): number {
  let net = 0
  for (const row of rows) net = r3(net + (Number.isFinite(row.netKwd) ? row.netKwd : 0))
  return net
}

export function parseLineGroups(value: unknown): LineAgg[] | null {
  const rows = asRecordList(value)
  if (!rows) return null
  const parsed: LineAgg[] = []
  for (const row of rows) {
    const productId = m2oId(row.product_id)
    if (productId == null) continue
    parsed.push({
      productId,
      qty: r3(Number(row.qty) || 0),
      netKwd: r3(Number(row.price_subtotal) || 0),
    })
  }
  return parsed
}

export function parsePaymentGroups(value: unknown): ChannelRow[] | null {
  const rows = asRecordList(value)
  if (!rows) return null
  const parsed = rows.map((row) => ({
    paymentMethodId: m2oId(row.payment_method_id),
    paymentMethodName: m2oName(row.payment_method_id) || 'Unknown',
    amountKwd: r3(Number(row.amount) || 0),
    payments: Math.max(0, Math.round(Number(row.__count) || 0)),
  }))
  parsed.sort((a, b) => b.amountKwd - a.amountKwd || (a.paymentMethodId ?? 0) - (b.paymentMethodId ?? 0))
  return parsed
}

function configIdFromGroup(row: Record<string, unknown>, configField: string): number | null {
  return m2oId(row[configField]) ?? m2oId(row.config_id)
}

function dateFromGroup(row: Record<string, unknown>): string | null {
  const raw = row.date_order ?? row.date_order_min ?? row.date_order_max
  if (typeof raw !== 'string' || raw.trim() === '' || raw === 'false') return null
  return raw
}

export function buildCashierChecks(input: {
  configs: readonly PosConfigRow[]
  sums: readonly Record<string, unknown>[]
  mins: readonly Record<string, unknown>[]
  maxes: readonly Record<string, unknown>[]
  configField: string
  read: boolean
  fromKuwait: string
  toKuwait: string
}): CashierCheck[] {
  const meta = new Map(input.configs.map((row) => [row.id, row]))
  const agg = new Map<number, { orders: number; total: number; tax: number; first: string | null; last: string | null; companyId: number | null }>()
  const ensure = (id: number) => {
    const existing = agg.get(id)
    if (existing) return existing
    const created = { orders: 0, total: 0, tax: 0, first: null, last: null, companyId: null as number | null }
    agg.set(id, created)
    return created
  }
  if (input.read) {
    for (const row of input.sums) {
      const id = configIdFromGroup(row, input.configField)
      if (id == null) continue
      const bucket = ensure(id)
      bucket.orders += Math.max(0, Math.round(Number(row.__count) || 0))
      bucket.total += Number(row.amount_total) || 0
      bucket.tax += Number(row.amount_tax) || 0
      const companyId = m2oId(row.company_id)
      if (bucket.companyId == null && companyId != null) bucket.companyId = companyId
    }
    for (const row of input.mins) {
      const id = configIdFromGroup(row, input.configField)
      const date = dateFromGroup(row)
      if (id == null || !date) continue
      const bucket = ensure(id)
      if (!bucket.first || date < bucket.first) bucket.first = date
    }
    for (const row of input.maxes) {
      const id = configIdFromGroup(row, input.configField)
      const date = dateFromGroup(row)
      if (id == null || !date) continue
      const bucket = ensure(id)
      if (!bucket.last || date > bucket.last) bucket.last = date
    }
  }
  return CASHIER_CONFIG_IDS.map((configId) => {
    const config = meta.get(configId)
    const bucket = agg.get(configId)
    const window = { fromKuwait: input.fromKuwait, toKuwait: input.toKuwait }
    if (!input.read) {
      return {
        configId,
        name: config?.name ?? null,
        active: config ? config.active : null,
        found: Boolean(config),
        read: false,
        orders: null,
        netKwd: null,
        companyId: config?.companyId ?? null,
        firstOrderAt: null,
        lastOrderAt: null,
        firstOrderKuwait: null,
        lastOrderKuwait: null,
        window,
      }
    }
    return {
      configId,
      name: config?.name ?? null,
      active: config ? config.active : null,
      found: Boolean(config),
      read: true,
      orders: bucket?.orders ?? 0,
      netKwd: bucket ? posOrderNet(bucket.total, bucket.tax) : 0,
      companyId: bucket?.companyId ?? config?.companyId ?? null,
      firstOrderAt: bucket?.first ?? null,
      lastOrderAt: bucket?.last ?? null,
      firstOrderKuwait: odooNaiveUtcToKuwaitDate(bucket?.first ?? null),
      lastOrderKuwait: odooNaiveUtcToKuwaitDate(bucket?.last ?? null),
      window,
    }
  })
}

function scopeReport(
  name: ScopeName,
  configIds: readonly number[],
  orders: ScopedOrders | null,
  window: { orders: number; netKwd: number } | null,
): ScopeReport {
  return {
    name,
    includesQurain: name === 'withQurain',
    label:
      name === 'withQurain'
        ? 'Allow-list plus Delivery (Qurain) configs 24 and 36'
        : 'Allow-list with Qurain registers removed',
    configIds: [...configIds],
    orders: orders?.orders ?? null,
    earliest: orders?.earliest ?? null,
    latest: orders?.latest ?? null,
    earliestKuwait: odooNaiveUtcToKuwaitDate(orders?.earliest ?? null),
    latestKuwait: odooNaiveUtcToKuwaitDate(orders?.latest ?? null),
    historyDays: orders?.historyDays ?? null,
    orders2026: window?.orders ?? null,
    netKwd2026: window?.netKwd ?? null,
  }
}

function decisionOf(reason: string): ReadinessDecision {
  if (reason.startsWith('GO:')) return 'GO'
  if (reason.startsWith('OFF:')) return 'OFF'
  return 'HOLD'
}

export function assembleReadinessAudit(facts: AuditFacts): ReadinessReport {
  const resolved = facts.scopesReady ? resolveReadinessScopes(facts.configs) : { withoutQurain: [], withQurain: [], qurain: [] }
  const withoutProducts = buildNoCostScope(facts.products, facts.lineSales.withoutQurain)
  const withProducts = buildNoCostScope(facts.products, facts.lineSales.withQurain)
  const staff = decideStaff(facts)
  const reasons: Record<AdvisorId, string> = {
    finance: decideFinance(facts),
    platforms: decidePlatforms(facts),
    warehouse: decideWarehouse(facts, withProducts),
    staff: staff.reason,
    seasons: decideSeasons(facts),
  }
  const advisors: AdvisorReport[] = ADVISOR_ORDER.map((id) => {
    const report: AdvisorReport = {
      id,
      title: ADVISOR_TITLES[id],
      decision: decisionOf(reasons[id]),
      reason: reasons[id],
      models: ADVISOR_MODELS[id].map((model) =>
        toModelReport(facts.models[model] ?? uncheckedModelFact(specFor(model))),
      ),
    }
    if (id === 'platforms') {
      report.channels = {
        windowDays: 60,
        withoutQurain: facts.channels.withoutQurain,
        withQurain: facts.channels.withQurain,
      }
    }
    if (id === 'staff') {
      report.branchLink = staff.branchLink
      if (staff.hidden) report.hidden = true
    }
    return report
  })
  const cashiers = buildCashierChecks({
    configs: facts.configs,
    sums: facts.cashierSums,
    mins: facts.cashierMins,
    maxes: facts.cashierMaxes,
    configField: facts.cashierConfigField,
    read: facts.cashiersRead,
    fromKuwait: CASHIER_FROM_KUWAIT,
    toKuwait: facts.kuwaitToday < CASHIER_FROM_KUWAIT ? CASHIER_FROM_KUWAIT : facts.kuwaitToday,
  })
  return {
    ok: true,
    readOnly: true,
    generatedAt: facts.generatedAt,
    partial: facts.partial,
    budgetMs: facts.budgetMs,
    elapsedMs: facts.elapsedMs,
    currency: 'KWD',
    kuwaitToday: facts.kuwaitToday,
    salesStates: POS_SALE_STATES,
    scopes: {
      withoutQurain: scopeReport(
        'withoutQurain',
        resolved.withoutQurain,
        facts.scopedOrders.withoutQurain,
        facts.scopeWindow?.withoutQurain ?? null,
      ),
      withQurain: scopeReport(
        'withQurain',
        resolved.withQurain,
        facts.scopedOrders.withQurain,
        facts.scopeWindow?.withQurain ?? null,
      ),
    },
    qurainRegisters: resolved.qurain,
    standardPrice: facts.standardPrice ?? null,
    advisors,
    productsWithoutCost: {
      truncated: facts.productsTruncated,
      scanned: facts.productsScanned,
      lineSalesRead: facts.lineSalesRead,
      costFieldAbsent: facts.costAbsentCount ?? 0,
      withoutQurain: withoutProducts,
      withQurain: withProducts,
    },
    cashiers,
    notes: readinessNotes(facts),
  }
}

function specFor(model: string): ModelSpec {
  const found = READINESS_MODEL_SPECS.find((spec) => spec.model === model)
  if (found) return found
  return {
    model,
    dateField: null,
    keyFields: [],
    requiredFields: [],
    countDomain: [],
    extraFields: [],
    emptyRowsAllowed: false,
  }
}

function readinessNotes(facts: AuditFacts): string[] {
  const notes = [
    'Read-only. This audit does not write to Odoo or to the application database, and it adds no migration.',
    'Sales states are paid, done, and invoiced. Dates use Kuwait day boundaries (UTC+3).',
    'withQurain is the company allow-list plus pos.config 24 (Delivery (Qurain)) and 36 (Delivery (Qurain Temp)), including when 24 is excluded or 36 is inactive. withoutQurain is the allow-list with Qurain registers removed. Both scopes report net KWD from 2026-01-01 through today.',
    'standard_price is read with the in-scope company context and falls back to product.template. A field missing from the read is not treated as cost zero.',
    'Net KWD on orders is amount_total minus amount_tax. Net KWD on lines is price_subtotal. Both are rounded to 3 decimals.',
    `Key-field completeness is the share of filled values on a sample of up to ${COMPLETENESS_SAMPLE_SIZE} rows. A model passes at ${COMPLETENESS_GO_MIN_PCT}% or more.`,
    `Cashier configs ${CASHIER_CONFIG_IDS.join(', ')} are reported even when they sit outside the sales allow-list. The window is ${CASHIER_FROM_KUWAIT} through today, Kuwait time.`,
    'Seasons needs at least 365 days between the earliest and latest in-scope order (Kuwait dates) on the with-Qurain scope.',
  ]
  if (facts.partial) notes.push('The 60 second budget ended before every read finished. Unchecked models are HOLD.')
  return notes
}

const BANNED_REPORT_KEY = /^(odooUrl|odooDb|odooUsername|odooLogin|odooApiKey|database|password|apiKey|token|secret)$/i

export function sanitizeReadinessReport<T>(value: T): T {
  const json = JSON.stringify(value, (key, current: unknown) => {
    if (BANNED_REPORT_KEY.test(key)) return undefined
    return current
  })
  return JSON.parse(json) as T
}

function csvCell(value: unknown): string {
  if (value == null) return ''
  const text = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)
  const guarded = /^[=+@]/.test(text) || /^-[^0-9.]/.test(text) ? `'${text}` : text
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`
  return guarded
}

const CSV_HEADER = [
  'section',
  'scope',
  'advisor',
  'decision',
  'reason',
  'model',
  'readable',
  'access',
  'row_count',
  'completeness_pct',
  'sample_size',
  'earliest',
  'latest',
  'product_id',
  'product_name',
  'default_code',
  'standard_price_kwd',
  'priority',
  'qty_30',
  'net_kwd_30',
  'qty_60',
  'net_kwd_60',
  'config_id',
  'config_name',
  'active',
  'orders',
  'net_kwd',
  'first_order_at',
  'last_order_at',
  'payment_method',
  'amount_kwd',
  'payments',
  'p1_count',
  'p2_count',
  'share_top50_of_nocost_pct',
  'share_top80_of_nocost_pct',
  'share_top50_of_all_pct',
  'share_top80_of_all_pct',
] as const

function csvRow(values: readonly unknown[]): string {
  const padded = CSV_HEADER.map((_, index) => csvCell(values[index]))
  return padded.join(',')
}

export function readinessAuditToCsv(report: ReadinessReport): string {
  const lines: string[] = [CSV_HEADER.join(',')]
  lines.push(csvRow(['meta', '', '', '', report.generatedAt, 'generatedAt']))
  lines.push(csvRow(['meta', '', '', '', report.kuwaitToday, 'kuwaitToday']))
  lines.push(csvRow(['meta', '', '', '', String(report.partial), 'partial']))
  lines.push(csvRow(['meta', '', '', '', report.salesStates.join('|'), 'salesStates']))
  lines.push(csvRow(['meta', 'withoutQurain', '', '', report.scopes.withoutQurain.configIds.join('|'), 'configIds']))
  lines.push(csvRow(['meta', 'withQurain', '', '', report.scopes.withQurain.configIds.join('|'), 'configIds']))
  for (const advisor of report.advisors) {
    lines.push(csvRow(['advisor', '', advisor.id, advisor.decision, advisor.reason]))
    for (const model of advisor.models) {
      lines.push(
        csvRow([
          'model',
          '',
          advisor.id,
          advisor.decision,
          '',
          model.model,
          model.readable,
          model.access,
          model.rowCount,
          model.completenessPct,
          model.sampleSize,
          model.earliest,
          model.latest,
        ]),
      )
    }
    if (advisor.channels) {
      for (const scope of ['withoutQurain', 'withQurain'] as const) {
        const rows = advisor.channels[scope]
        if (!rows) {
          lines.push(csvRow(['channel', scope, advisor.id, '', 'not read']))
          continue
        }
        for (const row of rows) {
          lines.push(
            csvRow([
              'channel',
              scope,
              advisor.id,
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              row.paymentMethodName,
              row.amountKwd,
              row.payments,
            ]),
          )
        }
      }
    }
  }
  for (const scope of ['withoutQurain', 'withQurain'] as const) {
    const block = report.productsWithoutCost[scope]
    lines.push(
      csvRow([
        'nocost_totals',
        scope,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        block.totals.noCostSales60NetKwd,
        '',
        '',
        '',
        '',
        '',
        block.totals.p1Count,
        block.totals.p2Count,
        block.totals.top50.shareOfNoCostSales60Pct,
        block.totals.top80.shareOfNoCostSales60Pct,
        block.totals.top50.shareOfAllSales60Pct,
        block.totals.top80.shareOfAllSales60Pct,
      ]),
    )
    for (const row of block.rows) {
      lines.push(
        csvRow([
          'nocost_product',
          scope,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          row.productId,
          row.name,
          row.defaultCode,
          row.standardPriceKwd,
          row.priority,
          row.qty30,
          row.netKwd30,
          row.qty60,
          row.netKwd60,
        ]),
      )
    }
  }
  for (const cashier of report.cashiers) {
    lines.push(
      csvRow([
        'cashier',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        cashier.configId,
        cashier.name,
        cashier.active,
        cashier.orders,
        cashier.netKwd,
        cashier.firstOrderAt,
        cashier.lastOrderAt,
      ]),
    )
  }
  return `\uFEFF${lines.join('\n')}\n`
}

export function kuwaitTodayOr(override: string | undefined, nowMs: number): string {
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override
  return getKuwaitTodayIso(nowMs)
}

export function orderHistoryDomain(configIds: readonly number[], toExclusiveUtc: string): unknown[][] {
  return buildPosOrderUtcDomain({
    fromUtc: '2000-01-01 00:00:00',
    toExclusiveUtc,
    configIds,
  })
}

export function paymentWindowDomain(configIds: readonly number[], fromUtc: string, toExclusiveUtc: string): unknown[][] {
  return buildPosPaymentUtcDomain({
    fromUtc,
    toExclusiveUtc,
    configIds,
  })
}

export function emptyLineSales(): LineSalesInput {
  return { days30: [], days60: [], allNet60Kwd: 0 }
}

export { kuwaitDateBoundsToOdooUtc }
