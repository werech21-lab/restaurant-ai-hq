import { NextResponse } from 'next/server'
import { parseBody, parseParams } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { createSuiteRecordSchema, suiteAppParamsSchema, suiteRecordParamsSchema, updateSuiteRecordSchema } from '@/modules/suite/schemas/suite'
import { createRecord, getBoard, updateRecord } from '@/modules/suite/services/suite-service'

export async function getBoardHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  const { app } = parseParams(params, suiteAppParamsSchema)
  return NextResponse.json(await getBoard(auth, app))
}

export async function createRecordHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { app } = parseParams(params, suiteAppParamsSchema)
  const input = await parseBody(request, createSuiteRecordSchema)
  return NextResponse.json(await createRecord(auth, app, input), { status: 201 })
}

export async function updateRecordHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { app, id } = parseParams(params, suiteRecordParamsSchema)
  const input = await parseBody(request, updateSuiteRecordSchema)
  return NextResponse.json(await updateRecord(auth, app, id, input))
}
