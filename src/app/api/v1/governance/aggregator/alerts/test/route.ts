import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { testRadarAlertHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.govAggregatorManage, testRadarAlertHandler)
