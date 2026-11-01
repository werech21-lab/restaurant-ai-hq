import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/parse'
import type { PublicRouteArgs } from '@/lib/api/route'
import { trialRequestSchema } from '@/modules/marketing/schemas/trial'
import { submitTrialRequest } from '@/modules/marketing/services/trial-service'

export async function trialRequestHandler({ request }: PublicRouteArgs): Promise<NextResponse> {
  const input = await parseBody(request, trialRequestSchema)
  const result = await submitTrialRequest(input)
  return NextResponse.json(result, { status: 201 })
}
