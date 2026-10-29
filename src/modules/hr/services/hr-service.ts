import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { isUniqueViolation, versionConflict } from '@/lib/auth/require'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { recordMovementWithin } from '@/modules/admin'
import { enforceCompliance, workedMinutes } from '@/modules/governance'
import { buildEmployeeExpenseLines, buildPayrollLines, getOperationalAccountsWithin, postSourcedEntryWithin, publishFinanceEvents, type FinanceEvent } from '@/modules/finance'
import { inclusiveDays, payrollTotals, payslipAmounts } from '@/modules/hr/domain/payroll'
import type { Appraisal, Attendance, Employee, EmployeeExpense, Leave, PayrollRun, Payslip, Shift } from '@/modules/hr/domain/types'
import { publishHrEvents, type HrEvent } from '@/modules/hr/events'
import * as repository from '@/modules/hr/repositories/hr-repository'
import type {
  CreateAppraisalInput,
  CreateAttendanceInput,
  CreateEmployeeInput,
  CreateExpenseInput,
  CreateLeaveInput,
  CreateShiftInput,
  DecideExpenseInput,
  DecideLeaveInput,
  RunPayrollInput,
  UpdateEmployeeInput,
} from '@/modules/hr/schemas/hr'

function stamp(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

async function salaryAccounts(tx: Parameters<typeof getOperationalAccountsWithin>[0], tenantId: string): Promise<{ expenseId: string; payableId: string }> {
  const saved = await getOperationalAccountsWithin(tx, tenantId)
  if (!saved?.salaryExpenseAccountId || !saved.salaryPayableAccountId) {
    throw new DomainError('payroll_accounts_missing', 'Salaries expense and accrued salaries must be saved before payroll can post.')
  }
  return { expenseId: saved.salaryExpenseAccountId, payableId: saved.salaryPayableAccountId }
}

export function listEmployees(auth: AuthContext): Promise<Employee[]> {
  return withTransaction((tx) => repository.listEmployees(tx, auth.tenantId))
}

export async function createEmployee(auth: AuthContext, key: string, input: CreateEmployeeInput): Promise<IdempotentResult<{ data: Employee }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.employee.create', key, requestHash: hashRequest(input) }, async () => {
      let employee: Employee
      try {
        employee = await repository.insertEmployee(tx, auth.tenantId, auth.userId, input)
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError(409, 'employee_exists', 'That employee code is already used.')
        throw error
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_employee', entityId: employee.id, action: 'create', before: null, after: employee })
      await recordMovementWithin(tx, auth, { module: 'hr', actionType: 'create', entityType: 'hr_employee', entityId: employee.id, descriptionAr: `إضافة موظف ${employee.fullName}` })
      return { status: 201 as const, body: { data: employee } }
    }),
  )
}

export async function updateEmployee(auth: AuthContext, id: string, input: UpdateEmployeeInput): Promise<{ data: Employee }> {
  return withTransaction(async (tx) => {
    const before = await repository.findEmployee(tx, auth.tenantId, id)
    if (!before) throw new AppError(404, 'not_found', 'The employee was not found.')
    const employee = await repository.updateEmployee(tx, auth.tenantId, id, input)
    if (!employee) throw versionConflict('employee')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_employee', entityId: id, action: 'update', before, after: employee })
    await recordMovementWithin(tx, auth, { module: 'hr', actionType: 'update', entityType: 'hr_employee', entityId: id, descriptionAr: `تحديث موظف ${employee.fullName}` })
    return { data: employee }
  })
}

export function listShifts(auth: AuthContext): Promise<Shift[]> {
  return withTransaction((tx) => repository.listShifts(tx, auth.tenantId))
}

export async function createShift(auth: AuthContext, key: string, input: CreateShiftInput): Promise<IdempotentResult<{ data: Shift }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.shift.create', key, requestHash: hashRequest(input) }, async () => {
      const shift = await repository.insertShift(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_shift', entityId: shift.id, action: 'create', before: null, after: shift })
      return { status: 201 as const, body: { data: shift } }
    }),
  )
}

export function listAttendance(auth: AuthContext): Promise<Attendance[]> {
  return withTransaction((tx) => repository.listAttendance(tx, auth.tenantId))
}

export async function createAttendance(auth: AuthContext, key: string, input: CreateAttendanceInput): Promise<IdempotentResult<{ data: { id: string } }>> {
  if (input.checkOut && Date.parse(input.checkOut) < Date.parse(input.checkIn)) {
    throw new DomainError('invalid_date', 'Check-out cannot be earlier than check-in.')
  }
  if (input.checkOut) {
    await enforceCompliance(auth, 'hr.attendance.hours', { workedMinutes: workedMinutes(input.checkIn, input.checkOut) })
  }
  const employee = await withTransaction((tx) => repository.findEmployee(tx, auth.tenantId, input.employeeId))
  if (!employee) throw new AppError(404, 'not_found', 'The employee was not found.')
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.attendance.create', key, requestHash: hashRequest(input) }, async () => {
      const id = await repository.insertAttendance(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_attendance', entityId: id, action: 'create', before: null, after: input })
      await recordMovementWithin(tx, auth, { module: 'hr', actionType: 'create', entityType: 'hr_attendance', entityId: id, descriptionAr: `تسجيل حضور ${employee.fullName}` })
      return { status: 201 as const, body: { data: { id } } }
    }),
  )
}

