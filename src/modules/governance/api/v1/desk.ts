import { NextResponse } from 'next/server'
import { parseBody, parseParams } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { idParamsSchema } from '@/modules/governance/schemas/governance'
import {
  convertMonitorSchema,
  inquiryActionSchema,
  logMonitorSchema,
  openInquirySchema,
  registerViolationSchema,
  taskActionSchema,
  violationActionSchema,
} from '@/modules/governance/schemas/desk'
import {
  actOnInquiry,
  actOnTask,
  actOnViolation,
  convertMonitoring,
  listInquiries,
  listTasks,
  listViolations,
  logMonitoring,
  monitoringBoard,
  openInquiry,
  registerViolation,
} from '@/modules/governance/services/desk-service'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listViolationsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listViolations(auth) })
}

export async function registerViolationHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await registerViolation(auth, requireIdempotencyKey(request), await parseBody(request, registerViolationSchema)))
}

export async function violationActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnViolation(auth, id, await parseBody(request, violationActionSchema)))
}

export async function monitoringHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await monitoringBoard(auth) })
}

export async function logMonitoringHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await logMonitoring(auth, requireIdempotencyKey(request), await parseBody(request, logMonitorSchema)))
}

export async function convertMonitoringHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return created(await convertMonitoring(auth, requireIdempotencyKey(request), id, await parseBody(request, convertMonitorSchema)))
}

export async function listInquiriesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listInquiries(auth) })
}

export async function openInquiryHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await openInquiry(auth, requireIdempotencyKey(request), await parseBody(request, openInquirySchema)))
}

export async function inquiryActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnInquiry(auth, id, await parseBody(request, inquiryActionSchema)))
}

export async function listTasksHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listTasks(auth) })
}

export async function taskActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnTask(auth, id, await parseBody(request, taskActionSchema)))
}
