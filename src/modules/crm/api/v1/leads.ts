import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { idParamsSchema } from '@/modules/crm/schemas/common'
import { createLeadSchema, listLeadsQuerySchema, moveLeadSchema, updateLeadSchema } from '@/modules/crm/schemas/lead'
import {
  createLead,
  getLead,
  getStageSummary,
  listLeads,
  listTeam,
  moveLead,
  updateLead,
} from '@/modules/crm/services/lead-service'

export async function listLeadsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const query = parseQuery(request, listLeadsQuerySchema)
  return NextResponse.json(await listLeads(auth, query), { status: 200 })
}

export async function leadSummaryHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getStageSummary(auth), { status: 200 })
}

export async function teamHandler({ auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listTeam(auth), { status: 200 })
}

export async function getLeadHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  return NextResponse.json(await getLead(auth, id), { status: 200 })
}

export async function createLeadHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const input = await parseBody(request, createLeadSchema)
  const outcome = await createLead(auth, key, input)
  return NextResponse.json(outcome.body, {
    status: outcome.status,
    headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined,
  })
}

export async function updateLeadHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, updateLeadSchema)
  return NextResponse.json(await updateLead(auth, id, input), { status: 200 })
}

export async function moveLeadHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, idParamsSchema)
  const input = await parseBody(request, moveLeadSchema)
  return NextResponse.json(await moveLead(auth, id, input), { status: 200 })
}
