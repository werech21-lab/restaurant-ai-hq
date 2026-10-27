import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  commandBodySchema,
  decideApprovalSchema,
  idParamsSchema,
  insightVersionSchema,
  listApprovalsQuerySchema,
  listInsightsQuerySchema,
  scanBodySchema,
  updateRuleSchema,
} from '@/modules/ai/schemas/ai'
import { approveApproval, getApproval, listApprovals, rejectApproval } from '@/modules/ai/services/approval-service'
import { runCommand } from '@/modules/ai/services/command-service'
import { getDashboard } from '@/modules/ai/services/dashboard-service'
import { acknowledgeInsight, getInsight, listInsights, resolveInsight } from '@/modules/ai/services/insight-service'
import { listRules, updateRule } from '@/modules/ai/services/rule-service'
import { runScan } from '@/modules/ai/services/scan-service'

export async function dashboardHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json({ data: await getDashboard(auth) }, { status: 200 })
}

// ---- insights ----

export async function listInsightsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listInsightsQuerySchema)
  return NextResponse.json(await listInsights(auth, query), { status: 200 })
}

export async function getInsightHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getInsight(auth, id), { status: 200 })
}

export async function acknowledgeInsightHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, insightVersionSchema)
  return NextResponse.json(await acknowledgeInsight(auth, id, input), { status: 200 })
}

export async function resolveInsightHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, insightVersionSchema)
  return NextResponse.json(await resolveInsight(auth, id, input), { status: 200 })
}

// ---- scan and command ----

/** The full system scan. It is safe to repeat: findings are keyed by fingerprint, so a rescan updates instead of duplicating. */
export async function scanHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  await parseBody(request, scanBodySchema)
  return NextResponse.json({ data: await runScan(auth, { trigger: null, itemIds: null }) }, { status: 200 })
}

export async function commandHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, commandBodySchema)
  return NextResponse.json({ data: await runCommand(auth, input) }, { status: 200 })
}

// ---- approvals ----

export async function listApprovalsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listApprovalsQuerySchema)
  return NextResponse.json(await listApprovals(auth, query), { status: 200 })
}

export async function getApprovalHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getApproval(auth, id), { status: 200 })
}

export async function approveApprovalHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, decideApprovalSchema)
  const outcome = await approveApproval(auth, id, key, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}

export async function rejectApprovalHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, decideApprovalSchema)
  return NextResponse.json(await rejectApproval(auth, id, input), { status: 200 })
}

// ---- rules ----

export async function listRulesHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listRules(auth), { status: 200 })
}

export async function updateRuleHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateRuleSchema)
  return NextResponse.json(await updateRule(auth, id, input), { status: 200 })
}
