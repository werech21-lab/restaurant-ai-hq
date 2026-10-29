import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listViolationsHandler, registerViolationHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govViolationRead, listViolationsHandler)
export const POST = protectedRoute(permissions.govViolationManage, registerViolationHandler)
