import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { logMonitoringHandler, monitoringHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govMonitorRead, monitoringHandler)
export const POST = protectedRoute(permissions.govMonitorManage, logMonitoringHandler)
