import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  createSupplierInvoiceSchema,
  listSupplierInvoicesQuerySchema,
  updateAccountingSchema,
  voidSupplierInvoiceSchema,
} from '@/modules/procurement/schemas/invoice'
import { procurementIdParamsSchema } from '@/modules/procurement/schemas/procurement'
import {
  createSupplierInvoice,
  getAccounting,
  getSupplierInvoice,
  listSupplierInvoices,
  updateAccounting,
  voidSupplierInvoice,
} from '@/modules/procurement/services/invoice-service'

const replayHeaders = (replayed: boolean) => (replayed ? { 'Idempotent-Replayed': 'true' } : undefined)

export async function listInvoicesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listSupplierInvoices(auth, parseQuery(request, listSupplierInvoicesQuerySchema)))
}

export async function createInvoiceHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createSupplierInvoice(auth, key, await parseBody(request, createSupplierInvoiceSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getInvoiceHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getSupplierInvoice(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function voidInvoiceHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await voidSupplierInvoice(auth, id, await parseBody(request, voidSupplierInvoiceSchema)))
}

export async function getAccountingHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getAccounting(auth))
}

export async function updateAccountingHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await updateAccounting(auth, await parseBody(request, updateAccountingSchema)))
}