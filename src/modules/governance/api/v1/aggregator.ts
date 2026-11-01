import { NextResponse } from 'next/server'
import { dispatchExclusiveRadarAlert, listExclusiveRadarRecipients } from '@/lib/alerts'
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
  const board = await aggregatorBoard(auth, parseQuery(request, aggregatorQuerySchema))
  return NextResponse.json({
    data: {
      ...board,
      exclusiveAlertRecipients: listExclusiveRadarRecipients(),
    },
  })
}

export async function testRadarAlertHandler({ auth }: RouteArgs): Promise<NextResponse> {
  const result = await dispatchExclusiveRadarAlert({
    kind: 'test',
    detailAr: `تنبيه اختباري من AetherBI بواسطة ${auth.userId} — مستلمو الإنذار الفوري المعتمدون فقط (WhatsApp + Telegram + Email).`,
  })
  return NextResponse.json({
    data: {
      recipients: listExclusiveRadarRecipients(),
      telegramBroadcast: result.telegramBroadcast,
      channels: result.channels,
      text: result.text,
    },
  })
}

export async function scanAggregatorHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return created(await scanAggregator(auth, requireIdempotencyKey(request), await parseBody(request, scanSchema)))
}

export async function escalationActionHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await actOnEscalation(auth, id, await parseBody(request, escalationDecisionSchema)))
}
