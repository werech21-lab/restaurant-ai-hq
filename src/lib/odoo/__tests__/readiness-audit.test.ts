import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isAuditorForbiddenPath } from '@/lib/auth/role-access-policy'
import { isQurainLabel } from '../../../../scripts/lib/qurain-audit-lib.mjs'
import { collectReadinessAudit, type OdooReadClient } from '@/lib/odoo/readiness-audit-collect'
import {
  CASHIER_CONFIG_IDS,
  ODOO_READ_METHODS,
  POS_SALE_STATES,
  READINESS_AUDIT_PATH,
  READINESS_MODEL_SPECS,
  assembleReadinessAudit,
  buildCashierChecks,
  buildNoCostScope,
  classifyOdooReadFailure,
  fieldCompletenessPct,
  historyDaySpan,
  isDeliveryQurainName,
  isFatalOdooFailure,
  isFilledOdooValue,
  isReadinessAuditRole,
  readinessAuditToCsv,
  resolveAttendanceBranchLink,
  resolveReadinessScopes,
  salesStatesMatchPosOrderQuery,
  sanitizeReadinessReport,
  type AuditFacts,
  type LineSalesInput,
  type ModelFact,
  type ModelSpec,
  type OdooReadMethod,
} from '@/lib/odoo/readiness-audit'

function okModel(spec: ModelSpec, overrides: Partial<ModelFact> = {}): ModelFact {
  return {
    model: spec.model,
    exists: true,
    readable: true,
    access: 'ok',
    rowCount: 10,
    completenessPct: 100,
    completenessMeasured: true,
    sampleSize: 10,
    keyFields: [...spec.keyFields],
    missingRequiredFields: [],
    earliest: '2024-01-01 00:00:00',
    latest: '2026-06-01 00:00:00',
    emptyRowsAllowed: spec.emptyRowsAllowed,
    ...overrides,
  }
}

function emptySales(): LineSalesInput {
  return { days30: [], days60: [], allNet60Kwd: 0 }
}

function passingFacts(overrides: Partial<AuditFacts> = {}): AuditFacts {
  const models: Record<string, ModelFact> = {}
  for (const spec of READINESS_MODEL_SPECS) models[spec.model] = okModel(spec)
  return {
    generatedAt: '2026-11-19T08:00:00.000Z',
    elapsedMs: 20,
    budgetMs: 60_000,
    partial: false,
    kuwaitToday: '2026-11-19',
    scopesReady: true,
    configs: [
      { id: 8, name: 'Promenade Mall', active: true },
      { id: 4, name: 'Delivery (Qurain)', active: true },
    ],
    models,
    scopedOrders: {
      withoutQurain: { orders: 4, earliest: '2024-01-01 00:00:00', latest: '2026-06-01 00:00:00', historyDays: 882 },
      withQurain: { orders: 5, earliest: '2024-01-01 00:00:00', latest: '2026-06-01 00:00:00', historyDays: 882 },
    },
    channels: {
      withoutQurain: [{ paymentMethodId: 1, paymentMethodName: 'Cash', amountKwd: 10, payments: 2 }],
      withQurain: [{ paymentMethodId: 1, paymentMethodName: 'Cash', amountKwd: 12, payments: 3 }],
    },
    products: [],
    productsScanned: true,
    productsTruncated: false,
    lineSalesRead: true,
    lineSales: { withoutQurain: emptySales(), withQurain: emptySales() },
    cashiersRead: true,
    cashierSums: [],
    cashierMins: [],
    cashierMaxes: [],
    cashierConfigField: 'config_id',
    staff: {
      attendanceFields: ['employee_id', 'check_in', 'work_location_id'],
      employeeFields: ['name', 'work_location_id', 'department_id'],
      attendanceSample: [{ employee_id: [1, 'Ada'], check_in: '2026-11-01 05:00:00', work_location_id: false }],
      employeeSample: [{ name: 'Ada', work_location_id: [9, 'Promenade'], department_id: false }],
    },
    ...overrides,
  }
}

