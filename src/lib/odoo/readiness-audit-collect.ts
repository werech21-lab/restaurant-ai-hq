/**
 * Read-only Odoo collection for the readiness audit.
 * The client is injected. The only methods requested are search_read, read,
 * read_group, search_count, and fields_get. Nothing here writes.
 */
import {
  CASHIER_CONFIG_IDS,
  CASHIER_FROM_KUWAIT,
  COMPLETENESS_SAMPLE_SIZE,
  MAX_ZERO_COST_PRODUCTS,
  READINESS_BUDGET_MS,
  READINESS_MIN_REMAINING_MS,
  READINESS_MODEL_SPECS,
  READINESS_PAGE_SIZE,
  asRecordList,
  buildCashierOrderDomain,
  buildPosOrderLineDomain,
  classifyOdooReadFailure,
  emptyLineSales,
  fieldCompletenessPct,
  historyDaySpan,
  isFatalOdooFailure,
  isOdooReadMethod,
  kuwaitDateBoundsToOdooUtc,
  kuwaitTodayOr,
  m2oId,
  orderHistoryDomain,
  parseLineGroups,
  parsePaymentGroups,
  paymentWindowDomain,
  probeFieldNames,
  r3,
  resolveReadinessScopes,
  sumLineNet,
  trailingKuwaitWindow,
  uncheckedModelFact,
  assembleReadinessAudit,
  type AuditFacts,
  type ChannelRow,
  type LineAgg,
  type LineSalesInput,
  type ModelFact,
  type ModelSpec,
  type OdooReadMethod,
  type PosConfigRow,
  type ProductInput,
  type ReadinessReport,
  type ScopeName,
  type ScopedOrders,
} from '@/lib/odoo/readiness-audit'

export interface OdooReadClient {
  execute<T>(
    model: string,
    method: OdooReadMethod,
    args?: unknown[],
    kwargs?: Record<string, unknown>,
  ): Promise<T>
}

export interface CollectOptions {
  clock?: () => number
  budgetMs?: number
  minRemainingMs?: number
  generatedAt?: string
  kuwaitToday?: string
}

const SCOPES: readonly ScopeName[] = ['withoutQurain', 'withQurain']

