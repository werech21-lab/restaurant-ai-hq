import type { Queryable } from '@/lib/db'
import type { Appraisal, Attendance, Employee, EmployeeExpense, Leave, PayrollRun, Payslip, Shift } from '@/modules/hr/domain/types'
import type { CreateAppraisalInput, CreateAttendanceInput, CreateEmployeeInput, CreateExpenseInput, CreateLeaveInput, CreateShiftInput, UpdateEmployeeInput } from '@/modules/hr/schemas/hr'

function iso(value: Date | string | null): string | null {
  if (value === null) return null
  return value instanceof Date ? value.toISOString() : value
}

function clock(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(11, 16)
  return value.slice(0, 5)
}

const EMPLOYEE = `id, employee_code as "employeeCode", full_name as "fullName", role_title as "roleTitle", department,
  branch_id as "branchId", basic_salary_minor::bigint as "basicSalaryMinor", allowances_minor::bigint as "allowancesMinor",
  residency_expiry::text as "residencyExpiry", status, version`

export async function listEmployees(tx: Queryable, tenantId: string): Promise<Employee[]> {
  const result = await tx.query<Employee>(`select ${EMPLOYEE} from hr_employees where tenant_id = $1 order by employee_code limit 100`, [tenantId])
  return result.rows.map(minor)
}

export async function findEmployee(tx: Queryable, tenantId: string, id: string): Promise<Employee | null> {
  const result = await tx.query<Employee>(`select ${EMPLOYEE} from hr_employees where tenant_id = $1 and id = $2`, [tenantId, id])
  return result.rows[0] ? minor(result.rows[0]) : null
}

export async function listActiveEmployees(tx: Queryable, tenantId: string): Promise<Employee[]> {
  const result = await tx.query<Employee>(
    `select ${EMPLOYEE} from hr_employees where tenant_id = $1 and status = 'active' order by employee_code for update`,
    [tenantId],
  )
  return result.rows.map(minor)
}

function minor<T extends { basicSalaryMinor: number; allowancesMinor: number }>(row: T): T {
  return { ...row, basicSalaryMinor: Number(row.basicSalaryMinor), allowancesMinor: Number(row.allowancesMinor) }
}

export async function insertEmployee(tx: Queryable, tenantId: string, actorId: string, input: CreateEmployeeInput): Promise<Employee> {
  const result = await tx.query<Employee>(
    `insert into hr_employees (
       tenant_id, employee_code, full_name, role_title, department, branch_id, basic_salary_minor, allowances_minor, residency_expiry, status, created_by
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11)
     returning ${EMPLOYEE}`,
    [tenantId, input.employeeCode, input.fullName, input.roleTitle, input.department, input.branchId, input.basicSalaryMinor, input.allowancesMinor, input.residencyExpiry, input.status, actorId],
  )
  return minor(result.rows[0])
}

export async function updateEmployee(tx: Queryable, tenantId: string, id: string, input: UpdateEmployeeInput): Promise<Employee | null> {
  const result = await tx.query<Employee>(
    `update hr_employees set full_name = $3, role_title = $4, department = $5, branch_id = $6, basic_salary_minor = $7,
       allowances_minor = $8, residency_expiry = $9::date, status = $10, version = version + 1
     where tenant_id = $1 and id = $2 and version = $11
     returning ${EMPLOYEE}`,
    [tenantId, id, input.fullName, input.roleTitle, input.department, input.branchId, input.basicSalaryMinor, input.allowancesMinor, input.residencyExpiry, input.status, input.version],
  )
  return result.rows[0] ? minor(result.rows[0]) : null
}

export async function listShifts(tx: Queryable, tenantId: string): Promise<Shift[]> {
  const result = await tx.query<Shift & { startsAt: Date | string; endsAt: Date | string }>(
    `select id, branch_id as "branchId", name, weekday, starts_at as "startsAt", ends_at as "endsAt"
     from hr_shifts where tenant_id = $1 order by weekday, starts_at limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, weekday: Number(row.weekday), startsAt: clock(row.startsAt), endsAt: clock(row.endsAt) }))
}

export async function insertShift(tx: Queryable, tenantId: string, actorId: string, input: CreateShiftInput): Promise<Shift> {
  const result = await tx.query<Shift & { startsAt: Date | string; endsAt: Date | string }>(
    `insert into hr_shifts (tenant_id, branch_id, name, weekday, starts_at, ends_at, created_by)
     values ($1, $2, $3, $4, $5::time, $6::time, $7)
     returning id, branch_id as "branchId", name, weekday, starts_at as "startsAt", ends_at as "endsAt"`,
    [tenantId, input.branchId, input.name, input.weekday, input.startsAt, input.endsAt, actorId],
  )
  const row = result.rows[0]
  return { ...row, weekday: Number(row.weekday), startsAt: clock(row.startsAt), endsAt: clock(row.endsAt) }
}

export async function listAttendance(tx: Queryable, tenantId: string): Promise<Attendance[]> {
  const result = await tx.query<Attendance & { checkIn: Date | string; checkOut: Date | string | null }>(
    `select a.id, a.employee_id as "employeeId", e.full_name as "employeeName", a.branch_id as "branchId",
            a.check_in as "checkIn", a.check_out as "checkOut", a.overtime_minutes as "overtimeMinutes"
     from hr_attendances a join hr_employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
     where a.tenant_id = $1 order by a.check_in desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, checkIn: iso(row.checkIn) ?? '', checkOut: iso(row.checkOut), overtimeMinutes: Number(row.overtimeMinutes) }))
}

