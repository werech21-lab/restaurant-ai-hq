import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createLeaveHandler, listLeavesHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrLeaveRead, listLeavesHandler)
export const POST = protectedRoute(permissions.hrLeaveApprove, createLeaveHandler)
