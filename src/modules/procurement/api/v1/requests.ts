import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { procurementIdParamsSchema } from '@/modules/procurement/schemas/procurement'
import {
  approveRequestSchema,
  cancelRequestSchema,
  convertRequestSchema,
  createRequestSchema,
  listRequestsQuerySchema,
  rejectRequestSchema,
  submitRequestSchema,
  updateRequestSchema,
} from '@/modules/procurement/schemas/request'
import {
  approveRequest,
  cancelRequest,
  convertRequest,
  createRequest,
  getRequest,
  listRequests,
  rejectRequest,
  submitRequest,
  updateRequest,
} from '@/modules/procurement/services/request-service'

const replayHeaders = (replayed: boolean) => (replayed ? { 'Idempotent-Replayed': 'true' } : undefined)

export async function listRequestsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listRequests(auth, parseQuery(request, listRequestsQuerySchema)))
}

export async function createRequestHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createRequest(auth, key, await parseBody(request, createRequestSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getRequestHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getRequest(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function updateRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await updateRequest(auth, id, await parseBody(request, updateRequestSchema)))
}

export async function submitRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await submitRequest(auth, id, await parseBody(request, submitRequestSchema)))
}

export async function approveRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await approveRequest(auth, id, await parseBody(request, approveRequestSchema)))
}

export async function rejectRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await rejectRequest(auth, id, await parseBody(request, rejectRequestSchema)))
}

export async function cancelRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await cancelRequest(auth, id, await parseBody(request, cancelRequestSchema)))
}

export async function convertRequestHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  const key = requireIdempotencyKey(request)
  const outcome = await convertRequest(auth, id, key, await parseBody(request, convertRequestSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}