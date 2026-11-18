import 'server-only'
/**
 * Read-only Odoo reads for the advisor council (`fields_get`, `search_count`, `search_read`,
 * `read_group`, `read` ONLY). Kuwait time zone. Each read fails closed: on any error it returns
 * null and the advisor reports a precise data gap instead of a number.
 */
import { executeOdooKw, isOdooLiveEnvConfigured, type OdooLiveWarehouseChainPayload } from '@/lib/odoo-live-connector'
import { buildPosPaymentUtcDomain, kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import type { AggregatorHourlyMatrix } from '@/lib/council/advisors/delivery'
import type { HrInput } from '@/lib/council/advisors/hr'
import {
  LOCATION_BRANCH,
  type ActualIngredientConsumption,
  type BomRecipeLine,
  type BomUsageInput,
  type InventoryInput,
  type PosSoldProductQty,
  type QurainBranchTransferRow,
  type QurainTransferInput,
} from '@/lib/council/advisors/inventory'
import { fromFils, r1, r3, toFils } from '@/lib/council/helpers'
import {
  attendanceInputFrom,
  classifyMatrixPaymentChannel,
  quantInputFrom,
  resolveWorkLocationBranchId,
  type OdooAttendanceRecord,
  type OdooEmployeeRecord,
  type OdooQuantRecord,
} from '@/lib/council/sources'
import type { CouncilModelProbeRow, CouncilModelProbeSummary } from '@/lib/council/types'

export const PROBED_MODELS = [
  'hr.attendance',
  'hr.employee',
  'stock.move',
  'stock.scrap',
  'stock.quant',
  'mrp.bom',
  'mrp.bom.line',
  'pos.payment',
] as const

export interface OdooModelProbeRow extends CouncilModelProbeRow {
  model: (typeof PROBED_MODELS)[number]
}

export interface OdooModelProbe extends CouncilModelProbeSummary {
  rows: OdooModelProbeRow[]
}

interface ProbeModelSpec {
  model: (typeof PROBED_MODELS)[number]
  wantedFields: readonly string[]
  primaryDateField: string | null
  branchField: string | null
}

const MODEL_PROBE_SPECS: readonly ProbeModelSpec[] = [
  {
    model: 'hr.attendance',
    wantedFields: ['employee_id', 'check_in', 'check_out', 'worked_hours', 'create_date'],
    primaryDateField: 'check_in',
    branchField: 'employee_id.work_location_id',
  },
  {
    model: 'hr.employee',
    wantedFields: ['active', 'department_id', 'work_location_id', 'company_id', 'create_date'],
    primaryDateField: 'create_date',
    branchField: 'work_location_id',
  },
  {
    model: 'stock.move',
    wantedFields: ['product_id', 'location_id', 'location_dest_id', 'quantity', 'product_uom_qty', 'state', 'date', 'create_date'],
    primaryDateField: 'date',
    branchField: 'location_id / location_dest_id',
  },
  {
    model: 'stock.scrap',
    wantedFields: ['product_id', 'location_id', 'scrap_qty', 'state', 'date_done', 'create_date'],
    primaryDateField: 'date_done',
    branchField: 'location_id',
  },
  {
    model: 'stock.quant',
    wantedFields: ['product_id', 'location_id', 'quantity', 'value', 'in_date', 'create_date'],
    primaryDateField: 'in_date',
    branchField: 'location_id',
  },
  {
    model: 'mrp.bom',
    wantedFields: ['product_tmpl_id', 'product_id', 'product_qty', 'active', 'bom_line_ids', 'create_date'],
    primaryDateField: 'create_date',
    branchField: null,
  },
  {
    model: 'mrp.bom.line',
    wantedFields: ['bom_id', 'product_id', 'product_qty', 'product_uom_id', 'create_date'],
    primaryDateField: 'create_date',
    branchField: null,
  },
  {
    model: 'pos.payment',
    wantedFields: ['pos_order_id', 'session_id', 'payment_method_id', 'amount', 'payment_date', 'create_date'],
    primaryDateField: 'payment_date',
    branchField: 'session_id -> config_id',
  },
]

async function safeCount(model: string, domain: unknown[]): Promise<number | null> {
  try {
    const n = await executeOdooKw<number>(model, 'search_count', [domain])
    return Number(n) || 0
  } catch {
    return null
  }
}

/**
 * Read-only model coverage probe across all 8 required council models:
 * `fields_get` + total `search_count([])` + 30-day `recentCount` + `dateSpan` + `% with branch`.
 */
export async function probeOdooModels(nowMs = Date.now()): Promise<OdooModelProbe | null> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    let present: Set<string> | null = null
    try {
      const installed = await executeOdooKw<{ model: string }[]>(
        'ir.model',
        'search_read',
        [[['model', 'in', [...PROBED_MODELS]]]],
        { fields: ['model'] },
      )
      present = new Set(installed.map((m) => m.model))
    } catch {
      // Some Odoo service accounts restrict `ir.model`; fall back to per-model `fields_get`.
      present = null
    }

    const since = new Date(nowMs - 30 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
    const rows: OdooModelProbeRow[] = []
    let empHasWorkLocation = false
    let empWorkLocationCount = 0

    // Probe hr.employee before hr.attendance if needed? Keep output order == PROBED_MODELS;
    // check hr.employee fields first when present so hr.attendance branch coverage knows whether work_location_id exists.
    if (!present || present.has('hr.employee')) {
      try {
        const empMeta = await executeOdooKw<Record<string, unknown>>('hr.employee', 'fields_get', [['work_location_id']], {
          attributes: ['type'],
        })
        if (empMeta && 'work_location_id' in empMeta) {
          empHasWorkLocation = true
          empWorkLocationCount = (await safeCount('hr.employee', [['work_location_id', '!=', false]])) ?? 0
        }
      } catch {
        empHasWorkLocation = false
      }
    }

    let anySucceeded = present !== null
    for (const spec of MODEL_PROBE_SPECS) {
      if (present && !present.has(spec.model)) {
        rows.push({
          model: spec.model,
          installed: false,
          readable: false,
          totalCount: null,
          recentCount: null,
          presentFields: [],
          missingFields: [...spec.wantedFields],
          dateSpan: null,
          branchCoveragePct: null,
          branchField: spec.branchField,
        })
        continue
      }

      try {
        const fieldsMeta = await executeOdooKw<Record<string, unknown>>(
          spec.model,
          'fields_get',
          [[...spec.wantedFields]],
          { attributes: ['type', 'string'] },
        )
        anySucceeded = true
        const presentFields = Object.keys(fieldsMeta ?? {})
        const missingFields = spec.wantedFields.filter((f) => !presentFields.includes(f))
        const totalCount = await executeOdooKw<number>(spec.model, 'search_count', [[]])
        const total = Number(totalCount) || 0

        const recentDateField =
          spec.primaryDateField && presentFields.includes(spec.primaryDateField)
            ? spec.primaryDateField
            : presentFields.includes('create_date')
              ? 'create_date'
              : null
        const recentCount =
          recentDateField && total > 0 ? await safeCount(spec.model, [[recentDateField, '>=', since]]) : total === 0 ? 0 : null

        let dateSpan: OdooModelProbeRow['dateSpan'] = null
        if (spec.primaryDateField && presentFields.includes(spec.primaryDateField) && total > 0) {
          const df = spec.primaryDateField
          const [minRows, maxRows] = await Promise.all([
            executeOdooKw<Record<string, string | false>[]>(
              spec.model,
              'search_read',
              [[[df, '!=', false]]],
              { fields: [df], order: `${df} asc`, limit: 1 },
            ).catch(() => []),
            executeOdooKw<Record<string, string | false>[]>(
              spec.model,
              'search_read',
              [[[df, '!=', false]]],
              { fields: [df], order: `${df} desc`, limit: 1 },
            ).catch(() => []),
          ])
          dateSpan = {
            field: df,
            min: typeof minRows[0]?.[df] === 'string' ? (minRows[0][df] as string) : null,
            max: typeof maxRows[0]?.[df] === 'string' ? (maxRows[0][df] as string) : null,
          }
        }

        let branchCoveragePct: number | null = null
        let departmentCoveragePct: number | null | undefined
        let supportsConfigHourMethodGroup: boolean | undefined

        if (spec.model === 'hr.employee') {
          if (total === 0) {
            branchCoveragePct = 0
            departmentCoveragePct = 0
          } else {
            branchCoveragePct = presentFields.includes('work_location_id') ? r1((empWorkLocationCount / total) * 100) : 0
            if (presentFields.includes('department_id')) {
              const withDept = (await safeCount('hr.employee', [['department_id', '!=', false]])) ?? 0
              departmentCoveragePct = r1((withDept / total) * 100)
            }
          }
        } else if (spec.model === 'hr.attendance') {
          if (total === 0 || !empHasWorkLocation || empWorkLocationCount === 0) {
            branchCoveragePct = 0
          } else {
            const withLoc = (await safeCount('hr.attendance', [['employee_id.work_location_id', '!=', false]])) ?? 0
            branchCoveragePct = r1((withLoc / total) * 100)
          }
        } else if (spec.model === 'stock.move') {
          if (total > 0 && (presentFields.includes('location_id') || presentFields.includes('location_dest_id'))) {
            const withLoc =
              (await safeCount('stock.move', ['|', ['location_id', '!=', false], ['location_dest_id', '!=', false]])) ??
              (await safeCount('stock.move', [['location_dest_id', '!=', false]])) ??
              0
            branchCoveragePct = r1((withLoc / total) * 100)
          } else if (total === 0) {
            branchCoveragePct = 0
          }
        } else if (spec.model === 'stock.scrap') {
          if (total > 0 && presentFields.includes('location_id')) {
            const withLoc = (await safeCount('stock.scrap', [['location_id', '!=', false]])) ?? 0
            branchCoveragePct = r1((withLoc / total) * 100)
          } else if (total === 0) {
            branchCoveragePct = 0
          }
        } else if (spec.model === 'stock.quant') {
          if (total > 0 && presentFields.includes('location_id')) {
            const internalCnt =
              (await safeCount('stock.quant', [['location_id.usage', '=', 'internal']])) ??
              (await safeCount('stock.quant', [['location_id', '!=', false]])) ??
              0
            branchCoveragePct = r1((internalCnt / total) * 100)
          } else if (total === 0) {
            branchCoveragePct = 0
          }
        } else if (spec.model === 'pos.payment') {
          if (total > 0 && presentFields.includes('session_id')) {
            const withCfg =
              (await safeCount('pos.payment', [['session_id.config_id', '!=', false]])) ??
              (await safeCount('pos.payment', [['session_id', '!=', false]])) ??
              0
            branchCoveragePct = r1((withCfg / total) * 100)
            try {
              const sampleGroups = await executeOdooKw<{ session_id?: [number, string] | false }[]>(
                'pos.payment',
                'read_group',
                [[['payment_date', '!=', false]], ['amount:sum'], ['session_id', 'payment_method_id', 'payment_date:hour']],
                { lazy: false, limit: 3, context: { tz: 'Asia/Kuwait' } },
              )
              const sid = Array.isArray(sampleGroups[0]?.session_id) ? sampleGroups[0].session_id[0] : null
              if (sid) {
                const sess = await executeOdooKw<{ id: number; config_id: [number, string] | false }[]>(
                  'pos.session',
                  'read',
                  [[sid], ['config_id']],
                )
                supportsConfigHourMethodGroup = Array.isArray(sess[0]?.config_id)
              } else {
                supportsConfigHourMethodGroup = Array.isArray(sampleGroups)
              }
            } catch {
              supportsConfigHourMethodGroup = false
            }
          } else if (total === 0) {
            branchCoveragePct = 0
            supportsConfigHourMethodGroup = true
          }
        }

        rows.push({
          model: spec.model,
          installed: true,
          readable: true,
          totalCount: total,
          recentCount,
          presentFields,
          missingFields,
          dateSpan,
          branchCoveragePct,
          branchField: spec.branchField,
          ...(departmentCoveragePct !== undefined ? { departmentCoveragePct } : {}),
          ...(supportsConfigHourMethodGroup !== undefined ? { supportsConfigHourMethodGroup } : {}),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        const notInstalled = !present && /doesn't exist|does not exist|unknown model/i.test(msg)
        rows.push({
          model: spec.model,
          installed: !notInstalled,
          readable: false,
          totalCount: null,
          recentCount: null,
          presentFields: [],
          missingFields: [...spec.wantedFields],
          dateSpan: null,
          branchCoveragePct: null,
          branchField: spec.branchField,
        })
      }
    }

    if (!anySucceeded) return null
    return { probedAt: new Date(nowMs).toISOString(), rows }
  } catch {
    return null
  }
}

/**
 * 5-week branch × Kuwait hour × channel matrix from `pos.payment`, grouped by session, payment
 * method, and payment hour (`config × hour × method`). Direct in-branch payment methods (`dine-in`
 * / `takeaway-direct`) are mapped distinctly from aggregators (`talabat-tgo`, `talabat-tmp`, `keeta`).
 */
export async function fetchAggregatorHourlyMatrix(
  fromIso: string,
  toIso: string,
  branchOfConfig: ReadonlyMap<number, string>,
  syncAt: string | null,
): Promise<AggregatorHourlyMatrix | null> {
  if (!isOdooLiveEnvConfigured() || branchOfConfig.size === 0) return null
  try {
    const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
    const domain = buildPosPaymentUtcDomain({
      fromUtc: bounds.fromUtc,
      toExclusiveUtc: bounds.toExclusiveUtc,
      configIds: [...branchOfConfig.keys()],
      nonRefundOnly: true,
    })
    const groups = await executeOdooKw<
      {
        session_id: [number, string] | false
        payment_method_id: [number, string] | false
        amount?: number
        __count?: number
        __range?: Record<string, { from: string }>
      }[]
    >('pos.payment', 'read_group', [domain, ['amount:sum'], ['session_id', 'payment_method_id', 'payment_date:hour']], {
      lazy: false,
      context: { tz: 'Asia/Kuwait' },
    })
    const sessionIds = [
      ...new Set(groups.map((g) => (Array.isArray(g.session_id) ? g.session_id[0] : null)).filter((x): x is number => x !== null)),
    ]
    const sessions = sessionIds.length
      ? await executeOdooKw<{ id: number; config_id: [number, string] | false }[]>('pos.session', 'read', [sessionIds, ['config_id']])
      : []
    const cfgOf = new Map<number, { id: number | null; name: string }>(
      sessions.map((s) => [s.id, { id: Array.isArray(s.config_id) ? s.config_id[0] : null, name: Array.isArray(s.config_id) ? s.config_id[1] : '' }]),
    )
    const cells = new Map<string, { day: string; hour: number; branchId: string; channel: string; orders: number; netFils: number }>()
    for (const g of groups) {
      const sid = Array.isArray(g.session_id) ? g.session_id[0] : null
      const cfgInfo = sid ? cfgOf.get(sid) : undefined
      const cfg = cfgInfo?.id ?? null
      const branchId = cfg ? branchOfConfig.get(cfg) : undefined
      const fromUtc = g.__range?.['payment_date:hour']?.from
      if (!branchId || !fromUtc) continue
      const kuwait = new Date(Date.parse(`${fromUtc.replace(' ', 'T')}Z`) + 3 * 3_600_000)
      const day = kuwait.toISOString().slice(0, 10)
      const hour = kuwait.getUTCHours()
      const isDeliveryRegister = branchId === 'ardiya' || /delivery|call\s*center/i.test(cfgInfo?.name ?? '')
      const pmName = Array.isArray(g.payment_method_id) ? g.payment_method_id[1] : ''
      const channel = classifyMatrixPaymentChannel(pmName, isDeliveryRegister)
      if (channel === 'staff') continue
      const k = `${day}|${hour}|${branchId}|${channel}`
      const c = cells.get(k) ?? { day, hour, branchId, channel, orders: 0, netFils: 0 }
      c.orders += Number(g.__count) || 0
      c.netFils += toFils(Number(g.amount) || 0)
      cells.set(k, c)
    }
    return {
      rows: [...cells.values()].map((c) => ({
        day: c.day,
        hour: c.hour,
        branchId: c.branchId,
        channel: c.channel,
        orders: c.orders,
        netKwd: fromFils(c.netFils),
      })),
      period: { from: fromIso, to: toIso },
      syncAt,
    }
  } catch {
    return null
  }
}

const ATTENDANCE_LIMIT = 20_000

export async function fetchAttendanceInput(fromIso: string, toIso: string): Promise<HrInput['attendance']> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
    const att = await executeOdooKw<OdooAttendanceRecord[]>(
      'hr.attendance',
      'search_read',
      [[['check_in', '>=', bounds.fromUtc], ['check_in', '<', bounds.toExclusiveUtc]]],
      { fields: ['employee_id', 'check_in', 'check_out'], limit: ATTENDANCE_LIMIT },
    )
    const ids = [
      ...new Set(att.map((a) => (Array.isArray(a.employee_id) ? a.employee_id[0] : null)).filter((x): x is number => x !== null)),
    ]
    let empFields = ['department_id']
    if (ids.length > 0) {
      try {
        const meta = await executeOdooKw<Record<string, unknown>>('hr.employee', 'fields_get', [['department_id', 'work_location_id']], {
          attributes: ['type'],
        })
        const verified = ['department_id', 'work_location_id'].filter((f) => meta && f in meta)
        if (verified.length > 0) empFields = verified
      } catch {
        empFields = ['department_id']
      }
    }
    // Strictly id + department_id + work_location_id: employee names NEVER leave Odoo.
    const emps = ids.length ? await executeOdooKw<OdooEmployeeRecord[]>('hr.employee', 'read', [ids, empFields]) : []
    return attendanceInputFrom(att, emps, { syncAt: new Date().toISOString(), rowLimit: ATTENDANCE_LIMIT })
  } catch {
    return null
  }
}