export async function collectReadinessAudit(
  client: OdooReadClient,
  options: CollectOptions = {},
): Promise<ReadinessReport> {
  const clock = options.clock ?? Date.now
  const started = clock()
  const budgetMs = options.budgetMs ?? READINESS_BUDGET_MS
  const minRemainingMs = options.minRemainingMs ?? READINESS_MIN_REMAINING_MS
  const generatedAt = options.generatedAt ?? new Date(started).toISOString()
  const kuwaitToday = kuwaitTodayOr(options.kuwaitToday, started)
  let partial = false

  const remaining = () => budgetMs - (clock() - started)
  const canStart = () => remaining() > minRemainingMs

  async function read<T>(model: string, method: OdooReadMethod, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
    if (!isOdooReadMethod(method)) {
      throw new Error(`Refusing Odoo method ${method}`)
    }
    if (!canStart()) {
      partial = true
      throw new BudgetStop()
    }
    return client.execute<T>(model, method, args, kwargs)
  }

  const models: Record<string, ModelFact> = {}
  for (const spec of READINESS_MODEL_SPECS) models[spec.model] = uncheckedModelFact(spec)

  const fieldNames = new Map<string, string[]>()
  const samples = new Map<string, Record<string, unknown>[]>()
  let scopesReady = false
  let configs: PosConfigRow[] = []
  const scopedOrders: Record<ScopeName, ScopedOrders | null> = { withoutQurain: null, withQurain: null }
  const channels: Record<ScopeName, ChannelRow[] | null> = { withoutQurain: null, withQurain: null }
  let products: ProductInput[] = []
  let productsScanned = false
  let productsTruncated = false
  let lineSalesRead = false
  const lineSales: Record<ScopeName, LineSalesInput> = {
    withoutQurain: emptyLineSales(),
    withQurain: emptyLineSales(),
  }
  let cashiersRead = false
  let cashierSums: Record<string, unknown>[] = []
  let cashierMins: Record<string, unknown>[] = []
  let cashierMaxes: Record<string, unknown>[] = []
  let cashierConfigField = 'config_id'

  try {
    configs = await readConfigs(read)
    scopesReady = true
  } catch (error) {
    if (error instanceof BudgetStop) partial = true
    else if (isFatalOdooFailure(error)) throw error
    else scopesReady = false
  }

  if (canStart()) {
    for (const spec of READINESS_MODEL_SPECS) {
      if (!canStart()) {
        partial = true
        break
      }
      try {
        const probed = await probeModel(read, spec)
        models[spec.model] = probed.fact
        fieldNames.set(spec.model, probed.fields)
        samples.set(spec.model, probed.sample)
      } catch (error) {
        if (error instanceof BudgetStop) {
          partial = true
          break
        }
        if (isFatalOdooFailure(error)) throw error
        models[spec.model] = failedFact(spec, error)
      }
    }
  } else {
    partial = true
  }

  const resolvedIds = scopesReady ? scopeIds(configs) : { withoutQurain: [] as number[], withQurain: [] as number[] }
  const todayBounds = kuwaitDateBoundsToOdooUtc(kuwaitToday, kuwaitToday)

  if (scopesReady && canStart()) {
    for (const scope of SCOPES) {
      if (!canStart()) {
        partial = true
        break
      }
      try {
        scopedOrders[scope] = await readScopedOrders(read, resolvedIds[scope], todayBounds.toExclusiveUtc)
      } catch (error) {
        if (error instanceof BudgetStop) {
          partial = true
          break
        }
        if (isFatalOdooFailure(error)) throw error
        scopedOrders[scope] = null
      }
    }
  } else if (scopesReady) {
    partial = true
  }

  const orderFields = new Set(fieldNames.get('pos.order') ?? [])
  cashierConfigField = orderFields.has('config_id') ? 'config_id' : 'session_id.config_id'
  if (canStart()) {
    try {
      const yearEnd = kuwaitToday < CASHIER_FROM_KUWAIT ? CASHIER_FROM_KUWAIT : kuwaitToday
      const year = kuwaitDateBoundsToOdooUtc(CASHIER_FROM_KUWAIT, yearEnd)
      const grouped = await readCashierGroups(read, cashierConfigField, year.fromUtc, year.toExclusiveUtc)
      cashierSums = grouped.sums
      cashierMins = grouped.mins
      cashierMaxes = grouped.maxes
      cashiersRead = true
    } catch (error) {
      if (error instanceof BudgetStop) partial = true
      else if (isFatalOdooFailure(error)) throw error
      else cashiersRead = false
    }
  } else {
    partial = true
  }

  const window60 = trailingKuwaitWindow(kuwaitToday, 60)
  const bounds60 = kuwaitDateBoundsToOdooUtc(window60.from, window60.to)
  if (scopesReady && canStart()) {
    for (const scope of SCOPES) {
      if (!canStart()) {
        partial = true
        break
      }
      const ids = resolvedIds[scope]
      if (ids.length === 0) {
        channels[scope] = []
        continue
      }
      try {
        const grouped = await read(
          'pos.payment',
          'read_group',
          [paymentWindowDomain(ids, bounds60.fromUtc, bounds60.toExclusiveUtc), ['amount:sum'], ['payment_method_id']],
          { lazy: false },
        )
        channels[scope] = parsePaymentGroups(grouped) ?? null
      } catch (error) {
        if (error instanceof BudgetStop) {
          partial = true
          break
        }
        if (isFatalOdooFailure(error)) throw error
        channels[scope] = null
      }
    }
  } else if (scopesReady) {
    partial = true
  }

  if (canStart()) {
    try {
      const paged = await readZeroCostProducts(read)
      products = paged.products
      productsTruncated = paged.truncated
      productsScanned = !paged.stopped
      if (paged.stopped) partial = true
    } catch (error) {
      if (error instanceof BudgetStop) partial = true
      else if (isFatalOdooFailure(error)) throw error
      else productsScanned = false
    }
  } else {
    partial = true
  }

  const window30 = trailingKuwaitWindow(kuwaitToday, 30)
  const bounds30 = kuwaitDateBoundsToOdooUtc(window30.from, window30.to)
  const lineFields = new Set(fieldNames.get('pos.order.line') ?? ['price_subtotal', 'qty', 'product_id'])
  const netField = lineFields.has('price_subtotal') ? 'price_subtotal' : 'price_subtotal_incl'
  if (productsScanned && scopesReady && canStart()) {
    let linesOk = true
    for (const scope of SCOPES) {
      if (!canStart()) {
        partial = true
        linesOk = false
        break
      }
      const ids = resolvedIds[scope]
      if (ids.length === 0) {
        lineSales[scope] = emptyLineSales()
        continue
      }
      try {
        const [days30, days60] = await Promise.all([
          readLineGroup(read, ids, bounds30.fromUtc, bounds30.toExclusiveUtc, netField),
          readLineGroup(read, ids, bounds60.fromUtc, bounds60.toExclusiveUtc, netField),
        ])
        if (!days30 || !days60) {
          linesOk = false
          break
        }
        lineSales[scope] = { days30, days60, allNet60Kwd: sumLineNet(days60) }
      } catch (error) {
        if (error instanceof BudgetStop) {
          partial = true
          linesOk = false
          break
        }
        if (isFatalOdooFailure(error)) throw error
        linesOk = false
        break
      }
    }
    lineSalesRead = linesOk
  } else if (productsScanned && scopesReady) {
    partial = true
  }

  const attendanceFields = fieldNames.get('hr.attendance') ?? []
  const employeeFields = fieldNames.get('hr.employee') ?? []
  const staff =
    models['hr.attendance']?.access === 'ok' && models['hr.employee']?.access === 'ok'
      ? {
          attendanceFields,
          employeeFields,
          attendanceSample: samples.get('hr.attendance') ?? [],
          employeeSample: samples.get('hr.employee') ?? [],
        }
      : null

  const facts: AuditFacts = {
    generatedAt,
    elapsedMs: Math.max(0, clock() - started),
    budgetMs,
    partial,
    kuwaitToday,
    scopesReady,
    configs,
    models,
    scopedOrders,
    channels,
    products,
    productsScanned,
    productsTruncated,
    lineSalesRead,
    lineSales,
    cashiersRead,
    cashierSums,
    cashierMins,
    cashierMaxes,
    cashierConfigField,
    staff,
  }
  return assembleReadinessAudit(facts)
}

