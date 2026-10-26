import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  approveInvoice,
  createInvoice,
  getInvoice,
  getInvoiceSummary,
  listInvoices,
  recordPayment,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '@/modules/finance/services/invoice-service'
import {
  createInvoiceSchema,
  invoiceIdParamsSchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  versionBodySchema,
  voidInvoiceSchema,
} from '@/modules/finance/schemas/invoice'

export async function listInvoicesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listInvoicesQuerySchema)
  return NextResponse.json(await listInvoices(auth, query), { status: 200 })
}

export async function invoiceSummaryHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getInvoiceSummary(auth), { status: 200 })
}

export async function getInvoiceHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  return NextResponse.json(await getInvoice(auth, id), { status: 200 })
}

export async function createInvoiceHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createInvoiceSchema)
  const outcome = await createInvoice(auth, key, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}

export async function updateInvoiceHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  const input = await parseBody(request, updateInvoiceSchema)
  return NextResponse.json(await updateInvoice(auth, id, input), { status: 200 })
}

export async function submitInvoiceHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await submitInvoice(auth, id, input), { status: 200 })
}

export async function approveInvoiceHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  const input = await parseBody(request, versionBodySchema)
  return NextResponse.json(await approveInvoice(auth, id, input), { status: 200 })
}

export async function voidInvoiceHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  const input = await parseBody(request, voidInvoiceSchema)
  return NextResponse.json(await voidInvoice(auth, id, input), { status: 200 })
}

export async function recordPaymentHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, invoiceIdParamsSchema)
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, recordPaymentSchema)
  const outcome = await recordPayment(auth, id, key, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}
