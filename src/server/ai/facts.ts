import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { PER_CUSTOMER_DUE_DATE_AGING_VERIFIED, RECEIVABLES_PENDING_STATUS } from '@/lib/aether/receivables-status'
import type { BriefFact, BriefSection } from './brief-types'
import { decimalFromNumber } from './number-guard'
import { factForGuard, sanitizePeriodOdooIds, sourceForMetric, type PeriodOdooIds } from './source-links'

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000
const MAX_PRODUCTS = 12
const MAX_HOURS = 12
const PACK_CHAR_LIMIT = 18_000

export interface BriefCubeInput {
  connected?: boolean
  noData?: boolean
  dateRange?: { from?: string; to?: string }
  totals?: { netSalesKwd?: number; orders?: number }
  byBranch?: Record<string, { netKwd?: number; orders?: number }>
  byBrand?: Record<string, { netKwd?: number }>
  unattributed?: { netKwd?: number; orders?: number }
  hourlySeries?: { hour?: number; netKwd?: number; orders?: number }[]
  topProducts?: { productId?: number; name?: string; netKwd?: number }[]
  posConfigIds?: {
    companyId?: number | null
    configIdsByBranch?: Record<string, number[]>
    excludedConfigIds?: number[]
    excludedPosCategoryIds?: number[]
  } | null
  accounting?: {
    available?: boolean
    glIncomplete?: boolean
    cogs?: number
    deliveryCommissions?: number
    aggregatorCommissionUnposted?: boolean
  } | null
}

export interface BriefPurchaseInput {
  connected?: boolean
  noData?: boolean
  totals?: { totalAmountKwd?: number }
}

export interface BriefReceivableInput {
  readable?: boolean
  openReceivableKwd?: number
}

export interface BriefFactPack {
  periods: { yesterday: string; prior: string }
  sections: BriefSection[]
  facts: BriefFact[]
  odoo: 'linked' | 'not_linked'
}