class BudgetStop extends Error {
  constructor() {
    super('budget')
    this.name = 'BudgetStop'
  }
}

type ReadFn = <T>(
  model: string,
  method: OdooReadMethod,
  args?: unknown[],
  kwargs?: Record<string, unknown>,
) => Promise<T>

async function readConfigs(read: ReadFn): Promise<PosConfigRow[]> {
  const rows: PosConfigRow[] = []
  let offset = 0
  for (;;) {
    const page = await read<unknown>('pos.config', 'search_read', [[]], {
      fields: ['id', 'name', 'active'],
      limit: READINESS_PAGE_SIZE,
      offset,
      order: 'id asc',
      context: { active_test: false },
    })
    const list = asRecordList(page) ?? []
    for (const row of list) {
      const id = m2oId(row.id)
      if (id == null) continue
      rows.push({
        id,
        name: typeof row.name === 'string' ? row.name : `pos.config ${id}`,
        active: row.active !== false,
      })
    }
    if (list.length < READINESS_PAGE_SIZE) break
    offset += list.length
    if (offset >= 1_000) break
  }
  const have = new Set(rows.map((row) => row.id))
  const missing = CASHIER_CONFIG_IDS.filter((id) => !have.has(id))
  if (missing.length > 0) {
    const cashierDomain: unknown[][] = [['id', 'in', [...missing]]]
    const extra = await read<unknown>('pos.config', 'search_read', [cashierDomain], {
      fields: ['id', 'name', 'active'],
      limit: missing.length,
      context: { active_test: false },
    })
    for (const row of asRecordList(extra) ?? []) {
      const id = m2oId(row.id)
      if (id == null || have.has(id)) continue
      rows.push({
        id,
        name: typeof row.name === 'string' ? row.name : `pos.config ${id}`,
        active: row.active !== false,
      })
    }
  }
  return rows
}