export function listLeaves(auth: AuthContext): Promise<Leave[]> {
  return withTransaction((tx) => repository.listLeaves(tx, auth.tenantId))
}

export async function createLeave(auth: AuthContext, key: string, input: CreateLeaveInput): Promise<IdempotentResult<{ data: { id: string; days: number } }>> {
  const days = inclusiveDays(input.startDate, input.endDate)
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.leave.create', key, requestHash: hashRequest(input) }, async () => {
      const employee = await repository.findEmployee(tx, auth.tenantId, input.employeeId)
      if (!employee) throw new AppError(404, 'not_found', 'The employee was not found.')
      const id = await repository.insertLeave(tx, auth.tenantId, auth.userId, input, days)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_leave', entityId: id, action: 'create', before: null, after: { ...input, days } })
      return { status: 201 as const, body: { data: { id, days } } }
    }),
  )
}

export async function decideLeave(auth: AuthContext, id: string, input: DecideLeaveInput): Promise<{ data: Leave }> {
  const events: HrEvent[] = []
  const result = await withTransaction(async (tx) => {
    const leave = await repository.decideLeave(tx, auth.tenantId, id, input.decision, input.version)
    if (!leave) throw new DomainError('invalid_transition', 'Only a pending leave can be decided, and the version must match.')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_leave', entityId: id, action: 'update', before: { approvalStatus: 'pending' }, after: leave })
    await recordMovementWithin(tx, auth, {
      module: 'hr',
      actionType: input.decision,
      entityType: 'hr_leave',
      entityId: id,
      descriptionAr: input.decision === 'approved' ? 'اعتماد إجازة' : 'رفض إجازة',
    })
    events.push({ ...stamp(auth), name: 'hr.leave.decided', payload: { leaveId: id, decision: input.decision, decidedBy: auth.userId } })
    return { data: leave }
  })
  await publishHrEvents(events)
  return result
}

export function listPayroll(auth: AuthContext): Promise<PayrollRun[]> {
  return withTransaction((tx) => repository.listPayroll(tx, auth.tenantId))
}

export function listPayslips(auth: AuthContext): Promise<Payslip[]> {
  return withTransaction((tx) => repository.listPayslips(tx, auth.tenantId))
}

export async function runPayroll(auth: AuthContext, key: string, input: RunPayrollInput): Promise<IdempotentResult<{ data: PayrollRun }>> {
  const financeEvents: FinanceEvent[] = []
  const hrEvents: HrEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.payroll.run', key, requestHash: hashRequest(input) }, async () => {
      const employees = await repository.listActiveEmployees(tx, auth.tenantId)
      const known = new Set(employees.map((employee) => employee.id))
      const deductions = new Map<string, number>()
      for (const line of input.deductions) {
        if (!known.has(line.employeeId)) throw new AppError(422, 'employee_not_active', 'A deduction names an employee who is not active.')
        deductions.set(line.employeeId, line.deductionsMinor)
      }
      const slips = employees.map((employee) => {
        const amounts = payslipAmounts(employee.basicSalaryMinor, employee.allowancesMinor, deductions.get(employee.id) ?? 0)
        return { employeeId: employee.id, ...amounts }
      })
      const totals = payrollTotals(slips)
      if (totals.netMinor <= 0) throw new DomainError('zero_amount', 'A payroll run needs a net amount above zero.')
      let runId: string
      try {
        runId = await repository.insertPayrollRun(tx, auth.tenantId, auth.userId, { period: input.period, ...totals })
      } catch (error) {
        if (isUniqueViolation(error)) throw new DomainError('invalid_transition', 'That payroll period was already run.')
        throw error
      }
      for (const slip of slips) await repository.insertPayslip(tx, auth.tenantId, auth.userId, { runId, ...slip })
      const accounts = await salaryAccounts(tx, auth.tenantId)
      const entry = await postSourcedEntryWithin(tx, auth, {
        entryDate: input.entryDate,
        memo: `مسير رواتب ${input.period}`,
        sourceType: 'payroll',
        sourceId: runId,
        lines: buildPayrollLines(totals.netMinor, accounts.expenseId, accounts.payableId, `مسير رواتب ${input.period}`),
      }, financeEvents)
      await repository.markPayrollPosted(tx, auth.tenantId, runId, entry.id)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_payroll_run', entityId: runId, action: 'create', before: null, after: { period: input.period, ...totals, journalEntryId: entry.id } })
      await recordMovementWithin(tx, auth, { module: 'hr', actionType: 'posted', entityType: 'payroll_run', entityId: runId, descriptionAr: `ترحيل مسير الرواتب ${input.period}`, amountMinor: totals.netMinor })
      hrEvents.push({ ...stamp(auth), name: 'hr.payroll.posted', payload: { runId, period: input.period, netMinor: totals.netMinor, journalEntryId: entry.id, postedBy: auth.userId } })
      const data: PayrollRun = { id: runId, period: input.period, ...totals, journalEntryId: entry.id, status: 'posted' }
      return { status: 201 as const, body: { data } }
    }),
  )
  if (!outcome.replayed) {
    await publishFinanceEvents(financeEvents)
    await publishHrEvents(hrEvents)
  }
  return outcome
}

