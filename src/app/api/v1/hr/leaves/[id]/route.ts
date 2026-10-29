import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { decideLeaveHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.hrLeaveApprove, decideLeaveHandler)