function scopeIds(configs: readonly PosConfigRow[]): Record<ScopeName, number[]> {
  const resolved = resolveReadinessScopes(configs)
  return { withoutQurain: resolved.withoutQurain, withQurain: resolved.withQurain }
}

async function probeModel(
  read: ReadFn,
  spec: ModelSpec,
): Promise<{ fact: ModelFact; fields: string[]; sample: Record<string, unknown>[] }> {
  const wanted = probeFieldNames(spec)
  const described = await read<unknown>(spec.model, 'fields_get', [wanted], { attributes: ['type', 'string'] })
  if (!described || typeof described !== 'object' || Array.isArray(described)) {
    return { fact: failedFact(spec, new Error('fields_get returned an unexpected payload')), fields: [], sample: [] }
  }
  const fields = Object.keys(described as Record<string, unknown>)
  const fieldSet = new Set(fields)
  const missingRequiredFields = spec.requiredFields.filter((field) => !fieldSet.has(field))
  const count = await read<unknown>(spec.model, 'search_count', [[...spec.countDomain]])
  const rowCount = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : null
  const presentKeys = spec.keyFields.filter((field) => fieldSet.has(field))
  const sampleFields = [
    ...new Set([...presentKeys, ...spec.extraFields.filter((field) => fieldSet.has(field))]),
  ]
  let sample: Record<string, unknown>[] = []
  let completenessMeasured = rowCount === 0
  let completenessPct: number | null = null
  if (rowCount != null && rowCount > 0 && sampleFields.length > 0) {
    const sampled = await read<unknown>(spec.model, 'search_read', [[...spec.countDomain]], {
      fields: sampleFields,
      limit: COMPLETENESS_SAMPLE_SIZE,
      order: 'id asc',
    })
    sample = asRecordList(sampled) ?? []
    completenessMeasured = sample.length > 0 || presentKeys.length === 0
    completenessPct = presentKeys.length > 0 ? fieldCompletenessPct(sample, presentKeys) : null
  } else if (rowCount === 0 || presentKeys.length === 0) {
    completenessMeasured = true
  }
  const dateField = spec.dateField && fieldSet.has(spec.dateField) ? spec.dateField : fieldSet.has('create_date') ? 'create_date' : null
  let earliest: string | null = null
  let latest: string | null = null
  if (dateField && rowCount != null && rowCount > 0) {
    const [first, last] = await Promise.all([
      read<unknown>(spec.model, 'search_read', [[...spec.countDomain]], {
        fields: [dateField],
        limit: 1,
        order: `${dateField} asc`,
      }),
      read<unknown>(spec.model, 'search_read', [[...spec.countDomain]], {
        fields: [dateField],
        limit: 1,
        order: `${dateField} desc`,
      }),
    ])
    earliest = dateOf(asRecordList(first)?.[0], dateField)
    latest = dateOf(asRecordList(last)?.[0], dateField)
  }
  const fact: ModelFact = {
    model: spec.model,
    exists: true,
    readable: rowCount != null,
    access: rowCount != null ? 'ok' : 'error',
    rowCount,
    completenessPct,
    completenessMeasured,
    sampleSize: sample.length,
    keyFields: [...spec.keyFields],
    missingRequiredFields: [...missingRequiredFields],
    earliest,
    latest,
    emptyRowsAllowed: spec.emptyRowsAllowed,
  }
  return { fact, fields, sample }
}

function dateOf(row: Record<string, unknown> | undefined, field: string): string | null {
  const value = row?.[field]
  if (typeof value !== 'string' || value.trim() === '' || value === 'false') return null
  return value
}

function failedFact(spec: ModelSpec, error: unknown): ModelFact {
  const message = error instanceof Error ? error.message : String(error)
  const access = classifyOdooReadFailure(message)
  return {
    ...uncheckedModelFact(spec),
    access,
    exists: access !== 'missing',
    readable: false,
  }
}

