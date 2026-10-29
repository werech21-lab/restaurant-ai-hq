import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createTicketHandler, listTicketsHandler } from '@/modules/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.opsQualityRead, listTicketsHandler)
export const POST = protectedRoute(permissions.opsQualityManage, createTicketHandler)
