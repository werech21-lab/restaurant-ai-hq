import { NextResponse } from 'next/server'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute, type RouteArgs } from '@/lib/api/route'
import { parseBody, parseQuery } from '@/lib/api/parse'
import { assignHrDocument, ingestHrFolderBatch, listEmployeeDossier } from '@/services/hr-folder-ingestor.service'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const fileSchema = z.object({
  relativePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(260),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(25_000_000).optional(),
  contentBase64: z.string().max(8_000_000).optional(),
  textHint: z.string().max(20_000).optional(),
})

const ingestSchema = z.object({
  batchId: z.string().max(80).optional(),
  files: z.array(fileSchema).min(1).max(40),
})

const assignSchema = z.object({
  documentId: z.string().min(1),
  employeeId: z.string().min(1),
})

const bodySchema = z.union([ingestSchema, assignSchema])

async function postHandler({ request, auth }: RouteArgs) {
  const body = await parseBody(request, bodySchema)
  if ('files' in body) {
    const data = await ingestHrFolderBatch({ actorId: auth.userId, batchId: body.batchId, files: body.files })
    return NextResponse.json({ data }, { status: 201 })
  }
  const data = await assignHrDocument({ ...body, actorId: auth.userId })
  return NextResponse.json({ data })
}

async function getHandler({ request, auth: _auth }: RouteArgs) {
  const query = parseQuery(request, z.object({ employeeId: z.string().min(1) }))
  return NextResponse.json({ data: { dossier: await listEmployeeDossier(query.employeeId) } })
}

export const POST = protectedRoute(permissions.hrEmployeeManage, postHandler)
export const GET = protectedRoute(permissions.hrEmployeeRead, getHandler)
