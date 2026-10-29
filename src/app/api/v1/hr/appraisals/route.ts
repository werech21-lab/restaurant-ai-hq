import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createAppraisalHandler, listAppraisalsHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrAppraisalRead, listAppraisalsHandler)
export const POST = protectedRoute(permissions.hrAppraisalManage, createAppraisalHandler)
