import 'server-only'
/**
 * Read-only Odoo reads for the advisor council (search_read / read_group / search_count only).
 * Kuwait time zone. Each read fails closed: on any error it returns null and the advisor reports a
 * data gap instead of a number.
 */
import { executeOdooKw, isOdooLiveEnvConfigured } from '@/lib/odoo-live-connector'
import { channelOfPaymentMethod } from '@/lib/odoo/live-sync-core'
import { buildPosPaymentUtcDomain, kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import type { AggregatorHourlyMatrix } from '@/lib/council/advisors/delivery'
import type { HrInput } from '@/lib/council/advisors/hr'
import type { InventoryInput } from '@/lib/council/advisors/inventory'
import { attendanceInputFrom, quantInputFrom, type OdooAttendanceRecord, type OdooEmployeeRecord, type OdooQuantRecord } from '@/lib/council/sources'

export const PROBED_MODELS = [
  'hr.attendance',
  'hr.attendance.overtime',
  'resource.calendar',
  'stock.move',
  'stock.scrap',
  'stock.quant',
  'mrp.bom',
  'mrp.bom.line',
] as const

export interface OdooModelProbeRow {
  model: (typeof PROBED_MODELS)[number]
  installed: boolean
  /** Records in the last 30 days (by create_date), or null when the model is absent / not readable. */
  recentCount: number | null
  readable: boolean
}

export interface OdooModelProbe {
  probedAt: string
  rows: OdooModelProbeRow[]
}

/** Which models exist in this Odoo, and how many records each holds for the last 30 days. */
export async function probeOdooModels(nowMs = Date.now()): Promise<OdooModelProbe | null> {
  if (!isOdooLiveEnvConfigured()) return null
  try {
    const installed = await executeOdooKw<{ model: string }[]>('ir.model', 'search_read', [[['model', 'in', [...PROBED_MODELS]]]], { fields: ['model'] })
    const present = new Set(installed.map((m) => m.model))
    const since = new Date(nowMs - 30 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
    const rows: OdooModelProbeRow[] = []
    for (const model of PROBED_MODELS) {
      if (!present.has(model)) {
        rows.push({ model, installed: false, recentCount: null, readable: false })
        continue
      }
      try {
        const n = await executeOdooKw<number>(model, 'search_count', [[['create_date', '>=', since]]])
        rows.push({ model, installed: true, recentCount: Number(n) || 0, readable: true })
      } catch {
        rows.push({ model, installed: true, recentCount: null, readable: false })
      }
    }
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
