import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { idParamsSchema } from '@/modules/governance/schemas/governance'
import { aggregatorQuerySchema, escalationDecisionSchema, scanSchema } from '@/modules/governance/schemas/aggregator'
import { actOnEscalation, aggregatorBoard, scanAggregator } from '@/modules/governance/services/aggregator-service'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function aggregatorBoardHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await aggregatorBoard(auth, parseQuery(request, aggregatorQuerySchema)) })
}

export async function scanAggregatorHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await scanAggregator(auth, requireIdempotencyKey(request), await parseBody(request, scanSchema)))
}

export async function escalationActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnEscalation(auth, id, await parseBody(request, escalationDecisionSchema)))
}
