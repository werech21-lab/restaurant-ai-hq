import { NextResponse } from 'next/server'
import { dispatchExclusiveOperationalReport, listExclusiveRadarRecipients } from '@/lib/alerts'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { idParamsSchema } from '@/modules/governance/schemas/governance'
import { aggregatorQuerySchema, escalationDecisionSchema, scanSchema } from '@/modules/governance/schemas/aggregator'
import { actOnEscalation, aggregatorBoard, scanAggregator } from '@/modules/governance/services/aggregator-service'
import { buildForensicMatrix } from '@/modules/governance/domain/forensic-radar'
import { listForensicHistory } from '@/modules/governance/services/forensic-radar-service'
import { getSmtpPublicStatus } from '@/lib/email/server-mail'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function aggregatorBoardHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const board = await aggregatorBoard(auth, parseQuery(request, aggregatorQuerySchema))
  const smtp = await getSmtpPublicStatus()
  return NextResponse.json({
    data: {
      ...board,
      exclusiveAlertRecipients: listExclusiveRadarRecipients(),
      smtp,
    },
  })
}

export async function testRadarAlertHandler({ auth }: RouteArgs): Promise<NextResponse> {
  const history = listForensicHistory()
  const snapshots = history.length ? history : [buildForensicMatrix()]
  const result = await dispatchExclusiveOperationalReport(snapshots)
  return NextResponse.json({
    data: {
      recipients: listExclusiveRadarRecipients(),
      telegramBroadcast: result.telegramBroadcast,
      channels: result.channels,
      chunksSent: result.chunksSent,
      delivery: result.delivery,
      smtp: result.smtp,
      summary: {
        critical: result.report.sections.critical.length,
        watch: result.report.sections.watch.length,
        clean: result.report.sections.clean.length,
        rejectedEstate: result.report.sections.rejectedEstate,
        recordedLostKwd: (result.report.sections.recordedLostMinor / 1000).toFixed(3),
        penaltyKwd: (result.report.sections.penaltyMinor / 1000).toFixed(3),
        kuwaitDate: result.report.sections.kuwaitDate,
        kuwaitTime: result.report.sections.kuwaitTime,
        dispatchedBy: auth.userId,
      },
      text: result.report.en,
      textAr: result.report.ar,
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