const QUANT_LIMIT = 50_000

export async function fetchQuantInput(asOfIso: string): Promise<InventoryInput['quants']> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const q = await executeOdooKw<OdooQuantRecord[]>(
      'stock.quant',
      'search_read',
      [[['location_id.usage', '=', 'internal']]],
      { fields: ['location_id', 'quantity'], limit: QUANT_LIMIT },
    )
    return quantInputFrom(q, { asOf: asOfIso, syncAt: new Date().toISOString(), rowLimit: QUANT_LIMIT })
  } catch {
    return null
  }
}

const QURAIN_MOVE_LIMIT = 20_000
const QURAIN_SRC_RE = /\b(?:qrn|qurain|kurain)\b|القرين|قرين/i
const DECOMMISSIONED_DEST_RE = /\b(?:jahra|jhr|heisenberg)\b|الجهراء|هايزن/i

function resolveTransferDestBranch(rawDestLabel: string): string | null {
  if (!rawDestLabel || DECOMMISSIONED_DEST_RE.test(rawDestLabel)) return null
  const root = rawDestLabel.split('/')[0].trim()
  if (root in LOCATION_BRANCH && LOCATION_BRANCH[root] !== 'qurain') {
    return LOCATION_BRANCH[root]
  }
  const resolved = resolveWorkLocationBranchId(rawDestLabel)
  return resolved && resolved !== 'qurain' ? resolved : null
}

