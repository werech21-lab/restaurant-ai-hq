import { NextResponse } from 'next/server'
import { parseBody, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { createOrder, createPartner, listOrders, listPartners, settleOrder } from '@/modules/delivery/services/delivery-service'
import { createOrderSchema, createPartnerSchema, listQuerySchema, settleOrderSchema } from '@/modules/delivery/schemas/delivery'

export async function listPartnersHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listPartners(auth) })
}

export async function createPartnerHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const outcome = await createPartner(auth, requireIdempotencyKey(request), await parseBody(request, createPartnerSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listOrdersHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listOrders(auth, parseQuery(request, listQuerySchema)))
}

export async function createOrderHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const outcome = await createOrder(auth, requireIdempotencyKey(request), await parseBody(request, createOrderSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function settleOrderHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const outcome = await settleOrder(auth, requireIdempotencyKey(request), await parseBody(request, settleOrderSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}
