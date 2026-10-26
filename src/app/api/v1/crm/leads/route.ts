import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createLeadHandler, listLeadsHandler } from '@/modules/crm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.crmLeadRead, listLeadsHandler)
export const POST = protectedRoute(permissions.crmLeadCreate, createLeadHandler)