describe('readiness audit pure rules', () => {
  it('reuses the paid/done/invoiced states and the Qurain classifier', () => {
    expect(salesStatesMatchPosOrderQuery()).toBe(true)
    expect([...POS_SALE_STATES]).toEqual(['paid', 'done', 'invoiced'])
    expect(isDeliveryQurainName('Qurain Kitchen')).toBe(isQurainLabel('Qurain Kitchen'))
    expect(isDeliveryQurainName('القرين')).toBe(true)
    expect(isDeliveryQurainName('Qurainy Dates')).toBe(false)
    expect(isDeliveryQurainName('Shawali')).toBe(false)
  })

  it('splits the company allow-list from Delivery (Qurain)', () => {
    const scopes = resolveReadinessScopes([
      { id: 8, name: 'Promenade Mall', active: true },
      { id: 9, name: 'Qurain Kitchen', active: true },
      { id: 26, name: 'Exhibition Booth', active: true },
      { id: 4, name: 'Delivery (Qurain)', active: true },
      { id: 99, name: 'Qurain Kitchen', active: true },
      { id: 7, name: 'Delivery (Qurain)', active: false },
      { id: 24, name: 'Delivery (Qurain)', active: true },
      { id: 16, name: 'E-Mall', active: false },
      { id: 35, name: 'Delivery Ardiya Temp', active: true },
    ])
    expect(scopes.withoutQurain).toEqual(expect.arrayContaining([8, 26, 35]))
    for (const id of [4, 9, 99, 7, 24, 16]) expect(scopes.withoutQurain).not.toContain(id)
    expect(scopes.withQurain).toEqual([...scopes.withoutQurain, 4, 9].sort((a, b) => a - b))
    expect(scopes.withQurain).not.toContain(99)
    const outlet = scopes.qurain.find((row) => row.id === 24)
    expect(outlet?.explicitlyExcluded).toBe(true)
    expect(outlet?.includedInWithQurain).toBe(false)
    expect(scopes.qurain.find((row) => row.id === 4)?.includedInWithQurain).toBe(true)
    expect(scopes.qurain.find((row) => row.id === 99)?.includedInWithQurain).toBe(false)
  })

  it('counts Kuwait history days and treats 365 as enough for seasons', () => {
    expect(historyDaySpan('2025-01-01 21:00:00', '2026-01-01 21:00:00')).toBe(365)
    expect(historyDaySpan('2025-01-01 21:00:00', '2026-01-01 20:59:59')).toBe(364)
    const ready = assembleReadinessAudit(passingFacts())
    expect(ready.advisors.find((row) => row.id === 'seasons')?.decision).toBe('GO')
    const short = assembleReadinessAudit(
      passingFacts({
        scopedOrders: {
          withoutQurain: { orders: 2, earliest: '2025-11-01 00:00:00', latest: '2026-11-01 00:00:00', historyDays: 365 },
          withQurain: {
            orders: 2,
            earliest: '2025-01-01 21:00:00',
            latest: '2026-01-01 20:59:59',
            historyDays: 364,
          },
        },
      }),
    )
    const seasons = short.advisors.find((row) => row.id === 'seasons')
    expect(seasons?.decision).toBe('HOLD')
    expect(seasons?.reason).toContain('364 days')
    expect(seasons?.reason).toContain('Without Qurain: 365 days')
  })

  it('holds finance when a model is unreadable and goes when the four models are complete', () => {
    const ready = assembleReadinessAudit(passingFacts())
    expect(ready.advisors.find((row) => row.id === 'finance')).toMatchObject({
      decision: 'GO',
    })
    const facts = passingFacts()
    const line = READINESS_MODEL_SPECS.find((spec) => spec.model === 'account.move.line')
    if (!line) throw new Error('missing account.move.line spec')
    const held = assembleReadinessAudit({
      ...facts,
      models: {
        ...facts.models,
        'account.move.line': okModel(line, {
          access: 'denied',
          readable: false,
          exists: true,
          rowCount: null,
          completenessMeasured: false,
        }),
      },
    })
    expect(held.advisors.find((row) => row.id === 'finance')?.reason).toBe(
      'HOLD: account.move.line is not readable.',
    )
  })

  it('holds finance below 80% completeness and when in-scope orders are missing', () => {
    const facts = passingFacts()
    const orders = READINESS_MODEL_SPECS.find((spec) => spec.model === 'pos.order')
    if (!orders) throw new Error('missing pos.order spec')
    expect(
      assembleReadinessAudit({
        ...facts,
        models: { ...facts.models, 'pos.order': okModel(orders, { completenessPct: 75 }) },
      }).advisors.find((row) => row.id === 'finance')?.reason,
    ).toContain('75%')
    const emptyScope = passingFacts({
      scopedOrders: {
        withoutQurain: { orders: 0, earliest: null, latest: null, historyDays: null },
        withQurain: { orders: 0, earliest: null, latest: null, historyDays: null },
      },
    })
    expect(assembleReadinessAudit(emptyScope).advisors.find((row) => row.id === 'finance')?.reason).toContain(
      'no paid, done, or invoiced orders',
    )
  })

  it('holds platforms when payments cannot be grouped', () => {
    const facts = passingFacts({
      channels: { withoutQurain: [], withQurain: null },
    })
    expect(assembleReadinessAudit(facts).advisors.find((row) => row.id === 'platforms')?.reason).toBe(
      'HOLD: pos.payment could not be grouped by payment method.',
    )
  })

  it('links attendance through the employee work location and holds when that link is empty', () => {
    const linked = resolveAttendanceBranchLink({
      attendanceFields: ['employee_id', 'check_in'],
      employeeFields: ['work_location_id'],
      attendanceSample: [{ employee_id: [1, 'Ada'], check_in: '2026-11-01 05:00:00' }],
      employeeSample: [{ work_location_id: [9, 'Promenade'] }],
    })
    expect(linked).toEqual({ via: 'hr.employee.work_location_id', populated: true })
    expect(assembleReadinessAudit(passingFacts()).advisors.find((row) => row.id === 'staff')?.decision).toBe('GO')
    const facts = passingFacts({
      staff: {
        attendanceFields: ['employee_id', 'check_in'],
        employeeFields: ['name', 'work_location_id'],
        attendanceSample: [{ employee_id: [1, 'Ada'], check_in: '2026-11-01 05:00:00' }],
        employeeSample: [{ name: 'Ada', work_location_id: false }],
      },
    })
    const staff = assembleReadinessAudit(facts).advisors.find((row) => row.id === 'staff')
    expect(staff?.decision).toBe('HOLD')
    expect(staff?.branchLink?.populated).toBe(false)
    expect(isFilledOdooValue(false)).toBe(false)
    expect(isFilledOdooValue(0)).toBe(true)
    expect(fieldCompletenessPct([{ debit: 0, credit: false }], ['debit', 'credit'])).toBe(50)
  })

  it('marks sold zero-cost products P1, sorts by 60-day net, and reports top 50 and top 80 shares', () => {
    const products = [
      { id: 2, name: 'Water', defaultCode: null, standardPriceKwd: 0 },
      { id: 1, name: 'Bread', defaultCode: 'BR', standardPriceKwd: 0 },
      { id: 3, name: 'Dust', defaultCode: null, standardPriceKwd: 0.0004 },
      { id: 4, name: 'Priced', defaultCode: null, standardPriceKwd: 0.5 },
      { id: 5, name: '=cmd, "quoted"', defaultCode: null, standardPriceKwd: -1 },
    ]
    const many = Array.from({ length: 100 }, (_, index) => ({
      id: 100 + index,
      name: `Item ${index}`,
      defaultCode: null,
      standardPriceKwd: 0,
    }))
    const days60 = [
      { productId: 1, qty: 4, netKwd: 30 },
      { productId: 2, qty: 1, netKwd: 10 },
      { productId: 3, qty: 0.0004, netKwd: 0 },
      { productId: 5, qty: 2, netKwd: 60 },
      ...many.map((product) => ({ productId: product.id, qty: 1, netKwd: 1 })),
    ]
    const scope = buildNoCostScope([...products, ...many], {
      days30: [{ productId: 1, qty: 1, netKwd: 5 }],
      days60,
      allNet60Kwd: 400,
    })
    expect(scope.rows.find((row) => row.productId === 4)).toBeUndefined()
    expect(scope.rows[0]).toMatchObject({ productId: 5, priority: 'P1', netKwd60: 60 })
    expect(scope.rows.find((row) => row.productId === 3)?.priority).toBe('P2')
    expect(scope.rows.find((row) => row.productId === 1)).toMatchObject({ priority: 'P1', qty30: 1, netKwd30: 5 })
    expect(scope.totals.p1Count).toBe(103)
    expect(scope.totals.p2Count).toBe(1)
    expect(scope.totals.top50.products).toBe(50)
    expect(scope.totals.top50.shareOfNoCostSales60Pct).not.toBeNull()
    expect(scope.totals.top80.shareOfNoCostSales60Pct).toBeGreaterThan(scope.totals.top50.shareOfNoCostSales60Pct ?? 0)
    const even = buildNoCostScope(
      Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        name: `Item ${index + 1}`,
        defaultCode: null,
        standardPriceKwd: 0,
      })),
      {
        days30: [],
        days60: Array.from({ length: 100 }, (_, index) => ({ productId: index + 1, qty: 1, netKwd: 1 })),
        allNet60Kwd: 200,
      },
    )
    expect(even.totals.top50).toMatchObject({ netKwd: 50, shareOfNoCostSales60Pct: 50, shareOfAllSales60Pct: 25 })
    expect(even.totals.top80).toMatchObject({ netKwd: 80, shareOfNoCostSales60Pct: 80, shareOfAllSales60Pct: 40 })
    const facts = passingFacts({
      products: [{ id: 1, name: 'Bread', defaultCode: 'BR', standardPriceKwd: 0 }],
      lineSales: {
        withoutQurain: emptySales(),
        withQurain: { days30: [], days60: [{ productId: 1, qty: 2, netKwd: 8 }], allNet60Kwd: 20 },
      },
    })
    const warehouse = assembleReadinessAudit(facts).advisors.find((row) => row.id === 'warehouse')
    expect(warehouse?.decision).toBe('HOLD')
    expect(warehouse?.reason).toContain('1 active product')
    const clear = assembleReadinessAudit(passingFacts())
    expect(clear.advisors.find((row) => row.id === 'warehouse')?.decision).toBe('GO')
  })

  it('reports cashier configs 24, 16, and 35 with signed net and Kuwait dates', () => {
    const rows = buildCashierChecks({
      configs: [
        { id: 24, name: 'Old register', active: false },
        { id: 16, name: 'E-Mall', active: false },
      ],
      sums: [{ config_id: [24, 'Old register'], amount_total: 10.5, amount_tax: 0.5, __count: 3 }],
      mins: [{ config_id: [24, 'Old register'], date_order: '2026-01-15 21:00:00' }],
      maxes: [{ config_id: [24, 'Old register'], date_order: '2026-11-01 12:00:00' }],
      configField: 'config_id',
      read: true,
      fromKuwait: '2026-01-01',
      toKuwait: '2026-11-19',
    })
    expect(rows.map((row) => row.configId)).toEqual([...CASHIER_CONFIG_IDS])
    expect(rows[0]).toMatchObject({
      name: 'Old register',
      active: false,
      found: true,
      orders: 3,
      netKwd: 10,
      firstOrderKuwait: '2026-01-16',
      lastOrderKuwait: '2026-11-01',
    })
    expect(rows[1]).toMatchObject({ found: true, orders: 0, netKwd: 0, firstOrderAt: null })
    expect(rows[2]).toMatchObject({ found: false, name: null, orders: 0, netKwd: 0 })
  })

  it('writes a CSV without secret columns and keeps formula text in a cell', () => {
    const report = assembleReadinessAudit(
      passingFacts({
        products: [{ id: 9, name: '=cmd, "quoted"', defaultCode: null, standardPriceKwd: 0 }],
        lineSales: {
          withoutQurain: emptySales(),
          withQurain: { days30: [], days60: [{ productId: 9, qty: 1, netKwd: 3 }], allNet60Kwd: 3 },
        },
      }),
    )
    const csv = readinessAuditToCsv(report)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('nocost_product,withQurain')
    expect(csv).toContain(`'=cmd, ""quoted""`)
    expect(csv).not.toContain('apiKey')
    expect(csv).not.toContain('ODOO_')
    const sanitized = sanitizeReadinessReport({ ...report, apiKey: 'should-drop', nested: { password: 'nope' } })
    expect(sanitized).not.toHaveProperty('apiKey')
    expect((sanitized as { nested?: { password?: string } }).nested).not.toHaveProperty('password')
  })

  it('classifies read failures and limits the route to admin and auditor', () => {
    expect(classifyOdooReadFailure("Object hr.payslip doesn't exist")).toBe('missing')
    expect(classifyOdooReadFailure('Access Error')).toBe('denied')
    expect(classifyOdooReadFailure('timeout')).toBe('error')
    expect(isFatalOdooFailure(Object.assign(new Error('no'), { name: 'OdooConnectorError' }))).toBe(true)
    expect(isFatalOdooFailure(Object.assign(new Error('budget'), { name: 'BudgetStop' }))).toBe(false)
    expect(isReadinessAuditRole('admin')).toBe(true)
    expect(isReadinessAuditRole('auditor')).toBe(true)
    expect(isReadinessAuditRole('cfo')).toBe(false)
    expect(isAuditorForbiddenPath(READINESS_AUDIT_PATH)).toBe(false)
  })
})

