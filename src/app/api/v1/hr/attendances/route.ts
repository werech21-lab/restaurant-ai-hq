import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createAttendanceHandler, listAttendanceHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrAttendanceRead, listAttendanceHandler)
export const POST = protectedRoute(permissions.hrAttendanceManage, createAttendanceHandler)