async function readScopedOrders(read: ReadFn, configIds: readonly number[], toExclusiveUtc: string): Promise<ScopedOrders> {
  if (configIds.length === 0) return { orders: 0, earliest: null, latest: null, historyDays: null }
  const domain = orderHistoryDomain(configIds, toExclusiveUtc)
  const count = await read<unknown>('pos.order', 'search_count', [domain])
  const orders = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
  if (orders <= 0) return { orders, earliest: null, latest: null, historyDays: null }
  const [first, last] = await Promise.all([
    read<unknown>('pos.order', 'search_read', [domain], { fields: ['date_order'], limit: 1, order: 'date_order asc' }),
    read<unknown>('pos.order', 'search_read', [domain], { fields: ['date_order'], limit: 1, order: 'date_order desc' }),
  ])
  const earliest = dateOf(asRecordList(first)?.[0], 'date_order')
  const latest = dateOf(asRecordList(last)?.[0], 'date_order')
  return { orders, earliest, latest, historyDays: historyDaySpan(earliest, latest) }
}

async function readCashierGroups(
  read: ReadFn,
  configField: string,
  fromUtc: string,
  toExclusiveUtc: string,
): Promise<{ sums: Record<string, unknown>[]; mins: Record<string, unknown>[]; maxes: Record<string, unknown>[] }> {
  const domain = buildCashierOrderDomain({
    fromUtc,
    toExclusiveUtc,
    configIds: CASHIER_CONFIG_IDS,
    configField,
  })
  const [sums, mins, maxes] = await Promise.all([
    read<unknown>('pos.order', 'read_group', [domain, ['amount_total:sum', 'amount_tax:sum'], [configField]], { lazy: false }),
    read<unknown>('pos.order', 'read_group', [domain, ['date_order:min'], [configField]], { lazy: false }),
    read<unknown>('pos.order', 'read_group', [domain, ['date_order:max'], [configField]], { lazy: false }),
  ])
  return {
    sums: asRecordList(sums) ?? [],
    mins: asRecordList(mins) ?? [],
    maxes: asRecordList(maxes) ?? [],
  }
}

async function readZeroCostProducts(read: ReadFn): Promise<{ products: ProductInput[]; truncated: boolean; stopped: boolean }> {
  const products: ProductInput[] = []
  const seen = new Set<number>()
  let offset = 0
  let truncated = false
  let stopped = false
  while (products.length < MAX_ZERO_COST_PRODUCTS) {
    let page: unknown
    try {
      page = await read<unknown>(
        'product.product',
        'search_read',
        [[['active', '=', true], ['standard_price', '<=', 0]]],
        {
          fields: ['id', 'name', 'default_code', 'standard_price'],
          limit: READINESS_PAGE_SIZE,
          offset,
          order: 'id asc',
        },
      )
    } catch (error) {
      if (error instanceof BudgetStop) {
        stopped = true
        truncated = products.length > 0
        break
      }
      throw error
    }
    const list = asRecordList(page) ?? []
    for (const row of list) {
      const id = m2oId(row.id)
      if (id == null || seen.has(id)) continue
      seen.add(id)
      const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Product ${id}`
      const code = typeof row.default_code === 'string' && row.default_code.trim() ? row.default_code.trim() : null
      products.push({
        id,
        name,
        defaultCode: code,
        standardPriceKwd: r3(Number(row.standard_price) || 0),
      })
    }
    if (list.length < READINESS_PAGE_SIZE) break
    offset += list.length
  }
  if (products.length >= MAX_ZERO_COST_PRODUCTS) truncated = true
  return { products, truncated, stopped }
}

async function readLineGroup(
  read: ReadFn,
  configIds: readonly number[],
  fromUtc: string,
  toExclusiveUtc: string,
  netField: string,
): Promise<LineAgg[] | null> {
  const grouped = await read<unknown>(
    'pos.order.line',
    'read_group',
    [
      buildPosOrderLineDomain({ fromUtc, toExclusiveUtc, configIds }),
      ['qty:sum', `${netField}:sum`],
      ['product_id'],
    ],
    { lazy: false },
  )
  const rows = asRecordList(grouped)
  if (!rows) return null
  if (netField === 'price_subtotal') return parseLineGroups(rows)
  return rows.flatMap((row) => {
    const productId = m2oId(row.product_id)
    if (productId == null) return []
    return [{ productId, qty: r3(Number(row.qty) || 0), netKwd: r3(Number(row[netField]) || 0) }]
  })
}
