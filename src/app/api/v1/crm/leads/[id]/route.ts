import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getLeadHandler, updateLeadHandler } from '@/modules/crm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.crmLeadRead, getLeadHandler)
export const PATCH = protectedRoute(permissions.crmLeadUpdate, updateLeadHandler)
