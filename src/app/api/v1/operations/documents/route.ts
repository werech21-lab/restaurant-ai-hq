import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createDocumentHandler, listDocumentsHandler } from '@/modules/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.opsDocumentRead, listDocumentsHandler)
export const POST = protectedRoute(permissions.opsDocumentManage, createDocumentHandler)
