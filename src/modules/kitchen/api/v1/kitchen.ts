import { NextResponse } from 'next/server'
import { parseBody, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { listProductions, listRecipes, listWaste, recordProduction, recordWaste } from '@/modules/kitchen/services/kitchen-service'
import { listQuerySchema, recordProductionSchema, recordWasteSchema } from '@/modules/kitchen/schemas/kitchen'

export async function listRecipesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listRecipes(auth) })
}

export async function listWasteHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listWaste(auth, parseQuery(request, listQuerySchema)))
}

export async function recordWasteHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const outcome = await recordWaste(auth, requireIdempotencyKey(request), await parseBody(request, recordWasteSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listProductionsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listProductions(auth, parseQuery(request, listQuerySchema)))
}

export async function recordProductionHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const outcome = await recordProduction(auth, requireIdempotencyKey(request), await parseBody(request, recordProductionSchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}
