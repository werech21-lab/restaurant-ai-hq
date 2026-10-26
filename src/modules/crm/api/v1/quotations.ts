import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { idParamsSchema, versionBodySchema } from '@/modules/crm/schemas/common'
import {
  createQuotationSchema,
  listQuotationsQuerySchema,
  updateQuotationSchema,
} from '@/modules/crm/schemas/quotation'
import { convertQuotation } from '@/modules/crm/services/conversion-service'
import {
  acceptQuotation,
  createQuotation,
  expireQuotation,
  getQuotation,
  listQuotations,
  rejectQuotation,
  sendQuotation,
  updateQuotation,
} from '@/modules/crm/services/quotation-service'

export async function listQuotationsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listQuotationsQuerySchema)
  return NextResponse.json(await listQuotations(auth, query), { status: 200 })
}

export async function getQuotationHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getQuotation(auth, id), { status: 200 })
}

export async function createQuotationHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createQuotationSchema)
  const outcome = await createQuotation(auth, key, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}

export async function updateQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateQuotationSchema)
  return NextResponse.json(await updateQuotation(auth, id, input), { status: 200 })
}

export async function sendQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await sendQuotation(auth, id, input), { status: 200 })
}

export async function acceptQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await acceptQuotation(auth, id, input), { status: 200 })
}

export async function rejectQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await rejectQuotation(auth, id, input), { status: 200 })
}

export async function expireQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await expireQuotation(auth, id, input), { status: 200 })
}

export async function convertQuotationHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, versionBodySchema)
  const outcome = await convertQuotation(auth, key, id, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}
