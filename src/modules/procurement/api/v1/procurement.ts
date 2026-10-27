import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  approveOrder,
  cancelOrder,
  createOrder,
  createReceipt,
  createSupplier,
  getOrder,
  getReceipt,
  getSettings,
  getSupplier,
  listOrders,
  listReceipts,
  listSuppliers,
  submitOrder,
  updateOrder,
  updateSettings,
  updateSupplier,
} from '@/modules/procurement/services/procurement-service'
import {
  approveOrderSchema,
  cancelOrderSchema,
  createOrderSchema,
  createReceiptSchema,
  createSupplierSchema,
  listOrdersQuerySchema,
  listReceiptsQuerySchema,
  listSuppliersQuerySchema,
  procurementIdParamsSchema,
  submitOrderSchema,
  updateOrderSchema,
  updateSettingsSchema,
  updateSupplierSchema,
} from '@/modules/procurement/schemas/procurement'

const replayHeaders = (replayed: boolean) => (replayed ? { 'Idempotent-Replayed': 'true' } : undefined)

// ---- suppliers ----

export async function listSuppliersHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listSuppliers(auth, parseQuery(request, listSuppliersQuerySchema)))
}

export async function createSupplierHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await createSupplier(auth, await parseBody(request, createSupplierSchema)), { status: 201 })
}

export async function getSupplierHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getSupplier(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function updateSupplierHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await updateSupplier(auth, id, await parseBody(request, updateSupplierSchema)))
}

// ---- settings ----

export async function getSettingsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getSettings(auth))
}

export async function updateSettingsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await updateSettings(auth, await parseBody(request, updateSettingsSchema)))
}

// ---- purchase orders ----

export async function listOrdersHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listOrders(auth, parseQuery(request, listOrdersQuerySchema)))
}

export async function createOrderHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createOrder(auth, key, await parseBody(request, createOrderSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getOrderHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getOrder(auth, parseParams(params, procurementIdParamsSchema).id))
}

export async function updateOrderHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await updateOrder(auth, id, await parseBody(request, updateOrderSchema)))
}

export async function submitOrderHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await submitOrder(auth, id, await parseBody(request, submitOrderSchema)))
}

export async function approveOrderHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await approveOrder(auth, id, await parseBody(request, approveOrderSchema)))
}

export async function cancelOrderHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  return NextResponse.json(await cancelOrder(auth, id, await parseBody(request, cancelOrderSchema)))
}

// ---- goods receipts ----

export async function createReceiptHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, procurementIdParamsSchema)
  const key = requireIdempotencyKey(request)
  const outcome = await createReceipt(auth, id, key, await parseBody(request, createReceiptSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function listReceiptsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listReceipts(auth, parseQuery(request, listReceiptsQuerySchema)))
}

export async function getReceiptHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getReceipt(auth, parseParams(params, procurementIdParamsSchema).id))
}