export async function insertAttendance(tx: Queryable, tenantId: string, actorId: string, input: CreateAttendanceInput): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into hr_attendances (tenant_id, employee_id, branch_id, check_in, check_out, overtime_minutes, created_by)
     values ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7) returning id`,
    [tenantId, input.employeeId, input.branchId, input.checkIn, input.checkOut, input.overtimeMinutes, actorId],
  )
  return result.rows[0].id
}

export async function listLeaves(tx: Queryable, tenantId: string): Promise<Leave[]> {
  const result = await tx.query<Leave>(
    `select l.id, l.employee_id as "employeeId", e.full_name as "employeeName", l.leave_type as "leaveType",
            l.start_date::text as "startDate", l.end_date::text as "endDate", l.days, l.approval_status as "approvalStatus", l.version
     from hr_leaves l join hr_employees e on e.tenant_id = l.tenant_id and e.id = l.employee_id
     where l.tenant_id = $1 order by l.start_date desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, days: Number(row.days) }))
}

export async function insertLeave(tx: Queryable, tenantId: string, actorId: string, input: CreateLeaveInput, days: number): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into hr_leaves (tenant_id, employee_id, leave_type, start_date, end_date, days, created_by)
     values ($1, $2, $3, $4::date, $5::date, $6, $7) returning id`,
    [tenantId, input.employeeId, input.leaveType, input.startDate, input.endDate, days, actorId],
  )
  return result.rows[0].id
}

export async function decideLeave(tx: Queryable, tenantId: string, id: string, decision: 'approved' | 'rejected', version: number): Promise<Leave | null> {
  const result = await tx.query<Leave>(
    `update hr_leaves set approval_status = $3, version = version + 1
     where tenant_id = $1 and id = $2 and version = $4 and approval_status = 'pending'
     returning id, employee_id as "employeeId", '' as "employeeName", leave_type as "leaveType",
       start_date::text as "startDate", end_date::text as "endDate", days, approval_status as "approvalStatus", version`,
    [tenantId, id, decision, version],
  )
  return result.rows[0] ? { ...result.rows[0], days: Number(result.rows[0].days) } : null
}

export async function listPayroll(tx: Queryable, tenantId: string): Promise<PayrollRun[]> {
  const result = await tx.query<PayrollRun>(
    `select id, period, gross_minor::bigint as "grossMinor", deductions_minor::bigint as "deductionsMinor",
            net_minor::bigint as "netMinor", journal_entry_id as "journalEntryId", status
     from hr_payroll_runs where tenant_id = $1 order by period desc limit 24`,
    [tenantId],
  )
  return result.rows.map(money)
}

export async function listPayslips(tx: Queryable, tenantId: string): Promise<Payslip[]> {
  const result = await tx.query<Payslip>(
    `select p.id, p.run_id as "runId", p.employee_id as "employeeId", e.full_name as "employeeName", r.period,
            p.gross_minor::bigint as "grossMinor", p.deductions_minor::bigint as "deductionsMinor", p.net_minor::bigint as "netMinor",
            p.journal_entry_id as "journalEntryId", p.status
     from hr_payslips p
     join hr_payroll_runs r on r.tenant_id = p.tenant_id and r.id = p.run_id
     join hr_employees e on e.tenant_id = p.tenant_id and e.id = p.employee_id
     where p.tenant_id = $1 order by r.period desc, e.employee_code limit 200`,
    [tenantId],
  )
  return result.rows.map(money)
}

function money<T extends { grossMinor: number; deductionsMinor: number; netMinor: number }>(row: T): T {
  return { ...row, grossMinor: Number(row.grossMinor), deductionsMinor: Number(row.deductionsMinor), netMinor: Number(row.netMinor) }
}

export async function insertPayrollRun(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  input: { period: string; grossMinor: number; deductionsMinor: number; netMinor: number },
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into hr_payroll_runs (tenant_id, period, gross_minor, deductions_minor, net_minor, status, created_by)
     values ($1, $2, $3, $4, $5, 'draft', $6) returning id`,
    [tenantId, input.period, input.grossMinor, input.deductionsMinor, input.netMinor, actorId],
  )
  return result.rows[0].id
}