describe('readiness audit collector', () => {
  it('only calls read methods and reports both Qurain scopes', async () => {
    const calls: OdooReadMethod[] = []
    const client: OdooReadClient = {
      async execute<T>(model: string, method: OdooReadMethod, args: unknown[] = [], kwargs: Record<string, unknown> = {}): Promise<T> {
        calls.push(method)
        return fakeOdoo(model, method, args, kwargs) as T
      },
    }
    const report = await collectReadinessAudit(client, {
      clock: () => Date.parse('2026-11-19T08:00:00.000Z'),
      budgetMs: 60_000,
      minRemainingMs: 0,
      kuwaitToday: '2026-11-19',
      generatedAt: '2026-11-19T08:00:00.000Z',
    })
    expect(new Set(calls).size).toBeGreaterThan(0)
    for (const method of calls) expect(ODOO_READ_METHODS).toContain(method)
    expect(report.readOnly).toBe(true)
    expect(report.scopes.withoutQurain.configIds).toContain(8)
    expect(report.scopes.withoutQurain.configIds).not.toContain(4)
    expect(report.scopes.withQurain.configIds).toEqual(
      [...report.scopes.withoutQurain.configIds, 4].sort((a, b) => a - b),
    )
    expect(report.advisors.find((row) => row.id === 'finance')?.decision).toBe('GO')
    expect(report.advisors.find((row) => row.id === 'seasons')?.decision).toBe('GO')
    expect(report.advisors.find((row) => row.id === 'staff')?.decision).toBe('GO')
    expect(report.advisors.find((row) => row.id === 'warehouse')?.decision).toBe('HOLD')
    expect(report.productsWithoutCost.withQurain.totals.p1Count).toBeGreaterThan(0)
    expect(report.productsWithoutCost.withQurain.rows[0]?.netKwd60).toBeGreaterThanOrEqual(
      report.productsWithoutCost.withQurain.rows.at(-1)?.netKwd60 ?? 0,
    )
    const cashier = report.cashiers.find((row) => row.configId === 24)
    expect(cashier).toMatchObject({ found: true, orders: 3, netKwd: 10 })
    expect(report.cashiers.map((row) => row.configId)).toEqual([24, 16, 35])
  })

  it('stops before any Odoo call when the budget is already spent', async () => {
    let calls = 0
    const client: OdooReadClient = {
      async execute<T>(): Promise<T> {
        calls += 1
        return [] as T
      },
    }
    const report = await collectReadinessAudit(client, {
      clock: () => 0,
      budgetMs: 0,
      minRemainingMs: 0,
      kuwaitToday: '2026-11-19',
    })
    expect(calls).toBe(0)
    expect(report.partial).toBe(true)
    for (const advisor of report.advisors) expect(advisor.decision).toBe('HOLD')
  })

  it('the live client and the route stay on the read allow-list', () => {
    const live = readFileSync(new URL('../readiness-audit-live.ts', import.meta.url), 'utf8')
    const route = readFileSync(new URL('../../../app/api/admin/readiness-audit/route.ts', import.meta.url), 'utf8')
    const collect = readFileSync(new URL('../readiness-audit-collect.ts', import.meta.url), 'utf8')
    expect(live).toContain('isOdooReadMethod')
    expect(live).not.toMatch(/'(create|write|unlink)'/)
    expect(collect).not.toMatch(/'(create|write|unlink)'/)
    expect(route).toContain('allowAuditor: true')
    expect(route).toContain('export async function GET')
    expect(route).not.toContain('export async function POST')
    expect(route).toContain('maxDuration = 60')
  })
})

