import { NextResponse } from 'next/server'
import { parseBody, parseParams } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { createContract, createDocument, createTicket, listContracts, listDocuments, listTickets, updateContract, updateTicket } from '@/modules/operations/services/operations-service'
import { createContractSchema, createDocumentSchema, createTicketSchema, idParamsSchema, updateContractSchema, updateTicketSchema } from '@/modules/operations/schemas/operations'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listContractsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listContracts(auth) })
}

export async function createContractHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createContract(auth, requireIdempotencyKey(request), await parseBody(request, createContractSchema)))
}

export async function updateContractHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await updateContract(auth, id, await parseBody(request, updateContractSchema)))
}

export async function listDocumentsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listDocuments(auth) })
}

export async function createDocumentHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createDocument(auth, requireIdempotencyKey(request), await parseBody(request, createDocumentSchema)))
}

export async function listTicketsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listTickets(auth) })
}

export async function createTicketHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await createTicket(auth, requireIdempotencyKey(request), await parseBody(request, createTicketSchema)))
}

export async function updateTicketHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await updateTicket(auth, id, await parseBody(request, updateTicketSchema)))
}