/**
 * Reads Qurain (`QRN/Stock` / `القرين`) outbound `stock.move` transfers vs validated branch receipts.
 */
export async function fetchQurainTransferInput(fromIso: string, toIso: string): Promise<QurainTransferInput | null> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
    const fieldsMeta = await executeOdooKw<Record<string, unknown>>(
      'stock.move',
      'fields_get',
      [['product_id', 'location_id', 'location_dest_id', 'quantity', 'product_uom_qty', 'state', 'date']],
      { attributes: ['type'] },
    )
    const qtyField = fieldsMeta && 'quantity' in fieldsMeta ? 'quantity' : 'product_uom_qty'
    const moves = await executeOdooKw<
      {
        id: number
        product_id: [number, string] | false
        location_id: [number, string] | false
        location_dest_id: [number, string] | false
        quantity?: number
        product_uom_qty?: number
        state: string
      }[]
    >(
      'stock.move',
      'search_read',
      [
        [
          ['date', '>=', bounds.fromUtc],
          ['date', '<', bounds.toExclusiveUtc],
          ['state', 'in', ['done', 'assigned', 'confirmed', 'waiting']],
          '|',
          '|',
          ['location_id.complete_name', 'ilike', 'QRN'],
          ['location_id.complete_name', 'ilike', 'Qurain'],
          ['location_id.complete_name', 'ilike', 'القرين'],
        ],
      ],
      { fields: ['product_id', 'location_id', 'location_dest_id', qtyField, 'state'], limit: QURAIN_MOVE_LIMIT },
    )

    const validMoves = moves.filter((m) => {
      const srcLabel = Array.isArray(m.location_id) ? m.location_id[1] : ''
      const dstLabel = Array.isArray(m.location_dest_id) ? m.location_dest_id[1] : ''
      return QURAIN_SRC_RE.test(srcLabel) && Boolean(resolveTransferDestBranch(dstLabel))
    })

    const prodIds = [
      ...new Set(validMoves.map((m) => (Array.isArray(m.product_id) ? m.product_id[0] : null)).filter((x): x is number => x !== null)),
    ]
    const prods = prodIds.length
      ? await executeOdooKw<{ id: number; standard_price?: number }[]>('product.product', 'read', [prodIds, ['standard_price']]).catch(
          () => [],
        )
      : []
    const costFilsById = new Map<number, number>(prods.map((p) => [p.id, toFils(Number(p.standard_price) || 0)]))

    const byBranchMap = new Map<
      string,
      { dispQty: number; dispFils: number; recQty: number; recFils: number; unrecQty: number; unrecFils: number }
    >()
    let totalDispQty = 0
    let totalDispFils = 0
    let totalRecQty = 0
    let totalRecFils = 0
    let totalUnrecQty = 0
    let totalUnrecFils = 0

    for (const m of validMoves) {
      const dstLabel = Array.isArray(m.location_dest_id) ? m.location_dest_id[1] : ''
      const branchId = resolveTransferDestBranch(dstLabel)
      if (!branchId) continue
      const pid = Array.isArray(m.product_id) ? m.product_id[0] : -1
      const qty = Math.max(0, Number(qtyField === 'quantity' ? m.quantity : m.product_uom_qty) || 0)
      if (qty <= 0) continue
      const unitFils = costFilsById.get(pid) ?? 0
      const valFils = Math.round(qty * unitFils)

      const b = byBranchMap.get(branchId) ?? { dispQty: 0, dispFils: 0, recQty: 0, recFils: 0, unrecQty: 0, unrecFils: 0 }
      b.dispQty = r3(b.dispQty + qty)
      b.dispFils += valFils
      totalDispQty = r3(totalDispQty + qty)
      totalDispFils += valFils

      if (m.state === 'done') {
        b.recQty = r3(b.recQty + qty)
        b.recFils += valFils
        totalRecQty = r3(totalRecQty + qty)
        totalRecFils += valFils
      } else {
        b.unrecQty = r3(b.unrecQty + qty)
        b.unrecFils += valFils
        totalUnrecQty = r3(totalUnrecQty + qty)
        totalUnrecFils += valFils
      }
      byBranchMap.set(branchId, b)
    }

    const byBranch: QurainBranchTransferRow[] = [...byBranchMap.entries()].map(([branchId, v]) => ({
      branchId,
      dispatchedQty: v.dispQty,
      dispatchedKwd: fromFils(v.dispFils),
      receivedQty: v.recQty,
      receivedKwd: fromFils(v.recFils),
      unreceivedQty: v.unrecQty,
      unreceivedKwd: fromFils(v.unrecFils),
    }))

    return {
      period: { from: fromIso, to: toIso },
      syncAt: new Date().toISOString(),
      movesCount: validMoves.length,
      dispatchedQty: totalDispQty,
      dispatchedKwd: fromFils(totalDispFils),
      receivedQty: totalRecQty,
      receivedKwd: fromFils(totalRecFils),
      unreceivedQty: totalUnrecQty,
      unreceivedKwd: fromFils(totalUnrecFils),
      byBranch,
    }
  } catch {
    return null
  }
}

