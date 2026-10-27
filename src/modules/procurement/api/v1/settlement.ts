import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { matchPreviewSchema } from '@/modules/procurement/schemas/invoice'
import { procurementIdParamsSchema } from '@/modules/procurement/schemas/procurement'
import {
  createCreditNoteSchema,
  createPaymentSchema,
  createReturnSchema,
  listCreditNotesQuerySchema,
  listPaymentsQuerySchema,
  listReturnsQuerySchema,
  voidCreditNoteSchema,
  voidPaymentSchema,
} from '@/modules/procurement/schemas/settlement'
import { previewMatch } from '@/modules/procurement/services/invoice-service'
import {
  createCreditNote,
  createPayment,
  createReturn,
  getCreditNote,
  getPayment,
  getReconciliation,
  getReturn,
  listCreditNotes,
  listPayments,
  listReturns,
  voidCreditNote,
  voidPayment,
} from '@/modules/procurement/services/settlement-service'

const replayHeaders = (replayed: boolean) => (replayed ? { 'Idempotent-Replayed': 'true' } : undefined)

export async function previewMatchHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await previewMatch(auth, await parseBody(request, matchPreviewSchema)))
}

export async function getReconciliationHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getReconciliation(auth))
}

export async function listReturnsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listReturns(auth, parseQuery(request, listReturnsQuerySchema)))
}

export async function createReturnHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createReturn(auth, key, await parseBody(request, createReturnSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getReturnHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getReturn(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function listCreditNotesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listCreditNotes(auth, parseQuery(request, listCreditNotesQuerySchema)))
}

export async function createCreditNoteHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createCreditNote(auth, key, await parseBody(request, createCreditNoteSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getCreditNoteHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getCreditNote(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function voidCreditNoteHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await voidCreditNote(auth, id, await parseBody(request, voidCreditNoteSchema)))
}

export async function listPaymentsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listPayments(auth, parseQuery(request, listPaymentsQuerySchema)))
}

export async function createPaymentHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createPayment(auth, key, await parseBody(request, createPaymentSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getPaymentHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getPayment(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function voidPaymentHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await voidPayment(auth, id, await parseBody(request, voidPaymentSchema)))
}
