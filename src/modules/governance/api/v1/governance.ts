import { NextResponse } from 'next/server'
import { parseBody, parseParams } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  analyzeContractFor,
  enforceCircular,
  listAnalyses,
  listArchive,
  listBlocks,
  listCirculars,
  listMemory,
  listRadar,
  listRules,
  listTelemetry,
  recordRadar,
  recordTelemetry,
  simulateCompliance,
} from '@/modules/governance/services/governance-service'
import {
  analyzeSchema,
  enforceSchema,
  idParamsSchema,
  radarSchema,
  simulateSchema,
  telemetrySchema,
} from '@/modules/governance/schemas/governance'

function created(outcome: { status: number; body: unknown; replayed: boolean }): NextResponse {
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function listAnalysesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listAnalyses(auth) })
}

export async function analyzeContractHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, analyzeSchema)
  return created(await analyzeContractFor(auth, requireIdempotencyKey(request), input))
}

export async function listCircularsHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listCirculars(auth) })
}

export async function enforceCircularHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, enforceSchema)
  return NextResponse.json(await enforceCircular(auth, id, input))
}

export async function listRulesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listRules(auth) })
}

export async function listBlocksHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listBlocks(auth) })
}

export async function simulateHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, simulateSchema)
  return NextResponse.json({ data: await simulateCompliance(auth, input) })
}

export async function listMemoryHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listMemory(auth) })
}

export async function listArchiveHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listArchive(auth) })
}

export async function listTelemetryHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listTelemetry(auth) })
}

export async function recordTelemetryHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, telemetrySchema)
  return created(await recordTelemetry(auth, requireIdempotencyKey(request), input))
}

export async function listRadarHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await listRadar(auth) })
}

export async function recordRadarHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, radarSchema)
  return created(await recordRadar(auth, requireIdempotencyKey(request), input))
}
