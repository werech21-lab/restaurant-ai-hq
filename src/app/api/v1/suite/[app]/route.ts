import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createRecordHandler, getBoardHandler } from '@/modules/suite'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.suiteRead, getBoardHandler)
export const POST = protectedRoute(permissions.suiteManage, createRecordHandler)
