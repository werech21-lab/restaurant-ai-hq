import { channelOfPaymentMethod } from '@/lib/odoo/live-sync-core'
import type { AttendanceRow, HrInput } from './advisors/hr'
import type { InventoryInput, QuantRow } from './advisors/inventory'
import { kuwaitDayOf } from './helpers'

type M2O = [number, string] | false | null | undefined

export interface OdooAttendanceRecord {
  employee_id: M2O
  check_in: string
  check_out: string | false | null
}

export interface OdooEmployeeRecord {
  id: number
  department_id?: M2O
}

export interface OdooQuantRecord {
  location_id: M2O
  quantity: number
}

export function attendanceInputFrom(
  attendance: readonly OdooAttendanceRecord[],
  employees: readonly OdooEmployeeRecord[],
  meta: { syncAt: string | null; rowLimit: number | null },
): HrInput['attendance'] {
  if (attendance.length === 0) return null
  const dept = new Map(employees.map((e) => [e.id, Array.isArray(e.department_id) ? e.department_id[1] : null]))
  const rows: AttendanceRow[] = attendance
    .filter((a) => Array.isArray(a.employee_id) && typeof a.check_in === 'string')
    .map((a) => {
      const employeeId = (a.employee_id as [number, string])[0]
      return { employeeId, department: dept.get(employeeId) ?? null, checkIn: a.check_in, checkOut: a.check_out || null, branchId: null }
    })
  const days = rows.map((r) => kuwaitDayOf(`${r.checkIn.replace(' ', 'T')}Z`)!).sort()
  return {
    rows,
    period: { from: days[0], to: days[days.length - 1] },
    syncAt: meta.syncAt,
    capped: meta.rowLimit !== null && attendance.length >= meta.rowLimit,
    rowLimit: meta.rowLimit,
  }
}

export function quantInputFrom(
  quants: readonly OdooQuantRecord[],
  meta: { asOf: string; syncAt: string | null; rowLimit: number | null },
): InventoryInput['quants'] {
  if (quants.length === 0) return null
  const rows: QuantRow[] = quants
    .filter((q) => Array.isArray(q.location_id))
    .map((q) => ({ locationName: String((q.location_id as [number, string])[1]), quantity: Number(q.quantity) || 0 }))
  return { rows, asOf: meta.asOf, syncAt: meta.syncAt, capped: meta.rowLimit !== null && quants.length >= meta.rowLimit, rowLimit: meta.rowLimit }
}

/**
 * Classifies an Odoo `pos.payment` method into a distinct channel for the 5-week hourly matrix:
 * direct in-branch sales (`dine-in` / `takeaway-direct`) are kept strictly distinct from
 * aggregators (`talabat-tgo`, `talabat-tmp`, `keeta`, `deliveroo`, `jahez`, `snoonu`) and `staff`.
 */
export function classifyMatrixPaymentChannel(paymentMethodName: string, isDeliveryRegister = false): string {
  const ch = channelOfPaymentMethod(paymentMethodName)
  if (ch === 'Talabat Go') return 'talabat-tgo'
  if (ch === 'Talabat MP') return 'talabat-tmp'
  if (ch === 'Keeta') return 'keeta'
  if (ch === 'Deliveroo Go' || ch === 'Deliveroo MP') return 'deliveroo'
  if (ch === 'Jahez' || ch === 'Cari') return 'jahez'
  if (ch === 'Snoonu') return 'snoonu'
  if (ch === 'Staff & complimentary') return 'staff'
  if (ch === 'Online payment link' || ch === 'Cash on delivery' || ch === 'Bilbayt') return 'takeaway-direct'
  return isDeliveryRegister ? 'takeaway-direct' : 'dine-in'
}
