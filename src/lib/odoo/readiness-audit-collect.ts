/**
 * Read-only Odoo collection for the readiness audit.
 * The client is injected. The only methods requested are search_read, read,
 * read_group, search_count, and fields_get. Nothing here writes.
 */
import {
  CASHIER_CONFIG_IDS,
  CASHIER_FROM_KUWAIT,
  COMPLETENESS_SAMPLE_SIZE,
  listedProductCost,
  MAX_ZERO_COST_PRODUCTS,
  QURAIN_SCOPE_CONFIG_IDS,
  READINESS_BUDGET_MS,
  READINESS_MIN_REMAINING_MS,
  READINESS_MODEL_SPECS,
  READINESS_PAGE_SIZE,
  asRecordList,
  buildAuditLineDomain,
  buildAuditPosOrderDomain,
  classifyOdooReadFailure,
  classifyStandardPrice,
  emptyLineSales,
  fieldCompletenessPct,
  historyDaySpan,
  isFatalOdooFailure,
  isOdooReadMethod,
  kuwaitDateBoundsToOdooUtc,
  kuwaitTodayOr,
  m2oId,
  m2oName,
  odooCompanyContext,
  parseLineGroups,
  parsePaymentGroups,
  paymentWindowDomain,
  probeFieldNames,
  publicOdooError,
  r3,
  resolveReadinessScopes,
  standardPriceFieldProbe,
  sumLineNet,
  sumPosOrderGroups,
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
  type StandardPriceDiagnosis,
} from '@/lib/odoo/readiness-audit'

export interface OdooCallOptions {
  timeoutMs?: number
  timeoutCapMs?: number
}

