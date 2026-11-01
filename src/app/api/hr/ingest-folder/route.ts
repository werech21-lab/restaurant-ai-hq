import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { toErrorResponse } from '@/lib/api/route'
import { assignHrDocument, ingestHrFolderBatch, listEmployeeDossier, listReviewQueue } from '@/services/hr-folder-ingestor.service'
import { prisma } from '@/lib/db'
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

async function requireHrEditor() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 }) }
  if (!can(user, 'hr', 'create') && !can(user, 'hr', 'edit') && !user.role.isAdmin) {
    return { error: NextResponse.json({ error: { code: 'forbidden', message: 'HR permission required' } }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireHrEditor()
    if ('error' in auth && auth.error) return auth.error
    const url = request.nextUrl
    const employeeId = url.searchParams.get('employeeId')
    if (employeeId) {
      return NextResponse.json({ data: { dossier: await listEmployeeDossier(employeeId) } })
    }
    if (url.searchParams.get('review') === '1') {
      const queue = await listReviewQueue()
      return NextResponse.json({
        data: {
          review: queue.map((row) => ({
            id: row.id,
            fileName: row.fileName,
            relativePath: row.relativePath,
            category: row.category,
            matchScore: row.matchScore,
            suggestedEmployeeId: row.employeeId,
            suggestedEmployeeName: row.employee?.name ?? null,
          })),
        },
      })
    }
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, department: true },
      orderBy: { name: 'asc' },
      take: 500,
    })
    return NextResponse.json({ data: { employees } })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireHrEditor()
    if ('error' in auth && auth.error) return auth.error
    const body = (await request.json()) as unknown
    if (typeof body === 'object' && body && 'documentId' in body && 'employeeId' in body && !('files' in body)) {
      const parsed = assignSchema.parse(body)
      const row = await assignHrDocument({
        documentId: parsed.documentId,
        employeeId: parsed.employeeId,
        actorId: auth.user!.id,
      })
      return NextResponse.json({ data: row })
    }
    const parsed = ingestSchema.parse(body)
    const result = await ingestHrFolderBatch({
      actorId: auth.user!.id,
      batchId: parsed.batchId,
      files: parsed.files,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}
