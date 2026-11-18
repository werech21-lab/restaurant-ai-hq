/**
 * Real cached Odoo data for the council tests — nothing hand-written:
 * - the live 17 Nov 2026 dashboard payload (per-branch daily rows, hourly series);
 * - the real Odoo export of 31 Oct 2026 (database/seeds/venturefoods_odoo_cids1_dump.json;
 *   1000-row cap per model). Only hr.attendance, hr.employee (id + department) and stock.quant are
 *   read; names are dropped by the adapters.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { HrInput } from '@/lib/council/advisors/hr'
import type { InventoryInput } from '@/lib/council/advisors/inventory'
import { attendanceInputFrom, quantInputFrom, type OdooAttendanceRecord, type OdooEmployeeRecord, type OdooQuantRecord } from '@/lib/council/sources'
import { loadLiveTodaySummary } from '../support/dashboard-fixture'

export { loadLiveTodaySummary }

interface Dump {
  exportedAt: string
  models: {
    'hr.attendance': OdooAttendanceRecord[]
    'hr.employee': OdooEmployeeRecord[]
    'stock.quant': OdooQuantRecord[]
  }
}

let cached: Dump | null = null
export function loadOdooExport(): Dump {
  if (!cached) cached = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database/seeds/venturefoods_odoo_cids1_dump.json'), 'utf8')) as Dump
  return cached
}

export const EXPORT_ROW_LIMIT = 1000

export function realHrInput(): HrInput {
  const d = loadOdooExport()
  return { attendance: attendanceInputFrom(d.models['hr.attendance'], d.models['hr.employee'], { syncAt: d.exportedAt, rowLimit: EXPORT_ROW_LIMIT }) }
}

export function realInventoryInput(): InventoryInput {
  const d = loadOdooExport()
  return { quants: quantInputFrom(d.models['stock.quant'], { asOf: d.exportedAt.slice(0, 10), syncAt: d.exportedAt, rowLimit: EXPORT_ROW_LIMIT }), hasBoms: null }
}
