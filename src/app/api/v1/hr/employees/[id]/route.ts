import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { removeEmployeeHandler, updateEmployeeHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.hrEmployeeManage, updateEmployeeHandler)
export const DELETE = protectedRoute(permissions.hrEmployeeManage, removeEmployeeHandler)
