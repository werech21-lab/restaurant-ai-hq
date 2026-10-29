import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listPayrollHandler, runPayrollHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrPayrollRead, listPayrollHandler)
export const POST = protectedRoute(permissions.hrPayrollRun, runPayrollHandler)