/**
 * Reads `mrp.bom`, `mrp.bom.line`, and `pos.order.line` quantities ONLY when BoMs exist in Odoo,
 * pairing theoretical usage against actual `warehouse` product consumption.
 */
export async function fetchBomUsageInput(
  fromIso: string,
  toIso: string,
  branchOfConfig: ReadonlyMap<number, string>,
  warehouse: OdooLiveWarehouseChainPayload | null,
): Promise<BomUsageInput | null> {
  if (!isOdooLiveEnvConfigured() || branchOfConfig.size === 0 || !warehouse?.connected) return null
  try {
    const boms = await executeOdooKw<
      { id: number; product_id?: [number, string] | false; product_tmpl_id?: [number, string] | false; product_qty?: number }[]
    >('mrp.bom', 'search_read', [[['active', '=', true]]], {
      fields: ['id', 'product_id', 'product_tmpl_id', 'product_qty'],
      limit: 5_000,
    })
    if (boms.length === 0) return null

    const bomIds = boms.map((b) => b.id)
    const rawLines = await executeOdooKw<
      { bom_id: [number, string] | false; product_id: [number, string] | false; product_qty?: number }[]
    >('mrp.bom.line', 'search_read', [[['bom_id', 'in', bomIds]]], {
      fields: ['bom_id', 'product_id', 'product_qty'],
      limit: 25_000,
    })
    if (rawLines.length === 0) return null

    // Resolve template-level BoMs (`product_id = false`, `product_tmpl_id` set) to `product.product` ids
    const tmplIds = [
      ...new Set(
        boms
          .filter((b) => !Array.isArray(b.product_id) && Array.isArray(b.product_tmpl_id))
          .map((b) => (b.product_tmpl_id as [number, string])[0]),
      ),
    ]
    const tmplProducts = tmplIds.length
      ? await executeOdooKw<{ id: number; product_tmpl_id: [number, string] | false }[]>(
          'product.product',
          'search_read',
          [[['product_tmpl_id', 'in', tmplIds]]],
          { fields: ['id', 'product_tmpl_id'], limit: 10_000 },
        )
      : []
    const prodIdsByTmpl = new Map<number, number[]>()
    for (const p of tmplProducts) {
      if (!Array.isArray(p.product_tmpl_id)) continue
      const tid = p.product_tmpl_id[0]
      prodIdsByTmpl.set(tid, [...(prodIdsByTmpl.get(tid) ?? []), p.id])
    }

    const ingredientIds = [
      ...new Set(rawLines.map((l) => (Array.isArray(l.product_id) ? l.product_id[0] : null)).filter((x): x is number => x !== null)),
    ]
    const ingCosts = ingredientIds.length
      ? await executeOdooKw<{ id: number; standard_price?: number }[]>('product.product', 'read', [
          ingredientIds,
          ['standard_price'],
        ]).catch(() => [])
      : []
    const costByIng = new Map<number, number>(ingCosts.map((c) => [c.id, Number(c.standard_price) || 0]))

    const bomHeaderById = new Map(boms.map((b) => [b.id, b]))
    const bomLines: BomRecipeLine[] = []
    const soldTargetProductIds = new Set<number>()
    for (const l of rawLines) {
      if (!Array.isArray(l.bom_id) || !Array.isArray(l.product_id)) continue
      const header = bomHeaderById.get(l.bom_id[0])
      if (!header) continue
      const posProdIds = Array.isArray(header.product_id)
        ? [header.product_id[0]]
        : Array.isArray(header.product_tmpl_id)
          ? (prodIdsByTmpl.get(header.product_tmpl_id[0]) ?? [])
          : []
      const ingQty = Number(l.product_qty) || 0
      if (ingQty <= 0) continue
      for (const posPid of posProdIds) {
        soldTargetProductIds.add(posPid)
        bomLines.push({
          posProductId: posPid,
          bomProductQty: Number(header.product_qty) || 1,
          ingredientProductId: l.product_id[0],
          ingredientName: l.product_id[1],
          ingredientQty: ingQty,
          unitCostKwd: costByIng.get(l.product_id[0]) ?? 0,
        })
      }
    }
    if (bomLines.length === 0 || soldTargetProductIds.size === 0) return null

    const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
    const lineDomain: unknown[][] = [
      ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
      ['order_id.date_order', '>=', bounds.fromUtc],
      ['order_id.date_order', '<', bounds.toExclusiveUtc],
      ['order_id.session_id.config_id', 'in', [...branchOfConfig.keys()]],
      ['product_id', 'in', [...soldTargetProductIds]],
    ]
    const posGroups = await executeOdooKw<{ product_id: [number, string] | false; qty?: number }[]>(
      'pos.order.line',
      'read_group',
      [lineDomain, ['qty:sum'], ['product_id']],
      { lazy: false },
    )
    const posSales: PosSoldProductQty[] = posGroups
      .filter((g) => Array.isArray(g.product_id) && (Number(g.qty) || 0) > 0)
      .map((g) => ({
        productId: (g.product_id as [number, string])[0],
        qtySold: Number(g.qty) || 0,
      }))
    if (posSales.length === 0) return null

    const actualConsumption: ActualIngredientConsumption[] = (warehouse.products ?? [])
      .filter((p) => p.consumedQty > 0)
      .map((p) => ({
        ingredientProductId: p.productId,
        actualQty: p.consumedQty,
        actualKwd: p.consumedValueKwd,
      }))

    return {
      period: { from: fromIso, to: toIso },
      syncAt: warehouse.lastSyncAt ?? new Date().toISOString(),
      bomLines,
      posSales,
      actualConsumption,
    }
  } catch {
    return null
  }
}