export function listAppraisals(auth: AuthContext): Promise<Appraisal[]> {
  return withTransaction((tx) => repository.listAppraisals(tx, auth.tenantId))
}

export async function createAppraisal(auth: AuthContext, key: string, input: CreateAppraisalInput): Promise<IdempotentResult<{ data: { id: string } }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.appraisal.create', key, requestHash: hashRequest(input) }, async () => {
      const employee = await repository.findEmployee(tx, auth.tenantId, input.employeeId)
      if (!employee) throw new AppError(404, 'not_found', 'The employee was not found.')
      const id = await repository.insertAppraisal(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_appraisal', entityId: id, action: 'create', before: null, after: input })
      await recordMovementWithin(tx, auth, { module: 'hr', actionType: 'create', entityType: 'hr_appraisal', entityId: id, descriptionAr: `تقييم أداء ${employee.fullName}` })
      return { status: 201 as const, body: { data: { id } } }
    }),
  )
}

export function listExpenses(auth: AuthContext): Promise<EmployeeExpense[]> {
  return withTransaction((tx) => repository.listExpenses(tx, auth.tenantId))
}

export async function createExpense(auth: AuthContext, key: string, input: CreateExpenseInput): Promise<IdempotentResult<{ data: { id: string } }>> {
  if (input.cash) await enforceCompliance(auth, 'hr.expense.cash', { cashMinor: input.amountMinor })
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.expense.create', key, requestHash: hashRequest(input) }, async () => {
      const employee = await repository.findEmployee(tx, auth.tenantId, input.employeeId)
      if (!employee) throw new AppError(404, 'not_found', 'The employee was not found.')
      const id = await repository.insertExpense(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_expense', entityId: id, action: 'create', before: null, after: input })
      return { status: 201 as const, body: { data: { id } } }
    }),
  )
}

export async function decideExpense(auth: AuthContext, key: string, id: string, input: DecideExpenseInput): Promise<IdempotentResult<{ data: { journalEntryId: string | null } }>> {
  const financeEvents: FinanceEvent[] = []
  const hrEvents: HrEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'hr.expense.decide', key, requestHash: hashRequest({ id, ...input }) }, async () => {
      const expense = await repository.findExpense(tx, auth.tenantId, id, true)
      if (!expense) throw new AppError(404, 'not_found', 'The expense was not found.')
      if (expense.approvalStatus !== 'pending' || expense.version !== input.version) {
        throw new DomainError('invalid_transition', 'Only a pending expense can be decided, and the version must match.')
      }
      let journalEntryId: string | null = null
      if (input.decision === 'approved') {
        const accounts = await salaryAccounts(tx, auth.tenantId)
        const entry = await postSourcedEntryWithin(tx, auth, {
          entryDate: input.entryDate,
          memo: `عهدة موظف ${expense.category}`,
          sourceType: 'employee_expense',
          sourceId: id,
          lines: buildEmployeeExpenseLines(expense.amountMinor, accounts.expenseId, accounts.payableId, expense.category),
        }, financeEvents)
        journalEntryId = entry.id
      }
      const saved = await repository.decideExpense(tx, auth.tenantId, id, input.decision, journalEntryId, input.version)
      if (!saved) throw versionConflict('expense')
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'hr_expense', entityId: id, action: 'update', before: expense, after: { ...expense, approvalStatus: input.decision, journalEntryId } })
      await recordMovementWithin(tx, auth, {
        module: 'hr',
        actionType: input.decision,
        entityType: 'hr_expense',
        entityId: id,
        descriptionAr: input.decision === 'approved' ? 'اعتماد عهدة موظف' : 'رفض عهدة موظف',
        amountMinor: expense.amountMinor,
      })
      hrEvents.push({ ...stamp(auth), name: 'hr.expense.decided', payload: { expenseId: id, decision: input.decision, amountMinor: expense.amountMinor, journalEntryId, decidedBy: auth.userId } })
      return { status: 200 as const, body: { data: { journalEntryId } } }
    }),
  )
  if (!outcome.replayed) {
    await publishFinanceEvents(financeEvents)
    await publishHrEvents(hrEvents)
  }
  return outcome
}