export async function insertPayslip(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  input: { runId: string; employeeId: string; grossMinor: number; deductionsMinor: number; netMinor: number },
): Promise<void> {
  await tx.query(
    `insert into hr_payslips (tenant_id, run_id, employee_id, gross_minor, deductions_minor, net_minor, status, created_by)
     values ($1, $2, $3, $4, $5, $6, 'draft', $7)`,
    [tenantId, input.runId, input.employeeId, input.grossMinor, input.deductionsMinor, input.netMinor, actorId],
  )
}

export async function markPayrollPosted(tx: Queryable, tenantId: string, runId: string, journalEntryId: string): Promise<void> {
  await tx.query(`update hr_payroll_runs set status = 'posted', journal_entry_id = $3 where tenant_id = $1 and id = $2`, [tenantId, runId, journalEntryId])
  await tx.query(`update hr_payslips set status = 'posted', journal_entry_id = $3 where tenant_id = $1 and run_id = $2`, [tenantId, runId, journalEntryId])
}

export async function listAppraisals(tx: Queryable, tenantId: string): Promise<Appraisal[]> {
  const result = await tx.query<Appraisal>(
    `select a.id, a.employee_id as "employeeId", e.full_name as "employeeName", a.rating, a.kpi_score as "kpiScore", a.reviewer_notes as "reviewerNotes"
     from hr_appraisals a join hr_employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
     where a.tenant_id = $1 order by a.created_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, rating: Number(row.rating), kpiScore: Number(row.kpiScore) }))
}

export async function insertAppraisal(tx: Queryable, tenantId: string, actorId: string, input: CreateAppraisalInput): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into hr_appraisals (tenant_id, employee_id, rating, kpi_score, reviewer_notes, created_by)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [tenantId, input.employeeId, input.rating, input.kpiScore, input.reviewerNotes, actorId],
  )
  return result.rows[0].id
}

export async function listExpenses(tx: Queryable, tenantId: string): Promise<EmployeeExpense[]> {
  const result = await tx.query<EmployeeExpense>(
    `select x.id, x.employee_id as "employeeId", e.full_name as "employeeName", x.category, x.amount_minor::bigint as "amountMinor",
            x.approval_status as "approvalStatus", x.journal_entry_id as "journalEntryId", x.version
     from hr_expenses x join hr_employees e on e.tenant_id = x.tenant_id and e.id = x.employee_id
     where x.tenant_id = $1 order by x.created_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, amountMinor: Number(row.amountMinor) }))
}

export async function findExpense(tx: Queryable, tenantId: string, id: string, lock: boolean): Promise<EmployeeExpense | null> {
  const result = await tx.query<EmployeeExpense>(
    `select x.id, x.employee_id as "employeeId", e.full_name as "employeeName", x.category, x.amount_minor::bigint as "amountMinor",
            x.approval_status as "approvalStatus", x.journal_entry_id as "journalEntryId", x.version
     from hr_expenses x join hr_employees e on e.tenant_id = x.tenant_id and e.id = x.employee_id
     where x.tenant_id = $1 and x.id = $2${lock ? ' for update of x' : ''}`,
    [tenantId, id],
  )
  return result.rows[0] ? { ...result.rows[0], amountMinor: Number(result.rows[0].amountMinor) } : null
}

export async function insertExpense(tx: Queryable, tenantId: string, actorId: string, input: CreateExpenseInput): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into hr_expenses (tenant_id, employee_id, category, amount_minor, created_by) values ($1, $2, $3, $4, $5) returning id`,
    [tenantId, input.employeeId, input.category, input.amountMinor, actorId],
  )
  return result.rows[0].id
}

export async function decideExpense(
  tx: Queryable,
  tenantId: string,
  id: string,
  decision: 'approved' | 'rejected',
  journalEntryId: string | null,
  version: number,
): Promise<boolean> {
  const result = await tx.query(
    `update hr_expenses set approval_status = $3, journal_entry_id = $4, version = version + 1
     where tenant_id = $1 and id = $2 and version = $5 and approval_status = 'pending'`,
    [tenantId, id, decision, journalEntryId, version],
  )
  return (result.rowCount ?? 0) > 0
}
