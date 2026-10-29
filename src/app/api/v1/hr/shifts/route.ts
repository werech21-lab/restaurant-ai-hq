import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createShiftHandler, listShiftsHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrAttendanceRead, listShiftsHandler)
export const POST = protectedRoute(permissions.hrAttendanceManage, createShiftHandler)
