/**
 * Adapters from Odoo record shapes (search_read / read rows, as exported or read live) to advisor inputs.
 * Employee names are dropped here and never reach an advisor.
 */
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
  work_location_id?: M2O
}

export interface OdooQuantRecord {
  location_id: M2O
  quantity: number
}

const DECOMMISSIONED_HR_LOC_RE = /\b(?:jahra|jhr|heisenberg)\b|الجهراء|هايزن/i

/**
 * Maps an Odoo `hr.employee.work_location_id` label to a canonical Venture Foods `branchId`.
 * Returns `null` when unset, head-office, or decommissioned.
 */
export function resolveWorkLocationBranchId(rawWorkLocation: string | null | undefined): string | null {
  if (!rawWorkLocation) return null
  const text = rawWorkLocation.trim()
  if (!text || DECOMMISSIONED_HR_LOC_RE.test(text)) return null
  const lower = text.toLowerCase()
  if (/\b(?:npis|faips|fas|canteen|canteens|cnt)\b|مقصف|مقاصف/.test(lower)) return 'school-canteens'
  if (/\b(?:exhibition|exebition|exb|bazaar|booth|booths)\b|معرض|المعارض|بوث|بوثات/.test(lower)) return 'exhibitions'
  if (/\b(?:qurain|kurain|qrn)\b|القرين|قرين|central\s*kitchen|مطبخ\s*مركزي/.test(lower)) return 'qurain'
  if (/\b360\b|مجمع\s*360|مول\s*360/.test(lower)) return '360-mall'
  if (/\b(?:promenade|prm)\b|بروميناد|البروميناد/.test(lower)) return 'promenade'
  if (/\b(?:assima|asimah|asm)\b|العاصمة/.test(lower)) return 'assima'
  if (/\b(?:al[-\s]*kout|kout|kot)\b|الكوت/.test(lower)) return 'al-kout'
  if (/\b(?:avenues|avn)\b|الأفنيوز|الافنيوز|أفنيوز/.test(lower)) return 'avenues'
  if (/\b(?:salmiya|slm)\b|السالمية/.test(lower)) return 'salmiya'
  if (/\b(?:ardiya|ard)\b|العارضية/.test(lower)) return 'ardiya'
  if (/\bhawall?[yi]\b|\bhwl\b|حولي/.test(lower)) return 'promenade'
  return null
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

export function attendanceInputFrom(
  attendance: readonly OdooAttendanceRecord[],
  employees: readonly OdooEmployeeRecord[],
  meta: { syncAt: string | null; rowLimit: number | null },
): HrInput['attendance'] {
  if (attendance.length === 0) return null
  const dept = new Map<number, string | null>()
  const branchOfEmp = new Map<number, string | null>()
  for (const e of employees) {
    dept.set(e.id, Array.isArray(e.department_id) ? String(e.department_id[1]) : null)
    const workLocLabel = Array.isArray(e.work_location_id) ? String(e.work_location_id[1]) : null
    branchOfEmp.set(e.id, resolveWorkLocationBranchId(workLocLabel))
  }
  const rows: AttendanceRow[] = attendance
    .filter((a) => Array.isArray(a.employee_id) && typeof a.check_in === 'string')
    .map((a) => {
      const employeeId = (a.employee_id as [number, string])[0]
      return {
        employeeId,
        department: dept.get(employeeId) ?? null,
        checkIn: a.check_in,
        checkOut: a.check_out || null,
        branchId: branchOfEmp.get(employeeId) ?? null,
      }
    })
  if (rows.length === 0) return null
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
