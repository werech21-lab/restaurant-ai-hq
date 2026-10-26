import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  createItem,
  createWarehouse,
  getItem,
  getWarehouse,
  listItems,
  listWarehouses,
  updateItem,
  updateWarehouse,
} from '@/modules/inventory/services/catalog-service'
import { getSummary, listBalances, listMovements, recordMovement } from '@/modules/inventory/services/stock-service'
import {
  createItemSchema,
  createMovementSchema,
  createWarehouseSchema,
  idParamsSchema,
  listBalancesQuerySchema,
  listItemsQuerySchema,
  listMovementsQuerySchema,
  listWarehousesQuerySchema,
  summaryQuerySchema,
  updateItemSchema,
  updateWarehouseSchema,
} from '@/modules/inventory/schemas/inventory'

function replayHeaders(replayed: boolean): Record<string, string> | undefined {
  return replayed ? { 'Idempotent-Replayed': 'true' } : undefined
}

export async function listItemsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listItemsQuerySchema)
  return NextResponse.json(await listItems(auth, query), { status: 200 })
}

export async function createItemHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createItemSchema)
  const outcome = await createItem(auth, key, input)
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getItemHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getItem(auth, id), { status: 200 })
}

export async function updateItemHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateItemSchema)
  return NextResponse.json(await updateItem(auth, id, input), { status: 200 })
}

export async function listWarehousesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listWarehousesQuerySchema)
  return NextResponse.json(await listWarehouses(auth, query), { status: 200 })
}

export async function createWarehouseHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createWarehouseSchema)
  const outcome = await createWarehouse(auth, key, input)
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function getWarehouseHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getWarehouse(auth, id), { status: 200 })
}

export async function updateWarehouseHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateWarehouseSchema)
  return NextResponse.json(await updateWarehouse(auth, id, input), { status: 200 })
}

export async function listMovementsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listMovementsQuerySchema)
  return NextResponse.json(await listMovements(auth, query), { status: 200 })
}

export async function createMovementHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createMovementSchema)
  const outcome = await recordMovement(auth, key, input)
  return NextResponse.json(outcome.body, { status: outcome.status, headers: replayHeaders(outcome.replayed) })
}

export async function listBalancesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listBalancesQuerySchema)
  return NextResponse.json(await listBalances(auth, query), { status: 200 })
}

export async function inventorySummaryHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, summaryQuerySchema)
  return NextResponse.json(await getSummary(auth, query), { status: 200 })
}
