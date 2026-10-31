import { NextResponse } from 'next/server'
import { parseBody, parseParams } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  actOnAppointment,
  bookAppointment,
  createAppraisal,
  createAttendance,
  createEmployee,
  createExpense,
  createLeave,
  createShift,
  decideExpense,
  decideLeave,
  listAppraisals,
  listAppointments,
  listAttendance,
  listEmployees,
  listExpenses,
  listLeaves,
  listPayroll,
  listPayslips,
  listShifts,
  removeEmployee,
  runPayroll,
  updateEmployee,
} from '@/modules/hr/services/hr-service'
import {
  appointmentActionSchema,
  bookAppointmentSchema,
  createAppraisalSchema,
  createAttendanceSchema,
  createEmployeeSchema,
  createExpenseSchema,
  createLeaveSchema,
  createShiftSchema,
  decideExpenseSchema,
  decideLeaveSchema,
  idParamsSchema,
  runPayrollSchema,
  updateEmployeeSchema,
} from '@/modules/hr/schemas/hr'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listEmployeesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listEmployees(auth) })
}

export async function createEmployeeHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createEmployee(auth, requireIdempotencyKey(request), await parseBody(request, createEmployeeSchema)))
}

export async function removeEmployeeHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await removeEmployee(auth, id))
}

export async function updateEmployeeHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await updateEmployee(auth, id, await parseBody(request, updateEmployeeSchema)))
}

export async function listShiftsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listShifts(auth) })
}

export async function createShiftHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createShift(auth, requireIdempotencyKey(request), await parseBody(request, createShiftSchema)))
}

export async function listAttendanceHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listAttendance(auth) })
}

export async function createAttendanceHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createAttendance(auth, requireIdempotencyKey(request), await parseBody(request, createAttendanceSchema)))
}

export async function listLeavesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listLeaves(auth) })
}

export async function createLeaveHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createLeave(auth, requireIdempotencyKey(request), await parseBody(request, createLeaveSchema)))
}

export async function decideLeaveHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await decideLeave(auth, id, await parseBody(request, decideLeaveSchema)))
}

export async function listPayrollHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listPayroll(auth) })
}

export async function runPayrollHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await runPayroll(auth, requireIdempotencyKey(request), await parseBody(request, runPayrollSchema)))
}

export async function listPayslipsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listPayslips(auth) })
}

export async function listAppraisalsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listAppraisals(auth) })
}

export async function createAppraisalHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createAppraisal(auth, requireIdempotencyKey(request), await parseBody(request, createAppraisalSchema)))
}

export async function listExpensesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listExpenses(auth) })
}

export async function createExpenseHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createExpense(auth, requireIdempotencyKey(request), await parseBody(request, createExpenseSchema)))
}

export async function decideExpenseHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return created(await decideExpense(auth, requireIdempotencyKey(request), id, await parseBody(request, decideExpenseSchema)))
}

export async function listAppointmentsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listAppointments(auth) })
}

export async function bookAppointmentHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await bookAppointment(auth, requireIdempotencyKey(request), await parseBody(request, bookAppointmentSchema)))
}

export async function appointmentActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnAppointment(auth, id, await parseBody(request, appointmentActionSchema)))
}
