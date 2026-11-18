import 'server-only'
import { executeOdooKw, isOdooLiveEnvConfigured } from '@/lib/odoo-live-connector'
import { channelOfPaymentMethod } from '@/lib/odoo/live-sync-core'
import { buildPosPaymentUtcDomain, kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import type { AggregatorHourlyMatrix } from '@/lib/council/advisors/delivery'
import type { HrInput } from '@/lib/council/advisors/hr'
import type { InventoryInput } from '@/lib/council/advisors/inventory'
import { r1 } from '@/lib/council/helpers'
import { attendanceInputFrom, quantInputFrom, type OdooAttendanceRecord, type OdooEmployeeRecord, type OdooQuantRecord } from '@/lib/council/sources'
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

const PLATFORM_OF: Record<string, string> = { 'Talabat Go': 'talabat-tgo', 'Talabat MP': 'talabat-tmp', Keeta: 'keeta' }

/**
 * Branch × Kuwait hour × channel matrix from pos.payment, grouped by session, payment method and
 * payment hour. `branchOfConfig` is the company register → branch map (from the period cube).
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
    const domain = buildPosPaymentUtcDomain({ fromUtc: bounds.fromUtc, toExclusiveUtc: bounds.toExclusiveUtc, configIds: [...branchOfConfig.keys()], nonRefundOnly: true })
    const groups = await executeOdooKw<{ session_id: [number, string] | false; payment_method_id: [number, string] | false; amount?: number; __count?: number; __range?: Record<string, { from: string }> }[]>(
      'pos.payment',
      'read_group',
      [domain, ['amount:sum'], ['session_id', 'payment_method_id', 'payment_date:hour']],
      { lazy: false, context: { tz: 'Asia/Kuwait' } },
    )
    const sessionIds = [...new Set(groups.map((g) => (Array.isArray(g.session_id) ? g.session_id[0] : null)).filter((x): x is number => x !== null))]
    const sessions = sessionIds.length ? await executeOdooKw<{ id: number; config_id: [number, string] | false }[]>('pos.session', 'read', [sessionIds, ['config_id']]) : []
    const cfgOf = new Map(sessions.map((s) => [s.id, Array.isArray(s.config_id) ? s.config_id[0] : null]))
    const cells = new Map<string, { day: string; hour: number; branchId: string; channel: string; orders: number; netKwd: number }>()
    for (const g of groups) {
      const sid = Array.isArray(g.session_id) ? g.session_id[0] : null
      const cfg = sid ? cfgOf.get(sid) : null
      const branchId = cfg ? branchOfConfig.get(cfg) : undefined
      const fromUtc = g.__range?.['payment_date:hour']?.from
      if (!branchId || !fromUtc) continue
      const kuwait = new Date(Date.parse(`${fromUtc.replace(' ', 'T')}Z`) + 3 * 3_600_000)
      const day = kuwait.toISOString().slice(0, 10)
      const hour = kuwait.getUTCHours()
      const channel = PLATFORM_OF[channelOfPaymentMethod(Array.isArray(g.payment_method_id) ? g.payment_method_id[1] : '')] ?? 'other'
      const k = `${day}|${hour}|${branchId}|${channel}`
      const c = cells.get(k) ?? { day, hour, branchId, channel, orders: 0, netKwd: 0 }
      c.orders += Number(g.__count) || 0
      c.netKwd += Number(g.amount) || 0
      cells.set(k, c)
    }
    return { rows: [...cells.values()], period: { from: fromIso, to: toIso }, syncAt }
  } catch {
    return null
  }
}

const ATTENDANCE_LIMIT = 20_000

export async function fetchAttendanceInput(fromIso: string, toIso: string): Promise<HrInput['attendance']> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
    const att = await executeOdooKw<OdooAttendanceRecord[]>('hr.attendance', 'search_read', [[['check_in', '>=', bounds.fromUtc], ['check_in', '<', bounds.toExclusiveUtc]]], { fields: ['employee_id', 'check_in', 'check_out'], limit: ATTENDANCE_LIMIT })
    const ids = [...new Set(att.map((a) => (Array.isArray(a.employee_id) ? a.employee_id[0] : null)).filter((x): x is number => x !== null))]
    // Only id + department are read: names never leave Odoo.
    const emps = ids.length ? await executeOdooKw<OdooEmployeeRecord[]>('hr.employee', 'read', [ids, ['department_id']]) : []
    return attendanceInputFrom(att, emps, { syncAt: new Date().toISOString(), rowLimit: ATTENDANCE_LIMIT })
  } catch {
    return null
  }
}

const QUANT_LIMIT = 50_000

export async function fetchQuantInput(asOfIso: string): Promise<InventoryInput['quants']> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const q = await executeOdooKw<OdooQuantRecord[]>('stock.quant', 'search_read', [[['location_id.usage', '=', 'internal']]], { fields: ['location_id', 'quantity'], limit: QUANT_LIMIT })
    return quantInputFrom(q, { asOf: asOfIso, syncAt: new Date().toISOString(), rowLimit: QUANT_LIMIT })
  } catch {
    return null
  }
}
