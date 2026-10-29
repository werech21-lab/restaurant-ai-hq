import { z } from 'zod'

export const idParamsSchema = z.object({ id: z.string().uuid() })

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().int().min(0).max(1_000_000_000_000)
const version = z.number().int().min(1)

export const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(1).max(20),
  fullName: z.string().trim().min(1).max(200),
  roleTitle: z.string().trim().min(1).max(80),
  department: z.string().trim().min(1).max(80),
  branchId: z.string().uuid().nullable(),
  basicSalaryMinor: money,
  allowancesMinor: money,
  residencyExpiry: date.nullable(),
  status: z.enum(['active', 'inactive']),
})
export type CreateEmployeeInput = z.output<typeof createEmployeeSchema>

export const updateEmployeeSchema = createEmployeeSchema.omit({ employeeCode: true }).extend({ version })
export type UpdateEmployeeInput = z.output<typeof updateEmployeeSchema>

export const createShiftSchema = z.object({
  branchId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
  weekday: z.number().int().min(0).max(6),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
})
export type CreateShiftInput = z.output<typeof createShiftSchema>

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime().nullable(),
  overtimeMinutes: z.number().int().min(0).max(1440),
})
export type CreateAttendanceInput = z.output<typeof createAttendanceSchema>

export const createLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(['annual', 'sick', 'unpaid']),
  startDate: date,
  endDate: date,
})
export type CreateLeaveInput = z.output<typeof createLeaveSchema>

export const decideLeaveSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  version,
})
export type DecideLeaveInput = z.output<typeof decideLeaveSchema>

export const runPayrollSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  entryDate: date,
  deductions: z.array(z.object({ employeeId: z.string().uuid(), deductionsMinor: money })).max(500),
})
export type RunPayrollInput = z.output<typeof runPayrollSchema>

export const createAppraisalSchema = z.object({
  employeeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  kpiScore: z.number().int().min(0).max(100),
  reviewerNotes: z.string().trim().max(500),
})
export type CreateAppraisalInput = z.output<typeof createAppraisalSchema>

export const createExpenseSchema = z.object({
  employeeId: z.string().uuid(),
  category: z.string().trim().min(1).max(80),
  amountMinor: z.number().int().min(1).max(1_000_000_000_000),
  cash: z.boolean().optional(),
})
export type CreateExpenseInput = z.output<typeof createExpenseSchema>

export const bookAppointmentSchema = z.object({
  requestCode: z.string().trim().min(1).max(40),
  employeeName: z.string().trim().min(1).max(200),
  branchId: z.string().uuid().nullable(),
  requestType: z.enum(['passport_handover', 'equipment_clearance', 'contract_signing', 'salary_certificate', 'residency_renewal']),
  actionDirection: z.enum(['pickup_from_hq', 'deliver_to_hq']),
  appointmentDate: date,
  appointmentTimeSlot: z.enum(['08:00-08:30', '09:00-09:30', '10:00-10:30', '11:00-11:30', '12:00-12:30', '13:00-13:30']),
  hqCounterOrOfficer: z.string().trim().min(1).max(120),
  notesAr: z.string().trim().max(500),
})
export type BookAppointmentInput = z.output<typeof bookAppointmentSchema>

export const appointmentActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm'), version }),
  z.object({ action: z.literal('complete'), version }),
  z.object({ action: z.literal('miss'), version }),
])
export type AppointmentActionInput = z.output<typeof appointmentActionSchema>

export const decideExpenseSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  entryDate: date,
  version,
})
export type DecideExpenseInput = z.output<typeof decideExpenseSchema>
