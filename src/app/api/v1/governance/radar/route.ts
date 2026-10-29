import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listRadarHandler, recordRadarHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govRadarRead, listRadarHandler)
export const POST = protectedRoute(permissions.govRadarManage, recordRadarHandler)