export interface OdooReadClient {
  execute<T>(
    model: string,
    method: OdooReadMethod,
    args?: unknown[],
    kwargs?: Record<string, unknown>,
    options?: OdooCallOptions,
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

  async function read<T>(
    model: string,
    method: OdooReadMethod,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
    options?: OdooCallOptions,
  ): Promise<T> {
    if (!isOdooReadMethod(method)) {
      throw new Error(`Refusing Odoo method ${method}`)
    }
    if (!canStart()) {
      partial = true
      throw new BudgetStop()
    }
    return client.execute<T>(model, method, args, kwargs, options)
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
  let cashierError: string | null = null
  let cashierSums: Record<string, unknown>[] = []
  let cashierMins: Record<string, unknown>[] = []
  let cashierMaxes: Record<string, unknown>[] = []
  let cashierConfigField = 'config_id'
  let costReadable = true
  let costAbsentCount = 0
  let standardPrice: StandardPriceDiagnosis | null = null
  const scopeWindow: Record<ScopeName, { orders: number; netKwd: number } | null> = {
    withoutQurain: null,
    withQurain: null,
  }
  const scopeWindowError: Record<ScopeName, string | null> = { withoutQurain: null, withQurain: null }

  try {
    configs = await readConfigs(read)
    scopesReady = true
  } catch (error) {
    if (error instanceof BudgetStop) partial = true
    else if (isFatalOdooFailure(error)) throw error
    else scopesReady = false
  }

  let companyIds = companyIdsOf(configs)
  if (companyIds.length === 0 && canStart()) {
    try {
      const companies = await read<unknown>('res.company', 'search_read', [[]], { fields: ['id'], limit: 20 })
      companyIds = (asRecordList(companies) ?? [])
        .map((row) => m2oId(row.id))
        .filter((id): id is number => id != null)
    } catch (error) {
      if (isFatalOdooFailure(error)) throw error
    }
  }
  const companyContext = odooCompanyContext(companyIds)

  if (canStart()) {
    const specs = [...READINESS_MODEL_SPECS]
    for (let index = 0; index < specs.length; index += 4) {
      if (!canStart()) {
        partial = true
        break
      }
      const wave = specs.slice(index, index + 4)
      await Promise.all(
        wave.map(async (spec) => {
          try {
            const probed = await probeModel(read, spec, spec.model === 'product.product' ? companyContext : null)
            models[spec.model] = probed.fact
            fieldNames.set(spec.model, probed.fields)
            samples.set(spec.model, probed.sample)
          } catch (error) {
            if (error instanceof BudgetStop) {
              partial = true
              return
            }
            if (isFatalOdooFailure(error)) throw error
            models[spec.model] = failedFact(spec, error)
          }
        }),
      )
    }
  } else {
    partial = true
  }

  const resolvedIds = scopesReady ? scopeIds(configs) : { withoutQurain: [] as number[], withQurain: [] as number[] }
  const todayBounds = kuwaitDateBoundsToOdooUtc(kuwaitToday, kuwaitToday)
  const yearEnd = kuwaitToday < CASHIER_FROM_KUWAIT ? CASHIER_FROM_KUWAIT : kuwaitToday
  const year = kuwaitDateBoundsToOdooUtc(CASHIER_FROM_KUWAIT, yearEnd)
  const window60 = trailingKuwaitWindow(kuwaitToday, 60)
  const bounds60 = kuwaitDateBoundsToOdooUtc(window60.from, window60.to)
  const window30 = trailingKuwaitWindow(kuwaitToday, 30)
  const bounds30 = kuwaitDateBoundsToOdooUtc(window30.from, window30.to)

  if (scopesReady && canStart()) {
    await Promise.all(
      SCOPES.map(async (scope) => {
        try {
          scopedOrders[scope] = await readScopedOrders(read, resolvedIds[scope], todayBounds.toExclusiveUtc, companyContext)
        } catch (error) {
          if (error instanceof BudgetStop) partial = true
          else if (isFatalOdooFailure(error)) throw error
          else scopedOrders[scope] = null
        }
        try {
          scopeWindow[scope] = await readScopeWindow(read, resolvedIds[scope], year.fromUtc, year.toExclusiveUtc)
          scopeWindowError[scope] = null
        } catch (error) {
          if (error instanceof BudgetStop) partial = true
          else if (isFatalOdooFailure(error)) throw error
          else {
            scopeWindow[scope] = null
            scopeWindowError[scope] = publicOdooError(error)
          }
        }
      }),
    )
  } else if (scopesReady) {
    partial = true
  }

  cashierConfigField = 'config_id'
  if (canStart()) {
    try {
      const grouped = await readCashierGroups(read, year.fromUtc, year.toExclusiveUtc)
      cashierSums = grouped.sums
      cashierMins = grouped.mins
      cashierMaxes = grouped.maxes
      cashiersRead = grouped.sums.length > 0 || grouped.mins.length > 0 || grouped.maxes.length > 0 || grouped.read
      cashierError = null
    } catch (error) {
      if (error instanceof BudgetStop) partial = true
      else if (isFatalOdooFailure(error)) throw error
      else {
        cashiersRead = false
        cashierError = publicOdooError(error)
      }
    }
  } else {
    partial = true
  }

  if (scopesReady && canStart()) {
    await Promise.all(
      SCOPES.map(async (scope) => {
        const ids = resolvedIds[scope]
        if (ids.length === 0) {
          channels[scope] = []
          return
        }
        try {
          const grouped = await read(
            'pos.payment',
            'read_group',
            [paymentWindowDomain(ids, bounds60.fromUtc, bounds60.toExclusiveUtc), ['amount:sum'], ['payment_method_id']],
            { lazy: false, context: companyContext },
          )
          channels[scope] = parsePaymentGroups(grouped) ?? null
        } catch (error) {
          if (error instanceof BudgetStop) partial = true
          else if (isFatalOdooFailure(error)) throw error
          else channels[scope] = null
        }
      }),
    )
  } else if (scopesReady) {
    partial = true
  }

  if (canStart()) {
    try {
      const paged = await diagnoseStandardPrice(read, companyIds)
      products = paged.products
      productsTruncated = paged.truncated
      productsScanned = !paged.stopped
      costReadable = paged.costReadable
      costAbsentCount = paged.costAbsentCount
      standardPrice = paged.diagnosis
      if (paged.stopped) partial = true
    } catch (error) {
      if (error instanceof BudgetStop) partial = true
      else if (isFatalOdooFailure(error)) throw error
      else productsScanned = false
    }
  } else {
    partial = true
  }

  const lineFields = new Set(fieldNames.get('pos.order.line') ?? ['price_subtotal', 'qty', 'product_id'])
  const netField = lineFields.has('price_subtotal') ? 'price_subtotal' : 'price_subtotal_incl'
  if (productsScanned && scopesReady && canStart()) {
    const lineResults = await Promise.all(
      SCOPES.map(async (scope) => {
        const ids = resolvedIds[scope]
        if (ids.length === 0) return { scope, sales: emptyLineSales(), ok: true }
        try {
          const [days30, days60] = await Promise.all([
            readLineGroup(read, ids, bounds30.fromUtc, bounds30.toExclusiveUtc, netField, companyContext),
            readLineGroup(read, ids, bounds60.fromUtc, bounds60.toExclusiveUtc, netField, companyContext),
          ])
          if (!days30 || !days60) return { scope, sales: emptyLineSales(), ok: false }
          return { scope, sales: { days30, days60, allNet60Kwd: sumLineNet(days60) }, ok: true }
        } catch (error) {
          if (error instanceof BudgetStop) {
            partial = true
            return { scope, sales: emptyLineSales(), ok: false }
          }
          if (isFatalOdooFailure(error)) throw error
          return { scope, sales: emptyLineSales(), ok: false }
        }
      }),
    )
    lineSalesRead = lineResults.every((result) => result.ok)
    for (const result of lineResults) {
      if (result.ok) lineSales[result.scope] = result.sales
    }
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
    scopeWindow,
    scopeWindowError,
    costReadable,
    costAbsentCount,
    standardPrice,
    cashiersRead,
    cashierError,
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
  options?: OdooCallOptions,
) => Promise<T>

const ORDER_READ_CONTEXT = { active_test: false }
const ORDER_READ_OPTIONS: OdooCallOptions = { timeoutMs: 20_000, timeoutCapMs: 25_000 }

async function readConfigs(read: ReadFn): Promise<PosConfigRow[]> {
  const rows: PosConfigRow[] = []
  let offset = 0
  for (;;) {
    const page = await read<unknown>('pos.config', 'search_read', [[]], {
      fields: ['id', 'name', 'active', 'company_id'],
      limit: READINESS_PAGE_SIZE,
      offset,
      order: 'id asc',
      context: { active_test: false },
    })
    const list = asRecordList(page) ?? []
    for (const row of list) {
      const id = m2oId(row.id)
      if (id == null) continue
      rows.push(configRow(id, row))
    }
    if (list.length < READINESS_PAGE_SIZE) break
    offset += list.length
    if (offset >= 1_000) break
  }
  const have = new Set(rows.map((row) => row.id))
  const missing = [...new Set([...CASHIER_CONFIG_IDS, ...QURAIN_SCOPE_CONFIG_IDS])].filter((id) => !have.has(id))
  if (missing.length > 0) {
    const cashierDomain: unknown[][] = [['id', 'in', missing]]
    const extra = await read<unknown>('pos.config', 'search_read', [cashierDomain], {
      fields: ['id', 'name', 'active', 'company_id'],
      limit: missing.length,
      context: { active_test: false },
    })
    for (const row of asRecordList(extra) ?? []) {
      const id = m2oId(row.id)
      if (id == null || have.has(id)) continue
      rows.push(configRow(id, row))
    }
  }
  return rows
}

function configRow(id: number, row: Record<string, unknown>): PosConfigRow {
  return {
    id,
    name: typeof row.name === 'string' ? row.name : `pos.config ${id}`,
    active: row.active !== false,
    companyId: m2oId(row.company_id),
    companyName: m2oName(row.company_id) || null,
  }
}

function companyIdsOf(configs: readonly PosConfigRow[]): number[] {
  return [...new Set(configs.map((row) => row.companyId).filter((id): id is number => id != null && id > 0))]
}

function scopeIds(configs: readonly PosConfigRow[]): Record<ScopeName, number[]> {
  const resolved = resolveReadinessScopes(configs)
  return { withoutQurain: resolved.withoutQurain, withQurain: resolved.withQurain }
}

async function probeModel(
  read: ReadFn,
  spec: ModelSpec,
  companyContext: Record<string, unknown> | null,
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
  let sample: Record<string, unknown>[] = []
  let completenessMeasured = rowCount === 0
  let completenessPct: number | null = null
  let errorMessage: string | null = null
  const sampleFields =
    spec.model === 'product.product'
      ? ['id', 'name', 'default_code', 'active']
      : [...new Set([...presentKeys, ...spec.extraFields.filter((field) => fieldSet.has(field))])]
  try {
    if (rowCount != null && rowCount > 0 && sampleFields.length > 0) {
      const sampled = await read<unknown>(spec.model, 'search_read', [[...spec.countDomain]], {
        fields: sampleFields,
        limit: COMPLETENESS_SAMPLE_SIZE,
        order: 'id asc',
        ...(companyContext && spec.model !== 'product.product' ? { context: companyContext } : {}),
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
      errorMessage,
    }
    return { fact, fields, sample }
  } catch (error) {
    if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
    if (rowCount == null) throw error
    const fact: ModelFact = {
      model: spec.model,
      exists: true,
      readable: true,
      access: 'ok',
      rowCount,
      completenessPct,
      completenessMeasured,
      sampleSize: sample.length,
      keyFields: [...spec.keyFields],
      missingRequiredFields: [...missingRequiredFields],
      earliest: null,
      latest: null,
      emptyRowsAllowed: spec.emptyRowsAllowed,
      errorMessage: publicOdooError(error),
    }
    return { fact, fields, sample }
  }
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
    errorMessage: publicOdooError(error),
  }
}

async function readScopedOrders(
  read: ReadFn,
  configIds: readonly number[],
  toExclusiveUtc: string,
  context: Record<string, unknown>,
): Promise<ScopedOrders> {
  if (configIds.length === 0) return { orders: 0, earliest: null, latest: null, historyDays: null }
  const domain = buildAuditPosOrderDomain({
    fromUtc: '2000-01-01 00:00:00',
    toExclusiveUtc,
    configIds,
  })
  const count = await read<unknown>('pos.order', 'search_count', [domain], { context })
  const orders = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
  if (orders <= 0) return { orders, earliest: null, latest: null, historyDays: null }
  const [first, last] = await Promise.all([
    read<unknown>('pos.order', 'search_read', [domain], { fields: ['date_order'], limit: 1, order: 'date_order asc', context }),
    read<unknown>('pos.order', 'search_read', [domain], { fields: ['date_order'], limit: 1, order: 'date_order desc', context }),
  ])
  const earliest = dateOf(asRecordList(first)?.[0], 'date_order')
  const latest = dateOf(asRecordList(last)?.[0], 'date_order')
  return { orders, earliest, latest, historyDays: historyDaySpan(earliest, latest) }
}

async function readScopeWindow(
  read: ReadFn,
  configIds: readonly number[],
  fromUtc: string,
  toExclusiveUtc: string,
): Promise<{ orders: number; netKwd: number }> {
  if (configIds.length === 0) return { orders: 0, netKwd: 0 }
  const domains = (['config_id', 'session_id.config_id'] as const).map((configField) =>
    buildAuditPosOrderDomain({ fromUtc, toExclusiveUtc, configIds, configField }),
  )
  let lastError: unknown = null
  for (const domain of domains) {
    for (const groupby of [['config_id'], ['session_id.config_id'], []] as const) {
      try {
        const grouped = await read<unknown>(
          'pos.order',
          'read_group',
          [domain, ['amount_total:sum', 'amount_tax:sum'], [...groupby]],
          { lazy: false, context: ORDER_READ_CONTEXT },
          ORDER_READ_OPTIONS,
        )
        const rows = asRecordList(grouped)
        if (rows && rows.length > 0) return sumPosOrderGroups(rows)
      } catch (error) {
        if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
        lastError = error
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('pos.order read_group returned no 2026 totals')
}

async function readCashierGroups(
  read: ReadFn,
  fromUtc: string,
  toExclusiveUtc: string,
): Promise<{ sums: Record<string, unknown>[]; mins: Record<string, unknown>[]; maxes: Record<string, unknown>[]; read: boolean }> {
  const fields = ['config_id', 'session_id.config_id'] as const
  let lastError: unknown = null
  for (const configField of fields) {
    const domain = buildAuditPosOrderDomain({
      fromUtc,
      toExclusiveUtc,
      configIds: CASHIER_CONFIG_IDS,
      configField,
    })
    const kwargs = { lazy: false, context: ORDER_READ_CONTEXT }
    const call = (aggregates: string[]) =>
      read<unknown>('pos.order', 'read_group', [domain, aggregates, [configField]], kwargs, ORDER_READ_OPTIONS)
    const settled = await Promise.all([
      call(['amount_total:sum', 'amount_tax:sum']).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      call(['date_order:min']).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
      call(['date_order:max']).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ])
    for (const result of settled) {
      if (!result.ok && (result.error instanceof BudgetStop || isFatalOdooFailure(result.error))) throw result.error
      if (!result.ok) lastError = result.error
    }
    if (settled[0].ok) {
      return {
        sums: asRecordList(settled[0].value) ?? [],
        mins: settled[1].ok ? (asRecordList(settled[1].value) ?? []) : [],
        maxes: settled[2].ok ? (asRecordList(settled[2].value) ?? []) : [],
        read: true,
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('pos.order cashier read_group failed')
}

async function diagnoseStandardPrice(
  read: ReadFn,
  companyIds: readonly number[],
): Promise<{
  products: ProductInput[]
  truncated: boolean
  stopped: boolean
  costReadable: boolean
  costAbsentCount: number
  diagnosis: StandardPriceDiagnosis
}> {
  const errors = { productFieldsGet: null as string | null, templateFieldsGet: null as string | null, read: null as string | null }
  const [productFields, templateFields] = await Promise.all([
    read<unknown>('product.product', 'fields_get', [['standard_price']], { attributes: ['type', 'string', 'groups'] }).catch(
      (error: unknown) => {
        if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
        errors.productFieldsGet = publicOdooError(error)
        return null
      },
    ),
    read<unknown>('product.template', 'fields_get', [['standard_price']], { attributes: ['type', 'string', 'groups'] }).catch(
      (error: unknown) => {
        if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
        errors.templateFieldsGet = publicOdooError(error)
        return null
      },
    ),
  ])
  const productField = standardPriceFieldProbe(productFields)
  const templateField = standardPriceFieldProbe(templateFields)
  const companies = companyIds.length > 0 ? [...companyIds] : []
  const contexts = companies.length > 0 ? companies.map((id) => odooCompanyContext([id])) : [odooCompanyContext([])]
  const probes = await Promise.all(
    contexts.map(async (context) => {
      try {
        const listed = await read<unknown>('product.product', 'search_read', [[['active', '=', true]]], {
          fields: ['id', 'standard_price', 'product_tmpl_id'],
          limit: 1,
          order: 'id asc',
          context,
        })
        const row = asRecordList(listed)?.[0]
        const variantKey = row != null && Object.prototype.hasOwnProperty.call(row, 'standard_price')
        let templateKey = false
        const templateId = row ? m2oId(row.product_tmpl_id) : null
        if (!variantKey && templateId != null) {
          const templates = await read<unknown>('product.template', 'search_read', [[['id', '=', templateId]]], {
            fields: ['id', 'standard_price'],
            limit: 1,
            context,
          })
          const template = asRecordList(templates)?.[0]
          templateKey = template != null && Object.prototype.hasOwnProperty.call(template, 'standard_price')
        }
        return variantKey || templateKey
      } catch (error) {
        if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
        errors.read = publicOdooError(error)
        return false
      }
    }),
  )
  const readReturnsKey = probes.some(Boolean)
  const fieldReadable = productField.present || templateField.present || readReturnsKey
  if (!fieldReadable) {
    let activeProducts = 0
    try {
      const count = await read<unknown>('product.product', 'search_count', [[['active', '=', true]]])
      activeProducts = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0
    } catch (error) {
      if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
    }
    const diagnosis = classifyStandardPrice({
      productField,
      templateField,
      readReturnsKey,
      companiesTried: companies,
      activeProducts,
      observations: [],
      errors,
    })
    return {
      products: [],
      truncated: false,
      stopped: false,
      costReadable: false,
      costAbsentCount: diagnosis.counts.notReadable,
      diagnosis,
    }
  }

  const zeroByCompany: Array<Map<number, ProductInput>> = []
  let truncated = false
  let stopped = false
  const readableContexts: number[] = []
  for (let index = 0; index < contexts.length; index += 1) {
    if (!probes[index]) {
      zeroByCompany.push(new Map())
      continue
    }
    readableContexts.push(index)
    const context = contexts[index] ?? odooCompanyContext([])
    let pages: { rows: Record<string, unknown>[]; truncated: boolean; stopped: boolean }
    try {
      pages = await pageProducts(
        read,
        [['active', '=', true], ['standard_price', '<=', 0]],
        ['id', 'name', 'default_code', 'standard_price', 'product_tmpl_id'],
        context,
      )
    } catch (error) {
      if (error instanceof BudgetStop) throw error
      pages = await pageProducts(
        read,
        [['active', '=', true]],
        ['id', 'name', 'default_code', 'standard_price', 'product_tmpl_id'],
        context,
      )
    }
    truncated = truncated || pages.truncated
    stopped = stopped || pages.stopped
    const templates = await templateStandardPrices(read, pages.rows, context)
    const found = new Map<number, ProductInput>()
    for (const row of pages.rows) {
      const id = m2oId(row.id)
      if (id == null) continue
      const hasVariant = Object.prototype.hasOwnProperty.call(row, 'standard_price')
      const templateId = m2oId(row.product_tmpl_id)
      const template = templateId == null ? null : (templates.get(templateId) ?? null)
      const cost = listedProductCost(
        { hasStandardPrice: hasVariant, standardPrice: row.standard_price },
        template,
      )
      if (!cost.known || cost.standardPriceKwd > 0) continue
      const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : `Product ${id}`
      const code = typeof row.default_code === 'string' && row.default_code.trim() ? row.default_code.trim() : null
      found.set(id, {
        id,
        name,
        defaultCode: code,
        standardPriceKwd: cost.standardPriceKwd,
        costSource: cost.source,
      })
    }
    zeroByCompany.push(found)
  }

  const observations: { values: Array<number | 'absent'> }[] = []
  const trulyZero = new Map<number, ProductInput>()
  const ids = new Set<number>()
  for (const found of zeroByCompany) for (const id of found.keys()) ids.add(id)
  for (const id of ids) {
    const values: Array<number | 'absent'> = readableContexts.map((index) => {
      const row = zeroByCompany[index]?.get(id)
      return row ? row.standardPriceKwd : 1
    })
    observations.push({ values })
    const inEveryReadableCompany = readableContexts.every((index) => zeroByCompany[index]?.has(id))
    if (inEveryReadableCompany) {
      const sample = readableContexts.map((index) => zeroByCompany[index]?.get(id)).find((row) => row != null)
      if (sample) trulyZero.set(id, sample)
    }
  }
  const diagnosis = classifyStandardPrice({
    productField,
    templateField,
    readReturnsKey,
    companiesTried: companies,
    activeProducts: ids.size,
    observations,
    errors,
  })
  return {
    products: [...trulyZero.values()],
    truncated,
    stopped,
    costReadable: true,
    costAbsentCount: diagnosis.counts.notReadable,
    diagnosis,
  }
}

async function pageProducts(
  read: ReadFn,
  domain: unknown[][],
  fields: string[],
  context: Record<string, unknown>,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean; stopped: boolean }> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  let truncated = false
  let stopped = false
  while (rows.length < MAX_ZERO_COST_PRODUCTS) {
    let page: unknown
    try {
      page = await read<unknown>('product.product', 'search_read', [domain], {
        fields,
        limit: READINESS_PAGE_SIZE,
        offset,
        order: 'id asc',
        context,
      })
    } catch (error) {
      if (error instanceof BudgetStop) {
        stopped = true
        truncated = rows.length > 0
        break
      }
      throw error
    }
    const list = asRecordList(page) ?? []
    rows.push(...list)
    if (list.length < READINESS_PAGE_SIZE) break
    offset += list.length
  }
  if (rows.length >= MAX_ZERO_COST_PRODUCTS) truncated = true
  return { rows, truncated, stopped }
}

async function templateStandardPrices(
  read: ReadFn,
  rows: readonly Record<string, unknown>[],
  context: Record<string, unknown>,
): Promise<Map<number, { hasStandardPrice: boolean; standardPrice: unknown }>> {
  const out = new Map<number, { hasStandardPrice: boolean; standardPrice: unknown }>()
  const ids = [
    ...new Set(
      rows
        .filter((row) => !Object.prototype.hasOwnProperty.call(row, 'standard_price'))
        .map((row) => m2oId(row.product_tmpl_id))
        .filter((id): id is number => id != null),
    ),
  ]
  if (ids.length === 0) return out
  try {
    const listed = await read<unknown>('product.template', 'search_read', [[['id', 'in', ids]]], {
      fields: ['id', 'standard_price'],
      limit: ids.length,
      context,
    })
    for (const row of asRecordList(listed) ?? []) {
      const id = m2oId(row.id)
      if (id == null) continue
      out.set(id, {
        hasStandardPrice: Object.prototype.hasOwnProperty.call(row, 'standard_price'),
        standardPrice: row.standard_price,
      })
    }
  } catch (error) {
    if (error instanceof BudgetStop || isFatalOdooFailure(error)) throw error
  }
  return out
}

async function readLineGroup(
  read: ReadFn,
  configIds: readonly number[],
  fromUtc: string,
  toExclusiveUtc: string,
  netField: string,
  context: Record<string, unknown>,
): Promise<LineAgg[] | null> {
  const grouped = await read<unknown>(
    'pos.order.line',
    'read_group',
    [
      buildAuditLineDomain({ fromUtc, toExclusiveUtc, configIds }),
      ['qty:sum', `${netField}:sum`],
      ['product_id'],
    ],
    { lazy: false, context },
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
