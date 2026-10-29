import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createEmployeeHandler, listEmployeesHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrEmployeeRead, listEmployeesHandler)
export const POST = protectedRoute(permissions.hrEmployeeManage, createEmployeeHandler)