export function kuwaitCalendarDate(referenceNowMs: number): string {
  const safe = Number.isFinite(referenceNowMs) ? referenceNowMs : Date.now()
  return new Date(safe + KUWAIT_OFFSET_MS).toISOString().slice(0, 10)
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Yesterday and the day before, in Asia/Kuwait. The morning job analyzes completed days. */
export function kuwaitBriefDays(referenceNowMs: number): { yesterday: string; prior: string } {
  const today = kuwaitCalendarDate(referenceNowMs)
  return { yesterday: shiftIsoDate(today, -1), prior: shiftIsoDate(today, -2) }
}

function cubeReady(cube: BriefCubeInput | null): cube is BriefCubeInput {
  return Boolean(cube && cube.connected && !cube.noData && typeof cube.totals?.netSalesKwd === 'number')
}

function periodOf(cube: BriefCubeInput, fallback: string): string {
  const from = cube.dateRange?.from || fallback
  const to = cube.dateRange?.to || from
  return from === to ? from : `${from}..${to}`
}

function addFact(facts: BriefFact[], fact: BriefFact): void {
  if (isExcludedOdooEntity(fact.scope) || isExcludedOdooEntity(fact.id)) return
  facts.push(fact)
}

function idsOf(cube: BriefCubeInput | null): PeriodOdooIds | null {
  if (!cube?.posConfigIds) return null
  return sanitizePeriodOdooIds(cube.posConfigIds)
}

function factDate(period: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(period)
  if (range && range[1] === range[2]) return range[1]
  return undefined
}

function entityFields(metric: string, scope: string, entityId?: string): Pick<BriefFact, 'entityType' | 'entityId'> {
  if (metric.startsWith('hourly')) return { entityType: 'hour', entityId: scope }
  if (metric.startsWith('product')) return { entityType: 'product', entityId }
  if (metric.startsWith('brand')) return { entityType: 'brand', entityId: scope }
  if (scope === 'company') return { entityType: 'company', entityId: 'company' }
  return { entityType: 'branch', entityId: scope }
}

function pushAmount(
  facts: BriefFact[],
  metric: string,
  period: string,
  scope: string,
  amount: number | undefined,
  unit: BriefFact['unit'],
  ids: PeriodOdooIds | null,
): void {
  if (typeof amount !== 'number') return
  const value = decimalFromNumber(amount)
  if (!value) return
  addFact(facts, {
    id: `${metric}|${scope}|${period}`,
    metric,
    date: factDate(period),
    period,
    scope,
    ...entityFields(metric, scope),
    value,
    unit,
    source: sourceForMetric({ metric, period, scope, productId: null, ids }),
  })
}

function appendSales(facts: BriefFact[], cube: BriefCubeInput, fallbackPeriod: string): { productsTruncated: boolean; hoursTruncated: boolean } {
  const period = periodOf(cube, fallbackPeriod)
  const ids = idsOf(cube)
  pushAmount(facts, 'net_sales_kwd', period, 'company', cube.totals?.netSalesKwd, 'KWD', ids)
  pushAmount(facts, 'orders', period, 'company', cube.totals?.orders, 'orders', ids)
  for (const [branch, row] of Object.entries(cube.byBranch ?? {})) {
    pushAmount(facts, 'net_sales_kwd', period, branch, row?.netKwd, 'KWD', ids)
    pushAmount(facts, 'orders', period, branch, row?.orders, 'orders', ids)
  }
  if (cube.unattributed) {
    pushAmount(facts, 'net_sales_kwd', period, 'unattributed', cube.unattributed.netKwd, 'KWD', ids)
    pushAmount(facts, 'orders', period, 'unattributed', cube.unattributed.orders, 'orders', ids)
  }
  for (const [brand, row] of Object.entries(cube.byBrand ?? {})) {
    pushAmount(facts, 'brand_net_sales_kwd', period, brand, row?.netKwd, 'KWD', ids)
  }

  const products = (cube.topProducts ?? [])
    .filter((row) => typeof row.netKwd === 'number' && row.netKwd > 0 && typeof row.name === 'string' && row.name.trim())
    .filter((row) => !isExcludedOdooEntity(row.name ?? ''))
    .sort((a, b) => (b.netKwd ?? 0) - (a.netKwd ?? 0))
  for (const row of products.slice(0, MAX_PRODUCTS)) {
    const name = row.name?.trim() ?? ''
    const value = typeof row.netKwd === 'number' ? decimalFromNumber(row.netKwd) : null
    const identity = typeof row.productId === 'number' ? String(row.productId) : name
    if (!value || !name) continue
    addFact(facts, {
      id: `product_net_sales_kwd|${identity}|${period}`,
      metric: 'product_net_sales_kwd',
      date: factDate(period),
      period,
      scope: name,
      ...entityFields('product_net_sales_kwd', name, typeof row.productId === 'number' ? String(row.productId) : undefined),
      value,
      unit: 'KWD',
      source: sourceForMetric({
        metric: 'product_net_sales_kwd',
        period,
        scope: name,
        productId: typeof row.productId === 'number' ? row.productId : null,
        ids,
      }),
    })
  }

  const hours = (cube.hourlySeries ?? [])
    .filter((row) => typeof row.hour === 'number' && Number.isInteger(row.hour) && ((row.netKwd ?? 0) !== 0 || (row.orders ?? 0) !== 0))
    .sort((a, b) => (b.netKwd ?? 0) - (a.netKwd ?? 0))
  for (const row of hours.slice(0, MAX_HOURS)) {
    pushAmount(facts, 'hourly_net_sales_kwd', period, String(row.hour), row.netKwd, 'KWD', ids)
  }
  return { productsTruncated: products.length > MAX_PRODUCTS, hoursTruncated: hours.length > MAX_HOURS }
}

function appendAccounting(facts: BriefFact[], cube: BriefCubeInput | null, period: string, sections: BriefSection[], ids: PeriodOdooIds | null): void {
  const accounting = cube?.accounting
  if (!cubeReady(cube) || !accounting) {
    sections.push({ id: 'cogs', status: 'not_linked', noteAr: 'لا توجد تكلفة مبيعات مرتبطة من قيود Odoo لهذه الفترة.' })
    sections.push({ id: 'commissions', status: 'not_linked', noteAr: 'لا توجد عمولة توصيل مرتبطة من قيود Odoo لهذه الفترة.' })
    return
  }
  const citedPeriod = periodOf(cube, period)
  if (!accounting.available || accounting.glIncomplete) {
    sections.push({ id: 'cogs', status: 'unverified', noteAr: 'قيود غير مكتملة لهذه الفترة.' })
    sections.push({ id: 'commissions', status: 'unverified', noteAr: 'قيود غير مكتملة لهذه الفترة.' })
    return
  }
  if (typeof accounting.cogs === 'number') {
    pushAmount(facts, 'cogs_kwd', citedPeriod, 'company', accounting.cogs, 'KWD', ids)
    sections.push({ id: 'cogs', status: 'linked', noteAr: 'من قيود Odoo المرحلة.' })
  } else {
    sections.push({ id: 'cogs', status: 'not_linked', noteAr: 'لا توجد تكلفة مبيعات مرتبطة من قيود Odoo لهذه الفترة.' })
  }
  if (accounting.aggregatorCommissionUnposted) {
    sections.push({ id: 'commissions', status: 'unverified', noteAr: 'غير مُرحَّل بعد.' })
    return
  }
  if (typeof accounting.deliveryCommissions === 'number') {
    pushAmount(facts, 'delivery_commission_kwd', citedPeriod, 'company', accounting.deliveryCommissions, 'KWD', ids)
    sections.push({ id: 'commissions', status: 'linked', noteAr: 'من قيود Odoo المرحلة.' })
  } else {
    sections.push({ id: 'commissions', status: 'not_linked', noteAr: 'لا توجد عمولة توصيل مرتبطة من قيود Odoo لهذه الفترة.' })
  }
}

export function buildBriefFactPack(input: {
  yesterday: string
  prior: string
  current: BriefCubeInput | null
  priorCube: BriefCubeInput | null
  purchases: BriefPurchaseInput | null
  receivables: BriefReceivableInput | null
}): BriefFactPack {
  const facts: BriefFact[] = []
  const sections: BriefSection[] = []
  const current = input.current
  const priorCube = input.priorCube
  const currentReady = cubeReady(current)
  const priorReady = cubeReady(priorCube)
  let productsTruncated = false
  let hoursTruncated = false
  if (cubeReady(current)) {
    const flags = appendSales(facts, current, input.yesterday)
    productsTruncated = flags.productsTruncated
    hoursTruncated = flags.hoursTruncated
  }
  if (cubeReady(priorCube)) {
    const flags = appendSales(facts, priorCube, input.prior)
    productsTruncated = productsTruncated || flags.productsTruncated
    hoursTruncated = hoursTruncated || flags.hoursTruncated
  }
  sections.push({
    id: 'sales',
    status: currentReady || priorReady ? 'linked' : 'not_linked',
    noteAr: currentReady || priorReady ? '' : 'لا توجد مبيعات من Odoo لهذه الفترة.',
  })
  if (currentReady && !priorReady) {
    sections.push({ id: 'prior_period', status: 'not_linked', noteAr: 'اليوم السابق غير مرتبط.' })
  }
  sections.push({
    id: 'products',
    status: facts.some((fact) => fact.metric === 'product_net_sales_kwd') ? 'linked' : 'not_linked',
    noteAr: productsTruncated ? 'المنتجات المعروضة جزء من المنتجات المباعة في الفترة.' : facts.some((fact) => fact.metric === 'product_net_sales_kwd') ? '' : 'لا توجد منتجات مباعة في الفترة.',
  })
  sections.push({
    id: 'hours',
    status: facts.some((fact) => fact.metric === 'hourly_net_sales_kwd') ? 'linked' : 'not_linked',
    noteAr: hoursTruncated ? 'الساعات المعروضة جزء من ساعات اليوم ذات المبيعات.' : facts.some((fact) => fact.metric === 'hourly_net_sales_kwd') ? '' : 'لا توجد مبيعات ساعية في الفترة.',
  })

  appendAccounting(facts, input.current, input.yesterday, sections, idsOf(input.current))

  const purchasePeriod = input.yesterday
  if (input.purchases?.connected && !input.purchases.noData && typeof input.purchases.totals?.totalAmountKwd === 'number') {
    pushAmount(facts, 'purchase_total_kwd', purchasePeriod, 'company', input.purchases.totals.totalAmountKwd, 'KWD', idsOf(input.current))
    sections.push({ id: 'purchases', status: 'linked', noteAr: 'إجمالي أوامر الشراء للفترة، وليس تكلفة المبيعات.' })
  } else {
    sections.push({ id: 'purchases', status: 'not_linked', noteAr: 'لا توجد أوامر شراء مرتبطة لهذه الفترة.' })
  }

  if (input.receivables?.readable && !PER_CUSTOMER_DUE_DATE_AGING_VERIFIED) {
    // Phase 5 · Item 2: no receivable amount reaches the AI until per-customer aging is verified.
    sections.push({ id: 'receivables', status: 'linked', noteAr: RECEIVABLES_PENDING_STATUS.ar })
  } else if (input.receivables?.readable && typeof input.receivables.openReceivableKwd === 'number') {
    pushAmount(facts, 'open_receivable_kwd', input.yesterday, 'company', input.receivables.openReceivableKwd, 'KWD', null)
    sections.push({ id: 'receivables', status: 'linked', noteAr: 'الرصيد المفتوح من Odoo.' })
  } else {
    sections.push({ id: 'receivables', status: 'not_linked', noteAr: 'لا توجد أرصدة مدينة مقروءة من Odoo.' })
  }
  sections.push({ id: 'receivables_aging', status: 'unverified', noteAr: 'أعمار الديون غير مُتحققة وغير مدرجة.' })

  const droppable = facts.filter((fact) => fact.metric === 'hourly_net_sales_kwd' || fact.metric === 'product_net_sales_kwd')
  const kept = facts.filter((fact) => fact.metric !== 'hourly_net_sales_kwd' && fact.metric !== 'product_net_sales_kwd')
  const packed = [...kept]
  for (const fact of droppable) {
    if (JSON.stringify([...packed, fact]).length > PACK_CHAR_LIMIT) break
    packed.push(fact)
  }
  const droppedSome = packed.length < facts.length
  if (droppedSome) {
    const note = sections.find((section) => section.id === 'products')
    if (note && !note.noteAr) note.noteAr = 'المنتجات والساعات المعروضة جزء من صفوف Odoo للفترة.'
  }

  return {
    periods: { yesterday: input.yesterday, prior: input.prior },
    sections,
    facts: packed,
    odoo: packed.length > 0 ? 'linked' : 'not_linked',
  }
}

export function briefPromptPayload(pack: BriefFactPack): string {
  return JSON.stringify({
    periods: pack.periods,
    sections: pack.sections,
    facts: pack.facts.map((fact) => factForGuard(fact)),
  })
}