function fakeOdoo(
  model: string,
  method: OdooReadMethod,
  args: unknown[],
  kwargs: Record<string, unknown>,
): unknown {
  if (model === 'pos.config' && method === 'search_read') {
    return [
      { id: 8, name: 'Promenade Mall', active: true },
      { id: 4, name: 'Delivery (Qurain)', active: true },
      { id: 24, name: 'Decommissioned', active: false },
      { id: 16, name: 'E-Mall', active: false },
      { id: 35, name: 'Delivery Ardiya Temp', active: true },
    ]
  }
  if (method === 'fields_get') {
    const wanted = Array.isArray(args[0]) ? args[0] : []
    const fields: Record<string, { type: string }> = {}
    for (const field of wanted) fields[String(field)] = { type: 'char' }
    return fields
  }
  if (method === 'search_count') return 12
  if (method === 'search_read') {
    const domain = JSON.stringify(args[0] ?? [])
    if (model === 'product.product' && domain.includes('standard_price')) {
      if (Number(kwargs.offset ?? 0) > 0) return []
      return [
        { id: 100, name: 'Bread', default_code: 'BR', standard_price: 0 },
        { id: 101, name: 'Idle', default_code: false, standard_price: 0 },
      ]
    }
    const order = String(kwargs.order ?? '')
    const fields = Array.isArray(kwargs.fields) ? kwargs.fields.map(String) : []
    if (order.startsWith('id ')) {
      const row: Record<string, unknown> = { id: 1 }
      for (const field of fields) {
        if (field === 'standard_price') row[field] = 1.25
        else if (field.endsWith('_id')) row[field] = [1, field]
        else if (field === 'active') row[field] = true
        else if (field.includes('date') || field === 'check_in' || field === 'check_out') row[field] = '2025-06-01 00:00:00'
        else row[field] = field === 'name' ? 'Sample' : 1
      }
      return [row]
    }
    const field = fields[0] ?? 'date_order'
    const stamp = order.includes('desc') ? '2026-06-01 00:00:00' : '2024-01-01 00:00:00'
    return [{ [field]: stamp, id: 1 }]
  }
  if (method === 'read_group') {
    const aggregates = Array.isArray(args[1]) ? args[1].map(String) : []
    if (model === 'pos.payment') {
      return [{ payment_method_id: [1, 'Cash'], amount: 12, __count: 3 }]
    }
    if (model === 'pos.order.line') {
      return [
        { product_id: [100, 'Bread'], qty: 4, price_subtotal: 12.5, __count: 2 },
        { product_id: [101, 'Idle'], qty: 0, price_subtotal: 0, __count: 0 },
      ]
    }
    if (aggregates.some((field) => field.includes('amount_total'))) {
      return [
        { config_id: [24, 'Decommissioned'], amount_total: 10.5, amount_tax: 0.5, __count: 3 },
        { config_id: [16, 'E-Mall'], amount_total: 2, amount_tax: 0, __count: 1 },
        { config_id: [35, 'Delivery Ardiya Temp'], amount_total: 5, amount_tax: 0, __count: 2 },
      ]
    }
    const stamp = aggregates.some((field) => field.includes('max')) ? '2026-11-01 12:00:00' : '2026-01-15 00:00:00'
    return [
      { config_id: [24, 'Decommissioned'], date_order: stamp },
      { config_id: [16, 'E-Mall'], date_order: stamp },
      { config_id: [35, 'Delivery Ardiya Temp'], date_order: stamp },
    ]
  }
  throw new Error(`unexpected ${model}.${method}`)
}
